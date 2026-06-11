# 🏗️ ARCHITECTURE

## Stack détaillée

| Couche | Technologie | Notes |
|--------|-------------|-------|
| Framework | Next.js 16 (App Router, Turbopack) | Server Components + Route Handlers |
| Langage | TypeScript 5 (strict) | |
| UI | Tailwind CSS v4 + composants maison | lucide-react pour les icônes |
| ORM | Prisma v7 | ⚠️ v7 = adaptateur obligatoire (voir 03_DECISIONS) |
| Base de données | Neon (PostgreSQL) | adaptateur **`@prisma/adapter-pg`** (driver natif, voir 03_DECISIONS) |
| LLM | API Mistral (`/v1/chat/completions`) | évaluateur, patient (N2/N3), génération de cartes ; modèle par usage (`/admin/modeles`) |
| Email | Resend | liens magiques + invitations (`src/lib/email.ts`) |
| Auth | Lien magique + mot de passe (bcrypt) | sessions JWT (jose) en cookie httpOnly |
| Hébergement | **Vercel** (déployé) | repo github.com/juliendiop/therasim, déploiement auto sur push |

## Structure des dossiers

```
TheraSim/
├── Conception/                 # Spécifications (source de vérité produit)
│   └── spec-v2-entrainement-progression (1).md
├── prisma/
│   ├── schema.prisma           # Modèle de données (source de vérité DB)
│   └── seed.ts                 # Contenu du référentiel EM (grille, cas, drills)
├── prisma.config.ts            # Config Prisma v7 (schéma + seed)
├── src/
│   ├── app/
│   │   ├── layout.tsx          # Layout racine (header)
│   │   ├── globals.css         # Tailwind v4 + variables de couleur
│   │   ├── page.tsx            # Redirige vers /catalogue
│   │   ├── catalogue/          # Vue d'ensemble : une tuile par référentiel
│   │   ├── f/[framework_id]/
│   │   │   ├── page.tsx        # Carte de progression détaillée (dashboard)
│   │   │   └── entrainement/   # Route : choisit le drill recommandé + redirige
│   │   ├── drills/[id]/
│   │   │   ├── page.tsx        # Charge le drill (vue publique)
│   │   │   └── drill-player.tsx# Composant client : réponse + feedback (interactif)
│   │   └── api/
│   │       ├── frameworks/                     # GET catalogue
│   │       ├── frameworks/[id]/drills/next/    # GET drill recommandé (routage)
│   │       ├── drills/[id]/                     # GET détail (sans corrigé)
│   │       ├── drills/[id]/attempt/            # POST essai (reco + production)
│   │       ├── me/progress/                     # GET vue d'ensemble
│   │       ├── me/progress/[framework_id]/     # GET carte détaillée
│   │       └── health/                          # GET diagnostic
│   │       ├── auth/                # login (mot de passe), magic-link, callback, logout
│   │       ├── sim/[id]/            # simulateur N3/N2 (message, end, hint)
│   │       └── live/[id]/           # sessions live (join, answer, finish, status, results)
│   ├── app/admin/              # Console super-admin (tenants, packs, référentiels, modèles, compte)
│   ├── app/gestion/            # Espace admin de plateforme (membres : formateurs/apprenants)
│   ├── app/formations/         # Constructeur formations + modules (multi-référentiel)
│   ├── app/sessions/           # Formateur : créer/animer des sessions live
│   ├── app/live/[id]/          # Participant (public) : sas d'attente + étude de cas
│   ├── app/sim/[id]/           # Apprenant : entretien simulé / mini-scène
│   └── lib/
│       ├── prisma.ts           # Client Prisma (singleton + adaptateur pg)
│       ├── auth.ts             # Sessions JWT, rôles, lien magique (server-only)
│       ├── password.ts · email.ts · roles.ts · config.ts   # mdp, emails, rôles, modèle LLM/usage
│       ├── entitlements.ts     # Accès référentiels par tenant (packs + overrides)
│       ├── mastery.ts · routing.ts · next-drill.ts · attempts.ts · progress.ts  # moteur (§5)
│       ├── evaluator.ts · generate.ts · mistral.ts · simulator.ts   # LLM (éval, génération, patient)
│       ├── live.ts             # Sessions live (multi-réf, cycle de vie, résultats)
│       └── drill-view.ts · ui.ts
└── suivi/contexte/             # Ce dossier de suivi
```

