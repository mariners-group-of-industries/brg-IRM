import { notFound, redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { getPortalDashboard } from "@/lib/portal-dashboard";
import { PortalMeetingsList } from "@/components/portal/meetings-list";
import { PageHeader } from "@/components/page-header";
import { getPortalLocale } from "@/lib/portal-locale";
import { portalTranslator } from "@/lib/portal-i18n";

export const metadata = { title: "My meetings" };
export default async function PortalMeetingsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login?next=/portal/meetings");
  const data = getPortalDashboard(session.participantId);
  if (!data) notFound();
  const { view } = await searchParams;
  const t=portalTranslator(await getPortalLocale());
  return <><PageHeader title={t('My meetings')} description={data.company.name} /><PortalMeetingsList meetings={data.meetings} initialView={view === "past" ? "past" : "upcoming"} /></>;
}
