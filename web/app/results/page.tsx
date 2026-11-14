"use client";
// Screen 3: current rotation vs the top three, score breakdowns, reasons, split-screen comparison, top-10 table.
import { useState } from "react";
import { CRITERIA, Card, Disclaimer, ErrorBox, NeedPlan, PageTitle, ROTATION_COLORS, RotationStrip, ScoreBar, Spinner, fmt, useRotations } from "@/components/ui";
import type { MessageKey } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import type { RankingMode, Rotation } from "@/lib/types";

const TONE: Record<string, string> = { positive: "border-leaf-500 bg-leaf-50", neutral: "border-gray-300 bg-gray-50", negative: "border-rose-400 bg-rose-50" };

function RotationCard({ rotation, winner }: { rotation: Rotation; winner: boolean }) {
  const { t } = useStore();
  const color = ROTATION_COLORS[rotation.id];
  return (
    <article className="flex flex-col rounded-2xl border-2 bg-white p-4 shadow-sm" style={{ borderColor: color }}>
      <header className="mb-2 flex items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold" style={{ color }}>{rotation.name}</h2>
          <p className="text-xs text-gray-600">
            {t("res.rank")} #{rotation.rank.toLocaleString()} {winner && <span className="ml-1 rounded-full bg-leaf-600 px-2 py-0.5 font-semibold text-white">{t("common.winner")}</span>}
          </p>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold tabular-nums" style={{ color }}>{fmt(rotation.scores.overall)}</div>
          <div className="text-[11px] text-gray-600">{t("crit.overall")}</div>
        </div>
      </header>
      <RotationStrip rotation={rotation} />
      <div className="mt-3 space-y-2">
        <ScoreBar label={t("crit.worst")} value={rotation.scores.worst_case} color="#7a4b2a" />
        {CRITERIA.map((c) => (
          <ScoreBar key={c} label={t(`crit.${c}` as MessageKey)} value={rotation.scores[c]} color={color} compact />
        ))}
      </div>
      {!rotation.is_current && (
        <p className="mt-3 text-sm">
          {t("res.winRate")} <strong>{Math.round(rotation.replay.win_rate_vs_current * 100)}%</strong> {t("common.of")} {rotation.replay.years} {t("common.years")} · {t("res.regret")}: {fmt(rotation.replay.max_regret, 1)}
        </p>
      )}
      {rotation.rule_violations.length > 0 && (
        <div className="mt-3 rounded-lg border border-rose-300 bg-rose-50 p-2 text-sm text-rose-900">
          <strong>{t("res.violations")}:</strong>
          <ul className="list-disc pl-5">
            {rotation.rule_violations.map((v) => <li key={v}>{v}</li>)}
          </ul>
        </div>
      )}
      <details className="mt-3">
        <summary className="cursor-pointer text-sm font-semibold text-leaf-800">{t("res.reasons")}</summary>
        <ul className="mt-2 space-y-1.5">
          {rotation.reasons.map((r, i) => (
            <li key={i} className={`rounded-lg border-l-4 p-2 text-sm ${TONE[r.tone]}`}>
              <span className="mr-1 text-[10px] font-bold uppercase text-gray-600">{t(`crit.${r.criterion}` as MessageKey)}</span>
              {r.text}
            </li>
          ))}
        </ul>
      </details>
    </article>
  );
}

