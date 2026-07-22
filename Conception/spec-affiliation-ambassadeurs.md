# Spec — Programme d'affiliation « Ambassadeurs MELETA »

> **Destinataire** : modèle/assistant de développement qui implémentera cette
> fonctionnalité. Cette spec est **auto-portante** et ancrée dans le code réel de
> l'application. Suis-la fidèlement ; quand tu as un doute, reste cohérent avec les
> patterns existants cités.
>
> **Stack** : Next.js 16 (App Router, Turbopack) · TypeScript strict · Prisma v7 +
> Neon Postgres (`@prisma/adapter-pg`) · Tailwind CSS v4 · Stripe · déploiement Vercel
> (auto-deploy sur push `main`). Design system : tons papier (`--background`), teal
> (`--accent`), ocre (`--ochre`), police titres Fraunces. Voir `src/app/globals.css`.
>
> **Règle transverse** : MELETA est un outil **formatif, non certifiant**. Ton sobre,
> pas de survente. Toute modification du schéma Prisma nécessite `npm run db:push`
> (à exécuter par le porteur — le signaler clairement en fin d'implémentation).

---

## 0. Objectif & résumé

Permettre à tout utilisateur de devenir **ambassadeur** : parrainer de nouveaux clients
via un lien unique et toucher une **commission récurrente à vie** sur les abonnements
générés. Deux niveaux de parrainage (l'ambassadeur touche aussi sur les ventes des
ambassadeurs qu'il a lui-même recrutés). Volet **écoles/organismes** (B2B) : attribution
manuelle quand une école mentionne le nom de l'ambassadeur. Espace ambassadeur avec suivi
des filleuls et des revenus, demande de paiement de la commission (facture par email,
seuil minimum), et **kit marketing prêt à l'emploi** (textes + visuels).

---

## 1. ⚠️ Cadre légal & conformité — À LIRE ET RESPECTER

Ces contraintes ne sont pas optionnelles : elles conditionnent la légalité du dispositif
en France/UE. Implémente exactement ce qui suit, ne « simplifie » pas.

1. **Deux niveaux MAXIMUM.** On implémente strictement un système à 2 paliers (le
   parrain direct + le parrain du parrain). **N'implémente jamais** de profondeur N
   configurable ni de récursion illimitée : au-delà de 2 niveaux, le dispositif devient
   assimilable à un **système pyramidal** (interdit — art. L.122-6 du Code de la
   consommation). La structure de données doit rendre un 3ᵉ niveau techniquement absent.
2. **Commission sur ventes réelles uniquement.** La commission est calculée sur des
   **paiements d'abonnement effectivement encaissés** via Stripe. Jamais sur le simple
   fait de recruter un ambassadeur, jamais de « frais d'entrée ». Devenir ambassadeur est
   **gratuit**.
3. **Statut des ambassadeurs.** Les ambassadeurs sont des tiers indépendants. Pour être
   payés, ils **émettent une facture** (d'où le flux « facture par email »). L'app doit
   afficher un rappel : *« Pour être payé, vous devez pouvoir émettre une facture (ex.
   micro-entrepreneur). MELETA ne vous emploie pas. »* — à afficher lors de l'activation
   et sur la demande de paiement.
4. **RGPD.** Un ambassadeur ne doit **jamais** voir l'identité complète (email, nom) de
   ses filleuls dans son tableau de bord : afficher un identifiant masqué (ex. `Filleul
   #A3F2`, ou prénom + initiale seulement si le filleul y a consenti). Il voit le
   **statut** (actif/inactif) et la **commission générée**, pas les coordonnées.
   Consentement au programme (CGU affiliation) horodaté. Conserver les données de
   commission le temps légal (facturation : 10 ans).
5. **CGU du programme d'affiliation** : prévoir un document (contenu fourni §9) accepté à
   l'activation, avec `ambassadorTermsAcceptedAt`.
6. **TVA / fiscalité** : l'app ne calcule pas la TVA de l'ambassadeur (c'est sa facture
   qui fait foi). Le solde affiché est un **montant de commission dû** ; préciser « hors
   taxes, selon votre statut » près du solde.

---

## 2. Modèle de commission (paramètres)

Tout est configurable via la table `AppConfig` existante (`getConfig`/`setConfig` dans
`src/lib/config.ts`), avec des valeurs par défaut en dur. **Aucun taux en dur ailleurs
que le défaut.**

| Clé AppConfig                | Défaut         | Sens                                                        |
| ---------------------------- | -------------- | ----------------------------------------------------------- |
| `affiliation.enabled`        | `"true"`       | Active/désactive tout le programme                          |
| `affiliation.rate.tier1`     | `"20"`         | % de commission niveau 1 (parrain direct)                   |
| `affiliation.rate.tier2`     | `"5"`          | % de commission niveau 2 (parrain du parrain)               |
| `affiliation.payout.min`     | `"5000"`       | Seuil min. de paiement, en **centimes** (5000 = 50 €)       |
| `affiliation.cookie.days`    | `"90"`         | Durée de vie de l'attribution (cookie `ts_ref`)             |

- **Base de calcul** : la commission = `taux% × invoice.amount_paid` (montant encaissé
  Stripe, **en centimes**, cf. `Stripe.Invoice.amount_paid`). Récurrent : recalculé **à
  chaque paiement d'abonnement** (renouvellement inclus) → « à vie ».
- **Périmètre** : **abonnements uniquement** (mode `subscription`). Les packs de crédits
  (paiement unique) et les achats de référentiels à l'unité sont **hors périmètre**
  (le porteur a précisé « % à vie de tous les abonnements »). Ne pas commissionner les
  packs.
- **B2B / écoles** : hors Stripe self-serve → commission **saisie manuellement** par le
  super-admin (montant libre, ponctuel ou récurrent), cf. §7.

---

## 3. Schéma Prisma (`prisma/schema.prisma`) — ⚠️ `npm run db:push` requis

Ajouter au modèle `User` existant :

```prisma
model User {
  // ... champs existants ...
  referralCode          String?   @unique @map("referral_code")   // code public de l'ambassadeur (généré à l'activation)
  referredByUserId      String?   @map("referred_by_user_id") @db.Uuid // parrain DIRECT (niveau 1), figé à l'inscription
  ambassadorAt          DateTime? @map("ambassador_at")           // date d'activation du statut ambassadeur (null = pas activé)
  ambassadorTermsAt     DateTime? @map("ambassador_terms_at")     // consentement CGU affiliation

  @@index([referredByUserId])
}
```

> **Niveau 2 dérivé, pas stocké** : le parrain de niveau 2 d'un utilisateur U = le
> `referredByUserId` du `referredByUserId` de U. On ne stocke JAMAIS de chaîne au-delà —
> c'est ce qui garantit la limite à 2 niveaux (cf. §1.1).

Nouveaux modèles :

```prisma
// Journal des commissions d'affiliation. Miroir de CreditLedger (même logique
// ledger : chaque ligne = un mouvement, balanceAfter = solde après ce mouvement).
model CommissionLedger {
  id             String   @id @default(uuid()) @db.Uuid
  beneficiaryId  String   @map("beneficiary_id") @db.Uuid  // l'ambassadeur qui touche
  delta          Int                                        // + gain / - paiement, en CENTIMES
  balanceAfter   Int      @map("balance_after")             // solde après, en centimes
  // 'commission_sub_t1' | 'commission_sub_t2' | 'commission_school' | 'payout' | 'clawback' | 'adjustment'
  reason         String
  tier           Int?                                       // 1 ou 2 pour les commissions d'abonnement
  sourceUserId   String?  @map("source_user_id") @db.Uuid   // le filleul dont l'abonnement génère la commission
  stripeInvoiceId String? @map("stripe_invoice_id")         // clé d'idempotence (voir §5)
  payoutRequestId String? @map("payout_request_id") @db.Uuid
  meta           Json?
  createdAt      DateTime @default(now()) @map("created_at")

  @@index([beneficiaryId, createdAt])
  // Idempotence : une même facture ne peut pas créer deux fois la même commission
  // pour le même bénéficiaire au même palier.
  @@unique([beneficiaryId, stripeInvoiceId, tier])
  @@map("commission_ledger")
}

// Demande de paiement de commission par un ambassadeur.
model PayoutRequest {
  id            String    @id @default(uuid()) @db.Uuid
  ambassadorId  String    @map("ambassador_id") @db.Uuid
  amountCents   Int       @map("amount_cents")     // montant demandé (= solde au moment de la demande)
  status        String    @default("pending")      // 'pending' | 'invoice_received' | 'paid' | 'rejected'
  invoiceEmailAt DateTime? @map("invoice_email_at") // quand l'ambassadeur signale avoir envoyé la facture
  paidAt        DateTime?  @map("paid_at")
  note          String?                             // note interne admin (réf. virement, etc.)
  createdAt     DateTime  @default(now()) @map("created_at")

  @@index([status, createdAt])
  @@index([ambassadorId])
  @@map("payout_requests")
}
```

Après édition du schéma : `npx prisma generate`, puis **le porteur exécute
`npm run db:push`** (toi tu ne peux pas — pas d'accès DB).

---

## 4. Attribution du parrainage (capture → inscription)

Mécanique calquée sur le report du `planId` déjà en place (voir comment `?plan=` est
threadé de `/tarifs` → `/inscription` → `/api/auth/register`) et sur le cookie `ts_vid`
de la mesure d'entonnoir (`src/lib/funnel.ts`).

1. **Lien ambassadeur** : `https://<domaine>/?ref=CODE` (le code = `User.referralCode`).
   Prévois aussi une route courte optionnelle `/r/[code]` qui pose le cookie puis
   redirige vers `/` (plus propre à partager). Construire les liens avec
   `appBaseUrl()`/`appBaseUrlFromRequest()` (`src/lib/base-url.ts`).
2. **Capture** : quand une page publique est chargée avec `?ref=CODE` (ou via `/r/[code]`),
   poser un cookie **first-touch** `ts_ref` = CODE (httpOnly, sameSite lax, secure en
   prod, `maxAge` = `affiliation.cookie.days` jours). **Ne pas écraser** un `ts_ref`
   existant (le premier parrain gagne — plus équitable et standard). Implémentation : soit
   un petit helper serveur lu dans le layout racine / la landing, soit la route `/r/[code]`.
   Le plus simple et fiable : route `/r/[code]/route.ts` (GET) qui pose le cookie et
   redirige.
3. **Résolution à l'inscription** : dans `src/app/api/auth/register/route.ts` ET
   `src/app/api/auth/callback/route.ts` (lien magique), **après** création du compte,
   lire le cookie `ts_ref`, résoudre le code → `referrer = User.findUnique({ where: {
   referralCode } })`. Si trouvé, valide (voir gardes ci-dessous) et **compte NOUVEAU**,
   écrire `newUser.referredByUserId = referrer.id`. Idempotent : ne jamais réécrire si
   déjà set.
   - **Gardes anti-fraude** : refuser si `referrer.id === newUser.id` (auto-parrainage) ;
     refuser si ça créerait un cycle de niveau 2 (`referrer.referredByUserId ===
     newUser.id`). Refuser un `referralCode` inconnu (silencieux, on ignore).
4. **Attribution B2B** : cf. §7 (pas de cookie, saisie manuelle).

---

## 5. Calcul des commissions (hook Stripe) — CŒUR DU SYSTÈME

Point d'accroche : `src/lib/billing.ts`, fonction **`handleInvoicePaid`** (ligne ~200) —
elle tourne déjà à **chaque** paiement d'abonnement (1er paiement ET renouvellements),
juste après `grant(userSub.userId, plan.monthlyCredits, "subscription_renewal", …)`. C'est
CE point qui rend la commission « à vie ». Le webhook `/api/stripe/webhook` garantit déjà
l'idempotence par événement (table `StripeEvent`, insert-first) ; on ajoute une seconde
barrière d'idempotence via `CommissionLedger.@@unique([beneficiaryId, stripeInvoiceId,
tier])`.

Créer `src/lib/affiliation.ts` (server-only) avec :

- `recordCommissionsForInvoice({ payingUserId, invoiceId, amountPaidCents })` :
  1. Si `affiliation.enabled` ≠ true → return.
  2. Charger `payingUser` (le filleul). `tier1Id = payingUser.referredByUserId`. Si null →
     return (personne ne l'a parrainé).
  3. Charger `tier1 = User.findUnique(tier1Id)`. `tier2Id = tier1.referredByUserId`.
  4. Commission niveau 1 : `Math.round(amountPaidCents × rateTier1 / 100)` pour `tier1Id`,
     reason `commission_sub_t1`, tier 1, `sourceUserId = payingUserId`, `stripeInvoiceId
     = invoiceId`.
  5. Commission niveau 2 (si `tier2Id` existe ET `tier2Id !== payingUserId`) :
     `Math.round(amountPaidCents × rateTier2 / 100)` pour `tier2Id`, reason
     `commission_sub_t2`, tier 2, même `sourceUserId`/`stripeInvoiceId`.
  6. Écriture via une fonction `creditCommission(beneficiaryId, deltaCents, { reason,
     tier, sourceUserId, stripeInvoiceId })` qui, dans une transaction : calcule le
     nouveau solde (somme des deltas du bénéficiaire), insère la ligne
     `CommissionLedger`. **Best-effort et idempotent** : entourer d'un try/catch ; une
     violation de la contrainte `@@unique` (facture déjà traitée) est avalée
     silencieusement (return sans erreur). Le calcul de commission ne doit **jamais** faire
     échouer le webhook (sinon Stripe rejoue et re-crédite les crédits).

Brancher l'appel dans `handleInvoicePaid`, après le `grant` de crédits :
`await recordCommissionsForInvoice({ payingUserId: userSub.userId, invoiceId: invoice.id,
amountPaidCents: invoice.amount_paid })`. (`invoice.amount_paid` existe, en centimes.)

Helpers de lecture dans `src/lib/affiliation.ts` :
- `getCommissionBalance(userId): Promise<number>` (centimes) — dernier `balanceAfter` ou
  somme des deltas.
- `getAmbassadorStats(userId)` : `{ balanceCents, totalEarnedCents, totalPaidCents,
  tier1Count, tier2Count, activeReferredCount }`. `tier2Count` = nombre d'utilisateurs
  dont le `referredByUserId` a lui-même pour parrain cet ambassadeur (une seule requête
  avec un IN sur les filleuls directs).
- `getReferralList(userId)` : filleuls directs **masqués** (id → `#` + 4 hex du hash),
  statut (a un `UserSubscription` actif ?), commission cumulée générée. **Ne jamais
  exposer email/nom.**
- `resolveCommissionRate()` : lit les taux depuis AppConfig.

### Clawback (remboursement) — v1 minimale, à prévoir
Ajouter un handler `customer.subscription.deleted` existe déjà ; pour les remboursements,
gérer l'événement Stripe **`charge.refunded`** (à ajouter au switch du webhook
`/api/stripe/webhook` + `handleChargeRefunded` dans `billing.ts`) : retrouver les
`CommissionLedger` liés à la facture remboursée et écrire une ligne `clawback` négative
(reprise de la commission). Si trop complexe pour la v1, **au minimum** documenter le trou
et laisser un TODO explicite — ne pas l'ignorer silencieusement.

---

## 6. Espace ambassadeur (frontend) — `/affiliation`

Server Component protégé (utilisateur connecté ; `requireUser()` de `src/lib/auth.ts`).
Réservé aux apprenants du **tenant public** + rôles concernés (pas pertinent pour un
membre B2B en marque blanche — réutiliser la logique `canBuyIndividualOffers`/type de
tenant de `src/lib/entitlements.ts` pour décider de l'affichage).

> **Contenu rédactionnel** : tous les titres/textes/libellés de cette section sont fournis
> dans `src/lib/affiliation-copy.ts` (`AFFILIATION_ACTIVATION` pour l'activation,
> `AFFILIATION_DASHBOARD` pour l'espace). Ne pas réécrire — importer et afficher.

Sections :

1. **Activation** (si `ambassadorAt` null) : encart expliquant le programme (contenu =
   `AFFILIATION_ACTIVATION` : `h1`, `lead`, `benefits`, `consentLabel`, `consentHint`, `cta`)
   + case CGU (§1.5, obligatoire) + bouton « Devenir ambassadeur ». Server action : génère
   `referralCode`
   (court, lisible, unique — ex. 8 caractères base32 sans ambiguïté, regénérer en cas de
   collision), pose `ambassadorAt` et `ambassadorTermsAt = now()`.
2. **Mon lien** : affiche `…/r/CODE`, bouton copier (réutiliser le pattern client de
   `src/app/admin/optimisation/copy-prompt.tsx` ou `low-credits-banner.tsx`). QR code
   optionnel (via une lib légère ou un composant maison SVG — non bloquant).
3. **Mes revenus** (cartes chiffres via `getAmbassadorStats`) : Solde actuel (mis en
   avant, format € depuis centimes), Total gagné, Total déjà payé, Filleuls directs,
   Filleuls de niveau 2, Abonnements actifs générés. Préciser sous le solde « montant HT,
   selon votre statut » (§1.6).
4. **Demander le paiement** : bouton actif **seulement si** `solde ≥
   affiliation.payout.min`. Sinon, désactivé + « Disponible à partir de X € ». Au clic
   (server action) : crée un `PayoutRequest` (status `pending`, `amountCents = solde`),
   affiche les instructions : *« Envoyez votre facture de {montant} € à
   contact@meleta.app en indiquant votre email de compte. »* + un bouton « J'ai envoyé ma
   facture » qui passe `invoiceEmailAt = now()` et status `invoice_received`.
   **Important** : le solde n'est PAS remis à zéro à la demande — il le sera quand
   l'admin marque « payé » (§8), via une ligne `payout` négative. Empêcher une 2ᵉ demande
   tant qu'une demande `pending`/`invoice_received` existe.
5. **Historique** : lignes `CommissionLedger` (libellées : gain niveau 1/2, paiement,
   ajustement…) + demandes de paiement passées avec leur statut.
6. **Mes filleuls** : table via `getReferralList` — identifiant masqué, statut, commission
   générée. Jamais d'email.
7. **Kit de diffusion** : cf. §9 (textes personnalisés avec le lien + visuels).

**Navigation** : ajouter l'accès à `/affiliation` dans le menu utilisateur connecté
(header `src/app/layout.tsx`, section `{user && (...)}`) et/ou la nav mobile
(`src/app/_components/mobile-nav.tsx`). Libellé « Ambassadeur » ou « Affiliation »,
icône lucide `Gift` ou `Users`.

---

## 7. Volet écoles / B2B (attribution manuelle)

Le B2B n'est pas self-serve (devis manuels). Attribution manuelle :

1. **Formulaire de démo** (`src/app/demande-demo/`) : ajouter un champ optionnel
   **« Recommandé par (nom ou email de votre ambassadeur MELETA) »** (`name="parrainage"`).
   Le transmettre dans l'email envoyé par `sendDemoRequest` (`src/lib/email.ts`) — ajouter
   le champ au corps du mail. Optionnel : stocker les demandes de démo en base (nouveau
   modèle `DemoRequest`) pour les retrouver côté admin ; sinon l'email suffit en v1.
2. **Saisie de la commission** : dans l'admin (§8), le super-admin peut créditer
   manuellement un ambassadeur d'une commission « école » : choisir l'ambassadeur (par
   email), montant (€ → centimes), note (« Deal École X, contrat annuel »). → ligne
   `CommissionLedger` reason `commission_school`. Peut être répété (récurrent) à chaque
   renouvellement du contrat école, à la main.
3. Contenu incitatif dans le kit (§9) : un modèle de message spécifique « proposez MELETA
   à votre école ».

---

## 8. Admin — `/admin/affiliation`

Page super-admin (pattern `/admin/*` : `requireSuperAdmin()`, `export const dynamic =
"force-dynamic"`, `AdminLink` dans `src/app/admin/layout.tsx`, icône `Gift`).

Sections :
1. **Réglages** : formulaire des clés AppConfig (§2) — taux t1/t2, seuil de paiement,
   activation du programme, durée cookie. Server action `saveAffiliationSettings`.
2. **Ambassadeurs** : table (email, code, filleuls n1/n2, total gagné, solde, total payé),
   triable par solde décroissant (repérer qui est à payer). Réutiliser le style de tableau
   de `/admin/credits`.
3. **Demandes de paiement** : file des `PayoutRequest` `pending`/`invoice_received` :
   email de l'ambassadeur, montant, date, statut, si la facture a été signalée envoyée.
   Actions : **« Marquer payé »** (server action) → dans une transaction : écrit une ligne
   `CommissionLedger` reason `payout`, `delta = -amountCents`, `balanceAfter` recalculé,
   `payoutRequestId` renseigné ; passe `PayoutRequest.status = "paid"`, `paidAt = now()`.
   **Résultat : le solde de l'ambassadeur revient à 0** (ou au résidu accumulé depuis la
   demande). Aussi : « Rejeter » (status `rejected`, sans mouvement de solde).
4. **Commission école (manuelle)** : formulaire §7.2.
5. **Ajustement manuel** : créditer/débiter un ambassadeur (reason `adjustment`) pour
   corriger une erreur — comme le `GrantForm` de `/admin/credits`.

---

## 9. Kit marketing prêt à l'emploi (contenu à intégrer)

Affiché dans l'espace ambassadeur (§6.7). **Tous les textes ci-dessous sont à insérer tels
quels**, avec le lien de l'ambassadeur injecté à la place de `{LIEN}` et son prénom à la
place de `{PRENOM}` côté serveur. Chaque bloc a un bouton « Copier ».

### 9.1 Email à un confrère (praticien → praticien)
```
Objet : Un outil pour s'entraîner à la relation clinique

Bonjour,

Je te partage MELETA, que j'utilise pour m'entraîner à la pratique clinique sur des cas
réalistes : exercices ciblés, mises en situation avec un patient simulé par IA, et un
suivi de progression compétence par compétence. C'est formatif (non certifiant), et on
peut tester gratuitement sans carte bancaire.

Si ça t'intéresse : {LIEN}

Bonne découverte,
{PRENOM}
```

### 9.2 Post LinkedIn
```
On sait expliquer l'écoute active ou l'entretien motivationnel. Les mobiliser sous
pression, face à un vrai patient, c'est autre chose.

J'utilise MELETA pour entraîner ces compétences relationnelles sur des cas cliniques
réalistes : feedback immédiat, mises en situation avec un patient simulé par IA, et une
carte de progression qui montre où je progresse et où je cale.

Outil formatif, non certifiant. Essai gratuit sans carte bancaire 👉 {LIEN}

#pratiqueclinique #formation #thérapie #coaching
```

### 9.3 Post Instagram / story (légende courte)
```
S'entraîner à la relation clinique, pas juste la théoriser 🧠
Cas réalistes · patient simulé par IA · progression par compétences.
Essai gratuit 👉 lien en bio / {LIEN}
```

### 9.4 Message WhatsApp / DM
```
Salut ! Je te partage un outil que j'aime bien pour m'entraîner à la pratique clinique
(cas réalistes + patient simulé par IA, suivi de progression). Test gratuit sans CB : {LIEN}
```

### 9.5 Message « proposez MELETA à votre école » (volet B2B)
```
Bonjour,

Dans le cadre de la formation, MELETA pourrait intéresser vos étudiants : un outil
d'entraînement à la relation clinique (cas réalistes, patient simulé par IA, suivi des
compétences), avec un accès dédié pour les écoles et organismes.

Si vous souhaitez une démonstration : https://meleta.app/demande-demo
(vous pouvez mentionner mon nom, {PRENOM}, dans le formulaire.)

Bien à vous,
{PRENOM}
```

### 9.6 Visuels — DÉJÀ FOURNIS (ne pas les recréer)

Le **contenu texte ET les visuels du kit sont déjà générés** et présents dans le dépôt.
**Ne les régénère pas** — tu n'as qu'à les afficher dans l'espace ambassadeur (§6.7).

- **Textes** : `src/lib/affiliation-kit.ts` exporte `KIT_BLOCKS` (email confrère, LinkedIn,
  Instagram, WhatsApp/DM, message écoles), `KIT_IMAGES` (manifeste des visuels),
  `fillTemplate(text, { lien, prenom })` (remplace `{LIEN}`/`{PRENOM}`) et `KIT_DISCLAIMER`
  (rappel déontologique à afficher au-dessus du kit).
- **Visuels** : 4 fichiers SVG à la marque MELETA dans `public/affiliation/` :
  `banniere-lien-1200x630.svg`, `carre-1080x1080.svg`, `story-1080x1920.svg`,
  `bandeau-email-1200x400.svg`. Ils sont servis directement par Next (`/affiliation/…svg`)
  et téléchargeables. SVG = net à toute taille, exportable en PNG par l'ambassadeur si
  besoin.
- **UI à construire** (c'est TON travail) : dans la section kit de `/affiliation`, pour
  chaque `KIT_BLOCKS`, afficher le titre + un `<textarea>`/`<pre>` du corps rempli via
  `fillTemplate(block.body, { lien, prenom })` (et le sujet pour les emails) avec un bouton
  « Copier » (pattern `src/app/admin/optimisation/copy-prompt.tsx`). Pour chaque
  `KIT_IMAGES`, afficher un aperçu (`<img src={img.src}>`) + un lien de téléchargement
  (`<a href={img.src} download>`). Afficher `KIT_DISCLAIMER` en tête.
- **Personnalisation optionnelle (v2, non requise)** : une route `next/og` par ambassadeur
  pour incruster son lien/prénom dans l'image. Les visuels statiques ci-dessus suffisent
  pour la v1.

---

## 10. Page publique de recrutement — `/ambassadeurs`

Page publique (Server Component, pas de `force-dynamic` nécessaire) qui explique le
programme et donne envie de rejoindre. Réutiliser le style de `/tarifs`
(`src/app/tarifs/page.tsx`).

> **Contenu rédactionnel = `AMBASSADEURS_PAGE` dans `src/lib/affiliation-copy.ts`** (rédigé
> et optimisé conversion). Structure à monter, dans l'ordre, avec ce contenu :
> - `metadata` = `AMBASSADEURS_PAGE.seo` (title/description).
> - **Héro** : `eyebrow`, `h1`, `lead`, bouton `ctaPrimary` (→ `/affiliation` si connecté,
>   `/inscription` sinon), petite mention `ctaSecondaryNote`.
> - **Bandeau chiffres** : `highlights[]` (3 cartes value/label).
> - **Comment ça marche** : `howItWorksTitle` + `howItWorks[]` (3 étapes numérotées — ici
>   la numérotation est légitime, c'est une vraie séquence).
> - **Deux niveaux** : `twoLevelsTitle` + `twoLevelsText`.
> - **Écoles** : `schoolsTitle` + `schoolsText` + `schoolsCta`.
> - **FAQ** : `faqTitle` + `faq[]` (+ JSON-LD `FAQPage`, même pattern que `/tarifs`).
> - **CTA final** : `finalCtaTitle`, `finalCtaText`, `finalCta`.
>
> Remplacer `{T1}`/`{T2}`/`{SEUIL}` par les valeurs AppConfig avant rendu.

Ajouter le lien « Ambassadeurs » au **footer** (`src/app/layout.tsx`, à côté de Tarifs/Blog).
Envisager aussi un encart d'incitation discret dans l'espace connecté (ex. sur `/credits`
ou `/accueil`) : « Vous aimez MELETA ? Recommandez-le et gagnez à vie → Devenir
ambassadeur » — bon levier de recrutement d'ambassadeurs parmi les utilisateurs actifs.

---

## 11. Fichiers — récapitulatif

**DÉJÀ FOURNIS (ne pas recréer) :**
- `src/lib/affiliation-kit.ts` — contenu texte du kit + manifeste des visuels + helpers.
- `public/affiliation/*.svg` — 4 visuels à la marque (lien, carré, story, bandeau email).
- **`src/lib/affiliation-copy.ts`** — **TOUT le contenu rédactionnel** des pages, optimisé
  conversion (rédigé à la main) : `AMBASSADEURS_PAGE` (page publique §10), `AFFILIATION_
  ACTIVATION` (écran d'activation §6.1), `AFFILIATION_DASHBOARD` (libellés de l'espace §6).
  **N'invente aucun texte** : importe et affiche ces constantes. Remplace les placeholders
  (`{T1}`, `{T2}`, `{SEUIL}`, `{LIEN}`, `{PRENOM}`, `{MONTANT}`) par les valeurs réelles
  (taux/seuil depuis AppConfig §2 ; lien/prénom/montant selon le contexte). Un helper de
  remplacement simple suffit (cf. `fillTemplate` de `affiliation-kit.ts`).

**Créer :**
- `src/lib/affiliation.ts` — logique commissions, stats, cookie ref, résolution parrain.
- `src/app/r/[code]/route.ts` — pose le cookie `ts_ref` et redirige vers `/`.
- `src/app/affiliation/page.tsx` (+ `actions.ts`, composants client copier/QR).
- `src/app/affiliation/share-image/route.tsx` — images `next/og` (option A du kit).
- `src/app/ambassadeurs/page.tsx` — page publique de recrutement.
- `src/app/admin/affiliation/page.tsx` (+ `actions.ts`, composants boutons client).
- (optionnel) modèle `DemoRequest` si stockage des demandes de démo.

**Modifier :**
- `prisma/schema.prisma` — champs `User` + `CommissionLedger` + `PayoutRequest`.
- `src/lib/billing.ts` — appeler `recordCommissionsForInvoice` dans `handleInvoicePaid` ;
  ajouter `handleChargeRefunded` (clawback) ; brancher `charge.refunded` dans le webhook.
- `src/app/api/stripe/webhook/route.ts` — `case "charge.refunded"`.
- `src/app/api/auth/register/route.ts` et `src/app/api/auth/callback/route.ts` — résolution
  `ts_ref` → `referredByUserId` (avec gardes anti-fraude).
- `src/app/demande-demo/actions.ts` + `demo-form.tsx` — champ « recommandé par ».
- `src/lib/email.ts` — ajouter le champ parrainage dans `sendDemoRequest`.
- `src/app/admin/layout.tsx` — `AdminLink` « Affiliation ».
- `src/app/layout.tsx` — lien espace ambassadeur (nav connectée) + lien « Ambassadeurs »
  (footer public).
- `src/app/_components/mobile-nav.tsx` — entrée mobile (optionnel).

---

## 12. Critères d'acceptation (vérification)

- `npx tsc --noEmit` et `npm run build` passent.
- **Schéma** : après `npm run db:push`, les tables `commission_ledger`, `payout_requests`
  et les colonnes User existent.
- **Attribution** : visiter `/r/CODE` pose le cookie `ts_ref` ; créer un compte ensuite
  renseigne `referredByUserId` sur le nouvel utilisateur ; l'auto-parrainage et les cycles
  n2 sont refusés.
- **Commission récurrente** : en mode test Stripe, un filleul qui souscrit un abonnement
  génère une ligne `commission_sub_t1` (= taux × montant encaissé) pour son parrain, et
  `commission_sub_t2` pour le parrain du parrain s'il existe. **Rejouer deux fois le même
  `invoice.paid`** ne crée qu'une commission (contrainte `@@unique`). Un 2ᵉ paiement
  (renouvellement simulé) crée une nouvelle commission → « à vie » vérifié.
- **Périmètre** : un achat de **pack de crédits** ne génère AUCUNE commission.
- **Payout** : le bouton « Demander le paiement » est désactivé sous le seuil ; au-dessus,
  il crée une `PayoutRequest` ; « Marquer payé » côté admin écrit une ligne `payout`
  négative et **ramène le solde de l'ambassadeur à 0** ; une nouvelle demande n'est
  possible qu'après clôture de la précédente.
- **RGPD** : le tableau de bord ambassadeur n'affiche jamais l'email/nom d'un filleul.
- **Config** : changer `affiliation.rate.tier1` en admin modifie le calcul sans
  redéploiement ; `affiliation.enabled=false` désactive tout calcul de commission.
- **École** : le champ « recommandé par » apparaît dans l'email de demande de démo ; le
  super-admin peut créditer manuellement une commission école qui apparaît dans le solde
  de l'ambassadeur.
- **Kit** : l'espace ambassadeur affiche les textes §9 avec `{LIEN}`/`{PRENOM}` remplis,
  chaque bloc copiable ; au moins l'option A (images `next/og`) fonctionne.

---

## 13. Hors périmètre v1 (à ne pas faire, sauf demande)

- Profondeur > 2 niveaux (interdit, cf. §1).
- Paiement automatique des commissions (Stripe Connect/virements auto) : v1 = facture
  manuelle + « marquer payé ». Stripe Connect est une évolution v2 lourde.
- Détection de fraude avancée (multi-comptes, self-referral via emails jetables).
- Commission sur packs de crédits / achats à l'unité (abonnements seulement).
- Multidevise (tout en EUR/centimes).

---

## 14. Notes d'implémentation transverses

- **Montants toujours en centimes (Int)** côté DB et logique ; formater en € seulement à
  l'affichage (`(cents/100).toFixed(2)`), comme le fait déjà le code Stripe existant
  (`priceEurCents`).
- **Idempotence & best-effort** : toute écriture de commission dans un webhook est
  entourée d'un try/catch et ne doit jamais faire échouer le traitement Stripe (sinon
  Stripe rejoue → double-crédit de crédits). Le pattern existe déjà dans `funnel.ts`
  (`recordFunnel` best-effort) — s'en inspirer.
- **Cohérence ledger** : le solde d'un ambassadeur = dernier `balanceAfter`, ou
  `SUM(delta)` — les deux doivent concorder. Calculer le `balanceAfter` dans une
  transaction pour éviter les courses (cf. `debit`/`grant` de `src/lib/credits.ts`).
- **Ton & design** : réutiliser les composants/tokens existants (`card-soft`, `--accent`,
  `--ochre`, `AdminLink`, tables de `/admin/credits`). Ne pas introduire de dépendance UI
  nouvelle.
```
