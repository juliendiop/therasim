// Enregistrement d'un essai et mise à jour temps réel de la carte (spec §5.5).
// Deux producteurs (drill, simulation) écrivent dans la même table `attempts`,
// qui alimente `user_competency_state`. Source de vérité unique.

import { prisma } from "./prisma";
import { isMilestone, palier, updateMastery, type Palier } from "./mastery";
import type { Prisma } from "@prisma/client";

export type RecordAttemptInput = {
  userId: string;
  tenantId: string;
  frameworkId: string;
  competencyId: string;
  source: "drill" | "simulation";
  sourceRef?: string | null;
  score: number; // déjà normalisé dans [0,1]
  raw?: Prisma.InputJsonValue;
};

export type RecordAttemptResult = {
  state: Prisma.UserCompetencyStateGetPayload<object>;
  palierBefore: Palier;
  palierAfter: Palier;
  milestone: boolean;
};

export async function recordAttempt(input: RecordAttemptInput): Promise<{
  state: Prisma.UserCompetencyStateGetPayload<object>;
  palierBefore: Palier;
  palierAfter: Palier;
  milestone: boolean;
}> {
  const { userId, tenantId, frameworkId, competencyId, source, sourceRef, score, raw } =
    input;

  // 1) Journaliser l'essai.
  await prisma.attempt.create({
    data: {
      userId,
      tenantId,
      frameworkId,
      competencyId,
      source,
      sourceRef: sourceRef ?? null,
      score,
      raw: raw ?? undefined,
    },
  });

  // 2) Recalculer l'état de maîtrise (moyenne mobile pondérée récence).
  const prev = await prisma.userCompetencyState.findUnique({
    where: {
      userId_frameworkId_competencyId: { userId, frameworkId, competencyId },
    },
  });

  const newMastery = updateMastery(prev?.mastery ?? null, score);
  const now = new Date();
  const palierBefore = palier(prev?.mastery ?? null);
  const palierAfter = palier(newMastery);

  const state = await prisma.userCompetencyState.upsert({
    where: {
      userId_frameworkId_competencyId: { userId, frameworkId, competencyId },
    },
    update: {
      mastery: newMastery,
      attempts: { increment: 1 },
      lastPracticed: now,
    },
    create: {
      userId,
      tenantId,
      frameworkId,
      competencyId,
      mastery: newMastery,
      attempts: 1,
      lastPracticed: now,
    },
  });

  return {
    state,
    palierBefore,
    palierAfter,
    milestone: isMilestone(palierBefore, palierAfter),
  };
}
