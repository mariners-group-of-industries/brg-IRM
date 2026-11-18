import { turnoverSeries, listMeetings, listCompanies } from "@/lib/demo-store";
import { requirePermission } from "@/lib/require-permission";
import { formatNumber, formatPercent } from "@/lib/format";
import { PageHeader } from "@/components/page-header";
import { TurnoutChart } from "@/components/charts/turnout-chart";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const session = await requirePermission("analytics.view");
  const companies = listCompanies();
  const visible = companies.filter(
    (c) => session?.role === "Platform Super Admin" || session?.companyIds.includes(c.id),
  );
  const completed = listMeetings().filter(
    (m) =>
      (session?.role === "Platform Super Admin" || visible.some((c) => c.id === m.companyId)) &&
      m.status === "completed",
  );

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Governance health across your portfolio — turnout, registration rates and meeting outcomes."
      />
      <div className="grid gap-5 xl:grid-cols-2">
        <section aria-labelledby="turnout-heading" className="rounded-lg border border-border bg-card p-4 shadow-card">
          <h2 id="turnout-heading" className="text-[13px] font-semibold">Turnout — last six meetings</h2>
          <div className="mt-3">
            <TurnoutChart data={turnoverSeries()} />
          </div>
        </section>

        <section aria-labelledby="completed-heading" className="rounded-lg border border-border bg-card shadow-card">
          <h2 id="completed-heading" className="border-b border-border px-4 py-3 text-[13px] font-semibold">
            Completed meetings
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[30rem] text-left text-[12px]">
              <thead>
                <tr className="text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
                  <th scope="col" className="px-4 py-2 font-semibold">Meeting</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Registered</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Attended</th>
                  <th scope="col" className="px-4 py-2 text-right font-semibold">Turnout</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {completed.map((meeting) => (
                  <tr key={meeting.id}>
                    <td className="px-4 py-2.5">
                      <span className="font-medium">{meeting.title}</span>
                      <span className="block text-[10.5px] text-muted-foreground">{meeting.financialYear}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(meeting.registered)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(meeting.attended)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {formatPercent((meeting.attended / meeting.eligibleShareholders) * 100)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
