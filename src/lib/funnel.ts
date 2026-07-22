// Mesure de l'entonnoir d'acquisition (growth), first-party et sans donnée
// personnelle : on n'écrit qu'un identifiant visiteur anonyme (cookie ts_vid),
// jamais d'IP ni de user-agent. Source de vérité : la table funnel_events.
import "server-only";
import { cookies } from "next/headers";
import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";

const VISITOR_COOKIE = "ts_vid";

// Étapes de l'entonnoir, dans l'ordre. `anonymous: true` = acceptable via le
// beacon public /api/track ; les autres ne sont écrites QUE côté serveur (on ne
// veut pas qu'un client puisse gonfler une conversion depuis le navigateur).
export const FUNNEL_STEPS = [
  { event: "landing_view", label: "Visite de la landing", anonymous: true },
  { event: "demo_start", label: "Démo lancée", anonymous: true },
  { event: "signup_start", label: "Page d'inscription", anonymous: true },
  { event: "signup_complete", label: "Compte créé", anonymous: false },
  { event: "activation", label: "1er exercice fait", anonymous: false },
  { event: "checkout_start", label: "Paiement initié", anonymous: false },
  { event: "purchase", label: "Achat confirmé", anonymous: false },
] as const;

export type FunnelEventName = (typeof FUNNEL_STEPS)[number]["event"];

export const ANONYMOUS_EVENTS = new Set<string>(
  FUNNEL_STEPS.filter((s) => s.anonymous).map((s) => s.event),
);

/** Lit le cookie visiteur anonyme, le crée s'il n'existe pas. Renvoie l'id. */
export async function getOrSetVisitorId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(VISITOR_COOKIE)?.value;
  if (existing) return existing;
  const id = crypto.randomUUID();
  jar.set(VISITOR_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 an
  });
  return id;
}

/** Lit le cookie visiteur SANS le créer (contextes où on ne veut pas écrire de cookie). */
export async function peekVisitorId(): Promise<string | null> {
  return (await cookies()).get(VISITOR_COOKIE)?.value ?? null;
}

/**
 * Enregistre un événement d'entonnoir. Ne lève jamais : la mesure ne doit
 * jamais casser un parcours utilisateur (best-effort, erreurs avalées).
 */
export async function recordFunnel(
  event: FunnelEventName,
  opts: { visitorId?: string | null; userId?: string | null; path?: string; meta?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    const visitorId = opts.visitorId ?? (await peekVisitorId()) ?? `srv_${crypto.randomUUID()}`;
    await prisma.funnelEvent.create({
      data: {
        visitorId,
        userId: opts.userId ?? null,
        event,
        path: opts.path ?? null,
        meta: (opts.meta ?? undefined) as Prisma.InputJsonValue | undefined,
      },
    });
  } catch (e) {
    console.error("[funnel] échec enregistrement", event, e);
  }
}

/**
 * N'enregistre l'événement qu'une fois par utilisateur (ex. activation, purchase
 * unique dans l'entonnoir). Évite de compter plusieurs fois le même franchissement.
 */
export async function recordFunnelOncePerUser(
  event: FunnelEventName,
  userId: string,
  opts: { visitorId?: string | null; path?: string; meta?: Record<string, unknown> } = {},
): Promise<void> {
  try {
    const already = await prisma.funnelEvent.count({ where: { event, userId } });
    if (already > 0) return;
    await recordFunnel(event, { ...opts, userId });
  } catch (e) {
    console.error("[funnel] échec enregistrement (once)", event, e);
  }
}

export type FunnelSummaryStep = {
  event: FunnelEventName;
  label: string;
  count: number;
  /** Taux de conversion depuis l'étape précédente (null pour la 1re). */
  fromPrev: number | null;
};

/** Comptes par étape + taux de conversion étape → étape, sur une période. */
export async function funnelSummary(opts: { from: Date; to: Date }): Promise<{
  steps: FunnelSummaryStep[];
  total: number;
}> {
  const rows = await prisma.funnelEvent.groupBy({
    by: ["event"],
    where: { createdAt: { gte: opts.from, lte: opts.to } },
    _count: { _all: true },
  });
  const countByEvent = new Map<string, number>(rows.map((r) => [r.event, r._count._all]));

  let prevCount: number | null = null;
  const steps: FunnelSummaryStep[] = FUNNEL_STEPS.map((s) => {
    const count = countByEvent.get(s.event) ?? 0;
    const fromPrev = prevCount != null && prevCount > 0 ? count / prevCount : null;
    prevCount = count;
    return { event: s.event, label: s.label, count, fromPrev };
  });

  const total = countByEvent.get("landing_view") ?? 0;
  return { steps, total };
}
