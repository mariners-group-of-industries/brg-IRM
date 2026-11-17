"use client";
import { usePortalLanguage } from "@/components/portal/language-provider";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { LogOut } from "lucide-react";
import { portalLogoutAction } from "@/app/portal/portal-actions";
export function PortalSignout() {
    const { t } = usePortalLanguage();
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    return (<button onClick={() => startTransition(async () => {
            await portalLogoutAction();
            router.replace("/portal/login");
            router.refresh();
        })} disabled={pending} aria-label={t("Sign out")} className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-2.5 text-[12.5px] font-medium text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50">
      <LogOut className="h-4 w-4" aria-hidden/>
      <span className="hidden sm:inline">{pending ? t("Signing out\u2026") : t("Sign out")}</span>
    </button>);
}