function CompareSlider({ rotations }: { rotations: Rotation[] }) {
  const { t } = useStore();
  const [left, setLeft] = useState(rotations[0]?.id);
  const [right, setRight] = useState(rotations[1]?.id);
  const [split, setSplit] = useState(50);
  const a = rotations.find((r) => r.id === left);
  const b = rotations.find((r) => r.id === right);
  if (!a || !b) return null;
  const panel = (r: Rotation) => (
    <div className="h-full w-full bg-white p-4">
      <h3 className="mb-2 text-lg font-bold" style={{ color: ROTATION_COLORS[r.id] }}>{r.name} · {fmt(r.scores.overall)}</h3>
      <RotationStrip rotation={r} />
      <div className="mt-3 grid grid-cols-2 gap-2">
        {CRITERIA.map((c) => <ScoreBar key={c} label={t(`crit.${c}` as MessageKey)} value={r.scores[c]} color={ROTATION_COLORS[r.id]} compact />)}
      </div>
      <p className="mt-2 text-sm">{t("crit.worst")}: <strong>{fmt(r.scores.worst_case)}</strong> · {t("time.badYears")}: {r.replay.worst_years.join(", ")}</p>
    </div>
  );
  return (
    <Card title={t("res.compare")}>
      <div className="mb-3 flex flex-wrap gap-3 text-sm">
        {[["L", left, setLeft], ["R", right, setRight]].map(([key, value, set]: any) => (
          <select key={key} className="field max-w-[12rem]" value={value} onChange={(e) => set(e.target.value)} aria-label={`Plan ${key}`}>
            {rotations.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        ))}
      </div>
      <p className="mb-2 text-xs text-gray-600">{t("res.compareHelp")}</p>
      <div className="relative overflow-hidden rounded-xl border" style={{ minHeight: 340 }}>
        <div className="absolute inset-0">{panel(b)}</div>
        <div className="absolute inset-0" style={{ clipPath: `inset(0 ${100 - split}% 0 0)` }}>{panel(a)}</div>
        <div className="pointer-events-none absolute inset-y-0 w-1 bg-leaf-700" style={{ left: `calc(${split}% - 2px)` }} />
      </div>
      <input type="range" min={0} max={100} value={split} onChange={(e) => setSplit(Number(e.target.value))} className="mt-2 w-full accent-leaf-600" aria-label={t("res.compareHelp")} />
    </Card>
  );
}

export default function ResultsPage() {
  const { t, plan, runPlan, planLoading, planError, lang } = useStore();
  const { rotations, current, options } = useRotations();
  const [mode, setMode] = useState<RankingMode | null>(null);
  if (!plan) return <NeedPlan />;
  const cropName = (id: string) => {
    if (id === "fallow") return lang === "fil" ? "pahinga" : "fallow";
    const c = plan.crops.find((x) => x.id === id);
    return c ? c.name[lang] || c.name.en : id;
  };
  const activeMode = mode ?? plan.settings.ranking_mode;
  return (
    <div className="space-y-4">
      <PageTitle
        title={t("res.title")}
        help={`${plan.enumeration.valid_rotations.toLocaleString()} ${t("res.subtitle")} #${plan.enumeration.current_rank.toLocaleString()}. ${t("common.relative")}`}
      />
      <div className="no-print flex flex-wrap items-center gap-2 text-sm">
        <span>{t("res.rankBy")}:</span>
        {(["average", "worst_case", "regret"] as RankingMode[]).map((m) => (
          <button
            key={m}
            className={`rounded-full px-3 py-1 ${activeMode === m ? "bg-leaf-600 text-white" : "bg-white ring-1 ring-leaf-200"}`}
            onClick={() => {
              setMode(m);
              void runPlan({ ranking_mode: m });
            }}
            disabled={planLoading}
            aria-pressed={activeMode === m}
          >
            {t(`wiz.rank.${m}` as MessageKey)}
          </button>
        ))}
        {planLoading && <Spinner />}
      </div>
      {planError && <ErrorBox message={planError} />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {current && <RotationCard rotation={current} winner={false} />}
        {options.map((r) => <RotationCard key={r.id} rotation={r} winner={r.id === plan.winner_id} />)}
      </div>
      {rotations.length > 1 && <CompareSlider rotations={rotations} />}
      <Card title={t("res.topTen")}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-gray-600">
              <tr>
                <th className="p-2">#</th>
                <th className="p-2">{t("res.crops")}</th>
                <th className="p-2 text-right">{t("crit.overall")}</th>
                <th className="p-2 text-right">{t("crit.worst")}</th>
                <th className="p-2 text-right">{t("res.regret")}</th>
                <th className="p-2">{t("res.shown")}</th>
              </tr>
            </thead>
            <tbody>
              {plan.ranking.map((row) => (
                <tr key={row.rank} className="border-t">
                  <td className="p-2">{row.rank}</td>
                  <td className="p-2">{row.slots.map(cropName).join(" → ")}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(row.overall, 1)}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(row.worst_case, 1)}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(row.max_regret, 1)}</td>
                  <td className="p-2">{row.shown_as ? `${t("common.option")} ${row.shown_as}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <Disclaimer />
    </div>
  );
}
