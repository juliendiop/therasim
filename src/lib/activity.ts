// Journal d'activité centralisé (super-admin). Vue unifiée dérivée des données
// existantes : essais (drills), sessions (mini-scènes / entretiens), mouvements
// de crédits, inscriptions, déblocages de référentiel et évènements d'audit
// (connexions, invitations, abonnements). Chaque évènement porte l'email et la
// plateforme. AUCUNE écriture : tout est lu, rien n'est dérivé dans une table
// d'évènements dédiée (règle : on dérive ce qui est dérivable).
//
// ⚠️ CONTENU CLINIQUE — INTERDICTION EXPLICITE : ce module ne doit JAMAIS lire ni
// exposer SimMessage.content (transcript complet), SimSession.debrief/selfAssessment
// (citations, narrative) ni Attempt.raw (peut contenir une citation de la réponse
// de l'apprenant). Les `select` ci-dessous omettent ces champs délibérément — ne
// les ajoutez pas, même pour un besoin qui semblerait anodin : c'est précisément
// l'endroit où la tentation serait la plus naturelle. Voir aussi src/lib/user-stats.ts.
import "server-only";
import { prisma } from "./prisma";

export type ActivityType =
  | "drill"
  | "miniscene"
  | "simulation"
  | "credit"
  | "signup"
  | "login"
  | "invite"
  | "role"
  | "unlock"
  | "subscription";

export type ActivityEvent = {
  at: string; // ISO
  userId: string | null;
  email: string;
  tenantId: string;
  tenantName: string;
  type: ActivityType;
  label: string;
  detail: string;
  value?: number; // crédits : delta signé (affichage)
  frameworkId?: string | null;
  level?: "N1" | "N2" | "N3" | null; // N1=drill, N2=mini-scène, N3=simulation
  score?: number | null; // normalisé 0..1 — UNIQUEMENT pour les drills (jamais de texte)
  creditsDebited?: number | null; // débit positif — UNIQUEMENT pour type='credit'
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
  simulation: "Séance simulée",
  credit: "Crédits",
  signup: "Inscription",
  login: "Connexion",
  invite: "Invitation",
  role: "Rôle",
  unlock: "Déblocage",
  subscription: "Abonnement",
};

const CREDIT_REASON_LABEL: Record<string, string> = {
  welcome: "Pack de bienvenue",
  monthly: "Recharge mensuelle",
  consume_miniscene: "Mini-scène",
  consume_simulation: "Séance",
  refund: "Remboursement",
  admin_grant: "Crédits offerts",
  purchase: "Achat",
  subscription_renewal: "Abonnement",
  plan_upgrade_topup: "Complément changement de forfait",
  plan_expired: "Fin d'accès",
};

const UNLOCK_SOURCE_LABEL: Record<string, string> = {
  purchase: "achat à l'unité",
  admin: "offert (admin)",
  subscription_choice: "choix du forfait",
};

export type ActivityFilters = {
  tenantId?: string;
  email?: string;
  userId?: string;
  type?: string;
  /** Fenêtre glissante en jours, ignorée si `from`/`to` sont fournis (page admin). */
  days?: number;
  /** Plage explicite (export, plage personnalisée) — prend le pas sur `days`. */
  from?: Date;
  to?: Date;
  limit?: number;
};

