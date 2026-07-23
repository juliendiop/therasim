# 📋 RESTE À FAIRE — Backlog

Ordre indicatif. Le détail fonctionnel est dans la spec
(`Conception/spec-v2-entrainement-progression (1).md`).

## ⭐ Migrations Prisma (baseline) — ✅ FAIT (23 juillet)

La production ne passe plus par `db:push` mais par des **migrations relues et
historisées**. Baseline dans `prisma/migrations/0_init/` (38 tables), flux et pièges
documentés dans `03_DECISIONS.md` et `00_DEMARRAGE.md`.
- ⚠️ **`db:push` ne doit plus viser la production.**
- Le `build` applique les migrations en attente (`prisma migrate deploy`).

## 🔴 Suppression de compte incomplète — À TRAITER

`removeMember` (`src/app/gestion/actions.ts`) supprime un utilisateur **sans nettoyer
les tables liées** : le schéma ne déclare aucune relation, donc aucune cascade. Restent
orphelins : `credit_ledger`, `user_subscriptions`, `attempts`, `user_competency_state`,
`sim_sessions`/`sim_messages`, `user_framework_access`, `commission_ledger`,
`funnel_events`, `audit_events`…
- Seuls les **tickets de support** sont supprimés explicitement (exigence de la spec support).
- Enjeu RGPD (droit à l'effacement) et hygiène de données. À traiter avant d'avoir
  beaucoup de comptes réels.

## ⭐ Programme d'affiliation « Ambassadeurs » — ✅ V1 FAITE (22 juillet)

Demande porteur : parrainage avec commission récurrente à vie (2 niveaux), espace ambassadeur,
demande de paiement (facture email), volet écoles B2B, kit de diffusion prêt à l'emploi.
Spec complète écrite d'abord (`Conception/spec-affiliation-ambassadeurs.md`), puis codée
intégralement par Claude (le kit texte+visuels et le contenu des pages avaient déjà été
générés par Claude au tour précédent, à la demande explicite du porteur — pas par un modèle
moins coûteux comme prévu initialement).
- ✅ Schéma (`CommissionLedger`/`PayoutRequest` + champs `User`), logique métier
  `src/lib/affiliation.ts`, attribution `/r/[code]`, commission Stripe (`handleInvoicePaid`),
  clawback `handleChargeRefunded`, espace `/affiliation`, page publique `/ambassadeurs`, admin
  `/admin/affiliation`, champ « recommandé par » sur `/demande-demo`, navigation
  (header/footer/mobile-nav/AdminLink). Détail complet dans `02_MODULES_FAITS.md` §36 et
  `05_JOURNAL.md` (session du 22 juillet).
- ✅ `npm run db:push` fait (22 juillet, contre Neon prod, `--accept-data-loss` — sans risque
  réel : nouvelle colonne `referral_code`, donc toutes les lignes existantes valent `NULL`,
  et Postgres n'impose jamais l'unicité entre `NULL`) — tables `commission_ledger`/
  `payout_requests` + nouveaux champs `User` créés.
- ✅ Événement `charge.refunded` ajouté par le porteur à l'endpoint webhook Stripe (22 juillet)
  — le clawback automatique de commission sur remboursement est opérationnel.
- ✅ Commit + push sur `main` (22 juillet, `28efc8a`) — déploiement Vercel automatique.
- **Reste (v1 considérée complète)** : test manuel bout en bout en conditions réelles
  (activation ambassadeur, parrainage via `/r/CODE`, commission générée par un paiement test,
  demande de paiement → marquer payé en admin) — non fait faute d'accès navigateur/Stripe
  dans cette session.
- ⚠️ **Dérive d'API Stripe documentée** (comme les précédentes) : `Charge.invoice` et
  `Invoice.payment_intent` n'existent plus dans les types de `stripe@22.3.0`. Le clawback
  utilise un repli défensif ; si l'invoice reste introuvable, un avertissement explicite est
  loggé (`console.warn`) plutôt que d'échouer silencieusement.
- ⚠️ Non testé de bout en bout en conditions réelles (pas de base de données locale avec les
  nouvelles tables tant que `db:push` n'est pas fait) — build et types vérifiés uniquement.
- Hors scope v1 (comme prévu par la spec) : QR code du lien de parrainage, modèle
  `DemoRequest` en base (l'email suffit), profondeur de parrainage configurable (interdit
  légalement au-delà de 2 niveaux).

## ⭐ Growth — mesure de l'entonnoir + conseiller d'optimisation IA — ✅ V1 FAITE (22 juillet)

Demande porteur : « automatiser l'acquisition », growth basé sur des mesures concrètes.
**A/B testing autonome écarté** (à froid, honnêtement) : sans trafic → aucune signification
statistique ; une boucle « qui optimise seule » optimiserait vers du bruit. On a construit
le socle utile dès maintenant.
- ✅ **Mesure d'entonnoir first-party, sans PII** (`FunnelEvent`, cookie `ts_vid` anonyme) :
  landing_view / demo_start / signup_start (beacon client `/api/track`, whitelist anti-triche)
  + signup_complete / activation / checkout_start / purchase (écrits **côté serveur** aux
  points de conversion déjà existants). `src/lib/funnel.ts`, dashboard `/admin/funnel`
  (compteurs, taux étape→étape, décrochages en rouge, bannière honnête « volume faible »).
- ✅ **Section « Optimisation » (`/admin/optimisation`)** : le porteur clique « Lancer
  l'analyse » → l'IA (via `llmChat("generation")`) lit les mesures d'entonnoir et rend 3-5
  optimisations priorisées (constat / hypothèse / proposition / impact / effort), **chacune
  avec un prompt prêt à copier-coller** dans l'IA de dev de son choix. L'IA PROPOSE, le
  porteur VALIDE et déclenche — rien d'autonome. Dernière analyse stockée en `AppConfig`
  (`growth.last_analysis`), pas de nouvelle table. `src/lib/growth-advisor.ts`.
- ✅ `npm run db:push` fait (22 juillet, table `funnel_events` créée sur Neon prod). Mesure
  d'entonnoir pleinement opérationnelle. L'analyse IA nécessite une clé LLM configurée dans
  `/admin/modeles` (déjà le cas si le simulateur marche). À mentionner dans la future
  politique de confidentialité (mesure d'audience exemptée de consentement au sens CNIL car
  minimale et sans PII, mais à documenter).
- ⏭️ **Étape suivante (non faite, séparée)** : A/B testing réel (affectation stable +
  variantes) — se branchera SUR cette mesure une fois du trafic présent (viser ≥ ~100
  visites/variante avant de conclure). Alternative « buy » possible : PostHog (sessions,
  heatmaps) — écartée pour l'instant, à reconsidérer si besoin d'aller vite.

## ⭐ Visibilité des crédits + écran dédié "plus de crédits" — ✅ FAITE et validée (3 juillet)

Demande porteur : audit du parcours d'essai (crédits de bienvenue, comportement à sec,
impasses) puis 4 chantiers. Audit : aucune impasse dure (drills gratuits illimités, coût
débité une seule fois au lancement, jamais en cours de conversation) ; le nombre de
crédits de bienvenue était **déjà éditable** sans redéploiement depuis `/admin/credits`
(rien à construire sur ce point) ; le badge crédits du header **existait déjà**.
- ✅ Tooltip du badge crédits enrichi (détail du coût par activité).
- ✅ Bandeau discret bas-solde (≤20% du pack de bienvenue), dismissible 1×/session.
- ✅ Écran dédié `/credits?need=...` : récap de progression (compétences travaillées +
  palier), 2 CTA directs (pack le plus petit + forfait Praticien si éligible), lien de
  retour vers le référentiel visé.
- ✅ Validé en conditions réelles sur `meleta.app` (les deux cas `need=miniscene`/
  `need=simulation`, tooltip via arbre d'accessibilité).
- Recommandation : garder les crédits de bienvenue à 10 (déjà largement au-dessus du
  critère minimal « 3 drills + 1 mini-scène », les drills étant gratuits).

## ⭐ Page /tarifs + report du forfait choisi — ✅ FAITE et validée (3 juillet)

Demande porteur : page de tarifs publique pour convertir des visiteurs sans compte.
- ✅ `/tarifs` (forfaits, packs, écoles, FAQ+JSON-LD), report du plan choisi jusqu'au
  premier checkout (inscription mot de passe ET lien magique), liens Tarifs header+footer.
  Réutilise entièrement le système de paiement déjà construit (aucune nouvelle route).
- ✅ Validé en conditions réelles sur `meleta.app` (navigation, routing, déclenchement du
  checkout avec le bon forfait).
- ⚠️ **Stripe est passé en mode LIVE en production** (détecté lors du test : URL
  `cs_live_...`). La validation d'un paiement réel complet reste à faire par le porteur
  lui-même (a dit vouloir tester par ses propres moyens).
- 🔴 **Nettoyage optionnel** : deux comptes de test jetables en base sans abonnement actif
  (`julien.diop+mobtest...`, `julien.diop+tarifs...@gmail.com`) — à supprimer si souhaité.
  Dossiers `TESTS/`/`TESTS2/` (captures de bugs responsive) présents dans le dépôt — à
  retirer si le porteur préfère ne pas les garder versionnés.

## ⭐ Paiements Stripe — ✅ V1 FAITE côté code (2 juillet), setup manuel requis

Demande porteur : rendre réel le paiement des packs de crédits (déjà dans l'UI) + ajouter
des forfaits d'abonnement récurrents (« les deux », confirmé).
- ✅ Checkout Stripe hébergé (packs = paiement unique, forfaits = abonnement mensuel),
  webhook avec vérification de signature + idempotence, portail Stripe pour la résiliation,
  `/admin/facturation` pour configurer les Price ID et créer/activer des forfaits.
- ✅ `npm run db:push` fait (2 juillet, contre Neon prod) — tables `SubscriptionPlan`,
  `UserSubscription`, `StripeEvent` + champ `User.stripeCustomerId` créés.
- 🔴 **Reste à faire côté porteur** (détail pas-à-pas dans `00_DEMARRAGE.md` § Activer les
  paiements) : compte Stripe + clé API, création des Prices dans le Dashboard, Price ID
  collés dans `/admin/facturation` (+ y créer les forfaits d'abonnement souhaités),
  enregistrement du webhook + son secret, activation du Customer Portal. **Non testé de
  bout en bout** (je n'ai pas de compte Stripe) — la validation finale (paiement carte
  test → crédits accordés → gestion abonnement) revient au porteur.
- ⚠️ Reste (option, hors scope V1) : édition en place d'un forfait (aujourd'hui : créer +
  activer/désactiver), Stripe Tax (TVA automatique), forfait « accès illimité » sans
  décompte de crédits, facture téléchargeable dans l'app (Stripe envoie déjà un reçu email).

## ⭐ Freemium — contenu lié aux paiements — ✅ V1 FAITE (2 juillet)

Demande porteur : lier achats/abonnements aux référentiels + utiliser les compétences comme
incitatif. Modèle décidé (ajusté après retour porteur) : gratuits configurables (défaut EM)
· chaque forfait = **quota de N domaines au choix de l'abonné** (vide = tout ; choix
définitifs tant qu'abonné, déblocage en cliquant un domaine verrouillé) · achat à l'unité
possible avec ou sans abonnement · vente par référentiel (pas par compétence — contrainte
moteur) · B2B non touché.
- ✅ Accès par utilisateur (`userCanAccess`), gardes sur tous les parcours apprenant,
  paywall `/f/[id]` (avec bouton « Débloquer avec mon abonnement — X choix restants »),
  catalogue avec tuiles verrouillées, « À découvrir » sur l'accueil, admin facturation
  étendu (quota/forfait, prix à l'unité, gratuits).
- 🔴 **Action requise du porteur** : `npm run db:push` ; dans `/admin/facturation` :
  cocher les gratuits, renseigner le **quota** de chaque forfait (ex. Essentiel 1,
  Praticien 3, Intensif vide=tout), créer un Price **one-time** Stripe par référentiel
  vendu à l'unité et coller prix + Price ID. Tester : compte apprenant → catalogue →
  domaine verrouillé → paywall → déblocage par choix d'abonnement ET par achat test.
- ⚠️ Reste (option) : octroi manuel d'un référentiel à un utilisateur par l'admin (la table
  `UserFrameworkAccess` le prévoit, `source='admin'`, pas encore d'UI) ; prorata/upgrade
  de forfait ; email de confirmation d'achat maison (Stripe envoie déjà un reçu).

## ⭐ Onboarding / inscription B2C — ✅ V1 FAITE (2 juillet)

Demande porteur (promo à sa communauté de thérapeutes). Avant : « Créer un compte » →
`/login` (form connexion mot de passe, inutilisable pour un nouveau venu).
- ✅ Page `/inscription` (prénom optionnel, email, mot de passe, consentement RGPD) + API
  `/api/auth/register` (accès immédiat, tenant public, learner) ; magic link en alternative ;
  accueil de bienvenue personnalisé (`?bienvenue=1`) avec CTA direct vers le 1er domaine ;
  liens croisés `/login` ↔ `/inscription` ; tous les CTA landing/démo repointés.
- ✅ `npm run db:push` fait (2 juillet). Inscription B2C opérationnelle.
- ⚠️ Reste (option) : **page politique de confidentialité** dédiée (RGPD — le consentement
  pointe vers un texte inline) ; **double opt-in** (vérification d'email) ; RGPD complet
  (export/suppression de compte, déjà au backlog transverse ci-dessous).

## ⭐ Blog / SEO — ✅ FAITE et validée (3 juillet)

Objectif : optimiser le référencement de l'app via un blog éditorial. Contenu MDX
**versionné dans le repo** (pas de CMS, pas de base de données). Flux de publication
**ajusté après retour porteur** (« je ne sais pas ouvrir de PR, je veux le faire par
simple prompt ») : pas de Pull Request — Claude rédige l'article, le porteur le relit
directement dans la conversation, dit « publie-le », et Claude committe + pousse
directement sur `main` (même pattern que tout le reste de cette session). Déploiement
Vercel automatique sur push.
- ✅ `content/blog/*.mdx`, frontmatter validé par zod (title/description 150-160
  caractères/slug/date/updated/keywords/audience/draft/cover) — invalide → `npm run
  build` échoue avec un message clair citant le fichier et les champs en cause (testé).
- ✅ `/blog` (liste paginée 10/page, filtre par audience), `/blog/[slug]` (table des
  matières auto h2/h3, temps de lecture, composants MDX `Verbatim`/`PointCle`/`FAQ`+
  `FaqItem` [JSON-LD FAQPage] + JSON-LD BlogPosting, CTA de fin selon audience), `/blog/
  rss.xml` (RSS 2.0). Drafts jamais listés/indexés (`generateStaticParams` les exclut,
  `robots: noindex` posé), mais accessibles par URL directe (`dynamicParams` par défaut).
- ✅ Lien **Blog** dans le footer uniquement (site public), pas le header.
- ✅ Un article d'exemple complet (`entretien-motivationnel-accueillir-ambivalence.mdx`)
  utilisant les 3 composants custom + un tableau GFM — sert de gabarit pour l'agent
  rédacteur.
- ⚠️ **Piège important découvert et corrigé** : `next-mdx-remote` (compilation MDX au
  runtime) est incompatible avec Turbopack sans `transpilePackages: ["next-mdx-remote"]`
  dans `next.config.ts` (documenté dans le README du package) — sans ce flag, la page
  article ne rend RIEN côté serveur. **Deuxième piège, plus subtil** : le composant `FAQ`
  a d'abord été conçu avec un prop `items={[{q,a}, ...]}` (tableau d'objets) — ce motif
  échoue **silencieusement** avec next-mdx-remote (le prop arrive `undefined` à
  l'exécution, l'évaluation runtime des props MDX ne gérant pas les littéraux
  objet/tableau complexes) ; Next affiche alors une page d'erreur générique sans le dire
  clairement. Corrigé en passant à des **enfants imbriqués** (`<FAQ><FaqItem q="...">
  réponse</FaqItem></FAQ>`), motif MDX natif qui fonctionne de façon fiable. À retenir
  pour toute future extension du blog : préférer toujours les enfants JSX aux props
  objet/tableau complexes dans du contenu MDX compilé au runtime.
- ⚠️ **Constat architectural (pas un bug introduit ici)** : `/blog` et `/blog/[slug]`
  sont classés « dynamique » (ƒ) par Next au lieu de « statique » (○), MAIS **c'est déjà
  le cas de TOUTE l'application existante, y compris la landing page `/`** — le layout
  racine (`src/app/layout.tsx`) lit la session (cookie) à chaque requête pour tout le
  site, et sans Cache Components/PPR (flag global, volontairement non activé — changerait
  le modèle de rendu de toute l'app), Next ne peut pas rendre un enfant statique sous un
  layout dynamique. `revalidate = 3600` reste posé (pas de `force-dynamic`) : Vercel met
  quand même en cache chaque URL jusqu'à 1h et revalide en tâche de fond — proche d'un SSG
  en pratique pour la performance perçue, même si la classification interne de Next diffère.
  Un vrai SSG au sens strict nécessiterait soit d'activer Cache Components (migration
  globale, à traiter séparément), soit de sortir la lecture de session du layout racine —
  hors périmètre de ce chantier.
- Hors scope (comme prévu) : sitemap.xml dédié, éditeur admin (flux = commit direct par
  Claude sur demande en chat),
  commentaires, recherche full-text.

## ✅ Responsive mobile — passe de fond faite (3 juillet)

Signalement porteur : « effet zoom à recadrer », champs qui débordent sur mobile.
- Cause principale de l'« effet zoom » = **débordement horizontal** (un élément plus large
  que l'écran force le navigateur mobile à dézoomer). Corrigé de façon défensive :
  **viewport explicite** (`export const viewport`, échelle 1:1), **filet `overflow-x: clip`**
  sur `html,body` (ne casse pas le header sticky, contrairement à `hidden`), **`img/video
  max-width:100%`**, **tables passées de `overflow-hidden` à `overflow-x-auto`** (scroll au
  lieu de couper) sur credits/gestion/supervision/admin/sessions.
- ⚠️ Si des **champs précis** débordent encore, à cibler au cas par cas (indiquer la page).
  Le header d'un **super-admin/formateur** sur mobile peut être dense (liens Gestion/
  Sessions/Admin non masqués) — à rendre plus compact si gênant (l'apprenant B2C, cible
  principale, a un header léger : logo + crédits + déconnexion).

## 🔜 Immédiat (pour rendre l'app vivante)

### Brancher la base de données (porteur de projet)
- Créer une base **Neon**, renseigner `DATABASE_URL` dans `.env`, puis
  `npm run db:push` + `npm run db:seed`. Détaillé dans `00_DEMARRAGE.md`.
- **Sans ça, l'app compile mais ne tourne pas** (aucune donnée).

### Tester le mode production (Mistral)
- Mettre une `MISTRAL_API_KEY` dans `.env` et jouer un drill `production`
  (ex. DRL-REFLET-02). Vérifier la note, la citation, le feedback.

### ~~Calibrer l'évaluateur~~ — ✅ V1 FAITE (22 juillet)
- **Évaluateur amélioré** (`src/lib/evaluator-core.ts`) : rubrique 1..5 explicite (2 et 4
  définis par interpolation), raisonnement AVANT la note, exemple travaillé pour ancrer
  l'échelle, `non_evalue` resserré, **température 0** (note reproductible), règle « juste en
  haut » (une réponse au niveau du modèle = 5). Cœur pur séparé de l'appel LLM pour être
  testable hors Next.
- **Harnais de mesure** (`scripts/calibrate-evaluator.ts`, `npm run calibrate`) : rejoue le
  vrai prompt sur un « gold set » (réponses dont le niveau attendu est connu) et sort des
  métriques (MAE, %±1, violations d'ordre, détection non_evalue) + un verdict. Réutilisable à
  chaque changement de prompt/modèle.
- **Baseline mesurée (Mistral, gold set actuel) : MAE 0.28, 94% à ±1, 0 violation d'ordre,
  non_evalue 2/2** → verdict ACCEPTABLE. Le grader est (volontairement) strict sur les réponses
  faibles.
- ⚠️ **Reste (validation clinique)** : le gold set est un premier jet dérivé du contenu ; ses
  niveaux « moyens » (2-4), plus subjectifs, gagneraient à être **cotés/étendus par un
  clinicien** — c'est le fichier `scripts/calibrate-evaluator.ts` qu'on enrichit pour durcir
  la calibration. Idéalement, coter aussi un échantillon de VRAIES réponses d'apprenants une
  fois du trafic présent.

## Phase 1 — compléter le N1 (entraînement)

### Auth réelle par lien magique (spec §3)
- `POST /api/auth/magic-link` + `GET /api/auth/callback`, table `users` déjà prête.
- Envoi email (Resend, comme theraflow). Consentement RGPD à l'inscription, suppression compte.
- Remplacer l'utilisateur de dev unique (`src/lib/user.ts`) par la session réelle.

### ~~Compléter le contenu EM (spec §4.5)~~ — ✅ FAIT (22 juillet)
- EM enrichi : **32 drills**, chaque compétence ≥ 3 cartes avec les deux modes, 3e cas patient
  (Nadia/diabète). ACT et Anamnèse aussi enrichis (12 cartes chacun, 2 cas chacun) le même
  jour — cf. `02_MODULES_FAITS.md` §10 et §16.
- ⚠️ Reste : **relecture clinique** du contenu ajouté + **calibration de l'évaluateur**
  (mode production) avant usage sérieux — inchangé.

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

## ⭐ Auto-évaluation avant débrief + replay annoté — ✅ V1 FAITE (2 juillet)

Chantier 4 de l'analyse du 2 juillet.
- **Auto-évaluation** : avant d'afficher la note IA, l'apprenant estime sa mobilisation de
  chaque compétence évaluée (note 1-5, une par compétence). Étape affichée après la
  confirmation de fin d'entretien/mini-scène, avant l'appel au débrief IA. Skippable
  (« Passer cette étape »). Le débrief affiche ensuite « vous : X/5 · IA : Y/5 » par
  compétence. Stockée à part (`SimSession.selfAssessment`, jamais mêlée au débrief IA).
- **Replay annoté** : les « moments clés » du débrief sont désormais rattachés au message
  du transcript qui leur correspond (correspondance approximative par recouvrement de mots,
  tolère la paraphrase) et **surlignés en contexte** (anneau ocre + commentaire juste en
  dessous), au lieu d'une liste séparée hors contexte. Les moments non retrouvés restent
  listés à part sous « Autres moments clés ». Appliqué à la fois côté apprenant
  (`/sim/[id]`) et côté formateur (`/supervision/[id]/sim/[simId]`).
- Bonus au passage : le nom des compétences dans le débrief était affiché en code brut
  (`reflets` au lieu de « Reflets ») — corrigé partout via résolution code→nom.
- Fichiers : `src/lib/moment-match.ts`, `src/app/sim/[id]/sim-chat.tsx`, `src/app/sim/[id]/page.tsx`,
  `src/app/api/sim/[id]/end/route.ts`, `src/lib/simulator.ts` (`endSimulation` accepte
  `selfAssessment`), `src/app/supervision/[id]/sim/[simId]/page.tsx`.
- ✅ `npm run db:push` fait (2 juillet, contre Neon prod) — champ `SimSession.selfAssessment`
  créé, fonctionnalité pleinement opérationnelle.
- ⚠️ Reste (option) : afficher l'écart self/IA de façon plus visuelle (pas juste du texte) ;
  historiser la progression de la justesse de l'auto-évaluation dans le temps.

## ⭐ Visages des patients + célébration des paliers — ✅ V1 FAITE (2 juillet)

Chantier 5 de l'analyse du 2 juillet.
- **Avatars patients** : monogramme coloré déterministe (nom + couleur dérivés du titre du
  scénario — aucune génération d'image, aucun champ ajouté en base). Affiché dans le chat de
  simulation (en-tête + bulles), l'historique, l'accueil (dernières mises en situation) et
  la supervision formateur (liste + transcript). Fichiers : `src/lib/patient.ts`,
  `src/app/_components/patient-avatar.tsx`.
- **Célébration des paliers** : quand un essai (drill ou compétence d'un débrief de
  simulation) fait franchir un palier **solide** ou **maîtrisé** (pas le premier essai
  non_pratique→faible, trop fréquent pour rester festif), une bannière animée (rebond +
  halo) apparaît avec le nom de la compétence et le palier atteint. Détection centralisée :
  `attempts.ts` (`recordAttempt` renvoie désormais `{state, palierBefore, palierAfter,
  milestone}`), `mastery.ts` (`isMilestone`). Affiché dans `drill-player.tsx` (essai) et
  `sim-chat.tsx` / la page supervision (débrief, un ou plusieurs paliers par entretien).
- ⚠️ Reste (option) : appliquer l'avatar aussi à la démo publique (`demo-drill.tsx`) ; portrait
  illustré (au lieu du monogramme) si budget design plus tard.

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
