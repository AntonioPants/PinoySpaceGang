"use client";
// Small shared building blocks used by every screen.
import Link from "next/link";
import { useStore } from "@/lib/store";
import type { Criterion, Rotation, Slot } from "@/lib/types";
import type { MessageKey } from "@/lib/i18n";

export const CRITERIA: Criterion[] = ["water", "soil", "risk", "income"];

export const ROTATION_COLORS: Record<string, string> = {
  current: "#8a8f98",
  A: "#2f7444",
  B: "#2b7bb9",
  C: "#c0792b",
};

const FAMILY_COLORS: Record<string, string> = {
  Poaceae: "bg-amber-100 text-amber-900 border-amber-300",
  Fabaceae: "bg-leaf-100 text-leaf-800 border-leaf-200",
  Solanaceae: "bg-rose-100 text-rose-900 border-rose-300",
  Cucurbitaceae: "bg-lime-100 text-lime-900 border-lime-300",
  Amaryllidaceae: "bg-violet-100 text-violet-900 border-violet-300",
  Convolvulaceae: "bg-fuchsia-100 text-fuchsia-900 border-fuchsia-300",
  Malvaceae: "bg-teal-100 text-teal-900 border-teal-300",
  Brassicaceae: "bg-sky-50 text-sky-700 border-sky-500/30",
  Pedaliaceae: "bg-orange-100 text-orange-900 border-orange-300",
};

export function Card({ children, className = "", title, actions }: { children: React.ReactNode; className?: string; title?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className={`rounded-2xl border border-leaf-100 bg-white p-4 shadow-sm sm:p-5 ${className}`}>
      {(title || actions) && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-lg font-semibold text-leaf-900">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function PageTitle({ title, help }: { title: string; help?: string }) {
  return (
    <header className="mb-4">
      <h1 className="text-2xl font-bold text-leaf-900 sm:text-3xl">{title}</h1>
      {help && <p className="mt-1 max-w-3xl text-sm text-gray-700">{help}</p>}
    </header>
  );
}

const KIND_STYLE: Record<string, string> = {
  observed: "bg-sky-50 text-sky-700 border-sky-500/40",
  modelled: "bg-soil-50 text-soil-700 border-soil-300",
  "farmer-entered": "bg-leaf-50 text-leaf-800 border-leaf-200",
  assumed: "bg-amber-50 text-amber-900 border-amber-300",
  unavailable: "bg-gray-100 text-gray-600 border-gray-300",
};

/** Small label saying where a number came from (observed / modelled / farmer-entered ...). */
export function KindBadge({ kind, label }: { kind: string; label?: string }) {
  const { t } = useStore();
  const known = ["observed", "modelled", "farmer-entered", "assumed", "unavailable"].includes(kind);
  const text = known ? t(`kind.${kind}` as MessageKey) : kind;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium ${KIND_STYLE[kind] || KIND_STYLE.modelled}`}
      title={label ? `${label} (${text})` : text}
    >
      {label ? <span className="max-w-[16rem] truncate">{label}</span> : null}
      <span className={label ? "opacity-70" : ""}>{label ? `· ${text}` : text}</span>
    </span>
  );
}

export function ScoreBar({ label, value, color = "#2f7444", compact = false }: { label: string; value: number; color?: string; compact?: boolean }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={compact ? "text-xs" : "text-sm"}>
      <div className="flex justify-between">
        <span className="text-gray-700">{label}</span>
        <span className="font-semibold tabular-nums">{value.toFixed(0)}</span>
      </div>
      <div className="mt-1 h-2 rounded-full bg-gray-100" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} aria-label={label}>
        <div className="h-2 rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
    </div>
  );
}

export function CropChip({ slot }: { slot: Slot }) {
  const style = slot.family ? FAMILY_COLORS[slot.family] || "bg-gray-50 border-gray-300" : "bg-white text-gray-500 border-dashed border-gray-300";
  return (
    <span className={`inline-block rounded-lg border px-2 py-1 text-xs font-medium ${style}`} title={slot.family || ""}>
      {slot.crop_name}
    </span>
  );
}

/** The six seasons of a rotation as a 3-year grid. */
export function RotationStrip({ rotation }: { rotation: Rotation }) {
  const { t } = useStore();
  return (
    <div className="grid grid-cols-3 gap-1 sm:gap-2">
      {[1, 2, 3].map((year) => (
        <div key={year} className="rounded-lg bg-leaf-50 p-1.5">
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-leaf-700">
            {t("wiz.year")} {year}
          </div>
          <div className="flex flex-col gap-1">
            {rotation.slots
              .filter((s) => s.year === year)
              .map((s) => (
                <CropChip key={s.index} slot={s} />
              ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function NeedPlan() {
  const { t, plan, planLoading, ready } = useStore();
  if (!ready || planLoading) return <Spinner />;
  if (plan) return null;
  return (
    <Card>
      <p className="text-gray-700">{t("common.noPlan")}</p>
      <Link href="/" className="btn-primary mt-3 inline-block">
        {t("common.goSetup")}
      </Link>
    </Card>
  );
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useStore();
  return (
    <div className="flex items-center gap-3 p-4 text-leaf-800" role="status" aria-live="polite">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-leaf-200 border-t-leaf-600" />
      <span>{label || t("common.loading")}</span>
    </div>
  );
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useStore();
  return (
    <div className="rounded-xl border border-rose-300 bg-rose-50 p-3 text-sm text-rose-900" role="alert">
      <p>{message}</p>
      {onRetry && (
        <button className="btn-secondary mt-2" onClick={onRetry}>
          {t("common.retry")}
        </button>
      )}
    </div>
  );
}

export function Disclaimer() {
  const { t, plan } = useStore();
  return (
    <p className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      <strong>{t("common.adviser")}</strong>
      <span className="block text-amber-800">{plan?.disclaimer || t("common.relative")}</span>
    </p>
  );
}

export function useRotations() {
  const { plan } = useStore();
  const rotations = plan?.rotations ?? [];
  const current = rotations.find((r) => r.is_current) ?? null;
  const options = rotations.filter((r) => !r.is_current);
  return { plan, rotations, current, options };
}

export function seasonLabel(kind: string, t: (key: MessageKey) => string): string {
  return t(`season.${kind}` as MessageKey);
}

export function fmt(value: number | null | undefined, digits = 0): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "-";
  return value.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: digits });
}
