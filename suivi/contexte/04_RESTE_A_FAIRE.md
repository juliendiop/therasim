# 📋 RESTE À FAIRE — Backlog

Ordre indicatif. Le détail fonctionnel est dans la spec
(`Conception/spec-v2-entrainement-progression (1).md`).

## 🔜 Immédiat (pour rendre l'app vivante)

### Brancher la base de données (porteur de projet)
- Créer une base **Neon**, renseigner `DATABASE_URL` dans `.env`, puis
  `npm run db:push` + `npm run db:seed`. Détaillé dans `00_DEMARRAGE.md`.
- **Sans ça, l'app compile mais ne tourne pas** (aucune donnée).

### Tester le mode production (Mistral)
- Mettre une `MISTRAL_API_KEY` dans `.env` et jouer un drill `production`
  (ex. DRL-REFLET-02). Vérifier la note, la citation, le feedback.
- **Calibrer l'évaluateur EM** sur un échantillon coté par un superviseur (spec §6) —
  prérequis avant tout usage « sérieux » du référentiel.

## Phase 1 — compléter le N1 (entraînement)

### Auth réelle par lien magique (spec §3)
- `POST /api/auth/magic-link` + `GET /api/auth/callback`, table `users` déjà prête.
- Envoi email (Resend, comme theraflow). Consentement RGPD à l'inscription, suppression compte.
- Remplacer l'utilisateur de dev unique (`src/lib/user.ts`) par la session réelle.

### Compléter le contenu EM (spec §4.5)
- Atteindre **2 drills/compétence** (1 reconnaissance + 1 production) pour les 7 compétences
  qui n'ont encore qu'un drill de reconnaissance.

### Affiner le routage
- Câbler `pertinence_scenario` (w4) quand on travaille un cas précis.
- Recommander la bascule N1→N2 quand les briques clés atteignent un palier (≥0.60) —
  **recommandation, pas verrou** (spec §5.4 / §7).

## ⭐ Phase Plateforme & Admin (marque blanche) — demande porteur (10 juin)

Transformer TheraSim en **plateforme SaaS multi-tenant en marque blanche**, pilotée
depuis une **console d'administration centrale**. Hors spec initiale.

> **Avancement (session 2)** : ✅ **Fondation posée** — multi-tenant + auth/rôles +
> catalogue/packs/entitlements + console super-admin (sections C & D ci-dessous largement
> faites). Reste : config LLM (A), génération de cartes (B), espace admin tenant, email réel,
> application du branding.

### A. Console d'admin — configuration des modèles LLM par usage — ✅ FAIT (session 2)
- ✅ Table `app_config` (clé/valeur) + `src/lib/config.ts` (`getModel(usage)`).
- ✅ Page `/admin/modeles` : choix du modèle pour `patient`, `evaluateur`, `generation`
  (défaut = `MISTRAL_MODEL` du `.env`). Tous les appels LLM lisent le modèle de leur usage.
- ⚠️ Reste (option) : choix du **fournisseur** (pas seulement le modèle), config **par tenant**.

### B. Admin de contenu — créer / générer des cartes — ✅ LARGEMENT FAIT (session 2)
- ✅ CRUD **référentiels / catégories / compétences / cartes** dans `/admin/referentiels`.
- ✅ **Génération IA** d'un brouillon de carte (Mistral) pré-remplissant l'éditeur.
- ✅ Workflow `brouillon → calibre → publie` piloté depuis l'écran détail.
- ⚠️ Reste : **ré-éditer une carte existante** (aujourd'hui : créer + supprimer), **gérer les
  cas (scenarios)** dans l'UI, génération en lot (plusieurs cartes d'un coup).

### C. Multi-tenant + marque blanche (B2B) + site ouvert (B2C)
- Nouvel axe `tenant` : `tenants`, `tenant_id` sur users/attempts/user_competency_state…
- **Deux natures de tenant** :
  - **Tenant marque blanche (B2B)** : une plateforme cliente brandée (institut, école, réseau).
    Pilotée centralement par toi ET disposant de son **propre espace de setup / paramétrage /
    supervision** (l'admin du client gère ses apprenants, voit ses stats, sa config).
  - **Tenant public (B2C)** : le **site ouvert TheraSim**, où des **clients individuels**
    s'inscrivent en self-service. C'est un tenant « par défaut » non brandé.
- **Branding par tenant B2B** : logo, couleurs, nom, sous-domaine/domaine. Thématisation de l'UI.
- **Console super-admin centrale** (toi) : créer/suspendre des tenants, affecter référentiels +
  plan, **superviser l'usage** de chaque plateforme cliente, piloter la config LLM (globale ou
  par tenant). Vue d'ensemble multi-clients.
