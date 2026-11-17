import { notFound, redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { getPortalDashboard } from "@/lib/portal-dashboard";
import { ShareholderDashboard } from "@/components/portal/dashboard";
import { getPortalLocale } from "@/lib/portal-locale";

export const metadata = { title: "Dashboard" };

export default async function PortalHomePage() {
  const session = await getPortalSession();
  if (!session) redirect("/portal/login");
  const now = new Date();
  const data = getPortalDashboard(session.participantId, now);
  if (!data) notFound();
  const locale=await getPortalLocale();
  const today = new Intl.DateTimeFormat(locale==='bn'?'bn-BD':"en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Dhaka" }).format(now);
  return <ShareholderDashboard data={data} today={today} />;
}
