import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { publicDrill } from "@/lib/drill-view";

export const dynamic = "force-dynamic";

// GET /api/drills/{id} — détail d'un drill (rappel, stimulus, options si reconnaissance).
// Les champs is_best/score/feedback des options ne sont JAMAIS exposés ici.
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const drill = await prisma.drill.findUnique({ where: { id } });
  if (!drill) return NextResponse.json({ error: "drill introuvable" }, { status: 404 });
  return NextResponse.json(publicDrill(drill));
}
