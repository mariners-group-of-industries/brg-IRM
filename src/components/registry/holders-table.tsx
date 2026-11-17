"use client";
import { useState } from "react";
import Link from "next/link";
import { ArrowDownUp, Download, Search, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect, RegistryStatus } from "./shared";
import type { Shareholder } from "@/lib/shareholders";

export function HoldersTable({ holders, companies, initialCompany = "" }: { holders: (Shareholder & { shares: number })[]; companies: { id: string; name: string }[]; initialCompany?: string }) {
  const [query, setQuery] = useState(""); const [company, setCompany] = useState(initialCompany);
  const [kind, setKind] = useState(""); const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"name" | "shares">("name"); const [descending, setDescending] = useState(false);
  const [page, setPage] = useState(0);
  const names = Object.fromEntries(companies.map((c) => [c.id, c.name]));
  const filtered = holders.filter((h) => (!company || h.companyId === company) && (!kind || h.kind === kind) && (!status || h.status === status) && `${h.name} ${h.boId} ${h.id}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => (sort === "name" ? a.name.localeCompare(b.name) : a.shares - b.shares) * (descending ? -1 : 1));
  const pages = Math.max(1, Math.ceil(filtered.length / 10)); const current = Math.min(page, pages - 1);
  const exportParams = new URLSearchParams({ company, kind, status, q: query });
  function changeSort(key: typeof sort) { setSort(key); setDescending(sort === key ? !descending : false); }
  return <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
    <div className="grid gap-2 border-b border-border p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1.3fr_1fr_1fr_auto]">
      <div className="relative"><Search className="absolute top-2.5 left-3 size-4 text-muted-foreground" aria-hidden /><Input aria-label="Search shareholders" className="h-9 pl-9" placeholder="Search name or last four BO digits…" value={query} onChange={(e) => { setQuery(e.target.value); setPage(0); }} /></div>
      <NativeSelect aria-label="Filter company" value={company} onChange={(e) => { setCompany(e.target.value); setPage(0); }}><option value="">All authorized companies</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect>
      <NativeSelect aria-label="Filter holder type" value={kind} onChange={(e) => { setKind(e.target.value); setPage(0); }}><option value="">All holder types</option><option value="individual">Individual</option><option value="corporate">Corporate</option></NativeSelect>
      <NativeSelect aria-label="Filter status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }}><option value="">All statuses</option><option value="active">Active</option><option value="suspended">Suspended</option><option value="closed">Closed</option></NativeSelect>
      <Button variant="outline" className="h-9" render={<a href={`/api/shareholders/export?${exportParams}`} />}><Download className="size-4" />Export masked CSV</Button>
    </div>
    <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs"><thead className="border-b border-border bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground"><tr>
      <th scope="col" className="px-4 py-3" aria-sort={sort === "name" ? descending ? "descending" : "ascending" : "none"}><button onClick={() => changeSort("name")} className="flex items-center gap-1">Legal holder <ArrowDownUp className="size-3" /></button></th><th scope="col">BO / Folio (masked)</th><th scope="col">Company</th><th scope="col">Type</th><th scope="col" aria-sort={sort === "shares" ? descending ? "descending" : "ascending" : "none"}><button onClick={() => changeSort("shares")} className="flex items-center gap-1">Shares <ArrowDownUp className="size-3" /></button></th><th scope="col">Status</th>
    </tr></thead><tbody className="divide-y divide-border">{filtered.slice(current * 10, current * 10 + 10).map((h) => <tr key={h.id} className="hover:bg-muted/30"><td className="px-4 py-3"><Link href={`/shareholders/${h.id}`} className="font-medium text-brand hover:underline">{h.name}</Link></td><td className="font-mono">{h.boId}</td><td className="max-w-44 pr-4">{names[h.companyId]}</td><td className="capitalize">{h.kind}</td><td className="tabular-nums">{h.shares.toLocaleString("en-BD")}</td><td className="pr-4"><RegistryStatus status={h.status} /></td></tr>)}</tbody></table></div>
    {!filtered.length && <div className="py-14 text-center"><Users className="mx-auto mb-2 size-7 text-muted-foreground" /><p className="text-sm font-medium">No shareholders found</p><p className="mt-1 text-xs text-muted-foreground">Adjust the filters or add a holder to start the register.</p></div>}
    <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground"><span>{filtered.length ? `${current * 10 + 1}–${Math.min((current + 1) * 10, filtered.length)} of ${filtered.length}` : "0 records"}</span><div className="flex items-center gap-3"><Button variant="outline" size="sm" disabled={!current} onClick={() => setPage(current - 1)}>Previous</Button><span>{current + 1} / {pages}</span><Button variant="outline" size="sm" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>Next</Button></div></div>
  </div>;
}
