// Source UNIQUE des informations légales du site (éditeur, hébergeur,
// sous-traitants, cookies, durées). Les pages /mentions-legales, /cgv-cgu,
// /confidentialite, /conditions-ambassadeurs et /contact lisent d'ici — ne
// jamais dupliquer une de ces valeurs dans une page.
//
// ⚠️ Ces textes sont des BROUILLONS. Tout ce qui est marqué `TODO(...)` doit être
// complété par l'éditeur, et l'ensemble relu par un professionnel du droit avant
// mise en ligne. Voir LEGAL_DISCLAIMER ci-dessous, affiché en tête de chaque page.

/** Marqueur visible des informations que seul l'éditeur peut fournir. */
function TODO(quoi: string): string {
  return `[À COMPLÉTER PAR JULIEN — ${quoi}]`;
}

/** Date de dernière mise à jour affichée en pied de chaque page légale. */
export const LEGAL_UPDATED_AT = "28 juillet 2026";

export const LEGAL_DISCLAIMER =
  "Ce document est un brouillon généré à partir de la configuration technique du service. " +
  "Il doit être complété (mentions marquées « à compléter ») puis relu par un professionnel " +
  "du droit avant toute mise en ligne. En l'état, il n'a aucune valeur contractuelle.";

// --- Éditeur ---------------------------------------------------------------
// Fournis par l'éditeur. Le SIREN, le RCS, l'adresse et le téléphone sont
// confirmés ; la forme juridique est une EURL assujettie à la TVA.
export const EDITEUR = {
  denomination: "Agence Pragmatik",
  formeJuridique: "EURL (société à responsabilité limitée à associé unique)",
  capitalSocial: TODO("montant du capital social, ex. « 1 000 € »"),
  siren: "918 070 988",
  rcs: "Nîmes",
  tvaIntracom: TODO("numéro de TVA intracommunautaire, format FR__918070988"),
  adresse: "782T Chemin de Campagne, 30250 Sommières, France",
  telephone: "06 76 50 76 18",
  email: "contact@meleta.app",
  gerant: "Julien Diop",
  directeurPublication: "Julien Diop",
} as const;

/** Marque commerciale du service édité. */
export const SERVICE = {
  nom: "MELETA",
  domaine: "meleta.app",
  url: "https://meleta.app",
  description:
    "plateforme d'entraînement à la relation clinique par simulation et exercices, " +
    "à visée formative et non certifiante",
} as const;

// --- Hébergement -----------------------------------------------------------
// Vérifié dans le dépôt : vercel.json (framework nextjs + crons), variables
// VERCEL_PROJECT_PRODUCTION_URL / VERCEL_GIT_COMMIT_SHA, et l'adaptateur
// @prisma/adapter-neon + @neondatabase/serverless pour la base PostgreSQL.
export const HEBERGEUR = {
  nom: "Vercel Inc.",
  adresse: "440 N Barranca Ave #4133, Covina, CA 91723, États-Unis",
  site: "https://vercel.com",
  role: "hébergement de l'application et diffusion des pages",
} as const;

export const HEBERGEUR_BDD = {
  nom: "Neon Inc.",
  adresse: TODO("adresse postale de Neon Inc. — à relever sur neon.tech/legal"),
  site: "https://neon.tech",
  role: "hébergement de la base de données PostgreSQL",
  region: TODO("région d'hébergement de la base (ex. AWS eu-central-1, Francfort)"),
} as const;

/** Bureau d'enregistrement du nom de domaine (indiqué par l'éditeur). */
export const REGISTRAR = {
  nom: "OVH SAS",
  adresse: "2 rue Kellermann, 59100 Roubaix, France",
  role: "enregistrement du nom de domaine meleta.app",
} as const;

// --- Sous-traitants (RGPD, art. 28) ----------------------------------------
// Chaque entrée est vérifiable dans le code : le champ `source` indique où.
export type SousTraitant = {
  nom: string;
  finalite: string;
  donnees: string;
  localisation: string;
  source: string;
};

