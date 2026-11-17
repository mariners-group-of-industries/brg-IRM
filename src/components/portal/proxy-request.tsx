"use client";
import { usePortalLanguage } from "@/components/portal/language-provider";
import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { requestProxyAction, revokeOwnProxyAction } from "@/app/portal/account/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, NativeSelect } from "@/components/registry/shared";
export function ProxyRequest({ meetings }: {
    meetings: {
        id: string;
        title: string;
    }[];
}) {
    const { t } = usePortalLanguage();
    const router = useRouter();
    const [error, setError] = useState("");
    const [pending, startTransition] = useTransition();
    function submit(e: FormEvent<HTMLFormElement>) { e.preventDefault(); const form = e.currentTarget; const input = Object.fromEntries(new FormData(form)); startTransition(async () => { const result = await requestProxyAction(input); if (!result.ok)
        setError(result.error);
    else {
        setError("");
        form.reset();
        toast.success(t("Proxy request submitted for review"));
        router.refresh();
    } }); }
    if (!meetings.length)
        return <p className="text-xs text-muted-foreground">{t("No published open meetings are available for a new appointment.")}</p>;
    return <form onSubmit={submit} className="space-y-3"><div className="grid gap-3 sm:grid-cols-3"><Field label={t("Meeting")} htmlFor="proxy-meeting"><NativeSelect id="proxy-meeting" name="meetingId" required>{meetings.map((m) => <option key={m.id} value={m.id}>{t(m.title)}</option>)}</NativeSelect></Field><Field label={t("Proxy name")} htmlFor="proxy-name"><Input id="proxy-name" name="name" required minLength={3} maxLength={120}/></Field><Field label={t("Signed instrument reference")} htmlFor="proxy-reference"><Input id="proxy-reference" name="reference" required minLength={3} maxLength={100}/></Field></div>{error && <p role="alert" className="text-xs text-destructive">{t(error)}</p>}<Button type="submit" disabled={pending}>{pending ? t("Submitting\u2026") : t("Request appointment")}</Button></form>;
}
export function RevokeOwnProxy({ id }: {
    id: string;
}) {
    const { t } = usePortalLanguage();
    const router = useRouter();
    const [confirming, setConfirming] = useState(false);
    const [pending, startTransition] = useTransition();
    return <div className="mt-2 flex flex-wrap items-center gap-2">{!confirming ? <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>{t("Withdraw appointment")}</Button> : <><span className="text-xs">{t("Withdraw this appointment?")}</span><Button variant="destructive" size="sm" disabled={pending} onClick={() => startTransition(async () => { const result = await revokeOwnProxyAction(id); if (!result.ok)
        toast.error(t(result.error));
    else {
        toast.success(t("Appointment withdrawn"));
        router.refresh();
    } })}>{t("Confirm withdrawal")}</Button><Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>{t("Cancel")}</Button></>}</div>;
}
