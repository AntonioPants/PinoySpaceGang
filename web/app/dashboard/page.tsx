"use client";
// Screen 2: field vitals today, flash-drought warning and field memory.
import { useCallback, useEffect, useState } from "react";
import { Area, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, ErrorBox, KindBadge, PageTitle, Spinner, fmt } from "@/components/ui";
import { api } from "@/lib/api";
import type { MessageKey } from "@/lib/i18n";
import { useStore } from "@/lib/store";
import type { DroughtStatus } from "@/lib/types";

const LEVEL_STYLE: Record<string, string> = {
  normal: "bg-leaf-100 text-leaf-900 border-leaf-500",
  watch: "bg-amber-50 text-amber-900 border-amber-400",
  warning: "bg-orange-100 text-orange-900 border-orange-500",
  alert: "bg-rose-100 text-rose-900 border-rose-600",
};

export default function Dashboard() {
  const { t, lang, farm, plan } = useStore();
  const lat = plan?.location.lat ?? farm.lat;
  const lon = plan?.location.lon ?? farm.lon;
  const [data, setData] = useState<DroughtStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.drought(lat, lon, lang).then(setData).catch((e) => setError(e.message));
  }, [lat, lon, lang]);
  useEffect(load, [load]);

  if (error) return <ErrorBox message={error} onRetry={load} />;
  if (!data) return <Spinner />;

  return (
    <div className="space-y-4">
      <PageTitle title={t("dash.title")} help={`${lat.toFixed(3)}, ${lon.toFixed(3)} · ${t("dash.asOf")} ${data.as_of}`} />
      <section className={`rounded-2xl border-l-8 p-4 ${LEVEL_STYLE[data.level]}`} aria-live="polite">
        <div className="text-sm font-semibold uppercase tracking-wide">{t("dash.drought")}: {t(`level.${data.level}` as MessageKey)}</div>
        <div className="mt-1 text-xl font-bold">{data.headline}</div>
        <ul className="mt-2 list-disc pl-5 text-sm">
          {data.reasons.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.entries(data.signals).map(([k, s]) => (
            <KindBadge key={k} kind={s.badge.kind} label={`${s.badge.label}: ${fmt(s.value, 2)}`} />
          ))}
        </div>
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer">{t("dash.method")}</summary>
          <p className="mt-1">{data.method}</p>
          {data.root_zone_source.fallback_reason && <p className="mt-1">{data.root_zone_source.fallback_reason}</p>}
        </details>
      </section>

      <Card title={t("dash.vitals")}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Object.entries(data.vitals).map(([key, v]) => (
            <div key={key} className="rounded-xl bg-leaf-50 p-3">
              <div className="text-xs text-gray-700">{t(`vital.${key}` as MessageKey)}</div>
              <div className="text-2xl font-bold tabular-nums text-leaf-900">
                {fmt(v.value, key.includes("wetness") ? 2 : 1)} <span className="text-sm font-normal text-gray-600">{v.unit}</span>
              </div>
              <div className="mt-1">
                <KindBadge kind={v.badge.kind} label={v.badge.label} />
              </div>
              <div className="mt-1 text-[11px] text-gray-500">{v.date}</div>
            </div>
          ))}
        </div>
      </Card>

      <Card title={t("dash.memory")}>
        <p className="mb-2 text-sm text-gray-700">{t("dash.memoryHelp")}</p>
        {data.field_memory.available ? (
          <>
            <div className="h-72">
              <ResponsiveContainer>
                <ComposedChart data={data.field_memory.weekly.map((w) => ({ ...w, band: [w.p10, w.p90] }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="week" label={{ value: "week", position: "insideBottomRight", offset: -4 }} />
                  <YAxis domain={[0, 1]} />
                  <Tooltip />
                  <Legend />
                  <Area dataKey="band" name="p10-p90" fill="#b8dfc1" stroke="none" />
                  <Line dataKey="p50" name="median" stroke="#2f7444" dot={false} />
                  <Line dataKey="current" name={String(data.field_memory.current_year)} stroke="#c0392b" strokeWidth={3} dot={false} connectNulls={false} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-sm">
              {t("dash.driest")}: <strong>{data.field_memory.driest_years.join(", ")}</strong>{" "}
              <KindBadge kind={data.root_zone_source.kind} label={data.root_zone_source.label} />
            </p>
          </>
        ) : (
          <p className="text-sm">{t("common.unavailable")}</p>
        )}
      </Card>

      <Card title="120 days">
        <div className="h-64">
          <ResponsiveContainer>
            <ComposedChart data={data.series}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tickFormatter={(d) => d.slice(5)} minTickGap={24} />
              <YAxis yAxisId="l" domain={[0, 100]} />
              <YAxis yAxisId="r" orientation="right" />
              <Tooltip />
              <Legend />
              <Line yAxisId="l" dataKey="percentile" name="wetness percentile" stroke="#2b7bb9" dot={false} />
              <Area yAxisId="r" dataKey="rain" name="rain mm" fill="#9cc7e8" stroke="#2b7bb9" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}
