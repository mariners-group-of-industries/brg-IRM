"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { recordHoldingAction } from "@/app/(app)/shareholders/actions";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, NativeSelect, panelClass } from "./shared";

export function HoldingForm({ holderId, companyId, shareClasses, recipients }: { holderId: string; companyId: string; shareClasses: string[]; recipients: { id: string; name: string }[] }) {
  const router = useRouter(); const [kind, setKind] = useState("allotment"); const [pending, startTransition] = useTransition(); const [error, setError] = useState("");
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = e.currentTarget; const input = { ...Object.fromEntries(new FormData(form)), holderId, companyId };
    startTransition(async () => { const result = await recordHoldingAction(input); if (!result.ok) setError(result.error); else { setError(""); form.reset(); setKind("allotment"); toast.success("Holding transaction recorded"); router.refresh(); } });
  }
  return <section className={panelClass}><h2 className="mb-1 text-sm font-semibold">Record allotment or transfer</h2><p className="mb-4 text-xs leading-5 text-muted-foreground">Entries are append-only. Transfers debit and credit the same share class together. Use the certificate / allotment instrument as the reference; duplicate references are rejected.</p><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
    <Field label="Transaction" htmlFor="holding-kind"><NativeSelect id="holding-kind" name="kind" value={kind} onChange={(e) => setKind(e.target.value)}><option value="allotment">New allotment</option><option value="transfer">Transfer out</option></NativeSelect></Field>
    <Field label="Share class" htmlFor="shareClass"><NativeSelect id="shareClass" name="shareClass">{shareClasses.map((s) => <option key={s}>{s}</option>)}</NativeSelect></Field>
    <Field label="Number of shares" htmlFor="shares"><Input id="shares" name="shares" type="number" min={1} step={1} max={Number.MAX_SAFE_INTEGER} required /></Field>
    {kind === "transfer" && <Field label="Receiving shareholder" htmlFor="recipientId"><NativeSelect id="recipientId" name="recipientId" required><option value="">Choose recipient</option>{recipients.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}</NativeSelect></Field>}
    <Field label="Effective date" htmlFor="effectiveDate"><Input id="effectiveDate" name="effectiveDate" type="date" required /></Field>
    <Field label="Certificate / transaction reference" htmlFor="reference"><Input id="reference" name="reference" required minLength={3} maxLength={100} /></Field>
    </div>{error && <p role="alert" className="text-xs text-destructive">{error}</p>}<Button type="submit" disabled={pending}>{pending ? "Recording…" : "Record transaction"}</Button></form></section>;
}
