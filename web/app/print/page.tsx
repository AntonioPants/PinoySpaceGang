"use client";
// Screen 10: printable one-page plan + CSV / JSON export.
import { CRITERIA, NeedPlan, fmt, seasonLabel, useRotations } from "@/components/ui";
import type { MessageKey } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import type { Plan } from "@/lib/types";

function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function toCsv(plan: Plan): string {
  const rows = [["rotation", "year", "score", "season_outcome", "water", "risk", "income", "regret", "bad_year", "beats_current", "crops"]];
  for (const r of plan.rotations) {
    const crops = r.slots.map((s) => s.crop).join("|");
    for (const y of r.yearly) {
      rows.push([r.id, String(y.year), String(y.score), String(y.performance), String(y.water), String(y.risk), String(y.income), String(y.regret), String(y.bad_year), String(y.beats_current), crops]);
    }
  }
  return rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\n");
}

export default function PrintPage() {
  const { t, plan } = useStore();
  const { current, options } = useRotations();
  if (!plan) return <NeedPlan />;
  const best = options.find((r) => r.id === plan.winner_id) ?? options[0];
  if (!best) return <NeedPlan />;
  const rules = best.adaptive?.decision_points.filter((p) => p.has_rule) ?? [];
  const stamp = plan.generated_at.slice(0, 10);

  return (
    <div>
      <div className="no-print mb-4 flex flex-wrap gap-2">
        <button className="btn-primary" onClick={() => window.print()}>{t("print.print")}</button>
        <button className="btn-secondary" onClick={() => download(`fieldshift-replay-${stamp}.csv`, toCsv(plan), "text/csv")}>{t("print.csv")}</button>
        <button className="btn-secondary" onClick={() => download(`fieldshift-plan-${stamp}.json`, JSON.stringify(plan, null, 1), "application/json")}>{t("print.json")}</button>
      </div>
      <article className="mx-auto max-w-[210mm] bg-white p-6 text-[13px] leading-snug shadow print:shadow-none">
        <header className="flex items-start justify-between border-b-2 border-leaf-700 pb-2">
          <div>
            <h1 className="text-xl font-bold text-leaf-900">{t("app.name")} · {t("print.title")}</h1>
            <p className="text-xs text-gray-600">{t("print.for")}</p>
          </div>
          <div className="text-right text-xs text-gray-600">{stamp}<br />plan {plan.plan_id}</div>
        </header>

        <section className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <h2 className="font-semibold text-leaf-800">{t("print.farm")}</h2>
            <p>{plan.location.lat.toFixed(4)}, {plan.location.lon.toFixed(4)}{plan.location.elevation_m ? ` · ${Math.round(plan.location.elevation_m)} m` : ""}</p>
            <p>{seasonLabel(plan.season_plan.main.kind, t)}: {plan.season_plan.main.label} · {seasonLabel(plan.season_plan.off.kind, t)}: {plan.season_plan.off.label}</p>
            <p>Soil: {String(plan.soil.values.texture)} ({plan.soil.provenance.texture}) · pH {fmt(plan.soil.values.ph as number, 1)} · {t(`wiz.ws.${plan.settings.water_source}` as MessageKey)}</p>
          </div>
          <div>
            <h2 className="font-semibold text-leaf-800">{t("print.robustness")}</h2>
            <p>{plan.years[0]}–{plan.years.at(-1)} ({plan.years.length} {t("common.years")}), {plan.enumeration.valid_rotations.toLocaleString()} rotations tested.</p>
            <p>{t("crit.overall")} {fmt(best.scores.overall)} vs {t("common.current").toLowerCase()} {fmt(current?.scores.overall)} · {t("crit.worst")} {fmt(best.scores.worst_case)} vs {fmt(current?.scores.worst_case)}</p>
            <p>{t("res.winRate")} {Math.round(best.replay.win_rate_vs_current * 100)}% · {t("time.badYears")}: {best.replay.worst_years.join(", ")}</p>
          </div>
        </section>

        <section className="mt-3">
          <h2 className="font-semibold text-leaf-800">{t("print.plan")}: {best.name}</h2>
          <table className="mt-1 w-full border text-left">
            <thead className="bg-leaf-50"><tr><th className="border p-1"></th>{[1, 2, 3].map((y) => <th key={y} className="border p-1">{t("wiz.year")} {y}</th>)}</tr></thead>
            <tbody>
              {(["main", "off"] as const).map((season) => (
                <tr key={season}>
                  <th className="border p-1">{seasonLabel(plan.season_plan[season].kind, t)} ({plan.season_plan[season].sow_label})</th>
                  {[1, 2, 3].map((y) => <td key={y} className="border p-1">{best.slots.find((s) => s.year === y && s.season === season)?.crop_name}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <div className="mt-1 grid grid-cols-4 gap-2">
            {CRITERIA.map((c) => <div key={c}>{t(`crit.${c}` as MessageKey)}: <strong>{fmt(best.scores[c])}</strong> <span className="text-gray-500">({fmt(current?.scores[c])})</span></div>)}
          </div>
        </section>

        <section className="mt-3">
          <h2 className="font-semibold text-leaf-800">{t("print.decisions")}</h2>
          {rules.length ? (
            <ol className="list-decimal pl-5">{rules.map((p) => <li key={p.slot}>{p.rule_text}</li>)}</ol>
          ) : (
            <p>{t("adapt.noRule")}.</p>
          )}
          <p className="text-xs text-gray-600">{best.adaptive?.summary}</p>
        </section>

        <section className="mt-3">
          <h2 className="font-semibold text-leaf-800">{t("res.reasons")}</h2>
          <ul className="list-disc pl-5">{best.reasons.filter((r) => r.tone !== "neutral").slice(0, 6).map((r, i) => <li key={i}>{r.text}</li>)}</ul>
        </section>

        <section className="mt-3 text-xs text-gray-700">
          <h2 className="font-semibold text-leaf-800">{t("data.gaps")}</h2>
          <ul className="list-disc pl-5">{plan.gaps.slice(0, 5).map((g) => <li key={g}>{g}</li>)}</ul>
          <p className="mt-1">Data: {plan.sources.filter((s) => s.available).map((s) => `${s.title} (${s.kind})`).join("; ")}.</p>
        </section>

        <footer className="mt-4 border-t pt-2 text-xs">
          <p className="font-semibold text-amber-900">{plan.disclaimer}</p>
          <div className="mt-6 flex justify-between gap-8">
            <div className="flex-1 border-t border-gray-500 pt-1">{t("print.signature")}</div>
            <div className="w-40 border-t border-gray-500 pt-1">Date</div>
          </div>
        </footer>
      </article>
    </div>
  );
}
