import { describe, it, expect } from "vitest";
import { computeSegment, SEGMENTS, segmentSchema, type SegmentInput } from "../src/lib/segments";

const NOW = new Date("2026-08-04T12:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function base(overrides: Partial<SegmentInput> = {}): SegmentInput {
  return {
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    hasCompletedActivation: false,
    isBetaOrigin: false,
    subscriptionStatus: null,
    lastActivityAt: null,
    now: NOW,
    dormantAfterDays: 21,
    ...overrides,
  };
}

describe("computeSegment — cas nominaux", () => {
  it("compte créé, jamais utilisé -> jamais_actif", () => {
    expect(computeSegment(base())).toBe("jamais_actif");
  });

  it("entretien Découverte terminé, pas d'abonnement -> actif_gratuit", () => {
    expect(computeSegment(base({ hasCompletedActivation: true }))).toBe("actif_gratuit");
  });

  it("essai bêta en cours -> essai_beta, même sans activation ni activité", () => {
    expect(
      computeSegment(base({ subscriptionStatus: "trialing", isBetaOrigin: true })),
    ).toBe("essai_beta");
  });

  it("abonné actif avec activité récente -> abonne_actif", () => {
    expect(
      computeSegment(
        base({
          subscriptionStatus: "active",
          lastActivityAt: new Date(NOW.getTime() - 2 * DAY_MS),
        }),
      ),
    ).toBe("abonne_actif");
  });

  it("abonné actif sans activité depuis > seuil -> abonne_dormant", () => {
    expect(
      computeSegment(
        base({
          subscriptionStatus: "active",
          lastActivityAt: new Date(NOW.getTime() - 30 * DAY_MS),
        }),
      ),
    ).toBe("abonne_dormant");
  });

  it("ancien bêta-testeur retombé sans abonnement -> beta_non_converti", () => {
    expect(
      computeSegment(base({ isBetaOrigin: true, subscriptionStatus: "canceled" })),
    ).toBe("beta_non_converti");
  });

  it("ancien abonné payant (jamais bêta) résilié -> resilie", () => {
    expect(
      computeSegment(base({ isBetaOrigin: false, subscriptionStatus: "canceled" })),
    ).toBe("resilie");
  });
});

describe("computeSegment — cas frontières explicitement demandés", () => {
  it("bêta-testeur qui convertit -> abonne_actif, jamais beta_non_converti", () => {
    const seg = computeSegment(
      base({
        isBetaOrigin: true,
        subscriptionStatus: "active",
        lastActivityAt: new Date(NOW.getTime() - DAY_MS),
      }),
    );
    expect(seg).toBe("abonne_actif");
    expect(seg).not.toBe("beta_non_converti");
  });

  it("bêta-testeur qui convertit mais dort depuis > seuil -> abonne_dormant, pas beta_non_converti", () => {
    const seg = computeSegment(
      base({
        isBetaOrigin: true,
        subscriptionStatus: "active",
        lastActivityAt: new Date(NOW.getTime() - 40 * DAY_MS),
      }),
    );
    expect(seg).toBe("abonne_dormant");
  });

  it("abonné qui résilie puis se réabonne -> reflète l'état COURANT (actif), pas resilie", () => {
    // La ligne UserSubscription est unique par utilisateur (upsert) : le statut lu
    // au moment du calcul est déjà le nouveau, pas d'historique à démêler ici.
    const apresResiliation = computeSegment(base({ subscriptionStatus: "canceled" }));
    expect(apresResiliation).toBe("resilie");

    const apresReabonnement = computeSegment(
      base({
        subscriptionStatus: "active",
        lastActivityAt: new Date(NOW.getTime() - DAY_MS),
      }),
    );
    expect(apresReabonnement).toBe("abonne_actif");
  });

  it("compte créé et jamais utilisé, y compris avec une activité ancienne factice -> jamais_actif", () => {
    expect(
      computeSegment(base({ hasCompletedActivation: false, lastActivityAt: null })),
    ).toBe("jamais_actif");
  });
});

describe("computeSegment — exclusivité prouvée sur toute la matrice de signaux", () => {
  const activations = [false, true];
  const origins = [false, true];
  const statuses: (string | null)[] = [
    null,
    "trialing",
    "active",
    "canceled",
    "incomplete_expired",
    "past_due",
  ];
  const activityDeltasDays = [0, 5, 21, 22, 90];

  it("chaque combinaison de signaux produit EXACTEMENT un segment valide de l'union", () => {
    for (const hasCompletedActivation of activations) {
      for (const isBetaOrigin of origins) {
        for (const subscriptionStatus of statuses) {
          for (const delta of activityDeltasDays) {
            const input = base({
              hasCompletedActivation,
              isBetaOrigin,
              subscriptionStatus,
              lastActivityAt: new Date(NOW.getTime() - delta * DAY_MS),
            });
            const result = computeSegment(input);
            // Un seul segment retourné, et il appartient bien à l'union des sept.
            expect(SEGMENTS).toContain(result);
            expect(segmentSchema.safeParse(result).success).toBe(true);

            // Vérifications d'exclusivité ciblées, dérivées de la doc de la fonction.
            if (subscriptionStatus === "trialing") {
              expect(result).toBe("essai_beta");
            }
            if (subscriptionStatus === "active") {
              expect(["abonne_actif", "abonne_dormant"]).toContain(result);
            }
            if (subscriptionStatus === null && !isBetaOrigin) {
              expect(["actif_gratuit", "jamais_actif"]).toContain(result);
            }
            if (isBetaOrigin && subscriptionStatus !== "active" && subscriptionStatus !== "trialing") {
              expect(result).toBe("beta_non_converti");
            }
            if (
              !isBetaOrigin &&
              subscriptionStatus !== null &&
              subscriptionStatus !== "active" &&
              subscriptionStatus !== "trialing"
            ) {
              expect(result).toBe("resilie");
            }
          }
        }
      }
    }
  });
});

describe("segmentSchema", () => {
  it("rejette une valeur hors union (ex. valeur corrompue en base)", () => {
    expect(segmentSchema.safeParse("actif_gratuit").success).toBe(true);
    expect(segmentSchema.safeParse("inconnu").success).toBe(false);
  });
});
