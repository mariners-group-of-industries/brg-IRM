import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Landmark } from "lucide-react";
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
  const locale = await getPortalLocale(); const t = portalTranslator(locale);
  const company = session ? getCompany(session.companyId) : null;

  return (
    <PortalLanguageProvider locale={locale}><div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/portal" className="flex items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-navy text-white">
              <Landmark className="h-4.5 w-4.5" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="leading-tight">
              <span className="block text-[13px] font-semibold tracking-tight">BRG1 IRM</span>
              <span className="hidden text-[10px] font-medium uppercase tracking-[0.09em] text-muted-foreground sm:block">
                {t('Shareholder Portal')}
              </span>
            </span>
          </Link>
          <div className="flex min-w-0 items-center gap-1.5 sm:gap-3">
            <PortalLanguageSwitch />
            {!session && (
              <Link
                href="/login"
                className="text-[12px] font-medium text-muted-foreground hover:text-foreground"
              >
                {t('Staff sign in →')}
              </Link>
            )}
            {session && <>
              <span className="hidden items-center gap-2 border-r border-border pr-4 text-xs text-muted-foreground md:inline-flex"><Building2 className="size-4" aria-hidden />{company?.shortName}</span>
              <Link href="/portal/account" className="hidden items-center gap-2 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring sm:inline-flex"><span className="flex size-8 items-center justify-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{session.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join("")}</span><span className="max-w-36 truncate text-xs font-medium">{session.name}</span></Link>
              <PortalNotificationBell participantId={session.participantId} />
              <PortalSignout />
            </>}
          </div>
        </div>
        {session && <div className="border-t border-border/60"><div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"><PortalNav /></div></div>}
      </header>

      <main id="portal-main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>

      <footer className="border-t border-border">
        <div className="mx-auto max-w-7xl px-4 py-4 text-[11px] leading-5 text-muted-foreground sm:px-6 lg:px-8">
          <details className="group">
            <summary className="w-fit cursor-pointer rounded-sm text-xs outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring">{t('Demo environment · fictional data, resets on restart')}</summary>
            <div className="mt-2 max-w-3xl space-y-1 text-xs leading-5">
              <p>{locale==='bn'?'রেকর্ড তারিখের ইন-মেমোরি রেজিস্টার থেকে যোগ্যতা হিসাব করে প্রথম নিবন্ধনের সময় সংরক্ষণ করা হয়। এটি প্রত্যয়িত প্রোডাকশন রেজিস্টার নয়।':'Eligibility is calculated from the in-memory register at the record date and frozen at first registration. This is not a certified production register.'}</p>
              <p>{t('Questions appear after moderation. Contact your company secretary for meeting support.')}</p>
            </div>
          </details>
        </div>
      </footer>
    </div></PortalLanguageProvider>
  );
}
