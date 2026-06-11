# 🚀 DÉMARRAGE — À lire en premier pour reprendre le projet

> Point d'entrée pour reprendre **TheraSim** dans une nouvelle session.
> Lis-le en entier, puis consulte les autres fichiers de contexte selon le besoin.

## C'est quoi TheraSim ?

Application d'**entraînement clinique par compétences** pour praticiens (psychologues,
thérapeutes en formation). On apprend et on s'entraîne sur des cas cliniques réalistes,
**du feedback au fil de l'eau jusqu'à l'autonomie complète**, avec une **carte de progression
temps réel** (forces / faiblesses / couverture des compétences). L'autonomie complète sera
éprouvée par des **entretiens simulés** (niveau 3).

Trois niveaux (continuum guidé → autonome) :
- **N1 — Entraînement (drills)** : une compétence isolée, feedback immédiat. ✅ *construit (reconnaissance + production)*
- **N2 — Mini-scènes guidées** : 4 tours, 2 compétences ciblées, indices. ✅ *construit (nécessite MISTRAL_API_KEY)*
- **N3 — Simulation complète** : entretien entier (patient LLM réactif), débrief sommatif. ✅ *construit (nécessite MISTRAL_API_KEY)*

Au-dessus : la **carte de progression** par référentiel, qui visualise la maîtrise et **route**
vers ce qu'il faut travailler.

**Dépôt Git** : https://github.com/juliendiop/therasim (branche `main`).
**Base de données** : Neon (PostgreSQL cloud, région eu-west-2) — déjà en ligne.

> **Spécification de référence** : `Conception/spec-v2-entrainement-progression (1).md`.
> Cette spec étend un MVP « simulateur d'entretien » (deux LLM patient + évaluateur) qui
> reste à construire pour le N3.

## Architecture multi-référentiels (le socle, déjà posé)

Le moteur est **agnostique au contenu**. Ce qui change d'une discipline à l'autre, c'est la
**donnée** : un **référentiel** (`framework`) = une grille de compétences + des cas + des drills.
Ajouter une discipline (ACT, anamnèse, burnout…) = **écrire du contenu, pas du code**.
Règle d'or : **tout se calcule par référentiel, jamais de moyenne entre référentiels.**

Référentiel livré : **EM (entretien motivationnel)**, publié, 10 compétences.

## Stack technique (résumé)

- **Next.js 16** (App Router, Turbopack) + **TypeScript** + **Tailwind CSS v4**
- **Prisma v7** (ORM) + **Neon** (PostgreSQL serverless) via `@prisma/adapter-neon`
- **LLM évaluateur** : API **Mistral** (mode production des drills ; pas requis pour la reconnaissance)
- **Vercel** — déploiement auto (cible ; pas encore branché)

Détails complets : `01_ARCHITECTURE.md`. Choix techniques : `03_DECISIONS.md`.

## ⚙️ Mise en route locale (à faire pour lancer l'app)

L'app **compile** mais a besoin d'une base de données pour tourner. Étapes :

1. **Créer une base Neon** (gratuit) sur https://console.neon.tech → copier la *connection string* (pooled).
2. **Créer le fichier `.env`** à la racine (copier `.env.example`) et y coller :
   ```
   DATABASE_URL="postgresql://...neon.../dbname?sslmode=require"
   ```
   (Optionnel, pour le mode production des drills : `MISTRAL_API_KEY="..."`)
3. **Créer les tables** :
   ```bash
   npm run db:push
   ```
4. **Charger le contenu EM** (référentiel + drills) :
   ```bash
   npm run db:seed
   ```
5. **Lancer l'app** :
   ```bash
   npm run dev
   ```
   → ouvrir http://localhost:3000 (redirige vers `/login`).

### Se connecter (lien magique, sans email en dev)
- Sur `/login`, entre un email puis « Recevoir le lien ». **En dev, le lien s'affiche
  directement à l'écran** (pas d'email à configurer) — clique dessus pour entrer.
- **Super-admin (toi)** : connecte-toi avec `julien.diop@gmail.com` → tu arrives sur la
  **console `/admin`**. Tout autre email crée un apprenant dans le tenant public (B2C).
- Le secret de session `AUTH_SECRET` est déjà dans `.env` (régénérable, voir `.env.example`).

## Commandes utiles

```bash
npm run dev        # serveur de dev (localhost:3000)
npm run build      # build de prod — À LANCER AVANT CHAQUE PUSH (Vercel est strict)
npm run db:push    # crée/met à jour les tables depuis le schéma Prisma
npm run db:seed    # (re)charge le référentiel EM — idempotent
npm run db:studio  # explorer la base visuellement
```

## Parcours de démonstration (pour vérifier que tout marche)

1. `/catalogue` → tuile **Entretien motivationnel**.
2. Clic → **carte de progression** (vide au départ : tout est « non couvert »).
3. Bouton **S'entraîner** → un drill de reconnaissance (QCM).
4. Choisir une option → **feedback immédiat** + réponse modèle + (si bonne réponse) réaction du patient.
5. **Drill suivant** plusieurs fois, puis **Voir ma carte** → la maîtrise et les priorités ont bougé **en temps réel**.

## Où en est-on ?

Voir `02_MODULES_FAITS.md` (ce qui est codé), `04_RESTE_A_FAIRE.md` (backlog) et
`05_JOURNAL.md` (historique des sessions). Plan de test : `../PLAN_DE_TEST.md`.

**Résumé** : socle complet (schéma multi-référentiels, moteur de maîtrise/routage, API),
**tranche verticale "reconnaissance" jouable de bout en bout**, carte de progression temps réel,
référentiel EM seedé. Reste : connexion DB par le porteur, mode production (Mistral) à tester
avec une clé, auth par lien magique, mini-scènes N2, simulation N3.
