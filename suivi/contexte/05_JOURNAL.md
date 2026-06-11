# 📓 JOURNAL DE BORD

Historique chronologique des sessions de travail. Ajouter une entrée à chaque session.

---

## Session 1 — 9 juin 2026

### Conception (en amont du code)
- Lecture de la spec V2 (`Conception/spec-v2-entrainement-progression (1).md`) :
  continuum N1 (drills) → N2 (mini-scènes) → N3 (simulation), carte de progression
  multi-référentiels, architecture « moteur agnostique + référentiels = contenu ».
- Étude du système de suivi de theraflow-pro (dossier `contexte/`) pour s'en inspirer.
- **Décision de stack** (soumise au porteur) : **Next.js / Vercel / Neon** plutôt que
  Go+Postgres de la spec — produit identique, plus simple en solo. Validé.

### Mise en place du projet
- Scaffold manuel Next.js 16 + TypeScript + Tailwind v4 (le nom « TheraSim » a une
  majuscule, refusée par `create-next-app`).
- Branchement Prisma v7 + adaptateur Neon (mêmes réglages éprouvés que theraflow :
  `poolQueryViaFetch`, `webSocketConstructor`).

### Construit (tranche verticale "reconnaissance" + carte)
- **Schéma de données** complet, multi-référentiels (`framework_id` partout).
- **Moteur** : normalisation, maîtrise (moyenne mobile α=0.4), paliers, couverture,
  oubli (>21j), routage adaptatif scopé au référentiel (`mastery.ts`, `routing.ts`,
  `next-drill.ts`, `attempts.ts`, `progress.ts`).
- **API** : frameworks, drills/next, drill détail, attempt (reco + production), me/progress
  (×2), health.
- **Évaluateur Mistral** mono-compétence (mode production), dégrade proprement sans clé.
- **UI** : catalogue, carte de progression détaillée (barres par palier, couverture,
  priorités avec « S'entraîner »), lecteur de drill interactif (feedback immédiat,
  réaction patient, réponse modèle, navigation rejouer/suivant/carte).
- **Contenu** : référentiel **EM** seedé — grille `em-v1`, 3 catégories, 10 compétences
  (ancrages 1/3/5), 2 cas, 14 drills.
- **Suivi de projet** : ce dossier `suivi/contexte/` + `suivi/PLAN_DE_TEST.md`.

### Vérifications
- `npm install` OK (453 paquets, client Prisma généré).
- `npm run build` **OK** (TypeScript strict passe, 13 routes compilées).
- 1 bug corrigé en route : narrowing d'union TS (`result.drillId === null` au lieu de `!result.drillId`).

### État en fin de session
- App **complète et compilée** pour la tranche N1-reconnaissance.
- **Ne tourne pas encore** faute de base : le porteur doit créer une base Neon, mettre
  `DATABASE_URL`, puis `npm run db:push` + `npm run db:seed` (voir `00_DEMARRAGE.md`).

### Prochaine étape suggérée
1. Brancher Neon et dérouler le **parcours de démonstration** (00_DEMARRAGE) → valider la
   tranche reconnaissance + carte temps réel.
2. Tester le **mode production** avec une clé Mistral (DRL-REFLET-02).
3. Choisir le prochain chantier : **auth lien magique**, **compléter le contenu EM**,
   ou attaquer la **mini-scène N2**.

---

## Session 1 (suite) — 10 juin 2026

### Ce qui a été fait
- **Base Neon branchée** par le porteur (région eu-west-2). `.env` renseigné.
- `db:push` OK (tables créées). Premier `db:seed` en échec : driver **serverless** Neon
  bloqué depuis le poste pro (`ECONNREFUSED` sur le fetch HTTP).
- **Bascule sur le driver Postgres natif** `@prisma/adapter-pg` (`src/lib/prisma.ts` + seed).
  → `db:seed` OK : EM chargé (10 compétences, 2 cas, **13 drills**).
- **App lancée et testée de bout en bout** contre la vraie base :
  - `/api/health` → ok, DB ok.
  - `/api/me/progress` → 1 profil EM, aucune moyenne globale.
  - `/api/frameworks/em/drills/next` → renvoie un drill de reconnaissance.
  - `POST attempt` (bonne réponse) → score 1, feedback ; **carte mise à jour en temps réel**
    (la compétence sort des priorités, le routage propose les non abordées). ✅

