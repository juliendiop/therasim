// Kit marketing prêt à l'emploi pour les ambassadeurs MELETA.
// Contenu figé (rédigé à la main) : l'espace ambassadeur (/affiliation) affiche
// ces blocs et remplace {LIEN} par le lien de parrainage de l'utilisateur et
// {PRENOM} par son prénom. Textes copiables tels quels.
//
// Ton : factuel, sobre — MELETA est formatif, non certifiant. Ne pas promettre
// de résultats. (Rappel à afficher dans l'UI du kit.)

export type KitBlock = {
  id: string;
  channel: string; // canal d'usage (affiché comme étiquette)
  label: string; // titre du bloc dans l'UI
  /** Sujet d'email, le cas échéant. */
  subject?: string;
  /** Corps du message avec placeholders {LIEN} et {PRENOM}. */
  body: string;
};

export const KIT_BLOCKS: KitBlock[] = [
  {
    id: "email-confrere",
    channel: "Email",
    label: "Email à un confrère (praticien → praticien)",
    subject: "Un outil pour s'entraîner à la relation clinique",
    body: `Bonjour,

Je te partage MELETA, que j'utilise pour m'entraîner à la pratique clinique sur des cas réalistes : exercices ciblés, mises en situation avec un patient simulé par IA, et un suivi de progression compétence par compétence. C'est formatif (non certifiant), et on peut tester gratuitement sans carte bancaire.

Si ça t'intéresse : {LIEN}

Bonne découverte,
{PRENOM}`,
  },
  {
    id: "linkedin",
    channel: "LinkedIn",
    label: "Post LinkedIn",
    body: `On sait expliquer l'écoute active ou l'entretien motivationnel. Les mobiliser sous pression, face à un vrai patient, c'est autre chose.

J'utilise MELETA pour entraîner ces compétences relationnelles sur des cas cliniques réalistes : feedback immédiat, mises en situation avec un patient simulé par IA, et une carte de progression qui montre où je progresse et où je cale.

Outil formatif, non certifiant. Essai gratuit sans carte bancaire → {LIEN}

#pratiqueclinique #formation #thérapie #coaching`,
  },
  {
    id: "instagram",
    channel: "Instagram",
    label: "Post / story Instagram (légende courte)",
    body: `S'entraîner à la relation clinique, pas juste la théoriser.
Cas réalistes · patient simulé par IA · progression par compétences.
Essai gratuit → lien en bio / {LIEN}`,
  },
  {
    id: "whatsapp",
    channel: "Message direct",
    label: "Message WhatsApp / DM",
    body: `Salut ! Je te partage un outil que j'aime bien pour m'entraîner à la pratique clinique (cas réalistes + patient simulé par IA, suivi de progression). Test gratuit sans CB : {LIEN}`,
  },
  {
    id: "ecole",
    channel: "Écoles / organismes",
    label: "Proposer MELETA à une école (volet B2B)",
    subject: "MELETA pour vos étudiants — entraînement à la relation clinique",
    body: `Bonjour,

Dans le cadre de la formation, MELETA pourrait intéresser vos étudiants : un outil d'entraînement à la relation clinique (cas réalistes, patient simulé par IA, suivi des compétences), avec un accès dédié pour les écoles et organismes.

Si vous souhaitez une démonstration : https://meleta.app/demande-demo
(vous pouvez mentionner mon nom, {PRENOM}, dans le formulaire.)

Bien à vous,
{PRENOM}`,
  },
];

export type KitImage = {
  id: string;
  label: string;
  usage: string;
  /** Chemin public (servi par Next depuis /public). */
  src: string;
  width: number;
  height: number;
};

export const KIT_IMAGES: KitImage[] = [
  {
    id: "lien",
    label: "Bannière lien / LinkedIn",
    usage: "Aperçu de lien, post LinkedIn/Facebook, couverture",
    src: "/affiliation/banniere-lien-1200x630.svg",
    width: 1200,
    height: 630,
  },
  {
    id: "carre",
    label: "Format carré",
    usage: "Post Instagram, post LinkedIn carré",
    src: "/affiliation/carre-1080x1080.svg",
    width: 1080,
    height: 1080,
  },
  {
    id: "story",
    label: "Format story",
    usage: "Story Instagram / Facebook, Reels",
    src: "/affiliation/story-1080x1920.svg",
    width: 1080,
    height: 1920,
  },
  {
    id: "email",
    label: "Bandeau email",
    usage: "En-tête d'email, signature",
    src: "/affiliation/bandeau-email-1200x400.svg",
    width: 1200,
    height: 400,
  },
];

/** Remplit un modèle avec le lien de parrainage et le prénom de l'ambassadeur. */
export function fillTemplate(text: string, vars: { lien: string; prenom: string }): string {
  return text.replaceAll("{LIEN}", vars.lien).replaceAll("{PRENOM}", vars.prenom || "");
}

/** Rappel déontologique à afficher au-dessus du kit dans l'UI. */
export const KIT_DISCLAIMER =
  "Restez factuel : MELETA est un outil formatif, non certifiant. Ne promettez pas de résultats cliniques ni de certification.";
