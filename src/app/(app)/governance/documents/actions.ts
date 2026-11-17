"use server";
import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission } from "@/lib/require-permission";
import { addMeetingDocument, demoStore, getMeeting, publishMeetingDocument } from "@/lib/demo-store";
import { validateDocumentBytes } from "@/lib/meeting-documents";
export async function uploadMeetingDocumentAction(form: FormData) {
  const session = await requirePermission("documents.upload");
  const parsed = z.object({ meetingId: z.string().min(1), title: z.string().trim().min(3).max(160), kind: z.enum(["notice", "annual_report", "financials", "minutes", "form"]) }).safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false as const, error: "Choose a meeting, title and document category" };
  const meeting = getMeeting(parsed.data.meetingId);
  if (!meeting || (session.role !== "Platform Super Admin" && !session.companyIds.includes(meeting.companyId))) notFound();
  const file = form.get("file"); if (!(file instanceof File)) return { ok: false as const, error: "Choose a PDF or text file" };
  if (file.size > 5 * 1024 * 1024) return { ok: false as const, error: "Files must be under 5 MB" };
  try {
    const content = new Uint8Array(await file.arrayBuffer()); const fileData = validateDocumentBytes(file.name, content);
    addMeetingDocument({ ...parsed.data, ...fileData, companyId: meeting.companyId, content, published: false }, session.email);
    revalidatePath("/governance/documents"); return { ok: true as const };
  } catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "Could not upload document" }; }
}
export async function publishDocumentAction(id: string, published: boolean) {
  const session = await requirePermission("documents.publish"); const document = demoStore.documents.find((d) => d.id === id);
  if (!document || (session.role !== "Platform Super Admin" && !session.companyIds.includes(document.companyId))) notFound();
  if (published && document.kind === "notice" && !getMeeting(document.meetingId)?.noticePublished) await requirePermission("meetings.publish");
  if (!publishMeetingDocument(id, published, session.email)) return { ok: false as const, error: "Invalid document state" };
  revalidatePath("/governance/documents"); revalidatePath("/portal", "layout"); return { ok: true as const };
}
