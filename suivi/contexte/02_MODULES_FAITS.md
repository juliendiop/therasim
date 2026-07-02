# ✅ MODULES DÉJÀ CODÉS — Détail

Pour chaque module : ce qu'il fait, les fichiers concernés, l'état.
Référence spec : `Conception/spec-v2-entrainement-progression (1).md`.

---

## 1. Socle multi-référentiels (spec §2)
**État : ✅ Fait**
- Schéma Prisma complet, `framework_id` partout (Option A : référentiels autonomes).
- Tables : `User`, `Framework`, `CompetencyGrid`, `Category`, `Competency`, `Scenario`,
  `Drill`, `Attempt`, `UserCompetencyState`.
- Fichier : `prisma/schema.prisma`.

## 2. Moteur de maîtrise / couverture / paliers (spec §5.1-5.3)
**État : ✅ Fait**
- Normalisation des scores → [0,1], moyenne mobile pondérée récence (α=0.4),
  paliers, couverture, détection d'oubli (>21 j).
- Fichier : `src/lib/mastery.ts`.

## 3. Routage adaptatif (spec §5.4)
**État : ✅ Fait**
- Score de priorité par compétence (poids 0.45/0.30/0.15/0.10), scopé au référentiel,
  difficulté cible en zone proximale, mode préféré (reconnaissance pour débutant),
  choix du meilleur drill candidat, raison de priorité lisible.
- Fichiers : `src/lib/routing.ts`, `src/lib/next-drill.ts`.
- ⚠️ `pertinence_scenario` (w4) câblée à 0 pour l'instant (pas de scénario actif en N1).

## 4. Enregistrement d'un essai + carte temps réel (spec §5.5)
**État : ✅ Fait**
- `recordAttempt()` : journalise l'`Attempt` puis met à jour `UserCompetencyState`
  (upsert maîtrise/attempts/last_practiced). Source de vérité unique.
- Fichier : `src/lib/attempts.ts`.

## 5. Carte de progression (spec §5.6)
**État : ✅ Fait**
- Vue d'ensemble (un profil par référentiel) + carte détaillée (catégories, compétences,
  palier, couverture, à réviser, priorités). Jamais de moyenne entre référentiels.
- Fichier : `src/lib/progress.ts`.

## 6. Mode entraînement — RECONNAISSANCE (spec §4)
**État : ✅ Fait (bout en bout, sans LLM)**
- Drill QCM : rappel théorique → stimulus → choix d'option → feedback de l'option +
  réponse modèle + réaction patient (si bonne réponse). Score = `option.score`.
- Met à jour la carte immédiatement.
- Fichiers : `src/app/drills/[id]/`, `src/app/api/drills/[id]/attempt/route.ts`.

## 7. Mode entraînement — PRODUCTION (spec §4.3)
**État : ⚙️ Codé, non encore testé en conditions réelles**
- Réponse libre → évaluateur mono-compétence **Mistral** (ancrages 1/3/5, temp 0.2,
  JSON strict) → note 1-5 normalisée → feedback + citation + réponse modèle.
- Item « non évalué » → n'écrit pas d'attempt (spec §5.1).
- Dégrade proprement si `MISTRAL_API_KEY` absente (HTTP 503 + message clair).
- Fichier : `src/lib/evaluator.ts` (+ branche production de l'`attempt` route).
- ⚠️ À tester avec une vraie clé Mistral (voir PLAN_DE_TEST).

## 8. API REST (spec §6)
**État : ✅ Fait**
- `GET /api/frameworks`, `GET /api/frameworks/{id}/drills/next`,
  `GET /api/drills/{id}`, `POST /api/drills/{id}/attempt`,
  `GET /api/me/progress`, `GET /api/me/progress/{framework_id}`, `GET /api/health`.
- ⚠️ `POST /api/auth/magic-link` et `GET /api/auth/callback` : **pas encore faits** (voir backlog).

## 9. Interface (spec §5.6)
**État : ✅ Fait**
- Catalogue (tuiles), carte de progression détaillée (en-tête stats, panneau priorités
  avec boutons « S'entraîner », barres de maîtrise colorées par palier, points de couverture,
  badge « à réviser »), lecteur de drill interactif.
- Fichiers : `src/app/catalogue/`, `src/app/f/[framework_id]/`, `src/app/drills/[id]/`.

## 11. Multi-tenant & marque blanche (session 2)
**État : ✅ Fondation faite**
- `Tenant` (public B2C / whitelabel B2B + champs branding), `tenant_id` partout
  (users, attempts, user_competency_state). Isolation par tenant sur toutes les routes.
- Fichiers : `prisma/schema.prisma`, gardes dans les pages/routes via `tenantCanAccess`.
- ⚠️ Reste : application visuelle du branding côté apprenant, sous-domaine par tenant.

## 12. Auth par lien magique + rôles (session 2)
**État : ✅ Fait (email simulé en dev)**
- Session JWT (jose) en cookie httpOnly, rôles super_admin / tenant_admin / learner,
  `AuthToken` usage unique. Pages `/login`, routes `/api/auth/*`.
- Fichier : `src/lib/auth.ts`.
- ⚠️ En dev le lien magique est **affiché à l'écran** (pas d'envoi email). Reste : Resend.

