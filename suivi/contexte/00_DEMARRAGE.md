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

## 💳 Activer les paiements (Stripe) — optionnel

Sans ça, `/credits` affiche « paiement en ligne bientôt disponible » et reste utilisable
(l'admin peut toujours créditer manuellement via `/admin/credits`). Pour activer les vrais
paiements (packs de crédits + abonnements) :

1. **Créer un compte Stripe** (ou utiliser l'existant) → récupérer la clé secrète **mode
   test** sur https://dashboard.stripe.com/test/apikeys → `STRIPE_SECRET_KEY` dans `.env`
   (et sur Vercel : Settings → Environment Variables, pour la prod).
2. **Créer les Prices** dans le Dashboard Stripe (https://dashboard.stripe.com/test/products) :
   - 3 Prices **ponctuels** (one-time) pour les packs de crédits (20/50/100 crédits —
     montants visibles dans `src/lib/credits.ts` → `CREDIT_PACKS`).
   - 1 Price **récurrent mensuel** par forfait d'abonnement souhaité (nom/prix/crédits
     accordés : à toi de définir, aucun forfait n'est pré-créé dans le code).
   - Coller chaque Price ID dans `/admin/facturation` (packs) et créer les forfaits
     correspondants dans la même page (abonnements).
3. **Enregistrer le webhook** : Dashboard Stripe → Developers → Webhooks → *Add endpoint* →
   URL `https://<ton-domaine>/api/stripe/webhook` → événements à sélectionner :
   `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `charge.refunded` → copier le **signing secret** →
   `STRIPE_WEBHOOK_SECRET` dans `.env`/Vercel.
   ⚠️ Sans cette étape, les paiements réussissent côté Stripe mais **aucun crédit n'est
   accordé** (c'est le webhook qui déclenche l'octroi).
   ⚠️ `charge.refunded` est utilisé par le programme d'affiliation (reprise de commission en
   cas de remboursement, voir `02_MODULES_FAITS.md` §36) — si l'endpoint était déjà enregistré
   avant ce chantier, **ajouter cet événement** à la liste écoutée depuis le Dashboard
   (Webhooks → l'endpoint existant → *Edit* → cocher `charge.refunded`), pas besoin de
   recréer l'endpoint.
4. **Activer le Customer Portal** : Dashboard Stripe → Settings → Billing → Customer portal
   → *Activate* (nécessaire pour le bouton « Gérer mon abonnement »).
5. `npm run db:push` (nouveaux modèles `SubscriptionPlan`/`UserSubscription`/`StripeEvent`
   + champ `User.stripeCustomerId`).
6. **Tester** sur le site déployé avec la carte de test `4242 4242 4242 4242` (n'importe
   quelle date future, n'importe quel CVC).
7. Une fois validé : remplacer les clés `test` par les clés **live** pour passer en
   production réelle.

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
