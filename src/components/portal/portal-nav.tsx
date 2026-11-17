"use client";
import { usePortalLanguage } from "@/components/portal/language-provider";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, LayoutDashboard, UserRound, FileText, Bell } from "lucide-react";
import { cn } from "@/lib/utils";
const items = [
    { href: "/portal", label: "Dashboard", icon: LayoutDashboard },
    { href: "/portal/meetings", label: "My meetings", icon: CalendarDays },
    { href: "/portal/account", label: "My account", icon: UserRound },
    { href: "/portal/documents", label: "Documents", icon: FileText },
    { href: "/portal/notifications", label: "Notifications", icon: Bell },
];
export function PortalNav() {
    const { t } = usePortalLanguage();
    const pathname = usePathname();
    return <nav aria-label={t("Shareholder navigation")} className="flex gap-1 overflow-x-auto">
    {items.map(({ href, label, icon: Icon }) => {
            const active = href === "/portal" ? pathname === href : pathname.startsWith(href);
            return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("inline-flex h-11 shrink-0 items-center gap-2 border-b-2 px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring", active ? "border-brand text-brand" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground")}>
        <Icon className="size-4" aria-hidden/>{t(label)}
      </Link>;
        })}
  </nav>;
}
