import { redirect } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { getPortalLocale } from "@/lib/portal-locale";
import { portalTranslator } from "@/lib/portal-i18n";
import { portalDocuments } from "@/lib/meeting-documents";
import { PortalDocuments } from "@/components/portal/documents";
export const metadata={title:'Published documents'};
export default async function DocumentsPage(){const session=await getPortalSession();if(!session)redirect('/portal/login');const t=portalTranslator(await getPortalLocale());return <div className="space-y-5"><h1 className="text-2xl font-semibold">{t('Published documents')}</h1><p className="text-sm text-muted-foreground">{t('Published documents for your authorized meetings appear here.')}</p><PortalDocuments documents={portalDocuments(session.participantId)}/></div>;}
