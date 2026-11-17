"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, NativeSelect, panelClass } from "./shared";
import { commitImportAction, previewImportAction } from "@/app/(app)/shareholders/actions";
import { CSV_HEADERS } from "@/lib/shareholders";

export function ImportRegister({ companies }: { companies: { id: string; name: string }[] }) {
  const router = useRouter(); const [company, setCompany] = useState(companies[0]?.id ?? "");
  const [source, setSource] = useState(""); const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<{ row: number; errors: string[] }[] | null>(null);
  const [error, setError] = useState(""); const [pending, startTransition] = useTransition();
  const errors = rows?.filter((r) => r.errors.length) ?? [];
  const template = `${CSV_HEADERS.join(",")}\r\nSample Holder,individual,0012345678901234,Abdul Karim,holder@example.com,01712345678,,Dhaka,Ordinary,1000,2026-11-01\r\n`;
  return <div className="space-y-4">
    <div className={`${panelClass} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-sm font-semibold">1. Prepare your register</h2><p className="mt-1 max-w-2xl text-xs leading-5 text-muted-foreground">Use UTF-8 CSV with the template headers. BO IDs stay as text to preserve leading zeros. All rows must pass validation; imports add new accounts and never overwrite existing records. Up to 1,000 rows / 1 MB.</p></div><Button variant="outline" render={<a href={`data:text/csv;charset=utf-8,${encodeURIComponent(template)}`} download="shareholder-register-template.csv" />}><Download />Download template</Button></div>
      <div className="grid max-w-2xl gap-4 sm:grid-cols-2"><Field label="Target company" htmlFor="import-company"><NativeSelect id="import-company" value={company} disabled={pending} onChange={(e) => { setCompany(e.target.value); setRows(null); }}>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
        <Field label="Register CSV" htmlFor="register-file"><input id="register-file" type="file" accept=".csv,text/csv" disabled={pending} className="block w-full text-xs file:mr-3 file:rounded file:border file:border-border file:bg-muted file:px-3 file:py-2" onChange={async (e) => { setRows(null); setError(""); setSource(""); const file = e.target.files?.[0]; if (!file) return; setFileName(file.name); if (file.size > 1_000_000) { setError("CSV must be under 1 MB"); return; } try { setSource(await file.text()); } catch { setError("Could not read the selected file"); } }} /></Field></div>
      <Button disabled={!source || !company || pending} onClick={() => startTransition(async () => { setError(""); const result = await previewImportAction(company, source); if (!result.ok) { setRows(null); setError(result.error); } else setRows(result.rows); })}><Upload />{pending ? "Checking…" : "Validate & preview"}</Button>
    </div>
    {error && <p role="alert" className="rounded-md border border-destructive/20 bg-danger-soft p-3 text-xs text-destructive">{error}</p>}
    {rows && <div className={`${panelClass} space-y-4`}><h2 className="text-sm font-semibold">2. Review import — {fileName}</h2><p className="text-xs text-muted-foreground">{rows.length} rows checked · {rows.length - errors.length} valid · {errors.length} rejected</p>
      {errors.length ? <><p role="alert" className="text-xs text-destructive">Correct the rows below in your CSV, then select the corrected file. No records have been imported.</p><ul className="max-h-72 space-y-2 overflow-y-auto text-xs">{errors.map((r) => <li key={r.row} className="rounded border border-destructive/20 p-2"><strong>CSV row {r.row}</strong>: {r.errors.join("; ")}</li>)}</ul></> : <p className="flex items-center gap-2 rounded-md bg-success-soft p-3 text-xs text-success"><CheckCircle2 className="size-4" />All records passed duplicate, identity, share-class and date validation.</p>}
      <Button disabled={!!errors.length || pending} onClick={() => startTransition(async () => { setError(""); const result = await commitImportAction(company, source); if (!result.ok) { setError(result.error); setRows(null); } else { toast.success(`${result.count} shareholders imported`); router.push(`/shareholders?company=${company}`); router.refresh(); } })}>{pending ? "Importing…" : `Import ${rows.length} shareholders`}</Button>
    </div>}
  </div>;
}