## 13. Catalogue + packs + entitlements (session 2)
**État : ✅ Fait**
- `Pack`, `PackFramework`, `TenantPack`, `TenantFrameworkOverride`. Accès effectif =
  packs accordés + ajouts − retraits.
- Fichier : `src/lib/entitlements.ts`.

## 14. Console super-admin (session 2)
**État : ✅ Fait (fonctionnel)**
- `/admin` (gardé super_admin) : vue d'ensemble, plateformes clientes (créer, accorder des
  packs, ajustement fin par référentiel, branding, statut), packs (créer + composer).
- Fichiers : `src/app/admin/` (layout, page, tenants, tenants/[id], packs, actions.ts).
- ⚠️ Reste : espace admin **côté tenant** (le client gère ses apprenants / ses stats).

## 15. Admin de contenu + génération IA (session 2 suite)
**État : ✅ Fait (création ; édition de carte existante au backlog)**
- `/admin/referentiels` : catalogue, création de référentiel (brouillon), écran détail qui
  **affiche et édite tout le contenu** (métadonnées, statut, catégories, compétences + ancrages,
  cartes par compétence), création de carte (reco/production) avec **génération IA** (Mistral).
- Fichiers : `src/app/admin/referentiels/**`, `src/lib/generate.ts`.
- ⚠️ Reste : ré-éditer une carte existante, gérer les cas (scenarios) dans l'UI.

## 16. Contenu de démo — ACT & Anamnèse (session 2 suite)
**État : ✅ Seedé (à valider cliniquement)**
- ACT (approche, 6 compétences, 3 drills) + Anamnèse (transversale, 6 compétences, 3 drills).
- Pack « Praticien+ » (EM+ACT+Anamnèse) accordé au tenant public.
- Fichier : `prisma/seed.ts`.

## 17. Simulateur N3 — entretien simulé (session 2 suite)
**État : ✅ Fait (nécessite MISTRAL_API_KEY pour fonctionner)**
- Patient incarné par un LLM, **réactif** à la posture du praticien ; entretien libre clôturé
  par l'apprenant ; **débrief complet** (note/compétence + narratif + moments clés) qui écrit
  des `Attempt` (source='simulation') → même carte de progression que les drills.
- Fichiers : `src/lib/simulator.ts`, `src/lib/mistral.ts`, `src/app/sim/**`,
  `src/app/f/[framework_id]/simulation/`, `src/app/api/sim/**`. Tables `SimSession`, `SimMessage`.
- ⚠️ Sans clé Mistral : la session démarre mais le patient ne répond pas (message 503 clair).

## 18. N2 — mini-scènes guidées (session 2 suite)
**État : ✅ Fait (nécessite MISTRAL_API_KEY)**
- Mini-scène dynamique : cible auto les **2 compétences prioritaires**, **4 tours**, **indices
  à la demande**, débrief ciblé sur ces 2 compétences → carte. Réutilise le moteur patient (N3),
  borné (`kind='miniscene'`, `maxTurns`, `focus`).
- Fichiers : `src/lib/simulator.ts` (generateHint), `src/lib/next-drill.ts` (topPriorityCodes),
  `src/app/api/sim/[id]/hint/`, bouton sur `src/app/f/[framework_id]/page.tsx`.

## 19. Config des modèles LLM par usage (session 2 suite)
**État : ✅ Fait**
- Table `app_config`, `src/lib/config.ts` (`getModel(usage)`), page `/admin/modeles` : choisir
  le modèle Mistral pour `patient` / `evaluateur` / `generation` (défaut = `MISTRAL_MODEL`).
