import { NextResponse } from "next/server";
import { getPortalSession } from "@/lib/portal-session";
import { attachAudioQuestion, getMeeting, canParticipate } from "@/lib/demo-store";

const MAX_BYTES = 3 * 1024 * 1024; // ~2 minutes of low-bitrate opus
const MAX_DURATION_SEC = 150; // manual allows 2–3 minutes

/**
 * Audio questions from the portal. In production this streams to private
 * object storage behind scanning; in demo mode the bytes are held in memory
 * and served only to the author or staff with meetings.control.
 */
export async function POST(request: Request) {
  const session = await getPortalSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const meetingId = String(form.get("meetingId") ?? "");
  const durationSec = Number(form.get("durationSec") ?? 0);
  const file = form.get("audio");

  const meeting = getMeeting(meetingId);
  if (!meeting || meeting.companyId !== session.companyId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (!canParticipate(meetingId, session.participantId)) return NextResponse.json({ error: "Register for an open meeting first" }, { status: 404 });
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "No audio received" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Recording too long — keep it under 2–3 minutes" }, { status: 413 });
  }
  if (!Number.isFinite(durationSec) || durationSec <= 0 || durationSec > MAX_DURATION_SEC) {
    return NextResponse.json({ error: "Duration out of range" }, { status: 400 });
  }

  const mime = (file.type || "").toLowerCase();
  if (!mime.startsWith("audio/")) {
    return NextResponse.json({ error: "Audio files only" }, { status: 415 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (!sniffAudio(buffer, mime)) {
    return NextResponse.json({ error: "Unsupported audio format" }, { status: 415 });
  }

  const result = attachAudioQuestion(meeting.id, session.participantId, {
    buffer,
    mimeType: mime,
    durationSec: Math.round(durationSec),
  });
  if (!result.ok) {
    return NextResponse.json({ error: "Could not store the question" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, audioId: result.audioId });
}

/** Minimal container sniffing — never trust the client-supplied MIME alone. */
function sniffAudio(buffer: Buffer, mime: string): boolean {
  if (buffer.length < 12) return false;
  const head = buffer.subarray(0, 12);
  const isWebm = head[0] === 0x1a && head[1] === 0x45 && head[2] === 0xdf && head[3] === 0xa3; // EBML
  const isOgg = head.subarray(0, 4).toString("ascii") === "OggS";
  const isMp3 =
    (head[0] === 0xff && (head[1] & 0xe0) === 0xe0) ||
    head.subarray(0, 3).toString("ascii") === "ID3";
  const isWav = head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WAVE";
  const isMp4 =
    head.subarray(4, 8).toString("ascii") === "ftyp";
  if (isWebm || isOgg || isMp3 || isWav) return true;
  if (isMp4 && (mime.includes("mp4") || mime.includes("m4a") || mime.includes("aac"))) return true;
  return false;
}
