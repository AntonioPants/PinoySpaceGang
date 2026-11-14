// Thin client for the Field Shift engine. Requests go to /api/* on the same origin;
// next.config.mjs forwards them to the Python engine (ENGINE_URL, default http://127.0.0.1:8000).
import type { AdvisorAnswer, Backtest, CropFull, DroughtStatus, Lang, Plan, PlanRequest } from "./types";

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers || {}) } });
  } catch {
    throw new ApiError("The engine could not be reached. Is it running (make engine) and are you online or using the offline snapshot?", 0);
  }
  if (!response.ok) {
    let detail = response.statusText;
    try {
      const body = await response.json();
      detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* keep statusText */
    }
    throw new ApiError(detail, response.status);
  }
  return response.json() as Promise<T>;
}

const q = (params: Record<string, string | number | boolean>) =>
  new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString();

export const api = {
  health: () => request<Record<string, any>>("/api/health"),
  config: () => request<Record<string, any>>("/api/config"),
  crops: () => request<{ crops: CropFull[]; references: Record<string, string>; meta: Record<string, string> }>("/api/crops"),
  climate: (lat: number, lon: number) => request<Record<string, any>>(`/api/climate?${q({ lat, lon })}`),
  soil: (lat: number, lon: number) => request<{ available: boolean; soil: { values: Record<string, any>; provenance: Record<string, string> }; source: Record<string, any> }>(`/api/soil?${q({ lat, lon })}`),
  drought: (lat: number, lon: number, lang: Lang) => request<DroughtStatus>(`/api/drought?${q({ lat, lon, lang })}`),
  backtest: (lat: number, lon: number, lang: Lang) => request<Backtest>(`/api/backtest?${q({ lat, lon, lang })}`),
  geocode: (text: string) => request<{ results: { name: string; lat: number; lon: number }[] }>(`/api/geocode?${q({ q: text })}`),
  plan: (body: PlanRequest) => request<Plan>("/api/plan", { method: "POST", body: JSON.stringify(body) }),
  advisor: (question: string, plan: Plan | null, lang: Lang, history: { role: string; content: string }[]) =>
    request<AdvisorAnswer>("/api/advisor", {
      method: "POST",
      // plan_id lets the engine use its in-memory copy; plan_context covers an engine restart
      body: JSON.stringify({ question, plan_id: plan?.plan_id, plan_context: plan, lang, history }),
    }),
};
