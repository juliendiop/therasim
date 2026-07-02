import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import { getLiveResults, roleCanManageLive } from "@/lib/live";

export const dynamic = "force-dynamic";

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// GET /api/live/{id}/export — export CSV des résultats individuels (réservé au formateur).
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user || !roleCanManageLive(user.role)) {
    return NextResponse.json({ error: "non autorisé" }, { status: 403 });
  }
  const session = await prisma.liveSession.findUnique({ where: { id } });
  if (!session || session.tenantId !== user.tenantId) {
    return NextResponse.json({ error: "introuvable" }, { status: 404 });
  }

  const results = await getLiveResults(id);
  const rows = [
    ["Prénom", "Nom", "Réponses", "Total", "Score (%)", "Terminé"],
    ...(results?.individuels ?? []).map((p) => [
      p.prenom,
      p.nom,
      p.repondu,
      p.total,
      p.score === null ? "" : Math.round(p.score * 100),
      p.finished ? "oui" : "non",
    ]),
  ];
  const csv = "﻿" + rows.map((r) => r.map(csvCell).join(";")).join("\r\n");

  const filename = `resultats-${(session.titre || "session").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
