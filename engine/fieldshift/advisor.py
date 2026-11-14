"""Advisor: answers questions about a plan, grounded in the plan data.

Two modes, chosen automatically:

* **llm**   - when ANTHROPIC_API_KEY is set (and FIELDSHIFT_OFFLINE is off), Claude answers
              and can call engine tools to look things up in the plan (rotation details, a
              specific replay year, decision points, soil / irrigation, why-it-lost, the
              live drought status, crop feasibility, data sources).
* **rules** - otherwise, a keyword-based responder builds the answer from the same plan
              data with the engine's own sentence templates.  The app is fully usable
              without any API key.

Either way the advisor never invents numbers: everything it says comes from the plan.
"""
from __future__ import annotations

import json
import re
from typing import Any, Callable

from . import config
from .i18n import t

DEFAULT_MODEL = "claude-opus-5-5"
MAX_TOOL_ROUNDS = 8
MAX_TOKENS = 16000

SYSTEM_PROMPT = """You are the advisor inside Field Shift, a decision-support tool that helps farmers and \
agricultural advisers explore crop-rotation plans built from NASA Earth-observation data.

The person asking is a farmer or an extension worker looking at one specific plan for one farm. \
Use the tools to look up what the plan says before you answer; every number you give must come from \
a tool result. If the plan does not contain what they ask for, say so plainly rather than estimating.

What the numbers mean, so you describe them correctly:
- Scores (0-100) are relative comparisons between rotations for this farm. They are not yield, price \
or profit predictions, and "income" is a relative index built from 0-5 income bands.
- The "replay" runs each rotation through every past year of NASA weather. "Worst-case" is the average \
score in a rotation's worst 20% of years; "regret" is how far it fell short of the best plan in a year.
- Decision points are if-then rules found in the replay and tested on years left out of the search.
- Soil projections are illustrative. Data-source labels (observed / modelled / farmer-entered) matter: \
mention when something is modelled or was unavailable if it bears on the answer.

Answer in the language of the question (English or Filipino/Tagalog), in plain words a farmer would use, \
and keep it short: lead with the answer, then the one or two numbers that support it. For any decision \
about what to plant, remind them once to review the plan with a local agricultural adviser, because the \
tool supports their judgement and does not replace it."""


# ---- plan lookups shared by both modes -------------------------------------------------------
def _rotation(plan: dict, rotation_id: str | None) -> dict | None:
    rotations = plan.get("rotations") or []
    wanted = (rotation_id or plan.get("winner_id") or "").strip().lower()
    for r in rotations:
        if r["id"].lower() == wanted:
            return r
    for r in rotations:
        if not r.get("is_current"):
            return r
    return rotations[0] if rotations else None


def _slots_text(rotation: dict) -> str:
    years = []
    for year in (1, 2, 3):
        names = [s["crop_name"] for s in rotation["slots"] if s["year"] == year]
        years.append(f"Y{year}: " + " -> ".join(names))
    return "; ".join(years)


def tool_plan_overview(plan: dict) -> dict:
    return {
        "location": plan.get("location"),
        "season_plan": plan.get("season_plan"),
        "settings": plan.get("settings"),
        "replay_years": [plan["years"][0], plan["years"][-1]] if plan.get("years") else None,
        "valid_rotations_enumerated": (plan.get("enumeration") or {}).get("valid_rotations"),
        "winner_id": plan.get("winner_id"),
        "rotations": [
            {
                "id": r["id"],
                "name": r["name"],
                "is_current": r["is_current"],
                "rank": r["rank"],
                "crops": _slots_text(r),
                "scores": r["scores"],
                "win_rate_vs_current": r["replay"]["win_rate_vs_current"],
                "max_regret": r["replay"]["max_regret"],
            }
            for r in plan.get("rotations", [])
        ],
        "disclaimer": plan.get("disclaimer"),
    }


def tool_rotation(plan: dict, rotation_id: str) -> dict:
    r = _rotation(plan, rotation_id)
    if r is None:
        return {"error": f"no rotation '{rotation_id}' in the plan"}
    return {
        "id": r["id"],
        "name": r["name"],
        "crops": _slots_text(r),
        "scores": r["scores"],
        "replay": r["replay"],
        "reasons": r["reasons"],
        "rule_violations": r.get("rule_violations", []),
    }


