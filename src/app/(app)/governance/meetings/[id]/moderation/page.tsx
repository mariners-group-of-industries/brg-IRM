import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Headset, MessageSquareText, Mic, ShieldCheck } from "lucide-react";
import { requirePermission } from "@/lib/require-permission";
import { getMeeting, listQuestions } from "@/lib/demo-store";
import { PageHeader } from "@/components/page-header";
import { ModerationDecision } from "./moderation-decision";
import { timeAgo, formatTime } from "@/lib/format";

export const metadata = { title: "Moderation queue" };

export default async function ModerationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requirePermission("meetings.control");
  const meeting = getMeeting(id);
  if (!meeting) notFound();
  if (
    session.role !== "Platform Super Admin" &&
    !session.companyIds.includes(meeting.companyId)
  ) {
    notFound();
  }

  const questions = listQuestions(meeting.id).sort(
    (a, b) => +new Date(b.at) - +new Date(a.at),
  );
  const pending = questions.filter((q) => q.status === "pending");
  const decided = questions.filter((q) => q.status !== "pending");

  return (
    <>
      <Link
        href={`/governance/meetings/${meeting.id}`}
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden />
        Back to meeting
      </Link>

      <PageHeader
        title="Moderation queue"
        description={`${meeting.title} — approve what reaches the board, dismiss the rest. Approved questions appear in the live room immediately.`}
      />

      <div className="grid gap-5 xl:grid-cols-3">
        <section aria-labelledby="pending-heading" className="xl:col-span-2">
          <h2 id="pending-heading" className="flex items-center gap-2 text-[13px] font-semibold">
            <Headset className="h-4 w-4 text-brand" aria-hidden />
            Pending ({pending.length})
          </h2>
          {pending.length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-border bg-card px-4 py-8 text-center text-[13px] text-muted-foreground">
              Queue is clear. New shareholder questions will appear here in real time.
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {pending.map((q) => (
                <li key={q.id} className="rounded-lg border border-border bg-card p-4 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        {q.kind === "audio" ? <Mic className="h-5 w-5" aria-hidden /> : <MessageSquareText className="h-5 w-5" aria-hidden />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                          {q.participantName} · BO {q.boId} · {timeAgo(q.at)}
                        </p>
                        {q.kind === "text" ? (
                          <p className="mt-1 text-[13.5px] leading-snug">{q.body}</p>
                        ) : (
                          <div className="mt-1.5">
                            <audio controls preload="metadata" src={`/api/portal/audio/${q.audioId}`} className="h-9 w-full" aria-label={`Audio question from ${q.participantName}`} />
                            <p className="mt-0.5 text-[10.5px] text-muted-foreground">{q.durationSec ?? 0}s recorded</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <ModerationDecision meetingId={meeting.id} questionId={q.id} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside aria-labelledby="decided-heading">
          <h2 id="decided-heading" className="flex items-center gap-2 text-[13px] font-semibold text-muted-foreground">
            <ShieldCheck className="h-4 w-4" aria-hidden />
            Recently decided ({decided.length})
          </h2>
          <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-card shadow-card">
            {decided.length === 0 && <li className="px-4 py-6 text-center text-[12px] text-muted-foreground">Nothing decided yet</li>}
            {decided.map((q) => (
              <li key={q.id} className="flex items-center gap-2 px-4 py-2.5">
                {q.kind === "audio" ? <Mic className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden /> : <MessageSquareText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12px]">{q.kind === "text" ? q.body : "Audio question"}</p>
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{q.participantName} · {formatTime(q.at)}</p>
                </div>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${q.status === "approved" ? "border-success/30 bg-success-soft text-success" : "border-border bg-muted text-muted-foreground"}`}>{q.status}</span>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </>
  );
}
