"use client";
// Screen 1: onboarding + farm-setup wizard (location -> current rotation -> soil -> water -> priorities).
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Card, ErrorBox, KindBadge, PageTitle, Spinner } from "@/components/ui";
import { api } from "@/lib/api";
import { cropName, type MessageKey } from "@/lib/i18n";
import { PILOT, useStore } from "@/lib/store";
import type { CropFull, Drainage, RankingMode, SoilOverrides, WaterSource } from "@/lib/types";

const MapPicker = dynamic(() => import("@/components/MapPicker"), { ssr: false, loading: () => <div className="h-72 rounded-xl bg-leaf-100" /> });

const SOIL_FIELDS = ["ph", "soc_g_kg", "nitrogen_g_kg", "clay_pct", "sand_pct", "silt_pct", "bulk_density", "cec_cmol_kg", "ec_ds_m"] as const;
const STEPS: MessageKey[] = ["wiz.location", "wiz.rotation", "wiz.soil", "wiz.water", "wiz.priorities"];
const CRITERIA_KEYS: [keyof typeof PRIORITY_LABEL, MessageKey][] = [
  ["water", "crit.water"],
  ["soil", "crit.soil"],
  ["income", "crit.income"],
  ["risk", "crit.risk"],
];
const PRIORITY_LABEL = { water: 0, soil: 0, income: 0, risk: 0 };