export async function buildActivity(opts: ActivityFilters): Promise<{
  events: ActivityEvent[];
  kpis: ActivityKpis;
  totalMatched: number;
}> {
  const to = opts.to ?? new Date();
  const since = opts.from ?? new Date(to.getTime() - (opts.days ?? 30) * 24 * 3600 * 1000);
  const limit = opts.limit ?? 250;
  // Plafond par source (attempts/sims/ledger/unlocks/audits) : au moins 2000 pour
  // l'écran par défaut, mais JAMAIS moins que `limit` — sinon un export demandant
  // plus de lignes que ce plafond recevrait un résultat tronqué SANS le savoir
  // (totalMatched serait lui-même déjà faussé par la troncature en amont).
  const sourceTake = Math.max(limit, 2000);
  const whereTenant = opts.tenantId ? { tenantId: opts.tenantId } : {};
  const range = { gte: since, lte: to };

  const [users, tenants, attempts, sims, ledger, unlocks, audits] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, tenantId: true, createdAt: true },
    }),
    prisma.tenant.findMany({ select: { id: true, nom: true } }),
    prisma.attempt.findMany({
      where: { source: "drill", createdAt: range, ...whereTenant },
      select: {
        userId: true,
        tenantId: true,
        frameworkId: true,
        competencyId: true,
        score: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: sourceTake,
    }),
    prisma.simSession.findMany({
      where: { createdAt: range, ...whereTenant },
      // Ni `debrief` ni `selfAssessment` : voir l'avertissement en tête de fichier.
      select: {
        userId: true,
        tenantId: true,
        frameworkId: true,
        kind: true,
        statut: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: sourceTake,
    }),
    prisma.creditLedger.findMany({
      where: { createdAt: range },
      select: { userId: true, delta: true, reason: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: sourceTake,
    }),
    prisma.userFrameworkAccess.findMany({
      where: { createdAt: range },
      select: { userId: true, frameworkId: true, source: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: sourceTake,
    }),
    prisma.auditEvent.findMany({
      where: { createdAt: range, ...whereTenant },
      select: {
        userId: true,
        email: true,
        tenantId: true,
        action: true,
        meta: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
      take: sourceTake,
    }),
  ]);

  const userById = new Map(users.map((u) => [u.id, u]));
  const tenantNom = new Map(tenants.map((t) => [t.id, t.nom]));

  const events: ActivityEvent[] = [];
  const add = (e: {
    userId: string | null;
    tenantId: string | null;
    at: Date;
    type: ActivityType;
    detail: string;
    value?: number;
    frameworkId?: string | null;
    level?: "N1" | "N2" | "N3" | null;
    score?: number | null;
    creditsDebited?: number | null;
  }) => {
    const u = e.userId ? userById.get(e.userId) : null;
    const tId = e.tenantId ?? u?.tenantId ?? "";
    events.push({
      at: e.at.toISOString(),
      userId: e.userId,
      email: u?.email ?? "—",
      tenantId: tId,
      tenantName: tenantNom.get(tId) ?? "—",
      type: e.type,
      label: ACTIVITY_TYPE_LABEL[e.type],
      detail: e.detail,
      value: e.value,
      frameworkId: e.frameworkId ?? null,
      level: e.level ?? null,
      score: e.score ?? null,
      creditsDebited: e.creditsDebited ?? null,
    });
  };

  for (const a of attempts) {
    const score = Number.isFinite(a.score) ? Math.round(a.score * 100) : null;
    add({
      userId: a.userId,
      tenantId: a.tenantId,
      at: a.createdAt,
      type: "drill",
      detail: `${a.frameworkId} · ${a.competencyId}${score === null ? "" : ` · ${score}%`}`,
      frameworkId: a.frameworkId,
      level: "N1",
      score: Number.isFinite(a.score) ? a.score : null,
    });
  }
  for (const s of sims) {
    const level = s.kind === "miniscene" ? "N2" : "N3";
    add({
      userId: s.userId,
      tenantId: s.tenantId,
      at: s.createdAt,
      type: s.kind === "miniscene" ? "miniscene" : "simulation",
      detail: `${s.frameworkId} · ${s.statut === "terminee" ? "terminé" : "en cours"}`,
      frameworkId: s.frameworkId,
      level,
    });
  }
  for (const l of ledger) {
    const u = userById.get(l.userId);
    // CreditLedger n'a pas de tenantId : on filtre via la plateforme de l'utilisateur.
    if (opts.tenantId && u?.tenantId !== opts.tenantId) continue;
    add({
      userId: l.userId,
      tenantId: u?.tenantId ?? null,
      at: l.createdAt,
      type: "credit",
      detail: `${CREDIT_REASON_LABEL[l.reason] ?? l.reason} (${l.delta >= 0 ? "+" : ""}${l.delta})`,
      value: l.delta,
      creditsDebited: l.delta < 0 ? -l.delta : null,
    });
  }
  for (const u of users) {
    if (u.createdAt < since || u.createdAt > to) continue;
    if (opts.tenantId && u.tenantId !== opts.tenantId) continue;
    add({ userId: u.id, tenantId: u.tenantId, at: u.createdAt, type: "signup", detail: "Compte créé" });
  }
  for (const uf of unlocks) {
    const u = userById.get(uf.userId);
    if (opts.tenantId && u?.tenantId !== opts.tenantId) continue;
    add({
      userId: uf.userId,
      tenantId: u?.tenantId ?? null,
      at: uf.createdAt,
      type: "unlock",
      detail: `${uf.frameworkId} · ${UNLOCK_SOURCE_LABEL[uf.source] ?? uf.source}`,
      frameworkId: uf.frameworkId,
    });
  }

  for (const ev of audits) {
    const tId = ev.tenantId ?? "";
    const meta = (ev.meta ?? {}) as Record<string, unknown>;
    let type: ActivityType = "login";
    let detail = ev.action;
    if (ev.action === "login") {
      type = "login";
      detail = meta.method === "magic" ? "Lien magique" : "Mot de passe";
    } else if (ev.action === "invite") {
      type = "invite";
      detail = `→ ${String(meta.target ?? "?")}${
        meta.role ? ` (${String(meta.role)})` : ""
      }${meta.resend ? " · relance" : ""}`;
    } else if (ev.action === "role_change") {
      type = "role";
      detail = `${String(meta.target ?? "?")} → ${String(meta.role ?? "?")}`;
    } else if (ev.action === "member_removed") {
      type = "role";
      detail = `Retiré : ${String(meta.target ?? "?")}`;
    } else if (ev.action === "password_reset") {
      type = "login";
      detail = "Mot de passe réinitialisé";
    } else if (ev.action === "subscription_purchase") {
      type = "subscription";
      detail = "Achat confirmé";
    } else if (ev.action === "subscription_created") {
      type = "subscription";
      detail = `Abonnement démarré${meta.status ? ` (${String(meta.status)})` : ""}`;
    } else if (ev.action === "subscription_updated") {
      type = "subscription";
      detail = meta.planTo
        ? `Forfait changé`
        : `Statut : ${String(meta.statusFrom ?? "?")} → ${String(meta.statusTo ?? "?")}`;
    } else if (ev.action === "subscription_canceled") {
      type = "subscription";
      detail = "Abonnement résilié";
    }
    events.push({
      at: ev.createdAt.toISOString(),
      userId: ev.userId,
      email: ev.email,
      tenantId: tId,
      tenantName: tenantNom.get(tId) ?? "—",
      type,
      label: ACTIVITY_TYPE_LABEL[type],
      detail,
    });
  }

  // Filtres email / identifiant / type (en mémoire).
  let filtered = events;
  if (opts.userId) filtered = filtered.filter((e) => e.userId === opts.userId);
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
