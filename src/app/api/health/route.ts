import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  const start = performance.now();
  try {
    const result = await db.$queryRaw<Array<{ now: Date; version: string; current_database: string }>>`
      SELECT NOW() as now, version() as version, current_database() as current_database;
    `;
    const durationMs = Math.round(performance.now() - start);

    return NextResponse.json({
      status: "ok",
      database: "neon-postgres",
      connected: true,
      currentDatabase: result[0]?.current_database,
      version: result[0]?.version,
      timestamp: result[0]?.now,
      latencyMs: durationMs,
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        database: "neon-postgres",
        connected: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