### Décisions / pièges
- Driver Postgres natif au lieu du serverless Neon (voir 03_DECISIONS).

### Nouvelle demande produit (porteur) — à cadrer
- **Console d'administration** : choisir le modèle LLM par usage (évaluateur, génération,
  patient…), créer/**générer** de nouvelles cartes de compétences, et **gérer la marque
  blanche** + **piloter des clients en marque blanche de façon centralisée** (multi-tenant).
- → Capturé dans `04_RESTE_A_FAIRE.md` (nouvelle phase « Plateforme & Admin »). Cadrage
  d'architecture en cours (modèle de tenancy à trancher).

### État en fin de session
- **Tranche N1-reconnaissance pleinement fonctionnelle sur Neon.** Prête à être utilisée
  via l'UI (`npm run dev` → http://localhost:3000).

### Prochaine étape suggérée
1. Dérouler le parcours dans le navigateur (validation visuelle).
2. Cadrer l'architecture **multi-tenant / marque blanche + admin** (voir backlog).
3. En parallèle possible : Git (gitlab.com) + déploiement Vercel.

---

## Session 2 — 10 juin 2026 — Fondation multi-tenant

### Ce qui a été fait
- **Modèle de données multi-tenant** : `Tenant` (public B2C / whitelabel B2B + branding),
  `User.tenantId` + `User.role` (super_admin / tenant_admin / learner), `tenant_id` sur
  `Attempt` et `UserCompetencyState`. Base réinitialisée (force-reset, données de démo) + push.
- **Catalogue + packs + entitlements** : `Pack`, `PackFramework`, `TenantPack`,
  `TenantFrameworkOverride`. Service `entitlements.ts` (accès = packs + ajouts − retraits).
- **Auth réelle par lien magique** (`auth.ts`, jose) : session JWT en cookie httpOnly, rôles,
  `AuthToken` (usage unique, 15 min). Routes `/api/auth/magic-link|callback|logout` + page
  `/login`. En dev, le lien est affiché à l'écran (pas d'email à configurer).
- **Toutes les pages/routes apprenant** passées en session réelle + **garde d'accès tenant**
  (un tenant ne voit/joue que ses référentiels accordés). Suppression de l'utilisateur de dev unique.
- **Console super-admin** (`/admin`, gardée super_admin) : vue d'ensemble (compteurs), gestion
  des **plateformes clientes** (créer, brancher des packs, **ajustement fin** ajout/retrait par
  référentiel, branding, statut actif/suspendu), gestion des **packs** (créer + composer avec
  les référentiels du catalogue). Mutations via Server Actions.
- **Seed enrichi** : tenant public, super-admin = `julien.diop@gmail.com`, pack « Découverte »
  (→ EM) accordé au tenant public.

### Vérifications (contre la vraie base Neon)
- `npm run build` OK (22 routes).
- Flux testé : `/catalogue` sans session → 307 `/login` ; lien magique → callback → session
  super-admin → `/admin` (200) ; `/api/me/progress` montre EM (via le pack) ; essai enregistré
  avec `tenant_id`. ✅

### Décisions / pièges
- Bascule définitive du driver Neon serverless → `@prisma/adapter-pg` (poste pro).
- Prisma v7 : penser à `prisma generate` après tout changement de schéma (sinon `undefined` au seed).
- Force-reset de la base nécessite un consentement explicite (Prisma) — fait, données de démo only.

### État en fin de session
- **Fondation multi-tenant complète et fonctionnelle.** Connexion réelle, isolation par tenant,
  catalogue/packs/droits pilotables depuis la console super-admin.

### Prochaine étape suggérée
1. **Espace admin tenant** (ton client B2B gère ses apprenants / voit ses stats).
2. **Email réel** des liens magiques (Resend) — aujourd'hui affiché à l'écran en dev.
3. **Application du branding** côté apprenant (logo/couleurs/sous-domaine).
4. Puis : config LLM par usage, génération de cartes par IA (briques A & B de la phase plateforme).

---

## Session 2 (suite) — 10 juin 2026 — Contenu : référentiels de démo + admin de contenu

### Ce qui a été fait
- **B — 2 référentiels de démo** ajoutés au seed via une fonction générique `seedRef` :
  **ACT** (6 compétences, 3 drills) et **Anamnèse** (6 compétences, 3 drills). Total : 3
  référentiels publiés, 19 drills. Pack **« Praticien+ »** (EM+ACT+Anamnèse) créé et accordé
  au tenant public → le catalogue affiche maintenant 3 tuiles.
- **A — Admin de contenu** (`/admin/referentiels`) :
  - Liste du catalogue + **création d'un référentiel** (→ framework + grille, en brouillon).
  - **Écran détail = voir ET éditer tout le contenu** : métadonnées, statut
    (brouillon/calibré/publié), catégories (ajout/suppr), compétences (ajout/suppr + ancrages
    1/3/5), et **toutes les cartes** par compétence (aperçu stimulus + options, suppression).
  - **Création de carte** (`/cartes/nouvelle`) : éditeur reconnaissance (options dynamiques,
    meilleure réponse, scores, feedback) ou production, + **génération d'un brouillon par IA**
    (Mistral) qui pré-remplit les champs (dégrade si pas de clé).
- Fichiers : `prisma/seed.ts` (ACT/ANAMNESE/seedRef), `src/lib/generate.ts`,
  `src/app/admin/referentiels/**`.

### Vérifications
- Seed OK (3 référentiels, 19 drills, 2 packs). Public tenant → accès em+act+anamnese (vérifié).
- `npm run build` OK (25 routes). Routes admin de contenu : garde super-admin OK (307 si anon).

### État en fin de session
- **Création de contenu self-service opérationnelle** : tu peux créer un référentiel, sa
  structure et ses cartes (à la main ou générées par IA), puis le publier — sans code.

### Prochaine étape suggérée
1. **Édition d'une carte existante** (aujourd'hui : créer + supprimer ; pas encore ré-éditer).
2. **Gestion des cas (scenarios)** dans l'admin (aujourd'hui via seed).
3. Espace **admin tenant** + **email réel** (Resend) + **application du branding**.
4. **Config LLM par usage** (brique A.config) : choisir le modèle évaluateur/génération en base.

---

## Session 2 (suite) — 10 juin 2026 — Simulateur N3 (entretien simulé)

### Cadrage (la spec MVP manquait — définie avec le porteur)
- **Fin** : libre + bouton « Terminer » (arrêt de sécurité ~15 tours).
- **Patient RÉACTIF** : son ouverture/résistance évolue selon la posture du praticien.
- **Débrief complet** : note par compétence (→ carte) + retour narratif + 2-3 moments clés.

### Ce qui a été fait
- **Modèle** : `SimSession` (statut, débrief JSON) + `SimMessage` (transcript). Push additif.
- **Moteur** (`src/lib/simulator.ts`) : `startSimulation` (1re réplique patient),
  `patientReply` (patient LLM réactif, voit tout le transcript), `endSimulation` (évaluateur
  multi-compétences → débrief → écrit un `Attempt` par compétence, **source='simulation'**,
  alimente la même carte que les drills). Helper `src/lib/mistral.ts`.
- **API** : `/api/sim/[id]/message`, `/api/sim/[id]/end` (+ action `startSimulationAction`).
- **UI** : `/f/[id]/simulation` (choix du cas), `/sim/[id]` (chat + bouton Terminer + débrief),
  bouton « Entretien simulé » sur la carte du référentiel.

### Vérifications
- `npm run build` OK (28 routes). Smoke : création de session + 1er message patient OK (DB).
- ⚠️ La conversation + le débrief **nécessitent `MISTRAL_API_KEY`** (patient et évaluateur =
  LLM). Sans clé : la session démarre (ouverture neutre) mais le patient ne répond pas (503 clair).

### État en fin de session
- **Les 3 niveaux du continuum existent** : N1 (drills) ✅, N3 (simulation) ✅. N2 (mini-scènes)
  reste à faire. Le simulateur nourrit automatiquement la carte de progression.

### Prochaine étape suggérée
1. **Ajouter `MISTRAL_API_KEY`** dans `.env` pour tester production + simulateur en vrai.
2. **N2 — mini-scènes guidées** (3-5 tours, indices), entre le drill et la simulation.
3. **Calibration de l'évaluateur** (EM d'abord) avant usage sérieux (spec §6).

---

## Session 2 (suite) — 10 juin 2026 — N2 : mini-scènes guidées

### Cadrage
- Spec : 3-5 tours, **2 compétences ciblées**, **indices possibles**. Pont N1→N3.
- Choix : version **dynamique** — la mini-scène cible automatiquement les **2 compétences
  prioritaires** de l'apprenant (routage §5.4 réutilisé), 4 tours, indices à la demande.

### Ce qui a été fait
- Réutilise le **moteur patient du N3**. `SimSession` étendu : `kind` ('simulation'|'miniscene'),
  `maxTurns`, `focus` (codes des 2 compétences). Push additif.
- `simulator.ts` : `startSimulation` paramétré (kind/focus/maxTurns) ; `endSimulation` débriefe
  **uniquement les 2 compétences ciblées** en mini-scène ; `generateHint` (indice ciblé LLM).
- Helper `topPriorityCodes` (next-drill.ts) pour choisir les 2 priorités.
- API `/api/sim/[id]/hint` ; action `startMiniSceneAction`.
- UI : bouton **« Mini-scène guidée »** sur la carte ; page `/sim/[id]` réutilisée avec
  bannière objectif, bouton **Indice**, et **borne de tours** (saisie bloquée → Terminer).

### Vérifications
- `npm run build` OK (30 routes). Smoke : création mini-scène (focus + maxTurns stockés) OK.
- ⚠️ Comme le N3, nécessite `MISTRAL_API_KEY` pour la conversation/indices/débrief.

### État en fin de session
- **Continuum complet : N1 ✅ · N2 ✅ · N3 ✅.** Les trois alimentent la même carte de progression.

### Prochaine étape suggérée
1. **Clé Mistral** pour tout tester en vrai (production, N2, N3).
2. Calibration des évaluateurs (spec §6) ; espace admin tenant ; email réel ; déploiement Vercel.

---

## Session 2 (suite) — 11 juin 2026 — Clé Mistral + config modèles

### Ce qui a été fait
- **Clé Mistral installée** dans `.env` (palier gratuit), modèle par défaut = `mistral-small-latest`.
  Test API réel OK (le patient répond en personnage). `/api/health` → `MISTRAL_API_KEY: true`.
- **Config des modèles par usage depuis l'admin** : table `app_config`, `src/lib/config.ts`
  (`getModel('patient'|'evaluateur'|'generation')`), page **`/admin/modeles`**. Tous les sites
  d'appel (évaluateur drills, simulateur patient, débrief, indices, génération de cartes) lisent
  désormais le modèle de leur usage (défaut `.env` si non réglé).
- Serveur redémarré pour charger la clé.

### État en fin de session
- **Toutes les fonctions IA sont actives** : production drills, mini-scènes N2, simulateur N3,
  génération de cartes. Le modèle est pilotable sans redéploiement depuis `/admin/modeles`.

### Prochaine étape suggérée
- Faire un **vrai entretien simulé** de bout en bout (validation). Puis : calibration évaluateur,
  espace admin tenant, email réel, déploiement Vercel.

---

## Session 2 (suite) — 11 juin 2026 — Déploiement Vercel + email Resend

### Ce qui a été fait
- **Dépôt GitHub** créé et poussé : https://github.com/juliendiop/therasim (branche `main`).
- **Déploiement Vercel** : 1er build échouait (« No Output Directory public ») → ajout de
  `vercel.json` (`framework: nextjs`) → OK. Base Neon + Mistral fonctionnent en prod.
- **Email réel des liens magiques (Resend)** : `src/lib/email.ts` + branchement dans
  `/api/auth/magic-link` (email si `RESEND_API_KEY`, sinon lien à l'écran en dev). Clé installée,
  **test d'envoi réel OK (status 200)**.

### Pièges / à savoir
- **Resend domaine de test** (`onboarding@resend.dev`) : n'envoie qu'à l'email du **compte
  Resend** (julien.diop@gmail.com). Pour que d'autres utilisateurs reçoivent le lien → **vérifier
  un domaine** dans Resend et régler `EMAIL_FROM`.
- **Vercel** : ajouter `RESEND_API_KEY` + `EMAIL_FROM` dans les variables d'env, puis redéployer,
  pour que la connexion fonctionne sur le site en ligne.
- Commits via Bash : utiliser des `-m` simples (la syntaxe here-string PowerShell `@'...'@` casse).

### État
- App **en ligne sur Vercel** ; connexion en prod opérationnelle une fois les variables Resend
  ajoutées côté Vercel (limitée à l'email du compte Resend tant qu'aucun domaine n'est vérifié).

### Prochaine étape suggérée
- Ajouter les variables Resend sur Vercel + redéployer ; tester la connexion en ligne.
- Plus tard : vérifier un domaine d'envoi ; espace admin tenant ; calibration évaluateurs.

---

## Session 2 (suite) — 11 juin 2026 — Accès super-admin aux plateformes (impersonation)

### Ce qui a été fait
- Le **tenant actif** vient désormais de la **session** (token), plus du tenant DB de l'user.
  `getSessionUser` renvoie un `CurrentUser { id, email, role, tenantId(actif), impersonating }`.
- **Impersonation super-admin** : bouton **« Accéder à la plateforme »** sur chaque client
  (liste + fiche `/admin/tenants`). Pose une session scopée au tenant (rôle super_admin + `imp`),
  redirige vers `/catalogue` → on voit la plateforme du client (ses référentiels via ses droits).
- **Bandeau** orange global « Vous consultez la plateforme : X — **Quitter** » (revient à sa
  session d'origine). Fichiers : `src/lib/auth.ts`, `src/app/admin/impersonate-actions.ts`,
  `layout.tsx`, pages tenants.

### À savoir
- L'app étant mono-domaine pour l'instant, « accéder » = scoper l'app au tenant (pas encore de
  sous-domaine/branding visuel appliqué côté apprenant — backlog).
- `npm run build` OK.

### Prochaine étape suggérée
- Tester l'accès depuis l'admin (créer un client B2B, lui accorder un pack, « Accéder »).
- Puis : application du branding (logo/couleurs), espace admin tenant, vérif domaine Resend.

---

## Session 2 (suite) — 11 juin 2026 — Branding marque blanche + fixes exercices

### Branding (marque blanche)
- Système de thème : `globals.css` avec `--accent` + nuances dérivées via `color-mix`
  (`--accent-hover/soft/border`). Sweep des classes `indigo-*` → variables (0 restant).
- `layout.tsx` injecte la **couleur** (`--accent` sur `<body>`) + **logo** + **nom** du tenant
  actif (validation hex). Tenant public = branding TheraSim. En-tête sticky/blur + pied de page
  (« propulsé par TheraSim » pour les marques blanches). Login soignée.

### Fixes exercices (signalés par le porteur)
- **« Exercice suivant » qui ne faisait rien** : 2 causes corrigées —
  (1) le lecteur ne se réinitialisait pas entre exercices → `key={id}` sur `DrillPlayer` ;
  (2) le routage reproposait souvent le même exercice → `getNextDrill` prend un `excludeDrillId`
  (passé via `?not=`), évite l'exercice courant, et **ne bloque jamais** (fallback sans exclusion).
- **Variété** améliorée (rotation entre compétences/exercices).
- **Francisation** : « drill » → « exercice » dans l'UI (le code garde `drill`).

### À savoir / suite
- Branding **visuel** appliqué (couleur + logo + nom). Sous-domaine dédié par client = encore backlog.
- Contenu : 13 exercices EM ; le porteur peut en **créer d'autres via l'admin de contenu**.
- `npm run build` OK. Poussé sur Vercel.

---

<!-- Modèle pour la prochaine session :

## Session N — JJ mois AAAA

### Ce qui a été fait
-

### Décisions / pièges
-

### État en fin de session
-

### Prochaine étape suggérée
-
-->
