import Link from "next/link";
import type { ReactNode, SelectHTMLAttributes } from "react";

export const panelClass = "rounded-lg border border-border bg-card p-5 shadow-card";
export const cellClass = "px-4 py-3";
export function RegistryNotice() {
  return <p className="mb-5 rounded-md border border-brand/25 bg-brand-soft/40 px-4 py-3 text-xs leading-5 text-muted-foreground"><strong className="text-brand">Demo register.</strong> Fictional sample accounts, separate from portfolio headline totals. Changes, imports, authorizations and audit entries are held in memory and reset when the server restarts. Portal sign-in is available for the labelled demo identities.</p>;
}
export function RegistryNav({ shareholding = true }: { shareholding?: boolean }) {
  return <nav aria-label="Registry sections" className="mb-4 flex flex-wrap gap-4 border-b border-border pb-3 text-xs font-medium"><Link className="text-brand hover:underline" href="/shareholders">Legal register</Link>{shareholding && <Link className="text-brand hover:underline" href="/shareholding">Shareholding & ledger</Link>}<Link className="text-brand hover:underline" href="/shareholders/authorizations">Proxies & representatives</Link></nav>;
}
export function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return <div className="space-y-1.5"><label htmlFor={htmlFor} className="text-xs font-medium">{label}</label>{children}</div>;
}
export function NativeSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`h-9 w-full rounded-md border border-input bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 ${props.className ?? ""}`} />;
}
export function RegistryStatus({ status }: { status: string }) {
  return <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${["active", "approved"].includes(status) ? "border-success/20 bg-success-soft text-success" : ["pending", "suspended"].includes(status) ? "border-warning/20 bg-warning-soft text-warning" : "border-border bg-muted text-muted-foreground"}`}>{status}</span>;
}
export function Metrics({ items }: { items: { label: string; value: string | number; hint?: string }[] }) {
  return <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{items.map((item) => <div key={item.label} className="rounded-lg border border-border bg-card p-4 shadow-card"><p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{item.label}</p><p className="mt-2 text-xl font-semibold tabular-nums">{typeof item.value === "number" ? item.value.toLocaleString("en-BD") : item.value}</p>{item.hint && <p className="mt-1 text-[11px] text-muted-foreground">{item.hint}</p>}</div>)}</div>;
}
