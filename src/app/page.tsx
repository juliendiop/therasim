import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  Bot,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Dumbbell,
  GraduationCap,
  Layers,
  MessagesSquare,
  Palette,
  Radio,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import DemoDrill from "./demo-drill";

export const dynamic = "force-dynamic";

// Page publique d'acquisition : praticiens/coachs (B2C) + écoles (B2B),
// avec un exercice de démonstration jouable sans compte (et sans LLM).
export default async function LandingPage() {
  const user = await getSessionUser();
  if (user) redirect("/accueil");

  return (
    <div className="animate-in">
      {/* ---- Héro ---- */}
      <section className="mx-auto max-w-3xl pt-8 text-center sm:pt-14">
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ochre)]">
          Simulation clinique pour thérapeutes &amp; coachs
        </span>
        <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
          La pratique clinique, ça s&apos;entraîne.
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-[var(--ink-soft)] sm:text-lg">
          Entraînez vos compétences relationnelles sur des cas réalistes — du feedback
          immédiat à l&apos;entretien complet avec un <b>patient simulé par IA</b> qui
          réagit à votre posture — et visualisez vos progrès, compétence par compétence.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="#demo"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--accent)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--accent-hover)]"
          >
            <Dumbbell className="h-4 w-4" /> Essayer un exercice — gratuit, sans compte
          </a>
          <Link
            href="/inscription"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--accent)] px-6 py-3 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
          >
            Créer un compte <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <p className="mt-4 text-xs text-[var(--muted)]">
          Sans carte bancaire · cas réalistes mais fictifs · outil formatif, non certifiant
        </p>
      </section>

      {/* ---- Démo interactive ---- */}
      <section id="demo" className="mx-auto mt-16 max-w-3xl scroll-mt-24 text-center">
        <h2 className="text-2xl font-semibold tracking-tight">
          Essayez, là, maintenant.
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Un patient vous parle. Que répondez-vous ? Feedback immédiat, comme dans
          l&apos;application.
        </p>
        <div className="mt-6">
          <DemoDrill />
        </div>
      </section>

      {/* ---- Comment ça marche ---- */}
      <section className="mt-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight">
          Du guidé à l&apos;autonome, à votre rythme
        </h2>
        <p className="mx-auto mt-1 max-w-2xl text-center text-sm text-[var(--muted)]">
          Trois niveaux d&apos;entraînement qui se complètent, et une carte de progression
          qui vous montre exactement quoi travailler.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StepCard
            icon={<Dumbbell className="h-5 w-5" />}
            step="Niveau 1"
            titre="Exercices ciblés"
            desc="Une compétence à la fois, feedback immédiat et réponse modèle. Idéal pour débuter ou réviser."
          />
          <StepCard
            icon={<Layers className="h-5 w-5" />}
            step="Niveau 2"
            titre="Mini-scènes guidées"
            desc="Quelques tours d'échange avec un patient simulé, indices à la demande. Le pont vers la vraie pratique."
          />
          <StepCard
            icon={<MessagesSquare className="h-5 w-5" />}
            step="Niveau 3"
            titre="Entretien complet"
            desc="Un entretien entier, sans filet, avec un patient qui réagit à votre posture. Débrief détaillé à la fin."
          />
          <StepCard
            icon={<BarChart3 className="h-5 w-5" />}
            step="En continu"
            titre="Carte de progression"
            desc="Vos forces et vos lacunes, mises à jour à chaque essai. L'application vous route vers ce qu'il faut travailler."
          />
        </div>
      </section>

      {/* ---- IA spécialisée ---- */}
      <section className="mt-20">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-widest text-[var(--ochre)]">
            Une IA spécialisée pour la clinique
          </span>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight">
            Pas un chatbot générique.
          </h2>
          <p className="mx-auto mt-1 max-w-2xl text-sm text-[var(--muted)]">
            MELETA repose sur une IA conçue et paramétrée spécifiquement pour
            l&apos;entraînement clinique : elle joue le patient, évalue vos réponses selon
            des grilles professionnelles, et reste à sa place — celle d&apos;un outil
            d&apos;entraînement.
          </p>
        </div>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="card-soft p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <Bot className="h-5 w-5" />
            </span>
            <h3 className="mt-3 font-semibold">Un patient qui réagit comme en séance</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Confrontez-le, il se braque. Écoutez-le, reflétez, respectez son autonomie —
              il s&apos;ouvre et explore. Son ambivalence est réaliste : il ne «&nbsp;guérit&nbsp;»
              pas en trois répliques.
            </p>
          </div>
          <div className="card-soft p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <ClipboardCheck className="h-5 w-5" />
            </span>
            <h3 className="mt-3 font-semibold">Une évaluation ancrée sur des grilles cliniques</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Chaque compétence est notée selon des critères explicites définis par
              référentiel (entretien motivationnel, ACT, anamnèse…), avec justification et
              citation de vos propres mots — pas une impression générale.
            </p>
          </div>
          <div className="card-soft p-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <h3 className="mt-3 font-semibold">Un cadre maîtrisé</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Des cas fictifs, un feedback formatif, et une IA qui complète la formation et
              la supervision humaines — elle ne les remplace pas et ne certifie rien.
            </p>
          </div>
        </div>
      </section>

      {/* ---- Deux publics ---- */}
      <section className="mt-20 grid gap-6 lg:grid-cols-2">
        {/* Praticiens & coachs (B2C) */}
        <div className="card-soft flex flex-col p-7">
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <Users className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-widest">
              Praticiens &amp; coachs
            </span>
          </div>
          <h3 className="mt-3 text-xl font-semibold tracking-tight">
            Progressez entre deux consultations
          </h3>
          <ul className="mt-4 flex-1 space-y-2.5 text-sm">
            <Feature>Exercices adaptés automatiquement à votre niveau</Feature>
            <Feature>Patient simulé réactif : il se braque si vous confrontez, s&apos;ouvre si vous écoutez</Feature>
            <Feature>Débrief par compétence après chaque mise en situation</Feature>
            <Feature>Crédits de bienvenue offerts à l&apos;inscription</Feature>
          </ul>
          <Link
            href="/inscription"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
          >
            <Sparkles className="h-4 w-4" /> Commencer gratuitement
          </Link>
        </div>

        {/* Écoles & organismes (B2B) */}
        <div className="card-soft flex flex-col border-[var(--accent-border)] p-7">
          <div className="flex items-center gap-2 text-[var(--accent)]">
            <GraduationCap className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-widest">
              Écoles &amp; organismes de formation
            </span>
          </div>
          <h3 className="mt-3 text-xl font-semibold tracking-tight">
            Votre plateforme d&apos;entraînement, à vos couleurs
          </h3>
          <ul className="mt-4 flex-1 space-y-2.5 text-sm">
            <Feature icon={<Palette className="h-4 w-4" />}>
              Marque blanche : votre logo, vos couleurs, votre nom
            </Feature>
            <Feature icon={<Users className="h-4 w-4" />}>
              Gestion de vos apprenants et formateurs, en toute autonomie
            </Feature>
            <Feature icon={<Radio className="h-4 w-4" />}>
              Sessions live pendant vos cours : études de cas animées, résultats projetables
              en direct
            </Feature>
            <Feature icon={<BarChart3 className="h-4 w-4" />}>
              Suivi de la progression de vos cohortes, compétence par compétence
            </Feature>
          </ul>
          <Link
            href="/demande-demo"
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent)] transition hover:bg-[var(--accent-soft)]"
          >
            <Building2 className="h-4 w-4" /> Demander une démo
          </Link>
        </div>
      </section>

      {/* ---- Réassurance ---- */}
      <section className="mx-auto mt-16 max-w-3xl">
        <div className="flex flex-col items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-tint)] p-6 text-center sm:flex-row sm:text-left">
          <ShieldCheck className="h-8 w-8 shrink-0 text-[var(--accent)]" />
          <p className="text-sm text-[var(--ink-soft)]">
            <b>Un cadre sûr pour s&apos;entraîner.</b> Tous les cas sont réalistes mais
            fictifs — jamais de données de patients réels. MELETA est un outil formatif :
            il complète la supervision et la formation, il ne les remplace pas et ne délivre
            aucune certification.
          </p>
        </div>
      </section>

      {/* ---- Bandeau final ---- */}
      <section className="mt-16 rounded-2xl bg-[var(--accent)] px-6 py-10 text-center text-white">
        <h2 className="text-2xl font-semibold tracking-tight">
          Votre prochain patient mérite votre meilleure écoute.
        </h2>
        <p className="mx-auto mt-2 max-w-xl text-sm text-white/80">
          Créez votre compte en une minute — un email suffit — et faites votre premier
          entraînement aujourd&apos;hui.
        </p>
        <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/inscription"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-[var(--accent)] transition hover:bg-white/90"
          >
            <Sparkles className="h-4 w-4" /> Créer mon compte gratuit
          </Link>
          <Link
            href="/demande-demo"
            className="inline-flex items-center gap-2 rounded-lg border border-white/40 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
          >
            <GraduationCap className="h-4 w-4" /> Je représente une école
          </Link>
        </div>
      </section>
    </div>
  );
}

function StepCard({
  icon,
  step,
  titre,
  desc,
}: {
  icon: React.ReactNode;
  step: string;
  titre: string;
  desc: string;
}) {
  return (
    <div className="card-soft p-5">
      <div className="flex items-center justify-between">
        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--accent-soft)] text-[var(--accent)]">
          {icon}
        </span>
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--ochre)]">
          {step}
        </span>
      </div>
      <h3 className="mt-3 font-semibold">{titre}</h3>
      <p className="mt-1 text-sm text-[var(--muted)]">{desc}</p>
    </div>
  );
}

function Feature({
  children,
  icon,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <span className="mt-0.5 shrink-0 text-[var(--accent)]">
        {icon ?? <CheckCircle2 className="h-4 w-4" />}
      </span>
      <span>{children}</span>
    </li>
  );
}
