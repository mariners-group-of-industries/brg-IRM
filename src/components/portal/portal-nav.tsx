"use client";

import { usePortalLanguage } from "@/components/portal/language-provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutDashboard, FileText, Bell } from "lucide-react";
import { cn } from "@/lib/utils";

const items = [
  { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
  { href: "/portal/meetings", label: "My meetings", icon: CalendarDays },
  { href: "/portal/documents", label: "Documents", icon: FileText },
  { href: "/portal/notifications", label: "Notifications", icon: Bell },
];

export function PortalNav({ className }: { className?: string }) {
  const { t } = usePortalLanguage();
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("Shareholder navigation")}
      className={cn(
        "flex items-center gap-1.5 overflow-x-auto py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden",
        className
      )}
    >
      {items.map(({ href, label, icon: Icon }) => {
        const active = href === "/portal" ? pathname === href : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex shrink-0 items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[#008F83]",
              active
                ? "bg-[#112B4E] text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-100/80"
            )}
          >
            <Icon className={cn("size-3.5", active ? "text-white" : "text-slate-500")} aria-hidden />
            <span>{t(label)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
