// GET /api/admin/export/contacts — export CSV des comptes, avec segment calculé.
// Réservé au super-admin. Extraction de données personnelles : chaque appel est
// tracé dans le journal d'audit (qui, quand, combien de lignes, quels filtres).
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminApi } from "@/lib/admin-api";
import { logAudit } from "@/lib/audit";
import { csvResponse } from "@/lib/csv";
import { segmentSchema, SEGMENT_LABEL, type Segment } from "@/lib/segments";
import { buildUserStatsMap, computeSegmentsForUsers } from "@/lib/user-stats";

export const dynamic = "force-dynamic";

const HEADER = [
  "email",
  "prénom",
  "nom",
  "date d'inscription",
  "segment",
  "statut d'abonnement",
  "forfait",
  "date de fin d'accès",
  "crédits restants",
  "origine",
  "N3 terminés",
  "N2",
  "drills",
  "dernière activité",
  "jours depuis dernière activité",
  "référentiels travaillés",
  "référentiels débloqués",
  "entretien Découverte consommé",
  "NPS",
  "témoignage validé",
  "ambassadeur",
  "consentement marketing",
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
  const includeB2B = sp.get("includeB2B") === "1";
  const segmentFilter = segmentSchema.safeParse(sp.get("segment"));
  const signupFrom = parseDate(sp.get("signupFrom"));
  const signupTo = parseDate(sp.get("signupTo"));
  const activityFrom = parseDate(sp.get("activityFrom"));
  const activityTo = parseDate(sp.get("activityTo"));

  // Apprenants des tenants B2B (whitelabel) exclus par défaut : un élève inscrit
  // par une école est le contact de l'école, pas le nôtre.
  const tenants = await prisma.tenant.findMany({ select: { id: true, type: true } });
  const allowedTenantIds = includeB2B
    ? null
    : new Set(tenants.filter((t) => t.type === "public").map((t) => t.id));

  const users = await prisma.user.findMany({
    where: {
      ...(allowedTenantIds ? { tenantId: { in: Array.from(allowedTenantIds) } } : {}),
      ...(signupFrom || signupTo
        ? {
            createdAt: {
              ...(signupFrom ? { gte: signupFrom } : {}),
              ...(signupTo ? { lte: signupTo } : {}),
            },
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      firstName: true,
      tenantId: true,
      createdAt: true,
      credits: true,
      planCredits: true,
      discoveryInterviewUsedAt: true,
      ambassadorAt: true,
      marketingConsent: true,
    },
  });

  const userIds = users.map((u) => u.id);
  const [statsByUser, subs, plans, npsRows, testimonials] = await Promise.all([
    buildUserStatsMap(userIds),
    prisma.userSubscription.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, status: true, planId: true, currentPeriodEnd: true },
    }),
    prisma.subscriptionPlan.findMany({ select: { id: true, label: true } }),
    prisma.betaBilan.findMany({
      where: { userId: { in: userIds } },
      select: { userId: true, nps: true, createdAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.testimonial.findMany({
      where: { userId: { in: userIds }, status: "published" },
      select: { userId: true },
    }),
  ]);

  const subByUser = new Map(subs.map((s) => [s.userId, s]));
  const planLabel = new Map(plans.map((p) => [p.id, p.label]));
  const npsByUser = new Map<string, number>();
  for (const r of npsRows) if (!npsByUser.has(r.userId)) npsByUser.set(r.userId, r.nps); // le plus récent (tri desc)
  const publishedTestimonialUsers = new Set(testimonials.map((t) => t.userId));

  const segments = await computeSegmentsForUsers(
    users,
    new Map(subs.map((s) => [s.userId, { status: s.status }])),
    statsByUser,
  );

  const now = new Date();
  const DAY_MS = 24 * 60 * 60 * 1000;
  const rows: (string | number)[][] = [HEADER];

  for (const u of users) {
    const segment: Segment = segments.get(u.id) ?? "jamais_actif";
    if (segmentFilter.success && segment !== segmentFilter.data) continue;

    const stats = statsByUser.get(u.id);
    const lastActivityAt = stats?.lastActivityAt ?? null;
    if (activityFrom && (!lastActivityAt || lastActivityAt < activityFrom)) continue;
    if (activityTo && (!lastActivityAt || lastActivityAt > activityTo)) continue;

    const sub = subByUser.get(u.id);
    const daysSinceActivity = lastActivityAt
      ? Math.floor((now.getTime() - lastActivityAt.getTime()) / DAY_MS)
      : "";

    rows.push([
      u.email,
      u.firstName ?? "",
      "", // nom : aucun champ « nom de famille » dans le modèle actuel — voir résumé
      u.createdAt.toISOString(),
      SEGMENT_LABEL[segment],
      sub?.status ?? "",
      sub ? planLabel.get(sub.planId) ?? "" : "",
      sub?.currentPeriodEnd?.toISOString() ?? "",
      // Crédits réellement dépensables : portefeuille persistant + allocation de
      // la période en cours (voir prisma/schema.prisma, commentaires User.credits).
      u.credits + u.planCredits,
      stats?.isBetaOrigin ? "bêta" : "directe",
      stats?.n3Completed ?? 0,
      stats?.n2Completed ?? 0,
      stats?.drillsCount ?? 0,
      lastActivityAt ? lastActivityAt.toISOString() : "",
      daysSinceActivity,
      (stats?.frameworksWorked ?? []).join(", "),
      (stats?.frameworksUnlocked ?? []).join(", "),
      u.discoveryInterviewUsedAt ? "oui" : "non",
      npsByUser.get(u.id) ?? "",
      publishedTestimonialUsers.has(u.id) ? "oui" : "non",
      u.ambassadorAt ? "oui" : "non",
      u.marketingConsent === true ? "oui" : u.marketingConsent === false ? "non" : "",
    ]);
  }

  await logAudit({
    action: "export_contacts",
    email: admin.email,
    userId: admin.id,
    tenantId: null,
    meta: {
      rows: rows.length - 1,
      filters: {
        includeB2B,
        segment: segmentFilter.success ? segmentFilter.data : null,
        signupFrom: signupFrom?.toISOString() ?? null,
        signupTo: signupTo?.toISOString() ?? null,
        activityFrom: activityFrom?.toISOString() ?? null,
        activityTo: activityTo?.toISOString() ?? null,
      },
    },
  });

  return csvResponse(rows, "contacts.csv");
}
