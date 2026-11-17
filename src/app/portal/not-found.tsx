import Link from "next/link";
import { getPortalLocale } from "@/lib/portal-locale";
import { portalTranslator } from "@/lib/portal-i18n";
export default async function PortalNotFound(){const t=portalTranslator(await getPortalLocale());return <div className="mx-auto max-w-md py-16 text-center"><h1 className="text-2xl font-semibold">{t('Page unavailable')}</h1><p className="mt-3 text-sm text-muted-foreground">{t('This page is unavailable for your current account or meeting access.')}</p><Link href="/portal" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">{t('Back to dashboard')}</Link></div>;}
