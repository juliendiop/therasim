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
