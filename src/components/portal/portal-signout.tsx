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

  return (
    <button
      onClick={() =>
        startTransition(async () => {
          await portalLogoutAction();
          router.replace("/portal/login");
          router.refresh();
        })
      }
      disabled={pending}
      aria-label={t("Sign out")}
      className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200/90 px-2.5 text-xs font-semibold text-slate-600 outline-none transition-colors hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-[#008F83] disabled:opacity-50"
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden />
      <span className="hidden sm:inline">{pending ? t("Signing out…") : t("Sign out")}</span>
    </button>
  );
}
