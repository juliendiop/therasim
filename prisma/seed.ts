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
import bcrypt from "bcryptjs";
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

const MENOPAUSE: RefDef = {
  fw: "menopause",
  gridId: "menopause-v1",
  nom: "Accompagner la transition ménopausique",
  type: "situation",
  description:
    "Accompagner les femmes en transition ménopausique de façon rigoureuse, personnalisée et sécurisée, en complément du suivi médical : repérer le tableau clinique, accompagner la transition émotionnelle et identitaire, orienter et coordonner.",
  categories: [
    { code: "cadre", nom: "Cadre, posture & déontologie", ordre: 1 },
    { code: "reperage", nom: "Repérage & compréhension clinique", ordre: 2 },
    { code: "accompagnement", nom: "Accompagnement de la transition", ordre: 3 },
    { code: "orientation", nom: "Orientation, réseau & suivi", ordre: 4 },
  ],
  competencies: [
    {
      code: "posture_complementaire",
      cat: "cadre",
      nom: "Se positionner en complément du suivi médical",
      ordre: 1,
      a1: "Se substitue au médecin (avis sur les traitements, hormones) ou outrepasse son champ.",
      a3: "Reste prudent mais sans nommer clairement son rôle ni ses limites.",
      a5: "Situe explicitement son accompagnement en complément du suivi médical et reconnaît ses limites de compétence.",
    },
    {
      code: "situer_transition",
      cat: "reperage",
      nom: "Situer la phase et le type de transition",
      ordre: 2,
      a1: "Ignore ou confond les phases ; affirme sans nuance que c'est (ou non) la ménopause.",
      a3: "Repère qu'il s'agit d'une transition hormonale sans la situer précisément.",
      a5: "Situe la phase (pré/péri/post-ménopause) et la nature (naturelle, chirurgicale, précoce), et invite à la confirmation médicale.",
    },
    {
      code: "explorer_tableau",
      cat: "reperage",
      nom: "Explorer le tableau clinique multi-sphères",
      ordre: 3,
      a1: "Se focalise sur un seul symptôme et lui attribue d'emblée une cause unique.",
      a3: "Explore quelques sphères sans relier l'ensemble ni interroger l'origine.",
      a5: "Explore les sphères physique, cognitive, émotionnelle et intime, et distingue l'origine hormonale, réactionnelle ou contextuelle des symptômes.",
    },
    {
      code: "reperer_alarme",
      cat: "reperage",
      nom: "Repérer les signaux d'alarme",
      ordre: 4,
      a1: "Banalise ou ne repère pas un signe nécessitant un avis médical.",
      a3: "Perçoit qu'« il faudrait voir un médecin » sans identifier l'urgence.",
      a5: "Identifie clairement les signaux d'alarme (ex. saignements post-ménopausiques) et oriente sans délai et sans alarmer.",
    },
    {
      code: "aborder_intime",
      cat: "accompagnement",
      nom: "Aborder la sphère intime sans tabou",
      ordre: 5,
      a1: "Évite le sujet, le coupe ou se montre gêné ; la cliente se referme.",
      a3: "Accueille le sujet mais reste vague ou expédie.",
      a5: "Ouvre la parole sur l'intimité (sécheresse, libido, douleurs) avec tact et naturel, en normalisant sans banaliser.",
    },
    {
      code: "accompagner_identite",
      cat: "accompagnement",
      nom: "Accompagner le remaniement identitaire",
      ordre: 6,
      a1: "Minimise (« c'est juste une étape ») ou renvoie aux représentations négatives.",
      a3: "Reconnaît le vécu sans travailler le deuil ni les représentations sociales.",
      a5: "Accompagne le deuil du corps fertile et les remaniements identitaires, et met à distance les représentations sociales pesantes.",
    },
    {
      code: "accompagner_existentiel",
      cat: "accompagnement",
      nom: "Accompagner la dimension émotionnelle et existentielle",
      ordre: 7,
      a1: "Cherche à supprimer l'émotion ou esquive la question de sens.",
      a3: "Écoute l'émotion sans l'ouvrir sur le contexte de vie ni le sens.",
      a5: "Accueille l'émotion et accompagne la transition existentielle (contexte de vie, sens, projets) sans la pathologiser.",
    },
    {
      code: "orienter_coordonner",
      cat: "orientation",
      nom: "Orienter et coordonner un accompagnement pluridisciplinaire",
      ordre: 8,
      a1: "Garde tout pour soi ou oriente au hasard, sans coordination.",
      a3: "Oriente quand c'est nécessaire mais sans articuler avec les autres intervenants.",
      a5: "Oriente au bon moment, vers le bon interlocuteur, et coordonne un accompagnement pluridisciplinaire (qui fait quoi).",
    },
    {
      code: "outil_suivi",
      cat: "orientation",
      nom: "Construire et utiliser un outil de suivi",
      ordre: 9,
      a1: "S'appuie sur des impressions floues, sans repère ni suivi dans le temps.",
      a3: "Note quelques éléments sans trame structurée ni outil validé.",
      a5: "Utilise une trame de bilan transversale et des échelles validées (MRS, MENQOL, GAD-7) pour objectiver et suivre l'évolution.",
    },
  ],
  scenarios: [
    {
      id: "MEN-PERI-01",
      titre: "Sylvie, 47 ans — périménopause non identifiée",
      contexte:
        "Sylvie, 47 ans, consulte pour de l'irritabilité et de l'anxiété qui la surprennent. Elle ne fait pas le lien avec une possible périménopause et se trouve « trop jeune » pour cela.",
    },
    {
      id: "MEN-INST-01",
      titre: "Martine, 53 ans — ménopause installée",
      contexte:
        "Martine, 53 ans, ménopausée depuis deux ans, décrit une déprime persistante et un fort sentiment d'invisibilité, sociale comme intime.",
    },
  ],
  drills: [
    {
      id: "DRL-MEN-POS-01",
      competencyId: "posture_complementaire",
      scenario: "MEN-PERI-01",
      difficulty: 1,
      mode: "reconnaissance",
      rappel:
        "Le thérapeute du bien-être accompagne en complément du suivi médical : il ne prescrit ni ne contre-indique de traitement, et nomme clairement son rôle.",
      stimulus:
        "Vous pensez que je devrais prendre des hormones ? Mon médecin n'en parle pas, mais je suis perdue.",
      modele:
        "La question du traitement hormonal revient à votre médecin, c'est lui qui peut en évaluer l'intérêt pour vous. Mon rôle, à côté de ce suivi, c'est de vous aider à mieux vivre cette transition au quotidien. On peut préparer ensemble les questions à lui poser.",
      options: [
        {
          text: "Franchement, à votre place, je demanderais des hormones, ça aide beaucoup.",
          is_best: false,
          score: 0.1,
          feedback: "Donne un avis médical : sort du champ de compétence du thérapeute.",
        },
        {
          text: "La décision sur les hormones revient à votre médecin ; mon rôle, en complément, est de vous aider à mieux vivre cette transition. Préparons vos questions pour lui.",
          is_best: true,
          score: 1,
          feedback: "Situe clairement le rôle en complément du médical et reste dans son périmètre.",
        },
        {
          text: "Les hormones, c'est dangereux, évitez.",
          is_best: false,
          score: 0,
          feedback: "Contre-indique un traitement : prise de position médicale infondée et hors champ.",
        },
      ],
    },
    {
      id: "DRL-MEN-SIT-01",
      competencyId: "situer_transition",
      scenario: "MEN-PERI-01",
      difficulty: 2,
      mode: "reconnaissance",
      rappel:
        "La périménopause peut débuter dès la fin de la quarantaine, avec des cycles irréguliers et des symptômes fluctuants, avant l'arrêt définitif des règles.",
      stimulus:
        "Mes règles sont devenues irrégulières et j'ai des sautes d'humeur, mais à 47 ans je suis trop jeune pour la ménopause, non ?",
      modele:
        "Ce que vous décrivez peut tout à fait correspondre au début de la transition, la périménopause, qui commence souvent avant la ménopause elle-même. Rien d'anormal à votre âge. Un bilan avec votre médecin permettrait de le confirmer.",
      options: [
        {
          text: "Effectivement, 47 ans c'est trop tôt, ce n'est sûrement pas hormonal.",
          is_best: false,
          score: 0.1,
          feedback: "Écarte à tort la piste hormonale : la périménopause peut commencer avant.",
        },
        {
          text: "Ce que vous décrivez évoque le début de la transition (périménopause), fréquent à cet âge ; un bilan médical permettrait de le confirmer.",
          is_best: true,
          score: 1,
          feedback: "Situe la phase sans trancher médicalement et oriente vers la confirmation.",
        },
        {
          text: "Vous êtes ménopausée, c'est clair.",
          is_best: false,
          score: 0.2,
          feedback: "Affirme un diagnostic catégorique, hors champ et prématuré.",
        },
      ],
    },
    {
      id: "DRL-MEN-TAB-01",
      competencyId: "explorer_tableau",
      scenario: "MEN-INST-01",
      difficulty: 2,
      mode: "production",
      rappel:
        "Explorer le tableau, c'est balayer les différentes sphères (corps, sommeil, cognition, émotions, intimité) et chercher à distinguer ce qui est hormonal, réactionnel ou lié au contexte de vie.",
      stimulus: "Je suis déprimée depuis des mois, je ne me reconnais plus.",
      reactionSiBon:
        "C'est vrai que tout est arrivé en même temps : le sommeil, les enfants partis, et cette impression de ne plus être moi.",
      modele:
        "Quand vous dites « déprimée », j'aimerais comprendre ce qui se passe sur plusieurs plans : votre sommeil, votre énergie, votre moral, mais aussi ce qui a changé dans votre vie ces derniers mois. Est-ce que tout est apparu en même temps, ou progressivement ?",
    },
    {
      id: "DRL-MEN-ALA-01",
      competencyId: "reperer_alarme",
      scenario: "MEN-INST-01",
      difficulty: 2,
      mode: "reconnaissance",
      rappel:
        "Un saignement après la ménopause confirmée (plus de règles depuis un an) est un signal d'alarme qui impose un avis médical, sans affoler la personne.",
      stimulus:
        "C'est bizarre, j'ai eu un petit saignement la semaine dernière alors que je n'ai plus mes règles depuis deux ans.",
      modele:
        "Un saignement qui revient après deux ans sans règles, c'est quelque chose qu'il faut faire vérifier par votre médecin assez rapidement, sans attendre. Ce n'est pas forcément grave, mais c'est important de l'explorer. Voulez-vous qu'on regarde ensemble comment prendre rendez-vous ?",
      options: [
        {
          text: "Ce n'est rien, le corps fait parfois des siennes à la ménopause.",
          is_best: false,
          score: 0,
          feedback: "Banalise un signal d'alarme : un saignement post-ménopausique doit être exploré médicalement.",
        },
        {
          text: "Un saignement après deux ans sans règles est à faire vérifier rapidement par votre médecin, sans attendre. Ce n'est pas forcément grave, mais c'est important.",
          is_best: true,
          score: 1,
          feedback: "Identifie le signal d'alarme et oriente sans délai, sans dramatiser.",
        },
        {
          text: "Il faut foncer aux urgences, ça peut être un cancer.",
          is_best: false,
          score: 0.3,
          feedback: "Oriente, mais de façon alarmante et par un diagnostic hors champ.",
        },
      ],
    },
    {
      id: "DRL-MEN-INT-01",
      competencyId: "aborder_intime",
      scenario: "MEN-INST-01",
      difficulty: 2,
      mode: "reconnaissance",
      rappel:
        "Aborder l'intimité demande d'ouvrir la parole avec tact, de normaliser ces difficultés très fréquentes, sans gêne ni banalisation.",
      stimulus:
        "C'est gênant à dire… avec mon mari, sur le plan intime, ça ne se passe plus très bien depuis quelque temps.",
      modele:
        "Merci de m'en parler, je sais que ce n'est pas toujours simple à aborder. C'est très fréquent pendant cette période, et il y a des choses qui peuvent aider. Voulez-vous me dire ce qui a changé pour vous ?",
      options: [
        {
          text: "Ah, ça, c'est un peu personnel, on va plutôt parler d'autre chose.",
          is_best: false,
          score: 0,
          feedback: "Referme le sujet : la cliente n'osera probablement plus le rouvrir.",
        },
        {
          text: "Merci de m'en parler, ce n'est pas simple à aborder. C'est très fréquent à cette période et des choses peuvent aider. Qu'est-ce qui a changé pour vous ?",
          is_best: true,
          score: 1,
          feedback: "Ouvre la parole avec tact, normalise sans banaliser et invite à poursuivre.",
        },
        {
          text: "C'est normal à votre âge, il faut faire avec.",
          is_best: false,
          score: 0.2,
          feedback: "Banalise et ferme la porte à l'accompagnement.",
        },
      ],
    },
    {
      id: "DRL-MEN-IDE-01",
      competencyId: "accompagner_identite",
      scenario: "MEN-INST-01",
      difficulty: 3,
      mode: "production",
      rappel:
        "Le sentiment d'invisibilité touche à l'identité et aux représentations sociales. On accueille ce vécu et on aide à le mettre à distance, sans le minimiser.",
      stimulus:
        "J'ai l'impression d'être devenue transparente, comme si je ne comptais plus pour personne.",
      reactionSiBon:
        "Oui… c'est exactement ça. Comme si la société m'avait rangée au placard alors que moi je me sens encore pleine de choses.",
      modele:
        "Cette impression de devenir transparente, vous n'êtes pas la seule à la ressentir à cette période, et elle dit beaucoup du regard que la société porte sur les femmes ménopausées. Qu'est-ce qui vous fait vous sentir « transparente » — et, à l'inverse, dans quels moments vous sentez-vous encore pleinement vous-même ?",
    },
    {
      id: "DRL-MEN-EXI-01",
      competencyId: "accompagner_existentiel",
      scenario: "MEN-INST-01",
      difficulty: 3,
      mode: "production",
      rappel:
        "La transition ménopausique est aussi existentielle. On accueille l'émotion et on ouvre sur le sens et le contexte de vie, sans la transformer en pathologie.",
      stimulus:
        "Avec tout ça, je me demande à quoi sert ma vie maintenant que les enfants sont partis.",
      reactionSiBon:
        "C'est vrai que je n'avais jamais pris le temps de me poser cette question pour moi.",
      modele:
        "Cette question du sens arrive souvent quand une étape se referme. Elle est difficile, mais elle ouvre aussi quelque chose. Si on mettait de côté un instant ce qui pèse : qu'est-ce qui, aujourd'hui, compte vraiment pour vous, et qu'aimeriez-vous voir prendre plus de place dans votre vie ?",
    },
    {
      id: "DRL-MEN-ORI-01",
      competencyId: "orienter_coordonner",
      scenario: "MEN-PERI-01",
      difficulty: 2,
      mode: "reconnaissance",
      rappel:
        "Bien accompagner, c'est aussi savoir orienter vers le médecin pour le volet médical et articuler sa place avec les autres intervenants, plutôt que de vouloir tout porter seul.",
      stimulus:
        "J'aimerais qu'on règle tout ensemble, vous et moi. Je n'ai pas envie de voir dix personnes différentes.",
      modele:
        "Je comprends, et on va avancer ensemble sur ce qui relève de mon accompagnement. Pour certains aspects, comme le bilan hormonal ou le sommeil, l'avis de votre médecin sera précieux. L'idée n'est pas de multiplier les interlocuteurs, mais que chacun apporte ce qu'il sait faire de mieux. On peut décider ensemble de qui voit quoi.",
      options: [
        {
          text: "Pas de souci, on va tout gérer ensemble, vous n'avez besoin de personne d'autre.",
          is_best: false,
          score: 0.1,
          feedback: "Garde tout pour soi : néglige le volet médical et sort du périmètre du thérapeute.",
        },
        {
          text: "Avançons ensemble sur mon accompagnement ; pour le volet médical (bilan, sommeil), l'avis de votre médecin sera précieux. Chacun apporte ce qu'il fait de mieux — décidons qui voit quoi.",
          is_best: true,
          score: 1,
          feedback: "Oriente vers le bon interlocuteur et pose une coordination claire, sans multiplier inutilement.",
        },
        {
          text: "Il faudrait quand même voir un médecin, un nutritionniste, un coach sportif…",
          is_best: false,
          score: 0.3,
          feedback: "Oriente tous azimuts, sans articulation ni priorité : peu lisible pour la cliente.",
        },
      ],
    },
    {
      id: "DRL-MEN-SUI-01",
      competencyId: "outil_suivi",
      scenario: "MEN-PERI-01",
      difficulty: 1,
      mode: "reconnaissance",
      rappel:
        "Un outil de suivi (trame de bilan, échelles validées comme MRS, MENQOL ou GAD-7) aide à objectiver les symptômes et à suivre leur évolution dans le temps.",
      stimulus:
        "Je ne sais jamais quoi vous répondre quand vous me demandez comment ça va, tout est un peu flou dans ma tête.",
      modele:
        "C'est normal, tout se mélange. Je vous propose qu'on s'appuie sur une petite grille de suivi : quelques repères simples (sommeil, bouffées, humeur, anxiété) qu'on notera à chaque fois. Comme ça on verra clairement ce qui évolue, et vous n'aurez pas à tout retenir.",
      options: [
        {
          text: "Ce n'est pas grave, dites-moi juste si c'est mieux ou moins bien.",
          is_best: false,
          score: 0.3,
          feedback: "Reste dans le flou : aucune trame ni repère pour suivre l'évolution.",
        },
        {
          text: "Appuyons-nous sur une grille de suivi simple (sommeil, bouffées, humeur, anxiété) notée à chaque séance : on verra ce qui évolue et vous n'aurez pas à tout retenir.",
          is_best: true,
          score: 1,
          feedback: "Propose un outil de suivi structuré et l'explique simplement.",
        },
        {
          text: "Tenez, remplissez ce questionnaire de 60 questions chez vous.",
          is_best: false,
          score: 0.4,
          feedback: "Outil disproportionné et non expliqué : risque d'abandon.",
        },
      ],
    },
    {
      id: "DRL-MEN-TAB-02",
      competencyId: "explorer_tableau",
      scenario: "MEN-PERI-01",
      difficulty: 2,
      mode: "reconnaissance",
      rappel:
        "Devant un symptôme émotionnel, on cherche à distinguer avec la cliente la part hormonale, la part réactionnelle et la part contextuelle, plutôt que d'attribuer une cause unique.",
      stimulus:
        "Je suis irritable et anxieuse tout le temps, je ne me reconnais plus. C'est juste les hormones, non ?",
      modele:
        "Les hormones peuvent y jouer un rôle, c'est vrai — mais ce que vous vivez mêle souvent plusieurs choses : la part hormonale, la réaction à ces changements, et ce que votre vie traverse en ce moment. Regardons ensemble ce qui pèse le plus pour vous.",
      options: [
        {
          text: "Oui, c'est juste les hormones, ça passera tout seul.",
          is_best: false,
          score: 0.2,
          feedback: "Attribue tout à l'hormonal : cause unique, sans exploration.",
        },
        {
          text: "Les hormones y jouent un rôle, mais ça mêle souvent du réactionnel et du contextuel — regardons ce qui pèse le plus pour vous.",
          is_best: true,
          score: 1,
          feedback: "Distingue les origines possibles avec la cliente.",
        },
        {
          text: "Non, l'irritabilité c'est psychologique, ça n'a rien d'hormonal.",
          is_best: false,
          score: 0.2,
          feedback: "Écarte à tort la part hormonale : autre cause unique.",
        },
      ],
    },
    {
      id: "DRL-MEN-INT-02",
      competencyId: "aborder_intime",
      scenario: "MEN-INST-01",
      difficulty: 2,
      mode: "production",
      rappel:
        "Aborder l'intime sans tabou, c'est nommer simplement la difficulté, normaliser, et ouvrir vers le fait qu'il existe des solutions — sans gêne ni euphémisme.",
      stimulus:
        "Les rapports sont devenus douloureux, alors je les évite, et ça crée des tensions avec mon mari.",
      reactionSiBon: "Ça fait du bien d'en parler sans avoir honte.",
      modele:
        "La sécheresse rend souvent les rapports douloureux à cette période, et l'évitement qui suit est une réaction logique, pas un manque d'amour. Il existe des solutions concrètes pour le confort, et on peut aussi réfléchir à comment en parler avec votre mari. On avance à votre rythme.",
    },
    {
      id: "DRL-MEN-IDE-02",
      competencyId: "accompagner_identite",
      scenario: "MEN-INST-01",
      difficulty: 2,
      mode: "reconnaissance",
      rappel:
        "Accompagner le remaniement identitaire, c'est aider à repérer et mettre à distance les représentations sociales intériorisées, sans les renforcer ni les balayer d'un « mais non ».",
      stimulus: "À la ménopause, une femme devient vieille et finie, c'est comme ça.",
      modele:
        "Ce sentiment est réel, et je l'entends. Mais d'où vient cette idée que ménopause égale « vieille et finie » ? C'est une image que la société véhicule beaucoup ; on peut regarder ensemble ce qu'elle vous fait croire sur vous-même, et à quel point elle est juste.",
      options: [
        {
          text: "Mais non, vous n'êtes pas vieille, vous êtes encore très bien !",
          is_best: false,
          score: 0.2,
          feedback: "Rassure en surface sans interroger la représentation intériorisée.",
        },
        {
          text: "Ce sentiment est réel — mais d'où vient cette idée que ménopause = femme finie ? Regardons ensemble ce qu'elle vous fait croire.",
          is_best: true,
          score: 1,
          feedback: "Aide à mettre à distance la représentation sociale.",
        },
        {
          text: "C'est vrai que passé un certain âge, la société nous met de côté.",
          is_best: false,
          score: 0.1,
          feedback: "Renforce le stéréotype au lieu de le travailler.",
        },
      ],
    },
    {
      id: "DRL-MEN-EXI-02",
      competencyId: "accompagner_existentiel",
      scenario: "MEN-PERI-01",
      difficulty: 2,
      mode: "production",
      rappel:
        "Au-delà de ce qui se termine, la transition peut s'ouvrir sur un nouveau chapitre. On accueille la perte sans la nier, et on aide à se réorienter vers ce qui compte.",
      stimulus:
        "J'ai l'impression que mes plus belles années sont derrière moi, qu'il ne me reste plus grand-chose.",
      reactionSiBon: "Tiens, je n'avais pas vu cette période comme un début possible.",
      modele:
        "Cette impression que tout est derrière soi est fréquente quand une étape se referme, et elle mérite d'être entendue. En même temps, beaucoup de femmes redécouvrent à ce moment du temps et de la liberté pour elles. Qu'est-ce qui, aujourd'hui, vous tient encore à cœur et que vous aimeriez voir prendre plus de place ?",
    },
    {
      id: "DRL-MEN-ORI-02",
      competencyId: "orienter_coordonner",
      scenario: "MEN-INST-01",
      difficulty: 3,
      mode: "reconnaissance",
      rappel:
        "Face à un signe de gravité (idées noires), on ne reste pas en silo même si la cliente le demande : on oriente vers le médical en restant présent à ses côtés.",
      stimulus:
        "J'ai des idées noires certains jours, mais je ne veux voir personne d'autre que vous.",
      modele:
        "J'entends que vous préférez que ça reste entre nous, et je ne vous lâche pas. En même temps, des idées noires, c'est quelque chose que je ne peux pas accompagner seul·e en toute sécurité. Je vous propose qu'on trouve ensemble un médecin de confiance, et je reste à vos côtés en parallèle.",
      options: [
        {
          text: "D'accord, on garde ça entre nous alors.",
          is_best: false,
          score: 0,
          feedback: "Accepte un silo dangereux face à des idées noires.",
        },
        {
          text: "Des idées noires, je ne peux pas les accompagner seul·e en sécurité : trouvons ensemble un médecin, et je reste à vos côtés.",
          is_best: true,
          score: 1,
          feedback: "Oriente vers le médical au bon moment sans abandonner la cliente.",
        },
        {
          text: "Il faut aller aux urgences immédiatement.",
          is_best: false,
          score: 0.3,
          feedback: "Oriente mais de façon brutale et non négociée : risque de rupture.",
        },
      ],
    },

    // === Compléments : pour atteindre 5 cartes par compétence ==============

    // --- Se positionner en complément du suivi médical ---------------------
    {
      id: "DRL-MEN-POS-02",
      competencyId: "posture_complementaire",
      scenario: "MEN-PERI-01",
      difficulty: 1,
      mode: "reconnaissance",
      rappel:
        "Poser un diagnostic ne relève pas du thérapeute du bien-être. On reconnaît son rôle et on encourage l'avis médical.",
      stimulus: "Vous pensez que c'est vraiment la ménopause, ou quelque chose de plus grave ?",
      modele:
        "Poser ce diagnostic, c'est le rôle de votre médecin, qui pourra l'explorer précisément. Mon accompagnement vient en complément, pour vous aider à mieux vivre ce que vous traversez. Avez-vous un suivi médical en cours ?",
      options: [
        {
          text: "À mon avis c'est clairement la ménopause, ne vous inquiétez pas.",
          is_best: false,
          score: 0.2,
          feedback: "Pose un diagnostic : hors du champ de compétence du thérapeute.",
        },
        {
          text: "Le diagnostic revient à votre médecin ; mon rôle, en complément, est de vous aider à mieux vivre cette période. Avez-vous un suivi en cours ?",
          is_best: true,
          score: 1,
          feedback: "Renvoie le diagnostic au médecin et situe clairement son rôle complémentaire.",
        },
        {
          text: "Difficile à dire, ça pourrait être grave, méfiez-vous.",
          is_best: false,
          score: 0.1,
          feedback: "Inquiète sans orienter ni clarifier son rôle.",
        },
      ],
    },
    {
      id: "DRL-MEN-POS-03",
      competencyId: "posture_complementaire",
      scenario: "MEN-INST-01",
      difficulty: 2,
      mode: "production",
      rappel:
        "Adapter un traitement relève du prescripteur. Le thérapeute aide à objectiver le vécu pour en discuter avec le médecin.",
      stimulus: "Mon traitement me fatigue, je peux baisser la dose, non ?",
      reactionSiBon: "Vous avez raison, je vais en parler à mon médecin plutôt que de décider seule.",
      modele:
        "La dose de votre traitement, c'est vraiment à votre médecin d'en décider — modifier seule pourrait poser problème. Ce que je peux faire avec vous, c'est noter précisément quand vous vous sentez fatiguée, pour que vous puissiez en parler concrètement avec lui.",
    },
    {
      id: "DRL-MEN-POS-04",
      competencyId: "posture_complementaire",
      scenario: "MEN-INST-01",
      difficulty: 2,
      mode: "reconnaissance",
      rappel:
        "Quand une cliente veut renoncer à son suivi médical, on valorise la complémentarité plutôt que de se substituer au médecin.",
      stimulus: "Mon médecin ne m'écoute pas. Je préfère ne voir que vous, ça me suffit.",
      modele:
        "Je comprends votre frustration, et je suis là pour vous accompagner. En même temps, il y a des choses que seul un médecin peut faire pour vous. Plutôt que de renoncer au suivi, peut-être qu'on peut réfléchir à comment vous faire mieux entendre, ou envisager un autre praticien.",
      options: [
        {
          text: "Vous avez raison, on n'a pas besoin du médecin, on va s'en sortir tous les deux.",
          is_best: false,
          score: 0,
          feedback: "Se substitue au suivi médical : dangereux et hors champ.",
        },
        {
          text: "Je vous accompagne, mais certaines choses relèvent du médecin. Plutôt que de renoncer au suivi, voyons comment vous faire mieux entendre, ou un autre praticien.",
          is_best: true,
          score: 1,
          feedback: "Préserve la complémentarité et aide à maintenir un suivi médical.",
        },
        {
          text: "Il faut absolument retourner voir votre médecin, je ne peux rien pour vous sinon.",
          is_best: false,
          score: 0.4,
          feedback: "Oriente, mais de façon abrupte qui peut faire fuir la cliente.",
        },
      ],
    },
    {
      id: "DRL-MEN-POS-05",
      competencyId: "posture_complementaire",
      scenario: "MEN-PERI-01",
      difficulty: 3,
      mode: "production",
      rappel:
        "Sur les compléments ou plantes, le thérapeute reste prudent : interactions possibles avec un traitement, avis du médecin ou du pharmacien.",
      stimulus: "J'ai vu des compléments de soja contre les bouffées, je peux en prendre ?",
      reactionSiBon: "D'accord, je vérifie avec mon pharmacien avant d'en prendre.",
      modele:
        "C'est une bonne question à poser, mais pas à moi seul : certains compléments peuvent interagir avec des traitements. Le mieux est d'en parler à votre médecin ou votre pharmacien. De mon côté, je peux vous accompagner sur l'hygiène de vie qui agit aussi sur les bouffées.",
    },

    // --- Situer la phase et le type de transition --------------------------
    {
      id: "DRL-MEN-SIT-02",
      competencyId: "situer_transition",
      scenario: "MEN-INST-01",
      difficulty: 1,
      mode: "reconnaissance",
      rappel:
        "La ménopause est confirmée après douze mois consécutifs sans règles. Avant, on est encore dans la transition (périménopause).",
      stimulus: "Mes règles se sont arrêtées il y a huit mois. Ça y est, je suis ménopausée ?",
      modele:
        "On parle de ménopause confirmée après douze mois complets sans règles. À huit mois, vous êtes dans la dernière partie de la transition — c'est tout proche, mais pas encore confirmé. Votre médecin pourra le valider le moment venu.",
      options: [
        {
          text: "Oui, plus de règles = ménopausée, c'est officiel.",
          is_best: false,
          score: 0.2,
          feedback: "Confirme trop tôt : il faut douze mois sans règles.",
        },
        {
          text: "La ménopause se confirme après douze mois sans règles ; à huit mois vous êtes en fin de transition, tout proche. Votre médecin pourra le valider.",
          is_best: true,
          score: 1,
          feedback: "Situe précisément la phase et le critère, et renvoie la confirmation au médecin.",
        },
        {
          text: "Impossible de savoir, ça ne veut rien dire huit mois.",
          is_best: false,
          score: 0.2,
          feedback: "Repère mal : huit mois situe pourtant clairement la phase de transition.",
        },
      ],
    },
    {
      id: "DRL-MEN-SIT-03",
      competencyId: "situer_transition",
      difficulty: 2,
      mode: "production",
      rappel:
        "Après une ablation des ovaires, la ménopause est dite chirurgicale : son installation est souvent brutale, avec des symptômes intenses d'emblée.",
      stimulus: "On m'a retiré les ovaires le mois dernier, et là j'ai plein de symptômes d'un coup.",
      reactionSiBon: "Ah, ça explique pourquoi tout est arrivé si vite, je pensais devenir folle.",
      modele:
        "Ce que vous vivez correspond à une ménopause dite chirurgicale : quand les ovaires sont retirés, la transition ne se fait pas progressivement mais d'un coup, ce qui rend les symptômes souvent plus intenses au début. C'est important d'en parler à votre médecin, et de mon côté je vous accompagne sur ce qui est difficile à vivre.",
    },
    {
      id: "DRL-MEN-SIT-04",
      competencyId: "situer_transition",
      difficulty: 2,
      mode: "reconnaissance",
      rappel:
        "Une ménopause avant 45 ans est dite précoce et mérite une exploration médicale spécifique.",
      stimulus: "J'ai 43 ans et plus de règles depuis un an. C'est beaucoup trop tôt, non ?",
      modele:
        "Effectivement, à 43 ans, on parle de ménopause précoce, et c'est quelque chose qui mérite un bilan médical à part entière. Ce n'est pas anodin et votre médecin saura vous orienter. De mon côté, je vous accompagne sur le vécu de cette nouvelle qui arrive sans doute plus tôt que prévu.",
      options: [
        {
          text: "C'est juste un peu tôt, mais ça arrive, ne creusez pas.",
          is_best: false,
          score: 0.1,
          feedback: "Banalise une ménopause précoce, qui justifie une exploration médicale.",
        },
        {
          text: "À 43 ans, on parle de ménopause précoce : cela mérite un bilan médical spécifique. Je vous accompagne pour le vécu, plus tôt que prévu.",
          is_best: true,
          score: 1,
          feedback: "Nomme la ménopause précoce, oriente vers le bilan et accueille le vécu.",
        },
        {
          text: "C'est sûrement autre chose, à votre âge ce n'est pas possible.",
          is_best: false,
          score: 0.1,
          feedback: "Nie une réalité clinique possible : la ménopause précoce existe.",
        },
      ],
    },
    {
      id: "DRL-MEN-SIT-05",
      competencyId: "situer_transition",
      scenario: "MEN-PERI-01",
      difficulty: 2,
      mode: "production",
      rappel:
        "Clarifier le vocabulaire (périménopause, ménopause, post-ménopause) aide la cliente à se situer et à dédramatiser.",
      stimulus: "Je ne comprends rien : préménopause, périménopause, post-ménopause… c'est quoi la différence ?",
      reactionSiBon: "D'accord, je vois mieux où j'en suis maintenant.",
      modele:
        "C'est normal que ce soit flou. Pour faire simple : la périménopause, c'est la phase de transition où les cycles deviennent irréguliers et où les symptômes apparaissent. La ménopause est confirmée après un an sans règles. Et la post-ménopause, c'est tout ce qui vient après. Où diriez-vous que vous vous situez aujourd'hui ?",
    },

    // --- Explorer le tableau clinique multi-sphères ------------------------
    {
      id: "DRL-MEN-TAB-03",
      competencyId: "explorer_tableau",
      scenario: "MEN-PERI-01",
      difficulty: 1,
      mode: "reconnaissance",
      rappel:
        "Un seul symptôme mis en avant cache souvent un tableau plus large : il faut explorer les autres sphères.",
      stimulus: "Mon seul problème, c'est les bouffées de chaleur, sinon tout va bien.",
      modele:
        "D'accord, les bouffées vous gênent au premier plan. Pendant qu'on y est, comment ça se passe par ailleurs : votre sommeil, votre énergie, votre moral, votre concentration ? Parfois ces choses sont liées sans qu'on le remarque.",
      options: [
        {
          text: "Parfait, alors concentrons-nous uniquement sur les bouffées.",
          is_best: false,
          score: 0.3,
          feedback: "Se limite à un symptôme sans explorer le reste du tableau.",
        },
        {
          text: "Les bouffées vous gênent au premier plan. Et par ailleurs : sommeil, énergie, moral, concentration ? Ces choses sont parfois liées sans qu'on le remarque.",
          is_best: true,
          score: 1,
          feedback: "Ouvre l'exploration aux autres sphères à partir du symptôme cité.",
        },
        {
          text: "Vous avez forcément d'autres symptômes, vous les cachez ?",
          is_best: false,
          score: 0.2,
          feedback: "Explore, mais sur un ton suspicieux qui ferme l'échange.",
        },
      ],
    },
    {
      id: "DRL-MEN-TAB-04",
      competencyId: "explorer_tableau",
      scenario: "MEN-PERI-01",
      difficulty: 2,
      mode: "production",
      rappel:
        "Relier les sphères entre elles (ex. sommeil et humeur) aide à comprendre le tableau plutôt que de traiter chaque symptôme isolément.",
      stimulus: "Je dors très mal et je suis irritable, je m'énerve pour un rien.",
      reactionSiBon: "C'est vrai que quand je dors mieux, je suis beaucoup moins à cran.",
      modele:
        "Le sommeil et l'irritabilité vont souvent de pair : une nuit hachée use les nerfs dès le lendemain. Est-ce que vous remarquez un lien entre vos nuits difficiles et les jours où vous êtes le plus à cran ? Ça nous aiderait à voir par quel bout commencer.",
    },
    {
      id: "DRL-MEN-TAB-05",
      competencyId: "explorer_tableau",
      scenario: "MEN-INST-01",
      difficulty: 3,
      mode: "production",
      rappel:
        "Face à un mal-être vague, on ouvre une exploration large et structurée plutôt que de présumer la cause.",
      stimulus: "Je ne vais pas bien en ce moment, c'est tout, je ne sais pas l'expliquer.",
      reactionSiBon: "Maintenant que vous le dites, c'est surtout le soir et la nuit que ça va moins bien.",
      modele:
        "Prenons le temps de regarder ça ensemble, sans rien présumer. Si on passe en revue différents aspects — le corps, le sommeil, l'humeur, la tête qui tourne, les relations — y a-t-il un domaine où ça coince le plus en ce moment ?",
    },

    // --- Repérer les signaux d'alarme --------------------------------------
    {
      id: "DRL-MEN-ALA-02",
      competencyId: "reperer_alarme",
      difficulty: 2,
      mode: "reconnaissance",
      rappel:
        "Certains symptômes (douleur thoracique à l'effort) ne sont pas attribuables à la ménopause et imposent un avis médical rapide.",
      stimulus: "J'ai une douleur dans la poitrine quand je monte les escaliers, ça doit être l'âge.",
      modele:
        "Une douleur dans la poitrine à l'effort, ce n'est pas quelque chose qu'on met sur le compte de la ménopause ou de l'âge. C'est important de le faire vérifier par un médecin rapidement, sans attendre. Pouvez-vous prendre rendez-vous prochainement ?",
      options: [
        {
          text: "C'est sûrement la ménopause, beaucoup de femmes ont ça.",
          is_best: false,
          score: 0,
          feedback: "Attribue à tort un signe potentiellement grave à la ménopause.",
        },
        {
          text: "Une douleur thoracique à l'effort n'est pas liée à la ménopause : à faire vérifier par un médecin rapidement, sans attendre.",
          is_best: true,
          score: 1,
          feedback: "Repère un signal d'alarme et oriente sans délai.",
        },
        {
          text: "Reposez-vous et évitez les escaliers, ça ira mieux.",
          is_best: false,
          score: 0,
          feedback: "Donne un conseil dangereux au lieu d'orienter.",
        },
      ],
    },
    {
      id: "DRL-MEN-ALA-03",
      competencyId: "reperer_alarme",
      scenario: "MEN-INST-01",
      difficulty: 3,
      mode: "reconnaissance",
      rappel:
        "Des idées noires ou un sentiment que « les autres seraient mieux sans moi » sont à prendre au sérieux : on oriente vers le médecin, sans gérer seul.",
      stimulus: "Parfois je me dis que tout le monde serait mieux sans moi.",
      modele:
        "Merci de me confier ça, c'est important et je le prends très au sérieux. Quand ces pensées sont là, il est essentiel d'en parler à votre médecin sans attendre, et je vais vous aider à le faire. Ces moments-là, on ne doit pas les traverser seule.",
      options: [
        {
          text: "Allons, ne dites pas ça, ça va passer avec le temps.",
          is_best: false,
          score: 0,
          feedback: "Minimise des propos qui doivent alerter et déclencher une orientation.",
        },
        {
          text: "Je prends ça très au sérieux. C'est essentiel d'en parler à votre médecin sans attendre, et je vais vous y aider. On ne traverse pas ces moments seule.",
          is_best: true,
          score: 1,
          feedback: "Accueille, prend au sérieux et oriente vers un avis médical sans délai.",
        },
        {
          text: "On va travailler ça ensemble en séance, pas besoin d'en parler ailleurs.",
          is_best: false,
          score: 0.1,
          feedback: "Tente de gérer seul une situation qui dépasse le cadre du thérapeute.",
        },
      ],
    },
    {
      id: "DRL-MEN-ALA-04",
      competencyId: "reperer_alarme",
      difficulty: 2,
      mode: "production",
      rappel:
        "Un amaigrissement important et inexpliqué n'est pas un symptôme habituel de la ménopause et doit être exploré médicalement.",
      stimulus: "J'ai perdu pas mal de poids ces derniers mois sans rien changer, mais bon, tant mieux.",
      reactionSiBon: "Vu comme ça, c'est vrai que c'est étrange. Je vais prendre rendez-vous.",
      modele:
        "Perdre du poids sans l'avoir cherché, sur plusieurs mois, ce n'est pas un effet attendu de la ménopause. Même si ça vous arrange, c'est le genre de chose qu'il vaut mieux faire vérifier par votre médecin pour s'assurer que tout va bien.",
    },
    {
      id: "DRL-MEN-ALA-05",
      competencyId: "reperer_alarme",
      scenario: "MEN-PERI-01",
      difficulty: 1,
      mode: "reconnaissance",
      rappel:
        "Tout n'est pas un signal d'alarme : savoir reconnaître ce qui est attendu (bouffées fréquentes) évite d'inquiéter inutilement.",
      stimulus: "J'ai des bouffées de chaleur plusieurs fois par jour, je dois m'inquiéter ?",
      modele:
        "Des bouffées plusieurs fois par jour, c'est inconfortable mais très fréquent et attendu à cette période — ce n'est pas un signe inquiétant en soi. On peut tout à fait travailler ensemble pour les rendre plus supportables. Si elles deviennent ingérables, votre médecin a aussi des solutions.",
      options: [
        {
          text: "Plusieurs fois par jour, c'est beaucoup, il faut consulter en urgence.",
          is_best: false,
          score: 0.2,
          feedback: "Sur-alarme : des bouffées fréquentes sont attendues, pas un signal d'urgence.",
        },
        {
          text: "C'est inconfortable mais fréquent et attendu, pas inquiétant en soi. On peut les rendre plus supportables ; si elles deviennent ingérables, votre médecin a des solutions.",
          is_best: true,
          score: 1,
          feedback: "Distingue le symptôme attendu de l'alarme et rassure justement.",
        },
        {
          text: "Bah oui, c'est la ménopause, il faut faire avec, on n'y peut rien.",
          is_best: false,
          score: 0.3,
          feedback: "Rassure mais avec fatalisme, sans ouvrir d'accompagnement.",
        },
      ],
    },

    // --- Aborder la sphère intime sans tabou -------------------------------
    {
      id: "DRL-MEN-INT-03",
      competencyId: "aborder_intime",
      scenario: "MEN-INST-01",
      difficulty: 2,
      mode: "production",
      rappel:
        "Quand une cliente évoque le couple à demi-mot, on ouvre doucement la porte de l'intimité sans forcer.",
      stimulus: "Disons que, côté couple, c'est un peu compliqué en ce moment.",
      reactionSiBon: "C'est vrai que, physiquement aussi, les choses ont changé entre nous.",
      modele:
        "Quand vous dites que c'est compliqué côté couple, ça peut recouvrir beaucoup de choses — la complicité, les tensions, mais aussi l'intimité physique, qui change souvent à cette période. Vous pouvez en dire ce que vous voulez, à votre rythme.",
    },
    {
      id: "DRL-MEN-INT-04",
      competencyId: "aborder_intime",
      scenario: "MEN-INST-01",
      difficulty: 2,
      mode: "production",
      rappel:
        "La baisse de libido se reçoit sans jugement ni dramatisation, en explorant le vécu de la cliente et du couple.",
      stimulus: "Je n'ai plus aucun désir, et mon mari ne comprend pas.",
      reactionSiBon: "Ça me soulage d'entendre que ce n'est pas de ma faute.",
      modele:
        "Cette baisse de désir est quelque chose de fréquent pendant cette période, et ce n'est ni un manque d'amour ni de votre faute. Ça touche aussi votre conjoint, visiblement. Voulez-vous qu'on regarde ce que vous, vous ressentez, et ce qui pourrait vous aider à vous retrouver ?",
    },
    {
      id: "DRL-MEN-INT-05",
      competencyId: "aborder_intime",
      difficulty: 3,
      mode: "reconnaissance",
      rappel:
        "Rester professionnel et accueillant face à des propos intimes très directs : ni gêne qui referme, ni curiosité déplacée.",
      stimulus: "Je vais être très directe : depuis la ménopause, je ne ressens plus rien physiquement, vraiment rien.",
      modele:
        "Merci de votre franchise, c'est précieux pour qu'on puisse avancer. Ce que vous décrivez a souvent une part physique, liée aux changements hormonaux, et une part émotionnelle. Pour bien vous accompagner, est-ce que vous en avez déjà parlé à un médecin ?",
      options: [
        {
          text: "Oh, euh… on peut peut-être garder ça pour une autre fois ?",
          is_best: false,
          score: 0.1,
          feedback: "La gêne du thérapeute referme un sujet que la cliente a osé ouvrir.",
        },
        {
          text: "Merci de votre franchise. Cela a souvent une part physique et une part émotionnelle. Pour bien vous accompagner : en avez-vous parlé à un médecin ?",
          is_best: true,
          score: 1,
          feedback: "Accueille sans gêne ni intrusion et articule avec le suivi médical.",
        },
        {
          text: "Racontez-moi tout en détail, ça m'intéresse beaucoup.",
          is_best: false,
          score: 0.2,
          feedback: "Curiosité déplacée : sort du cadre d'un accompagnement respectueux.",
        },
      ],
    },

    // --- Accompagner le remaniement identitaire ----------------------------
    {
      id: "DRL-MEN-IDE-03",
      competencyId: "accompagner_identite",
      scenario: "MEN-INST-01",
      difficulty: 2,
      mode: "production",
      rappel:
        "Le deuil de la fertilité peut serrer le cœur même sans désir d'enfant : on accueille ce paradoxe sans le rationaliser.",
      stimulus: "Ne plus jamais pouvoir avoir d'enfant, même si je n'en voulais plus, ça me serre le cœur.",
      reactionSiBon: "Oui… c'est étrange de pleurer quelque chose qu'on ne voulait même pas.",
      modele:
        "Ce que vous décrivez est très juste : on peut ne pas vouloir d'enfant et pleurer malgré tout la fin de cette possibilité. Ce n'est pas contradictoire, c'est un vrai deuil — celui d'une page qui se tourne. Vous avez le droit d'être triste pour ça.",
    },
    {
      id: "DRL-MEN-IDE-04",
      competencyId: "accompagner_identite",
      difficulty: 2,
      mode: "reconnaissance",
      rappel:
        "Les représentations sociales négatives de la ménopause pèsent : les nommer et les mettre à distance allège la cliente.",
      stimulus: "À la télé, la ménopause c'est toujours montré comme une catastrophe, des femmes finies.",
      modele:
        "Vous mettez le doigt sur quelque chose d'important : ces images ont la vie dure et elles pèsent sur la façon dont chacune vit sa propre ménopause. Mais ce sont des clichés, pas votre réalité. Et vous, qu'est-ce que vous aimeriez que cette période soit pour vous ?",
      options: [
        {
          text: "C'est vrai que c'est une période plutôt déprimante, ils n'ont pas tort.",
          is_best: false,
          score: 0.1,
          feedback: "Valide le cliché négatif au lieu de le mettre à distance.",
        },
        {
          text: "Ces images ont la vie dure et elles pèsent, mais ce sont des clichés, pas votre réalité. Qu'aimeriez-vous que cette période soit pour vous ?",
          is_best: true,
          score: 1,
          feedback: "Met à distance la représentation sociale et redonne la main à la cliente.",
        },
        {
          text: "Il ne faut pas regarder la télé, c'est tout.",
          is_best: false,
          score: 0.3,
          feedback: "Élude le sujet au lieu de travailler la représentation.",
        },
      ],
    },
    {
      id: "DRL-MEN-IDE-05",
      competencyId: "accompagner_identite",
      scenario: "MEN-INST-01",
      difficulty: 3,
      mode: "production",
      rappel:
        "La ménopause rebat les cartes de l'identité féminine : on accompagne la reconstruction au-delà du « jeune et désirable ».",
      stimulus: "Si je ne suis plus la jeune femme désirable, alors je suis qui, moi, maintenant ?",
      reactionSiBon: "C'est vrai que je ne me suis jamais posé la question autrement que par le regard des autres.",
      modele:
        "Belle et difficile question. Pendant longtemps, on définit beaucoup les femmes par le regard et la jeunesse. Cette période invite, parfois brutalement, à se redéfinir autrement. Si on laissait de côté ce regard extérieur : qu'est-ce qui fait votre valeur, à vos yeux, aujourd'hui ?",
    },

    // --- Accompagner la dimension émotionnelle et existentielle ------------
    {
      id: "DRL-MEN-EXI-03",
      competencyId: "accompagner_existentiel",
      scenario: "MEN-PERI-01",
      difficulty: 2,
      mode: "production",
      rappel:
        "On accueille l'émotion (pleurs, agacement) plutôt que de chercher à la faire taire.",
      stimulus: "Je pleure pour un rien en ce moment, et ça m'agace de ne pas me contrôler.",
      reactionSiBon: "Ça fait du bien d'entendre que je n'ai pas à me contrôler tout le temps.",
      modele:
        "Ces larmes qui montent facilement sont fréquentes pendant cette période, et le fait que ça vous agace est compréhensible. Et si, plutôt que de les contrôler, on regardait ce qu'elles essaient de dire ? Souvent, elles signalent quelque chose qui a besoin d'attention.",
    },
    {
      id: "DRL-MEN-EXI-04",
      competencyId: "accompagner_existentiel",
      scenario: "MEN-INST-01",
      difficulty: 3,
      mode: "reconnaissance",
      rappel:
        "On accueille la souffrance sans poser de diagnostic ; si une vraie dépression est possible, on oriente vers le médecin.",
      stimulus: "Je suis sûrement en dépression, il me faudrait des médicaments, vous ne croyez pas ?",
      modele:
        "Je vois que vous souffrez vraiment, et c'est important. Dire si c'est une dépression et s'il faut un traitement, c'est le rôle de votre médecin — je ne peux pas poser ce diagnostic. Ce que je peux faire, c'est vous aider à mettre des mots sur ce que vous vivez, et vous encourager à en parler à lui. Voulez-vous qu'on prépare ça ?",
      options: [
        {
          text: "Oui, ça ressemble à une dépression, prenez quelque chose.",
          is_best: false,
          score: 0,
          feedback: "Pose un diagnostic et conseille un traitement : hors champ et risqué.",
        },
        {
          text: "Je vois que vous souffrez. Dire si c'est une dépression relève de votre médecin ; moi je vous aide à mettre des mots et à préparer cet échange avec lui.",
          is_best: true,
          score: 1,
          feedback: "Accueille la souffrance, refuse de diagnostiquer et oriente vers le médecin.",
        },
        {
          text: "Mais non, ce n'est pas une dépression, juste un coup de mou hormonal.",
          is_best: false,
          score: 0.1,
          feedback: "Minimise et écarte une piste qui mérite un avis médical.",
        },
      ],
    },
    {
      id: "DRL-MEN-EXI-05",
      competencyId: "accompagner_existentiel",
      scenario: "MEN-INST-01",
      difficulty: 2,
      mode: "reconnaissance",
      rappel:
        "Les questions de sens se reçoivent comme légitimes, sans les transformer en problème à régler.",
      stimulus: "Je me demande ce que je vais bien pouvoir faire des trente prochaines années.",
      modele:
        "C'est une vraie question, et elle a du sens : la ménopause arrive souvent au moment où d'autres choses changent, et elle ouvre une nouvelle étape, longue, encore à inventer. Plutôt qu'un vide, est-ce qu'on pourrait la regarder comme une page un peu blanche ? Qu'est-ce qui vous donnerait envie de vous lever le matin ?",
      options: [
        {
          text: "Ne vous posez pas tant de questions, profitez, c'est tout.",
          is_best: false,
          score: 0.2,
          feedback: "Balaie une question existentielle légitime.",
        },
        {
          text: "C'est une vraie question. Cette étape, longue, est encore à inventer — une page un peu blanche plutôt qu'un vide. Qu'est-ce qui vous donnerait envie de vous lever le matin ?",
          is_best: true,
          score: 1,
          feedback: "Accueille la question de sens et l'ouvre vers le possible.",
        },
        {
          text: "C'est sûr que passé un certain âge, les projets se réduisent.",
          is_best: false,
          score: 0,
          feedback: "Renforce une vision défaitiste de l'avenir.",
        },
      ],
    },

    // --- Orienter et coordonner un accompagnement pluridisciplinaire -------
    {
      id: "DRL-MEN-ORI-03",
      competencyId: "orienter_coordonner",
      scenario: "MEN-INST-01",
      difficulty: 2,
      mode: "reconnaissance",
      rappel:
        "Quand des symptômes deviennent invalidants, on oriente vers le médecin pour le volet médical tout en continuant d'accompagner.",
      stimulus: "Mes bouffées sont invivables, je ne dors plus du tout, je n'en peux plus.",
      modele:
        "À ce niveau-là, ça mérite d'en parler à votre médecin : il existe des options médicales pour soulager des bouffées aussi invalidantes et vous aider à retrouver le sommeil. En parallèle, je continue de vous accompagner sur la façon de tenir au quotidien. On agit sur les deux fronts.",
      options: [
        {
          text: "On va régler ça en séance, pas besoin de médecin.",
          is_best: false,
          score: 0.1,
          feedback: "Garde un problème invalidant qui relève aussi du médical.",
        },
        {
          text: "À ce niveau, parlez-en à votre médecin : il existe des options médicales. En parallèle, je vous accompagne au quotidien. On agit sur les deux fronts.",
          is_best: true,
          score: 1,
          feedback: "Oriente vers le médecin tout en maintenant l'accompagnement.",
        },
        {
          text: "C'est la ménopause, il faut prendre votre mal en patience.",
          is_best: false,
          score: 0,
          feedback: "Fataliste, n'oriente pas vers les solutions existantes.",
        },
      ],
    },
    {
      id: "DRL-MEN-ORI-04",
      competencyId: "orienter_coordonner",
      scenario: "MEN-PERI-01",
      difficulty: 1,
      mode: "reconnaissance",
      rappel:
        "Prescrire relève du médecin. Reconnaître cette limite et orienter fait partie de la compétence.",
      stimulus: "Vous pourriez me prescrire quelque chose pour mieux dormir ?",
      modele:
        "Prescrire un traitement, ce n'est pas de mon ressort — c'est votre médecin qui peut le faire. Ce que je peux vous proposer, c'est de travailler sur ce qui perturbe votre sommeil et sur des routines qui aident. Et si besoin, je vous encourage à aborder la question avec lui.",
      options: [
        {
          text: "Je peux vous conseiller des somnifères en vente libre, oui.",
          is_best: false,
          score: 0.1,
          feedback: "Empiète sur le rôle du prescripteur.",
        },
        {
          text: "Prescrire relève de votre médecin. Moi, je peux travailler sur ce qui perturbe votre sommeil et vos routines, et vous encourager à en parler à lui.",
          is_best: true,
          score: 1,
          feedback: "Reconnaît sa limite, oriente et propose ce qui est dans son champ.",
        },
        {
          text: "Désolé, je ne peux rien pour votre sommeil.",
          is_best: false,
          score: 0.3,
          feedback: "Pose la limite mais sans proposer ce qui relève pourtant de son champ.",
        },
      ],
    },
    {
      id: "DRL-MEN-ORI-05",
      competencyId: "orienter_coordonner",
      scenario: "MEN-INST-01",
      difficulty: 3,
      mode: "production",
      rappel:
        "Aider une cliente perdue, c'est cartographier les besoins et proposer un parcours coordonné, lisible.",
      stimulus: "Je ne sais même pas par où commencer pour me faire aider, tout se mélange.",
      reactionSiBon: "Là, ça devient clair : d'abord le médecin, et on avance ensemble sur le reste.",
      modele:
        "On va y aller dans l'ordre pour que ce soit lisible. Il y a le volet médical — votre médecin, en premier, pour faire le point. Il y a ce qu'on travaille ensemble, le vécu au quotidien. Et selon vos besoins, d'autres relais possibles. Si on devait poser une première étape cette semaine, ce serait laquelle pour vous ?",
    },

    // --- Construire et utiliser un outil de suivi --------------------------
    {
      id: "DRL-MEN-SUI-02",
      competencyId: "outil_suivi",
      scenario: "MEN-PERI-01",
      difficulty: 2,
      mode: "reconnaissance",
      rappel:
        "Une échelle simple et répétée (ex. MRS) permet d'objectiver l'évolution plutôt que de se fier à l'impression du jour.",
      stimulus: "Comment savoir si mes bouffées s'améliorent vraiment, ou si je m'y habitue ?",
      modele:
        "Bonne question — l'impression du jour est trompeuse. Je vous propose qu'on note chaque semaine, sur une petite échelle, leur fréquence et leur intensité. Au bout d'un mois, on verra une vraie tendance, chiffres à l'appui, plutôt que de se fier au ressenti du moment.",
      options: [
        {
          text: "Vous le sentirez bien, faites-vous confiance.",
          is_best: false,
          score: 0.3,
          feedback: "S'en remet au ressenti, justement peu fiable dans la durée.",
        },
        {
          text: "Notons chaque semaine, sur une petite échelle, fréquence et intensité. Au bout d'un mois, on aura une vraie tendance, chiffres à l'appui.",
          is_best: true,
          score: 1,
          feedback: "Propose un suivi chiffré et répété pour objectiver l'évolution.",
        },
        {
          text: "On verra bien à la prochaine séance si vous allez mieux.",
          is_best: false,
          score: 0.2,
          feedback: "Aucun outil ni repère : l'évaluation restera floue.",
        },
      ],
    },
    {
      id: "DRL-MEN-SUI-03",
      competencyId: "outil_suivi",
      scenario: "MEN-INST-01",
      difficulty: 2,
      mode: "production",
      rappel:
        "Un outil de suivi doit rester léger et utile pour la cliente, sinon il est vécu comme une corvée et abandonné.",
      stimulus: "Noter tout ça chaque jour, franchement, c'est encore une corvée de plus.",
      reactionSiBon: "Dit comme ça, trois croix le soir, ça je peux le faire.",
      modele:
        "Je vous rassure : pas question d'un journal interminable. Trois petites croix le soir — sommeil, humeur, bouffées — ça prend dix secondes. Et c'est pour vous d'abord : ça vous évite de tout porter dans la tête et ça nous montre ce qui s'améliore. On peut l'adapter pour que ça ne pèse pas.",
    },
    {
      id: "DRL-MEN-SUI-04",
      competencyId: "outil_suivi",
      scenario: "MEN-PERI-01",
      difficulty: 2,
      mode: "reconnaissance",
      rappel:
        "Un questionnaire validé court (ex. GAD-7 pour l'anxiété) aide à objectiver et à repérer si un avis médical est utile.",
      stimulus: "Mon anxiété, je ne sais pas si c'est normal ou si c'est grave.",
      modele:
        "Pour y voir plus clair, il existe un petit questionnaire de sept questions, validé, qui aide à situer le niveau d'anxiété. On peut le remplir ensemble : ça vous donnera un repère, et si le score est élevé, ce sera un bon signal pour en parler aussi à votre médecin.",
      options: [
        {
          text: "Tout le monde est anxieux à la ménopause, ne vous inquiétez pas.",
          is_best: false,
          score: 0.2,
          feedback: "Banalise sans objectiver ni proposer de repère.",
        },
        {
          text: "Il existe un court questionnaire validé (sept questions) pour situer le niveau d'anxiété. On le remplit ensemble : un score élevé serait un signal à partager avec votre médecin.",
          is_best: true,
          score: 1,
          feedback: "Propose un outil validé et l'articule avec l'orientation médicale.",
        },
        {
          text: "Si vous vous posez la question, c'est sûrement grave.",
          is_best: false,
          score: 0.1,
          feedback: "Inquiète sans évaluer ni proposer d'outil.",
        },
      ],
    },
    {
      id: "DRL-MEN-SUI-05",
      competencyId: "outil_suivi",
      scenario: "MEN-INST-01",
      difficulty: 3,
      mode: "production",
      rappel:
        "Co-construire une fiche de suivi personnalisée renforce l'engagement et l'autonomie de la cliente.",
      stimulus: "J'aimerais bien suivre mon évolution, mais à ma façon, pas avec une grille toute faite.",
      reactionSiBon: "Super, du coup je vais y mettre aussi mon énergie pour le sport, c'est ce qui compte pour moi.",
      modele:
        "Très bonne idée, et c'est même mieux ainsi : une fiche que vous concevez, vous la remplirez vraiment. Partons de ce qui compte le plus pour vous à suivre — disons trois ou quatre repères — et on construit ensemble votre propre trame. Qu'est-ce que vous mettriez en premier ?",
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

  // Super-admin (toi) — lien magique + (si ADMIN_INITIAL_PASSWORD) mot de passe.
  const adminPw = process.env.ADMIN_INITIAL_PASSWORD;
  const adminHash = adminPw ? await bcrypt.hash(adminPw, 12) : undefined;
  await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: { role: "super_admin", tenantId: publicTenant.id, passwordHash: adminHash },
    create: {
      email: SUPER_ADMIN_EMAIL,
      role: "super_admin",
      tenantId: publicTenant.id,
      passwordHash: adminHash,
    },
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
  await seedRef(MENOPAUSE);

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
  await seedPack(
    "menopause",
    "Ménopause",
    "Accompagner la transition ménopausique (formation pluridisciplinaire).",
    [MENOPAUSE.fw],
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
