// Journal d'activité centralisé (super-admin). Vue unifiée dérivée des données
// existantes : essais (drills), sessions (mini-scènes / entretiens), mouvements
// de crédits et inscriptions. Chaque évènement porte l'email et la plateforme.
import "server-only";
import { prisma } from "./prisma";

export type ActivityType = "drill" | "miniscene" | "simulation" | "credit" | "signup";

export type ActivityEvent = {
  at: string; // ISO
  email: string;
  tenantId: string;
  tenantName: string;
  type: ActivityType;
  label: string;
  detail: string;
  value?: number; // crédits : delta signé
};

export type ActivityKpis = {
  total: number;
  activeUsers: number;
  drills: number;
  miniscenes: number;
  simulations: number;
  creditsConsumed: number;
};

export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  drill: "Exercice",
  miniscene: "Mini-scène",
  simulation: "Entretien simulé",
  credit: "Crédits",
  signup: "Inscription",
};

const CREDIT_REASON_LABEL: Record<string, string> = {
  welcome: "Pack de bienvenue",
  monthly: "Recharge mensuelle",
  consume_miniscene: "Mini-scène",
  consume_simulation: "Entretien",
  refund: "Remboursement",
  admin_grant: "Crédits offerts",
  purchase: "Achat",
};

export type ActivityFilters = {
  tenantId?: string;
  email?: string;
  type?: string;
  days: number;
  limit?: number;
};

export async function buildActivity(opts: ActivityFilters): Promise<{
  events: ActivityEvent[];
  kpis: ActivityKpis;
  totalMatched: number;
}> {
  const since = new Date(Date.now() - opts.days * 24 * 3600 * 1000);
  const limit = opts.limit ?? 250;
  const whereTenant = opts.tenantId ? { tenantId: opts.tenantId } : {};

  const [users, tenants, attempts, sims, ledger] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, tenantId: true, createdAt: true },
    }),
    prisma.tenant.findMany({ select: { id: true, nom: true } }),
    prisma.attempt.findMany({
      where: { source: "drill", createdAt: { gte: since }, ...whereTenant },
      select: {
        userId: true,
        tenantId: true,
        frameworkId: true,
        competencyId: true,
        score: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
    prisma.simSession.findMany({
      where: { createdAt: { gte: since }, ...whereTenant },
      select: {
        userId: true,
        tenantId: true,
        frameworkId: true,
        kind: true,
        statut: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
    prisma.creditLedger.findMany({
      where: { createdAt: { gte: since } },
      select: { userId: true, delta: true, reason: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const tenantNom = new Map(tenants.map((t) => [t.id, t.nom]));

  const events: ActivityEvent[] = [];
  const add = (
    userId: string | null,
    tenantId: string | null,
    at: Date,
    type: ActivityType,
    detail: string,
    value?: number,
  ) => {
    const u = userId ? userById.get(userId) : null;
    const tId = tenantId ?? u?.tenantId ?? "";
    events.push({
      at: at.toISOString(),
      email: u?.email ?? "—",
      tenantId: tId,
      tenantName: tenantNom.get(tId) ?? "—",
      type,
      label: ACTIVITY_TYPE_LABEL[type],
      detail,
      value,
    });
  };

  for (const a of attempts) {
    const score = Number.isFinite(a.score) ? Math.round(a.score * 100) : null;
    add(
      a.userId,
      a.tenantId,
      a.createdAt,
      "drill",
      `${a.frameworkId} · ${a.competencyId}${score === null ? "" : ` · ${score}%`}`,
    );
  }
  for (const s of sims) {
    add(
      s.userId,
      s.tenantId,
      s.createdAt,
      s.kind === "miniscene" ? "miniscene" : "simulation",
      `${s.frameworkId} · ${s.statut === "terminee" ? "terminé" : "en cours"}`,
    );
  }
  for (const l of ledger) {
    const u = userById.get(l.userId);
    // CreditLedger n'a pas de tenantId : on filtre via la plateforme de l'utilisateur.
    if (opts.tenantId && u?.tenantId !== opts.tenantId) continue;
    add(
      l.userId,
      u?.tenantId ?? null,
      l.createdAt,
      "credit",
      `${CREDIT_REASON_LABEL[l.reason] ?? l.reason} (${l.delta >= 0 ? "+" : ""}${l.delta})`,
      l.delta,
    );
  }
  for (const u of users) {
    if (u.createdAt < since) continue;
    if (opts.tenantId && u.tenantId !== opts.tenantId) continue;
    add(u.id, u.tenantId, u.createdAt, "signup", "Compte créé");
  }

  // Filtres email / type (en mémoire).
  let filtered = events;
  if (opts.email) {
    const q = opts.email.toLowerCase();
    filtered = filtered.filter((e) => e.email.toLowerCase().includes(q));
  }
  if (opts.type) filtered = filtered.filter((e) => e.type === opts.type);

  filtered.sort((a, b) => (a.at < b.at ? 1 : -1));

  const creditsConsumed = filtered
    .filter((e) => e.type === "credit" && (e.value ?? 0) < 0)
    .reduce((s, e) => s + Math.abs(e.value ?? 0), 0);

  const kpis: ActivityKpis = {
    total: filtered.length,
    activeUsers: new Set(filtered.map((e) => e.email)).size,
    drills: filtered.filter((e) => e.type === "drill").length,
    miniscenes: filtered.filter((e) => e.type === "miniscene").length,
    simulations: filtered.filter((e) => e.type === "simulation").length,
    creditsConsumed,
  };

  return { events: filtered.slice(0, limit), kpis, totalMatched: filtered.length };
}