- **Espace admin tenant** (ton client B2B) : setup de sa plateforme, gestion de ses apprenants,
  supervision de la progression de ses cohortes, sa propre config (dans les limites que tu fixes).
- **Rôles** : super-admin (plateforme) · admin tenant · (option) superviseur/formateur · apprenant.
  S'appuie sur l'**auth réelle + rôles** (prérequis, à faire).

### D. Catalogue central + packs + entitlements (DÉCIDÉ — 10 juin)
- **Catalogue central** détenu par le super-admin (les référentiels validés). Pas de
  référentiel privé par client au départ.
- **Packs** : regroupements de référentiels composés par le super-admin (ex. pack
  « Addictologie » = EM + Burnout). Tables `packs`, `pack_frameworks`.
- **Attribution à un tenant** = droits d'accès calculés :
  `accès = (référentiels des packs accordés) + (ajouts manuels) − (retraits manuels)`.
  → attribution « en masse » par pack, **ajustable au cas par cas** (utile en négociation).
  Tables `tenant_packs` (packs accordés) + `tenant_framework_overrides` (ajout/retrait fin).
- Le moteur de progression ne montre à un tenant que les référentiels de son accès effectif.
- Pattern proche du registre « plans × fonctionnalités » de theraflow (entitlements).

### Questions ouvertes restantes
1. ~~Référentiels partagés vs privés~~ → **tranché** : catalogue central + packs (section D).
2. **Génération de cartes** : réservée à toi (super-admin), ou déléguée aussi aux admins clients ?
3. **Branding** : logo + couleurs au départ, ou sous-domaine/domaine dédié par client ?
4. **B2B vs B2C** : lequel arrive en premier commercialement (priorise l'UI à construire) ?
5. **Prérequis** : cette phase suppose l'**auth réelle + rôles** (actuellement utilisateur de
   dev unique). À faire avant, ou en même temps.

---

## ⭐ Phase Formateur — Sessions live (études de cas animées) — ✅ V1 FAITE (11 juin)

Demande porteur : pendant une formation, faire passer une **étude de cas** en direct à un groupe.
- **Étude de cas** = enchaînement de questions « cas réel » à choix multiples, **comparées par
  compétence**. (Pas strictement QCM à terme, mais QCM en v1.)
- Le formateur crée une session (référentiel + compétences testées + mode + durée), obtient un
  **lien à partager** (Zoom/email). Participants **anonymes** (prénom/nom, sans compte).
- **2 modes** : apprentissage (feedback/question) · évaluation (feedback final).
- **Compte à rebours** synchronisé (le formateur « Démarre » → `closesAt`).
- **Tableau de bord formateur** live : synthèse collective par compétence (barres projetables)
  + résultats individuels. Modèle : `LiveSession`/`LiveParticipant`/`LiveAnswer`. Rôles
  super_admin + tenant_admin (« formateur »).
- ✅ (2 juillet) **Export CSV** des résultats individuels (`/api/live/[id]/export`, bouton sur le
  tableau de bord).
