"use client";
// Screen 6: 10-year soil organic carbon + nitrogen, and irrigation comparison.
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, Disclaimer, KindBadge, NeedPlan, PageTitle, ROTATION_COLORS, useRotations } from "@/components/ui";
import { useStore } from "@/lib/store";

export default function SoilPage() {
  const { t, plan } = useStore();
  const { rotations } = useRotations();
  if (!plan) return <NeedPlan />;
  const socAvailable = rotations.some((r) => r.soil_projection.soc_available);
  const years = rotations[0]?.soil_projection.years ?? [];
  const soc = years.map((y, i) => {
    const row: Record<string, number> = { year: y };
    rotations.forEach((r) => {
      if (r.soil_projection.soc_g_kg) row[r.id] = r.soil_projection.soc_g_kg[i];
    });
    return row;
  });
  const nitrogen = rotations.map((r) => ({
    name: r.name,
    need: r.soil_projection.n_cumulative_need_kg_ha.at(-1) ?? 0,
    legume: r.soil_projection.n_cumulative_from_legumes_kg_ha.at(-1) ?? 0,
  }));
  const irrigation = rotations.map((r) => ({ name: r.name, avg: r.irrigation.net_m3_per_year_mean, dry: r.irrigation.net_m3_per_year_p80, id: r.id }));
  const first = rotations[0]?.soil_projection;

  return (
    <div className="space-y-4">
      <PageTitle title={t("soil.title")} help={first?.label} />
      <Card title={t("soil.soc")} actions={<KindBadge kind={first?.soc_start_source || "unavailable"} label="start value" />}>
        {socAvailable ? (
          <>
            <div className="h-72">
              <ResponsiveContainer>
                <LineChart data={soc}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" label={{ value: "years from now", position: "insideBottomRight", offset: -4 }} />
                  <YAxis domain={["auto", "auto"]} unit=" g/kg" width={70} />
                  <Tooltip />
                  <Legend />
                  {rotations.map((r) => (
                    <Line key={r.id} dataKey={r.id} name={`${r.name} (${(r.soil_projection.soc_change_pct ?? 0) > 0 ? "+" : ""}${r.soil_projection.soc_change_pct}%)`} stroke={ROTATION_COLORS[r.id]} strokeWidth={2} strokeDasharray={r.is_current ? "4 3" : undefined} dot={false} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </>
        ) : (
          <p className="text-sm">{t("soil.noSoc")}</p>
        )}
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title={t("soil.n")}>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={nitrogen}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis unit=" kg" width={70} />
                <Tooltip />
                <Legend />
                <Bar dataKey="need" name={t("soil.nNeed")} fill="#a87a4b" />
                <Bar dataKey="legume" name={t("soil.nLegume")} fill="#3f8f55" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title={t("soil.irr")}>
          <p className="mb-2 text-xs text-gray-600">{t("soil.irrHelp")}</p>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={irrigation}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis unit=" m3" width={70} />
                <Tooltip />
                <Legend />
                <Bar dataKey="avg" name={t("soil.avg")} fill="#2b7bb9" />
                <Bar dataKey="dry" name={t("soil.dry")} fill="#1d5a8a" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-gray-600">{rotations[0]?.irrigation.note}</p>
        </Card>
      </div>
      <Card title={`${t("soil.irr")} - per crop`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-gray-600">
              <tr><th className="p-2">Plan</th><th className="p-2">Crop</th><th className="p-2 text-right">Demand mm</th><th className="p-2 text-right">Rain mm</th><th className="p-2 text-right">Met %</th><th className="p-2 text-right">Net m3/ha</th><th className="p-2 text-right">P80 m3/ha</th></tr>
            </thead>
            <tbody>
              {rotations.flatMap((r) =>
                r.irrigation.slots.map((s) => (
                  <tr key={`${r.id}-${s.slot}`} className="border-t">
                    <td className="p-2" style={{ color: ROTATION_COLORS[r.id] }}>{r.name}</td>
                    <td className="p-2">{r.slots[s.slot]?.crop_name}</td>
                    <td className="p-2 text-right tabular-nums">{s.crop_demand_mm}</td>
                    <td className="p-2 text-right tabular-nums">{s.rain_mm}</td>
                    <td className="p-2 text-right tabular-nums">{s.water_met_pct}</td>
                    <td className="p-2 text-right tabular-nums">{s.net_m3_mean}</td>
                    <td className="p-2 text-right tabular-nums">{s.net_m3_p80}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <Card title={t("soil.assumptions")}>
        <ul className="list-disc pl-5 text-sm">{first?.assumptions.map((a) => <li key={a}>{a}</li>)}</ul>
      </Card>
      <Disclaimer />
    </div>
  );
}
