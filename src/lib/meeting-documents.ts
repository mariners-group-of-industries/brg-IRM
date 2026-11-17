import { demoStore, getMeeting, getParticipantById, isPublishedMeeting, participantRights } from "./demo-store";

export function validateDocumentBytes(fileName: string, bytes: Uint8Array) {
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error("Use a non-empty PDF or UTF-8 text file under 5 MB");
  const safeName = fileName.replace(/[\r\n"\\/]/g, "_").slice(0, 120);
  if (/\.pdf$/i.test(safeName)) {
    const source = Buffer.from(bytes).toString("latin1");
    if (!source.startsWith("%PDF-") || !source.slice(-1024).includes("%%EOF") || /\/(JavaScript|JS|Launch|EmbeddedFile|RichMedia|OpenAction)\b/.test(source)) throw new Error("Use a valid PDF without scripts, embedded files or launch actions");
    return { fileName: safeName, mimeType: "application/pdf" as const };
  }
  if (!/\.(txt|md)$/i.test(safeName)) throw new Error("PDF and UTF-8 text files only");
  let text: string;
  try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); } catch { throw new Error("The text file must use UTF-8 encoding"); }
  if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text)) throw new Error("The text file contains unsupported control characters");
  return { fileName: safeName, mimeType: "text/plain" as const, text };
}
export function portalDocument(participantId: string, documentId: string) {
  const participant = getParticipantById(participantId); const document = demoStore.documents.find((d) => d.id === documentId && d.published);
  if (!participant || !document || document.companyId !== participant.companyId) return null;
  const meeting = getMeeting(document.meetingId);
  if (!meeting || !isPublishedMeeting(meeting) || (participant.kind !== "individual" && !participantRights(meeting.id, participantId))) return null;
  return document;
}
export function portalDocuments(participantId: string, meetingId?: string) {
  return demoStore.documents.filter((d) => (!meetingId || d.meetingId === meetingId) && portalDocument(participantId, d.id))
    .map(documentMetadata);
}
export function documentMetadata(d: typeof demoStore.documents[number]) { return {id:d.id,companyId:d.companyId,meetingId:d.meetingId,title:d.title,kind:d.kind,fileName:d.fileName,mimeType:d.mimeType,published:d.published,createdAt:d.createdAt,publishedAt:d.publishedAt,bytes:d.content.byteLength}; }
