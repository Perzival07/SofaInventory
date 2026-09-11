import { NextResponse } from "next/server";
import { ensureTablesExist, isDbConfigured } from "@/lib/db";

export async function GET() {
  try {
    if (!isDbConfigured) {
      return NextResponse.json({
        status: "demo_mode",
        message: "POSTGRES_URL environment variable is not set. Running in in-memory demo mode.",
        instructions: "To persist to Vercel Postgres, connect your database in Vercel or add POSTGRES_URL to .env.local",
      });
    }

    await ensureTablesExist();
    return NextResponse.json({
      status: "connected",
      message: "Vercel Postgres (Neon) is connected and database schema verified.",
    });
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        message: error instanceof Error ? error.message : "Database initialization failed",
      },
      { status: 500 }
    );
  }
}
