"use client";
import { useState, useTransition } from "react";
import { Eye, EyeOff, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { revealShareholderAction } from "@/app/(app)/shareholders/actions";
import type { Shareholder } from "@/lib/shareholders";
import { HolderForm } from "./holder-form";
import { Field, panelClass } from "./shared";

export function HolderPrivate({ masked, canReveal, canEdit, companies }: { masked: Shareholder; canReveal: boolean; canEdit: boolean; companies: { id: string; name: string }[] }) {
  const [revealed, setRevealed] = useState<Shareholder | null>(null); const [reason, setReason] = useState("");
  const [error, setError] = useState(""); const [editing, setEditing] = useState(false); const [pending, startTransition] = useTransition();
  const holder = revealed ?? masked;
  return <section className={panelClass}><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><h2 className="text-sm font-semibold">Identity & registered contacts</h2>{revealed && <div className="flex gap-2">{canEdit && <Button size="sm" variant="outline" onClick={() => setEditing(true)}><Pencil />Edit record</Button>}<Button size="sm" variant="ghost" onClick={() => { setRevealed(null); setEditing(false); setReason(""); }}><EyeOff />Hide personal data</Button></div>}</div>
    <dl className="grid gap-4 text-xs sm:grid-cols-2">{[["BO / Folio ID", holder.boId], ["Father / spouse", holder.fatherName], ["Email", holder.email], ["Mobile", holder.mobile], ["TIN", holder.tin], ["Address", holder.address]].map(([label, value]) => <div key={label}><dt className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</dt><dd className="mt-1 break-all">{value || "—"}</dd></div>)}</dl>
    {!revealed && <div className="mt-5 border-t border-border pt-4">{canReveal ? <form onSubmit={(e) => { e.preventDefault(); startTransition(async () => { const result = await revealShareholderAction(masked.id, reason); if (result.ok) { setRevealed(result.holder); setError(""); } else setError(result.error); }); }} className="flex flex-wrap items-end gap-2"><div className="min-w-48 flex-1"><Field label="Reason for personal-data access (audited)" htmlFor="pii-reason"><Input id="pii-reason" value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} maxLength={200} required placeholder="For example: verify register correction" /></Field></div><Button type="submit" variant="outline" disabled={pending}><Eye />{pending ? "Opening…" : "Reveal / edit"}</Button></form> : <p className="text-xs text-muted-foreground">Personal data is masked. Your role does not allow unmasking.</p>}{error && <p role="alert" className="mt-2 text-xs text-destructive">{error}</p>}</div>}
    <Dialog open={editing} onOpenChange={setEditing}><DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl"><DialogHeader><DialogTitle>Edit legal register entry</DialogTitle></DialogHeader>{revealed && <HolderForm holder={revealed} companies={companies} onSaved={() => { setEditing(false); setRevealed(null); }} />}</DialogContent></Dialog>
  </section>;
}
