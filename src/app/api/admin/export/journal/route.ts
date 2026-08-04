// GET /api/admin/export/journal — export CSV du journal d'activité, filtrable
// par période et par utilisateur. Réservé au super-admin, tracé dans l'audit.
import { NextRequest, NextResponse } from "next/server";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { csvResponse } from "@/lib/csv";
import { buildActivity } from "@/lib/activity";

export const dynamic = "force-dynamic";

// Plafond volontairement bas : c'est un export ponctuel pour analyse, pas un flux.
// Au-delà, on demande de réduire la période plutôt que de paginer l'export.
const MAX_ROWS = 20_000;

const HEADER = [
  "horodatage",
  "identifiant utilisateur",
  "email",
  "type d'action",
  "référentiel",
  "niveau",
  "score",
  "crédits débités",
];

function parseDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const guard = await requireSuperAdminApi();
  if ("response" in guard) return guard.response;
  const admin = guard.user;

  const sp = req.nextUrl.searchParams;
  const from = parseDate(sp.get("from"));
  const to = parseDate(sp.get("to"));
  const userId = sp.get("userId") || undefined;
  const email = sp.get("email") || undefined;

  if (!from || !to) {
    return NextResponse.json(
      { error: "paramètres 'from' et 'to' requis (ISO 8601)" },
      { status: 400 },
    );
  }

  const { events, totalMatched } = await buildActivity({
    from,
    to,
    userId,
    email,
    limit: MAX_ROWS + 1, // +1 pour détecter le dépassement sans le masquer
  });

  if (totalMatched > MAX_ROWS) {
    return NextResponse.json(
      {
        error: `La période demandée contient ${totalMatched} évènements, au-delà du plafond d'export (${MAX_ROWS}). Réduisez la période ou filtrez par utilisateur.`,
      },
      { status: 413 },
    );
  }

  const rows: (string | number)[][] = [HEADER];
  for (const e of events) {
    rows.push([
      e.at,
      e.userId ?? "",
      e.email,
      e.label,
      e.frameworkId ?? "",
      e.level ?? "",
      e.score ?? "",
      e.creditsDebited ?? "",
    ]);
  }

  await logAudit({
    action: "export_journal",
    email: admin.email,
    userId: admin.id,
    tenantId: null,
    meta: {
      rows: rows.length - 1,
      filters: { from: from.toISOString(), to: to.toISOString(), userId: userId ?? null, email: email ?? null },
    },
  });

  return csvResponse(rows, "journal.csv");
}
