# TheraSim

Application d'**entraînement clinique par compétences** : apprendre et s'entraîner sur des
cas cliniques réalistes, du feedback au fil de l'eau jusqu'à l'autonomie complète, avec une
**carte de progression temps réel** (forces / faiblesses / couverture des compétences).

> **Nouvelle session ? Commence par lire [`suivi/contexte/00_DEMARRAGE.md`](suivi/contexte/00_DEMARRAGE.md).**

## Mise en route rapide

```bash
npm install
cp .env.example .env      # puis renseigner DATABASE_URL (base Neon)
npm run db:push           # crée les tables
npm run db:seed           # charge le référentiel EM
npm run dev               # http://localhost:3000
```

## Documentation projet

| Fichier | Contenu |
|---------|---------|
| `suivi/contexte/00_DEMARRAGE.md` | Point d'entrée — à lire en premier |
| `suivi/contexte/01_ARCHITECTURE.md` | Stack, structure, modèle de données, moteur |
| `suivi/contexte/02_MODULES_FAITS.md` | Ce qui est codé |
| `suivi/contexte/03_DECISIONS.md` | Décisions produit & pièges techniques |
| `suivi/contexte/04_RESTE_A_FAIRE.md` | Backlog |
| `suivi/contexte/05_JOURNAL.md` | Historique des sessions |
| `suivi/PLAN_DE_TEST.md` | Plan de test (vivant) |
| `Conception/` | Spécifications produit |

Stack : Next.js 16 · TypeScript · Tailwind v4 · Prisma v7 · Neon (PostgreSQL) · Mistral (évaluateur).
