// Contrat d'ordre de consommation des crédits (voir src/lib/credit-split.ts) :
// l'allocation d'abonnement (planCredits, périssable) est débitée AVANT le portefeuille
// persistant (packs achetés + crédits gratuits). Test pur, sans base.
import { describe, it, expect } from "vitest";
import { splitDebit } from "@/lib/credit-split";

describe("splitDebit — allocation d'abonnement d'abord, portefeuille ensuite", () => {
  it("puise dans l'allocation tant qu'elle suffit (portefeuille intact)", () => {
    expect(splitDebit(5, 10, 2)).toEqual({ fromPlan: 2, fromWallet: 0 });
  });

  it("épuise l'allocation puis complète sur le portefeuille", () => {
    expect(splitDebit(1, 10, 2)).toEqual({ fromPlan: 1, fromWallet: 1 });
  });

  it("puise uniquement dans le portefeuille quand il n'y a pas d'allocation", () => {
    expect(splitDebit(0, 10, 2)).toEqual({ fromPlan: 0, fromWallet: 2 });
  });

  it("prend toute l'allocation quand le débit la dépasse", () => {
    expect(splitDebit(3, 10, 5)).toEqual({ fromPlan: 3, fromWallet: 2 });
  });

  it("consomme exactement l'allocation quand elle égale le débit", () => {
    expect(splitDebit(2, 8, 2)).toEqual({ fromPlan: 2, fromWallet: 0 });
  });
});
