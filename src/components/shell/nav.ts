import {
  Activity,
  Plug,
  Building2,
  CalendarDays,
  ClipboardCheck,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LifeBuoy,
  LineChart,
  ScrollText,
  Settings,
  ShieldCheck,
  Users,
  UsersRound,
  Wallet,
  PieChart,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import type { Permission } from "@/lib/permissions";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission?: Permission;
  ready: boolean; // false → renders a "Phase 2/3…" page (still a working route)
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, permission: "dashboard.view", ready: true },
      { label: "Activity Center", href: "/activity", icon: Activity, permission: "activity.view", ready: true },
    ],
  },
  {
    label: "Organization",
    items: [
      { label: "Companies", href: "/companies", icon: Building2, permission: "companies.view", ready: true },
      { label: "Investors", href: "/investors", icon: PieChart, permission: "investors.view", ready: false },
      { label: "Shareholders", href: "/shareholders", icon: Users, permission: "shareholders.view", ready: true },
      { label: "Shareholding", href: "/shareholding", icon: Wallet, permission: "shareholding.view", ready: true },
    ],
  },
  {
    label: "Corporate Governance",
    items: [
      { label: "AGM / EGM", href: "/governance/meetings", icon: CalendarDays, permission: "meetings.view", ready: true },
      { label: "Notices", href: "/governance/notices", icon: Megaphone, permission: "notices.view", ready: false },
      { label: "Documents", href: "/governance/documents", icon: FolderOpen, permission: "documents.view", ready: true },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Communications", href: "/operations/communications", icon: ScrollText, permission: "communications.view", ready: false },
      { label: "Approvals", href: "/operations/approvals", icon: ClipboardCheck, permission: "approvals.view", ready: true },
      { label: "Investor Support", href: "/operations/support", icon: LifeBuoy, permission: "support.view", ready: false },
    ],
  },
  {
    label: "Reports",
    items: [
      { label: "Reports", href: "/reports", icon: FileText, permission: "reports.view", ready: false },
      { label: "Analytics", href: "/reports/analytics", icon: LineChart, permission: "analytics.view", ready: true },
      { label: "Audit Logs", href: "/reports/audit", icon: ShieldCheck, permission: "audit.view", ready: true },
    ],
  },
  {
    label: "System",
    items: [
      { label: "Users & Roles", href: "/system/users", icon: UsersRound, permission: "users.view", ready: false },
      { label: "Settings", href: "/system/settings", icon: Settings, permission: "settings.manage", ready: false },
      { label: "Integrations", href: "/system/integrations", icon: Plug, permission: "integrations.manage", ready: false },
    ],
  },
];
