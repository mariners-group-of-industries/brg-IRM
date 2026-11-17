import { requirePermission } from "@/lib/require-permission";
import { notFound } from "next/navigation";
import { visibleCompanies } from "@/lib/registry-access";
import { auditRegistry, registry } from "@/lib/shareholder-store";
import { csvCell, holdingBalance, publicHolder } from "@/lib/shareholders";
export async function GET(request: Request) {
  const session = await requirePermission("shareholders.view");
  const companies = visibleCompanies(session); const names = Object.fromEntries(companies.map((c) => [c.id, c.name]));
  const params = new URL(request.url).searchParams;
  const company = params.get("company"); const kind = params.get("kind"); const status = params.get("status"); const query = (params.get("q") ?? "").toLowerCase();
  if (company && !companies.some((c) => c.id === company)) notFound();
  const holders = registry.holders.filter((h) => names[h.companyId]).map(publicHolder).filter((h) => (!company || h.companyId === company) && (!kind || h.kind === kind) && (!status || h.status === status) && `${h.name} ${h.boId} ${h.id}`.toLowerCase().includes(query));
  const rows = [["Legal name", "BO / Folio (masked)", "Company", "Type", "Shares", "Status"], ...holders.map((h) => [h.name, h.boId, names[h.companyId], h.kind, holdingBalance(registry.entries, h.id), h.status])];
  for (const companyId of new Set(holders.map((h) => h.companyId))) auditRegistry(registry, session.email, "shareholder.export.masked", `register:${holders.filter((h) => h.companyId === companyId).length} records`, companyId);
  return new Response(`\uFEFF${rows.map((r) => r.map(csvCell).join(",")).join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="shareholder-register-masked.csv"', "Cache-Control": "no-store" } });
}
