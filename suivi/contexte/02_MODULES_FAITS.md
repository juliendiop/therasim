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

## 7. Mode entraînement — PRODUCTION (spec §4.3 ; évaluateur calibré le 22 juillet)
**État : ✅ Codé + évaluateur calibré (V1)**
- Réponse libre → évaluateur mono-compétence (Mistral **ou** Claude, usage `evaluateur`) →
  note 1-5 normalisée → feedback + citation + réponse modèle.
- Item « non évalué » → n'écrit pas d'attempt (spec §5.1).
- Dégrade proprement si aucune clé IA (HTTP 503 + message clair).
- **Calibration (22 juillet)** : prompt refondu (rubrique 1..5 explicite, raisonnement avant
  la note, exemple travaillé, `non_evalue` resserré, **température 0** → note reproductible,
  règle « au niveau du modèle = 5 »). Cœur pur `src/lib/evaluator-core.ts` (prompt + parsing,
  sans `server-only`) séparé de l'appel LLM `src/lib/evaluator.ts`, pour être testable hors Next.
- **Harnais `scripts/calibrate-evaluator.ts` (`npm run calibrate`)** : mesure l'accord sur un
  gold set → **baseline MAE 0.28, 94% à ±1, 0 violation d'ordre, non_evalue 2/2 (verdict
  ACCEPTABLE)**. À relancer à chaque changement de prompt/modèle.
- Fichiers : `src/lib/evaluator.ts`, `src/lib/evaluator-core.ts`, `scripts/calibrate-evaluator.ts`,
  branche production de l'`attempt` route.
- ⚠️ Reste : faire **coter/étendre le gold set par un clinicien** (niveaux moyens 2-4, plus
  subjectifs) — cf. `04_RESTE_A_FAIRE.md`.

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

## 16. Contenu de démo — ACT & Anamnèse (session 2 suite ; enrichi le 22 juillet)
**État : ✅ Seedé (à valider cliniquement)**
- ACT (approche, 6 compétences) + Anamnèse (transversale, 6 compétences).
- **ACT** (porté à **5 cartes/compétence** le 22 juillet, à la demande du porteur — beaucoup
  d'étudiants formés à l'ACT) : **30 drills** (3 reconnaissance + 2 production par compétence),
  **3 cas** : Léa/anxiété, Karim/ruminations, **Sofiane/douleur chronique** (nouveau, cas
  ACT emblématique). (Étapes : 3 → 12 → 30.)
