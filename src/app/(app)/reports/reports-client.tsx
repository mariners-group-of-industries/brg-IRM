"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Download, FileCheck2, FileSpreadsheet, FileText, Printer, Scale, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, NativeSelect } from "@/components/registry/shared";
import type { Company, CompanySettings, Meeting } from "@/lib/types";
import type { LiveAgendaState } from "@/lib/demo-store";
import { formatDate, formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface MeetingReportBundle {
  meeting: Meeting;
  company: Company;
  settings: CompanySettings;
  liveAgenda: LiveAgendaState[];
  registeredCount: number;
  attendedCount: number;
}

function downloadBlob(filename: string, content: string, mime = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function ReportsClient({
  bundles,
  canExportRegister,
  initialMeetingId,
}: {
  bundles: MeetingReportBundle[];
  canExportRegister: boolean;
  initialMeetingId?: string;
}) {
  const defaultBundle = bundles.find((b) => b.meeting.id === initialMeetingId) ?? bundles[0];
  const [selectedId, setSelectedId] = useState(defaultBundle?.meeting.id ?? "");

  const current = bundles.find((b) => b.meeting.id === selectedId) ?? bundles[0];

  const scrutinyRows = useMemo(() => {
    if (!current) return [];
    return current.meeting.agenda.map((item) => {
      const live = current.liveAgenda.find((a) => a.agendaId === item.id);
      const vFor = live?.for ?? 0;
      const vAgainst = live?.against ?? 0;
      const vAbstain = live?.abstain ?? 0;
      const validCast = vFor + vAgainst;
      const approvalPct = validCast > 0 ? (vFor / validCast) * 100 : 0;
      const threshold = item.kind === "special" ? 75 : 50;
      const outcome =
        item.status === "passed"
          ? "Passed"
          : item.status === "rejected"
            ? "Rejected"
            : validCast === 0
              ? "Pending votes"
              : approvalPct >= threshold
                ? "Carried"
                : "Defeated";

      return {
        item,
        vFor,
        vAgainst,
        vAbstain,
        totalVotes: live?.votes ?? 0,
        demands: live?.demands ?? 0,
        proposedBy: live?.proposedBy,
        secondedBy: live?.secondedBy,
        approvalPct,
        threshold,
        outcome,
      };
    });
  }, [current]);

  const formalMinutes = useMemo(() => {
    if (!current) return "";
    const { meeting, company, settings } = current;
    const turnoutPct = meeting.eligibleShareholders
      ? ((meeting.attended / meeting.eligibleShareholders) * 100).toFixed(2)
      : "0.00";
    const agendaLines = scrutinyRows
      .map((r) => {
        const prop = r.proposedBy ? `Proposed by ${r.proposedBy.name} (${r.proposedBy.boId})` : "Proposed by the Chair";
        const sec = r.secondedBy ? `Seconded by ${r.secondedBy.name} (${r.secondedBy.boId})` : "Seconded on record";
        return [
          `ITEM ${r.item.order}: ${r.item.title} [${r.item.kind.toUpperCase()} RESOLUTION]`,
          r.item.resolution ? `Resolution Ref: ${r.item.resolution}` : null,
          `Mover/Seconder: ${prop}; ${sec}.`,
          `Scrutinized Votes — For: ${formatNumber(r.vFor)} | Against: ${formatNumber(r.vAgainst)} | Abstain: ${formatNumber(r.vAbstain)} (${r.approvalPct.toFixed(2)}% valid approval; threshold >= ${r.threshold}%).`,
          `Result: RESOLVED (${r.outcome.toUpperCase()}).`,
        ]
          .filter(Boolean)
          .join("\n");
      })
      .join("\n\n");

    return [
      `MINUTES OF THE ${meeting.title.toUpperCase()}`,
      `${company.name} (Reg. No: ${company.registrationNo} · TIN: ${company.tin})`,
      `====================================================================`,
      `Financial Year : ${meeting.financialYear}`,
      `Date & Time    : ${formatDateTime(meeting.date)} (${meeting.timezone})`,
      `Venue / Mode   : ${meeting.venue} (${meeting.mode})`,
      `Record Date    : ${formatDate(meeting.recordDate)}`,
      `Attendance     : ${formatNumber(meeting.registered)} registered · ${formatNumber(meeting.attended)} attended (${turnoutPct}% of ${formatNumber(meeting.eligibleShareholders)} eligible)`,
      `Quorum Rule    : ${settings.quorumPercent}% shares & min ${settings.quorumMinMembers} members`,
      `Poll Demand    : ${meeting.pollDemandRule}`,
      ``,
      `PROCEEDINGS & RESOLUTIONS`,
      `-------------------------`,
      agendaLines || "No formal agenda items tabled yet.",
      ``,
      `CERTIFICATION`,
      `Signed: ${settings.signatoryName}, ${settings.signatoryTitle}`,
      `Corporate Seal Reference: ${settings.sealReference}`,
    ].join("\n");
  }, [current, scrutinyRows]);

  if (!current) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center text-xs text-muted-foreground">
        No meetings available in your authorized scope to generate reports.
      </div>
    );
  }

  function exportScrutinyCsv() {
    if (!current) return;
    const headers = ["Order", "Title", "Kind", "For", "Against", "Abstain", "Approval %", "Threshold %", "Poll Demands", "Outcome"];
    const rows = scrutinyRows.map((r) => [
      r.item.order,
      `"${r.item.title.replaceAll('"', '""')}"`,
      r.item.kind,
      r.vFor,
      r.vAgainst,
      r.vAbstain,
      r.approvalPct.toFixed(2),
      r.threshold,
      r.demands,
      r.outcome,
    ]);
    const csv = `\uFEFF${[headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n")}`;
    downloadBlob(`scrutiny-${current.meeting.id}.csv`, csv, "text/csv;charset=utf-8");
  }

  function exportAttendanceCsv() {
    if (!current) return;
    const m = current.meeting;
    const c = current.company;
    const rows = [
      ["Company", "Meeting", "Financial Year", "Record Date", "Eligible Shareholders", "Registered Count", "Attended Count", "Turnout %"],
      [
        `"${c.name}"`,
        `"${m.title}"`,
        m.financialYear,
        m.recordDate.slice(0, 10),
        m.eligibleShareholders,
        m.registered,
        m.attended,
        m.eligibleShareholders ? ((m.attended / m.eligibleShareholders) * 100).toFixed(2) : "0.00",
      ],
    ];
    const csv = `\uFEFF${rows.map((r) => r.join(",")).join("\r\n")}`;
    downloadBlob(`attendance-quorum-${m.id}.csv`, csv, "text/csv;charset=utf-8");
  }

  function exportRegulatorPack() {
    if (!current) return;
    const pack = [
      `REGULATOR FILING SUMMARY PACK (RJSC / BSEC / DSE)`,
      `Generated: ${new Date().toISOString()}`,
      `Company: ${current.company.name} · Reg: ${current.company.registrationNo} · Listed: ${current.company.listed ? "DSE/CSE" : "Private"}`,
      `Paid-up Capital: BDT ${current.company.paidUpCapital.toLocaleString("en-BD")}`,
      `Notice Published: ${current.meeting.noticePublished ? "YES" : "NO"}`,
      ``,
      formalMinutes,
    ].join("\n");
    downloadBlob(`rjsc-bsec-pack-${current.meeting.id}.txt`, pack);
  }

  return (
    <div className="space-y-6">
      {/* Controls Bar */}
      <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-card">
        <div className="min-w-[260px] flex-1">
          <Field label="Select AGM / EGM for certified scrutiny & minutes" htmlFor="report-meeting">
            <NativeSelect
              id="report-meeting"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
            >
              {bundles.map((b) => (
                <option key={b.meeting.id} value={b.meeting.id}>
                  {b.company.shortName} — {b.meeting.title} ({b.meeting.financialYear})
                </option>
              ))}
            </NativeSelect>
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportScrutinyCsv}>
            <FileSpreadsheet className="mr-1.5 h-4 w-4 text-brand" />
            Scrutiny CSV
          </Button>
          <Button variant="outline" size="sm" onClick={exportAttendanceCsv}>
            <FileCheck2 className="mr-1.5 h-4 w-4 text-brand" />
            Attendance CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => downloadBlob(`minutes-${current.meeting.id}.txt`, formalMinutes)}>
            <FileText className="mr-1.5 h-4 w-4 text-brand" />
            Minutes (.txt)
          </Button>
          <Button size="sm" onClick={exportRegulatorPack}>
            <Download className="mr-1.5 h-4 w-4" />
            RJSC/BSEC Pack
          </Button>
          {canExportRegister && (
            <Button
              nativeButton={false}
              variant="outline"
              size="sm"
              render={<a href={`/api/shareholders/export?company=${current.company.id}`} />}
            >
              <ShieldCheck className="mr-1.5 h-4 w-4 text-brand" />
              Register CSV
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      {/* Summary KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Eligible Shareholders</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{formatNumber(current.meeting.eligibleShareholders)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Record date {formatDate(current.meeting.recordDate)}</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Registered & Attended</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">
            {formatNumber(current.meeting.registered)} / {formatNumber(current.meeting.attended)}
          </p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {formatPercent(current.meeting.eligibleShareholders ? (current.meeting.attended / current.meeting.eligibleShareholders) * 100 : 0)} turnout
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Configured Quorum Rule</p>
          <p className="mt-2 text-2xl font-bold tabular-nums">{current.settings.quorumPercent}%</p>
          <p className="mt-1 text-[11px] text-muted-foreground">Min {current.settings.quorumMinMembers} members present</p>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">Signatory & Seal</p>
          <p className="mt-2 truncate text-base font-bold">{current.settings.signatoryName}</p>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">{current.settings.sealReference}</p>
        </div>
      </div>

      {/* Scrutiny Table */}
      <section className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Scale className="h-4 w-4 text-brand" />
            Resolution voting scrutiny & threshold verification
          </h2>
          <span className="text-[11px] text-muted-foreground">
            Ordinary ≥ 50% · Special ≥ 75% (Companies Act 1994)
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[54rem] text-left text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <th scope="col" className="px-4 py-2.5">#</th>
                <th scope="col" className="px-4 py-2.5">Agenda / Resolution</th>
                <th scope="col" className="px-4 py-2.5">Type</th>
                <th scope="col" className="px-4 py-2.5 text-right">For</th>
                <th scope="col" className="px-4 py-2.5 text-right">Against</th>
                <th scope="col" className="px-4 py-2.5 text-right">Abstain</th>
                <th scope="col" className="px-4 py-2.5 text-right">Approval %</th>
                <th scope="col" className="px-4 py-2.5 text-right">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {scrutinyRows.map((row) => (
                <tr key={row.item.id} className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-mono font-semibold">{row.item.order}</td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-foreground">{row.item.title}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {row.proposedBy ? `Proposed: ${row.proposedBy.name}` : "Tabled"}
                      {row.secondedBy ? ` · Seconded: ${row.secondedBy.name}` : ""}
                      {row.demands > 0 ? ` · Poll demands: ${row.demands}` : ""}
                    </p>
                  </td>
                  <td className="px-4 py-3 capitalize">{row.item.kind} (≥{row.threshold}%)</td>
                  <td className="px-4 py-3 text-right font-semibold tabular-nums text-success">{formatNumber(row.vFor)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-destructive">{formatNumber(row.vAgainst)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatNumber(row.vAbstain)}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold tabular-nums">
                    {row.approvalPct.toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10.5px] font-semibold",
                        row.outcome === "Carried" || row.outcome === "Passed"
                          ? "border-success/30 bg-success-soft text-success"
                          : row.outcome === "Defeated" || row.outcome === "Rejected"
                            ? "border-destructive/30 bg-danger-soft text-destructive"
                            : "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {(row.outcome === "Carried" || row.outcome === "Passed") && <CheckCircle2 className="h-3 w-3" />}
                      {row.outcome}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {scrutinyRows.length === 0 && (
            <p className="p-8 text-center text-xs text-muted-foreground">No agenda resolutions recorded for this meeting.</p>
          )}
        </div>
      </section>

      {/* Auto-generated Formal Minutes */}
      <section className="rounded-xl border border-border bg-card p-5 shadow-card">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Certified statutory minutes draft</h2>
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Auto-compiled from live ballot tallies, quorum rules and configured authorized signatories
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => downloadBlob(`minutes-${current.meeting.id}.txt`, formalMinutes)}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            Download minutes
          </Button>
        </div>
        <pre className="mt-3 max-h-[24rem] overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-muted/30 p-4 font-mono text-[11.5px] leading-relaxed text-foreground">
          {formalMinutes}
        </pre>
      </section>
    </div>
  );
}
