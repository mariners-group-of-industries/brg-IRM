"use client";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createAuthorizationAction, decideAuthorizationAction } from "@/app/(app)/shareholders/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect, panelClass } from "./shared";

export function AuthorizationForm({ holderId, kind, meetings }: { holderId: string; kind: "individual" | "corporate"; meetings: { id: string; title: string }[] }) {
  const router = useRouter(); const [error, setError] = useState(""); const [pending, startTransition] = useTransition();
  function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = e.currentTarget; const data = Object.fromEntries(new FormData(form)); startTransition(async () => { const result = await createAuthorizationAction({ ...data, holderId, kind: kind === "corporate" ? "corporate" : "proxy" }); if (!result.ok) setError(result.error); else { form.reset(); setError(""); toast.success("Authorization submitted for review"); router.refresh(); } }); }
  return <section className={panelClass}><h2 className="mb-1 text-sm font-semibold">{kind === "corporate" ? "Appoint corporate representative" : "Record proxy appointment"}</h2><p className="mb-4 text-xs leading-5 text-muted-foreground">Record the signed instrument reference, then review the appointment in Proxies & representatives. This is an administrative record; new portal credentials and instrument uploads require the later identity/storage integration.</p>{!meetings.length ? <p className="text-xs text-muted-foreground">No open meetings for this company.</p> : <form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-3"><Field label="Meeting" htmlFor="auth-meeting"><NativeSelect id="auth-meeting" name="meetingId" required>{meetings.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}</NativeSelect></Field><Field label={kind === "corporate" ? "Representative name" : "Proxy name"} htmlFor="auth-name"><Input id="auth-name" name="name" required minLength={3} maxLength={120} /></Field><Field label="Signed instrument reference" htmlFor="auth-reference"><Input id="auth-reference" name="reference" required minLength={3} maxLength={100} /></Field></div>{error && <p role="alert" className="text-xs text-destructive">{error}</p>}<Button disabled={pending} type="submit">{pending ? "Submitting…" : "Submit for review"}</Button></form>}</section>;
}
export function AuthorizationDecision({ id, status }: { id: string; status: string }) {
  const router = useRouter(); const [reason, setReason] = useState(""); const [error, setError] = useState(""); const [pending, startTransition] = useTransition();
  function decide(next: "approved" | "rejected" | "revoked") { startTransition(async () => { const result = await decideAuthorizationAction(id, next, reason); if (!result.ok) setError(result.error); else { setError(""); toast.success(`Authorization ${next}`); router.refresh(); } }); }
  if (!["pending", "approved"].includes(status)) return null;
  return <div className="mt-3 space-y-2"><Input aria-label="Authorization review note" placeholder="Review note (at least 5 characters)" value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /><div className="flex gap-2">{status === "pending" ? <><Button size="sm" disabled={pending || reason.trim().length < 5} onClick={() => decide("approved")}>Approve</Button><Button size="sm" variant="destructive" disabled={pending || reason.trim().length < 5} onClick={() => decide("rejected")}>Reject</Button></> : <Button size="sm" variant="destructive" disabled={pending || reason.trim().length < 5} onClick={() => decide("revoked")}>Revoke appointment</Button>}</div>{error && <p role="alert" className="text-xs text-destructive">{error}</p>}</div>;
}