## Conventions

- **Server Components par défaut** : les pages font les requêtes Prisma côté serveur
  (catalogue, carte) — pas de fetch interne inutile.
- **Route Handlers** (`api/`) pour ce qui est appelé par le client (soumettre un essai)
  ou pour les redirections de routage (`/entrainement`).
- **Client Components** (`"use client"`) seulement pour l'interactivité (`drill-player.tsx`).
- **Aucune fuite de corrigé** : la bonne réponse d'un QCM (`is_best`/`score`/`feedback`)
  n'est jamais envoyée au front avant la réponse (voir `drill-view.ts` / `publicDrill`).
- **`force-dynamic`** sur les pages/routes qui touchent la DB (données par utilisateur).

## Modèle de données (entités principales)

Tout est **conscient du référentiel** (`framework_id`) ET **multi-tenant** (`tenant_id`).

```
PLATEFORME / TENANCY
  Tenant (public B2C | whitelabel B2B, + branding)
  User ── tenant_id + role (super_admin|tenant_admin|formateur|learner) + passwordHash?
  AuthToken (liens magiques / invitations)         AppConfig (modèle LLM par usage)

CATALOGUE & DROITS
  Framework ──1:1── CompetencyGrid ──< Category ──< Competency (+ ancrages 1/3/5)
  Scenario, Drill (framework_id + competency_id, options JSON si QCM)
  Pack ──< PackFramework      TenantPack / TenantFrameworkOverride  (accès = packs ± overrides)

PROGRESSION (apprenant)
  Attempt (user+tenant+framework+competency, score[0..1])  -> UserCompetencyState (maîtrise)
  SimSession + SimMessage (N2 mini-scène / N3 simulation ; débrief -> Attempt source='simulation')

FORMATIONS & LIVE (formateur)
  Formation ──< FormationModule (items = [{frameworkId, competencies[]}] : MULTI-référentiel)
  LiveSession (pairs = [{frameworkId, code}], cycle brouillon→ouverte→en_cours→fermee)
    ├──< LiveParticipant (anonyme : prénom/nom)
    └──< LiveAnswer (framework_id + competency_id + score)
```

- **Deux producteurs, une source de vérité** : N1 (drills) et N2/N3 (simulations) écrivent
  tous des `Attempt` → `UserCompetencyState`. Les sessions live, elles, sont **séparées**
  (participants anonymes ≠ comptes ; agrégées par session, pas dans la carte personnelle).
- **`competency_id`** = code texte (`reflets`), scopé par `framework_id` (identité = framework+code).
- **Tenant actif** porté par la session JWT (impersonation super-admin = tenant cible).

Le schéma complet fait foi : `prisma/schema.prisma`.

## Le moteur (logique de la spec §5)

- **Normalisation** : tout score → [0,1]. Note 1-5 → `(note-1)/4`. QCM → `score` de l'option.
- **Maîtrise** : moyenne mobile pondérée récence, `mastery = (1-α)·mastery + α·s`, α=0.4.
- **Paliers** : <0.40 faible · 0.40-0.60 émergent · 0.60-0.80 solide · >0.80 maîtrisé.
- **Couverture** (depuis `attempts`) : 0 jamais · 1-2 effleurée · 3-5 pratiquée · 6+ bien couverte.
- **Oubli** : >21 j sans pratique → « à réviser » (n'abaisse pas la maîtrise, augmente la priorité).
- **Routage** : `priorite = 0.45·(1-mastery) + 0.30·(1-couv_norm) + 0.15·recence + 0.10·pertinence`,
  scopé au référentiel. Difficulté du drill en zone proximale (juste au-dessus de la maîtrise).