def tool_year(plan: dict, rotation_id: str, year: int) -> dict:
    r = _rotation(plan, rotation_id)
    if r is None:
        return {"error": f"no rotation '{rotation_id}' in the plan"}
    for row in r["yearly"]:
        if row["year"] == int(year):
            slots = [
                {"crop": s["crop_name"], "season": s["season_kind"], **(row["slots"][i] or {"status": "fallow"})}
                for i, s in enumerate(r["slots"])
            ]
            return {**{k: v for k, v in row.items() if k != "slots"}, "rotation": r["id"], "slots": slots}
    return {"error": f"year {year} is not in the replay", "available_years": [plan["years"][0], plan["years"][-1]]}


def tool_decision_points(plan: dict, rotation_id: str) -> dict:
    r = _rotation(plan, rotation_id)
    if r is None or not r.get("adaptive"):
        return {"error": "no adaptive plan for this rotation (the current rotation has none)"}
    a = r["adaptive"]
    return {
        "rotation": r["id"],
        "summary": a["summary"],
        "comparison": a["comparison"],
        "decision_points": [
            {k: p.get(k) for k in ("year_in_rotation", "season_kind", "planned_crop", "has_rule", "rule_text", "evidence", "message", "stats")}
            for p in a["decision_points"]
        ],
    }


def tool_soil_and_water(plan: dict, rotation_id: str) -> dict:
    r = _rotation(plan, rotation_id)
    if r is None:
        return {"error": f"no rotation '{rotation_id}' in the plan"}
    sp = dict(r["soil_projection"])
    for key in ("soc_t_ha", "soc_g_kg", "n_cumulative_need_kg_ha", "n_cumulative_from_legumes_kg_ha", "years"):
        sp.pop(key, None)
    return {"rotation": r["id"], "soil_projection": sp, "irrigation": r["irrigation"], "farm_soil": plan.get("soil")}


def tool_why_it_lost(plan: dict, rotation_id: str) -> dict:
    for entry in plan.get("why_it_lost", []):
        if entry["rotation_id"].lower() == (rotation_id or "").lower():
            return entry
    return {"error": f"'{rotation_id}' is the winner or is not in the plan", "available": [e["rotation_id"] for e in plan.get("why_it_lost", [])]}


def tool_feasibility(plan: dict, crop_id: str) -> dict:
    rows = [f for f in plan.get("feasibility", []) if f["crop_id"] == (crop_id or "").strip().lower()]
    if not rows:
        return {"error": f"unknown crop '{crop_id}'", "crops": [c["id"] for c in plan.get("crops", [])]}
    return {"crop_id": crop_id, "seasons": rows}


def tool_data_sources(plan: dict) -> dict:
    backtest = plan.get("backtest") or {}
    return {
        "sources": plan.get("sources"),
        "gaps": plan.get("gaps"),
        "backtest": {
            "available": backtest.get("available"),
            "seasons": {k: {kk: vv for kk, vv in v.items() if kk != "points"} for k, v in (backtest.get("seasons") or {}).items()},
            "caveats": backtest.get("caveats"),
        },
    }


def tool_drought(plan: dict, drought_fn: Callable[[float, float, str], dict] | None) -> dict:
    if drought_fn is None:
        return {"error": "drought status is not available in this context"}
    location = plan.get("location") or {}
    try:
        status = drought_fn(float(location["lat"]), float(location["lon"]), plan.get("lang", "en"))
    except Exception as exc:  # the advisor must not crash on a data-source failure
        return {"error": f"drought status unavailable: {exc}"}
    return {k: status.get(k) for k in ("level", "headline", "reasons", "signals", "vitals", "as_of", "root_zone_source")}


