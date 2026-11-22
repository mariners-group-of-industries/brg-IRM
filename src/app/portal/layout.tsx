import type { Metadata } from "next";
import Link from "next/link";
import { Building2, FileCheck, Landmark, Lock, ShieldCheck, User } from "lucide-react";
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
        <div className="flex min-h-screen flex-col bg-[#F4F7FB] selection:bg-[#0C9488]/20 selection:text-[#192D50]">
          {/* Top Navigation Bar */}
          <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md shadow-xs">
            <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
              <div className="flex items-center gap-3.5">
                <Link
                  href="/portal"
                  className="flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-[#0C9488]"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#192D50] text-white shadow-sm">
                    <Landmark className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="leading-tight">
                    <span className="block text-[15px] font-bold tracking-tight text-[#192D50]">BRG1 IRM</span>
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0C9488]">
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
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#192D50] hover:text-[#0C9488] transition-colors py-1.5 px-2.5 rounded-md hover:bg-slate-100"
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
                  <ShieldCheck className="h-4 w-4 text-[#0C9488]" aria-hidden />
                  {t("Secure & Confidential")}
                </span>
                <span className="hidden sm:inline text-slate-600">|</span>
                <span className="inline-flex items-center gap-1.5">
                  <FileCheck className="h-4 w-4 text-[#0C9488]" aria-hidden />
                  {t("Based on Verified Register")}
                </span>
                <span className="hidden sm:inline text-slate-600">|</span>
                <span className="inline-flex items-center gap-1.5">
                  <Lock className="h-4 w-4 text-[#0C9488]" aria-hidden />
                  {t("Data Protected")}
                </span>
              </div>
            </div>
          </footer>
        </div>
      </PortalLanguageProvider>
    );
  }

  return (
    <PortalLanguageProvider locale={locale}>
      <div className="flex min-h-screen flex-col bg-background">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-sm">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <Link href="/portal" className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-navy text-white">
                <Landmark className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden />
              </span>
              <span className="leading-tight">
                <span className="block text-[13px] font-semibold tracking-tight">BRG1 IRM</span>
                <span className="hidden text-[10px] font-medium uppercase tracking-[0.09em] text-muted-foreground sm:block">
                  {t("Shareholder Portal")}
                </span>
              </span>
            </Link>
            <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
              <PortalLanguageSwitch />
              <span className="hidden items-center gap-2 border-r border-border pr-4 text-xs text-muted-foreground md:inline-flex">
                <Building2 className="size-4" aria-hidden />
                {company?.shortName}
              </span>
              <Link
                href="/portal/account"
                className="hidden items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"
              >
                <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">
                  {session.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}
                </span>
                <span className="max-w-36 truncate text-xs font-medium">{session.name}</span>
              </Link>
              <PortalNotificationBell participantId={session.participantId} />
              <PortalSignout />
            </div>
          </div>
          <div className="border-t border-border/60">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <PortalNav />
            </div>
          </div>
        </header>

        <main id="portal-main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>

        <footer className="border-t border-border">
          <div className="mx-auto max-w-7xl px-4 py-4 text-[11px] leading-5 text-muted-foreground sm:px-6 lg:px-8">
            <details className="group">
              <summary className="w-fit cursor-pointer rounded-sm text-xs outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">
                {locale === "bn"
                  ? "শেয়ারহোল্ডার পোর্টাল · বিও ও প্রক্সি যাচাইকরণ"
                  : "Shareholder Portal · verified register & record-date governance"}
              </summary>
              <div className="mt-2 max-w-3xl space-y-1 text-xs leading-5">
                <p>
                  {locale === "bn"
                    ? "রেকর্ড তারিখের রেজিস্টার থেকে যোগ্যতা হিসাব করে প্রথম নিবন্ধনের সময় সংরক্ষণ করা হয়।"
                    : "Eligibility is calculated from the company register at the record date and locked at first registration."}
                </p>
                <p>
                  {t("Questions appear after moderation. Contact your company secretary for meeting support.")}
                </p>
              </div>
            </details>
          </div>
        </footer>
      </div>
    </PortalLanguageProvider>
  );
}
