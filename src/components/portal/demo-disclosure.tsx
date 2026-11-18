"use client";
import { usePortalLanguage } from "@/components/portal/language-provider";
import { ChevronDown, Info } from "lucide-react";
export function DemoDisclosure() {
    const { locale } = usePortalLanguage();
    return (<details className="group relative z-20 text-left">
      <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-full border border-brand/25 bg-brand-soft px-2.5 py-1.5 text-[10px] font-semibold text-brand outline-none transition-colors duration-150 hover:border-brand/40 focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <Info className="size-3" aria-hidden/>
        <span>{locale === "bn" ? "যাচাইকৃত পোর্টাল" : "Verified Portal"}</span>
        <ChevronDown className="size-3 transition-transform duration-150 group-open:rotate-180" aria-hidden/>
      </summary>
      <div className="absolute right-0 top-full mt-2 w-72 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card p-4 shadow-overlay">
        <p className="text-xs font-semibold text-foreground">{locale === "bn" ? "ভোটাধিকার ও রেকর্ড-তারিখ তথ্য" : "Entitlement & Record Date"}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{locale === "bn" ? "সভার যোগ্যতা কোম্পানির রেকর্ড তারিখের শেয়ার রেজিস্টার অনুযায়ী সার্ভার থেকে যাচাই করা হয়।" : "Meeting eligibility and voting weights are enforced server-side against your company's record-date register snapshot."}</p>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{locale === "bn" ? "প্রশ্ন মডারেটরের অনুমোদনের পর সভা কক্ষে প্রদর্শিত হয়।" : "Submitted questions appear in the meeting room after moderator review."}</p>
      </div>
    </details>);
}
