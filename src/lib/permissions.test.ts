import { describe, expect, it } from "vitest";
import {
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSIONS,
  hasPermission,
} from "./permissions";

describe("permission catalogue", () => {
  it("assigns only known permissions to roles", () => {
    const catalogue = new Set<string>(PERMISSIONS);
    for (const role of ROLES) {
      for (const permission of ROLE_PERMISSIONS[role]) {
        expect(catalogue.has(permission), `${role} → ${permission}`).toBe(true);
      }
    }
  });

  it("every role has at least one permission", () => {
    for (const role of ROLES) {
      expect(ROLE_PERMISSIONS[role].length).toBeGreaterThan(0);
    }
  });
});

describe("hasPermission", () => {
  it("super admin can do everything", () => {
    for (const permission of PERMISSIONS) {
      expect(hasPermission("Platform Super Admin", permission)).toBe(true);
    }
  });

  it("restricted viewer is read-only", () => {
    expect(hasPermission("Restricted Viewer", "dashboard.view")).toBe(true);
    expect(hasPermission("Restricted Viewer", "meetings.create")).toBe(false);
    expect(hasPermission("Restricted Viewer", "meetings.publish")).toBe(false);
    expect(hasPermission("Restricted Viewer", "users.manage")).toBe(false);
    expect(hasPermission("Restricted Viewer", "audit.view")).toBe(false);
  });

  it("company secretary can create and publish meetings but not manage roles", () => {
    expect(hasPermission("Company Secretary", "meetings.create")).toBe(true);
    expect(hasPermission("Company Secretary", "meetings.publish")).toBe(true);
    expect(hasPermission("Company Secretary", "roles.manage")).toBe(false);
  });

  it("scrutinizer can read audit but not act on approvals", () => {
    expect(hasPermission("Scrutinizer", "audit.view")).toBe(true);
    expect(hasPermission("Scrutinizer", "approvals.act")).toBe(false);
  });
});
