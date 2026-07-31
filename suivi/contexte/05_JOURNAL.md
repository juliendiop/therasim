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

## Session 2 (suite) — 11 juin 2026 — Réentraînement + contenu + onboarding

### Demandes du porteur
- **Réviser n'importe quelle compétence** (même déjà testée) : bouton « S'entraîner » sur
  **chaque** ligne de compétence de la carte (`?competency=<code>`).
- **Dérouler plus d'exercices sur une compétence** : mode **focus** — quand on s'entraîne sur
  une compétence précise, « Continuer cette compétence » reste dessus (`?focus=`), reboucle sur
  ses exercices et reprend quand ils sont épuisés (jamais de blocage).
- **+10 exercices EM** (production + reconnaissance) → **29 exercices** au total, 2-3 par compétence.
- « drill » → « exercice » dans toute l'UI (déjà fait).

### Onboarding (tâche parallèle, intégrée)
- Accueil **B2C** (`catalogue`) : « Bienvenue », promesse, **« Comment ça marche » en 3 étapes**,
  section « Choisissez un domaine à travailler » (fini le jargon « référentiel »).
- Page **plateforme** (`/f/[id]`) : encart **« Première fois ici ? »**, section **« Comment
  s'entraîner ? »** (3 modes Débutant→Confirmé→Autonome), **légende** de la carte.

### Vérif
- `npm run build` OK. Seed → 29 exercices. Poussé sur Vercel (DB Neon partagée déjà à jour).

---

## Session 2 (suite) — 11 juin 2026 — Connexion par mot de passe

### Ce qui a été fait
- `User.passwordHash` (bcrypt, optionnel). Route `POST /api/auth/login` (email+mot de passe).
- Page `/login` à **2 onglets** : Mot de passe (par défaut) + Lien magique.
- Écran **Admin → Mon compte** (`/admin/compte`) : définir/changer son mot de passe.
- Mot de passe initial du super-admin via `ADMIN_INITIAL_PASSWORD` au seed (haché en base Neon,
  donc valable local ET prod). **Identifiant** : julien.diop@gmail.com — mot de passe initial
  `TheraSim2026!` (à changer via Mon compte).

### Vérif
- `npm run build` OK. Test `POST /api/auth/login` → `{ok:true, redirect:/admin}`.

### À savoir
- Le lien magique reste disponible (option). Re-seeder réapplique `ADMIN_INITIAL_PASSWORD`
  (écrase un mot de passe changé entre-temps).

---

## Session 2 (suite) — 11 juin 2026 — Rôles & gestion des membres

### Rôles (modèle complété)
- `Role` = super_admin · **tenant_admin** (admin de plateforme) · **formateur** (nouveau) · learner (apprenant).
  Participant live = anonyme (sans compte). Helpers centralisés `src/lib/roles.ts`
  (`canManageLive` inclut formateur ; `canManageMembers` = super_admin/tenant_admin).
- Liens d'en-tête conditionnels : **Gestion** (tenant_admin / super-admin en impersonation),
  **Sessions live** (tous ceux qui peuvent animer : + formateur).

### Espace de gestion (admin de plateforme)
- `/gestion` : l'admin d'une plateforme **déclare ses membres** (ajout email + rôle apprenant/
  formateur/admin), change leur rôle, les retire. Scopé au **tenant actif** (donc le super-admin
  via « Accéder » gère les membres du client). Connexion des membres par email (lien magique/mot de passe).
- Fichiers : `src/app/gestion/`, `src/lib/roles.ts`.

### Module (réponse à la question du porteur)
- Un **module** = une **catégorie** du référentiel. À la création d'une session, les compétences
  testées sont **groupées par module** (catégorie). Le tableau de bord affiche désormais une
  **synthèse par module** (moyenne par catégorie) en plus du détail par compétence.

### Vérif
- `npm run build` OK.

### Prochaine étape
- PDF → session (génération IA). Option : supervision des cohortes par le tenant_admin/formateur.

---

## Session 2 (suite) — 11 juin 2026 — Formations/modules multi-réf + sas d'attente

### Formations & modules
- `Formation` (programme) + `FormationModule` (`items` = [{frameworkId, competencies[]}]) :
  **un module couvre PLUSIEURS référentiels**, chacun avec ses compétences. UI `/formations`.
- Lancer une session **par module** (sa propre durée) **ou pour toute la formation** (agrégation
  de tous les modules). Actions `createSessionFromModule` / `createSessionFromFormation`.

### Sessions live — moteur multi-référentiel
- `LiveSession.pairs` = [{frameworkId, code}] (multi-réf). `LiveAnswer.frameworkId` ajouté.
  `buildQuestionSet`/`getLiveResults` gèrent plusieurs référentiels (identité = framework+code).
  Résultats par compétence ET par catégorie, à travers les référentiels.

### Cycle de vie (sas d'attente)
- **brouillon → ouverte (sas) → en_cours (chrono) → fermee.** Le compte à rebours **ne démarre
  plus à l'ouverture** : étape séparée **« Démarrer le compte à rebours »** (durée ajustable juste
  avant). Côté participant : **sas d'attente** qui se lance tout seul quand le formateur déclenche
  (poll `/api/live/[id]/status`).

### Vérif
- `npm run build` OK. Smoke multi-réf : create→open→start→answers→results OK (4 comp / 3 modules).

---

## Session — 2 juillet 2026 : accueil apprenant + historique + chat streamé

### Ce qui a été fait
- **Tableau de bord d'accueil `/accueil`** (`src/lib/dashboard.ts`, `src/app/accueil/page.tsx`) :
  entretien/mini-scène **en cours à reprendre**, « reprendre là où j'en étais » (dernier
  référentiel pratiqué + 2 priorités avec boutons S'entraîner), **à réviser** (>21 j, ciblage
  par compétence), stats 7 jours (exercices / mises en situation / compétences), 3 dernières
  simulations. `/` et les redirections post-login pointent vers `/accueil` (super_admin → `/admin`).
- **Historique `/historique`** (`src/lib/sim-history.ts`, `src/app/historique/page.tsx`) :
  toutes les SimSessions (cas, référentiel, date Europe/Paris, tours, note moyenne du débrief,
  badge « en cours — reprendre »). Chaque ligne rouvre `/sim/[id]` (relecture conversation +
  débrief). Lien retour « Mon historique » sur une session terminée.
- **Chat de simulation streamé** : `mistralChatStream` (SSE) dans `src/lib/mistral.ts`,
  `patientReplyStream` dans `src/lib/simulator.ts` (remplace `patientReply`), la route
  `/api/sim/[id]/message` renvoie un flux text/plain (erreurs toujours en JSON — le client
  les distingue par le Content-Type). La réplique du patient s'affiche **au fil de l'eau**.
