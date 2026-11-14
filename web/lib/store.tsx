"use client";
// App state: the farm profile (kept in localStorage), the latest plan (also kept, so the
// app still shows it offline) and the interface language.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import { translate, type MessageKey } from "./i18n";
import type { Lang, Plan, PlanRequest } from "./types";

export const PILOT = { lat: 15.72, lon: 120.9, name: "Munoz, Nueva Ecija" };

export const DEFAULT_FARM: PlanRequest = {
  lat: PILOT.lat,
  lon: PILOT.lon,
  current_rotation: ["rice", "fallow"],
  soil_overrides: {},
  priorities: { water: 25, soil: 25, income: 25, risk: 25 },
  water_source: "rainfed",
  drainage: "auto",
  ranking_mode: "average",
  excluded_crops: [],
  lang: "en",
};

const FARM_KEY = "fieldshift.farm.v1";
const PLAN_KEY = "fieldshift.plan.v1";
const LANG_KEY = "fieldshift.lang.v1";

interface Store {
  ready: boolean;
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: MessageKey) => string;
  farm: PlanRequest;
  setFarm: (update: Partial<PlanRequest>) => void;
  plan: Plan | null;
  planLoading: boolean;
  planError: string | null;
  runPlan: (override?: Partial<PlanRequest>) => Promise<Plan | null>;
  online: boolean;
}

const StoreContext = createContext<Store | null>(null);

function load<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or blocked: the app still works for this session
  }
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [lang, setLangState] = useState<Lang>("en");
  const [farm, setFarmState] = useState<PlanRequest>(DEFAULT_FARM);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState<string | null>(null);
  const [online, setOnline] = useState(true);

  useEffect(() => {
    const storedLang = load<Lang>(LANG_KEY);
    if (storedLang) setLangState(storedLang);
    const storedFarm = load<PlanRequest>(FARM_KEY);
    if (storedFarm) setFarmState({ ...DEFAULT_FARM, ...storedFarm });
    const storedPlan = load<Plan>(PLAN_KEY);
    if (storedPlan) setPlan(storedPlan);
    setOnline(navigator.onLine);
    const up = () => setOnline(true);
    const down = () => setOnline(false);
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    setReady(true);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === "fil" ? "fil" : "en";
  }, [lang]);

  const setFarm = useCallback((update: Partial<PlanRequest>) => {
    setFarmState((prev) => {
      const next = { ...prev, ...update };
      save(FARM_KEY, next);
      return next;
    });
  }, []);

  const runPlan = useCallback(
    async (override?: Partial<PlanRequest>) => {
      const body: PlanRequest = { ...farm, ...override, lang };
      if (override) setFarm(override);
      setPlanLoading(true);
      setPlanError(null);
      try {
        const result = await api.plan(body);
        setPlan(result);
        save(PLAN_KEY, result);
        return result;
      } catch (err) {
        setPlanError(err instanceof Error ? err.message : String(err));
        return null;
      } finally {
        setPlanLoading(false);
      }
    },
    [farm, lang, setFarm],
  );

  const setLang = useCallback(
    (next: Lang) => {
      setLangState(next);
      save(LANG_KEY, next);
    },
    [],
  );

  // Engine text (reasons, rules) is generated in the plan's language: re-run when it changes.
  useEffect(() => {
    if (ready && plan && plan.lang !== lang && !planLoading) {
      void runPlan(plan.request);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang, ready]);

  const t = useCallback((key: MessageKey) => translate(lang, key), [lang]);

  const value = useMemo(
    () => ({ ready, lang, setLang, t, farm, setFarm, plan, planLoading, planError, runPlan, online }),
    [ready, lang, setLang, t, farm, setFarm, plan, planLoading, planError, runPlan, online],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore must be used inside StoreProvider");
  return store;
}