- ⚠️ Reste : **étude de cas = un scénario cohérent** (au lieu d'exercices indépendants enchaînés) ;
  questions **non-QCM** (réponse libre évaluée) ; export **PDF** ; relance/2e passage.

## ⭐ Espace supervision formateur — ✅ V1 FAITE (2 juillet)

Demande porteur (analyse du 2 juillet, priorité #1 des chantiers restants — cohérent avec le
formulaire de demande de devis ajouté côté landing).
- **`/supervision`** : liste des apprenants du tenant (email, depuis quand, dernière activité,
  nb d'exercices, nb de mises en situation), recherche par email.
- **`/supervision/[id]`** : progression de l'apprenant **par référentiel** (règle d'or — jamais
  de moyenne entre référentiels), historique de ses mises en situation, fil de **notes** du
  formateur (visibles par l'équipe de la plateforme).
- **`/supervision/[id]/sim/[simId]`** : relecture **en lecture seule** d'un entretien précis
  (transcript complet + débrief), avec possibilité de laisser une note rattachée à cet entretien.
- Accès : `super_admin`, `tenant_admin`, `formateur` (`canSupervise()` dans `roles.ts`). Toute
  lecture est vérifiée cross-tenant (`getLearnerInTenant`) — un formateur ne voit jamais un
  apprenant d'une autre plateforme.
- Fichiers : `src/lib/supervision.ts`, `src/app/supervision/**`, modèle `SupervisorNote`
  (`prisma/schema.prisma`).
- ⚠️ **Reste** : assignations (« faites cet exercice d'ici vendredi »), attestation de pratique,
  export PDF/CSV du suivi individuel (aujourd'hui : CSV sessions live uniquement).
- ✅ `npm run db:push` fait (2 juillet, contre Neon prod) — table `supervisor_notes` créée,
  fonctionnalité pleinement opérationnelle.

## ⭐ Prochaine étape — PDF → session de formation (demande 11 juin)
- Importer le **PDF d'un support / programme** de formation et le transformer en **une session**
  (étude de cas) dans l'app : extraction du contenu → mapping vers compétences/référentiels →
  **génération des questions par IA** (réutilise `generate.ts`), à relire/valider.
- Briques : parsing PDF (texte), prompt de structuration (thèmes → compétences → questions),
  pré-remplissage d'une session. Garde-fou : validation humaine avant ouverture.

## Phase 2 — N2 : mini-scènes guidées — ✅ FAIT (session 2)
- ✅ Mini-scène **dynamique** : cible les 2 compétences prioritaires, 4 tours, indices à la
  demande, débrief ciblé → carte. Réutilise le moteur patient du N3 borné.
- ⚠️ Reste (option) : mini-scènes **authoring** (scénarios + paires de compétences pré-définis)
  en plus du dynamique ; déclenchement d'indices automatiques aux moments clés.

## Phase 3 — N3 : simulation complète — ✅ FAIT (session 2)
- ✅ Patient LLM réactif + évaluateur multi-compétences, entretien libre, débrief sommatif complet.
- ✅ La fin de simulation écrit des `Attempt` (source='simulation') → **unifié avec les drills
  dans la même carte**.
- ✅ Spec MVP manquante → **cadrée avec le porteur** (voir journal session 2).
- ✅ (2 juillet) Reprise d'une session en cours + **historique des simulations** (`/historique`),
  réponse du patient **streamée** ; tableau de bord d'accueil `/accueil`.
- ⚠️ Reste : **calibration de l'évaluateur** (spec §6) avant usage sérieux ; éventuel objectif
  pédagogique par cas ; **réparer `npm run lint`** (config ESLint cassée, préexistant).

## Phase 4 — nouveaux référentiels (le moat, spec §2.6)
- Ajouter ACT, anamnèse, burnout… = **écrire du contenu** (grille + cas + drills +
  calibration évaluateur), **aucune modif de code** (critère d'acceptation spec §9).
- Chaque référentiel = sa **validation clinique** + sa **calibration d'évaluateur**.

## Transverse / qualité
- **Tests automatisés** du moteur (mastery, routing) — voir `../PLAN_DE_TEST.md`.
- **Déploiement Vercel** (lier le repo, variables d'env, `/api/health`).
- **Multi-utilisateur** : aujourd'hui l'app suppose un seul utilisateur de dev.
- **RGPD** : page de consentement, export/suppression des données.
- **Visualisations** : possible radar/jauges en plus des barres (cf. maquette).

## ⚠️ Garde-fous à ne pas oublier (spec §7)
- Cas **réalistes mais fictifs** (jamais de patient réel ; RGPD / secret pro).
- **Reconnaissance avant production** pour les débutants (déjà câblé dans le routage).
- Ne pas glisser vers une **appli de quiz** : garder la simulation ouverte (N3) comme aboutissement.
- **Formatif, non certifiant** : pas de notation officielle sans validation juridique (AI Act).
