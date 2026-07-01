// Offres de fidélisation envoyées par email depuis l'admin (relances crédits).
// Les textes sont éditables et stockés dans app_config (repli sur les défauts).
import "server-only";
import { getConfig } from "./config";

export type OfferKind = "grant" | "promo";

export type Offer = {
  id: string;
  label: string;
  kind: OfferKind; // 'grant' = crédits offerts (débités au compte) ; 'promo' = email seul
  credits: number; // crédits offerts si kind = 'grant'
  subject: string;
  body: string; // placeholders : {brand} {credits} {email}
};

export const DEFAULT_OFFERS: Offer[] = [
  {
    id: "pack_gift",
    label: "Offrir des crédits",
    kind: "grant",
    credits: 20,
    subject: "🎁 {credits} crédits offerts sur {brand}",
    body:
      "Bonjour,\n\nPour vous accompagner dans votre pratique clinique, nous vous offrons {credits} crédits sur {brand}. Ils sont déjà disponibles sur votre compte, prêts à l'emploi.\n\nBonne pratique !\nL'équipe {brand}",
  },
  {
    id: "promo_50",
    label: "Promo −50% sur un pack",
    kind: "promo",
    credits: 0,
    subject: "−50% sur votre prochain pack de crédits {brand}",
    body:
      "Bonjour,\n\nCette semaine, profitez de −50% sur le pack de crédits de votre choix sur {brand}. Une belle occasion de poursuivre votre entraînement.\n\nRendez-vous sur votre page « Mes crédits ».\n\nÀ très vite,\nL'équipe {brand}",
  },
];

export async function getOffers(): Promise<Offer[]> {
  return Promise.all(
    DEFAULT_OFFERS.map(async (o) => {
      const [subject, body, credits] = await Promise.all([
        getConfig(`offer.${o.id}.subject`),
        getConfig(`offer.${o.id}.body`),
        getConfig(`offer.${o.id}.credits`),
      ]);
      const c = credits != null ? parseInt(credits, 10) : NaN;
      return {
        ...o,
        subject: subject && subject.trim() ? subject : o.subject,
        body: body && body.trim() ? body : o.body,
        credits: Number.isFinite(c) && c >= 0 ? c : o.credits,
      };
    }),
  );
}

export async function getOffer(id: string): Promise<Offer | null> {
  const offers = await getOffers();
  return offers.find((o) => o.id === id) ?? null;
}

export function renderOffer(
  offer: Offer,
  vars: { brand: string; credits: number; email: string; link: string },
): { subject: string; body: string } {
  const apply = (s: string) =>
    s
      .replace(/\{brand\}/g, vars.brand)
      .replace(/\{credits\}/g, String(vars.credits))
      .replace(/\{email\}/g, vars.email)
      .replace(/\{link\}/g, vars.link);
  return { subject: apply(offer.subject), body: apply(offer.body) };
}
