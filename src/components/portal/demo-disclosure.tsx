"use client";
import { usePortalLanguage } from "@/components/portal/language-provider";
import { ChevronDown, Info } from "lucide-react";
export function DemoDisclosure() {
    const { t } = usePortalLanguage();
    return (<details className="group relative z-20 text-left">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-warning/20 bg-warning-soft px-2.5 py-1.5 text-[10px] font-semibold text-warning outline-none transition-colors duration-150 hover:border-warning/40 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <Info className="size-3" aria-hidden/>
        <span>{t("Demo")}<span className="hidden sm:inline">{" "}{t("workspace")}</span></span>
        <ChevronDown className="size-3 transition-transform duration-150 group-open:rotate-180" aria-hidden/>
      </summary>
      <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-4 shadow-overlay">
        <p className="text-xs font-semibold text-foreground">{t("About this demo")}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("Companies, holders and meetings are fictional. Changes reset when the server restarts.")}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("Your current holdings and meeting record-date voting entitlement may differ. Eligibility is checked on the server.")}</p>
      </div>
    </details>);
}
