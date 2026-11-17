"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { CompanySwitcher } from "./company-switcher";
import { CommandPalette } from "./command-palette";
import { NotificationsMenu } from "./notifications";
import { UserMenu } from "./user-menu";
import { BrandMark, SidebarNav } from "./app-sidebar";
import type { AppNotification, Company, Meeting } from "@/lib/types";
import type { SessionUser } from "@/lib/session";

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  activity: "Activity Center",
  companies: "Companies",
  investors: "Investors",
  shareholders: "Shareholders",
  shareholding: "Shareholding",
  import: "Import register",
  authorizations: "Proxies & representatives",
  governance: "Corporate Governance",
  meetings: "AGM / EGM",
  new: "Create meeting",
  notices: "Notices",
  documents: "Documents",
  operations: "Operations",
  communications: "Communications",
  approvals: "Approvals",
  support: "Investor Support",
  reports: "Reports",
  analytics: "Analytics",
  audit: "Audit Logs",
  system: "System",
  users: "Users & Roles",
  settings: "Settings",
  integrations: "Integrations",
};

function useBreadcrumbs() {
  const pathname = usePathname();
  const parts = pathname.split("/").filter(Boolean);
  const crumbs: { label: string; href: string }[] = [];
  let href = "";
  for (const part of parts) {
    href += `/${part}`;
    // Meeting ids are not human-readable; render as "Meeting".
    const label = part === "new" && parts[0] === "shareholders" ? "Add shareholder" : SEGMENT_LABELS[part] ?? (part.startsWith("sh_") ? "Holder profile" : part.startsWith("mtg_") ? "Overview" : decodeURIComponent(part));
    crumbs.push({ label, href });
  }
  return crumbs;
}

export function AppHeader({
  user,
  companies,
  activeCompanyId,
  meetings,
  notifications,
}: {
  user: SessionUser;
  companies: Company[];
  activeCompanyId: string;
  meetings: Meeting[];
  notifications: AppNotification[];
}) {
  const crumbs = useBreadcrumbs();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur-sm sm:px-5">
      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetTrigger
          aria-label="Open navigation"
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </SheetTrigger>
        <SheetContent side="left" className="flex w-[17rem] flex-col p-0">
          <SheetTitle className="flex h-14 items-center border-b border-border px-4">
            <BrandMark />
          </SheetTitle>
          <SidebarNav role={user.role} onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Breadcrumbs */}
      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1.5 text-[12.5px] text-muted-foreground lg:flex">
        {crumbs.map((crumb, i) => (
          <span key={crumb.href} className="flex min-w-0 items-center gap-1.5">
            {i > 0 && <span aria-hidden className="text-border">/</span>}
            <span
              aria-current={i === crumbs.length - 1 ? "page" : undefined}
              className={
                i === crumbs.length - 1
                  ? "max-w-48 truncate font-medium text-foreground"
                  : "max-w-36 truncate hover:text-foreground"
              }
            >
              {crumb.label}
            </span>
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        <CompanySwitcher companies={companies} activeId={activeCompanyId} />
        <CommandPalette role={user.role} companies={companies} meetings={meetings} />
        <NotificationsMenu notifications={notifications} />
        <div className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden />
        <UserMenu name={user.name} email={user.email} role={user.role} />
      </div>
    </header>
  );
}