- **Anamnèse** (produit d'appel, porté à **5 cartes/compétence** le 22 juillet) : **30 drills**
  (3 reconnaissance + 2 production par compétence), **3 cas** : M. Dubois/réservé,
  Mme Bonnet/volubile, **Mme Faure/douleurs chroniques** (nouveau). L'anamnèse est le
  meilleur domaine « gratuit » à l'inscription (transversale — cf. `04_RESTE_A_FAIRE.md`).
- Pack « Praticien+ » (EM+ACT+Anamnèse) accordé au tenant public.
- Fichier : `prisma/seed.ts`. Idempotent (upsert par id) → re-`npm run db:seed` sûr en prod
  (ajoute les nouvelles cartes sans toucher aux données existantes).
- ⚠️ Contenu clinique rédigé par Claude, réaliste mais **à relire par un clinicien** avant
  usage sérieux (comme les drills initiaux).

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

## 19. Config des modèles LLM par usage (session 2 suite, étendu le 2 juillet)
**État : ✅ Fait (multi-fournisseur)**
- Table `app_config`, page `/admin/modeles` : choisir le **fournisseur** (Mistral ou
  **Claude/Anthropic**) ET le modèle pour `patient` / `evaluateur` / `generation`.
  Clés en env : `MISTRAL_API_KEY` / `ANTHROPIC_API_KEY` (statut affiché dans l'admin).
- Couche unifiée `src/lib/llm.ts` (`llmChat`/`llmChatStream` par usage) → dispatch vers
  `src/lib/mistral.ts` ou `src/lib/anthropic.ts` (SDK officiel `@anthropic-ai/sdk`,
  streaming, extraction JSON, pas de temperature côté Claude — retirée des modèles récents).
- Garde-fou : modèle incohérent avec le fournisseur → modèle par défaut du fournisseur
  (Claude : `claude-opus-4-8`). `config.getLlm(usage)` remplace `getModel(usage)`.
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

## 27. Mot de passe oublié (2 juillet)
**État : ✅ Fait**
- Lien « Mot de passe oublié ? » sur `/login` → `/api/auth/forgot-password` (réponse
  générique, ne révèle pas si le compte existe ; réutilise AuthToken, TTL 60 min) →
  email Resend (`sendPasswordReset`) ou lien affiché en dev → page `/reset-password`
  (nouveau mot de passe ×2, ≥8 caractères) → `/api/auth/reset-password` (consomme le
  token, pose le hash bcrypt, ouvre la session, audit `password_reset`).
- Fichiers : `src/app/api/auth/forgot-password/`, `src/app/api/auth/reset-password/`,
  `src/app/reset-password/`, `src/app/login/page.tsx`, `src/lib/email.ts`, `src/lib/audit.ts`.

## 28. Page publique d'acquisition + démo jouable (2 juillet)
**État : ✅ Fait**
- `/` (visiteur non connecté) : landing MELETA — héro, **exercice de démonstration
  jouable sans compte** (3 drills de reconnaissance embarqués côté client : aucun appel
  LLM, aucun crédit, rien en base), « comment ça marche » (3 niveaux + carte), section
  **praticiens/coachs** (B2C) et section **écoles/organismes** (B2B, marque blanche,
  sessions live, CTA mailto `contact@meleta.app`), réassurance (fictif, formatif non
  certifiant), bandeau final. Connecté → redirection `/accueil`.
- En-tête : bouton « Se connecter » pour les visiteurs, logo → `/` (visiteur) ou
  `/accueil` (connecté).
- Fichiers : `src/app/page.tsx`, `src/app/demo-drill.tsx`, `src/app/layout.tsx`.
- ⚠️ Vérifier que la boîte `contact@meleta.app` existe (réception des demandes de démo).

## 29. Espace supervision formateur + export CSV (2 juillet)
**État : ✅ Fait (V1)** — ⚠️ nécessite `npm run db:push` (nouvelle table `supervisor_notes`)
- `/supervision` : liste des apprenants du tenant + activité (dernier essai, nb exercices,
  nb mises en situation), recherche par email.
- `/supervision/[id]` : progression par référentiel (jamais de moyenne cross-référentiel),
  historique des mises en situation, fil de **notes** du formateur.
- `/supervision/[id]/sim/[simId]` : relecture lecture seule (transcript + débrief) d'un
  entretien précis + note rattachée. Toute lecture vérifiée cross-tenant.
- Export **CSV** des résultats individuels d'une session live : `/api/live/[id]/export`,
  bouton sur `src/app/sessions/[id]/dashboard.tsx`.
- Fichiers : `src/lib/supervision.ts`, `src/app/supervision/**`,
  `src/app/api/live/[id]/export/`, `canSupervise()` dans `src/lib/roles.ts`,
  modèle `SupervisorNote` dans `prisma/schema.prisma`.

## 30. Auto-évaluation avant débrief + replay annoté (2 juillet)
**État : ✅ Fait (V1)** — ⚠️ nécessite `npm run db:push` (nouveau champ `SimSession.selfAssessment`)
- Avant la note IA, l'apprenant s'auto-évalue (1-5) sur chaque compétence évaluée ; débrief
  affiche « vous : X/5 · IA : Y/5 ». Skippable. Stocké séparément du débrief.
- « Moments clés » rattachés au message du transcript correspondant (recouvrement de mots,
  tolère la paraphrase) et surlignés en contexte, au lieu d'une liste hors contexte. Fallback
  liste pour les non-rattachés. Appliqué côté apprenant ET côté supervision formateur.
- Bonus : les noms de compétences dans le débrief (code brut affiché avant) sont résolus.
- Fichiers : `src/lib/moment-match.ts`, `src/app/sim/[id]/sim-chat.tsx`, `src/app/sim/[id]/page.tsx`,
  `src/lib/simulator.ts`, `src/app/api/sim/[id]/end/route.ts`,
  `src/app/supervision/[id]/sim/[simId]/page.tsx`.

## 31. Avatars patients + célébration des paliers (2 juillet)
**État : ✅ Fait (V1, ajusté après retour porteur)**
- Portraits illustrés déterministes (DiceBear, style « lorelei ») générés **côté serveur** à
  partir du titre du scénario — même seed = même visage, à chaque session. Servis par
  `/api/patient-avatar?seed=...` (SVG, cache long car contenu immuable pour un seed donné) ;
  le composant `PatientAvatar` n'est plus qu'un `<img>`, donc zéro poids ajouté au bundle
  client. Remplace la première version « monogramme coloré » (jugée trop pauvre — juste
  une bulle avec une lettre). Palette de fond alignée sur l'identité MELETA.
- Intégré dans le chat de simulation, l'historique, l'accueil et la supervision.
- ⚠️ Un serveur `npm run dev` déjà lancé AVANT l'installation de `@dicebear/*` doit être
  **redémarré** pour résoudre les nouveaux paquets (limitation Next.js standard, pas un bug).
- Bannière de célébration animée quand un essai fait franchir un palier **solide/maîtrisé**
  (drill ou compétence d'un débrief) — pas le premier essai (non_pratique→faible).
- Fichiers : `src/lib/patient.ts`, `src/app/_components/patient-avatar.tsx`,
  `src/lib/mastery.ts` (`isMilestone`), `src/lib/attempts.ts` (`recordAttempt` renvoie le
  franchissement), `src/app/drills/[id]/drill-player.tsx`, `src/app/sim/[id]/sim-chat.tsx`,
  `src/app/api/drills/[id]/attempt/route.ts`, `src/app/globals.css` (`.ts-level-up`).

## 32. Paiements Stripe — packs de crédits + abonnements (2 juillet)
**État : ✅ Fait (V1)** — ⚠️ nécessite `npm run db:push` + setup Stripe manuel (voir `00_DEMARRAGE.md`)
- **Packs de crédits** (`/credits`, déjà dans l'UI) : paiement unique via Stripe Checkout
  hébergé. Boutons « Acheter » réels (étaient stubbés `?soon=`).
- **Forfaits d'abonnement** (nouveau) : récurrent mensuel, **entièrement configurables par
  le super-admin** (nom, prix, crédits accordés/mois, Price ID Stripe) via
  `/admin/facturation` — aucun prix/nom en dur côté code. Un abonnement actif accorde ses
  crédits à chaque renouvellement (webhook `invoice.paid`), en plus (pas à la place) de la
  recharge mensuelle gratuite existante.
- **Webhook** `/api/stripe/webhook` : corps brut + vérification de signature, idempotence
  via table `StripeEvent` (Stripe garantit « au moins une fois », jamais « exactement une
  fois »). Gère `checkout.session.completed`, `invoice.paid`,
  `customer.subscription.updated`, `customer.subscription.deleted`. Les crédits d'un
  abonnement sont accordés **uniquement** sur `invoice.paid` (jamais sur
  `checkout.session.completed` en mode abonnement) pour éviter un double octroi au premier
  paiement.
- Portail Stripe (« Gérer mon abonnement ») pour la résiliation en self-service.
- Fichiers : `src/lib/stripe.ts`, `src/lib/billing.ts`, `src/app/api/stripe/webhook/`,
  `src/app/credits/actions.ts` + `page.tsx` (refonte), `src/app/admin/facturation/**`.
  Modèles `SubscriptionPlan`/`UserSubscription`/`StripeEvent` + `User.stripeCustomerId`
  (`prisma/schema.prisma`).
- ⚠️ Piège Stripe API récente rencontré : `Subscription.current_period_end` a migré vers
  `SubscriptionItem.current_period_end`, et `Invoice.subscription` vers
  `Invoice.parent.subscription_details.subscription` — gérés défensivement dans
  `billing.ts`.
- ⚠️ **Setup manuel requis** (je ne peux pas le faire — pas de compte Stripe) : clé API,
  création des Prices, enregistrement du webhook, activation du Customer Portal. Détail
  complet dans `00_DEMARRAGE.md`. Non testé de bout en bout par manque d'accès Stripe.
- Hors scope V1 : édition en place d'un forfait existant (créer + activer/désactiver
  seulement), Stripe Tax, forfait « accès illimité » sans décompte de crédits.

## 33. Freemium — accès aux référentiels lié aux paiements (2 juillet)
**État : ✅ Fait (V1)** — ⚠️ nécessite `npm run db:push` + config dans `/admin/facturation`
- **Modèle économique** (décidé avec le porteur, ajusté après son retour) : à l'inscription
  B2C, seuls les référentiels **gratuits** (config admin, défaut : EM) sont utilisables.
  Les autres restent **visibles mais verrouillés** (vitrine incitative). Déblocage par :
  **quota d'abonnement** — chaque forfait donne droit à N domaines **au choix de l'abonné**
  (vide = tout le catalogue) ; l'abonné débloque lui-même en cliquant sur un domaine
  verrouillé (« il vous reste X choix ») ; choix **définitifs tant qu'on est abonné**
  (anti-abus : pas d'échange, sinon un forfait 1 domaine donnerait tout en alternant) —
  OU **achat à l'unité** (paiement unique Stripe, accès à vie, avec ou sans abonnement).
  La 1ère version « sélection de domaines par forfait, cochée en admin » a été remplacée
  (jugée trop complexe à administrer par le porteur) par ce quota, plus simple et plus
  vendeur.
- **Unité de vente = référentiel** (pas la compétence individuelle — le moteur entier
  fonctionne par référentiel : carte, routage, drills).
- **B2B** : tenants whitelabel et rôles encadrants (admin/formateur) non filtrés par
  défaut — l'école paie au niveau plateforme (TenantPack), ses membres ont tout son
  catalogue. **Opt-in « offres individuelles »** par plateforme
  (`Tenant.allowIndividualOffers`, toggle dans `/admin/tenants/[id]`) : activé, les
  apprenants de la plateforme voient le catalogue PUBLIC en vitrine et peuvent acheter à
  l'unité / s'abonner (cas « l'école, c'est nous ») — leur catalogue école reste inclus
  d'office. Les abonnements sont bloqués (UI + garde serveur `canBuyIndividualOffers`)
  pour les membres B2B sans opt-in (promesse « domaines au choix » inconsommable sinon).
- Accès : `userFrameworkAccess(user)` / `userCanAccess(user, fwId)` dans
  `src/lib/entitlements.ts` (toujours borné par le plafond tenant). Gardes remplacées sur
  tous les parcours apprenant : drills (page + GET + attempt), entraînement, sim actions,
  simulation, page référentiel, drill suivant (API).
- **Vitrine** : tuiles verrouillées dans le catalogue (cadenas + aperçu des compétences),
  **paywall** `/f/[id]` (liste complète des compétences = l'incitatif, prix à l'unité,
  forfaits qui l'incluent), section « À découvrir » sur l'accueil, domaines inclus affichés
  par forfait sur `/credits`.
- **Admin `/admin/facturation`** (étendu) : quota de domaines par forfait (simple champ
  numérique, vide = tout), prix + Price ID + actif par référentiel (achat à l'unité),
  cases « gratuits à l'inscription ».
- Modèles : `SubscriptionPlan.frameworkQuota`, `FrameworkOffer`, `UserFrameworkAccess`
  (source `purchase`/`admin` = à vie ; `subscription_choice` = valide si abo actif, conservé
  en base → se réactive si l'abonné revient). Webhook : la branche
  `metadata.type === 'framework'` de `checkout.session.completed` crée l'accès à vie.
- ⚠️ Au déploiement, les référentiels non-gratuits se verrouillent immédiatement pour les
  apprenants B2C existants (comportement freemium voulu) — configurer les gratuits/forfaits/
  offres dans `/admin/facturation` et créer les Prices one-time Stripe correspondants.

## 34. Onboarding / inscription B2C (2 juillet)
**État : ✅ Fait (V1)** — ⚠️ nécessite `npm run db:push` (`User.firstName`, `User.consentAt`)
- Avant : « Créer un compte » et « Se connecter » pointaient tous deux vers `/login`, qui
  affiche par défaut un formulaire mot de passe **de connexion** — inutilisable pour un
  nouveau venu (pas de mot de passe). Tue-conversion pour une campagne promo.
- Nouvelle page **`/inscription`** (site public B2C) : prénom (optionnel, accueil
  personnalisé), email, mot de passe (≥8) → accès **immédiat** (pas d'aller-retour email) ;
  alternative « lien par email » (magic link) ; **case de consentement RGPD obligatoire**
  (horodatée dans `consentAt`). Réassurance en tête (domaine offert, crédits, carte).
- API `/api/auth/register` : refuse un email déjà pris (→ message « connectez-vous »), crée
  un `learner` dans le tenant **public**, ouvre la session, redirige vers `/accueil?bienvenue=1`.
- **Accueil de bienvenue** : greeting personnalisé (« Bonjour Marie 👋 »), bannière
  « votre compte est prêt 🎉 » avec CTA **direct** vers l'entraînement du 1er domaine
  débloqué (moins de clics = meilleure activation) + rappel du parcours en 3 étapes.
- Liens croisés : `/login` ↔ `/inscription`. Tous les CTA d'inscription de la landing et
  de la démo pointent désormais vers `/inscription`. Le bouton header « Se connecter »
  (visiteur) reste sur `/login`.
- Fichiers : `src/app/inscription/`, `src/app/api/auth/register/`, `src/app/login/page.tsx`,
  `src/app/page.tsx`, `src/app/demo-drill.tsx`, `src/app/accueil/page.tsx`,
  `src/lib/auth.ts` (`firstName` dans `CurrentUser`). Le journal d'activité affichait déjà
  « Inscription » (dérivé de `User.createdAt`) — inchangé.
- ⚠️ Reste (option) : page politique de confidentialité dédiée (le consentement pointe pour
  l'instant vers un texte inline) ; vérification d'email (double opt-in).

## 35. Page publique /tarifs + report du forfait choisi à l'inscription (3 juillet)
**État : ✅ Fait**
- Page publique `/tarifs` (Server Component) : forfaits d'abonnement (lus depuis
  `SubscriptionPlan` actifs en DB, badge « Le plus choisi » sur `praticien`),
  packs de crédits (`CREDIT_PACKS`), carte « Écoles et organismes » sans prix
  vers `/demande-demo`, FAQ 6 questions + JSON-LD `FAQPage`, metadata SEO.
  Réutilise intégralement le système de paiement existant (Server Actions
  `checkoutPlanAction`/`checkoutPackAction`, webhook `/api/stripe/webhook`
  déjà en place et déjà enregistré côté Stripe) — aucune nouvelle route de
  paiement créée.
- CTA résolus côté serveur (zéro JS supplémentaire) : visiteur →
  `/inscription?plan=<id>` ; connecté + éligible → formulaire Server Action ;
  connecté non éligible (B2B sans opt-in) → CTA grisé + message explicatif.
- **Report du forfait choisi** entre `/inscription` et le premier checkout,
  nouveau : `inscription/page.tsx` lit `?plan=` (`useSearchParams` + `Suspense`)
  et le transmet aux deux modes (mot de passe et lien magique) ;
  `/api/auth/register` déclenche le checkout Stripe direct après création du
  compte si un `planId` valide est fourni (repli silencieux sur l'accueil de
  bienvenue si le checkout échoue) ; `/api/auth/magic-link` encode le plan
  dans l'URL du lien ; `/api/auth/callback` fait de même après connexion.
- Liens « Tarifs » : header (visiteur, à côté de Se connecter/Créer un
  compte) et footer partagé (site public uniquement, jamais en marque blanche).
- **✅ Validé en conditions réelles** (navigateur, `meleta.app/tarifs`) : rendu
  de la page (forfaits/packs/FAQ/JSON-LD 6 questions), lien Tarifs visible,
  clic « S'abonner » → `/inscription?plan=...` → inscription → checkout Stripe
  déclenché avec le bon forfait (URL Stripe valide obtenue).
- ⚠️ **Découverte importante lors du test** : la clé Stripe en production est
  passée en **mode LIVE** (`cs_live_...`, plus `cs_test_...`) — le porteur a dû
  basculer les clés Vercel suite à un échange précédent sur le passage en
  production. Je me suis arrêté avant de compléter un paiement réel (aucune
  charge engagée, une session Checkout non finalisée expire sans débit) ; la
  validation finale du paiement (carte réelle) est laissée au porteur, qui a
  dit vouloir tester lui-même.
- Deux comptes de test jetables ont été créés en base au fil des sessions
  (`julien.diop+mobtest...@gmail.com`, `julien.diop+tarifs...@gmail.com`),
  sans abonnement actif (paiement non finalisé) — à supprimer si le porteur
  le souhaite (non fait automatiquement : suppression d'utilisateur en prod,
  action laissée à sa discrétion).

## 36. Programme d'affiliation « Ambassadeurs » (22 juillet)
**État : ✅ Fait (V1), pleinement opérationnel** — `npm run db:push` fait, `charge.refunded` enregistré sur le webhook Stripe par le porteur, commit poussé sur `main` (voir `05_JOURNAL.md`)
- Parrainage 2 niveaux (commission récurrente à vie, niveau 2 **dérivé**, jamais stocké —
  contrainte légale anti-système pyramidal), attribution par cookie `ts_ref` (first-touch,
  résolue à l'inscription), demandes de paiement (facture email, seuil configurable, solde
  remis à 0 uniquement par l'admin), volet écoles B2B (commission manuelle), kit de diffusion
  (textes + visuels SVG).
- Fichiers : `src/lib/affiliation.ts`, `src/lib/affiliation-copy.ts`, `src/lib/affiliation-kit.ts`,
  `src/app/r/[code]/`, `src/app/affiliation/`, `src/app/ambassadeurs/`,
  `src/app/admin/affiliation/`, modèles `CommissionLedger`/`PayoutRequest` + champs `User`
  (`prisma/schema.prisma`). Commission calculée dans `handleInvoicePaid` (`src/lib/billing.ts`),
  clawback best-effort dans `handleChargeRefunded`.
- Spec : `Conception/spec-affiliation-ambassadeurs.md`.

## 37. Bêta fermée — invitations + essai 90 j sans carte (23 juillet)
**État : ✅ Code fait, `db:push` fait** — ⚠️ reste : 2 événements webhook Stripe + `CRON_SECRET`
- **Invitations à usage unique** (`BetaInvite`, codes 24 car. base32 via `crypto`), générées par
  `npm run beta:invites -- --count 25` (CSV `code,url,email`). Garde-fou si l'URL est localhost.
- **`/beta/[code]`** : 5 états ; les 4 cas d'échec renvoient le **même** écran (sinon on peut
  énumérer les codes valides). Retour post-auth via `?next=`, validé par `safeNextPath`.
- **Server Action** : verrou atomique (`updateMany` conditionnel), rate limiting IP+user en base,
  `subscriptions.create` avec `trial_period_days: 90` et
  `trial_settings.end_behavior.missing_payment_method: "cancel"` (aucune facture au terme),
  `idempotencyKey`, compensation en `PENDING` si Stripe échoue.
- **Accès en essai** : `isSubscriptionEntitled()` (active **+ trialing**) remplace toutes les
  comparaisons de statut. Prédicat distinct `isSubscriptionBillable()` pour le revenu
  (un essai ne génère aucune commission d'affiliation).
- **Crédits** : `grantSubscriptionCredits` à **idempotence structurelle** — contrainte unique
  `(stripeSubscriptionId, reason, periodIndex)`, `periodIndex` relatif à l'ancre de l'abonnement
  (jamais le mois calendaire). Recharge paresseuse cumulative avec rattrapage
  (`syncSubscriptionCredits`), alignée sur le comportement du parcours payant.
- **Webhooks** : `customer.subscription.created` (indispensable — sans lui un abonnement créé par
  API n'existe pas côté app), `trial_will_end`, `updated` (+ synchro `planId` et différentiel
  `plan_upgrade_topup`), `deleted`.
- **Emails** : bienvenue, mi-parcours J+45 (cron quotidien `/api/cron/beta-mid-trial`), fin d'essai.
- **Admin** `/admin/beta` : table, compteurs, révocation des `PENDING`.
- **Tests** : vitest (17 unitaires) + 6 tests base ignorés sans `TEST_DATABASE_URL` +
  `npm run beta:testclock` (Test Clock Stripe, refuse une clé LIVE).
- Fichiers : `src/lib/{beta,beta-code,beta-status,billing-period,rate-limit,safe-redirect}.ts`,
  `src/app/beta/[code]/**`, `src/app/admin/beta/**`, `src/app/api/cron/beta-mid-trial/`,
  `scripts/{generate-beta-invites,beta-test-clock}.ts`, `tests/**`.
- **Deux bugs préexistants corrigés au passage** : `handleSubscriptionUpdated` avalait
  silencieusement le cas « pas de ligne locale » (`.catch(() => {})`), et ne mettait **jamais**
  `planId` à jour — un changement de forfait au portail Stripe laissait l'app sur l'ancien forfait.

## 10. Contenu — référentiel EM (spec §2.5, §4.5 ; enrichi le 22 juillet)
**État : ✅ Fait (seed)**
- 1 référentiel **EM** (publié, type *approche*), grille `em-v1`, 3 catégories,
  **10 compétences** avec ancrages 1/3/5.
- **Enrichi le 22 juillet (produit d'appel) : 50 drills, EXACTEMENT 5 cartes par compétence**
  (3 reconnaissance + 2 production), les deux modes partout, et **4 cas patients** :
  Marc/alcool, Sophie/tabac, Nadia/diabète-activité physique, **Théo/cannabis** (nouveau).
  (Étapes : 14 → 32 → 50.)
- Fichier : `prisma/seed.ts`. Idempotent (upsert par id) → re-`npm run db:seed` sûr en prod.
- ⚠️ **Validation clinique + calibration de l'évaluateur EM non faites** (spec §6/§7) :
  le contenu est réaliste mais doit être relu par un clinicien avant usage réel.

---

## 38. Support client — tickets + assistance IA (UE) (24 juillet)
**État : ✅ Fait** — commits `64250d0`, `034dd96`, `83ff3a2`
- Widget de support accessible depuis le layout (tout utilisateur connecté) : ouverture
  d'un **ticket**, fil de messages. Espace admin `/admin/support` (liste, détail) avec un
  **panneau d'assistance IA** qui analyse le ticket et rédige un **projet de réponse**.
- L'usage LLM `support` est **verrouillé sur Mistral (UE)** : un ticket se rapporte à une
  personne identifiée → RGPD (cf. module 19, `EU_ONLY_USAGES` dans `config.ts`).
- Fix UI : la modale du widget passe par un **portail** (plus rognée en haut, au-dessus du header).
- Fichiers : `src/lib/support.ts`, `src/app/support/**`, `src/app/admin/support/**`,
  `src/app/_components/support-widget.tsx`. Table de tickets (`prisma/schema.prisma`).

## 39. Migrations Prisma avec baseline — fin des `db:push` en prod (24 juillet)
**État : ✅ Fait (mais rattrapage à prévoir, voir ⚠️)** — commits `19580b4`, `61fe5bc`
- Bascule de `db:push` vers **`prisma migrate`** : baseline **`0_init`** (reflète le schéma
  prod existant) + migrations versionnées créées via `scripts/new-migration.ts`
  (`npm run db:migrate:new`). Décision consignée dans `03_DECISIONS.md`.
- ⚠️ Le **build n'exécute PAS** `prisma migrate deploy` (retiré, commit `61fe5bc`) : il prenait
  un verrou d'avis Postgres → **P1002** sous déploiements concurrents. Build =
  `prisma generate && next build`. Les migrations sont donc appliquées **séparément**.
- ⚠️ **État réel à surveiller** : les fichiers de migration s'arrêtent au **24 juillet**
  (`…_testimonial_source`). Les changements de schéma des modules 40-46 ci-dessous ont été
  appliqués en **`db:push`** → ils ne sont **pas capturés** dans `prisma/migrations/`.
  `schema.prisma` reste la source de vérité et la prod est alignée (db:push), mais un
  `migrate deploy` sur une base neuve donnerait le schéma du 24 juillet. **À rattraper** :
  soit régénérer un baseline, soit créer les migrations manquantes (cf. `04_RESTE_A_FAIRE.md`).

## 40. Bêta — relances, feedback à chaud, bilan J+21 (NPS), témoignages, avis libre (24 juillet)
**État : ✅ Fait** — commits `297544a`, `d43aa4d`, `daeabcb`, `36827d5`
- **Relance J+2** automatique aux invités bêta **sans activité** (cron `/api/cron/beta-nudge`,
  email dédié, marqueur anti-doublon en base).
- **Questionnaire « impression à chaud »** déclenché après **3 simulations ou J+7**
  (`/beta/feedback`, cron `/api/cron/beta-feedback`, admin `/admin/beta/feedback`).
- **Bilan J+21 avec NPS** (`/beta/bilan`, cron `/api/cron/beta-bilan`, admin `/admin/beta/bilan`).
- **Témoignages** : les promoteurs (NPS élevé) peuvent laisser un témoignage
  (`/beta/temoignage`), affiché sur le site après validation admin (`testimonials-section.tsx`,
  admin `/admin/beta/temoignages`).
- **Avis libre** depuis le site pour **tout utilisateur** (`/avis`), même circuit de validation.
- Fichiers : `src/lib/beta-feedback*.ts`, `src/lib/beta-bilan*.ts`, `src/lib/testimonial-*.ts`,
  `src/app/beta/{feedback,bilan,temoignage}/**`, `src/app/avis/**`,
  `src/app/api/cron/beta-{nudge,feedback,bilan}/**`, `src/app/admin/beta/**`. Crons dans `vercel.json`.

## 41. Pages publiques /domaines + SEO + amorce blog (24 juillet)
**État : ✅ Fait** — commits `77df936`, `8ddf8ca`
- Pages **publiques catalogue** `/domaines` (socle / spécialités, composant `domaine-card`),
  page domaine détaillée porteuse du SEO (`Framework.slug` + `introPublique`).
- **`sitemap.xml` + `robots.txt`** (pages publiques, domaine canonique).
- Amorce **blog MDX** (`/blog/[slug]`, `mdx-components`), composant `legal-page` partagé.
- Fichiers : `src/app/domaines/**`, `src/app/blog/**`, `src/app/_components/{domaine-card,legal-page}.tsx`,
  `sitemap.ts`/`robots.ts`, champs `slug`/`introPublique` (`prisma/schema.prisma`).

## 42. Catalogue élargi — 8 référentiels (24 juillet)
**État : ✅ Seedé (à valider cliniquement)** — commit `159bcbf` (+ ajouts antérieurs)
- Le catalogue compte désormais **8 référentiels** : EM, ACT, Anamnèse (produits d'appel
  historiques), **Alliance thérapeutique** et **Ruptures d'alliance** (transversales *socle*),
  **Accompagner le deuil** et **Hypnose ericksonienne** (situation/approche), **Ménopause**
  (situation). `159bcbf` ajoute **Deuil + Hypnose** ; Alliance/Ruptures/Ménopause ont été
  ajoutés au fil de l'eau (Alliance/Ruptures aussi via `scripts/seed-alliance-ruptures.ts`,
  encore non versionné — cf. `git status`).
- ⚠️ Contenu clinique rédigé par Claude → **à relire par un clinicien**.

## 43. Refonte tarifaire — socle/spécialités, « sans compter », N3 découverte, annuel (24 juillet)
**État : ✅ Fait** — commits `52bd2e9`, `26887cb`, `ed9e195`, `8563c36`
- Nature commerciale par référentiel : **`Framework.nature`** = `socle` (accessible à tout
  compte, gratuit compris, **hors quota**) vs `specialite` (comptée dans le quota du forfait).
- **Entretien N3 en découverte** : le compte gratuit « Découverte » a droit à **1 séance
  complète offerte, à vie** (au-delà → mur d'upgrade).
- Forfait **« sans compter »** : `SubscriptionPlan.monthlyCredits = null` → `isUnlimited(userId)`,
  le **débit de crédits est court-circuité** pour ces abonnés.
- **Garde-fous d'usage loyal** (modèle « tout inclus ») + page admin **`/admin/usage`**.
- **Abonnement annuel** : `SubscriptionPlan.stripePriceIdYearly` ; page **`/tarifs` refondue
  en grille 4 colonnes** (mensuel/annuel). Prix mensuel **éditable** sur un forfait existant.
- Fichiers : `src/app/tarifs/**`, `src/app/admin/usage/**`, `src/lib/billing.ts`,
  `src/lib/credits.ts`, `src/app/f/[framework_id]/{page,paywall}.tsx`, schéma (`nature`,
  `tier`, `stripePriceIdYearly`).

## 44. Refonte du portefeuille de crédits + murs de crédits (24-30 juillet)
**État : ✅ Fait** — commits `54779b6`, `42e5d73`, `5b98188`
- Deux compteurs distincts : **`User.planCredits`** (allocation du forfait, **non cumulative**,
  **remise à 0 en fin d'accès**) et **`User.credits`** (portefeuille packs + crédits offerts,
  **persistant**). Ordre de consommation : **planCredits d'abord, puis credits** — logique pure
  extraite dans `src/lib/credit-split.ts` (`splitDebit`, **testée**).
- **`CreditPack`** (modèle unique : credits / prix / Price ID / actif / ordre ; id `s`/`m`/`l`) :
  les packs sont une **recharge réservée aux abonnés** (Découverte n'a que l'upgrade). Les
  métadonnées d'achat **figent** crédits + prix au moment de l'achat.
- **Deux murs de crédits** (modale `credits-wall.tsx`, ouverte par `?creditwall=`) : mur
  « credits » (recharge + upgrade) vs mur « level3 » (séance Découverte à vie épuisée →
  upgrade seul). Endpoint **`/api/me/credits-wall`** (recalcul **autoritaire**, solde frais).
  Les Server Actions redirigent vers `?creditwall=` en cas de refus (jamais d'erreur/toast).
- Pré-check client **`session-launchers.tsx`** (mini-scène / séance), bannière
  **`low-credits-banner.tsx`**, mention de séance **contextuelle** sur `/f/[id]`.
- Fichiers : `src/lib/credits.ts`, `src/lib/credit-split.ts`, `src/app/_components/{credits-wall,
  low-credits-banner}.tsx`, `src/app/api/me/credits-wall/route.ts`,
  `src/app/f/[framework_id]/session-launchers.tsx`, `test/consumption-order.test.ts`.

## 45. Feedback au clic — effet de pression + anti double-clic (30 juillet)
**État : ✅ Fait** — commits `6381d1d`, `f2dc65f`
- Constat porteur : un bouton qui met du temps ne donnait **aucun retour** → tendance à
  recliquer. `SubmitButton` (`useFormStatus` → spinner + désactivé) sur les boutons lents /
  monétaires ; **effet de pression global CSS** (`:active { scale(0.98) }`) sur les boutons
  **et** les liens stylés en bouton / carte.
- Fichiers : `src/app/_components/submit-button.tsx`, `src/app/globals.css`.

## 46. Changement de forfait depuis l'app + re-sync Stripe (30 juillet)
**État : ✅ Fait (code)** — commit `285d6a0` — ⚠️ à tester en prod (clé Stripe seulement sur Vercel)
- **Changer de forfait sans passer par le portail Stripe** : montée en gamme **immédiate**
  (prorata facturé tout de suite, `proration_behavior: "always_invoice"`), descente **au
  prochain renouvellement** (planning d'abonnement Stripe), toujours **dans le cycle courant**
  (mensuel reste mensuel, annuel reste annuel).
- **Sélecteur marketing** sur `/credits` : upgrades mis en avant (« +X crédits/mois »,
  « immédiat »), downgrades discrets (« au renouvellement »).
- Affichage **« forfait actif jusqu'au X »** quand une résiliation en fin de période est programmée.
- **Section admin « Abonnements »** dans `/admin/facturation` avec bouton **« Re-synchroniser »**
  (relit l'état réel chez Stripe et corrige la base — filet quand un webhook est manqué).
- **Fix resolver** (`resolvePlanForSubscription`) : le **prix courant fait foi** (mensuel ET
  annuel), la metadata n'est plus qu'un filet — sans quoi un changement de forfait restait
  **invisible dans l'app** (metadata figée à la création, tarif annuel non reconnu).
- La synchro locale (forfait + crédits, y compris différentiel d'upgrade) est faite par le
  webhook `customer.subscription.updated` / `invoice.paid` **déjà branché** (aucun nouvel
  événement à ajouter).
- Fichiers : `src/lib/billing.ts` (`changeSubscriptionPlan`, `resyncSubscription`),
  `src/app/credits/{actions,page}.tsx`, `src/app/admin/facturation/{actions,page}.tsx`.

## 47. Démo jouable — vraie mini-scène IA sur l'accueil, sans compte (31 juillet)
**État : ✅ Fait, testé en local (Mistral)** — commit `2c6cbfe` — ⚠️ micro-débrief à valider en prod (clé Anthropic)
- Remplace la démo statique (QCM) par une **mini-scène N2 jouable sans compte** : le visiteur
  choisit un **cas réel** (Anamnèse `ANA-PREM-01`, Ménopause `MEN-PERI-01`, ACT `ACT-ANX-01`),
  dialogue en **texte libre (4 tours)**, le patient **réagit à sa posture**, puis **micro-débrief
  immédiat et gratuit** (LLM) + CTA création de compte (séance complète offerte).
- **Sans état serveur** : le navigateur porte le fil, le serveur ne fait qu'appeler le LLM.
  **Aucune** `SimSession`/`Attempt`, **aucune donnée personnelle** stockée.
- **Garde-fous coût** (adossés à `RateLimitHit`, **aucune table dédiée**) : budget quotidien
  réglable (**défaut 250**), **5 démos/IP/jour**, contrôle de rafale. Au dépassement / IA
  indisponible / interrupteur off → **repli silencieux** sur la démo statique (`DemoDrill`,
  qui **reste dans le code**). **Panneau admin** dans `/admin/modeles` (compteur, % budget,
  coût estimé ~0,25 c/démo, alerte de seuil, réglages).
- **Sécurité** : entrée non fiable bornée/assainie, prompt patient **durci anti-injection**.
  Analytics via `funnel_events` (`demo_started` / `demo_turn_played` / `demo_finished`).
- Fichiers : `src/lib/demo-sim.ts`, `src/app/api/demo/turn/route.ts`,
  `src/app/_components/demo-live.tsx`, branchements `src/app/page.tsx` + `/admin/modeles`.

## 48. Recalibrage bêta 30 jours + forfait Praticien + correctif rétrogradation (1er-4 août)
**État : ✅ Fait (code + migration en prod)** — commit `b8b90ce` — ⚠️ validation Test Clock + tests DB à la main du porteur
- **La bêta passe de 90 à 30 jours et le forfait offert devient « Praticien »** (quota 3
  spécialités, 60 crédits/mois), au lieu d'« Intensif » (sans compter). Toute la séquence de
  relances est recalée : mi-parcours **J+15** (était J+45), bilan **J+21** (inchangé), fin
  d'essai **J+27**.
- **Source de configuration unique** (7 valeurs, plus rien en dur) : registre pur
  `BETA_CONFIG` (clés + défauts) dans `src/lib/beta-constants.ts`, getters *server-only*
  `betaConfig.*()` dans `src/lib/beta-config.ts` (via `getConfig`/`app_config`, **même
  système que les autres réglages admin**), et le script d'invitations lit `app_config`
  directement. Défauts = cibles : `praticien`, 30 j, mi-parcours 15, bilan 21, nudge 48 h,
  3 sims, J+7.
- **Une seule allocation de crédits pendant l'essai** : `syncSubscriptionCredits` force
  `periodIndex = 0` tant que le statut est `trialing` (garde commentée). Sans ça, un essai de
  30 jours qui chevauche une bascule de mois calendaire (février, mois de 30 j) déclenchait
  une 2ᵉ allocation. **`periodIndexFor` et le parcours payant sont inchangés** (seule la
  branche `trialing` est bornée).
- **Correctif de l'invariant de sortie n°3** (bug préexistant découvert en écrivant les
  tests, signalé au porteur avant correction) : la branche `isPublic` de
  `userFrameworkAccess` honorait **toutes** les lignes `subscription_choice` dès que le quota
  n'était pas nul — un ex-testeur rétrogradé aurait gardé **toutes** ses spécialités. Corrigé :
  on n'honore plus que **`quota` spécialités**, classées par **activité la plus récente**,
  **sans supprimer de ligne**. S'applique aussi aux **résiliations payantes**.
- **Échange unique post-rétrogradation** (demande porteur) : un compte Découverte
  over-quota peut **changer une fois** sa spécialité active, **uniquement parmi ses choix
  antérieurs**, par épinglage (`UserFrameworkAccess.pinnedAt`). UX sur le paywall `/f/[id]`
  (« Réactiver cette spécialité » / « déjà changé »). Les épinglages sont **effacés au
  réabonnement** → l'échange redevient disponible après une future rétrogradation.
- **Anti-collision des emails bêta** : un seul email bêta par jour et par destinataire
  (`User.lastBetaEmailAt` + `claimBetaEmailDay` atomique). Les 4 crons **reportent au
  lendemain** (compteur `deferred`) au lieu de superposer deux envois le même jour.
- **Emails réécrits** : formulation « le forfait Praticien offert pendant 4 semaines, sans
  carte bancaire » ; « essai gratuit » banni (landing, kit d'affiliation) ; mi-parcours
  « deux semaines » ; admin bêta généralisé (plus de « 90 jours »).
- **Migration** `20260801080522_beta_recalibrage_last_email_et_pin_specialite` (2 `ADD
  COLUMN` additifs : `last_beta_email_at`, `pinned_at`) — **première vraie migration après le
  baseline réconcilié**, déployée en prod (SQL montré et validé avant).
- **Livrables de test** : `suivi/beta-recalibrage-scenarios.csv` (2 passes Test Clock
  septembre/février, 5 invariants de sortie, échange unique, mur de crédits, rejeu webhook,
  anti-collision) ; script `scripts/beta-test-clock.ts` recalé sur 30 j / 2 ancres.
- Fichiers : `src/lib/{beta-constants,beta-config,beta-email-gate,beta,credits,entitlements,
  billing}.ts`, `src/app/api/cron/beta-{nudge,feedback,mid-trial,bilan}/route.ts`,
  `src/app/credits/actions.ts`, `src/app/f/[framework_id]/paywall.tsx`,
  `src/app/beta/[code]/page.tsx`, `src/app/admin/beta/{actions,page}.tsx`, `src/lib/email.ts`,
  `scripts/{generate-beta-invites,beta-test-clock}.ts`, `prisma/schema.prisma` + migration.
- ⚠️ Reste (porteur) : lancer les 2 passes Test Clock + tests vitest DB (clé `sk_test_` +
  `TEST_DATABASE_URL`, cf. CSV) ; **changement de comportement live** : un abonné payant qui
  résilie ne conserve désormais qu'**1 spécialité** (activité récente) au lieu de toutes.