- Clé Mistral installée (palier gratuit), défaut `mistral-small-latest`, testée OK.

## 20. Impersonation super-admin (accès aux plateformes)
**État : ✅ Fait**
- Bouton « Accéder » par tenant → session scopée au tenant + bandeau « Quitter ». Le tenant
  actif est porté par la session (`getSessionUser` → tenantId actif). Fichiers : `src/lib/auth.ts`,
  `src/app/admin/impersonate-actions.ts`, `layout.tsx`.

## 21. Connexion mot de passe + invitations (session 2 suite)
**État : ✅ Fait**
- Mot de passe (bcrypt) en plus du lien magique : `User.passwordHash`, `/api/auth/login`,
  page login 2 onglets, `/admin/compte`. Mot de passe initial via `ADMIN_INITIAL_PASSWORD`.
- Invitation membre : token magique 7 j → email (Resend) + lien affiché à l'admin.
- Fichiers : `src/lib/password.ts`, `src/lib/email.ts` (sendInvitation), `src/app/gestion/`.

## 22. Rôles & gestion des membres (session 2 suite)
**État : ✅ Fait**
- Rôles : super_admin · tenant_admin · **formateur** · learner (+ participant live anonyme).
  Helpers `src/lib/roles.ts`. Espace **`/gestion`** (admin de plateforme déclare formateurs/apprenants).

## 23. Sessions live — études de cas animées (session 2 suite)
**État : ✅ Fait (multi-référentiel + sas d'attente)**
- Le formateur crée une session, l'**ouvre** (sas), puis **déclenche le compte à rebours**
  (durée ajustable). Participants anonymes (prénom/nom), 2 modes, tableau de bord live
  (par compétence + par catégorie + individuels). Multi-référentiel (`pairs`).
- Fichiers : `src/lib/live.ts`, `src/app/sessions/`, `src/app/live/`, `src/app/api/live/`.

## 24. Formations & modules (session 2 suite)
**État : ✅ Fait**
- `Formation` + `FormationModule` (un module couvre **plusieurs référentiels** + compétences).
  Session live **par module** ou **pour toute la formation**. Fichiers : `src/app/formations/`.

## 25. Tableau de bord d'accueil + historique (2 juillet)
**État : ✅ Fait**
- `/accueil` (nouvelle page d'atterrissage) : entretien en cours à reprendre, dernier
  référentiel pratiqué + priorités, compétences à réviser (>21 j), stats 7 jours,
  dernières mises en situation. `/historique` : toutes les SimSessions (relecture du
  débrief, reprise d'une session en cours). Nav en-tête : Accueil / Domaines / Historique.
- Fichiers : `src/lib/dashboard.ts`, `src/lib/sim-history.ts`, `src/app/accueil/`,
  `src/app/historique/`, `src/app/layout.tsx`.

## 26. Chat de simulation streamé + confort (2 juillet)
**État : ✅ Fait (streaming à tester avec clé Mistral)**
- Réponse du patient **au fil de l'eau** (SSE Mistral → flux HTTP → UI), indicateur
  « le patient réfléchit… », compteur tour X/Y en mini-scène, confirmation avant
  Terminer, textarea auto-extensible, réplique rendue au champ en cas d'erreur.
- Fichiers : `src/lib/mistral.ts` (mistralChatStream), `src/lib/simulator.ts`
  (patientReplyStream), `src/app/api/sim/[id]/message/route.ts`, `src/app/sim/[id]/sim-chat.tsx`.

## 10. Contenu — référentiel EM (spec §2.5, §4.5)
**État : ✅ Fait (seed)**
- 1 référentiel **EM** (publié, type *approche*), grille `em-v1`, 3 catégories,
  **10 compétences** avec ancrages 1/3/5, **2 cas** (Marc/alcool, Sophie/tabac),
  **14 drills** (≥1 reconnaissance par compétence + 3 production).
- Fichier : `prisma/seed.ts`.
- ⚠️ Spec §4.5 vise **2 drills/compétence** (1 reco + 1 production). Atteint pour
  questions_ouvertes, reflets, evoquer_discours_changement. À compléter pour les 7 autres.
- ⚠️ **Validation clinique + calibration de l'évaluateur EM non faites** (spec §6/§7) :
  le contenu est réaliste mais doit être relu par un clinicien avant usage réel.
