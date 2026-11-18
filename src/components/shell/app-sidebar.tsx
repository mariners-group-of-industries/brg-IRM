"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { ChevronsLeft, ChevronsRight, Landmark, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import { hasPermission, type RoleName } from "@/lib/permissions";
import { NAV_GROUPS } from "./nav";

const STORAGE_KEY = "irm.sidebar.collapsed";

/* Tiny external store so localStorage-backed collapse state is read with
   useSyncExternalStore — no setState-in-effect, no hydration mismatch. */
let collapsedCache: boolean | null = null;
const listeners = new Set<() => void>();
function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}
function getSnapshot() {
  if (collapsedCache === null) {
    try {
      collapsedCache = window.localStorage.getItem(STORAGE_KEY) === "1";
    } catch {
      collapsedCache = false;
    }
  }
  return collapsedCache;
}
const getServerSnapshot = () => false;
function writeCollapsed(value: boolean) {
  collapsedCache = value;
  try {
    window.localStorage.setItem(STORAGE_KEY, value ? "1" : "0");
  } catch {
    /* private mode */
  }
  listeners.forEach((listener) => listener());
}

export function SidebarNav({
  role,
  onNavigate,
}: {
  role: RoleName;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav aria-label="Primary" className="flex-1 overflow-y-auto px-3 pb-4">
      {NAV_GROUPS.map((group) => {
        const items = group.items.filter(
          (item) => !item.permission || hasPermission(role, item.permission),
        );
        if (items.length === 0) return null;
        return (
          <div key={group.label} className="mt-5 first:mt-2">
            <p className="group-data-[collapsed=true]:hidden px-2 pb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/80">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {items.map((item) => {
                const active =
                  pathname === item.href || pathname.startsWith(item.href + "/");
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? "page" : undefined}
                      title={item.label}
                      className={cn(
                        "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium text-sidebar-foreground transition-all duration-150 outline-none",
                        "hover:bg-sidebar-accent/80 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                        active &&
                          "bg-sidebar-accent font-semibold text-foreground shadow-[inset_3px_0_0_0_var(--brand)]",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-[17px] w-[17px] shrink-0",
                          active ? "text-brand" : "text-muted-foreground",
                        )}
                        strokeWidth={1.75}
                        aria-hidden
                      />
                      <span className="truncate group-data-[collapsed=true]:hidden">
                        {item.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

export function BrandMark({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg group">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-brand-navy via-brand-navy to-brand text-white shadow-xs transition-transform duration-200 group-hover:scale-105">
        <Landmark className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
      </div>
      {!collapsed && (
        <div className="leading-tight">
          <p className="text-[13.5px] font-bold tracking-tight text-foreground">BRG1 IRM</p>
          <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-teal-600 dark:text-teal-400">
            Investor Relations
          </p>
        </div>
      )}
    </Link>
  );
}

/** Desktop sidebar — collapsible between 250px and an icon rail. */
export function AppSidebar({ role }: { role: RoleName }) {
  const collapsed = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const toggle = () => writeCollapsed(!collapsed);

  return (
    <aside
      data-collapsed={collapsed}
      className="group sticky top-0 hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar transition-[width] duration-200 ease-out md:flex"
      style={{ width: collapsed ? "4.25rem" : "15.5rem" }}
    >
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        <BrandMark collapsed={collapsed} />
      </div>

      <SidebarNav role={role} />

      <div className="border-t border-sidebar-border p-3">
        <div
          className={cn(
            "flex items-center gap-2 rounded-md border border-brand/25 bg-brand-soft px-2.5 py-2",
            collapsed && "justify-center border-0 bg-transparent px-0",
          )}
          title="Verified Corporate Governance Workspace — Companies Act 1994 & BSEC compliant"
        >
          <ShieldCheck className="h-4 w-4 shrink-0 text-brand" aria-hidden />
          {!collapsed && (
            <div className="min-w-0 leading-tight">
              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-brand">
                Verified Engine
              </p>
              <p className="truncate text-[11px] text-foreground/70">BSEC & RJSC Ready</p>
            </div>
          )}
        </div>
        <button
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
          className="mt-2 flex h-8 w-full items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" aria-hidden />
          ) : (
            <ChevronsLeft className="h-4 w-4" aria-hidden />
          )}
        </button>
      </div>
    </aside>
  );
}
