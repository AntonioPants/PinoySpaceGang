"use client";
// Screen 5: season timeline with decision points + fixed vs adaptive replay.
import { useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, Disclaimer, NeedPlan, PageTitle, ROTATION_COLORS, fmt, seasonLabel, useRotations } from "@/components/ui";
import { useStore } from "@/lib/store";

export default function AdaptivePage() {
  const { t, plan, lang } = useStore();
  const { options } = useRotations();
  const [selected, setSelected] = useState<string | null>(null);
  if (!plan) return <NeedPlan />;
  const rotation = options.find((r) => r.id === (selected ?? plan.winner_id)) ?? options[0];
  if (!rotation?.adaptive) return <NeedPlan />;
  const a = rotation.adaptive;
  const name = (id?: string) => {
    const c = plan.crops.find((x) => x.id === id);
    return c ? c.name[lang] || c.name.en : id ?? "";
  };
  const color = ROTATION_COLORS[rotation.id];

  return (
    <div className="space-y-4">
      <PageTitle title={t("adapt.title")} help={t("adapt.help")} />
      <div className="flex flex-wrap gap-2" role="tablist">
        {options.map((r) => (
          <button key={r.id} role="tab" aria-selected={r.id === rotation.id} onClick={() => setSelected(r.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-semibold ${r.id === rotation.id ? "text-white" : "bg-white ring-1 ring-leaf-200"}`}
            style={r.id === rotation.id ? { backgroundColor: ROTATION_COLORS[r.id] } : undefined}>
            {r.name}
          </button>
        ))}
      </div>

      <Card>
        <p className="text-sm">{a.summary}</p>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label={t("adapt.gain")} value={`${a.comparison.gain_mean >= 0 ? "+" : ""}${fmt(a.comparison.gain_mean, 1)}`} />
          <Stat label={t("adapt.gainWorst")} value={`${a.comparison.gain_worst20 >= 0 ? "+" : ""}${fmt(a.comparison.gain_worst20, 1)}`} />
          <Stat label={t("adapt.failed")} value={`${a.comparison.fixed_failed_seasons} → ${a.comparison.adaptive_failed_seasons}`} />
          <Stat label="#" value={String(a.comparison.rules)} />
        </div>
      </Card>

      <ol className="relative space-y-3 border-l-4 pl-5" style={{ borderColor: color }}>
        {a.decision_points.map((p) => (
          <li key={p.slot} className="relative">
            <span className="absolute -left-[30px] top-3 h-4 w-4 rounded-full border-2 border-white" style={{ backgroundColor: p.has_rule ? "#c0392b" : color }} aria-hidden />
            <Card>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold">
                  {t("wiz.year")} {p.year_in_rotation} · {seasonLabel(p.season_kind, t)} · {name(p.planned_crop)}
                </h3>
                <span className="text-xs text-gray-600">{t("adapt.sow")}: {p.sow_date}</span>
              </div>
              {p.has_rule ? (
                <>
                  <div className="mt-2 rounded-xl bg-amber-50 p-3">
                    <div className="text-sm font-bold text-amber-900">⏰ {t("adapt.check")} {p.check_date}: {p.indicator_label}</div>
                    <div className="mt-2 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-lg bg-white p-2 text-sm">
                        <strong>{t("adapt.ifBelow")} {p.threshold} {p.unit}</strong> → {t("adapt.plant")} <strong>{name(p.if_below)}</strong>
                      </div>
                      <div className="rounded-lg bg-white p-2 text-sm">
                        <strong>{t("adapt.ifAbove")} {p.threshold} {p.unit}</strong> → {t("adapt.plant")} <strong>{name(p.if_above)}</strong>
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-gray-700">{p.indicator_source}</p>
                  </div>
                  <details className="mt-2 text-sm">
                    <summary className="cursor-pointer font-semibold text-leaf-800">{t("adapt.evidence")}</summary>
                    <p className="mt-1">{p.evidence}</p>
                    {p.switch_years && <p className="mt-1 text-xs text-gray-600">{p.switch_years.join(", ")}</p>}
                  </details>
                </>
              ) : (
                <p className="mt-1 text-sm text-gray-700">{t("adapt.noRule")}. {p.message}</p>
              )}
            </Card>
          </li>
        ))}
      </ol>

      <Card title={t("adapt.fixedVs")}>
        <div className="h-64">
          <ResponsiveContainer>
            <LineChart data={a.yearly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis domain={["auto", 100]} />
              <Tooltip />
              <Legend />
              <Line dataKey="fixed" name={t("adapt.fixed")} stroke="#8a8f98" strokeDasharray="4 3" dot={false} />
              <Line dataKey="adaptive" name={t("adapt.adaptive")} stroke={color} strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-1 text-xs text-gray-600">{a.comparison.basis}</p>
      </Card>
      <Disclaimer />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-leaf-50 p-3">
      <div className="text-xs text-gray-700">{label}</div>
      <div className="text-xl font-bold tabular-nums text-leaf-900">{value}</div>
    </div>
  );
}
