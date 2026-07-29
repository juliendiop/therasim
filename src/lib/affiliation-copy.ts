// Contenu rédactionnel des pages d'affiliation, optimisé pour la conversion.
// Rédigé à la main (ton MELETA : sobre, factuel, non certifiant). Le modèle
// d'exécution pose ce texte dans les pages ; les valeurs dynamiques (taux,
// seuil, lien, prénom, montants) sont injectées via les placeholders indiqués.
//
// Placeholders : {T1} = taux niveau 1, {T2} = taux niveau 2, {SEUIL} = seuil
// de paiement en €, {COOKIE} = fenêtre d'attribution en jours, {LIEN} = lien de
// parrainage, {PRENOM} = prénom.
// Lire les valeurs depuis AppConfig (voir la spec §2) — ne rien coder en dur.
//
// ⚠️ Ne jamais promettre une commission perpétuelle : elle court tant que le filleul
// reste abonné ET tant que le programme est maintenu (cf. /conditions-ambassadeurs §7).

// ─────────────────────────────────────────────────────────────────────────
// PAGE PUBLIQUE DE RECRUTEMENT  —  /ambassadeurs
// Objectif : convertir un visiteur/utilisateur en ambassadeur actif.
// ─────────────────────────────────────────────────────────────────────────
export const AMBASSADEURS_PAGE = {
  seo: {
    title: "Programme ambassadeur — MELETA",
    description:
      "Recommandez MELETA et touchez une commission récurrente sur les abonnements, tant que votre filleul reste abonné. Gratuit, sans engagement. Kit de diffusion fourni.",
  },
  eyebrow: "Programme ambassadeur",
  h1: "Recommandez MELETA. Gagnez à chaque fois.",
  lead: "Vous appréciez MELETA ? Parlez-en autour de vous et touchez une commission récurrente — versée tant que vos filleuls restent abonnés. C'est gratuit, sans engagement, et vous recevez un kit prêt à partager.",
  ctaPrimary: "Devenir ambassadeur", // → /affiliation si connecté, /inscription sinon
  ctaSecondaryNote: "Gratuit · sans engagement · résiliable à tout moment",

  // Bandeau chiffres clés (réassurance immédiate). Le niveau 2 n'y figure PAS :
  // un second taux dans le hero brouille le message et fait « plan de rémunération ».
  // Le mécanisme est expliqué plus bas, section « Deux niveaux de revenus ».
  highlights: [
    {
      value: "{T1} %",
      label: "de commission sur chaque abonnement parrainé, tant que votre filleul reste abonné",
    },
    { value: "{COOKIE} jours", label: "de fenêtre d'attribution après un clic sur votre lien" },
    { value: "À partir de {SEUIL} €", label: "seuil de paiement, réglé sur simple demande" },
  ],

  howItWorksTitle: "Comment ça marche",
  howItWorks: [
    {
      n: "1",
      titre: "Partagez votre lien",
      texte:
        "Activez votre espace ambassadeur et récupérez votre lien unique. Un kit prêt à l'emploi (emails, posts, visuels) vous attend.",
    },
    {
      n: "2",
      titre: "Vos filleuls s'abonnent",
      texte:
        "Chaque personne qui crée son compte via votre lien vous est rattachée définitivement. Dès qu'elle s'abonne, vous gagnez.",
    },
    {
      n: "3",
      titre: "Vous touchez chaque mois",
      texte:
        "Vous recevez {T1} % de chaque paiement d'abonnement, chaque mois, tant que votre filleul reste client. Suivi en temps réel dans votre espace.",
    },
  ],

  // Prérequis affiché AVANT le formulaire d'activation : mieux vaut le savoir
  // avant de s'engager qu'au moment de réclamer son premier paiement.
  prerequisTitre: "Avant de vous lancer : il faut pouvoir facturer",
  prerequisTexte:
    "Les commissions sont versées sur facture. Vous devez donc disposer d'un statut vous permettant d'émettre une facture (micro-entrepreneur, société, association). Sans cela, votre solde reste acquis mais ne peut pas vous être réglé. MELETA ne vous emploie pas et ne peut pas verser de rémunération autrement.",

  exempleTitre: "Concrètement, ça donne quoi ?",

  twoLevelsTitle: "Deux niveaux de revenus",
  twoLevelsText:
    "Vous gagnez sur vos filleuls directs ({T1} %), mais aussi sur les ambassadeurs que vous recrutez : quand ils génèrent une vente, vous touchez {T2} % en plus. Un seul niveau supplémentaire — un dispositif simple et transparent.",

  schoolsTitle: "Vous connaissez une école ou un organisme de formation ?",
  schoolsText:
    "Recommandez MELETA à une école qui forme des praticiens. Si elle nous contacte en mentionnant votre nom et signe, votre commission est créditée manuellement — les contrats écoles pèsent souvent bien plus qu'un abonnement individuel.",
  schoolsCta: "Voir comment proposer MELETA à une école", // → ancre kit / /affiliation

  faqTitle: "Questions fréquentes",
  faq: [
    {
      q: "Combien puis-je gagner ?",
      a: "Vous touchez {T1} % de chaque paiement d'abonnement de vos filleuls directs, chaque mois, tant qu'ils restent abonnés — c'est récurrent, pas un one-shot. S'ajoutent {T2} % sur les ventes des ambassadeurs que vous avez recrutés.",
    },
    {
      q: "Est-ce que ça me coûte quelque chose ?",
      a: "Non. Devenir ambassadeur est entièrement gratuit et sans engagement. Vous n'avez rien à acheter ni à avancer.",
    },
    {
      q: "Comment suis-je payé ?",
      a: "Dès que votre solde atteint {SEUIL} €, vous cliquez sur « Demander le paiement » et envoyez votre facture par email. Une fois réglée, votre solde repart de zéro. Pour être payé, vous devez pouvoir émettre une facture (par exemple en tant que micro-entrepreneur).",
    },
    {
      q: "Comment mes filleuls me sont-ils attribués ?",
      a: "Toute personne qui crée son compte après avoir cliqué sur votre lien vous est rattachée de façon permanente. L'attribution est enregistrée à l'inscription et ne change plus.",
    },
    {
      q: "Que puis-je dire de MELETA ?",
      a: "Restez factuel : MELETA est un outil formatif, non certifiant. Présentez-le pour ce qu'il est — un entraînement à la relation clinique — sans promettre de résultats. Un kit de messages conformes vous est fourni.",
    },
  ],

  finalCtaTitle: "Prêt à recommander MELETA ?",
  finalCtaText: "Activez votre espace ambassadeur en une minute et récupérez votre lien.",
  finalCta: "Devenir ambassadeur",
} as const;

