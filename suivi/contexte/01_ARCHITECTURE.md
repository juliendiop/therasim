# 🏗️ ARCHITECTURE

## Stack détaillée

| Couche | Technologie | Notes |
|--------|-------------|-------|
| Framework | Next.js 16 (App Router, Turbopack) | Server Components + Route Handlers |
| Langage | TypeScript 5 (strict) | |
| UI | Tailwind CSS v4 + composants maison | lucide-react pour les icônes |
| ORM | Prisma v7 | ⚠️ v7 = adaptateur obligatoire (voir 03_DECISIONS) |
| Base de données | Neon (PostgreSQL serverless) | adaptateur `@prisma/adapter-neon` |
| LLM évaluateur | API Mistral (`/v1/chat/completions`) | mode production des drills, temp 0.2, JSON strict |
| Hébergement | Vercel (cible) | pas encore branché |

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
│   └── lib/
│       ├── prisma.ts           # Client Prisma (singleton + adaptateur Neon)
│       ├── user.ts             # Utilisateur courant (dev : utilisateur unique)
│       ├── mastery.ts          # Normalisation, maîtrise, paliers, couverture (§5.1-5.3)
│       ├── routing.ts          # Priorité, difficulté cible, choix de drill (§5.4)
│       ├── next-drill.ts       # Sélection du prochain drill (DB + routing)
│       ├── attempts.ts         # Enregistre un essai + met à jour la carte (§5.5)
│       ├── progress.ts         # Construit la carte (overview + détail) (§5.6)
│       ├── evaluator.ts        # Évaluateur mono-compétence Mistral (§4.3)
│       ├── drill-view.ts       # Vue publique d'un drill (masque les corrigés)
│       └── ui.ts               # Tokens visuels (couleurs par palier)
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

Toutes les tables sont **conscientes du référentiel** (`framework_id` partout) — Option A
de la spec (§2.3) : chaque référentiel a sa propre grille, aucune fusion entre référentiels.

```
User (compte)
Framework (em, …) ──1:1── CompetencyGrid (em-v1)
                               ├──< Category (posture, techniques, processus)
                               └──< Competency (empathie, reflets… + ancrages 1/3/5)
Scenario (EM-ALC-01…) ── framework_id
Drill (DRL-…) ── framework_id + competency_id (+ options JSON si reconnaissance)

Attempt ── user_id + framework_id + competency_id + score[0..1]   (1 ligne / essai)
UserCompetencyState ── PK (user_id, framework_id, competency_id)  (maîtrise agrégée)
```

- **Deux producteurs, une source de vérité** : drills (N1) et simulations (N3) écrivent
  tous des `Attempt`, qui alimentent `UserCompetencyState`. La carte lit cet état.
- **`competency_id`** est le *code* texte (`reflets`), toujours scopé par `framework_id`.
  La même compétence (« empathie ») peut coexister dans `em` et `burnout` sans se mélanger.

Le schéma complet fait foi : `prisma/schema.prisma`.

## Le moteur (logique de la spec §5)

- **Normalisation** : tout score → [0,1]. Note 1-5 → `(note-1)/4`. QCM → `score` de l'option.
- **Maîtrise** : moyenne mobile pondérée récence, `mastery = (1-α)·mastery + α·s`, α=0.4.
- **Paliers** : <0.40 faible · 0.40-0.60 émergent · 0.60-0.80 solide · >0.80 maîtrisé.
- **Couverture** (depuis `attempts`) : 0 jamais · 1-2 effleurée · 3-5 pratiquée · 6+ bien couverte.
- **Oubli** : >21 j sans pratique → « à réviser » (n'abaisse pas la maîtrise, augmente la priorité).
- **Routage** : `priorite = 0.45·(1-mastery) + 0.30·(1-couv_norm) + 0.15·recence + 0.10·pertinence`,
  scopé au référentiel. Difficulté du drill en zone proximale (juste au-dessus de la maîtrise).
