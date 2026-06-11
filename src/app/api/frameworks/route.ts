import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/frameworks — catalogue des référentiels publiés (spec §6).
export async function GET() {
  const frameworks = await prisma.framework.findMany({
    where: { statut: "publie" },
    orderBy: { nom: "asc" },
  });
  return NextResponse.json({ frameworks });
}
