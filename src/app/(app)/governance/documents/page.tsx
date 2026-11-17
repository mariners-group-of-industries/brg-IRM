import { requirePermission } from "@/lib/require-permission";
import { hasPermission } from "@/lib/permissions";
import { demoStore, listMeetings } from "@/lib/demo-store";
import { visibleCompanies } from "@/lib/registry-access";
import { DocumentManager } from "@/components/document-manager";
import { PageHeader } from "@/components/page-header";
import { documentMetadata } from "@/lib/meeting-documents";
export const metadata={title:'Meeting documents'};
export default async function DocumentsPage(){
 const session=await requirePermission('documents.view');const ids=new Set(visibleCompanies(session).map(c=>c.id));
 const meetings=listMeetings().filter(m=>ids.has(m.companyId));
 const documents=demoStore.documents.filter(d=>ids.has(d.companyId)).map(documentMetadata);
 return <><PageHeader title="Meeting documents" description="Private meeting notices, annual reports and forms. Publish a document to make it available to authorized shareholders."/><p className="mb-4 rounded-md bg-warning-soft p-3 text-xs text-warning">Demo storage: uploads and publication changes reset on server restart.</p><DocumentManager meetings={meetings} documents={documents} canUpload={hasPermission(session.role,'documents.upload')} canPublish={hasPermission(session.role,'documents.publish')}/></>;
}