// ─────────────────────────────────────────────────────────────────────────
// ÉCRAN D'ACTIVATION  —  /affiliation (utilisateur pas encore ambassadeur)
// Objectif : lever les freins et faire cliquer « Devenir ambassadeur ».
// ─────────────────────────────────────────────────────────────────────────
export const AFFILIATION_ACTIVATION = {
  h1: "Devenez ambassadeur MELETA",
  lead: "Recommandez MELETA autour de vous et touchez une commission récurrente sur les abonnements générés, tant que vos filleuls restent abonnés. Gratuit, sans engagement.",
  benefits: [
    "{T1} % de commission sur chaque abonnement de vos filleuls, tant qu'ils restent abonnés",
    "{T2} % supplémentaires sur les ventes des ambassadeurs que vous recrutez",
    "Un lien unique et un kit de diffusion prêt à l'emploi (textes + visuels)",
    "Suivi de vos filleuls et de vos revenus en temps réel",
  ],
  // Case à cocher CGU (obligatoire avant activation)
  consentLabel:
    "J'accepte les conditions du programme d'affiliation. Je comprends que, pour être payé, je dois pouvoir émettre une facture, et que MELETA ne m'emploie pas.",
  consentHint:
    "Restez factuel dans vos recommandations : MELETA est un outil formatif, non certifiant.",
  cta: "Devenir ambassadeur",
} as const;

// ─────────────────────────────────────────────────────────────────────────
// ESPACE AMBASSADEUR  —  /affiliation (utilisateur déjà ambassadeur)
// Libellés des sections, cartes de stats, et flux de paiement.
// ─────────────────────────────────────────────────────────────────────────
export const AFFILIATION_DASHBOARD = {
  h1: "Espace ambassadeur",
  linkSectionTitle: "Votre lien de parrainage",
  linkSectionHint:
    "Partagez ce lien : toute personne qui crée son compte après avoir cliqué vous est rattachée définitivement.",
  copyLink: "Copier le lien",

  statsTitle: "Vos revenus",
  stats: {
    balance: "Solde à payer",
    balanceHint: "Montant HT, selon votre statut",
    totalEarned: "Total gagné",
    totalPaid: "Déjà payé",
    tier1: "Filleuls directs",
    tier2: "Filleuls de niveau 2",
    activeSubs: "Abonnements actifs générés",
  },

  payoutTitle: "Demander le paiement",
  payoutBelowThreshold: "Disponible à partir de {SEUIL} € de solde.", // bouton désactivé
  payoutCta: "Demander le paiement",
  payoutInstructions:
    "Envoyez votre facture de {MONTANT} € à contact@meleta.app en indiquant l'email de votre compte. Votre solde repartira de zéro une fois la facture réglée.",
  payoutInvoiceSentCta: "J'ai envoyé ma facture",
  payoutPendingNote:
    "Une demande est en cours. Vous pourrez en refaire une après son règlement.",

  referralsTitle: "Vos filleuls",
  referralsEmpty:
    "Aucun filleul pour l'instant. Partagez votre lien pour commencer — le kit ci-dessous est là pour ça.",
  referralsHint:
    "Par respect de leur vie privée, vos filleuls apparaissent de façon anonymisée. Vous voyez leur statut et la commission générée, pas leurs coordonnées.",

  historyTitle: "Historique",
  kitTitle: "Kit de diffusion",
  kitHint:
    "Vos textes et visuels prêts à partager — votre lien et votre prénom sont déjà insérés.",
} as const;
