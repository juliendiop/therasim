// Journalisation des coûts LLM — tests purs (sans base, sans réseau).
// 1) calcul du coût à partir de compteurs connus, écriture ET lecture de cache comprises ;
// 2) le chunk d'usage Mistral (choices vide) ne renvoie AUCUN texte à relayer.
import { describe, it, expect } from "vitest";
import { computeCostEur, pickEffectivePrice, type PricingEntry } from "@/lib/llm-pricing";
import { parseMistralChunk } from "@/lib/mistral";

describe("computeCostEur — les quatre catégories sont tarifées séparément", () => {
  const price = {
    inputPerM: 3, // 3 €/M
    outputPerM: 15,
    cacheWritePerM: 3.75, // écriture de cache : PLUS que l'entrée
    cacheReadPerM: 0.3, // lecture de cache : BEAUCOUP moins
  };

  it("additionne entrée + sortie + écriture cache + lecture cache", () => {
    const cost = computeCostEur(
      { inputTokens: 1000, outputTokens: 500, cacheCreationTokens: 200, cacheReadTokens: 10000 },
      price,
    );
    // (1000*3 + 500*15 + 200*3.75 + 10000*0.30) / 1e6 = 14250 / 1e6
    expect(cost).toBeCloseTo(0.01425, 8);
  });

  it("ne fusionne PAS écriture et lecture de cache (prix distincts)", () => {
    const writeOnly = computeCostEur(
      { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 1_000_000, cacheReadTokens: 0 },
      price,
    );
    const readOnly = computeCostEur(
      { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 1_000_000 },
      price,
    );
    expect(writeOnly).toBeCloseTo(3.75, 8); // = cacheWritePerM
    expect(readOnly).toBeCloseTo(0.3, 8); // = cacheReadPerM
    expect(writeOnly).not.toBeCloseTo(readOnly, 2);
  });

  it("coût nul quand tous les compteurs sont à zéro", () => {
    expect(
      computeCostEur({ inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0 }, price),
    ).toBe(0);
  });
});

describe("pickEffectivePrice — tarif figé au moment de l'appel", () => {
  const entries: PricingEntry[] = [
    { provider: "anthropic", model: "claude-x", effectiveFrom: "2026-01-01", inputPerM: 3, outputPerM: 15, cacheWritePerM: 3.75, cacheReadPerM: 0.3 },
    { provider: "anthropic", model: "claude-x", effectiveFrom: "2026-06-01", inputPerM: 2, outputPerM: 10, cacheWritePerM: 2.5, cacheReadPerM: 0.2 },
  ];

  it("retient la date d'effet la plus récente antérieure à l'instant", () => {
    expect(pickEffectivePrice(entries, "anthropic", "claude-x", new Date("2026-03-01"))?.inputPerM).toBe(3);
    expect(pickEffectivePrice(entries, "anthropic", "claude-x", new Date("2026-09-01"))?.inputPerM).toBe(2);
  });

  it("renvoie null si aucun tarif ne s'applique (modèle inconnu)", () => {
    expect(pickEffectivePrice(entries, "mistral", "inconnu", new Date())).toBeNull();
  });
});

describe("parseMistralChunk — le chunk d'usage ne relaie aucun texte", () => {
  it("extrait le fragment de texte d'un chunk de contenu", () => {
    const r = parseMistralChunk('{"choices":[{"delta":{"content":"Bonjour"}}]}');
    expect(r.delta).toBe("Bonjour");
    expect(r.usage).toBeNull();
  });

  it("un chunk d'usage (choices vide) donne un delta VIDE et l'usage", () => {
    const r = parseMistralChunk('{"choices":[],"usage":{"prompt_tokens":120,"completion_tokens":45}}');
    expect(r.delta).toBe(""); // → jamais yield, jamais relayé à l'utilisateur
    expect(r.usage).toEqual({
      inputTokens: 120,
      outputTokens: 45,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
    });
  });

  it("tolère un chunk sans choices ni usage", () => {
    expect(parseMistralChunk("{}")).toEqual({ delta: "", usage: null });
    expect(parseMistralChunk("pas du json")).toEqual({ delta: "", usage: null });
  });
});