export default function SetupPage() {
  const { t, lang, farm, setFarm, runPlan, planLoading, planError, ready } = useStore();
  const router = useRouter();
  const [started, setStarted] = useState(false);
  const [step, setStep] = useState(0);
  const [crops, setCrops] = useState<CropFull[]>([]);
  const [textures, setTextures] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<{ name: string; lat: number; lon: number }[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [soilMap, setSoilMap] = useState<{ values: Record<string, any>; provenance: Record<string, string>; available: boolean } | null>(null);
  const [soilLoading, setSoilLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadMeta = useCallback(() => {
    setLoadError(null);
    api.crops().then((r) => setCrops(r.crops)).catch((e) => setLoadError(e.message));
    api.config().then((r) => setTextures(r.textures)).catch(() => undefined);
  }, []);
  useEffect(loadMeta, [loadMeta]);

  useEffect(() => {
    if (step !== 2) return;
    setSoilLoading(true);
    api
      .soil(farm.lat, farm.lon)
      .then((r) => setSoilMap({ ...r.soil, available: r.available }))
      .catch(() => setSoilMap({ values: {}, provenance: {}, available: false }))
      .finally(() => setSoilLoading(false));
  }, [step, farm.lat, farm.lon]);

  const setPoint = useCallback((lat: number, lon: number) => setFarm({ lat: Number(lat.toFixed(4)), lon: Number(lon.toFixed(4)) }), [setFarm]);

  const doSearch = async () => {
    setSearchError(null);
    try {
      const r = await api.geocode(search);
      setResults(r.results);
      if (!r.results.length) setSearchError("No place found.");
    } catch (e: any) {
      setSearchError(e.message);
    }
  };

  const rotation = farm.current_rotation.length === 2 ? [...farm.current_rotation, ...farm.current_rotation, ...farm.current_rotation] : farm.current_rotation;
  const sameEachYear = farm.current_rotation.length === 2;
  const setSlot = (index: number, crop: string) => {
    if (sameEachYear) {
      const next = [...farm.current_rotation];
      next[index % 2] = crop;
      setFarm({ current_rotation: next });
    } else {
      const next = [...rotation];
      next[index] = crop;
      setFarm({ current_rotation: next });
    }
  };
  const overrides = farm.soil_overrides || {};
  const setOverride = (key: keyof SoilOverrides, value: any) => setFarm({ soil_overrides: { ...overrides, [key]: value } });

  const run = async () => {
    const plan = await runPlan();
    if (plan) router.push("/results");
  };

  if (!ready) return <Spinner />;

  if (!started) {
    return (
      <div className="mx-auto max-w-3xl">
        <Card>
          <h1 className="text-2xl font-bold text-leaf-900 sm:text-3xl">{t("onb.title")}</h1>
          <p className="mt-2 text-gray-700">{t("onb.body")}</p>
          <ol className="mt-4 grid gap-2 sm:grid-cols-2">
            {(["onb.p1", "onb.p2", "onb.p3", "onb.p4"] as MessageKey[]).map((k, i) => (
              <li key={k} className="flex items-center gap-3 rounded-xl bg-leaf-50 p-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-leaf-600 font-bold text-white">{i + 1}</span>
                <span>{t(k)}</span>
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-3">
            <button className="btn-primary" onClick={() => setStarted(true)}>
              {t("onb.start")}
            </button>
            <button
              className="btn-secondary"
              onClick={() => {
                setFarm({ lat: PILOT.lat, lon: PILOT.lon });
                setStarted(true);
              }}
            >
              {t("onb.pilot")}
            </button>
          </div>
          <p className="mt-4 text-xs text-gray-600">{t("common.relative")} {t("common.adviser")}</p>
        </Card>
      </div>
    );
  }

  const cropOptions = (season: "wet" | "dry") => crops.filter((c) => c.seasons.includes(season));

  return (
    <div>
      <PageTitle title={t("nav.setup")} />
      <ol className="mb-4 flex flex-wrap gap-2" aria-label="Steps">
        {STEPS.map((key, i) => (
          <li key={key}>
            <button
              onClick={() => setStep(i)}
              aria-current={i === step ? "step" : undefined}
              className={`rounded-full px-3 py-1.5 text-sm font-medium ${i === step ? "bg-leaf-600 text-white" : "bg-white text-leaf-800 ring-1 ring-leaf-200"}`}
            >
              {i + 1}. {t(key)}
            </button>
          </li>
        ))}
      </ol>
      {loadError && <ErrorBox message={loadError} onRetry={loadMeta} />}

      {step === 0 && (
        <Card title={t("wiz.location")}>
          <p className="mb-3 text-sm text-gray-700">{t("wiz.locationHelp")}</p>
          <form
            className="mb-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void doSearch();
            }}
          >
            <label className="sr-only" htmlFor="place">{t("wiz.search")}</label>
            <input id="place" className="field" placeholder={t("wiz.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
            <button className="btn-secondary" type="submit" disabled={search.trim().length < 2}>
              {t("wiz.searchBtn")}
            </button>
          </form>
          {searchError && <p className="mb-2 text-sm text-rose-800">{searchError}</p>}
          {results.length > 0 && (
            <ul className="mb-3 divide-y rounded-lg border">
              {results.map((r) => (
                <li key={`${r.lat},${r.lon}`}>
                  <button
                    className="w-full px-3 py-2 text-left text-sm hover:bg-leaf-50"
                    onClick={() => {
                      setPoint(r.lat, r.lon);
                      setResults([]);
                    }}
                  >
                    {r.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <MapPicker lat={farm.lat} lon={farm.lon} onChange={setPoint} />
          <p className="mt-1 text-xs text-gray-600">{t("wiz.mapOffline")}</p>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
            <div>
              <label className="label" htmlFor="lat">{t("wiz.lat")}</label>
              <input id="lat" type="number" step="0.0001" min={-60} max={75} className="field" value={farm.lat} onChange={(e) => setFarm({ lat: Number(e.target.value) })} />
            </div>
            <div>
              <label className="label" htmlFor="lon">{t("wiz.lon")}</label>
              <input id="lon" type="number" step="0.0001" min={-180} max={180} className="field" value={farm.lon} onChange={(e) => setFarm({ lon: Number(e.target.value) })} />
            </div>
          </div>
        </Card>
      )}

      {step === 1 && (
        <Card title={t("wiz.rotation")}>
          <p className="mb-3 text-sm text-gray-700">{t("wiz.rotationHelp")}</p>
          <label className="mb-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sameEachYear}
              onChange={(e) => setFarm({ current_rotation: e.target.checked ? rotation.slice(0, 2) : rotation })}
            />
            {t("wiz.sameEachYear")}
          </label>
          <div className="grid gap-3 sm:grid-cols-3">
            {(sameEachYear ? [1] : [1, 2, 3]).map((year) => (
              <div key={year} className="rounded-xl bg-leaf-50 p-3">
                {!sameEachYear && <div className="mb-2 font-semibold text-leaf-800">{t("wiz.year")} {year}</div>}
                {(["wet", "dry"] as const).map((season, s) => {
                  const index = (year - 1) * 2 + s;
                  const id = `slot-${index}`;
                  return (
                    <div key={season} className="mb-2">
                      <label className="label" htmlFor={id}>{t(`season.${season}` as MessageKey)}</label>
                      <select id={id} className="field" value={rotation[index]} onChange={(e) => setSlot(index, e.target.value)}>
                        {season === "dry" && <option value="fallow">- {lang === "fil" ? "Pahinga (walang tanim)" : "Fallow (no crop)"} -</option>}
                        {cropOptions(season).map((c) => (
                          <option key={c.id} value={c.id}>{cropName(c.name, lang, c.id)}</option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
          <fieldset className="mt-4">
            <legend className="label">{t("wiz.excluded")}</legend>
            <div className="flex flex-wrap gap-2">
              {crops.map((c) => {
                const on = farm.excluded_crops.includes(c.id);
                return (
                  <label key={c.id} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${on ? "border-rose-400 bg-rose-50 text-rose-900 line-through" : "border-gray-300 bg-white"}`}>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={on}
                      onChange={() => setFarm({ excluded_crops: on ? farm.excluded_crops.filter((x) => x !== c.id) : [...farm.excluded_crops, c.id] })}
                    />
                    {cropName(c.name, lang, c.id)}
                  </label>
                );
              })}
            </div>
          </fieldset>
        </Card>
      )}

      {step === 2 && (
        <Card title={t("wiz.soil")}>
          <p className="mb-3 text-sm text-gray-700">{t("wiz.soilHelp")}</p>
          {soilLoading && <Spinner label={t("wiz.soilLoading")} />}
          {soilMap && !soilMap.available && <p className="mb-3 rounded-lg bg-amber-50 p-2 text-sm text-amber-900">{t("wiz.soilUnavailable")}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            {SOIL_FIELDS.map((key) => {
              const mapValue = soilMap?.values?.[key];
              const entered = overrides[key] !== undefined && overrides[key] !== null;
              const id = `soil-${key}`;
              return (
                <div key={key}>
                  <div className="flex items-center justify-between gap-2">
                    <label className="label" htmlFor={id}>{t(`field.${key}` as MessageKey)}</label>
                    <KindBadge kind={entered ? "farmer-entered" : mapValue !== undefined && mapValue !== null ? "modelled" : "unavailable"} />
                  </div>
                  <input
                    id={id}
                    type="number"
                    step="any"
                    className="field"
                    value={entered ? (overrides[key] as number) : ""}
                    placeholder={mapValue !== undefined && mapValue !== null ? String(Math.round(Number(mapValue) * 100) / 100) : "?"}
                    onChange={(e) => setOverride(key, e.target.value === "" ? null : Number(e.target.value))}
                  />
                  {entered && (
                    <button className="mt-1 text-xs text-leaf-700 underline" onClick={() => setOverride(key, null)}>
                      {t("wiz.reset")}
                    </button>
                  )}
                </div>
              );
            })}
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="label" htmlFor="texture">{t("wiz.texture")}</label>
                {soilMap?.values?.texture && !overrides.texture && <KindBadge kind={soilMap.provenance?.texture || "modelled"} />}
              </div>
              <select id="texture" className="field" value={overrides.texture || ""} onChange={(e) => setOverride("texture", e.target.value || null)}>
                <option value="">{t("wiz.textureAuto")}{soilMap?.values?.texture ? `: ${soilMap.values.texture}` : ""}</option>
                {textures.map((x) => (
                  <option key={x} value={x}>{x}</option>
                ))}
              </select>
            </div>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input type="checkbox" checked={!!overrides.compaction_suspected} onChange={(e) => setOverride("compaction_suspected", e.target.checked)} />
            {t("wiz.compaction")}
          </label>
        </Card>
      )}

      {step === 3 && (
        <Card title={t("wiz.water")}>
          <fieldset className="mb-4">
            <legend className="label">{t("wiz.waterSource")}</legend>
            {(["rainfed", "supplemental", "irrigated"] as WaterSource[]).map((ws) => (
              <label key={ws} className="mb-2 flex items-start gap-2 rounded-lg border bg-white p-2 text-sm">
                <input type="radio" name="ws" checked={farm.water_source === ws} onChange={() => setFarm({ water_source: ws })} className="mt-1" />
                {t(`wiz.ws.${ws}` as MessageKey)}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend className="label">{t("wiz.drainage")}</legend>
            {(["auto", "poor", "moderate", "good"] as Drainage[]).map((d) => (
              <label key={d} className="mb-2 flex items-start gap-2 rounded-lg border bg-white p-2 text-sm">
                <input type="radio" name="dr" checked={farm.drainage === d} onChange={() => setFarm({ drainage: d })} className="mt-1" />
                {t(`wiz.dr.${d}` as MessageKey)}
              </label>
            ))}
          </fieldset>
        </Card>
      )}

      {step === 4 && (
        <Card title={t("wiz.priorities")}>
          <p className="mb-3 text-sm text-gray-700">{t("wiz.prioritiesHelp")}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            {CRITERIA_KEYS.map(([key, label]) => {
              const total = Object.values(farm.priorities).reduce((a, b) => a + b, 0) || 1;
              return (
                <div key={key}>
                  <label className="label flex justify-between" htmlFor={`p-${key}`}>
                    <span>{t(label)}</span>
                    <span className="tabular-nums text-gray-600">{Math.round((100 * farm.priorities[key]) / total)}%</span>
                  </label>
                  <input
                    id={`p-${key}`}
                    type="range"
                    min={0}
                    max={100}
                    value={farm.priorities[key]}
                    onChange={(e) => setFarm({ priorities: { ...farm.priorities, [key]: Number(e.target.value) } })}
                    className="w-full accent-leaf-600"
                  />
                </div>
              );
            })}
          </div>
          <fieldset className="mt-4">
            <legend className="label">{t("wiz.ranking")}</legend>
            {(["average", "worst_case", "regret"] as RankingMode[]).map((m) => (
              <label key={m} className="mb-2 flex items-start gap-2 rounded-lg border bg-white p-2 text-sm">
                <input type="radio" name="rank" checked={farm.ranking_mode === m} onChange={() => setFarm({ ranking_mode: m })} className="mt-1" />
                <span>
                  <strong>{t(`wiz.rank.${m}` as MessageKey)}</strong> - {t(`wiz.rank.help.${m}` as MessageKey)}
                </span>
              </label>
            ))}
          </fieldset>
        </Card>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {step > 0 && (
          <button className="btn-secondary" onClick={() => setStep(step - 1)}>
            {t("wiz.back")}
          </button>
        )}
        {step < STEPS.length - 1 && (
          <button className="btn-primary" onClick={() => setStep(step + 1)}>
            {t("wiz.next")}
          </button>
        )}
        <button className={step === STEPS.length - 1 ? "btn-primary" : "btn-secondary"} onClick={run} disabled={planLoading}>
          {t("wiz.run")}
        </button>
      </div>
      {planLoading && <Spinner label={t("wiz.running")} />}
      {planError && <div className="mt-3"><ErrorBox message={planError} onRetry={run} /></div>}
    </div>
  );
}