TOOLS: list[dict[str, Any]] = [
    {
        "name": "get_plan_overview",
        "description": "Summary of the whole plan: the farm, its seasons, the farmer's settings, and every displayed rotation (current + options A/B/C) with scores. Call this first.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "get_rotation",
        "description": "Full detail of one rotation: crops by year and season, the four criterion scores, replay statistics and the plain-language reasons behind each score.",
        "input_schema": {
            "type": "object",
            "properties": {"rotation_id": {"type": "string", "description": "'current', 'A', 'B' or 'C'"}},
            "required": ["rotation_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_year",
        "description": "How one rotation would have fared in one past year of NASA weather: its score and each crop-season outcome (good / stressed / failed).",
        "input_schema": {
            "type": "object",
            "properties": {
                "rotation_id": {"type": "string", "description": "'current', 'A', 'B' or 'C'"},
                "year": {"type": "integer", "description": "A year in the replay record, e.g. 1998"},
            },
            "required": ["rotation_id", "year"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_decision_points",
        "description": "The adaptive plan of an option: its if-then decision points (check date, signal, threshold, alternative crop), the evidence for each, and how the adaptive plan compares with the fixed one.",
        "input_schema": {
            "type": "object",
            "properties": {"rotation_id": {"type": "string", "description": "'A', 'B' or 'C'"}},
            "required": ["rotation_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_soil_and_water",
        "description": "Soil-health projection (organic carbon, nitrogen from legumes vs fertiliser) and irrigation need per crop and per year for one rotation, plus the farm's soil values and where each came from.",
        "input_schema": {
            "type": "object",
            "properties": {"rotation_id": {"type": "string", "description": "'current', 'A', 'B' or 'C'"}},
            "required": ["rotation_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_why_it_lost",
        "description": "For a rotation that is not the winner: how far behind it is, on which criteria, and the smallest change in priorities or rainfall that would make it win.",
        "input_schema": {
            "type": "object",
            "properties": {"rotation_id": {"type": "string", "description": "'current', 'B' or 'C'"}},
            "required": ["rotation_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_crop_feasibility",
        "description": "Whether a crop passed the feasibility filter in each season on this farm, with the reason for every check (temperature, water, salinity, reliability...). Use it for 'why not onion?' questions.",
        "input_schema": {
            "type": "object",
            "properties": {"crop_id": {"type": "string", "description": "Crop id, e.g. 'onion', 'mungbean', 'rice'"}},
            "required": ["crop_id"],
            "additionalProperties": False,
        },
    },
    {
        "name": "get_drought_status",
        "description": "Current field vitals and flash-drought warning level for the farm, computed by the engine from the latest NASA data.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
    {
        "name": "get_data_sources",
        "description": "Which data sources the plan used (observed vs modelled, resolution, dates), what was unavailable, known information gaps, and the backtest result.",
        "input_schema": {"type": "object", "properties": {}, "additionalProperties": False},
    },
]


def run_tool(name: str, args: dict, plan: dict, drought_fn=None) -> dict:
    args = args if isinstance(args, dict) else {}
    if name == "get_plan_overview":
        return tool_plan_overview(plan)
    if name == "get_rotation":
        return tool_rotation(plan, str(args.get("rotation_id", "")))
    if name == "get_year":
        try:
            year = int(args.get("year"))
        except (TypeError, ValueError):
            return {"error": "year must be an integer"}
        return tool_year(plan, str(args.get("rotation_id", "")), year)
    if name == "get_decision_points":
        return tool_decision_points(plan, str(args.get("rotation_id", "")))
    if name == "get_soil_and_water":
        return tool_soil_and_water(plan, str(args.get("rotation_id", "")))
    if name == "get_why_it_lost":
        return tool_why_it_lost(plan, str(args.get("rotation_id", "")))
    if name == "get_crop_feasibility":
        return tool_feasibility(plan, str(args.get("crop_id", "")))
    if name == "get_drought_status":
        return tool_drought(plan, drought_fn)
    if name == "get_data_sources":
        return tool_data_sources(plan)
    return {"error": f"unknown tool '{name}'"}


# ---- LLM mode --------------------------------------------------------------------------------
def llm_available() -> bool:
    return bool(config.env("ANTHROPIC_API_KEY")) and not config.offline()


def answer_with_llm(question: str, plan: dict, history: list[dict], drought_fn=None) -> dict:
    """Claude answers, calling engine tools as needed. Raises on API problems (caller falls back)."""
    import anthropic  # imported lazily so the engine runs without the package configured

    client = anthropic.Anthropic()
    model = config.env("ADVISOR_MODEL") or DEFAULT_MODEL
    messages: list[dict] = []
    for turn in history[-8:]:
        role, content = turn.get("role"), turn.get("content")
        if role in ("user", "assistant") and isinstance(content, str) and content.strip():
            if messages and messages[-1]["role"] == role:
                continue  # the API needs alternating turns
            messages.append({"role": role, "content": content})
    if messages and messages[-1]["role"] == "user":
        messages.pop()
    messages.append({"role": "user", "content": question})

    tools_used: list[str] = []
    for _ in range(MAX_TOOL_ROUNDS):
        response = client.beta.messages.create(
            model=model,
            max_tokens=MAX_TOKENS,
            system=SYSTEM_PROMPT,
            tools=TOOLS,
            messages=messages,
            output_config={"effort": "medium"},
            # If a safety classifier declines, the API retries on a fallback model in the same call.
            betas=["server-side-fallback-2026-07-01"],
            fallbacks="default",
        )
        if response.stop_reason == "refusal":
            raise RuntimeError("the model declined to answer this question")
        if response.stop_reason == "pause_turn":
            messages.append({"role": "assistant", "content": response.content})
            continue
        if response.stop_reason != "tool_use":
            text = "\n".join(b.text for b in response.content if b.type == "text").strip()
            if not text:
                raise RuntimeError(f"the model returned no text (stop reason: {response.stop_reason})")
            return {"answer": text, "mode": "llm", "model": response.model, "tools_used": tools_used}
        messages.append({"role": "assistant", "content": response.content})
        results = []
        for block in response.content:
            if block.type != "tool_use":
                continue
            tools_used.append(block.name)
            output = run_tool(block.name, block.input, plan, drought_fn)
            results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": json.dumps(output, default=str)[:60000],
                    "is_error": "error" in output,
                }
            )
        messages.append({"role": "user", "content": results})
    raise RuntimeError("the model did not finish within the tool-call limit")


# ---- rule-based mode -------------------------------------------------------------------------
INTENTS: list[tuple[str, tuple[str, ...]]] = [
    ("drought", ("drought", "tagtuyot", "tuyot", "vitals", "moisture now", "right now", "ngayon", "today")),
    ("adaptive", ("decision", "adaptive", "switch", "if ", "when should", "check", "pasya", "palit", "kailan", "suriin")),
    ("why", ("why did", "why not", "lost", "lose", "natalo", "bakit hindi", "bakit natalo")),
    ("water", ("water", "irrigat", "tubig", "patubig", "rain", "ulan")),
    ("soil", ("soil", "lupa", "nitrogen", "carbon", "fertili", "abono", "legume", "nitroheno")),
    ("income", ("income", "profit", "money", "kita", "earn", "tubo", "pera")),
    ("risk", ("risk", "worst", "bad year", "fail", "panganib", "palya", "el nino", "el niño", "typhoon", "bagyo")),
    ("data", ("data", "source", "nasa", "satellite", "accura", "trust", "confidence", "datos", "tiwala", "backtest")),
    ("compare", ("compare", "current", "versus", " vs", "difference", "kasalukuyan", "ihambing", "pagkakaiba")),
    ("best", ("best", "recommend", "which", "top", "winner", "should i", "pinakamahusay", "alin", "maganda", "irekomenda", "what to plant", "ano ang itatanim")),
]


def _intent(question: str) -> str:
    q = " " + question.lower() + " "
    for name, words in INTENTS:
        if any(w in q for w in words):
            return name
    return "help"


def _mentioned_rotation(question: str, plan: dict) -> str | None:
    q = question.lower()
    if "current" in q or "kasalukuyan" in q:
        return "current"
    match = re.search(r"\b(?:option|opsyon|plan|plano)\s*([abc])\b", q)
    return match.group(1).upper() if match else None


def _reasons(rotation: dict, criterion: str, limit: int = 3) -> str:
    return " ".join(r["text"] for r in rotation["reasons"] if r["criterion"] == criterion)[: 900 if limit else None]


def answer_with_rules(question: str, plan: dict | None, lang: str = "en", drought_fn=None) -> dict:
    note = t(lang, "advisor.fallback_note")
    if not plan or not plan.get("rotations"):
        return {"answer": t(lang, "advisor.no_plan"), "mode": "rules", "note": note}
    intent = _intent(question)
    target = _mentioned_rotation(question, plan)
    rotation = _rotation(plan, target)
    winner = _rotation(plan, plan.get("winner_id"))
    current = _rotation(plan, "current")
    name = rotation["name"]
    year_match = re.search(r"\b(19[89]\d|20[0-4]\d)\b", question)

    if year_match and intent not in ("drought", "data"):
        row = tool_year(plan, rotation["id"], int(year_match.group(1)))
        if "error" not in row:
            detail = t(lang, "advisor.year.bad", failed=row["failed_slots"]) if row["bad_year"] else t(lang, "advisor.year.ok")
            slots = "; ".join(f"{s['crop']} ({s['season']}): {s.get('outcome', '-')}" for s in row["slots"] if s.get("status") != "fallow")
            text = t(lang, "advisor.year", year=row["year"], name=name, score=row["score"], performance=row["performance"], detail=detail) + " " + slots
            return {"answer": text, "mode": "rules", "note": note}

    if intent == "drought":
        status = tool_drought(plan, drought_fn)
        if "error" in status:
            text = status["error"]
        else:
            text = t(lang, "advisor.drought", headline=status["headline"], reasons=" ".join(status["reasons"]))
    elif intent == "adaptive":
        if rotation.get("is_current"):
            rotation, name = winner, winner["name"]
        points = [p for p in rotation["adaptive"]["decision_points"] if p["has_rule"]]
        if points:
            rules = " ".join(f"({i}) {p['rule_text']}" for i, p in enumerate(points, 1))
            text = t(lang, "advisor.adaptive", name=name, rules=rules) + " " + rotation["adaptive"]["summary"]
        else:
            text = t(lang, "advisor.adaptive.none", name=name)
    elif intent == "why":
        entry = tool_why_it_lost(plan, rotation["id"] if rotation["id"] != plan.get("winner_id") else "current")
        if "error" in entry:
            text = t(lang, "advisor.help")
        else:
            text = t(lang, "advisor.why", text=entry["summary"], priority=entry["priority_change"]["text"], rain=entry["rainfall_change"]["text"])
    elif intent == "water":
        irrigation = rotation["irrigation"]
        text = t(
            lang,
            "advisor.water",
            name=name,
            net=round(irrigation["net_m3_per_year_mean"]),
            p80=round(irrigation["net_m3_per_year_p80"]),
            source=t(lang, f"water_source.{irrigation['water_source']}"),
            water=rotation["scores"]["water"],
        )
    elif intent == "soil":
        text = t(lang, "advisor.soil", name=name, soil=rotation["scores"]["soil"], detail=_reasons(rotation, "soil"))
    elif intent == "income":
        text = t(lang, "advisor.income", name=name, income=rotation["scores"]["income"], detail=_reasons(rotation, "income"))
    elif intent == "risk":
        text = t(lang, "advisor.risk", name=name, detail=_reasons(rotation, "risk"), years=", ".join(str(y) for y in rotation["replay"]["worst_years"]))
    elif intent == "data":
        sources = "; ".join(
            f"{s['title']} ({s['kind']}, {s['origin']})" if s["available"] else f"{s['title']} (unavailable)" for s in plan["sources"]
        )
        text = t(lang, "advisor.data", sources=sources, gaps=" ".join(plan["gaps"][:4]))
    elif intent == "compare":
        diffs = ", ".join(
            f"{t(lang, 'criterion.' + c)} {current['scores'][c]} -> {winner['scores'][c]}" for c in ("water", "soil", "risk", "income")
        )
        text = t(lang, "advisor.compare", cur=current["scores"]["overall"], best=winner["scores"]["overall"], name=winner["name"], diffs=diffs)
    elif intent == "best":
        text = t(
            lang,
            "advisor.best",
            name=winner["name"],
            slots=_slots_text(winner),
            overall=winner["scores"]["overall"],
            years=winner["replay"]["years"],
            worst=winner["scores"]["worst_case"],
            win=round(100 * winner["replay"]["win_rate_vs_current"]),
        )
    else:
        text = t(lang, "advisor.help")
    return {"answer": f"{text}\n\n{plan.get('disclaimer', '')}".strip(), "mode": "rules", "note": note}


def answer(question: str, plan: dict | None, lang: str = "en", history: list[dict] | None = None, drought_fn=None) -> dict:
    """Entry point used by /api/advisor."""
    if plan and plan.get("rotations") and llm_available():
        try:
            return answer_with_llm(question, plan, history or [], drought_fn)
        except Exception as exc:  # any API problem: fall back to the rule-based answer, and say why
            fallback = answer_with_rules(question, plan, lang, drought_fn)
            fallback["note"] = f"{fallback.get('note', '')} {_describe_llm_error(exc)}".strip()
            return fallback
    return answer_with_rules(question, plan, lang, drought_fn)


def _describe_llm_error(exc: Exception) -> str:
    """Tell the user which kind of API problem sent them to the rule-based answer."""
    try:
        import anthropic
    except Exception:
        return "LLM unavailable: the anthropic package is not installed."
    if isinstance(exc, anthropic.AuthenticationError):
        return "LLM unavailable: the ANTHROPIC_API_KEY in .env was rejected."
    if isinstance(exc, anthropic.PermissionDeniedError):
        return "LLM unavailable: the API key lacks permission for this model."
    if isinstance(exc, anthropic.NotFoundError):
        return "LLM unavailable: the model named in ADVISOR_MODEL was not found."
    if isinstance(exc, anthropic.RateLimitError):
        return "LLM unavailable: rate limited by the API, try again shortly."
    if isinstance(exc, anthropic.APIStatusError):
        return f"LLM unavailable: the API returned HTTP {exc.status_code}."
    if isinstance(exc, anthropic.APIConnectionError):
        return "LLM unavailable: could not reach the API (no network?)."
    return f"LLM unavailable: {type(exc).__name__}: {str(exc)[:160]}"
