import { PrismaClient } from "@/generated/prisma/client";

declare global {
  var __irmPrismaClient: PrismaClient | undefined;
}

export const db =
  globalThis.__irmPrismaClient ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__irmPrismaClient = db;
}

export default db;
