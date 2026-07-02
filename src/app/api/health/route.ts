import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/health — diagnostic : connexion DB + variables d'environnement.
export async function GET() {
  const checks: Record<string, unknown> = {
    env: {
      DATABASE_URL: Boolean(process.env.DATABASE_URL),
      MISTRAL_API_KEY: Boolean(process.env.MISTRAL_API_KEY),
      ANTHROPIC_API_KEY: Boolean(process.env.ANTHROPIC_API_KEY),
    },
  };
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";
  } catch (err) {
    checks.database = "erreur";
    checks.databaseError = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ status: "degraded", ...checks }, { status: 503 });
  }
  return NextResponse.json({ status: "ok", ...checks });
}
