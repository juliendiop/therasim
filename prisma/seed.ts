/**
 * Seed TheraSim — référentiel "Entretien motivationnel" (EM).
 * Spec §2.5 / §4.5 : grille em-v1, 10 compétences (3 catégories), 2 cas, drills.
 * Idempotent (upsert) : relançable sans dupliquer.
 *
 * NB pédagogique (spec §7) : cas réalistes mais FICTIFS. Aucun patient réel.
 * NB clinique (spec §6) : un référentiel ne passe en `publie` qu'après validation
 * clinique + calibration de l'évaluateur. Ici on publie EM pour la démo de la tranche.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const GRID = "em-v1";
const FW = "em";

const categories = [
  { code: "posture", nom: "Posture et esprit", ordre: 1 },
  { code: "techniques", nom: "Techniques (OARS)", ordre: 2 },
  { code: "processus", nom: "Processus du changement", ordre: 3 },
];

const competencies = [
  {
    code: "empathie",
    cat: "posture",
    nom: "Empathie",
    ordre: 1,
    a1: "Réagit aux faits sans accueillir le vécu ; juge ou minimise.",
    a3: "Nomme l'émotion de surface, reste un peu en retrait.",
    a5: "Reflète finement le vécu et le sens, le patient se sent compris.",
  },
  {
    code: "non_jugement",
    cat: "posture",
    nom: "Non-jugement",
    ordre: 2,
    a1: "Émet un jugement moral ou un reproche implicite.",
    a3: "Neutre mais distant ; n'affirme pas l'autonomie.",
    a5: "Accueille sans juger et reconnaît la liberté de choix du patient.",
  },
  {
    code: "collaboration",
    cat: "posture",
    nom: "Collaboration (partenariat)",
    ordre: 3,
    a1: "Se pose en expert qui prescrit ; rapport descendant.",
    a3: "Sollicite parfois l'avis du patient.",
    a5: "Co-construit avec le patient, demande la permission, partage le pouvoir.",
  },
  {
    code: "questions_ouvertes",
    cat: "techniques",
    nom: "Questions ouvertes",
    ordre: 1,
    a1: "Enchaîne des questions fermées ou orientées.",
    a3: "Quelques questions ouvertes, parfois intrusives.",
    a5: "Questions ouvertes qui explorent la motivation et respectent le cadre.",
  },
  {
    code: "reflets",
    cat: "techniques",
    nom: "Reflets",
    ordre: 2,
    a1: "Répète mot à mot ou n'écoute pas.",
    a3: "Reflet simple qui paraphrase.",
    a5: "Reflet complexe : ajoute du sens, nomme l'émotion sous-jacente.",
  },
  {
    code: "valorisations",
    cat: "techniques",
    nom: "Valorisations",
    ordre: 3,
    a1: "Aucune reconnaissance, ou flatterie creuse.",
    a3: "Compliment général peu spécifique.",
    a5: "Valorise un effort ou une force précis et authentique.",
  },
  {
    code: "resumes",
    cat: "techniques",
    nom: "Résumés",
    ordre: 4,
    a1: "Ne synthétise jamais, perd le fil.",
    a3: "Résumé partiel et factuel.",
    a5: "Résumé qui relie, fait ressortir le discours-changement, relance.",
  },
  {
    code: "evoquer_discours_changement",
    cat: "processus",
    nom: "Évoquer le discours-changement",
    ordre: 1,
    a1: "Argumente à la place du patient, provoque la résistance.",
    a3: "Tente d'orienter mais sans faire parler le patient du changement.",
    a5: "Fait formuler au patient ses propres raisons de changer.",
  },
  {
    code: "rouler_avec_resistance",
    cat: "processus",
    nom: "Rouler avec la résistance",
    ordre: 2,
    a1: "Confronte, insiste, entre en lutte avec le patient.",
    a3: "Évite l'affrontement mais sans réorienter.",
    a5: "Accueille la résistance et la réoriente avec souplesse.",
  },
  {
    code: "renforcer_engagement",
    cat: "processus",
    nom: "Renforcer l'engagement",
    ordre: 3,
    a1: "Pousse à un plan que le patient n'a pas choisi.",
    a3: "Évoque un objectif vague sans étape concrète.",
    a5: "Aide à formuler un premier pas concret choisi par le patient.",
  },
];

const scenarios = [
  {
    id: "EM-ALC-01",
    titre: "Marc — ambivalence sur l'alcool",
    contexte:
      "Marc, 47 ans, envoyé par son médecin traitant après un bilan hépatique perturbé. Il ne se voit pas comme ayant un problème mais reconnaît boire « plus qu'avant ».",
  },
  {
    id: "EM-TAB-01",
    titre: "Sophie — tabac et tentatives passées",
    contexte:
      "Sophie, 34 ans, fume depuis 15 ans. Plusieurs arrêts suivis de rechutes. Vient « pour voir » à la demande de son conjoint.",
  },
];

type Opt = { text: string; is_best: boolean; score: number; feedback: string };

type DrillSeed = {
  id: string;
  competencyId: string;
  scenario?: string;
  difficulty: number;
  mode: "reconnaissance" | "production";
  rappel: string;
  stimulus: string;
  modele: string;
  reactionSiBon?: string;
  options?: Opt[];
};

const drills: DrillSeed[] = [
  // --- Questions ouvertes ---
  {
    id: "DRL-QO-01",
    competencyId: "questions_ouvertes",
    scenario: "EM-ALC-01",
    difficulty: 1,
    mode: "reconnaissance",
    rappel:
      "Une question ouverte invite à développer ; une fermée appelle oui/non ou oriente déjà la réponse.",
    stimulus: "Je suis là parce que mon médecin a insisté, je vois pas le problème.",
    modele: "Qu'est-ce qui rendrait ce temps utile pour vous, malgré tout ?",
    options: [
      {
        text: "Vous ne pensez pas que vous devriez réduire ?",
        is_best: false,
        score: 0,
        feedback:
          "Question fermée et orientée : elle confronte et fait monter la résistance.",
      },
      {
        text: "Qu'est-ce qui vous amène ici, de votre point de vue ?",
        is_best: true,
        score: 1,
        feedback: "Question ouverte qui respecte son cadre et ouvre l'exploration.",
      },
      {
        text: "Vous buvez depuis combien de temps ?",
        is_best: false,
        score: 0.5,
        feedback:
          "Ouverte mais factuelle et un peu intrusive d'emblée ; elle n'explore pas la motivation.",
      },
    ],
  },
  {
    id: "DRL-QO-02",
    competencyId: "questions_ouvertes",
    scenario: "EM-TAB-01",
    difficulty: 2,
    mode: "production",
    rappel:
      "Privilégiez une question ouverte qui explore la motivation propre du patient, sans l'orienter.",
    stimulus: "Je viens surtout pour faire plaisir à mon conjoint, franchement.",
    reactionSiBon: "C'est vrai que… si je suis honnête, ça me gêne quand même un peu.",
    modele:
      "Qu'est-ce qui, pour vous, vaudrait la peine d'y réfléchir aujourd'hui, au-delà de votre conjoint ?",
  },
  // --- Reflets ---
  {
    id: "DRL-REFLET-01",
    competencyId: "reflets",
    scenario: "EM-ALC-01",
    difficulty: 1,
    mode: "reconnaissance",
    rappel:
      "Un reflet renvoie le vécu du patient. Le reflet complexe ajoute du sens ou nomme l'émotion sous-jacente.",
    stimulus: "Le soir, c'est le seul moment où je décompresse vraiment.",
    modele: "Ce verre, le soir, c'est devenu votre soupape pour relâcher la pression.",
    options: [
      {
        text: "Donc vous buvez tous les soirs.",
        is_best: false,
        score: 0,
        feedback: "Interprétation factuelle et un peu accusatrice, pas un reflet.",
      },
      {
        text: "Vous aimez bien boire le soir.",
        is_best: false,
        score: 0.4,
        feedback: "Reflet simple qui paraphrase sans ajouter de sens.",
      },
      {
        text: "Ce moment, c'est votre façon de relâcher la pression de la journée.",
        is_best: true,
        score: 1,
        feedback: "Reflet complexe : nomme la fonction et le vécu sous-jacent.",
      },
    ],
  },
  {
    id: "DRL-REFLET-02",
    competencyId: "reflets",
    scenario: "EM-ALC-01",
    difficulty: 2,
    mode: "production",
    rappel:
      "Un reflet complexe ne répète pas : il ajoute du sens ou nomme l'émotion sous-jacente, et montre qu'on a compris au-delà des mots.",
    stimulus: "De toute façon j'ai déjà essayé d'arrêter, ça n'a jamais marché.",
    reactionSiBon: "Ouais... c'est exactement ça. J'ai peur de me planter encore.",
    modele:
      "Après ces échecs, vous redoutez qu'une nouvelle tentative finisse pareil.",
  },
  // --- Empathie ---
  {
    id: "DRL-EMP-01",
    competencyId: "empathie",
    scenario: "EM-TAB-01",
    difficulty: 1,
    mode: "reconnaissance",
    rappel:
      "L'empathie accueille le vécu sans juger ni minimiser, et le renvoie au patient.",
    stimulus: "J'ai honte de ne pas y arriver, à mon âge.",
    modele: "Ce sentiment d'échec pèse lourd, et en parler n'est pas facile.",
    options: [
      {
        text: "Il ne faut pas avoir honte, beaucoup de gens y arrivent.",
        is_best: false,
        score: 0.2,
        feedback: "Rassurer trop vite minimise le vécu et coupe l'exploration.",
      },
      {
        text: "Cette honte est difficile à porter, surtout après tant d'efforts.",
        is_best: true,
        score: 1,
        feedback: "Accueille l'émotion et la légitime sans juger.",
      },
      {
        text: "Pourquoi auriez-vous honte ?",
        is_best: false,
        score: 0.4,
        feedback: "Question qui peut sembler rationaliser l'émotion plutôt que l'accueillir.",
      },
    ],
  },
  // --- Non-jugement ---
  {
    id: "DRL-NJ-01",
    competencyId: "non_jugement",
    scenario: "EM-ALC-01",
    difficulty: 1,
    mode: "reconnaissance",
    rappel:
      "Le non-jugement accueille sans reproche et reconnaît la liberté de choix du patient.",
    stimulus: "Oui je bois, et alors ? C'est ma vie après tout.",
    modele: "Vous avez raison, la décision vous appartient entièrement.",
    options: [
      {
        text: "C'est votre vie, et c'est à vous de décider ce qui est bon pour vous.",
        is_best: true,
        score: 1,
        feedback: "Affirme l'autonomie : désamorce la résistance.",
      },
      {
        text: "Sauf que là, votre foie n'est pas d'accord.",
        is_best: false,
        score: 0,
        feedback: "Confrontation : renforce la position défensive.",
      },
      {
        text: "Personne ne vous juge ici.",
        is_best: false,
        score: 0.5,
        feedback: "Intention juste mais générique ; n'affirme pas explicitement le choix.",
      },
    ],
  },
  // --- Collaboration ---
  {
    id: "DRL-COL-01",
    competencyId: "collaboration",
    scenario: "EM-TAB-01",
    difficulty: 1,
    mode: "reconnaissance",
    rappel:
      "La collaboration co-construit : on demande la permission avant de donner un conseil.",
    stimulus: "Bon, vous allez me dire ce que je dois faire, j'imagine.",
    modele: "Est-ce que vous seriez d'accord pour qu'on réfléchisse ensemble aux options ?",
    options: [
      {
        text: "Oui : il faut une substitution nicotinique et un arrêt total dès lundi.",
        is_best: false,
        score: 0.1,
        feedback: "Posture d'expert descendante ; ignore la collaboration.",
      },
      {
        text: "Et vous, qu'avez-vous déjà envisagé ? On peut regarder ensemble.",
        is_best: true,
        score: 1,
        feedback: "Partage le pouvoir et part du patient.",
      },
      {
        text: "Je peux vous donner des pistes si vous voulez.",
        is_best: false,
        score: 0.6,
        feedback: "Demande la permission, bien — mais reste un peu centré sur le conseil.",
      },
    ],
  },
  // --- Valorisations ---
  {
    id: "DRL-VAL-01",
    competencyId: "valorisations",
    scenario: "EM-TAB-01",
    difficulty: 1,
    mode: "reconnaissance",
    rappel: "Une valorisation reconnaît un effort ou une force précis et authentique.",
    stimulus: "J'avais tenu trois mois la dernière fois, avant de rechuter.",
    modele: "Tenir trois mois, c'est une vraie capacité à résister que vous avez montrée.",
    options: [
      {
        text: "Trois mois, c'est déjà la preuve que vous savez le faire.",
        is_best: true,
        score: 1,
        feedback: "Valorise une force précise et réelle, soutient le sentiment d'efficacité.",
      },
      {
        text: "Oui mais vous avez rechuté, donc.",
        is_best: false,
        score: 0,
        feedback: "Annule l'effort, décourage.",
      },
      {
        text: "C'est bien.",
        is_best: false,
        score: 0.4,
        feedback: "Compliment vague et peu spécifique.",
      },
    ],
  },
  // --- Résumés ---
  {
    id: "DRL-RES-01",
    competencyId: "resumes",
    scenario: "EM-ALC-01",
    difficulty: 2,
    mode: "reconnaissance",
    rappel:
      "Un bon résumé relie les éléments, fait ressortir le discours-changement et relance.",
    stimulus:
      "Bon… je bois pour décompresser, mais c'est vrai que le matin je suis vaseux et ça inquiète ma femme.",
    modele:
      "Si je résume : l'alcool vous soulage le soir, et en même temps la fatigue du matin et l'inquiétude de votre femme commencent à compter. Où ça vous mène ?",
    options: [
      {
        text: "Donc vous reconnaissez que vous avez un problème.",
        is_best: false,
        score: 0,
        feedback: "Étiquette et confronte au lieu de relier.",
      },
      {
        text: "Vous décompressez le soir, et la fatigue du matin et l'inquiétude de votre femme pèsent de plus en plus — où ça vous mène ?",
        is_best: true,
        score: 1,
        feedback: "Relie les deux faces de l'ambivalence et relance vers le changement.",
      },
      {
        text: "D'accord, et sinon, vous dormez bien ?",
        is_best: false,
        score: 0.3,
        feedback: "Change de sujet, ne synthétise pas l'ambivalence.",
      },
    ],
  },
  // --- Évoquer le discours-changement ---
  {
    id: "DRL-DC-01",
    competencyId: "evoquer_discours_changement",
    scenario: "EM-ALC-01",
    difficulty: 2,
    mode: "reconnaissance",
    rappel:
      "On fait formuler au patient SES propres raisons de changer, plutôt que de les lui imposer.",
    stimulus: "Je sais que je devrais lever le pied, mais bon…",
    modele: "Qu'est-ce qui vous donne envie de lever le pied, vous ?",
    options: [
      {
        text: "Oui, vous devriez vraiment, pour votre santé.",
        is_best: false,
        score: 0,
        feedback: "Vous prenez le rôle d'argumenter : provoque la contre-argumentation.",
      },
      {
        text: "Qu'est-ce qui vous donnerait envie de lever le pied, de votre côté ?",
        is_best: true,
        score: 1,
        feedback: "Fait verbaliser le discours-changement par le patient lui-même.",
      },
      {
        text: "Sur une échelle de 1 à 10, à combien êtes-vous motivé ?",
        is_best: false,
        score: 0.6,
        feedback: "Outil utile, mais ici on rate l'occasion de faire élaborer le « pourquoi ».",
      },
    ],
  },
  {
    id: "DRL-DC-02",
    competencyId: "evoquer_discours_changement",
    scenario: "EM-ALC-01",
    difficulty: 3,
    mode: "production",
    rappel:
      "Faites élaborer le patient sur ses propres raisons / son importance du changement.",
    stimulus: "Disons que… ça m'embêterait que mes enfants me voient comme ça.",
    reactionSiBon: "Ouais. Je veux qu'ils soient fiers de leur père, pas inquiets.",
    modele: "Vos enfants comptent énormément — dites-m'en plus sur ce que vous voudriez qu'ils voient.",
  },
  // --- Rouler avec la résistance ---
  {
    id: "DRL-RAR-01",
    competencyId: "rouler_avec_resistance",
    scenario: "EM-ALC-01",
    difficulty: 2,
    mode: "reconnaissance",
    rappel:
      "On n'affronte pas la résistance : on l'accueille et on la réoriente avec souplesse.",
    stimulus: "Vous n'allez pas me faire la morale comme les autres, hein ?",
    modele: "Pas du tout — c'est vous qui décidez, je suis là pour vous aider à y voir clair.",
    options: [
      {
        text: "Je ne suis pas là pour vous juger ; c'est vous qui menez, on avance à votre rythme.",
        is_best: true,
        score: 1,
        feedback: "Roule avec la résistance et réaffirme l'autonomie.",
      },
      {
        text: "Quelqu'un doit bien vous dire les choses.",
        is_best: false,
        score: 0,
        feedback: "Entre dans le rapport de force : la résistance va monter.",
      },
      {
        text: "Pourquoi pensez-vous que je vous ferais la morale ?",
        is_best: false,
        score: 0.5,
        feedback: "Pas confrontant, mais détourne vers l'analyse au lieu de rassurer.",
      },
    ],
  },
  // --- Renforcer l'engagement ---
  {
    id: "DRL-ENG-01",
    competencyId: "renforcer_engagement",
    scenario: "EM-TAB-01",
    difficulty: 2,
    mode: "reconnaissance",
    rappel:
      "On aide à formuler un premier pas concret, choisi par le patient (pas imposé).",
    stimulus: "Peut-être que je pourrais essayer de réduire un peu, je sais pas trop.",
    modele: "À quoi ressemblerait un tout premier pas qui vous semblerait réaliste cette semaine ?",
    options: [
      {
        text: "Parfait : vous passez de 20 à 5 cigarettes dès demain.",
        is_best: false,
        score: 0.1,
        feedback: "Objectif imposé et trop ambitieux : fragilise l'engagement.",
      },
      {
        text: "Qu'est-ce qui serait un premier pas réaliste pour vous, cette semaine ?",
        is_best: true,
        score: 1,
        feedback: "Fait choisir un pas concret au patient : engagement renforcé.",
      },
      {
        text: "C'est un bon état d'esprit, continuez comme ça.",
        is_best: false,
        score: 0.4,
        feedback: "Encourageant mais reste vague, sans pas concret.",
      },
    ],
  },
  // --- Exercices supplémentaires (variété) ---
  {
    id: "DRL-EMP-02",
    competencyId: "empathie",
    scenario: "EM-ALC-01",
    difficulty: 2,
    mode: "production",
    rappel:
      "L'empathie reflète le vécu de la personne sans le juger ni vouloir le réparer trop vite.",
    stimulus: "Franchement, personne ne comprend à quel point c'est dur de tenir.",
    reactionSiBon: "Ça fait du bien que quelqu'un l'entende, pour une fois.",
    modele: "Vous vous sentez seul face à un combat que les autres mesurent mal.",
  },
  {
    id: "DRL-NJ-02",
    competencyId: "non_jugement",
    scenario: "EM-ALC-01",
    difficulty: 2,
    mode: "production",
    rappel: "Le non-jugement accueille les choix de la personne et affirme son autonomie.",
    stimulus: "Je sais ce que vous pensez : que je devrais arrêter complètement.",
    reactionSiBon: "D'accord… c'est reposant de ne pas se sentir jugé.",
    modele:
      "Je ne suis pas là pour décider à votre place ; ce qui compte, c'est ce que vous, vous voulez.",
  },
  {
    id: "DRL-COL-02",
    competencyId: "collaboration",
    scenario: "EM-TAB-01",
    difficulty: 2,
    mode: "reconnaissance",
    rappel:
      "Collaborer, c'est demander la permission avant de partager une information ou un conseil.",
    stimulus: "Vous avez des trucs qui marchent contre l'envie de fumer ?",
    modele:
      "Je peux vous partager deux ou trois pistes si vous voulez — vous me direz ce qui vous parle.",
    options: [
      {
        text: "Oui : patchs, gommes, appli de suivi. Commencez par les patchs.",
        is_best: false,
        score: 0.3,
        feedback: "Conseil livré d'emblée, sans demander la permission ni partir du patient.",
      },
      {
        text: "Je peux vous donner quelques pistes, si vous le souhaitez — lesquelles vous tenteraient ?",
        is_best: true,
        score: 1,
        feedback: "Demande la permission et invite le patient à choisir : collaboration.",
      },
      {
        text: "Ça dépend de vous, pas de moi.",
        is_best: false,
        score: 0.4,
        feedback: "Renvoie l'autonomie mais esquive la demande d'aide explicite.",
      },
    ],
  },
  {
    id: "DRL-VAL-02",
    competencyId: "valorisations",
    scenario: "EM-ALC-01",
    difficulty: 2,
    mode: "production",
    rappel: "Une valorisation souligne une force ou un effort précis et sincère.",
    stimulus: "Cette semaine, j'ai réussi à ne pas boire deux soirs de suite.",
    reactionSiBon: "C'est vrai que c'est pas rien, dit comme ça.",
    modele:
      "Deux soirs sans boire, c'est une vraie démonstration de votre capacité à tenir quand vous le décidez.",
  },
  {
    id: "DRL-RES-02",
    competencyId: "resumes",
    scenario: "EM-ALC-01",
    difficulty: 2,
    mode: "production",
    rappel: "Un résumé relie ce qui a été dit et fait ressortir le discours-changement.",
    stimulus:
      "Bon… je décompresse avec l'alcool, mais ma fatigue et l'inquiétude de mes enfants commencent à me peser.",
    reactionSiBon: "Oui… dit comme ça, ça fait réfléchir.",
    modele:
      "Si je résume : l'alcool vous soulage, et en même temps la fatigue et le regard de vos enfants pèsent de plus en plus. Qu'est-ce que vous aimeriez en faire ?",
  },
  {
    id: "DRL-RAR-02",
    competencyId: "rouler_avec_resistance",
    scenario: "EM-ALC-01",
    difficulty: 2,
    mode: "production",
    rappel: "Rouler avec la résistance : on accueille l'opposition au lieu d'argumenter contre.",
    stimulus: "De toute façon, vous allez me dire d'arrêter, comme tout le monde.",
    reactionSiBon: "Ah… ça change. D'accord, je veux bien en parler alors.",
    modele:
      "Pas du tout — c'est vous qui voyez. Mon rôle, c'est de vous aider à y réfléchir, pas de vous dicter quoi faire.",
  },
  {
    id: "DRL-ENG-02",
    competencyId: "renforcer_engagement",
    scenario: "EM-TAB-01",
    difficulty: 2,
    mode: "production",
    rappel:
      "On aide la personne à formuler un premier pas concret et réaliste, qu'elle choisit.",
    stimulus: "Je crois que je suis prêt à essayer de réduire, mais je sais pas par où commencer.",
    reactionSiBon: "Ok, ça je peux le faire. Je commence demain.",
    modele:
      "Quel serait un tout premier pas, simple et réaliste, que vous pourriez tenter cette semaine ?",
  },
  {
    id: "DRL-REFLET-03",
    competencyId: "reflets",
    scenario: "EM-TAB-01",
    difficulty: 2,
    mode: "reconnaissance",
    rappel: "Le reflet complexe nomme l'émotion ou le sens sous les mots.",
    stimulus: "Arrêter, j'y pense, mais à chaque fois je me dégonfle.",
    modele:
      "Quelque chose en vous voudrait arrêter, et en même temps la peur de ne pas y arriver vous retient.",
    options: [
      {
        text: "Donc vous n'êtes pas vraiment motivé.",
        is_best: false,
        score: 0,
        feedback: "Jugement qui nie l'ambivalence et démotive.",
      },
      {
        text: "Une partie de vous veut arrêter, et une autre a peur d'échouer.",
        is_best: true,
        score: 1,
        feedback: "Reflet double face : nomme l'ambivalence avec justesse.",
      },
      {
        text: "Il faut juste vous lancer une bonne fois.",
        is_best: false,
        score: 0.1,
        feedback: "Conseil pressant qui ignore le vécu.",
      },
    ],
  },
  {
    id: "DRL-QO-03",
    competencyId: "questions_ouvertes",
    scenario: "EM-ALC-01",
    difficulty: 2,
    mode: "production",
    rappel: "Une bonne question ouverte explore la motivation propre de la personne.",
    stimulus: "Mon médecin dit que mon foie va mal. Bon.",
    reactionSiBon: "Hm… honnêtement, ça m'inquiète un peu pour mes enfants.",
    modele: "Qu'est-ce que cette nouvelle change pour vous, quand vous y pensez ?",
  },
  {
    id: "DRL-DC-03",
    competencyId: "evoquer_discours_changement",
    scenario: "EM-ALC-01",
    difficulty: 2,
    mode: "reconnaissance",
    rappel:
      "On fait verbaliser au patient ses propres raisons et l'importance du changement.",
    stimulus: "Disons que ça serait peut-être mieux si je levais le pied.",
    modele: "Qu'est-ce qui serait mieux, pour vous, si vous leviez le pied ?",
    options: [
      {
        text: "Oui, votre santé s'améliorerait nettement.",
        is_best: false,
        score: 0.1,
        feedback: "Vous argumentez à sa place : risque de contre-argumentation.",
      },
      {
        text: "Mieux en quoi, pour vous, concrètement ?",
        is_best: true,
        score: 1,
        feedback: "Fait élaborer le patient sur ses propres raisons.",
      },
      {
        text: "Donc vous reconnaissez le problème.",
        is_best: false,
        score: 0.2,
        feedback: "Étiquette qui peut braquer.",
      },
    ],
  },
];

// --- Référentiels supplémentaires (démo) ---------------------------------
// Contenu réaliste mais à VALIDER cliniquement (spec §6/§7). Sert à montrer le
// fonctionnement multi-référentiels (plusieurs tuiles, packs, attribution fine).

type RefDef = {
  fw: string;
  gridId: string;
  nom: string;
  type: string;
  description: string;
  categories: { code: string; nom: string; ordre: number }[];
  competencies: {
    code: string;
    cat: string;
    nom: string;
    ordre: number;
    a1: string;
    a3: string;
    a5: string;
  }[];
  scenarios: { id: string; titre: string; contexte: string }[];
  drills: DrillSeed[];
};

const ACT: RefDef = {
  fw: "act",
  gridId: "act-v1",
  nom: "Thérapie d'acceptation et d'engagement (ACT)",
  type: "approche",
  description:
    "Développer la flexibilité psychologique : accueillir l'expérience, se défaire de l'emprise des pensées, agir vers ses valeurs.",
  categories: [
    { code: "ouverture", nom: "Ouverture", ordre: 1 },
    { code: "centrage", nom: "Centrage", ordre: 2 },
    { code: "engagement", nom: "Engagement", ordre: 3 },
  ],
  competencies: [
    {
      code: "acceptation",
      cat: "ouverture",
      nom: "Acceptation",
      ordre: 1,
      a1: "Cherche à supprimer ou éviter l'émotion du patient.",
      a3: "Invite à tolérer l'émotion sans vraiment l'explorer.",
      a5: "Aide à faire de la place à l'émotion sans lutte ni évitement.",
    },
    {
      code: "defusion",
      cat: "ouverture",
      nom: "Défusion cognitive",
      ordre: 2,
      a1: "Discute le contenu de la pensée comme une vérité à corriger.",
      a3: "Note que c'est « une pensée » sans la travailler.",
      a5: "Aide à observer la pensée comme un événement mental, sans s'y identifier.",
    },
    {
      code: "contact_present",
      cat: "centrage",
      nom: "Contact avec le moment présent",
      ordre: 3,
      a1: "Reste dans le récit du passé/futur, hors de l'ici-maintenant.",
      a3: "Ramène ponctuellement au présent.",
      a5: "Ancre le patient dans l'expérience présente avec souplesse.",
    },
    {
      code: "soi_observateur",
      cat: "centrage",
      nom: "Soi-observateur",
      ordre: 4,
      a1: "Renforce l'identification au contenu (« je suis nul »).",
      a3: "Distingue parfois la personne de ses pensées.",
      a5: "Aide à prendre la perspective du « moi qui observe » ses expériences.",
    },
    {
      code: "valeurs",
      cat: "engagement",
      nom: "Clarification des valeurs",
      ordre: 5,
      a1: "Impose des objectifs ou des normes extérieures.",
      a3: "Évoque ce qui compte sans le préciser.",
      a5: "Fait émerger ce qui compte vraiment pour le patient, en propre.",
    },
    {
      code: "action_engagee",
      cat: "engagement",
      nom: "Action engagée",
      ordre: 6,
      a1: "Pousse à agir sans lien avec les valeurs.",
      a3: "Propose une action vague.",
      a5: "Aide à choisir un pas concret aligné sur une valeur.",
    },
  ],
  scenarios: [
    {
      id: "ACT-ANX-01",
      titre: "Léa — anxiété et évitement",
      contexte:
        "Léa, 29 ans, évite les situations sociales par peur du jugement. Elle voudrait « ne plus jamais être anxieuse ».",
    },
  ],
  drills: [
    {
      id: "DRL-ACT-DEF-01",
      competencyId: "defusion",
      scenario: "ACT-ANX-01",
      difficulty: 1,
      mode: "reconnaissance",
      rappel:
        "La défusion aide à voir une pensée comme un simple événement mental, pas comme une vérité à corriger ou à fuir.",
      stimulus: "Je me dis tout le temps « tu vas te ridiculiser », et c'est vrai.",
      modele:
        "Vous remarquez que l'esprit vous sert souvent cette pensée « tu vas te ridiculiser ». Que se passe-t-il si on l'observe comme une phrase que l'esprit produit ?",
      options: [
        {
          text: "Mais non, vous ne vous ridiculisez pas, regardez les faits.",
          is_best: false,
          score: 0.2,
          feedback: "On débat du contenu (fusion) au lieu de prendre de la distance.",
        },
        {
          text: "Vous remarquez cette pensée « tu vas te ridiculiser » — et si on l'observait comme une phrase que l'esprit propose ?",
          is_best: true,
          score: 1,
          feedback: "Défusion : on observe la pensée comme un événement mental.",
        },
        {
          text: "Essayez de penser à autre chose de positif.",
          is_best: false,
          score: 0.1,
          feedback: "Évitement/suppression : renforce la lutte avec la pensée.",
        },
      ],
    },
    {
      id: "DRL-ACT-VAL-01",
      competencyId: "valeurs",
      scenario: "ACT-ANX-01",
      difficulty: 2,
      mode: "reconnaissance",
      rappel:
        "Clarifier les valeurs = faire émerger ce qui compte vraiment pour le patient, au-delà de la suppression du symptôme.",
      stimulus: "Je veux juste que l'anxiété disparaisse, c'est tout.",
      modele:
        "Si l'anxiété pesait moins, qu'est-ce que vous feriez de votre temps et de vos relations qui compte pour vous ?",
      options: [
        {
          text: "Si l'anxiété pesait moins, qu'est-ce qui deviendrait possible et important pour vous ?",
          is_best: true,
          score: 1,
          feedback: "Réoriente du contrôle du symptôme vers les valeurs.",
        },
        {
          text: "On va faire en sorte de supprimer l'anxiété, oui.",
          is_best: false,
          score: 0.1,
          feedback: "Renforce l'agenda de contrôle, à rebours de l'ACT.",
        },
        {
          text: "L'anxiété est normale, il faut l'accepter.",
          is_best: false,
          score: 0.4,
          feedback: "Idée juste mais assénée, sans faire émerger les valeurs.",
        },
      ],
    },
    {
      id: "DRL-ACT-ACC-01",
      competencyId: "acceptation",
      scenario: "ACT-ANX-01",
      difficulty: 2,
      mode: "reconnaissance",
      rappel:
        "L'acceptation aide à faire de la place à l'émotion sans lutter contre elle ni l'éviter.",
      stimulus: "Quand l'angoisse monte, je fais tout pour la faire partir.",
      modele:
        "Et si, juste un instant, on essayait de laisser cette angoisse être là, sans bagarre, pour voir ce qui change ?",
      options: [
        {
          text: "Et si on laissait l'angoisse être présente un moment, sans lutter, pour voir ?",
          is_best: true,
          score: 1,
          feedback: "Ouvre l'acceptation : faire de la place plutôt que combattre.",
        },
        {
          text: "Voici des techniques pour la faire disparaître vite.",
          is_best: false,
          score: 0.1,
          feedback: "Renforce l'évitement expérientiel.",
        },
        {
          text: "Pourquoi cette angoisse vous dérange-t-elle autant ?",
          is_best: false,
          score: 0.4,
          feedback: "Part dans l'analyse plutôt que l'expérience d'acceptation.",
        },
      ],
    },
  ],
};

const ANAMNESE: RefDef = {
  fw: "anamnese",
  gridId: "anamnese-v1",
  nom: "Mener une anamnèse",
  type: "transversale",
  description:
    "Conduire un premier entretien : poser le cadre, créer l'alliance, recueillir l'information clinique et la synthétiser.",
  categories: [
    { code: "cadre", nom: "Cadre & alliance", ordre: 1 },
    { code: "recueil", nom: "Recueil d'information", ordre: 2 },
    { code: "synthese", nom: "Synthèse", ordre: 3 },
  ],
  competencies: [
    {
      code: "ouverture_entretien",
      cat: "cadre",
      nom: "Ouverture de l'entretien",
      ordre: 1,
      a1: "Entre dans les questions sans poser le cadre.",
      a3: "Présente brièvement le déroulé.",
      a5: "Pose le cadre, le but et le déroulé, met à l'aise.",
    },
    {
      code: "alliance",
      cat: "cadre",
      nom: "Alliance / climat de confiance",
      ordre: 2,
      a1: "Ton froid ou intrusif, le patient se ferme.",
      a3: "Climat correct mais neutre.",
      a5: "Crée un climat chaleureux et sécurisant qui favorise la confidence.",
    },
    {
      code: "motif_consultation",
      cat: "recueil",
      nom: "Explorer le motif de consultation",
      ordre: 3,
      a1: "Présume le motif sans le faire préciser.",
      a3: "Recueille le motif de façon factuelle.",
      a5: "Explore le motif avec le sens et les attentes du patient.",
    },
    {
      code: "histoire_probleme",
      cat: "recueil",
      nom: "Histoire du problème",
      ordre: 4,
      a1: "Saute d'un sujet à l'autre sans chronologie.",
      a3: "Retrace les grandes lignes.",
      a5: "Reconstruit l'évolution (début, facteurs, retentissement) avec clarté.",
    },
    {
      code: "antecedents",
      cat: "recueil",
      nom: "Antécédents",
      ordre: 5,
      a1: "Oublie d'explorer les antécédents.",
      a3: "Aborde quelques antécédents.",
      a5: "Explore antécédents personnels/familiaux pertinents avec tact.",
    },
    {
      code: "reformulation_synthese",
      cat: "synthese",
      nom: "Reformulation & synthèse",
      ordre: 6,
      a1: "Ne reformule jamais, conclut abruptement.",
      a3: "Résume partiellement.",
      a5: "Synthétise fidèlement et valide la compréhension avec le patient.",
    },
  ],
  scenarios: [
    {
      id: "ANA-PREM-01",
      titre: "M. Dubois — premier entretien",
      contexte:
        "M. Dubois, 52 ans, consulte pour la première fois, adressé pour « fatigue et baisse de moral ». Plutôt réservé.",
    },
  ],
  drills: [
    {
      id: "DRL-ANA-OUV-01",
      competencyId: "ouverture_entretien",
      scenario: "ANA-PREM-01",
      difficulty: 1,
      mode: "reconnaissance",
      rappel:
        "Ouvrir un entretien, c'est poser le cadre (but, déroulé, confidentialité) et mettre à l'aise avant de questionner.",
      stimulus: "(Le patient s'assoit, tendu) Bon… par où je commence ?",
      modele:
        "On a environ trois quarts d'heure ; je vais d'abord vous écouter, puis poser quelques questions. Tout ce qui se dit ici reste confidentiel. Prenez le temps.",
      options: [
        {
          text: "Donnez-moi vos antécédents médicaux pour commencer.",
          is_best: false,
          score: 0.1,
          feedback: "Entre dans le questionnaire sans poser le cadre ni rassurer.",
        },
        {
          text: "On a ~45 min : je vous écoute d'abord, puis quelques questions ; tout reste confidentiel. Prenez votre temps.",
          is_best: true,
          score: 1,
          feedback: "Pose le cadre, le déroulé et la confidentialité : sécurise.",
        },
        {
          text: "Comme vous voulez, ça m'est égal.",
          is_best: false,
          score: 0.2,
          feedback: "Laisse le patient sans repère, n'installe pas le cadre.",
        },
      ],
    },
    {
      id: "DRL-ANA-MOT-01",
      competencyId: "motif_consultation",
      scenario: "ANA-PREM-01",
      difficulty: 1,
      mode: "reconnaissance",
      rappel:
        "Explorer le motif = comprendre ce qui amène le patient, avec ses mots, son sens et ses attentes.",
      stimulus: "On m'a dit de venir vous voir parce que je suis fatigué.",
      modele:
        "Qu'est-ce que cette fatigue change dans votre quotidien, et qu'est-ce que vous espéreriez de nos rencontres ?",
      options: [
        {
          text: "Depuis combien de temps exactement, en semaines ?",
          is_best: false,
          score: 0.4,
          feedback: "Factuel d'emblée ; n'explore pas le sens ni les attentes.",
        },
        {
          text: "Qu'est-ce que cette fatigue change pour vous au quotidien, et qu'attendez-vous de nos échanges ?",
          is_best: true,
          score: 1,
          feedback: "Explore le retentissement et les attentes : motif vivant.",
        },
        {
          text: "La fatigue, c'est souvent le stress, vous savez.",
          is_best: false,
          score: 0.1,
          feedback: "Interprétation hâtive qui ferme l'exploration.",
        },
      ],
    },
    {
      id: "DRL-ANA-ALL-01",
      competencyId: "alliance",
      scenario: "ANA-PREM-01",
      difficulty: 2,
      mode: "reconnaissance",
      rappel:
        "L'alliance se crée par un climat chaleureux et sécurisant qui autorise la confidence.",
      stimulus: "Je ne sais pas trop si ça sert à quelque chose de parler de tout ça.",
      modele:
        "C'est légitime de se le demander. On avance à votre rythme, et vous gardez la main sur ce que vous souhaitez aborder.",
      options: [
        {
          text: "C'est compréhensible de se le demander. On ira à votre rythme, vous gardez la main sur ce qu'on aborde.",
          is_best: true,
          score: 1,
          feedback: "Valide le doute et sécurise : renforce l'alliance.",
        },
        {
          text: "Si vous êtes là, c'est que ça sert, non ?",
          is_best: false,
          score: 0.1,
          feedback: "Confronte, peut braquer le patient réservé.",
        },
        {
          text: "Bon, reprenons les questions.",
          is_best: false,
          score: 0.2,
          feedback: "Ignore le ressenti exprimé : occasion d'alliance manquée.",
        },
      ],
    },
  ],
};

async function seedRef(def: RefDef) {
  await prisma.competencyGrid.upsert({
    where: { id: def.gridId },
    update: { nom: `${def.nom} — grille v1` },
    create: { id: def.gridId, nom: `${def.nom} — grille v1` },
  });
  await prisma.framework.upsert({
    where: { id: def.fw },
    update: {
      nom: def.nom,
      type: def.type,
      gridId: def.gridId,
      description: def.description,
      statut: "publie",
    },
    create: {
      id: def.fw,
      nom: def.nom,
      type: def.type,
      gridId: def.gridId,
      description: def.description,
      statut: "publie",
    },
  });
  for (const c of def.categories) {
    await prisma.category.upsert({
      where: { gridId_code: { gridId: def.gridId, code: c.code } },
      update: { nom: c.nom, ordre: c.ordre },
      create: { gridId: def.gridId, code: c.code, nom: c.nom, ordre: c.ordre },
    });
  }
  for (const c of def.competencies) {
    await prisma.competency.upsert({
      where: { gridId_code: { gridId: def.gridId, code: c.code } },
      update: {
        categoryCode: c.cat,
        nom: c.nom,
        ordre: c.ordre,
        ancrage1: c.a1,
        ancrage3: c.a3,
        ancrage5: c.a5,
      },
      create: {
        gridId: def.gridId,
        categoryCode: c.cat,
        code: c.code,
        nom: c.nom,
        ordre: c.ordre,
        ancrage1: c.a1,
        ancrage3: c.a3,
        ancrage5: c.a5,
      },
    });
  }
  for (const s of def.scenarios) {
    await prisma.scenario.upsert({
      where: { id: s.id },
      update: { frameworkId: def.fw, titre: s.titre, contexte: s.contexte },
      create: { id: s.id, frameworkId: def.fw, titre: s.titre, contexte: s.contexte },
    });
  }
  for (const d of def.drills) {
    await prisma.drill.upsert({
      where: { id: d.id },
      update: {
        frameworkId: def.fw,
        competencyId: d.competencyId,
        scenarioContext: d.scenario ?? null,
        difficulty: d.difficulty,
        mode: d.mode,
        rappelTheorique: d.rappel,
        stimulus: d.stimulus,
        options: d.options ?? undefined,
        patientReactionSiBon: d.reactionSiBon ?? null,
        modeleReponse: d.modele,
      },
      create: {
        id: d.id,
        frameworkId: def.fw,
        competencyId: d.competencyId,
        scenarioContext: d.scenario ?? null,
        difficulty: d.difficulty,
        mode: d.mode,
        rappelTheorique: d.rappel,
        stimulus: d.stimulus,
        options: d.options ?? undefined,
        patientReactionSiBon: d.reactionSiBon ?? null,
        modeleReponse: d.modele,
      },
    });
  }
}

const SUPER_ADMIN_EMAIL = "julien.diop@gmail.com";

async function main() {
  console.log("Seed…");

  // --- Fondation multi-tenant -------------------------------------------
  const publicTenant = await prisma.tenant.upsert({
    where: { slug: "public" },
    update: { nom: "TheraSim (site public)", type: "public", statut: "actif" },
    create: { slug: "public", nom: "TheraSim (site public)", type: "public" },
  });

  // Super-admin (toi) — connectable par lien magique avec cet email.
  await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: { role: "super_admin", tenantId: publicTenant.id },
    create: { email: SUPER_ADMIN_EMAIL, role: "super_admin", tenantId: publicTenant.id },
  });

  // Apprenant de démo (pratique pour tester sans email).
  await prisma.user.upsert({
    where: { email: "dev@therasim.local" },
    update: { role: "learner", tenantId: publicTenant.id },
    create: { email: "dev@therasim.local", role: "learner", tenantId: publicTenant.id },
  });

  await prisma.competencyGrid.upsert({
    where: { id: GRID },
    update: { nom: "Entretien motivationnel — grille v1" },
    create: { id: GRID, nom: "Entretien motivationnel — grille v1" },
  });

  await prisma.framework.upsert({
    where: { id: FW },
    update: {
      nom: "Entretien motivationnel",
      type: "approche",
      gridId: GRID,
      description:
        "Faire émerger la motivation au changement par l'écoute, l'évocation et le respect de l'autonomie.",
      statut: "publie",
    },
    create: {
      id: FW,
      nom: "Entretien motivationnel",
      type: "approche",
      gridId: GRID,
      description:
        "Faire émerger la motivation au changement par l'écoute, l'évocation et le respect de l'autonomie.",
      statut: "publie",
    },
  });

  for (const c of categories) {
    await prisma.category.upsert({
      where: { gridId_code: { gridId: GRID, code: c.code } },
      update: { nom: c.nom, ordre: c.ordre },
      create: { gridId: GRID, code: c.code, nom: c.nom, ordre: c.ordre },
    });
  }

  for (const c of competencies) {
    await prisma.competency.upsert({
      where: { gridId_code: { gridId: GRID, code: c.code } },
      update: {
        categoryCode: c.cat,
        nom: c.nom,
        ordre: c.ordre,
        ancrage1: c.a1,
        ancrage3: c.a3,
        ancrage5: c.a5,
      },
      create: {
        gridId: GRID,
        categoryCode: c.cat,
        code: c.code,
        nom: c.nom,
        ordre: c.ordre,
        ancrage1: c.a1,
        ancrage3: c.a3,
        ancrage5: c.a5,
      },
    });
  }

  for (const s of scenarios) {
    await prisma.scenario.upsert({
      where: { id: s.id },
      update: { frameworkId: FW, titre: s.titre, contexte: s.contexte },
      create: { id: s.id, frameworkId: FW, titre: s.titre, contexte: s.contexte },
    });
  }

  for (const d of drills) {
    await prisma.drill.upsert({
      where: { id: d.id },
      update: {
        frameworkId: FW,
        competencyId: d.competencyId,
        scenarioContext: d.scenario ?? null,
        difficulty: d.difficulty,
        mode: d.mode,
        rappelTheorique: d.rappel,
        stimulus: d.stimulus,
        options: d.options ?? undefined,
        patientReactionSiBon: d.reactionSiBon ?? null,
        modeleReponse: d.modele,
      },
      create: {
        id: d.id,
        frameworkId: FW,
        competencyId: d.competencyId,
        scenarioContext: d.scenario ?? null,
        difficulty: d.difficulty,
        mode: d.mode,
        rappelTheorique: d.rappel,
        stimulus: d.stimulus,
        options: d.options ?? undefined,
        patientReactionSiBon: d.reactionSiBon ?? null,
        modeleReponse: d.modele,
      },
    });
  }

  // --- Référentiels supplémentaires de démo -----------------------------
  await seedRef(ACT);
  await seedRef(ANAMNESE);

  // --- Packs ------------------------------------------------------------
  // Helper local : crée un pack, le compose, et l'accorde au tenant public.
  async function seedPack(
    slug: string,
    nom: string,
    description: string,
    frameworkIds: string[],
    grantToPublic: boolean,
  ) {
    const p = await prisma.pack.upsert({
      where: { slug },
      update: { nom, description },
      create: { slug, nom, description },
    });
    for (const fwId of frameworkIds) {
      await prisma.packFramework.upsert({
        where: { packId_frameworkId: { packId: p.id, frameworkId: fwId } },
        update: {},
        create: { packId: p.id, frameworkId: fwId },
      });
    }
    if (grantToPublic) {
      await prisma.tenantPack.upsert({
        where: { tenantId_packId: { tenantId: publicTenant.id, packId: p.id } },
        update: {},
        create: { tenantId: publicTenant.id, packId: p.id },
      });
    }
    return p;
  }

  await seedPack("decouverte", "Découverte", "Pack d'entrée : entretien motivationnel.", [FW], true);
  await seedPack(
    "praticien-plus",
    "Praticien+",
    "Pack complet : EM + ACT + Anamnèse.",
    [FW, ACT.fw, ANAMNESE.fw],
    true,
  );

  const nbFw = await prisma.framework.count({ where: { statut: "publie" } });
  const nbDrills = await prisma.drill.count();
  console.log(
    `OK : tenant public + super-admin (${SUPER_ADMIN_EMAIL}), 2 packs (Découverte, Praticien+), ` +
      `${nbFw} référentiels publiés, ${nbDrills} drills au total.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
