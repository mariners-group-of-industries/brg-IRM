import { notFound } from "next/navigation";
import { getPortalSession } from "@/lib/portal-session";
import { requirePermission } from "@/lib/require-permission";
import { demoStore } from "@/lib/demo-store";
import { portalDocument } from "@/lib/meeting-documents";
import { auditRegistry, registry } from "@/lib/shareholder-store";
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const portal = await getPortalSession();
  let document = portal ? portalDocument(portal.participantId, id) : null;
  let actor = portal ? `participant:${portal.participantId}` : "";
  if (!document) {
    const staff = await requirePermission("documents.view");
    document = demoStore.documents.find((d) => d.id === id && (staff.role === "Platform Super Admin" || staff.companyIds.includes(d.companyId))) ?? null;
    actor = staff.email;
  }
  if (!document) notFound();
  const download = new URL(request.url).searchParams.get("download") === "1";
  auditRegistry(registry, actor, "document.read", `document:${id}`, document.companyId);
  return new Response(new Uint8Array(document.content), { headers: { "Content-Type": document.mimeType, "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${encodeURIComponent(document.fileName)}`, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "SAMEORIGIN" } });
}
