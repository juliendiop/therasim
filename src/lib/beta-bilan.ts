// Bilan J+21, témoignages, et réglage des « améliorations » affichées dans l'email
// de bilan. Logique serveur ; les constantes pures vivent dans beta-bilan-constants.ts.
import "server-only";
import { prisma } from "./prisma";
import { getConfig, setConfig } from "./config";
import {
  BILAN_ANSWER_MAX,
  TESTIMONIAL_TEXT_MAX,
  isPromoterNps,
  isTestimonialDisplayMode,
} from "./beta-bilan-constants";

export {
  BILAN_QUESTIONS,
  BILAN_ANSWER_MAX,
  TESTIMONIAL_PROMPTS,
  TESTIMONIAL_DISPLAY_MODES,
  testimonialAttribution,
} from "./beta-bilan-constants";

// --- Améliorations (config admin, affichées dans l'email de bilan) -----------

const IMPROVEMENTS_KEY = "beta.improvements";

/** Liste des améliorations concrètes (une par ligne), saisies par l'admin. */
export async function getBetaImprovements(): Promise<string[]> {
  const raw = await getConfig(IMPROVEMENTS_KEY);
  if (!raw) return [];
  return raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
}

export async function setBetaImprovements(text: string): Promise<void> {
  await setConfig(IMPROVEMENTS_KEY, text.trim());
}

// --- Bilan -------------------------------------------------------------------

export type BilanInput = {
  q1: string;
  q2: string;
  q3: string;
  q4: string;
  nps: number;
  npsWhy: string;
};

export type SubmitBilanResult =
  | { ok: true; promoter: boolean }
  | { ok: false; message: string };

/**
 * Enregistre un bilan. Exige une note NPS valide (0-10) et au moins une réponse.
 * Retourne `promoter` (note ≥ 8) : l'appelant déclenche alors la relance témoignage.
 */
export async function submitBetaBilan(opts: {
  userId: string;
  tenantId: string;
  cohort: string | null;
  input: BilanInput;
}): Promise<SubmitBilanResult> {
  const q = [opts.input.q1, opts.input.q2, opts.input.q3, opts.input.q4].map((s) => s.trim());
  const npsWhy = opts.input.npsWhy.trim();
  const nps = opts.input.nps;

  if (!Number.isInteger(nps) || nps < 0 || nps > 10) {
    return { ok: false, message: "Indiquez une note de 0 à 10." };
  }
  if (q.every((a) => !a) && !npsWhy) {
    return { ok: false, message: "Répondez à au moins une question avant d'envoyer." };
  }
  if (q.some((a) => a.length > BILAN_ANSWER_MAX) || npsWhy.length > BILAN_ANSWER_MAX) {
    return { ok: false, message: "Une réponse dépasse la longueur autorisée." };
  }

  await prisma.betaBilan.create({
    data: {
      userId: opts.userId,
      tenantId: opts.tenantId,
      cohort: opts.cohort,
      q1: q[0],
      q2: q[1],
      q3: q[2],
      q4: q[3],
      nps,
      npsWhy,
    },
  });
  return { ok: true, promoter: isPromoterNps(nps) };
}

export type BilanRow = {
  id: string;
  email: string;
  cohort: string | null;
  q1: string;
  q2: string;
  q3: string;
  q4: string;
  nps: number;
  npsWhy: string;
  createdAt: Date;
};

/** Liste des bilans (backoffice), le plus récent d'abord, avec l'email de l'auteur. */
export async function listBetaBilan(take = 300): Promise<BilanRow[]> {
  const rows = await prisma.betaBilan.findMany({ orderBy: { createdAt: "desc" }, take });
  if (rows.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, email: true },
  });
  const emailById = new Map(users.map((u) => [u.id, u.email]));
  return rows.map((r) => ({
    id: r.id,
    email: emailById.get(r.userId) ?? "—",
    cohort: r.cohort,
    q1: r.q1,
    q2: r.q2,
    q3: r.q3,
    q4: r.q4,
    nps: r.nps,
    npsWhy: r.npsWhy,
    createdAt: r.createdAt,
  }));
}

