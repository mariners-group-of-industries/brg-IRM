import type { Metadata } from "next";
import Link from "next/link";
import { FileCheck, Landmark, Lock, ShieldCheck, User } from "lucide-react";
import { getPortalSession } from "@/lib/portal-session";
import { getCompany } from "@/lib/demo-store";
import { PortalSignout } from "@/components/portal/portal-signout";
import { PortalNav } from "@/components/portal/portal-nav";
import { getPortalLocale } from "@/lib/portal-locale";
import { portalTranslator } from "@/lib/portal-i18n";
import { PortalLanguageProvider, PortalLanguageSwitch } from "@/components/portal/language-provider";
import { PortalNotificationBell } from "@/components/portal/notifications";

export const metadata: Metadata = {
  title: {
    default: "Shareholder Portal",
    template: "%s · Shareholder Portal",
  },
  description:
    "Secure shareholder access to notices, registration, live meetings, voting, questions and receipts.",
};

/**
 * Shareholder portal chrome — deliberately separate from the admin shell.
 * Light, mobile-first, one job: let a shareholder participate without friction.
 */
export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getPortalSession();
  const locale = await getPortalLocale();
  const t = portalTranslator(locale);
  const company = session ? getCompany(session.companyId) : null;

  if (!session) {
    return (
      <PortalLanguageProvider locale={locale}>
        <div className="flex min-h-screen flex-col bg-[#F4F7FB] selection:bg-[#008F83]/20 selection:text-[#112B4E]">
          {/* Top Navigation Bar */}
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3.5">
                <Link
                  href="/portal"
                  className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#008F83]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#112B4E] text-white shadow-sm">
                    <Landmark className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[15px] font-bold tracking-tight text-[#112B4E]">BRG1 IRM</span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#008F83]">
                      {t("Shareholder Portal")}
                    </span>
                  </span>
                </Link>
                <div className="hidden md:flex items-center gap-2.5 border-l border-slate-200 pl-3.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <span>AGM</span>
                  <span className="text-slate-300">|</span>
                  <span>EGM</span>
                  <span className="text-slate-300">|</span>
                  <span>{t("Shareholder Meeting")}</span>
                </div>
              </div>

              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <PortalLanguageSwitch />
                <Link
                  href="/admin"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#112B4E] hover:text-[#008F83] transition-colors py-1.5 px-2.5 rounded-md hover:bg-slate-100"
                >
                  <User className="h-3.5 w-3.5" aria-hidden />
                  <span>{t("Staff Sign In →")}</span>
                </Link>
              </div>
            </div>
          </header>

          {/* Main Full-Width Content Area */}
          <main id="portal-main" className="flex-1 w-full flex flex-col justify-center">
            {children}
          </main>

          {/* Bottom Security & Governance Bar */}
          <footer className="border-t border-[#0e1828] bg-[#101c31] text-slate-300">
            <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 py-3.5 text-xs font-medium sm:flex-row sm:px-6 lg:px-8">
              <div className="flex items-center gap-2">
                <span className="font-bold text-white">BRG1 IRM</span>
                <span className="text-slate-500">|</span>
                <span className="text-slate-300">{t("Shareholder Portal")}</span>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] sm:gap-6 text-slate-300/90">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#008F83]" aria-hidden />
                  {t("Secure & Confidential")}
                </span>
                <span className="hidden sm:inline text-slate-600">|</span>
                <span className="inline-flex items-center gap-1.5">
                  <FileCheck className="h-4 w-4 text-[#008F83]" aria-hidden />
                  {t("Based on Verified Register")}
                </span>
                <span className="hidden sm:inline text-slate-600">|</span>
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-[#008F83]" aria-hidden />
                  {t("Data Protected")}
                </span>
              </div>
            </div>
          </footer>
        </div>
      </PortalLanguageProvider>
    );
  }

  const initials = session.name
    .split(/\s+/)
    .map((part) => part[0])
    .slice(0, 2)
    .join("");

  return (
    <PortalLanguageProvider locale={locale}>
      <div className="flex min-h-screen flex-col bg-[#F4F8FC] selection:bg-[#008F83]/20 selection:text-[#112B4E]">
        {/* Single Modern Application Header */}
        <header className="sticky top-0 z-30 border-b border-[#E3EBF2] bg-white/95 backdrop-blur-md shadow-xs">
          <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
            {/* Left: Brand Identity */}
            <div className="flex items-center gap-3">
              <Link
                href="/portal"
                className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#008F83]"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#112B4E] text-white shadow-sm">
                  <Landmark className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                </span>
                <span className="leading-tight">
                  <span className="block text-[15px] font-bold tracking-tight text-[#112B4E]">BRG1 IRM</span>
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#008F83]">
                    {t("Shareholder Portal")}
                  </span>
                </span>
              </Link>
            </div>

            {/* Center: Integrated Navigation Pills */}
            <div className="hidden md:flex items-center justify-center flex-1 max-w-xl">
              <PortalNav />
            </div>

            {/* Right: Language, Notifications & Profile */}
            <div className="flex items-center gap-2.5 sm:gap-3.5">
              <PortalLanguageSwitch />
              <PortalNotificationBell participantId={session.participantId} />

              <div className="flex items-center gap-2 pl-2 sm:pl-3 border-l border-slate-200">
                <Link
                  href="/portal/account"
                  className="flex items-center gap-2 rounded-full py-1 px-1.5 hover:bg-slate-100 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#008F83]"
                  title={session.name}
                >
                  <span className="flex size-8 items-center justify-center rounded-full bg-[#EFF7FF] border border-blue-200 text-xs font-bold text-[#112B4E]">
                    {initials}
                  </span>
                  <span className="hidden sm:inline-block max-w-32 truncate text-xs font-semibold text-[#12263F]">
                    {session.name}
                  </span>
                </Link>
                <PortalSignout />
              </div>
            </div>
          </div>

          {/* Mobile Navigation bar */}
          <div className="md:hidden border-t border-slate-200/80 bg-white px-4 py-1.5 overflow-x-auto shadow-xs [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <PortalNav />
          </div>
        </header>

        {/* Main Dashboard / Content Area */}
        <main id="portal-main" className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>

        {/* Clean Corporate Governance Footer */}
        <footer className="border-t border-[#E3EBF2] bg-white text-slate-500">
          <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-3 px-4 py-4 text-xs font-medium sm:flex-row sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <span className="font-bold text-[#112B4E]">BRG1 IRM</span>
              <span className="text-slate-300">|</span>
              <span className="text-slate-600">{t("Shareholder Portal")}</span>
              {company && (
                <>
                  <span className="text-slate-300">·</span>
                  <span className="text-slate-400">{company.shortName}</span>
                </>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] sm:gap-6 text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-[#008F83]" aria-hidden />
                {t("Secure & Confidential")}
              </span>
              <span className="hidden sm:inline text-slate-300">|</span>
              <span className="inline-flex items-center gap-1.5">
                <FileCheck className="h-4 w-4 text-[#008F83]" aria-hidden />
                {t("Based on Verified Register")}
              </span>
              <span className="hidden sm:inline text-slate-300">|</span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-[#008F83]" aria-hidden />
                {t("Data Protected")}
              </span>
            </div>
          </div>
        </footer>
      </div>
    </PortalLanguageProvider>
  );
}
