"use client";
// Screen 7: why each non-winning plan lost, and the smallest change that would make it win.
import { useRouter } from "next/navigation";
import { CRITERIA, Card, Disclaimer, NeedPlan, PageTitle, ROTATION_COLORS, useRotations } from "@/components/ui";
import type { MessageKey } from "@/lib/i18n";
import { useStore } from "@/lib/store";

export default function WhyPage() {
  const { t, plan, runPlan, planLoading } = useStore();
  const { rotations } = useRotations();
  const router = useRouter();
  if (!plan) return <NeedPlan />;
  return (
    <div className="space-y-4">
      <PageTitle title={t("why.title")} help={t("why.help")} />
      {plan.why_it_lost.map((w) => {
        const r = rotations.find((x) => x.id === w.rotation_id);
        const color = ROTATION_COLORS[w.rotation_id];
        return (
          <Card key={w.rotation_id} title={<span style={{ color }}>{r?.name}</span>}>
            <p className="text-sm">{w.summary}</p>
            <div className="mt-3">
              <div className="mb-1 text-xs font-semibold uppercase text-gray-600">{t("why.vsWinner")}</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {CRITERIA.map((c) => {
                  const d = w.criteria_vs_winner[c];
                  return (
                    <div key={c} className={`rounded-lg p-2 text-sm ${d >= 0 ? "bg-leaf-50" : "bg-rose-50"}`}>
                      <div className="text-xs text-gray-700">{t(`crit.${c}` as MessageKey)}</div>
                      <div className={`text-lg font-bold tabular-nums ${d >= 0 ? "text-leaf-800" : "text-rose-800"}`}>{d > 0 ? "+" : ""}{d}</div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border p-3">
                <div className="text-sm font-semibold">⚖️ {t("why.priority")}</div>
                <p className="mt-1 text-sm">{w.priority_change.text}</p>
                {w.priority_change.found && w.priority_change.new_weights && (
                  <button
                    className="btn-secondary mt-2"
                    disabled={planLoading}
                    onClick={async () => {
                      const nw = w.priority_change.new_weights!;
                      const ok = await runPlan({ priorities: { water: Math.round(nw.water * 100), soil: Math.round(nw.soil * 100), risk: Math.round(nw.risk * 100), income: Math.round(nw.income * 100) } });
                      if (ok) router.push("/results");
                    }}
                  >
                    {t("why.apply")}
                  </button>
                )}
              </div>
              <div className="rounded-xl border p-3">
                <div className="text-sm font-semibold">🌧️ {t("why.rain")}</div>
                <p className="mt-1 text-sm">{w.rainfall_change.text}</p>
              </div>
            </div>
          </Card>
        );
      })}
      <Disclaimer />
    </div>
  );
}
