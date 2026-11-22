import { describe, it, expect, afterAll } from "vitest";
import { db } from "./db";

describe("Neon PostgreSQL connection", () => {
  afterAll(async () => {
    await db.$disconnect();
  });

  it("successfully connects to Neon Postgres and executes queries", async () => {
    // Test raw query
    const result = await db.$queryRaw<Array<{ now: Date; version: string }>>`
      SELECT NOW() as now, version() as version;
    `;

    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
    expect(result[0]?.version).toContain("PostgreSQL");

    // Test model queries
    const orgs = await db.organization.findMany({ take: 5 });
    expect(Array.isArray(orgs)).toBe(true);
  });
});
