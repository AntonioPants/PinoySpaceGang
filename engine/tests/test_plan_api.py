"""End-to-end: the full planner and the HTTP API on synthetic data, offline."""
from __future__ import annotations

import json

import pytest
from fastapi.testclient import TestClient

from fieldshift import advisor, i18n
from fieldshift.api import app
from fieldshift.models import PlanRequest
from fieldshift.planner import PlanError, make_plan

from .conftest import LAT, LON

REQUEST = {"lat": LAT, "lon": LON, "current_rotation": ["rice", "fallow"], "water_source": "rainfed"}


@pytest.fixture()
def plan(data_dirs):
    return make_plan(PlanRequest(**REQUEST), data_dirs)


def test_plan_has_every_section(plan):
    for key in ("rotations", "ranking", "why_it_lost", "backtest", "sources", "gaps", "feasibility", "season_plan", "disclaimer"):
        assert key in plan
    ids = [r["id"] for r in plan["rotations"]]
    assert ids[0] == "current" and ids[1:] == ["A", "B", "C"]
    assert plan["winner_id"] == "A"
    for r in plan["rotations"][1:]:
        assert r["adaptive"] is not None
        assert r["soil_projection"]["illustrative"] is True
        assert len(r["yearly"]) == len(plan["years"])
    json.dumps(plan)  # serialisable


def test_plan_reports_unavailable_sources_instead_of_inventing(plan):
    by_name = {s["source"]: s for s in plan["sources"]}
    assert by_name["power"]["available"]
    for name in ("soilgrids", "smap_l4", "ecostress", "modis_ndvi"):
        assert by_name[name]["available"] is False and by_name[name]["reason"]
    assert plan["soil"]["provenance"]["texture"] == "assumed"
    assert any("ASSUMED" in g for g in plan["gaps"])
    assert plan["backtest"]["available"] is False


def test_unknown_crop_is_rejected(data_dirs):
    with pytest.raises(PlanError):
        make_plan(PlanRequest(**{**REQUEST, "current_rotation": ["banana", "fallow"]}), data_dirs)
    with pytest.raises(PlanError):
        make_plan(PlanRequest(**{**REQUEST, "current_rotation": ["fallow", "rice"]}), data_dirs)


def test_filipino_plan_has_no_untranslated_templates(data_dirs):
    plan = make_plan(PlanRequest(**{**REQUEST, "lang": "fil"}), data_dirs)
    text = json.dumps(plan, ensure_ascii=False)
    assert "Kasalukuyang ikot" in text
    assert "{crop}" not in text and "{years}" not in text


def test_all_messages_have_both_languages_and_matching_fields():
    import string

    for key, entry in i18n.MESSAGES.items():
        assert "en" in entry and "fil" in entry, key
        fields = {f for _, f, _, _ in string.Formatter().parse(entry["en"]) if f}
        fil_fields = {f for _, f, _, _ in string.Formatter().parse(entry["fil"]) if f}
        assert fil_fields <= fields, key


def test_rule_based_advisor_answers_from_the_plan(plan):
    out = advisor.answer("Which rotation is best?", plan, "en")
    assert out["mode"] == "rules"
    assert plan["rotations"][1]["name"] in out["answer"]
    year = plan["years"][3]
    out = advisor.answer(f"How did option A do in {year}?", plan, "en")
    assert str(year) in out["answer"]
    assert advisor.answer("anything", None, "en")["answer"]


def test_advisor_tools_return_plan_data(plan):
    assert advisor.run_tool("get_rotation", {"rotation_id": "A"}, plan)["id"] == "A"
    assert "error" in advisor.run_tool("get_year", {"rotation_id": "A", "year": 1800}, plan)
    assert advisor.run_tool("get_crop_feasibility", {"crop_id": "onion"}, plan)["seasons"]
    assert "error" in advisor.run_tool("nope", {}, plan)


def test_http_endpoints(data_dirs):
    client = TestClient(app)
    assert client.get("/api/health").json()["offline"] is True
    climate = client.get("/api/climate", params={"lat": LAT, "lon": LON}).json()
    assert climate["season_plan"]["main"]["kind"] == "wet"
    assert client.get("/api/soil", params={"lat": LAT, "lon": LON}).json()["available"] is False
    drought = client.get("/api/drought", params={"lat": LAT, "lon": LON}).json()
    assert drought["level"] in ("normal", "watch", "warning", "alert")
    assert drought["root_zone_source"]["fallback"] is True
    assert client.get("/api/backtest", params={"lat": LAT, "lon": LON}).json()["status"] == "unavailable"
    response = client.post("/api/plan", json=REQUEST)
    assert response.status_code == 200
    plan_id = response.json()["plan_id"]
    answer = client.post("/api/advisor", json={"question": "what about water?", "plan_id": plan_id}).json()
    assert answer["mode"] == "rules" and "m3/ha" in answer["answer"]
    assert client.post("/api/plan", json={**REQUEST, "current_rotation": ["x", "y"]}).status_code == 422
    assert client.get("/api/climate", params={"lat": 0.0, "lon": 0.0}).status_code == 503
    assert client.get("/api/geocode", params={"q": "Manila"}).status_code == 503  # offline
