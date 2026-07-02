// Replay annoté : rattache chaque « moment clé » du débrief au message du
// transcript qui lui correspond (au lieu d'une liste séparée hors contexte).
// Correspondance approximative : la citation du LLM n'est pas toujours un
// extrait exact — on tolère la paraphrase via un score de recouvrement de mots.

export type Moment = { quote: string; comment: string };
export type MsgLite = { role: string; content: string };

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na.includes(nb) || nb.includes(na)) return 1;
  const wa = new Set(na.split(" "));
  const wb = new Set(nb.split(" "));
  let common = 0;
  for (const w of wa) if (wb.has(w)) common++;
  return common / Math.max(wa.size, wb.size, 1);
}

/**
 * Associe chaque moment au message le plus proche (score >= seuil).
 * Renvoie l'index du message dans `messages` -> moments rattachés, et la
 * liste des moments sans correspondance suffisante (fallback en liste).
 */
export function matchMoments(
  messages: MsgLite[],
  moments: Moment[],
  threshold = 0.5,
): { byIndex: Map<number, Moment[]>; unmatched: Moment[] } {
  const byIndex = new Map<number, Moment[]>();
  const unmatched: Moment[] = [];
  for (const moment of moments) {
    let bestIdx = -1;
    let bestScore = 0;
    messages.forEach((msg, i) => {
      const score = similarity(msg.content, moment.quote);
      if (score > bestScore) {
        bestScore = score;
        bestIdx = i;
      }
    });
    if (bestIdx >= 0 && bestScore >= threshold) {
      const arr = byIndex.get(bestIdx) ?? [];
      arr.push(moment);
      byIndex.set(bestIdx, arr);
    } else {
      unmatched.push(moment);
    }
  }
  return { byIndex, unmatched };
}
