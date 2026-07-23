// Tests unitaires purs — aucune base, aucun réseau.
import { describe, it, expect } from "vitest";
import { isSubscriptionEntitled, isSubscriptionBillable } from "../src/lib/entitlements";
import { safeNextPath } from "../src/lib/safe-redirect";
import { periodIndexFor, addMonthsClamped } from "../src/lib/billing-period";
import { generateBetaCode, normalizeBetaCode, isPlausibleBetaCode } from "../src/lib/beta-code";
import { parseBetaInviteStatus } from "../src/lib/beta-status";

describe("isSubscriptionEntitled", () => {
  it("ouvre les droits en active ET en trialing", () => {
    expect(isSubscriptionEntitled("active")).toBe(true);
    expect(isSubscriptionEntitled("trialing")).toBe(true);
  });

  it("les refuse pour tout autre statut Stripe", () => {
    for (const s of ["past_due", "canceled", "incomplete", "incomplete_expired", "unpaid", "paused"]) {
      expect(isSubscriptionEntitled(s)).toBe(false);
    }
  });

  it("tolère null/undefined sans lever", () => {
    expect(isSubscriptionEntitled(null)).toBe(false);
    expect(isSubscriptionEntitled(undefined)).toBe(false);
  });

  it("distingue l'accès du revenu : un essai n'est pas facturable", () => {
    expect(isSubscriptionEntitled("trialing")).toBe(true);
    expect(isSubscriptionBillable("trialing")).toBe(false);
    expect(isSubscriptionBillable("active")).toBe(true);
  });
});

describe("safeNextPath", () => {
  it("accepte un chemin interne", () => {
    expect(safeNextPath("/beta/ABC")).toBe("/beta/ABC");
    expect(safeNextPath("/accueil?x=1")).toBe("/accueil?x=1");
  });

  it("rejette toute destination externe ou dangereuse", () => {
    const backslash = "/" + String.fromCharCode(92) + "evil.com";
    for (const bad of [
      "https://phishing.example",
      "//evil.com",
      backslash,
      "javascript:alert(1)",
      "accueil",
      "",
      "/a" + String.fromCharCode(13, 10) + "Set-Cookie: x",
    ]) {
      expect(safeNextPath(bad)).toBeNull();
    }
  });

  it("rejette les valeurs non-chaînes", () => {
    expect(safeNextPath(undefined)).toBeNull();
    expect(safeNextPath(42)).toBeNull();
  });
});

describe("periodIndexFor", () => {
  const anchor = new Date(Date.UTC(2026, 0, 31, 10, 0, 0)); // 31 janvier 10:00

  it("démarre à 0 et n'est jamais négatif", () => {
    expect(periodIndexFor(anchor, anchor)).toBe(0);
    expect(periodIndexFor(anchor, new Date(Date.UTC(2025, 11, 1)))).toBe(0);
  });

  it("borne le jour comme Stripe, sans propager le rognage", () => {
    // 31 janvier + 1 mois = 28 février, mais + 2 mois RESTAURE le 31 mars.
    expect(addMonthsClamped(anchor, 1).toISOString().slice(0, 10)).toBe("2026-02-28");
    expect(addMonthsClamped(anchor, 2).toISOString().slice(0, 10)).toBe("2026-03-31");
  });

  it("bascule à l'instant exact de la période, pas au changement de mois", () => {
    expect(periodIndexFor(anchor, new Date(Date.UTC(2026, 1, 28, 9, 59)))).toBe(0);
    expect(periodIndexFor(anchor, new Date(Date.UTC(2026, 1, 28, 10, 0)))).toBe(1);
    expect(periodIndexFor(anchor, new Date(Date.UTC(2026, 2, 31, 9, 59)))).toBe(1);
    expect(periodIndexFor(anchor, new Date(Date.UTC(2026, 2, 31, 10, 0)))).toBe(2);
  });

  it("donne 3 allocations sur un essai de 90 jours", () => {
    const start = new Date(Date.UTC(2026, 0, 28, 12));
    // Périodes 0, 1, 2 pendant l'essai ; la 3 commence à son terme.
    expect(periodIndexFor(start, new Date(Date.UTC(2026, 3, 27, 12)))).toBe(2);
    expect(periodIndexFor(start, new Date(Date.UTC(2026, 3, 28, 13)))).toBe(3);
  });
});

describe("codes d'invitation", () => {
  it("respecte longueur et alphabet non ambigu", () => {
    const code = generateBetaCode();
    expect(code).toHaveLength(24);
    expect(code).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/);
    // Ni 0/O ni 1/I/L : illisibles au téléphone et source de fautes de recopie.
    expect(code).not.toMatch(/[01OIL]/);
  });

  it("ne collisionne pas sur un gros tirage", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(generateBetaCode());
    expect(seen.size).toBe(5000);
  });

  it("normalise la saisie collée depuis un email", () => {
    expect(normalizeBetaCode("  ab cd-ef ")).toBe("ABCDEF");
  });

  it("valide la forme avant toute requête base", () => {
    expect(isPlausibleBetaCode(generateBetaCode())).toBe(true);
    expect(isPlausibleBetaCode("trop-court")).toBe(false);
    expect(isPlausibleBetaCode("0".repeat(24))).toBe(false);
  });
});

describe("parseBetaInviteStatus", () => {
  it("laisse passer les statuts connus", () => {
    expect(parseBetaInviteStatus("PENDING")).toBe("PENDING");
    expect(parseBetaInviteStatus("CLAIMED")).toBe("CLAIMED");
  });

  it("dégrade une valeur inconnue en REVOKED plutôt que de planter", () => {
    expect(parseBetaInviteStatus("WAT")).toBe("REVOKED");
  });
});
