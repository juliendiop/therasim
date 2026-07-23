# 🧭 DÉCISIONS — Produit & Technique

## Décisions PRODUIT

| # | Sujet | Décision retenue |
|---|-------|------------------|
| 1 | Nom | **TheraSim** (nom de travail). Vérifs INPI / domaine / stores à faire avant officialisation. |
| 2 | Stack | **Next.js / Vercel / Neon** (et non Go+Postgres de la spec). Produit identique, plus simple à maintenir en solo, cohérent avec theraflow-pro. |
| 3 | LLM évaluateur | **Mistral** (cohérent avec le choix theraflow ; RGPD Art.28). |
| 4 | Architecture référentiels | **Option A** (spec §2.3) : chaque référentiel autonome, sa propre grille, pas de report entre référentiels. Schéma déjà « conscient du référentiel » pour garder l'Option B ouverte. |
| 5 | Périmètre session 1 | Tranche verticale **reconnaissance** (la plus rapide à valider, spec §8 étape 4) + carte temps réel + référentiel EM. |
| 6 | Posture réglementaire | **Formatif, non certifiant** (spec §7). Routage/recommandations = pédagogiques, jamais de verrou certifiant sans avis juridique (AI Act). |

## Décisions & pièges TECHNIQUES (à connaître pour ne pas se reperdre)

### CONVENTION — les champs de statut sont des `String`, jamais des enums Prisma (23 juillet)
**S'applique à TOUT nouveau modèle**, y compris les chantiers à venir (ex. ticketing :
`TicketStatus` et consorts → `String`, pas enum).
- Le schéma n'a **aucun enum natif** : `UserSubscription.status`, `Framework.statut`,
  `Tenant.type`, `BetaInvite.status`… sont des `String` avec la liste des valeurs en commentaire.
- **Pourquoi** : 1) une seule convention à maintenir ; 2) **enum Postgres + `db:push` est le
  pire couple** — ajouter une valeur passe, mais en **retirer ou en renommer une** pousse
  Prisma sur un chemin **destructif** ; 3) un statut est précisément ce qui gagne des valeurs
  avec le temps (un ticketing voudra `DUPLICATE`, `WAITING_ON_RELEASE`…) — le figer en base
  impose un `ALTER TYPE` en prod à chaque idée.
- **Le typage ne se perd pas** : union TS `as const` + garde `zod` à la frontière donnent
  l'autocomplétion, l'exhaustivité des `switch` et la validation des entrées. Ce qu'on perd
  est la contrainte au niveau base — acceptable : **notre code est le seul écrivain**.
- Gabarit de référence : `src/lib/beta-status.ts`.

```ts
export const BETA_INVITE_STATUS = ["PENDING", "CLAIMED", "REVOKED", "EXPIRED"] as const;
export type BetaInviteStatus = (typeof BETA_INVITE_STATUS)[number];
export const betaInviteStatusSchema = z.enum(BETA_INVITE_STATUS);
```

### Choix de stack — pourquoi pas Go ?
- La spec dit « Go (chi + pgx) + PostgreSQL + React/TS ». On a retenu **Next.js fullstack**
  (API routes + React) car : 1 seul service au lieu de 2, pas de Docker en local, tooling
  déjà connu (theraflow-pro), déploiement Vercel trivial. **Le produit livré est identique.**

### Prisma v7 — adaptateur obligatoire
- Prisma v7 n'accepte plus `url = env("DATABASE_URL")` dans `schema.prisma`.
- La connexion passe par l'**adaptateur** `@prisma/adapter-neon` dans `src/lib/prisma.ts`,
  et par `prisma.config.ts` (qui charge `.env` via `dotenv` — sinon les commandes CLI ne
  voient pas `DATABASE_URL`).

### Driver Postgres : natif (`@prisma/adapter-pg`), PAS le serverless Neon
- On a d'abord essayé le driver **serverless** de Neon (`@prisma/adapter-neon`, HTTP/WS).
  Il est **bloqué depuis le poste pro** (proxy/pare-feu) → `fetch failed ECONNREFUSED` au seed.
  La connexion Postgres **native** (port 5432), elle, passe (le `db:push` a marché d'emblée).
- **Décision** : utiliser `@prisma/adapter-pg` (driver `pg` natif) dans `src/lib/prisma.ts`
  ET `prisma/seed.ts`. Fiable en local (derrière proxy) et sur Vercel (Fluid Compute = Node).
- Warning SSL cosmétique au seed (`sslmode=require` traité comme `verify-full`) : sans gravité,
  Neon a un certificat valide.
- Les paquets `@prisma/adapter-neon` / `@neondatabase/serverless` restent installés mais inutilisés.

### Identité (session 1) — utilisateur de dev unique
- La spec prévoit une auth par **lien magique email** (§3). Pour valider la tranche
  reconnaissance sans infra email, on utilise pour l'instant un **utilisateur unique**
  (`dev@therasim.local`, `src/lib/user.ts`). **À remplacer** par la vraie auth (backlog).

### Aucune fuite de corrigé
- Les champs `is_best`/`score`/`feedback` d'un QCM ne sont **jamais** envoyés au front
  avant la réponse. `publicDrill()` (`src/lib/drill-view.ts`) ne renvoie que le `text`.

### Build strict sur Vercel
- Vercel échoue sur la moindre erreur TypeScript. **Règle d'or : `npm run build` en local
  avant chaque push.** (Déjà rencontré : narrowing d'union TS sur `drillId === null`.)

### Params asynchrones (Next 15+/16)
- Dans les Route Handlers et pages, `params` est une **Promise** : toujours `await params`.

### Fins de ligne (Windows)
- Git affiche « LF will be replaced by CRLF » — sans gravité.
