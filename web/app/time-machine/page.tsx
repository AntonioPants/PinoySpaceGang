"use client";
// Screen 4: replay every plan through each past year, with animation and failure years highlighted.
import { useEffect, useMemo, useState } from "react";
import { CartesianGrid, Legend, Line, LineChart, ReferenceArea, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, Disclaimer, NeedPlan, PageTitle, ROTATION_COLORS, fmt, useRotations } from "@/components/ui";
import type { MessageKey } from "@/lib/i18n";
import { useStore } from "@/lib/store";

const STATUS: Record<string, string> = { good: "bg-leaf-500 text-white", stressed: "bg-amber-400 text-amber-950", failed: "bg-rose-600 text-white" };

export default function TimeMachine() {
  const { t, plan } = useStore();
  const { rotations } = useRotations();
  const years = plan?.years ?? [];
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (years.length) setIndex((i) => Math.min(i, years.length - 1));
  }, [years.length]);
  useEffect(() => {
    if (!playing) return;
    const id = window.setInterval(() => {
      setIndex((i) => {
        if (i >= years.length - 1) {
          setPlaying(false);
          return i;
        }
        return i + 1;
      });
    }, 700);
    return () => window.clearInterval(id);
  }, [playing, years.length]);

  const chart = useMemo(
    () =>
      years.map((year, y) => {
        const row: Record<string, number> = { year };
        rotations.forEach((r) => (row[r.id] = r.yearly[y]?.score ?? 0));
        return row;
      }),
    [years, rotations],
  );

  if (!plan) return <NeedPlan />;
  const year = years[index];
  const winner = rotations.find((r) => r.id === plan.winner_id);
  const badYears = new Set(winner?.yearly.filter((y) => y.bad_year).map((y) => y.year));

  return (
    <div className="space-y-4">
      <PageTitle title={t("time.title")} help={t("time.help")} />
      <Card>
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" onClick={() => { if (index >= years.length - 1) setIndex(0); setPlaying((p) => !p); }} aria-pressed={playing}>
            {playing ? t("time.pause") : t("time.play")}
          </button>
          <label htmlFor="year" className="text-sm font-medium">{t("time.year")}</label>
          <input id="year" type="range" min={0} max={years.length - 1} value={index} onChange={(e) => { setPlaying(false); setIndex(Number(e.target.value)); }} className="flex-1 accent-leaf-600" aria-valuetext={String(year)} />
          <span className="w-16 text-3xl font-bold tabular-nums text-leaf-900" aria-live="polite">{year}</span>
        </div>
      </Card>

      <div className="grid gap-3 md:grid-cols-2">
        {rotations.map((r) => {
          const row = r.yearly[index];
          if (!row) return null;
          return (
            <Card key={r.id} className={row.bad_year ? "ring-2 ring-rose-500" : ""}>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="font-bold" style={{ color: ROTATION_COLORS[r.id] }}>{r.name}</h2>
                <div className="text-right">
                  <div className="text-2xl font-bold tabular-nums">{fmt(row.score)}</div>
                  <div className="text-[11px] text-gray-600">{t("time.score")}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {r.slots.map((s, i) => {
                  const cell = row.slots[i];
                  return (
                    <div key={i} className={`rounded-md p-1.5 text-center text-xs ${cell ? STATUS[cell.status] : "border border-dashed border-gray-300 text-gray-500"}`}>
                      <div className="font-semibold">{s.crop_name}</div>
                      <div>{cell ? `${fmt(cell.outcome)} · ${t(`time.${cell.status}` as MessageKey)}` : t("time.fallow")}</div>
                    </div>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-gray-700">
                {t("time.outcome")}: {fmt(row.performance)} · {t("crit.water")} {fmt(row.water)} · {t("crit.income")} {fmt(row.income)}
                {row.bad_year && <strong className="ml-1 text-rose-700">⚠ {t("time.badYears")}</strong>}
              </p>
            </Card>
          );
        })}
      </div>

      <Card title={t("time.chart")}>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={chart}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="year" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              {[...badYears].map((y) => <ReferenceArea key={y} x1={y - 0.5} x2={y + 0.5} fill="#fecaca" fillOpacity={0.6} />)}
              <ReferenceLine x={year} stroke="#173823" strokeWidth={2} />
              {rotations.map((r) => (
                <Line key={r.id} dataKey={r.id} name={r.name} stroke={ROTATION_COLORS[r.id]} strokeWidth={r.is_current ? 1.5 : 2.5} dot={false} strokeDasharray={r.is_current ? "4 3" : undefined} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-gray-600">{t("time.badYears")} ({winner?.name}): {[...badYears].join(", ") || "-"}</p>
      </Card>
      <Disclaimer />
    </div>
  );
}
