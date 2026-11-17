import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { getPortalLocale } from "@/lib/portal-locale";
import { portalTranslator } from "@/lib/portal-i18n";
import { portalNotifications } from "@/lib/demo-store";
import { PortalNotificationList } from "@/components/portal/notifications";
export const metadata={title:'Notifications'};
export default async function NotificationsPage(){const session=await getPortalSession();if(!session)redirect('/portal/login');const t=portalTranslator(await getPortalLocale());return <div className="space-y-5"><h1 className="text-2xl font-semibold">{t('Notifications')}</h1><PortalNotificationList participantId={session.participantId} initial={portalNotifications(session.participantId)}/></div>;}