export const SOUS_TRAITANTS: SousTraitant[] = [
  {
    nom: "Vercel Inc.",
    finalite: "Hébergement de l'application et exécution du code serveur",
    donnees: "Ensemble des données transitant par le service, journaux techniques",
    localisation: `États-Unis / Union européenne — ${TODO("région de déploiement Vercel")}`,
    source: "vercel.json, src/lib/base-url.ts",
  },
  {
    nom: "Neon Inc.",
    finalite: "Hébergement de la base de données PostgreSQL",
    donnees: "Compte, progression, historique des séances simulées, facturation",
    localisation: HEBERGEUR_BDD.region,
    source: "package.json (@neondatabase/serverless), src/lib/prisma.ts",
  },
  {
    nom: "Stripe Payments Europe, Ltd.",
    finalite: "Encaissement des paiements, abonnements, facturation et reçus",
    donnees: "Email, identifiant client, données de paiement (jamais stockées par MELETA)",
    localisation: "Irlande (Union européenne), avec transferts vers Stripe Inc. (États-Unis)",
    source: "src/lib/stripe.ts, src/lib/billing.ts",
  },
  {
    nom: "Resend",
    finalite: "Envoi des emails transactionnels (lien de connexion, réinitialisation, relances)",
    donnees: "Adresse email, prénom, contenu du message",
    localisation: TODO("localisation des serveurs Resend — à vérifier sur resend.com/legal"),
    source: "src/lib/email.ts",
  },
  {
    nom: "Mistral AI",
    finalite: "Génération des réponses du patient simulé et évaluation formative",
    donnees: "Contenu des échanges de la mise en situation, sans identifiant de compte",
    localisation: "France (Union européenne)",
    source: "src/lib/mistral.ts (api.mistral.ai)",
  },
  {
    nom: "Anthropic PBC",
    finalite: "Génération des réponses du patient simulé et évaluation formative",
    donnees: "Contenu des échanges de la mise en situation, sans identifiant de compte",
    localisation: "États-Unis",
    source: "src/lib/anthropic.ts",
  },
];

// --- Cookies ---------------------------------------------------------------
// Vérifiés un par un dans le code. Aucun cookie tiers, aucun traceur publicitaire,
// aucune solution d'analytics externe n'est présente dans le dépôt.
export type CookieInfo = {
  nom: string;
  role: string;
  duree: string;
  categorie: "Strictement nécessaire" | "Mesure d'audience interne";
  source: string;
};

export const COOKIES: CookieInfo[] = [
  {
    nom: "session (httpOnly)",
    role: "Maintien de la connexion à votre compte",
    duree: "30 jours",
    categorie: "Strictement nécessaire",
    source: "src/lib/auth.ts",
  },
  {
    nom: "ts_ref (httpOnly)",
    role: "Rattachement à l'ambassadeur dont vous avez suivi le lien",
    duree: "90 jours (paramétrable par l'éditeur)",
    categorie: "Strictement nécessaire",
    source: "src/lib/affiliation.ts",
  },
  {
    nom: "ts_vid (httpOnly)",
    role: "Identifiant anonyme de visite, pour mesurer le parcours d'inscription",
    duree: "1 an",
    categorie: "Mesure d'audience interne",
    source: "src/lib/funnel.ts",
  },
];

// --- Durées de conservation ------------------------------------------------
// Les durées TECHNIQUES sont lues dans le code (vérifiables). Les durées de
// conservation des données de compte relèvent d'un arbitrage de l'éditeur : elles
// sont marquées à compléter, avec une proposition indicative.
export type Retention = { donnee: string; duree: string; verifie: boolean };

export const RETENTIONS: Retention[] = [
  {
    donnee: "Lien de connexion par email (usage unique)",
    duree: "15 minutes",
    verifie: true,
  },
  {
    donnee: "Lien de réinitialisation de mot de passe",
    duree: "60 minutes",
    verifie: true,
  },
  {
    donnee: "Session de connexion",
    duree: "30 jours",
    verifie: true,
  },
  {
    donnee: "Compte et données de progression",
    duree: TODO("proposition : durée du compte, puis 12 mois après le dernier accès"),
    verifie: false,
  },
  {
    donnee: "Historique des séances simulées et évaluations",
    duree: TODO("proposition : durée du compte, suppression avec le compte"),
    verifie: false,
  },
  {
    donnee: "Tickets de support",
    duree: TODO("proposition : 3 ans après la clôture du ticket"),
    verifie: false,
  },
  {
    donnee: "Journal d'audit (connexions, changements de rôle)",
    duree: TODO("proposition : 12 mois"),
    verifie: false,
  },
  {
    donnee: "Événements de mesure du parcours d'inscription (anonymes)",
    duree: TODO("proposition : 25 mois, alignés sur la recommandation CNIL"),
    verifie: false,
  },
  {
    donnee: "Pièces comptables et factures",
    duree: "10 ans (obligation légale — art. L123-22 du code de commerce)",
    verifie: true,
  },
  {
    donnee: "Commissions et demandes de paiement des ambassadeurs",
    duree: "10 ans (pièces comptables)",
    verifie: true,
  },
];

// --- Programme ambassadeur -------------------------------------------------
// Les taux, seuil et durée de cookie sont configurables en base (AppConfig) :
// les pages lisent les valeurs réelles via resolveCommissionRate(). Ces
// constantes ne servent qu'à documenter les règles NON paramétrables.
export const AMBASSADEUR_REGLES = {
  niveauxMax: 2,
  attribution: "first-touch",
  fondementInterdictionPyramidale: "article L.122-6 du code de la consommation",
  emailFacturation: "contact@meleta.app",
} as const;
