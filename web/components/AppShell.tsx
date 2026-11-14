"use client";
// Page frame: header with language switch, navigation (top bar on desktop, drawer on mobile),
// offline notice and service-worker registration for the PWA.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import type { MessageKey } from "@/lib/i18n";

const NAV: { href: string; key: MessageKey }[] = [
  { href: "/", key: "nav.setup" },
  { href: "/dashboard", key: "nav.dashboard" },
  { href: "/results", key: "nav.results" },
  { href: "/time-machine", key: "nav.time" },
  { href: "/adaptive", key: "nav.adaptive" },
  { href: "/soil", key: "nav.soil" },
  { href: "/why", key: "nav.why" },
  { href: "/data", key: "nav.data" },
  { href: "/advisor", key: "nav.advisor" },
  { href: "/print", key: "nav.print" },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { t, lang, setLang, online, plan } = useStore();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  return (
    <div className="min-h-screen bg-leaf-50 text-gray-900">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="no-print sticky top-0 z-40 border-b border-leaf-800 bg-leaf-700 text-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2">
          <Link href="/" className="flex items-center gap-2 font-bold">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon.svg" alt="" className="h-8 w-8 rounded-lg" />
            <span className="text-lg">{t("app.name")}</span>
          </Link>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLang(lang === "en" ? "fil" : "en")}
              className="rounded-lg border border-white/40 px-3 py-1.5 text-sm font-medium hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-white"
              aria-label={`Switch language to ${t("lang.toggle")}`}
            >
              {t("lang.toggle")}
            </button>
            <button
              className="rounded-lg border border-white/40 px-3 py-1.5 text-sm font-medium lg:hidden"
              aria-expanded={open}
              aria-controls="site-nav"
              onClick={() => setOpen((v) => !v)}
            >
              {t("nav.menu")}
            </button>
          </div>
        </div>
        <nav id="site-nav" aria-label="Main" className={`${open ? "block" : "hidden"} border-t border-leaf-800 bg-leaf-800 lg:block`}>
          <ul className="mx-auto flex max-w-6xl flex-col gap-0.5 px-2 py-1 lg:flex-row lg:flex-wrap lg:gap-1">
            {NAV.map((item) => {
              const active = pathname === item.href;
              const disabled = !plan && item.href !== "/" && item.href !== "/dashboard" && item.href !== "/data";
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-md px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-white ${
                      active ? "bg-white text-leaf-800" : "text-leaf-50 hover:bg-white/10"
                    } ${disabled ? "opacity-60" : ""}`}
                  >
                    {t(item.key)}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </header>
      {!online && (
        <div className="no-print bg-amber-100 px-4 py-2 text-center text-sm text-amber-900" role="status">
          {t("common.offline")}
        </div>
      )}
      <main id="main" className="mx-auto max-w-6xl px-3 py-5 sm:px-4">
        {children}
      </main>
      <footer className="no-print mx-auto max-w-6xl px-4 pb-8 text-xs text-gray-600">
        {t("common.relative")} {t("common.adviser")} · NASA POWER · SMAP · ECOSTRESS · MODIS · ISRIC SoilGrids
      </footer>
    </div>
  );
}
