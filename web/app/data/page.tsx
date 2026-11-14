"use client";
// Screen 8: data & confidence - every source, provenance of soil values, gaps, backtest, crop knowledge base.
import { useCallback, useEffect, useState } from "react";
import { CartesianGrid, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis } from "recharts";
import { Card, ErrorBox, KindBadge, PageTitle, Spinner, fmt } from "@/components/ui";
import { api } from "@/lib/api";
import { cropName, type MessageKey } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import type { Backtest, CropFull } from "@/lib/types";

export default function DataPage() {
  const { t, plan, farm, lang } = useStore();
  const lat = plan?.location.lat ?? farm.lat;
  const lon = plan?.location.lon ?? farm.lon;
  const [backtest, setBacktest] = useState<Backtest | null>(null);
  const [health, setHealth] = useState<Record<string, any> | null>(null);
  const [crops, setCrops] = useState<CropFull[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadBacktest = useCallback(() => {
    api.backtest(lat, lon, lang).then(setBacktest).catch((e) => setError(e.message));
  }, [lat, lon, lang]);

  useEffect(() => {
    loadBacktest();
    api.health().then(setHealth).catch(() => undefined);
    api.crops().then((r) => setCrops(r.crops)).catch(() => undefined);
  }, [loadBacktest]);

  useEffect(() => {
    if (backtest?.status !== "fetching") return;
    const id = window.setTimeout(loadBacktest, 8000);
    return () => window.clearTimeout(id);
  }, [backtest, loadBacktest]);

  const sources = plan?.sources ?? (health?.sources as any[]) ?? [];

  return (
    <div className="space-y-4">
      <PageTitle title={t("data.title")} />
      {error && <ErrorBox message={error} />}
      <Card title={t("data.sources")}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase text-gray-600">
              <tr><th className="p-2">{t("data.source")}</th><th className="p-2">{t("data.kind")}</th><th className="p-2">{t("data.resolution")}</th><th className="p-2">{t("data.range")}</th><th className="p-2">{t("data.status")}</th><th className="p-2">{t("data.usedFor")}</th></tr>
            </thead>
            <tbody>
              {sources.map((s: any) => (
                <tr key={s.source} className="border-t align-top">
                  <td className="p-2 font-medium">{s.title}<div className="text-xs text-gray-600">{s.provider}</div></td>
                  <td className="p-2"><KindBadge kind={s.available === false ? "unavailable" : s.kind} /></td>
                  <td className="p-2 text-xs">{s.resolution}</td>
                  <td className="p-2 text-xs">{s.date_start ? `${s.date_start} → ${s.date_end}` : "-"}</td>
                  <td className="p-2 text-xs">{s.available === false ? <span className="text-rose-800">{s.reason}</span> : `${s.origin || s.status}${s.stale ? " (stale)" : ""}`}</td>
                  <td className="p-2 text-xs">{s.used_for}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {plan && (
        <Card title={t("data.soil")}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {Object.entries(plan.soil.values).map(([k, v]) => (
              <div key={k} className="rounded-lg bg-leaf-50 p-2 text-sm">
                <div className="text-xs text-gray-700">{k}</div>
                <div className="font-semibold">{v === null ? "-" : typeof v === "number" ? fmt(v, 2) : String(v)}</div>
                {plan.soil.provenance[k] && <KindBadge kind={plan.soil.provenance[k]} />}
              </div>
            ))}
          </div>
        </Card>
      )}

      {plan && (
        <Card title={t("data.gaps")}>
          <ul className="list-disc space-y-1 pl-5 text-sm">{plan.gaps.map((g) => <li key={g}>{g}</li>)}</ul>
        </Card>
      )}

      <Card title={t("data.backtest")}>
        {!backtest && <Spinner />}
        {backtest?.status === "fetching" && (
          <Spinner label={`${t("data.backtestFetching")} ${backtest.progress ? `${backtest.progress.done}/${backtest.progress.total}` : ""}`} />
        )}
        {backtest && backtest.status !== "fetching" && !backtest.available && <p className="text-sm">{backtest.reason}</p>}
        {backtest?.available && (
          <>
            <p className="mb-3 text-sm text-gray-700">{backtest.method}</p>
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(backtest.seasons).map(([k, s]) => (
                <div key={k} className="rounded-xl border p-3">
                  <p className="text-sm font-semibold">{s.text || s.reason}</p>
                  {s.points && (
                    <div className="mt-2 h-56">
                      <ResponsiveContainer>
                        <ScatterChart>
                          <CartesianGrid />
                          <XAxis type="number" dataKey="water_satisfaction" name="water met" domain={["auto", 1]} />
                          <YAxis type="number" dataKey="ndvi_anomaly" name="NDVI anomaly" width={50} />
                          <Tooltip formatter={(v: number) => v.toFixed(3)} />
                          <Scatter data={s.points} fill="#2f7444" />
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {backtest.cropping_intensity?.text && <p className="mt-3 text-sm">{backtest.cropping_intensity.text}</p>}
          </>
        )}
        {backtest && backtest.caveats?.length > 0 && (
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer font-semibold">{t("data.caveats")}</summary>
            <ul className="mt-1 list-disc pl-5">{backtest.caveats.map((c) => <li key={c}>{c}</li>)}</ul>
          </details>
        )}
      </Card>

      {plan && (
        <Card title={t("data.feasibility")}>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {plan.feasibility.map((f) => {
              const c = plan.crops.find((x) => x.id === f.crop_id);
              const failed = f.checks.filter((x) => !x.passed);
              return (
                <details key={`${f.crop_id}-${f.season}`} className={`rounded-lg border p-2 text-sm ${f.feasible ? "border-leaf-200 bg-leaf-50" : "border-gray-200 bg-gray-50"}`}>
                  <summary className="cursor-pointer">
                    {f.feasible ? "✅" : "❌"} {cropName(c?.name, lang, f.crop_id)} · {t(`season.${plan.season_plan[f.season].kind}` as MessageKey)}
                  </summary>
                  <ul className="mt-1 list-disc pl-5 text-xs">{(failed.length ? failed : f.checks).map((x) => <li key={x.name}>{x.text}</li>)}</ul>
                </details>
              );
            })}
          </div>
        </Card>
      )}

      <Card title={t("data.crops")}>
        <p className="mb-2 text-sm text-gray-700">{t("data.cropsHelp")}</p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="uppercase text-gray-600">
              <tr><th className="p-1.5">Crop</th><th className="p-1.5">Days</th><th className="p-1.5">GDD</th><th className="p-1.5">Water mm</th><th className="p-1.5">Kc</th><th className="p-1.5">Ky</th><th className="p-1.5">ECe</th><th className="p-1.5">N +/-</th><th className="p-1.5">Income</th><th className="p-1.5">{t("data.verify")}</th></tr>
            </thead>
            <tbody>
              {crops.map((c) => (
                <tr key={c.id} className="border-t align-top">
                  <td className="p-1.5 font-medium" title={Object.entries(c.sources).map(([k, v]) => `${k}: ${v}`).join("\n")}>{cropName(c.name, lang, c.id)}<div className="text-gray-500">{c.family}</div></td>
                  <td className="p-1.5">{c.duration_days}</td>
                  <td className="p-1.5">{c.gdd_need}</td>
                  <td className="p-1.5">{c.water_need_mm.join("-")}</td>
                  <td className="p-1.5">{c.kc.join(" / ")}</td>
                  <td className="p-1.5">{c.ky}</td>
                  <td className="p-1.5">{c.salinity_threshold_ds_m}</td>
                  <td className="p-1.5">{c.n_fixing ? `+${c.n_credit_kg_ha}` : `-${c.n_demand_kg_ha}`}</td>
                  <td className="p-1.5">{c.income_band}/5</td>
                  <td className="p-1.5 text-amber-800">{c.verify.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-gray-600">Hover a crop name to see the source of each value. Full table: engine/fieldshift/crops/crops.yaml.</p>
      </Card>

      {plan?.weather_quality && (
        <Card title={t("data.weather")}>
          <pre className="overflow-x-auto rounded-lg bg-gray-50 p-2 text-xs">{JSON.stringify(plan.weather_quality, null, 1)}</pre>
        </Card>
      )}
    </div>
  );
}