- **Confort du chat** (`sim-chat.tsx`) : indicateur « le patient réfléchit… » (points animés),
  compteur **tour X/Y** vivant dans la bannière mini-scène, **confirmation en 2 temps** avant
  Terminer (sautée à la fin naturelle d'une mini-scène), textarea auto-extensible ; en cas
  d'erreur la réplique est **rendue dans le champ** pour réessayer.
- Navigation : liens **Accueil / Domaines / Historique** dans l'en-tête, logo → `/accueil`.
  Catalogue renommé « Domaines d'entraînement ».

### Décisions / pièges
- Streaming : le flux Mistral est **ouvert avant** d'écrire le tour en base → une erreur de
  config (clé absente) remonte en 503 JSON sans tour fantôme. Si le flux s'interrompt en cours,
  le texte déjà reçu est persisté (conversation cohérente au rechargement).
- Dashboard : compteurs d'activité globaux OK, mais la maîtrise reste **par référentiel**
  (règle d'or §2.4) — « reprendre » n'affiche que le dernier référentiel pratiqué.
- ⚠️ `npm run lint` était **déjà cassé avant cette session** (crash de la config ESLint au
  chargement — config circulaire) — à réparer. `npm run build` et `npx tsc --noEmit` passent.

### Suite de session (même jour) : mot de passe oublié + landing publique
- **Mot de passe oublié** : lien sur `/login` → email de réinitialisation (Resend, lien
  affiché en dev) → `/reset-password` → nouveau hash + session ouverte. Réponse générique
  (pas de fuite d'existence de compte), token usage unique 60 min, audit `password_reset`.
- **Landing publique `/`** (visiteur non connecté ; connecté → `/accueil`) : héro,
  **démo jouable sans compte** (`demo-drill.tsx`, 3 QCM embarqués — zéro LLM, zéro crédit),
  3 niveaux + carte, sections B2C (praticiens) et B2B (écoles, CTA mailto
  `contact@meleta.app` — **vérifier que la boîte existe**), réassurance, bandeau final.
  Bouton « Se connecter » dans l'en-tête visiteur.

### Suite de session (même jour, bis) : multi-fournisseur LLM (Mistral + Claude)
- **Couche LLM unifiée** `src/lib/llm.ts` : `llmChat`/`llmChatStream(usage, …)` → dispatch
  vers Mistral ou **Claude/Anthropic** selon `/admin/modeles`. Nouveau `src/lib/anthropic.ts`
  (SDK `@anthropic-ai/sdk` : system séparé, 1er message user forcé, streaming, extraction
  JSON, thinking désactivé, pas de temperature — paramètre retiré des modèles Claude récents).
- `/admin/modeles` : **fournisseur + modèle par usage**, statut des 2 clés. Config en base :
  `provider.<usage>` + `model.<usage>` ; garde-fou modèle↔fournisseur dans `getLlm()`.
  Suggestions Claude : claude-opus-4-8 (défaut) · claude-sonnet-5 · claude-haiku-4-5.
- simulator/evaluator/generate refactorés sur `llmChat` ; messages d'erreur généralisés
  (plus de mention exclusive de MISTRAL_API_KEY) ; `/api/health` expose ANTHROPIC_API_KEY.
- Erreur commune déplacée dans `src/lib/llm-errors.ts` (évite un cycle d'imports) —
  ré-exportée depuis evaluator.ts pour compatibilité.

### État en fin de session
- Build OK, types OK. Streaming non encore testé en conditions réelles avec la clé Mistral.
- ANTHROPIC_API_KEY à poser sur Vercel pour activer Claude.

### Suite de session (même jour, ter) : fix landing (mailto) + espace supervision formateur
- **Fix** : les boutons « Demander une démo » de la landing utilisaient des liens `mailto:`
  (invisibles/inertes sans client mail configuré). Remplacés par `/demande-demo` (formulaire
  → email via Resend, reply-to = visiteur, repli si Resend absent). Note : le porteur a depuis
  ajouté son propre formulaire de demande de devis en parallèle.
- **Espace supervision formateur** (priorité choisie parmi les 3 chantiers restants de
  l'analyse du 2 juillet, cohérente avec la poussée B2B en cours) :
  `/supervision` (liste apprenants + activité), `/supervision/[id]` (progression par
  référentiel + historique mises en situation + notes), `/supervision/[id]/sim/[simId]`
  (relecture lecture seule transcript + débrief + note ciblée). Nouveau modèle
  `SupervisorNote`. Accès `super_admin`/`tenant_admin`/`formateur` via `canSupervise()`.
  Toute lecture vérifiée cross-tenant (`getLearnerInTenant`).
- **Export CSV** des résultats individuels d'une session live (`/api/live/[id]/export`),
  bouton sur le tableau de bord `/sessions/[id]`.
- Lien « Supervision » ajouté à la navigation (mêmes rôles que Formations/Sessions live).

### ✅ `npm run db:push` fait (2 juillet, contre Neon prod)
- Table `supervisor_notes` créée. L'espace supervision formateur (liste apprenants,
  progression, historique, transcript, **et notes**) est pleinement opérationnel.

### État en fin de session (bis)
- Build OK, types OK, `db:push` fait. Supervision et export CSV non encore testés en
  conditions réelles (nécessite un compte formateur/tenant_admin + des apprenants actifs).

### Suite de session (même jour, quater) : les 2 derniers chantiers de l'analyse du 2 juillet
Les 2 chantiers restants (choisis par le porteur : « c'est parti pour les 2 » — pas de
priorisation demandée, traités ensemble) :

**Auto-évaluation avant débrief + replay annoté**
- Nouvelle étape entre la confirmation de fin d'entretien/mini-scène et l'appel au débrief IA :
  l'apprenant note sa mobilisation de chaque compétence évaluée (1-5), skippable. Le débrief
  affiche ensuite « vous : X/5 · IA : Y/5 » par compétence. Stocké à part
  (`SimSession.selfAssessment`), jamais mêlé au débrief IA lui-même.
- Les « moments clés » du débrief sont désormais **rattachés au message du transcript**
  correspondant (`src/lib/moment-match.ts` — recouvrement de mots, tolère la paraphrase) et
  surlignés en contexte (anneau ocre + commentaire sous la bulle), au lieu d'une liste séparée
  après coup. Fallback en liste (« Autres moments clés ») pour les non-rattachés. Appliqué à
  la fois côté apprenant (`/sim/[id]`) et côté formateur (`/supervision/[id]/sim/[simId]`).
- Bonus corrigé au passage : le débrief affichait le **code brut** de la compétence
  (`reflets`) au lieu de son nom (« Reflets ») — résolu partout.
- Fichiers : `src/lib/moment-match.ts`, `src/lib/simulator.ts` (`endSimulation` accepte
  `selfAssessment`), `src/app/api/sim/[id]/end/route.ts`, `src/app/sim/[id]/page.tsx`,
  `src/app/sim/[id]/sim-chat.tsx`, `src/app/supervision/[id]/sim/[simId]/page.tsx`.

**Visages des patients + célébration des paliers**
- Avatars monogrammes colorés déterministes (dérivés du **titre du scénario** — aucune
  génération d'image, aucun champ ajouté en base) : `src/lib/patient.ts` +
  `src/app/_components/patient-avatar.tsx` (1er dossier partagé hors des routes, convention
  Next `_components`). Intégrés au chat de simulation (en-tête + bulles), à l'historique, à
  l'accueil, et à la supervision formateur (liste + transcript).
- Célébration : bannière animée (`.ts-level-up` dans `globals.css`) quand un essai fait
  franchir un palier **solide** ou **maîtrisé** — pas le premier essai (non_pratique→faible),
  volontairement pas fêté (trop fréquent). Détection centralisée : `mastery.ts` (nouveau
  `isMilestone`/`palierRank`), `attempts.ts` (`recordAttempt` renvoie désormais
  `{state, palierBefore, palierAfter, milestone}` — **changement de signature**, mais tous
  les appelants existants ignoraient déjà la valeur de retour, donc rétrocompatible).
  Affiché dans `drill-player.tsx` (un essai) et le débrief de simulation (un ou plusieurs
  paliers par entretien, `simulator.ts` calcule `debrief.level_ups`).
- Fichiers additionnels : `src/app/api/drills/[id]/attempt/route.ts` (payload `level_up`),
  `src/app/drills/[id]/drill-player.tsx`.

### ✅ `npm run db:push` fait (2 juillet, contre Neon prod)
- Champ `SimSession.selfAssessment` créé. Auto-évaluation, replay annoté, avatars et
  célébration des paliers sont désormais pleinement opérationnels.

### État en fin de session (ter)
- Build OK (`npm run build`, TypeScript inclus), `npx tsc --noEmit` OK, `db:push` fait.
  Reste à jouer un entretien complet en conditions réelles pour valider visuellement
  l'enchaînement (auto-évaluation → débrief → replay annoté → célébration éventuelle).

### Suite de session (même jour, quinquies) : vrais portraits patients (retour porteur)
- Retour du porteur : le monogramme coloré (initiale + couleur) ne ressemblait pas à un
  « visage ». Remplacé par un **portrait illustré déterministe** (DiceBear, style
  « lorelei ») généré **côté serveur uniquement** et servi via une image
  (`GET /api/patient-avatar?seed=...`, SVG, cache navigateur long car contenu immuable pour
  un seed donné). `PatientAvatar` devient un simple `<img>` — zéro dépendance ajoutée au
  bundle client, aucun changement nécessaire dans les pages qui l'utilisaient déjà (même
  interface `name`/`seed`/`size`).
- Nouveaux paquets : `@dicebear/core`, `@dicebear/lorelei`. Nouveaux fichiers :
  `src/lib/patient-avatar-svg.ts` (server-only, cache mémoire par seed),
  `src/app/api/patient-avatar/route.ts`. `src/lib/patient.ts` allégé (ne garde que
  `patientDisplayName`, safe pour le client).
- ⚠️ **Un serveur `npm run dev` déjà lancé avant `npm install @dicebear/*` renverra une 500**
  sur `/api/patient-avatar` tant qu'il n'est pas redémarré (limitation standard de résolution
  des dépendances par le serveur de dev, pas un bug du code — `npm run build` + `tsc` sont
  verts). `npm run db:push` **non requis** pour ce correctif (aucun changement de schéma).

### Prochaine étape suggérée
- Redémarrer `npm run dev` puis vérifier `/api/patient-avatar?seed=Marc` affiche bien un
  portrait (pas une bulle avec une lettre).
- Jouer un entretien complet de bout en bout pour valider visuellement : auto-évaluation →
  débrief avec comparaison → moments clés surlignés dans le fil → (si palier franchi)
  bannière de célébration.
- Dans `/supervision`, restent : assignations, attestation de pratique, export PDF/CSV du
  suivi individuel d'un apprenant.
- Visages des patients : reste en option la démo publique (`demo-drill.tsx`), et un portrait
  illustré (au lieu du monogramme) si budget design plus tard.
- Tester le streaming du chat de simulation en conditions réelles (toujours en attente).
- Réparer `npm run lint` (config ESLint cassée, préexistante — toujours en attente).
- Vérifier que `contact@meleta.app` reçoit bien les demandes de devis (formulaire ajouté
  par le porteur en parallèle de `/demande-demo`).

### Suite de session (même jour, sexies) : intégration Stripe (packs + abonnements)

Demande porteur : « connecter Stripe pour que les personnes puissent souscrire des
forfaits ». Sujet touchant à de l'argent réel → clarifié avant codage (`AskUserQuestion`) :
le porteur a confirmé vouloir **les deux** — packs de crédits ponctuels (déjà dans l'UI
`/credits`, jusqu'ici stubbés `?soon=`) **et** abonnements mensuels récurrents. Vu la
complexité (webhooks, argent réel, nouvelles clés externes), un **plan détaillé a été
soumis et approuvé** avant toute écriture de code (voir
`C:\Users\diop.julien\.claude\plans\steady-puzzling-castle.md`).

**Décisions clés du plan** :
- Checkout Stripe **hébergé** (redirection serveur → `session.url`), pas de Stripe.js/Elements
  côté client — cohérent avec le style Server Actions + `redirect()` déjà utilisé partout
  (`src/app/sim/actions.ts`).
- **Aucun prix/nom de forfait inventé par moi** : les forfaits d'abonnement (nom, prix,
  crédits/mois) sont **entièrement configurables par le super-admin** via une nouvelle page
  `/admin/facturation` — même logique que `/admin/modeles` pour les modèles IA. Seuls les
  3 packs de crédits existants restent en dur (`CREDIT_PACKS`, inchangés), avec juste leur
  Price ID Stripe configurable au même endroit.
- Un abonnement actif accorde ses crédits à **chaque renouvellement** (webhook
  `invoice.paid`), **en plus** de la recharge mensuelle gratuite existante — deux mécanismes
  indépendants (l'un accorde, l'autre remonte à un plancher), pas de conflit.

**Implémenté** :
- Schéma : `User.stripeCustomerId`, `SubscriptionPlan` (config admin), `UserSubscription`
  (1 par user), `StripeEvent` (idempotence webhook).
- `src/lib/stripe.ts` (client singleton + `ensureStripeCustomer`), `src/lib/billing.ts`
  (création des sessions Checkout/Portail + les 4 handlers d'événements webhook).
- `src/app/api/stripe/webhook/route.ts` : corps **brut** (`req.text()`, jamais `req.json()`
  ici), vérification de signature (`stripe.webhooks.constructEvent`), idempotence
  (`StripeEvent.create` en premier — violation d'unicité = déjà traité, on renvoie 200).
  **Important** : crédits d'abonnement accordés **uniquement** sur `invoice.paid`, jamais sur
  `checkout.session.completed` en mode `subscription` — Stripe émet une facture pour la 1ère
  période dès la création, donc accorder sur les deux events aurait doublé le premier octroi.
- `/credits` : boutons « Acheter » réels (Server Actions), nouvelle section « S'abonner »,
  statut d'abonnement + bouton « Gérer mon abonnement » (portail Stripe) si déjà abonné,
  bannières succès/annulation/erreur, repli « bientôt disponible » si Stripe non configuré.
- `/admin/facturation` : statut des 2 clés (secrète + webhook), Price ID par pack, création
  + activation/désactivation des forfaits, édition du Price ID d'un forfait existant après
  coup (utile car le forfait est souvent créé avant le Price Stripe correspondant).

**Pièges Stripe API rencontrés (SDK `stripe@22.3.0`, API récente)** — la documentation/les
souvenirs d'API Stripe plus anciens sont **faux** pour cette version, vérifié directement
dans les `.d.ts` du paquet installé plutôt que suppose :
- `Subscription.current_period_end` n'existe plus au niveau racine → déplacé vers
  `Subscription.items.data[0].current_period_end`. Géré défensivement (essaie l'ancien
  emplacement via cast, puis le nouveau).
- `Invoice.subscription` n'existe plus → déplacé vers
  `Invoice.parent.subscription_details.subscription`.

### ✅ `npm run db:push` fait (2 juillet, contre Neon prod)
- Tables `SubscriptionPlan`/`UserSubscription`/`StripeEvent` + champ `User.stripeCustomerId`
  créés. Reste du setup Stripe (détaillé dans `00_DEMARRAGE.md`), toujours à faire côté
  porteur :
1. Compte Stripe + clé secrète **test** → `STRIPE_SECRET_KEY`.
2. Créer les Prices dans le Dashboard Stripe (3 one-time pour les packs, 1 recurring par
   forfait souhaité) → coller les Price ID dans `/admin/facturation` (et y créer les
   forfaits d'abonnement — aucun n'existe par défaut).
3. Enregistrer le webhook `https://<domaine>/api/stripe/webhook` (événements :
   `checkout.session.completed`, `invoice.paid`, `customer.subscription.updated`,
   `customer.subscription.deleted`) → `STRIPE_WEBHOOK_SECRET`.
4. Activer le Customer Portal Stripe (Réglages → Facturation).
5. Tester avec la carte `4242 4242 4242 4242` sur le site déployé.
- ⚠️ **Je n'ai pas de compte Stripe : aucun test de bout en bout possible de mon côté.**
  Seuls `npm run build` + `npx tsc --noEmit` valident la correction statique du code.

### État en fin de session (quater)
- Build OK, types OK, `db:push` fait. Fonctionnalité complète côté code, **non testée en
  conditions réelles** — nécessite le reste du setup manuel Stripe (clé, Prices, webhook,
  Customer Portal) avant tout test possible.

### Prochaine étape suggérée
- Terminer le setup Stripe (voir ci-dessus), puis tester un achat de pack ET une souscription
  d'abonnement en mode test, vérifier l'octroi de crédits et le portail de résiliation.
- Reste du backlog inchangé : streaming en conditions réelles, `npm run lint`, boîte
  `contact@meleta.app`, chantiers `/supervision` (assignations, attestations).

### Suite de session (même jour, septies) : freemium — contenu lié aux paiements

Question du porteur : « quand un visiteur s'inscrit, à quoi a-t-il accès ? comment lier
achats/abonnements aux référentiels ? utiliser les compétences comme incitatif ? »
Constat : jusqu'ici TOUT le contenu était ouvert aux inscrits B2C (tous les packs de contenu
accordés au tenant public par le seed) ; seuls les crédits d'usage IA étaient payants.

**Modèle décidé avec le porteur** (AskUserQuestion) : « Freemium + achat à l'unité », avec
forfaits à sélection de référentiels (Essentiel 15 € / Praticien 35 € / Intensif 69 € — les
noms/prix restent à créer par lui dans l'admin) :
- Gratuits à l'inscription : configurables (défaut EM), clé `freemium.free.frameworks`.
- Chaque forfait inclut SA sélection de référentiels (toggles en admin) + crédits mensuels.
- Achat à l'unité : paiement unique Stripe, accès à vie, avec ou sans abonnement.
- **Vente par référentiel, pas par compétence** (contrainte moteur : carte/routage/drills
  fonctionnent par référentiel) — précisé au porteur qui parlait de « compétences ».
- B2B non touché : tenants whitelabel + rôles encadrants jamais filtrés.

**Implémenté** :
- Modèles `PlanFramework`, `FrameworkOffer` (prix/PriceID/actif par référentiel),
  `UserFrameworkAccess` (achats à vie, prévu aussi pour l'octroi admin `source='admin'`).
- `entitlements.ts` : `userFrameworkAccess(user)` → `{unlocked, locked}` (borné par le
  plafond tenant) ; `userCanAccess()`. Gardes remplacées sur TOUS les parcours apprenant
  (drills page/GET/attempt, entraînement, sim actions, simulation, page référentiel,
  drill-suivant API) — un contenu verrouillé redirige vers `/f/[id]` qui affiche le paywall.
- Paywall `/f/[id]` (`paywall.tsx`) : liste complète des compétences (l'incitatif), carte
  d'achat à l'unité (checkout Stripe), forfaits incluant ce domaine, bannières
  succès/annulation (le succès renvoie vers `/f/[id]?success=framework`).
- Catalogue : sections « Vos domaines » / « À débloquer » (tuiles pointillées ocre, cadenas,
  aperçu 3 compétences). Accueil : section « À découvrir » (3 max). `/credits` : chaque
  forfait affiche ses domaines inclus.
- Admin `/admin/facturation` étendu : toggles domaines par forfait, offres à l'unité
  par référentiel, cases « gratuits à l'inscription ».
- Webhook : branche `metadata.type === 'framework'` dans `handleCheckoutCompleted` →
  upsert `UserFrameworkAccess`. Les packs de crédits gardent leur branche (compat :
  détection par `metadata.credits`).

### ⚠️ Effet de bord assumé au déploiement
Les référentiels non-gratuits (ACT, Anamnèse, Ménopause par défaut) se **verrouillent
immédiatement** pour les apprenants B2C existants — c'est le comportement freemium voulu.
Un apprenant ayant déjà pratiqué un domaine verrouillé garde sa progression et retombe sur
le paywall en cliquant dessus (incitation à débloquer).

### 🔴 Action requise du porteur
1. `npm run db:push` (3 nouvelles tables + rien à seeder).
2. `/admin/facturation` : cocher les gratuits (défaut EM déjà actif sans config), cocher
   les domaines inclus dans chaque forfait, renseigner prix + Price ID **one-time** Stripe
   pour chaque référentiel vendu à l'unité (Prices à créer dans le Dashboard).
3. Tester en compte apprenant : catalogue → domaine verrouillé → paywall → achat carte
   test → recharger après le webhook → domaine débloqué.

### État en fin de session (quinquies)
- Build OK, types OK. Non testé de bout en bout (nécessite db:push + Prices Stripe).

### Suite de session (même jour, octies) : quota de domaines au choix (retour porteur)
- Retour porteur sur la V1 freemium : la sélection de domaines par forfait (toggles en
  admin) était **trop complexe à administrer**. Remplacée par sa proposition, meilleure :
  **chaque forfait donne droit à N domaines AU CHOIX de l'abonné** (`SubscriptionPlan.
  frameworkQuota`, vide = tout le catalogue — ex. Essentiel 1, Praticien 3, Intensif tout).
- **Où se fait le choix ?** Ni à l'inscription, ni via un écran imposé : l'abonné clique un
  domaine verrouillé → le paywall affiche « Inclus dans votre forfait X — il vous reste N
  choix » → bouton « Débloquer ce domaine » (sans paiement, consomme un choix).
- **Anti-abus** : choix **définitifs tant qu'on est abonné** (pas d'échange, sinon un
  forfait 1 domaine = tout le catalogue en alternant). Stockés dans `UserFrameworkAccess`
  avec `source='subscription_choice'` : valides seulement si l'abonnement est actif,
  conservés en base (se réactivent si l'abonné revient).
- Table `PlanFramework` supprimée (créée le jour même, jamais utilisée en prod).
  `entitlements.ts` : `subscriptionChoiceStatus()` + `activateSubscriptionChoice()`.
  `/credits` : forfaits affichent « N domaines au choix » + « X/N choisis » pour l'abonné.
  Admin : simple champ numérique par forfait (création + mise à jour).
- 🔴 **Action requise** : `npm run db:push` (ajoute `framework_quota`, supprime
  `plan_frameworks`), puis renseigner le quota de chaque forfait dans `/admin/facturation`.

### Suite de session (même jour, nonies) : abonnements réservés au site public
- Question porteur : « que se passe-t-il si un apprenant d'une plateforme (B2B) achète un
  abonnement ? » → Incohérence détectée : l'abonnement se serait créé normalement et les
  crédits mensuels auraient été versés, mais la promesse « N domaines au choix » était
  **inconsommable** pour lui (sa plateforme lui donne déjà tout son catalogue, aucun paywall
  ne lui est jamais montré) — vente trompeuse, risque de litige.
- Correctif : `isFreemiumLearner(user)` (apprenant du tenant public) dans `entitlements.ts` ;
  la section « S'abonner » de `/credits` n'est affichée qu'aux freemium ; garde serveur dans
  `checkoutPlanAction` (message explicite sinon). Les membres B2B **gardent** l'achat de
  packs de crédits (valeur honnête : recharge d'usage IA) et le bouton « Gérer mon
  abonnement » reste visible pour quiconque aurait déjà un abonnement actif (résiliation).

### Suite de session (même jour, decies) : opt-in « offres individuelles » par plateforme
- Question porteur : « un apprenant de plateforme qui adore et veut plus de compétences,
  comment fait-il ? » — révélation clé : **les plateformes B2B actuelles sont les siennes**
  (« je suis moi-même l'école »), pas des clientes tierces → il VEUT leur ouvrir tout le
  catalogue + les abonnements. Pas de conflit de canal ici, mais il en existera un le jour
  où de vraies écoles clientes arriveront → solution retenue : **opt-in par plateforme**.
- `Tenant.allowIndividualOffers` (défaut **false** = comportement protecteur actuel).
  Toggle dans `/admin/tenants/[id]` (section « Offres individuelles », masquée pour le
  tenant public). Activé : les apprenants de la plateforme voient le **catalogue public**
  en vitrine (verrouillé), peuvent débloquer à l'unité, s'abonner et consommer leur quota —
  leur catalogue école restant inclus d'office. Désactivé : limités au catalogue plateforme.
- Mécanique : `userFrameworkAccess` introduit un « plafond de vente » (= catalogue du
  tenant public) pour les apprenants B2C ET les apprenants B2B opt-in ;
  `canBuyIndividualOffers()` remplace `isFreemiumLearner()` (gating abonnements) ;
  `activateSubscriptionChoice` réutilise l'accès complet ; `/f/[id]` rend le paywall pour
  un domaine hors catalogue plateforme (au lieu d'un 404) ; `buildOverview` accepte un
  ensemble d'ids (tuiles catalogue = accès effectif) ; `buildDashboard` accepte les
  domaines débloqués hors plateforme (stats/reprise).
- 🔴 **Action requise** : `npm run db:push` (colonne `allow_individual_offers`), puis
  activer l'opt-in sur ses plateformes dans `/admin/tenants/[id]`.

### ✅ `npm run db:push` fait (2 juillet, contre Neon prod)
- `framework_quota` (quota des forfaits) + `allow_individual_offers` (opt-in plateformes)
  créés. Tout le code freemium/quota/opt-in est opérationnel côté base.

### État en fin de session (sexies)
- Build OK, types OK, db:push fait. Reste au porteur (config, pas de code) :
  1. `/admin/facturation` : renseigner le **quota** de chaque forfait (Essentiel 1,
     Praticien 3, Intensif vide = tout) + prix/Price ID one-time des référentiels à l'unité.
  2. `/admin/tenants/[id]` : activer « Offres individuelles » sur ses propres plateformes.
  3. Test complet en compte apprenant (B2C et B2B opt-in) : vitrine → déblocage par choix
     d'abonnement ET par achat à l'unité (carte test).

### Suite de session (même jour, undecies) : onboarding / inscription B2C
- Question porteur : promo prévue auprès de sa communauté de thérapeutes, mais « Créer un
  compte » menait à `/login` (formulaire mot de passe de connexion, inutilisable pour un
  nouveau venu). → Parcours d'inscription B2C dédié.
- Schéma : `User.firstName` (prénom, accueil personnalisé) + `User.consentAt` (RGPD).
  Exposé `firstName` dans `getSessionUser`/`CurrentUser`.
- `/inscription` (page) + `/api/auth/register` (endpoint) : prénom optionnel, email, mot de
  passe ≥8, **case de consentement RGPD obligatoire**. Accès immédiat (session ouverte),
  ou magic link en alternative. Refuse un email déjà pris. Toujours tenant public + learner.
- Accueil : greeting « Bonjour {prénom} », bannière `?bienvenue=1` « compte prêt 🎉 » avec
  CTA direct vers l'entraînement du 1er domaine débloqué + rappel du parcours (3 étapes).
- Tous les CTA d'inscription (landing ×3, démo ×1) repointés vers `/inscription` ; liens
  croisés `/login` ↔ `/inscription`. Header « Se connecter » (visiteur) reste sur `/login`.
- ✅ `npm run db:push` fait (2 juillet, contre Neon prod) — colonnes `first_name` +
  `consent_at` créées. Inscription B2C pleinement opérationnelle.

### État en fin de session (septies)
- Build OK, types OK, db:push fait. Reste au porteur : tester le parcours complet
  landing → « Créer un compte » → /inscription → accueil de bienvenue.
- Option backlog notée : page politique de confidentialité dédiée, double opt-in email.

### Suite de session (même jour, duodecies) : corrections de navigation
- Signalements porteur après le déploiement de l'inscription : (1) « après l'inscription on
  ne voit aucune compétence, EM devrait être visible » ; (2) bouton « Se connecter » seul ;
  (3) « on ne sait pas bien naviguer entre accueil et catalogue ».
- **Diagnostic (1)** : script tsx contre Neon prod → un inscrit frais a bien
  `unlocked=[em]` (EM débloqué). Le bug était d'**affichage** : l'accueil de bienvenue
  n'affichait qu'un bouton « Commencer », jamais le domaine EM comme tuile → impression
  « aucun domaine ». Corrigé : section **« Votre domaine »** (tuiles cliquables des domaines
  débloqués) toujours affichée sur l'accueil, y compris pour un nouvel inscrit. Restructuré
  la conditionnelle (bannière bienvenue + domaines + contenu habituel, au lieu d'un ternaire
  exclusif).
- **(2)** Header visiteur : « Se connecter » (discret) **+ « Créer un compte »** (bouton
  accent) — pousse l'inscription pour la campagne.
- **(3)** Vrai trou : la nav header (Accueil/Domaines/Historique) est `hidden sm:flex` →
  **invisible sur mobile**, un apprenant sur téléphone n'avait aucun lien de navigation.
  Ajout d'une **barre de navigation basse mobile** (`_components/mobile-nav.tsx`, client,
  onglet actif surligné via `usePathname`) : Accueil / Domaines / Historique / Crédits,
  visible sous `sm` uniquement, pour les connectés. `main`/`footer` : `pb-24 sm:pb-8` pour
  réserver la place. Sur desktop, lien « Explorer le catalogue → » ajouté à la section
  « Vos domaines » de l'accueil.
- Aucun changement de schéma (pas de db:push). Build OK, types OK.

## Session — 3 juillet 2026 : passe responsive mobile + blog SEO noté

### Ce qui a été fait
- **Passe responsive mobile** (signalement porteur : effet zoom, champs qui débordent).
  Cause de l'effet zoom = débordement horizontal. Corrigé : `export const viewport`
  (échelle 1:1) dans le layout ; `overflow-x: clip` sur `html,body` (globals.css — filet
  qui ne casse pas le header sticky) ; `img/video { max-width: 100% }` ; **tables**
  `overflow-hidden` → `overflow-x-auto` (credits, gestion, supervision, admin activity/
  credits/tenants, sessions dashboard) pour scroller au lieu de couper.
- La carte de progression `/f/[id]` et les lignes de compétences étaient déjà bien
  construites (min-w-0, truncate, shrink-0) — pas touchées.
- **Blog / SEO** noté au backlog (`04_RESTE_A_FAIRE.md`) : à cadrer (modèle Article, /blog +
  /blog/[slug], generateMetadata OG, sitemap, JSON-LD, éditeur). Non commencé.

### Décisions / pièges
- `overflow-x: clip` plutôt que `hidden` sur body : `hidden` peut casser `position: sticky`
  du header sur certains navigateurs, pas `clip` (support Safari 16+/Chrome 90+, OK 2026).
- Filet clip = empêche le zoom global mais **coupe** un débordement au lieu de le montrer :
  c'est un garde-fou, pas un substitut à corriger un champ qui déborde vraiment. Si le
  porteur signale un champ précis, cibler la source.

### État en fin de session
- Build OK, types OK. Corrections de fond poussées. Reste à valider visuellement sur mobile
  (le porteur signalera les cas précis restants).

### Prochaine étape suggérée
- Attaquer le blog/SEO si priorité ; sinon valider le responsive sur le terrain et cibler
  les champs qui débordent encore (page par page).

### Corrections responsive ciblées (captures device réel — dossiers TESTS/ TESTS2/)
Validé le responsive en émulant un viewport 390px via **iframe** (Chrome refuse de
descendre sous ~1700px avec resize_window ; une iframe 390px fait répondre les media
queries correctement — technique fiable). Les pages publiques + apprenant : 0 débordement.
Les captures device réel (compte super-admin) ont révélé 3 bugs supplémentaires, tous
corrigés :
1. **Header admin déborde** (Sessions live / Admin / Déconnexion en texte) → icône seule
   sous `sm`, libellé dès `sm` ; Déconnexion = icône LogOut sur mobile ; email dès `lg`.
2. **Cartes « Vos domaines » de l'accueil** ne tronquaient pas (élément de grille CSS a
   `min-width:auto` par défaut) → `min-w-0` sur le lien-carte.
3. **Chat d'entretien décalé dès la 1re réponse** : `<textarea>` en flex sans `min-w-0`
   (largeur intrinsèque `cols`) poussait « Envoyer » hors écran → `min-w-0` sur le textarea,
   `shrink-0` sur le bouton, `break-words` sur les bulles, `scrollIntoView` en
   `inline:'nearest'`. Même `break-words` sur la vue transcript formateur.

Note : dossiers `TESTS/` et `TESTS2/` (captures) committés — à retirer du dépôt si le
porteur préfère (ce sont des artefacts de test, pas du code).

### Page /tarifs publique + report du forfait choisi à l'inscription

Demande porteur : page de tarifs publique (abonnements + packs) pour convertir des
visiteurs sans compte, avec report du forfait choisi jusqu'au premier checkout.
Passage en **Plan Mode** (état des lieux exigé avant code) : exploration a confirmé que
**tout le système de paiement existait déjà et fonctionnait** (chantier Stripe précédent) —
schéma, `billing.ts`, webhook `/api/stripe/webhook` déjà enregistré côté Stripe, Server
Actions de `/credits`, et même les 3 forfaits (Essentiel/Praticien/Intensif) déjà
configurés en base avec leurs Price ID. Décision validée avec le porteur (AskUserQuestion) :
**réutiliser l'existant** plutôt que créer une route `/api/billing/checkout` et un second
webhook `/api/billing/webhook` comme demandé littéralement dans l'énoncé — le webhook
actuel est déjà enregistré dans le Dashboard Stripe, le renommer aurait forcé une
ré-inscription manuelle sans bénéfice.

Construit :
- `/tarifs` (Server Component) : forfaits actifs (badge « Le plus choisi » sur
  `plan.key === "praticien"`, pas une position en dur), packs de crédits, carte
  « Écoles et organismes » sans prix vers `/demande-demo`, FAQ 6 questions + JSON-LD
  `FAQPage`, CTA résolus côté serveur (visiteur/connecté éligible/connecté non éligible).
- Report du plan : `/inscription` passe en `useSearchParams` + `Suspense` (était un simple
  client component sans lecture de query params) ; `/api/auth/register` et
  `/api/auth/callback` déclenchent `createSubscriptionCheckout()` (déjà dans `billing.ts`)
  directement après création de session si un `planId` valide est fourni ; `/api/auth/
  magic-link` encode le plan dans l'URL du lien envoyé par email.
- Liens « Tarifs » : header visiteur + footer public (jamais en marque blanche B2B).

**✅ Validé en conditions réelles** sur `meleta.app` : rendu de `/tarifs` conforme, clic
« S'abonner » → `/inscription?plan=...` → inscription (compte jetable créé) → checkout
Stripe déclenché avec le bon `planId` (URL Stripe valide obtenue par appel direct à
`/api/auth/register`).

### ⚠️ Découverte importante : Stripe est passé en mode LIVE sur meleta.app
En testant, l'URL Checkout obtenue était `cs_live_...` (pas `cs_test_...`) — le porteur a
dû basculer `STRIPE_SECRET_KEY` en clé live sur Vercel suite à notre échange précédent sur
le passage en production. Je me suis arrêté **avant** de compléter un paiement réel (pas de
saisie de carte, pas de charge engagée — une session Checkout abandonnée expire sans
débit). Le porteur a dit vouloir tester lui-même un vrai paiement. Deux comptes de test
jetables traînent en base (`julien.diop+mobtest...`, `julien.diop+tarifs...@gmail.com`),
sans abonnement actif — à supprimer à la discrétion du porteur.

### État en fin de session (bis)
Build OK, types OK, poussé et déployé. Fonctionnalité complète et validée pour la partie
navigation/routing (sans paiement réel). Reste : validation du paiement live par le
porteur lui-même ; décision sur la suppression des comptes de test jetables ; décision sur
les dossiers `TESTS/`/`TESTS2/` (captures) dans le dépôt.

### Visibilité des crédits + écran dédié "plus de crédits"

Demande porteur : audit du parcours d'essai (crédits de bienvenue, comportement à sec,
impasses), puis 4 chantiers, avec validation du plan attendue avant code (Plan Mode).

**Audit (répondu en chat avant le plan)** : 10 crédits de bienvenue par défaut
(`CREDIT_DEFAULTS.welcome`, `src/lib/credits.ts`), **déjà éditable sans redéploiement**
depuis `/admin/credits` (`AppConfig.credits.welcome`) — un des 4 points demandés était donc
déjà fait, rien à construire. Drills (N1) toujours gratuits, jamais bloqués. Mini-scène/
simulation : coût débité **une seule fois** au clic « Démarrer », jamais en cours de
conversation (les messages suivants ne coûtent rien). Aucune impasse dure identifiée (pas
d'erreur brute) — le rebond `/credits?need=...` existait déjà mais était générique (perdait
le contexte, ne mettait rien en avant, pas de rappel de progression). Badge crédits du
header déjà existant (icône+solde), tooltip générique seulement.
Recommandation crédits de bienvenue : garder 10 (déjà largement au-dessus du critère
minimal « 3 drills + 1 mini-scène », les drills étant gratuits et illimités).

**Construit** (après validation du plan) :
- Tooltip du badge crédits (déjà existant) enrichi : détail du coût par activité, construit
  depuis `creditSettings()` désormais lu dans le layout.
- `_components/low-credits-banner.tsx` (nouveau, client) : bandeau dismissible si solde ≤
  20 % du pack de bienvenue, via `sessionStorage` (1×/session navigateur).
- `/credits?need=...` : bloc dédié remplaçant le bandeau générique — récap de progression
  (compteur de compétences travaillées + palier le plus haut, via `palier()`/`palierRank()`
  déjà dans `lib/mastery.ts`), 2 CTA directs vers le checkout (pack le plus petit +
  forfait Praticien si `canBuyIndividualOffers`), lien de retour vers le référentiel visé
  (`fw=` reporté depuis les deux redirects de `sim/actions.ts`). Grilles complètes
  masquées quand `need` est présent (évite la redondance) mais solde+historique restent
  visibles en dessous (pas un mur sans issue).
- Aucune nouvelle route de paiement : réutilise entièrement `checkoutPackAction`/
  `checkoutPlanAction` déjà existants, juste appelés avec des valeurs pré-remplies.

**✅ Validé en conditions réelles** sur `meleta.app` (sans toucher à Stripe, uniquement du
rendu de page) : `/credits?need=miniscene&fw=em` → titre contextualisé + « Retourner à
« Entretien motivationnel » » + 2 CTA ; `/credits?need=simulation` (sans `fw`) → titre
adapté, pas de lien retour (comportement correct). Tooltip confirmé via l'arbre
d'accessibilité de la page : « 30 crédits Mini-scène : 1 crédit · Entretien simulé : 2
crédits Exercices : gratuits ».

### État en fin de session (ter)
Build OK, types OK, poussé, déployé et validé en conditions réelles. Rien en attente côté
porteur sur ce chantier (aucun changement de schéma, aucun setup manuel requis).

### Blog MDX versionné dans le repo

Demande porteur : blog éditorial pour le SEO, contenu **MDX versionné dans le repo** (pas
de CMS). Demande très détaillée (quasi-spec), passée en **Plan Mode** avant code comme
demandé explicitement par le porteur.

**Flux de publication ajusté juste après la mise en ligne** : la demande initiale
prévoyait « agent rédige un `.mdx`, porteur valide en PR GitHub, merge → déploiement ».
Le porteur est revenu dessus aussitôt : « ouvrir une PR ? je ne sais pas faire, je veux
pouvoir le faire par simple prompt. » Question posée (AskUserQuestion) entre 2 options
(publication directe sur `main` vs PR avec merge piloté par chat) — porteur a choisi la
**publication directe**. Flux retenu, valable pour tout futur article : le porteur
demande un article en chat, Claude le rédige, le porteur le relit dans la conversation,
dit « publie-le », Claude committe + pousse directement sur `main` (même pattern que
tout le reste de cette session) — pas de Pull Request.

**Décisions techniques** (exploration directe du code + skill `vercel:nextjs` +
`vercel:next-cache-components` chargés avant de planifier) :
- `next-mdx-remote/rsc` (pas `@next/mdx`, qui transforme des `.mdx` EN pages — inadapté ici
  où le contenu est découplé du routage).
- `zod` (nouvelle dep) + `gray-matter` pour le frontmatter ; `remark-gfm` pour les tableaux.
- Aucune dépendance pour la table des matières/temps de lecture (regex + comptage de mots
  à la main, cohérent avec le reste du projet) ni pour le RSS (XML écrit à la main).
- `revalidate = 3600` (pas `force-dynamic`, pas de migration Cache Components globale —
  décision volontaire, voir plus bas).

**Deux pièges non anticipés, découverts en testant réellement le rendu (pas juste
build/tsc — la leçon de cette session) :**

1. **Turbopack + next-mdx-remote** : sans `transpilePackages: ["next-mdx-remote"]` dans
   `next.config.ts` (documenté dans le README du package, issue next.js #64525 citée),
   la page article ne produit AUCUN HTML côté serveur — juste un shell vide + le payload
   RSC pour hydratation client. `npm run build` réussissait quand même (aucune erreur
   visible) : le seul moyen de le détecter a été de `curl` la page en prod locale
   (`next start` sur un port libre) et de constater l'absence de vraies balises `<h1>`
   sémantiques dans le HTML brut — un screenshot navigateur ne l'aurait PAS révélé
   (le JS s'exécute et hydrate quand même visuellement).
2. **`<FAQ items={[...]} />` (tableau d'objets en prop)** : même après le fix Turbopack,
   la page continuait à ne rien rendre. Cause réelle, isolée via une route de test
   minimale ajoutée puis supprimée (`blog-test-mdx/`, jamais commitée) : next-mdx-remote
   évalue les props MDX au runtime via `Reflect.construct(Function, ...)`, et cette
   évaluation ne gère pas correctement un littéral tableau/objet complexe passé en prop —
   `items` arrivait `undefined`, `items.map()` levait `TypeError: Cannot read properties
   of undefined (reading 'map')`, et Next affichait silencieusement une page d'erreur
   générique (title/description génériques, `noindex`) plutôt qu'un 500 explicite.
   **Corrigé** en remplaçant par des enfants imbriqués : `<FAQ><FaqItem q="...">réponse
   </FaqItem></FAQ>` — motif MDX natif (JSX children), fiable. Leçon générale pour toute
   future extension du blog : dans du contenu MDX compilé au runtime, toujours préférer
   les enfants JSX aux props objet/tableau complexes.

**Constat architectural important (pas un bug introduit ici, mais une découverte) :**
`/blog` et `/blog/[slug]` (et en creusant, `/`, `/tarifs`, littéralement toutes les routes
de l'app) sont classées « ƒ dynamique » par Next plutôt que « ○ statique », parce que le
layout racine (`src/app/layout.tsx`) lit la session à chaque requête pour tout le site, et
que sans Cache Components/PPR (non activé, volontairement — migration globale hors
périmètre d'un ajout de blog), un enfant ne peut pas être statique sous un layout
dynamique dans le modèle de rendu classique de Next. `revalidate = 3600` reste posé (pas
de `force-dynamic`) : Vercel met en cache par URL et revalide en tâche de fond, ce qui
reste proche d'un SSG en pratique pour la performance perçue. Un vrai SSG strict
nécessiterait soit Cache Components (gros chantier séparé), soit sortir la lecture de
session du layout racine — à traiter à part si le porteur le souhaite un jour.

**✅ Validé de bout en bout** (frontmatter invalide → build échoue avec message clair
citant fichier+champs ; draft → absent de `/blog` et du RSS, accessible par URL directe,
`noindex` posé ; article publié → h1/h2 avec ancres/ToC, temps de lecture, Verbatim,
PointCle, FAQ+JSON-LD FAQPage, JSON-LD BlogPosting, tableau GFM, CTA selon audience —
tout vérifié via curl sur `next start` local, pas seulement en navigateur, précisément à
cause du piège n°1 ci-dessus).

### État en fin de session (quater)
Build OK, types OK. Fichiers de test/diagnostic (`blog-test-mdx/`, articles `_test-*.mdx`)
tous supprimés avant commit. Prêt à pousser.

---

## Session — 22 juillet 2026 : 3 articles de blog + growth (entonnoir + conseiller IA)

### 3 nouveaux articles de blog (SEO)
Demande porteur : écrire ET publier 3 articles optimisés SEO. Publiés directement sur `main`
(flux validé, pas de PR) : ACT (praticien), premier entretien/anamnèse (praticien),
simulation en formation (ecole). Chacun frontmatter valide (desc. 150-160 car., calibrée au
`node -e`), composants custom + tableaux GFM, CTA par audience. Rendu serveur vérifié en
local (curl sur `next start`) avant push — pas seulement build/tsc, vu les pièges MDX passés.

### Growth : mesure de l'entonnoir + conseiller d'optimisation IA
Demande porteur : automatiser l'acquisition, A/B testing auto, page qui « évolue jusqu'à
l'optimum ». **Réponse franche donnée avant de coder** : l'A/B testing autonome est
inapplicable sans trafic (aucune signification statistique ; une boucle auto optimiserait
vers du bruit) et l'auto-publication par IA sur une page d'acquisition est risquée (RGPD +
mise en ligne d'une version pire). Proposé le socle réellement utile : **mesurer l'entonnoir
d'abord**. Porteur a choisi cette option (AskUserQuestion). Puis, en cours de build, a
demandé une **section « Optimisation »** : bouton pour lancer une analyse IA qui propose des
optimisations, chacune avec un prompt à copier-coller dans l'IA de dev de son choix (« l'IA
propose, je valide »).

**Construit :**
- `FunnelEvent` (Prisma) + `src/lib/funnel.ts` : cookie visiteur anonyme `ts_vid` (UUID, pas
  d'IP/UA — RGPD), `recordFunnel`/`recordFunnelOncePerUser`, `funnelSummary` (taux
  étape→étape). 7 étapes : landing_view/demo_start/signup_start (beacon client)
  + signup_complete/activation/checkout_start/purchase (serveur).
- `/api/track` (beacon) : **whitelist** des seuls événements anonymes → impossible de gonfler
  une conversion depuis le client (testé : landing_view→204, purchase→400).
- Points de conversion serveur branchés : register + callback (signup_complete, 1× ; callback
  ne compte que si compte NOUVEAU), drill attempt (activation, 1×/user), credits/actions
  (checkout_start), billing handleCheckoutCompleted (purchase, 1×/user, 3 branches
  pack/framework/plan).
- `/admin/funnel` : dashboard (compteurs, barres, taux, décrochage <30% en rouge, conversion
  globale, bannière « volume faible » <100 visites).
- `/admin/optimisation` + `src/lib/growth-advisor.ts` : `runAnalysis()` agrège l'entonnoir,
  interroge `llmChat("generation", …, {json})`, parse défensif (fences/accolades), stocke la
  dernière analyse en `AppConfig` (`growth.last_analysis`, pas de nouvelle table). Page :
  bouton « Lancer l'analyse » (`useActionState`), synthèse + cartes reco (impact/effort) +
  `CopyPrompt` (bouton copier client) par prompt de dev.
- Nav admin : « Acquisition » + « Optimisation ».

### Pièges / décisions
- Beacon `keepalive: true` (survit à une navigation immédiate) + dédup module par event+path.
- `recordFunnel` best-effort (try/catch avalé) : la mesure ne doit JAMAIS casser un parcours.
- Réutilisé l'usage LLM « generation » existant plutôt que d'en ajouter un (évite de toucher
  `/admin/modeles`).

### 🔴 Action requise du porteur
`npm run db:push` (table `funnel_events`). L'analyse IA marche si une clé LLM est déjà
configurée (c'est le cas si le simulateur fonctionne).

### État en fin de session
Build OK, types OK, anti-triche + cookie RGPD vérifiés en local. Prêt à pousser. A/B testing
réel = étape suivante séparée (attendre du trafic).

---

## Session — 22 juillet 2026 : programme d'affiliation « Ambassadeurs »

Demande porteur : programme d'ambassadeurs (lien de parrainage, commission récurrente à vie,
2 niveaux, espace de suivi, demande de paiement par facture email, volet écoles B2B, kit de
diffusion prêt à l'emploi). D'abord rédigé en **spec complète** (`Conception/
spec-affiliation-ambassadeurs.md`) destinée à un modèle moins coûteux ; le porteur a ensuite
demandé que **je génère moi-même** le kit (textes + visuels SVG) et le contenu rédactionnel
des pages (conversion), puis **que je code l'ensemble** de la spec moi-même.

**Construit (spec suivie intégralement) :**
- **Schéma** : `User.referralCode/referredByUserId/ambassadorAt/ambassadorTermsAt` +
  `CommissionLedger` (ledger à solde roulant, unique `(beneficiaryId, stripeInvoiceId, tier)`
  pour l'idempotence webhook) + `PayoutRequest`.
- **`src/lib/affiliation.ts`** : attribution (cookie `ts_ref`, first-touch, résolu à
  l'inscription uniquement), activation (code unique base32), calcul de commission niveau 1/2
  **dérivé** (jamais stocké au-delà du niveau 2 — contrainte légale art. L.122-6, système
  pyramidal interdit), stats ambassadeur, liste de filleuls **anonymisée** (RGPD, jamais
  email/nom), cycle de vie des demandes de paiement, fonctions admin (liste ambassadeurs,
  file de paiement, commission école manuelle, ajustement manuel).
- **Stripe** : commission créditée dans `handleInvoicePaid` (1er paiement + chaque
  renouvellement → « à vie »), best-effort (try/catch avalé, ne doit jamais faire échouer le
  webhook). **Clawback** `handleChargeRefunded` (`charge.refunded`) : ⚠️ dérive d'API Stripe
  rencontrée — `Charge.invoice` et `Invoice.payment_intent` n'existent plus dans les types de
  `stripe@22.3.0` (vérifié par lecture directe des `.d.ts`). Résolution en repli défensif
  (champs legacy castés `as unknown`, comme le pattern déjà en place pour
  `current_period_end`) ; si l'invoice reste introuvable, **TODO explicite loggé** (pas
  d'échec silencieux) — clawback à faire manuellement via l'ajustement admin dans ce cas rare.
- **`/r/[code]`** : route de redirection qui pose le cookie d'attribution.
- **`/affiliation`** : écran d'activation (CGU) puis espace ambassadeur (lien + bouton copier,
  cartes revenus, demande de paiement avec seuil et flux facture, filleuls masqués,
  historique, kit de diffusion avec blocs copiables + visuels téléchargeables). Contenu
  entièrement dans `src/lib/affiliation-copy.ts` / `affiliation-kit.ts` (déjà rédigés au tour
  précédent), jamais de texte en dur dans les composants.
- **`/ambassadeurs`** : page publique de recrutement (hero, chiffres clés, comment ça marche,
  2 niveaux, écoles, FAQ + JSON-LD), même gabarit que `/tarifs`.
- **`/admin/affiliation`** : réglages (taux/seuil/cookie/activation), table ambassadeurs
  triée par solde, file de paiements (Marquer payé / Rejeter), commission école manuelle,
  ajustement manuel.
- **Volet écoles** : champ optionnel « Recommandé par » sur `/demande-demo`, transmis dans
  l'email (pas de nouveau modèle `DemoRequest` — l'email suffit en v1, comme prévu par la
  spec).
- **Navigation** : lien « Ambassadeur » (header connecté + nav mobile, réservé aux apprenants
  éligibles — même règle que `canBuyIndividualOffers`), lien « Ambassadeurs » au footer
  public, entrée `AdminLink` (icône `Gift`).

### Pièges / décisions
- Unicité Postgres sur `(beneficiaryId, stripeInvoiceId, tier)` : `NULL` n'est jamais égal à
  `NULL` pour une contrainte unique → les lignes `payout`/`commission_school`/`adjustment`
  (sans `stripeInvoiceId`) peuvent s'accumuler sans collision, seules les commissions liées à
  une facture Stripe précise sont dédupliquées.
- Solde **jamais remis à zéro à la demande** de paiement — seulement quand l'admin marque
  « payé » (ligne `payout` négative). Une 2ᵉ demande est bloquée tant qu'une demande
  pending/invoice_received existe.
- Éligibilité `/affiliation` calquée sur `canBuyIndividualOffers` (apprenant + tenant public
  ou opt-in B2B) plutôt que réutilisée telle quelle, pour rester cohérente avec les données
  déjà chargées dans `layout.tsx` sans appel async supplémentaire.

### 🔴 Actions requises du porteur
- ✅ **`npm run db:push`** fait (22 juillet, `--accept-data-loss` — averti par Prisma
  uniquement à cause de la nouvelle contrainte unique `referral_code`, sans risque réel car
  colonne neuve donc toutes les lignes existantes valent `NULL`, et Postgres n'impose jamais
  l'unicité entre plusieurs `NULL`). Tables `commission_ledger`/`payout_requests` + nouveaux
  champs `User` créés sur Neon prod.
- ✅ Événement `charge.refunded` ajouté par le porteur sur l'endpoint webhook Stripe existant
  — le clawback automatique de commission sur remboursement est opérationnel.

### Commit + déploiement
Commit `28efc8a` (« feat(affiliation): programme ambassadeurs — parrainage 2 niveaux,
paiement, admin »), poussé sur `main` → déploiement Vercel automatique. `TESTS2/`
(captures responsive d'une session antérieure, toujours non versionné) volontairement
exclu du commit — nettoyage optionnel laissé au porteur.

### État en fin de session
`npx tsc --noEmit` et `npm run build` passent (toutes les nouvelles routes compilent :
`/affiliation`, `/ambassadeurs`, `/admin/affiliation`, `/r/[code]`). `npm run lint` reste
cassé (config ESLint préexistante, non liée à ce chantier — déjà noté au backlog Phase 3).
Schéma poussé en prod, webhook Stripe à jour, code déployé — programme d'affiliation
**pleinement opérationnel**. Reste optionnel : test manuel bout en bout en conditions
réelles (activation ambassadeur, parrainage via `/r/CODE`, commission sur un paiement test,
cycle de demande de paiement).

### Suite — visibilité du programme dans l'app (le lien seul en pied de page était trop discret)
Constat porteur : l'accès ambassadeur, uniquement au footer, passe inaperçu. Question : en
parler davantage (ex. sur `/tarifs`, comme argument « vous pouvez aussi être rémunéré »).
**Analyse donnée avant de coder** : oui au constat, mais bémol de ton — MELETA est un outil
clinique sobre, il ne faut pas virer au discours « gagnez de l'argent » (risque MLM qui
décrédibilise). Et point de timing : le programme convertit des utilisateurs **engagés et
satisfaits**, pas des visiteurs froids. Retenu : 3 emplacements ciblés, ton pair-à-pair.
- **Composant partagé** `src/app/_components/affiliation-nudge.tsx` (encart Link discret, fond
  accent-soft, icône Gift, taux lu depuis AppConfig — jamais en dur). Copy : « Recommandez
  MELETA, touchez une commission » / « … gagnez X % sur chaque abonnement que vous parrainez ».
- **`/credits`** : encart après le bloc abonnement, pour les éligibles (`canBuyIndividualOffers`)
  hors écran « plus de crédits » — couvre aussi le moment post-abonnement (le succès Stripe
  atterrit sur `/credits`).
- **`/tarifs`** : band réservé aux **connectés éligibles** (un visiteur froid ne connaît pas
  encore le produit) + **une question FAQ** affichée pour tous (informatif + SEO + JSON-LD),
  avec taux et seuil injectés depuis AppConfig.
- **`/accueil`** : encart réservé aux utilisateurs **déjà engagés** (`!premierePratique`) et
  éligibles — jamais montré à un tout nouvel inscrit.
- Tous gated sur `rates.enabled` : si le programme est désactivé en admin, aucun encart nulle
  part. `tsc` + `npm run build` OK.

---

## Session — 22 juillet 2026 (suite) : enrichissement contenu + calibration évaluateur

### Contenu — 3 référentiels enrichis (produits d'appel)
Constat porteur : un nouvel inscrit ne voyait qu'« Entretien motivationnel », et les domaines
manquaient de cartes. Analyse : l'EM est une *méthode* (école), pas universelle ; l'**anamnèse**
(transversale, déjà seedée) est le meilleur hameçon. Enrichissement :
- **ACT** et **Anamnèse** : 3 → **12 cartes** chacun (2/compétence : 1 reco + 1 production),
  **2 cas patients** chacun (ACT : +Karim/ruminations ; Anamnèse : +Mme Bonnet/volubile).
- **EM** (produit d'appel principal) : → **32 cartes**, chaque compétence ≥ 3 cartes et les 2
  modes (comble la lacune « collaboration sans production »), **3e cas** (Nadia/diabète).
- Seed idempotent (upsert). `npm run db:seed` fait en prod par le porteur (105 drills au total).
- Conseil donné : rendre l'anamnèse gratuite à l'inscription via `/admin/facturation`.
- ⚠️ Contenu clinique rédigé par Claude → à relire par un clinicien.

### Calibration de l'évaluateur (mode production)
Deux volets (améliorer ET mesurer) :
- **Améliorer** : prompt refondu dans `src/lib/evaluator-core.ts` (cœur pur, sans `server-only`,
  séparé de l'appel LLM `evaluator.ts`) — rubrique 1..5 explicite (2/4 par interpolation),
  raisonnement avant la note, exemple travaillé, `non_evalue` resserré, **température 0**
  (reproductible), règle « au niveau du modèle = 5 ».
- **Mesurer** : `scripts/calibrate-evaluator.ts` (`npm run calibrate`) rejoue le vrai prompt sur
  un gold set et sort MAE / %±1 / violations d'ordre / détection non_evalue + verdict.
- Exécuté 2 fois : avant la règle « juste en haut » MAE 0.44 (61% exact) ; après **MAE 0.28,
  78% exact, 94% à ±1, 0 violation d'ordre, non_evalue 2/2 → ACCEPTABLE**.

### Décisions / pièges
- `server-only` (dans `llm.ts`) fait échouer tout import depuis un script tsx → d'où le cœur
  pur `evaluator-core.ts` importable par le script sans casser la frontière serveur de Next.
- Pas d'overfit : la seule note >±1 restante (« idée juste mais assénée » notée 1 au lieu de 3)
  est un label discutable — le gold set (niveaux moyens) doit être coté par un clinicien plutôt
  que d'ajuster le prompt sur une cible incertaine.
- Le harnais fait de vrais appels Mistral (~18) : à lancer ponctuellement (QA), pas en CI auto.

### État en fin de session
tsc + build OK. Contenu poussé en prod (db:seed fait). Évaluateur calibré (V1) et mesurable.
Reste : cotation clinique du gold set + du contenu ; puis, avec du trafic, coter de vraies
réponses d'apprenants.

### Suite — 5 cartes/compétence pour les 2 produits d'appel (EM + Anamnèse)
Demande porteur : au moins 5 questions différentes par compétence pour EM et Anamnèse.
- **EM** : 32 → **50 drills** (10 compétences × 5 : 3 reconnaissance + 2 production), 4ᵉ cas
  **Théo/cannabis** (jeune sur la défensive) en plus de Marc/Sophie/Nadia.
- **Anamnèse** : 12 → **30 drills** (6 × 5), 3ᵉ cas **Mme Faure/douleurs chroniques** (« déjà
  tout essayé », se sent incomprise) en plus de M. Dubois/Mme Bonnet.
- Vérifié : 5 cartes/compétence exactement, 0 doublon d'id, tous les scénarios référencés
  existent, seed parse. `npm run db:seed` reste à relancer en prod (idempotent).
- ⚠️ +36 drills rédigés par Claude → relecture clinique d'autant plus utile.
- **ACT porté aussi à 5 cartes/compétence** (23 juillet, demande porteur : nombreux étudiants
  formés à l'ACT) : 12 → **30 drills** (6 × 5), 3ᵉ cas **Sofiane/douleur chronique** (cas ACT
  emblématique) en plus de Léa/Karim. Vérifié : 5/compétence, 0 doublon, scénarios valides.
  Les 3 référentiels EM (50) / Anamnèse (30) / ACT (30) ont maintenant 5 cartes/compétence.

### Prochaine étape suggérée
- Faire relire ACT/Anamnèse/EM + le gold set par un clinicien.
- Envisager une petite page `/admin` « Calibration » (lancer le harnais depuis l'UI) si utile.

---

## Sessions — 24 au 31 juillet 2026 (consolidé)

Rattrapage de journal : ces sessions n'avaient pas été consignées au fil de l'eau. Détail
complet dans `02_MODULES_FAITS.md` (modules 38-47). Résumé chronologique par thème :

### Support client (24 juillet — module 38)
- Widget de tickets (tout utilisateur) + espace admin `/admin/support` avec **assistance IA**
  (projet de réponse). Usage LLM `support` **verrouillé Mistral/UE** (ticket = personne
  identifiée). Modale du widget corrigée (portail).

### Migrations Prisma avec baseline (24 juillet — module 39)
- Bascule `db:push` → **`prisma migrate`** : baseline `0_init` + migrations versionnées
  (`npm run db:migrate:new`). **Le build n'exécute plus `migrate deploy`** (verrou P1002 sous
  déploiements concurrents) : migrations appliquées séparément.
- ⚠️ **Dette identifiée** : les fichiers de migration s'arrêtent au 24 juillet. Les schémas
  des modules 40-46 ont été poussés en `db:push` → non capturés dans `prisma/migrations/`.
  `schema.prisma` = source de vérité, prod alignée, mais **rattrapage à faire** (baseline ou
  migrations manquantes) — cf. `04_RESTE_A_FAIRE.md`.

### Programme bêta enrichi (24 juillet — module 40)
- **Relance J+2** (invités inactifs), **questionnaire à chaud** (3 sims ou J+7), **bilan J+21
  avec NPS**, **témoignages** promoteurs affichés sur le site (validation admin), **avis libre**
  `/avis`. 3 crons Vercel (`beta-nudge`, `beta-feedback`, `beta-bilan`).

### Vitrine publique + SEO + catalogue élargi (24 juillet — modules 41-42)
- Pages `/domaines`, `sitemap.xml`/`robots.txt`, amorce blog MDX. Catalogue porté à
  **8 référentiels** (ajout Deuil + Hypnose ; Alliance/Ruptures/Ménopause au fil de l'eau).

### Refonte tarifaire + portefeuille de crédits (24-30 juillet — modules 43-44)
- **Socle (hors quota) vs spécialités (quota)**, **N3 découverte** (1 séance offerte à vie),
  forfait **« sans compter »**, **abonnement annuel**, `/tarifs` en grille 4 colonnes,
  garde-fous d'usage loyal (`/admin/usage`).
- **`planCredits` (forfait, non cumulatif) vs `credits` (portefeuille persistant)**, ordre de
  débit `splitDebit` (testé), modèle **`CreditPack`**, **2 murs de crédits** (modale) + endpoint
  autoritaire `/api/me/credits-wall`, pré-check client des lanceurs de séance.

### UX, changement de forfait, démo jouable (30-31 juillet — modules 45-47)
- **Feedback au clic** (effet de pression + `SubmitButton` anti double-clic).
- **Changement de forfait depuis l'app** (upgrade immédiat / downgrade au renouvellement) +
  **re-sync Stripe** admin + « actif jusqu'au X » + **fix resolver** (le prix courant fait foi,
  mensuel ET annuel — sinon changement invisible dans l'app).
- **Vraie mini-scène jouable sans compte** sur l'accueil (patient IA réactif, 4 tours, micro-
  débrief), **sans état ni donnée stockée**, garde-fous coût (budget/quota/rafale sur
  `RateLimitHit`) + repli silencieux sur la démo statique + panneau admin (usage/coût/budget).

### Décisions / pièges notables
- **Convention schéma** : `db:push` pour le travail courant, mais la prod a un historique de
  migrations (baseline 24 juillet) désormais **incomplet** → à réconcilier.
- **Changement de forfait** : ne nécessite **aucun** nouvel événement webhook (réutilise
  `subscription.updated` / `invoice.paid`), mais imposait le fix du resolver de forfait.
- **Démo** : le micro-débrief passe par l'usage `evaluateur` (Claude en prod) → coût réel
  ~0,25 c/démo, non testable en local (clé Anthropic absente) — testé jusqu'au tour de dialogue
  inclus via Mistral (ouverture, réactivité, refus d'injection OK).

### État en fin de période
- `npx tsc --noEmit` + `npx next build` verts. Tout est **poussé sur `main`** (jusqu'à
  `2c6cbfe`) et déployé.
- ⚠️ À tester en prod par le porteur : changement de forfait + « Re-synchroniser » (Stripe),
  micro-débrief de la démo (Anthropic). `npm run lint` reste cassé (config ESLint préexistante).
- ⚠️ Dette : réconcilier `prisma/migrations/` avec le schéma courant.

---

## Session — 31 juillet 2026 (suite) : réconciliation de l'historique de migrations

Dette identifiée le matin même (cf. modules 39 et 04_RESTE_A_FAIRE) : les fichiers de
`prisma/migrations/` s'arrêtaient au 24 juillet alors que les schémas des modules 43-46 avaient
été poussés en `db:push` → un `migrate deploy` sur une base neuve aurait rendu le schéma du
24 juillet. Objectif : que `migrate deploy` reproduise le schéma courant.

### Phase 0 — diagnostic (lecture seule)
- `migrate diff --from-config-datasource --to-schema` = **migration vide** → **prod == `schema.prisma`**
  (db:push avait tout synchronisé).
- `migrate status` = « up to date » **mais** ne compare que `_prisma_migrations`, aveugle à la
  dérive de colonnes.
- Écart précis (par inspection) : table `credit_packs` absente, `subscription_plans.stripe_price_id_yearly`
  absente, `frameworks` privée de `slug`/`intro_publique`/`auteurs`/`cadre_reference`/`updated_at`/
  `nature`/`tier`. L'écart exact au SQL près exigeait une base fantôme (`--from-migrations`) — évitée.
- **Point décisif** : `new-migration.ts` diffe base réelle → schéma ; prod == schéma → ce diff est
  **vide**, donc l'outil maison **ne peut pas** générer la migration de rattrapage (l'option b aurait
  imposé une base fantôme). → recommandation **option (a)**, validée par le porteur.

### Phase 1 — option (a), baseline régénéré
- **Local** : `0_init` régénéré depuis le schéma (`migrate diff --from-empty --to-schema`, 42 tables,
  741 lignes) ; les 6 anciennes migrations déplacées dans `prisma/migrations-archive-20260724/`
  (+ README explicatif).
- **Prod (destructive, SQL montré et validé avant)** : sauvegarde JSON des 6 lignes de
  `_prisma_migrations`, puis `DELETE FROM "_prisma_migrations"` (suivi uniquement, aucune donnée
  métier ni schéma touché), puis `npx prisma migrate resolve --applied 0_init` (inscrit le baseline
  avec le bon checksum, **sans rejouer le SQL**).
- **Vérifié** : `migrate status` = « 1 migration, up to date » ; `_prisma_migrations` = 1 ligne
  `0_init`, finished, **checksum aligné** avec le fichier.

### À retenir
- **Ne plus utiliser `db:push` pour un changement destiné à la prod** — toujours `db:migrate:new`,
  sinon l'outil (qui diffe base réelle → schéma) ne pourra plus générer la migration et la dérive
  repart.

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
