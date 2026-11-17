"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, NativeSelect } from "./shared";
import { saveShareholderAction } from "@/app/(app)/shareholders/actions";
import type { Shareholder } from "@/lib/shareholders";

export function HolderForm({ companies, holder, onSaved }: { companies: { id: string; name: string }[]; holder?: Shareholder; onSaved?: () => void }) {
  const router = useRouter(); const [error, setError] = useState(""); const [pending, startTransition] = useTransition();
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); const data = Object.fromEntries(new FormData(e.currentTarget));
    startTransition(async () => { setError(""); const result = await saveShareholderAction({ ...data, companyId: holder?.companyId ?? data.companyId, boId: holder?.boId ?? data.boId, kind: holder?.kind ?? data.kind }, holder?.id);
      if (!result.ok) { setError(result.error); return; }
      toast.success(holder ? "Shareholder updated" : "Shareholder created"); onSaved?.(); router.push(`/shareholders/${result.id}`); router.refresh();
    });
  }
  return <form onSubmit={submit} className="space-y-4">
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Company *" htmlFor="companyId"><NativeSelect id="companyId" name="companyId" defaultValue={holder?.companyId ?? companies[0]?.id} disabled={!!holder} required>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
      <Field label="Holder type *" htmlFor="kind"><NativeSelect id="kind" name="kind" defaultValue={holder?.kind ?? "individual"} disabled={!!holder}><option value="individual">Individual</option><option value="corporate">Corporate / institutional</option></NativeSelect></Field>
      <Field label="Legal name *" htmlFor="name"><Input id="name" name="name" required minLength={3} maxLength={160} defaultValue={holder?.name} autoComplete="off" /></Field>
      <Field label="BO ID / Folio ID *" htmlFor="boId"><Input id="boId" name="boId" required minLength={6} maxLength={32} defaultValue={holder?.boId} disabled={!!holder} className="font-mono" placeholder="Preserve all leading zeros" /></Field>
      <Field label="Father / spouse name" htmlFor="fatherName"><Input id="fatherName" name="fatherName" maxLength={160} defaultValue={holder?.fatherName} /></Field>
      <Field label="TIN" htmlFor="tin"><Input id="tin" name="tin" maxLength={32} defaultValue={holder?.tin} /></Field>
      <Field label="Registered email" htmlFor="email"><Input id="email" name="email" type="email" defaultValue={holder?.email} /></Field>
      <Field label="Registered mobile" htmlFor="mobile"><Input id="mobile" name="mobile" type="tel" maxLength={24} defaultValue={holder?.mobile} /></Field>
      <Field label="Account status" htmlFor="status"><NativeSelect id="status" name="status" defaultValue={holder?.status ?? "active"}><option value="active">Active</option><option value="suspended">Suspended</option><option value="closed">Closed</option></NativeSelect></Field>
    </div>
    <Field label="Registered address" htmlFor="address"><Textarea id="address" name="address" maxLength={300} defaultValue={holder?.address} /></Field>
    <p className="text-xs leading-5 text-muted-foreground">The legal holder is separate from the investor CRM. New accounts start with zero shares; record an allotment from the holder profile. BO / folio IDs cannot be changed after creation.</p>
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
    <Button type="submit" disabled={pending || !companies.length}>{pending ? "Saving…" : holder ? "Save changes" : "Create shareholder"}</Button>
  </form>;
}
