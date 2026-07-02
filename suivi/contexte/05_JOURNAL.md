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
- 🔴 **Action requise** : `npm run db:push` (colonnes `first_name`, `consent_at`).

### État en fin de session (septies)
- Build OK, types OK. Reste au porteur : `npm run db:push`, puis tester le parcours complet
  landing → « Créer un compte » → /inscription → accueil de bienvenue.
- Option backlog notée : page politique de confidentialité dédiée, double opt-in email.

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
