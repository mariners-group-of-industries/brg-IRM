/**
 * IRM permission catalogue (Phase 3 foundation).
 *
 * Permissions are dot-scoped strings. Role names are never checked in
 * application logic — always ask for a permission instead.
 */

export const PERMISSIONS = [
  "dashboard.view",
  "activity.view",
  "companies.view",
  "companies.create",
  "companies.update",
  "investors.view",
  "shareholders.view",
  "shareholders.manage",
  "shareholders.import",
  "shareholders.pii.read",
  "shareholding.view",
  "shareholding.manage",
  "shareholders.authorizations.manage",
  "meetings.view",
  "meetings.create",
  "meetings.publish",
  "meetings.control",
  "notices.view",
  "notices.send",
  "documents.view",
  "documents.upload",
  "documents.publish",
  "communications.view",
  "approvals.view",
  "approvals.act",
  "support.view",
  "reports.view",
  "analytics.view",
  "audit.view",
  "users.view",
  "users.manage",
  "roles.manage",
  "settings.manage",
  "integrations.manage",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export const ROLES = [
  "Platform Super Admin",
  "Company Admin",
  "Company Secretary",
  "Meeting Chair / Host",
  "Board Member",
  "Moderator",
  "Scrutinizer",
  "Support Officer",
  "Restricted Viewer",
] as const;

export type RoleName = (typeof ROLES)[number];

const ALL = new Set<Permission>(PERMISSIONS);

const COMPANY_SCOPED: Permission[] = [
  "dashboard.view",
  "activity.view",
  "companies.view",
  "investors.view",
  "shareholders.view",
  "shareholding.view",
  "meetings.view",
  "notices.view",
  "documents.view",
  "communications.view",
  "reports.view",
  "analytics.view",
];

export const ROLE_PERMISSIONS: Record<RoleName, Permission[]> = {
  "Platform Super Admin": [...ALL],
  "Company Admin": [
    ...ALL,
  ].filter((p) => p !== "roles.manage" && p !== "integrations.manage") as Permission[],
  "Company Secretary": [
    ...COMPANY_SCOPED,
    "shareholders.manage",
    "shareholders.import",
    "shareholders.pii.read",
    "shareholding.manage",
    "shareholders.authorizations.manage",
    "companies.update",
    "meetings.create",
    "meetings.publish",
    "notices.send",
    "documents.upload",
    "documents.publish",
    "approvals.view",
    "approvals.act",
    "support.view",
    "audit.view",
    "users.view",
  ],
  "Meeting Chair / Host": [
    ...COMPANY_SCOPED,
    "meetings.control",
    "documents.upload",
    "support.view",
  ],
  "Board Member": [...COMPANY_SCOPED, "approvals.view", "approvals.act"],
  Moderator: [
    ...COMPANY_SCOPED,
    "meetings.control",
    "communications.view",
    "support.view",
  ],
  Scrutinizer: [...COMPANY_SCOPED, "reports.view", "audit.view"],
  "Support Officer": [
    "dashboard.view",
    "activity.view",
    "companies.view",
    "shareholders.view",
    "meetings.view",
    "support.view",
    "communications.view",
  ],
  "Restricted Viewer": [
    "dashboard.view",
    "activity.view",
    "companies.view",
    "meetings.view",
    "reports.view",
  ],
};

export function hasPermission(role: RoleName, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}