// --- Témoignages -------------------------------------------------------------

export type TestimonialInput = {
  before: string;
  during: string;
  after: string;
  displayMode: string;
  profession: string;
};

export type SubmitTestimonialResult = { ok: true } | { ok: false; message: string };

/**
 * Enregistre un témoignage (statut `pending` : rien n'est public avant validation).
 * `firstName` est figé à la soumission pour l'affichage. La profession n'est retenue
 * que pour le mode « prénom et profession ».
 */
export async function submitTestimonial(opts: {
  userId: string;
  tenantId: string;
  firstName: string | null;
  input: TestimonialInput;
}): Promise<SubmitTestimonialResult> {
  const before = opts.input.before.trim();
  const during = opts.input.during.trim();
  const after = opts.input.after.trim();
  const profession = opts.input.profession.trim();

  if (!before && !during && !after) {
    return { ok: false, message: "Complétez au moins une des trois phrases." };
  }
  if ([before, during, after].some((t) => t.length > TESTIMONIAL_TEXT_MAX)) {
    return { ok: false, message: "Un passage dépasse la longueur autorisée." };
  }
  if (!isTestimonialDisplayMode(opts.input.displayMode)) {
    return { ok: false, message: "Choix d'affichage invalide." };
  }

  await prisma.testimonial.create({
    data: {
      userId: opts.userId,
      tenantId: opts.tenantId,
      beforeText: before,
      duringText: during,
      afterText: after,
      displayMode: opts.input.displayMode,
      firstName: opts.input.displayMode === "anonymous" ? null : opts.firstName,
      profession: opts.input.displayMode === "name_profession" ? profession || null : null,
      status: "pending",
    },
  });
  return { ok: true };
}

export type TestimonialRow = {
  id: string;
  email: string;
  beforeText: string;
  duringText: string;
  afterText: string;
  displayMode: string;
  firstName: string | null;
  profession: string | null;
  status: string;
  createdAt: Date;
};

/** Liste des témoignages pour le backoffice (statut optionnel), le plus récent d'abord. */
export async function listTestimonials(status?: string): Promise<TestimonialRow[]> {
  const rows = await prisma.testimonial.findMany({
    where: status ? { status } : {},
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  if (rows.length === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: rows.map((r) => r.userId) } },
    select: { id: true, email: true },
  });
  const emailById = new Map(users.map((u) => [u.id, u.email]));
  return rows.map((r) => ({
    id: r.id,
    email: emailById.get(r.userId) ?? "—",
    beforeText: r.beforeText,
    duringText: r.duringText,
    afterText: r.afterText,
    displayMode: r.displayMode,
    firstName: r.firstName,
    profession: r.profession,
    status: r.status,
    createdAt: r.createdAt,
  }));
}

export async function publishTestimonial(id: string): Promise<void> {
  await prisma.testimonial.update({
    where: { id },
    data: { status: "published", publishedAt: new Date() },
  });
}

export async function rejectTestimonial(id: string): Promise<void> {
  await prisma.testimonial.update({ where: { id }, data: { status: "rejected" } });
}

export type PublicTestimonial = {
  id: string;
  beforeText: string;
  duringText: string;
  afterText: string;
  displayMode: string;
  firstName: string | null;
  profession: string | null;
};

/** Témoignages publiés, pour l'affichage public. Vide = section masquée. */
export async function listPublishedTestimonials(take = 12): Promise<PublicTestimonial[]> {
  const rows = await prisma.testimonial.findMany({
    where: { status: "published" },
    orderBy: { publishedAt: "desc" },
    take,
  });
  return rows.map((r) => ({
    id: r.id,
    beforeText: r.beforeText,
    duringText: r.duringText,
    afterText: r.afterText,
    displayMode: r.displayMode,
    firstName: r.firstName,
    profession: r.profession,
  }));
}
