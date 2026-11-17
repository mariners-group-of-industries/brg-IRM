"use client";
import { usePortalLanguage } from "@/components/portal/language-provider";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { CheckCircle2, Loader2, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { registerForMeetingAction } from "@/app/portal/portal-actions";
export function RegisterButton({ meetingId, initiallyRegistered, closed, className, }: {
    meetingId: string;
    initiallyRegistered: boolean;
    closed: boolean;
    className?: string;
}) {
    const { t } = usePortalLanguage();
    const router = useRouter();
    const [registered, setRegistered] = useState(initiallyRegistered);
    const [pending, startTransition] = useTransition();
    if (closed) {
        return (<Button variant="outline" size="sm" disabled className={`h-9 w-full ${className ?? ""}`}>{t("Registration closed")}</Button>);
    }
    if (registered) {
        return (<div className="flex h-9 w-full items-center justify-center gap-2 rounded-md border border-success/30 bg-success-soft px-3 text-[12.5px] font-medium text-success">
        <CheckCircle2 className="h-4 w-4" aria-hidden/>{t("Registered \u2014 see you at the meeting")}</div>);
    }
    return (<Button size="sm" className={`h-9 w-full ${className ?? ""}`} disabled={pending} onClick={() => startTransition(async () => {
            const result = await registerForMeetingAction(meetingId);
            if (result.ok) {
                setRegistered(true);
                toast.success(t(result.already ? "You are already registered" : "Registration confirmed"));
                router.refresh();
            }
            else {
                toast.error(t(result.error ?? "Could not register"));
            }
        })}>
      {pending ? (<Loader2 className="h-4 w-4 animate-spin" aria-hidden/>) : (<UserCheck className="h-4 w-4" aria-hidden/>)}{t("Register for the meeting")}</Button>);
}
