# 🧪 PLAN DE TEST — TheraSim

Document **vivant** : à mettre à jour à chaque session (cocher, ajouter des cas).
Statuts : ⬜ à faire · ✅ passé · ❌ échoué · ⏭️ bloqué (dépendance).

Légende dépendances :
- **[DB]** nécessite une base Neon branchée + `db:push` + `db:seed`.
- **[LLM]** nécessite une `MISTRAL_API_KEY` valide.

---

## 0. Pré-requis environnement

| # | Test | Attendu | Statut |
|---|------|---------|--------|
| 0.1 | `npm install` | Installe sans erreur, génère le client Prisma | ✅ |
| 0.2 | `npm run build` | Build de prod réussi, 0 erreur TypeScript | ✅ |
| 0.3 | `.env` avec `DATABASE_URL` puis `npm run db:push` | Tables créées sur Neon | ⬜ [DB] |
| 0.4 | `npm run db:seed` | « 1 référentiel (EM, publié), 3 catégories, 10 compétences, 2 cas, 14 drills » | ⬜ [DB] |
| 0.5 | `GET /api/health` | `status: ok`, `database: ok`, env présents | ⬜ [DB] |

---

## 1. Moteur — calculs (spec §5) — *tests unitaires à écrire*

> Cible : tests automatisés sur `mastery.ts` et `routing.ts` (backlog qualité).
> En attendant, vérification manuelle via le parcours UI (section 4).

| # | Test | Attendu | Statut |
|---|------|---------|--------|
| 1.1 | `normalizeNote(1..5)` | 0, 0.25, 0.5, 0.75, 1 | ⬜ |
| 1.2 | `updateMastery(null, 0.8)` | 0.8 (premier essai) | ⬜ |
| 1.3 | `updateMastery(0.5, 1)` avec α=0.4 | 0.7 | ⬜ |
| 1.4 | `palier()` aux bornes | <0.40 faible, 0.40-0.60 émergent, 0.60-0.80 solide, >0.80 maîtrisé | ⬜ |
| 1.5 | `couverture()` | 0 jamais, 2 effleurée, 4 pratiquée, 6 bien couverte | ⬜ |
| 1.6 | `recence()` jamais pratiqué | 1 (priorité max) | ⬜ |
| 1.7 | `prioriteCompetence()` non pratiquée vs maîtrisée | la non pratiquée a une priorité plus haute | ⬜ |
| 1.8 | `difficulteCible()` | faible→1, émergent→2, solide→3 | ⬜ |

---

## 2. API (spec §6) — *[DB]*

| # | Test | Attendu | Statut |
|---|------|---------|--------|
| 2.1 | `GET /api/frameworks` | Liste contient EM (statut publié) | ⬜ [DB] |
| 2.2 | `GET /api/me/progress` | 1 entrée EM, **aucune moyenne globale**, mastery_moyenne null au départ | ⬜ [DB] |
| 2.3 | `GET /api/me/progress/em` | 3 catégories, 10 compétences, toutes « non pratiquée », priorités = jamais abordées | ⬜ [DB] |
| 2.4 | `GET /api/frameworks/em/drills/next` | Renvoie un `drill_id` (reconnaissance pour un débutant) | ⬜ [DB] |
| 2.5 | `GET /api/drills/{id}` (reconnaissance) | `options` présentes **sans** `is_best`/`score`/`feedback` | ⬜ [DB] |
| 2.6 | `POST /api/drills/DRL-QO-01/attempt` `{option_index:1}` | `is_best:true`, `score:1`, feedback, modèle, réaction patient | ⬜ [DB] |
| 2.7 | `POST …/attempt` mauvaise option | `is_best:false`, score bas, feedback explicatif, **pas** de réaction patient | ⬜ [DB] |
| 2.8 | `POST …/attempt` `option_index` hors bornes | HTTP 400 | ⬜ [DB] |
| 2.9 | Re-`GET /api/me/progress/em` après 2.6 | la compétence `questions_ouvertes` a bougé (mastery, attempts=1) — **temps réel** | ⬜ [DB] |
| 2.10 | `GET /api/drills/{id}` inconnu | HTTP 404 | ⬜ [DB] |

---

## 3. Mode production (spec §4.3) — *[DB] [LLM]*

| # | Test | Attendu | Statut |
|---|------|---------|--------|
| 3.1 | `POST /api/drills/DRL-REFLET-02/attempt` `{answer:"…"}` **sans** clé | HTTP 503, message « MISTRAL_API_KEY » clair | ⬜ [DB] |
| 3.2 | Idem **avec** clé, bonne réponse (reflet complexe) | note 4-5, score≈0.75-1, citation de la réponse, modèle | ⬜ [DB][LLM] |
| 3.3 | Idem, réponse faible (répétition) | note basse, feedback constructif, suggestion | ⬜ [DB][LLM] |
| 3.4 | Réponse hors-sujet | `non_evalue:true` → **aucun attempt écrit** (carte inchangée) | ⬜ [DB][LLM] |
| 3.5 | `POST …/attempt` réponse vide | HTTP 400 | ⬜ [DB] |

---

## 4. Parcours UI (parcours de démonstration) — *[DB]*

| # | Test | Attendu | Statut |
|---|------|---------|--------|
| 4.1 | `/` | Redirige vers `/catalogue` | ⬜ [DB] |
| 4.2 | `/catalogue` | Tuile EM avec type « Approche », maîtrise « — », 0/10 couvertes | ⬜ [DB] |
| 4.3 | Clic sur la tuile | Carte EM : en-tête, 3 catégories, 10 compétences grises, panneau priorités | ⬜ [DB] |
| 4.4 | Bouton « S'entraîner » (haut) | Ouvre un drill (rappel + stimulus + options) | ⬜ [DB] |
| 4.5 | Choisir la bonne option → Valider | Feedback vert, réponse modèle, réaction patient | ⬜ [DB] |
| 4.6 | Choisir une mauvaise option | Feedback ambre, explication, modèle, pas de réaction patient | ⬜ [DB] |
| 4.7 | « Drill suivant » plusieurs fois | Propose des compétences différentes (routage par priorité) | ⬜ [DB] |
| 4.8 | « Voir ma carte » | Barres colorées selon palier, points de couverture remplis, priorités recalculées | ⬜ [DB] |
| 4.9 | Bouton « S'entraîner » d'une priorité précise | Ouvre un drill **de cette compétence** | ⬜ [DB] |
| 4.10 | Recharger la page carte | La progression persiste (stockée en base) | ⬜ [DB] |

---

## 5. Règles métier critiques (garde-fous spec §2.4 / §7)

| # | Test | Attendu | Statut |
|---|------|---------|--------|
| 5.1 | Compétence jamais pratiquée | Affichée « non couverte » (gris), **pas** « faible » | ⬜ [DB] |
| 5.2 | Aucune moyenne entre référentiels | `me/progress` ne renvoie jamais de score global tous référentiels confondus | ⬜ [DB] |
| 5.3 | Routage cantonné au référentiel | « Drill suivant » dans EM ne propose jamais un drill d'un autre référentiel | ⬜ [DB] |
| 5.4 | Pas de fuite de corrigé | Inspecter la réponse réseau de `GET /api/drills/{id}` : pas de `is_best`/`score`/`feedback` | ⬜ [DB] |
| 5.5 | Multi-référentiels (quand 2+ seedés) | Deux profils distincts, pas de fusion d'« empathie » entre référentiels | ⏭️ (1 seul référentiel pour l'instant) |

---

## 7. Multi-tenant, auth & console admin (session 2) — *[DB]*

| # | Test | Attendu | Statut |
|---|------|---------|--------|
| 7.1 | `GET /catalogue` sans session | Redirige (307) vers `/login` | ✅ |
| 7.2 | `POST /api/auth/magic-link` {email super-admin} | `sent:true` + `devLink` (en dev) | ✅ |
| 7.3 | Suivre le `devLink` (callback) | Pose le cookie de session, redirige super-admin → `/admin` | ✅ |
| 7.4 | `GET /api/me/progress` avec session | Renvoie EM (accès via le pack Découverte) | ✅ |
| 7.5 | `GET /admin` en super-admin | HTTP 200 | ✅ |
| 7.6 | `POST attempt` avec session | Essai enregistré avec `tenant_id` | ✅ |
| 7.7 | `GET /admin` en apprenant (non super-admin) | Redirige vers `/catalogue` | ⬜ |
| 7.8 | Console : créer une plateforme cliente (B2B) | Apparaît dans la liste avec son slug | ⬜ |
| 7.9 | Console : créer un pack + y mettre EM | Pack composé visible | ⬜ |
| 7.10 | Console : accorder le pack à un tenant | Le tenant « voit » EM (accès effectif = oui) | ⬜ |
| 7.11 | Console : retirer EM via override « retrait » sur un tenant qui l'a par pack | Accès effectif passe à « non » | ⬜ |
| 7.12 | Isolation : retirer le pack du tenant public | `/catalogue` n'affiche plus EM (catalogue vide) | ⬜ |
| 7.13 | Lien magique expiré / réutilisé | Redirige `/login?erreur=expire` | ⬜ |

## 8. Admin de contenu (session 2 suite) — *[DB]*

| # | Test | Attendu | Statut |
|---|------|---------|--------|
| 8.1 | `/admin/referentiels` | Catalogue listé (EM, ACT, Anamnèse) avec statut + compteurs | ⬜ |
| 8.2 | Ouvrir un référentiel | Voit catégories, compétences (+ ancrages), et **toutes les cartes** | ⬜ |
| 8.3 | Créer un référentiel | Naît en brouillon, ouvre l'écran détail | ⬜ |
| 8.4 | Ajouter catégorie puis compétence | Apparaissent dans la structure | ⬜ |
| 8.5 | Créer une carte (QCM) à la main | Carte visible sous la compétence | ⬜ |
| 8.6 | « Générer par IA » sans clé Mistral | Bouton désactivé / message « configurez MISTRAL_API_KEY » | ⬜ |
| 8.7 | « Générer par IA » avec clé | Champs pré-remplis (à relire) | ⬜ [LLM] |
| 8.8 | Publier le référentiel + le mettre dans un pack accordé | Devient jouable côté apprenant | ⬜ |
| 8.9 | Supprimer une compétence | Ses cartes sont supprimées avec elle | ⬜ |

## 9. Simulateur N3 (session 2 suite) — *[DB]* (conversation/débrief = *[LLM]*)

| # | Test | Attendu | Statut |
|---|------|---------|--------|
| 9.1 | Carte d'un référentiel → bouton « Entretien simulé » | Mène à `/f/{id}/simulation` (liste des cas) | ⬜ |
| 9.2 | Démarrer un cas (sans clé Mistral) | Session créée, ouverture neutre du patient affichée | ⬜ |
| 9.3 | Envoyer un message (sans clé) | Message 503 clair « configurez MISTRAL_API_KEY » | ⬜ |
| 9.4 | Conversation (avec clé) | Le patient répond de façon cohérente et **réactive** à la posture | ⬜ [LLM] |
| 9.5 | « Terminer » (avec clé) | Débrief : notes/compétence + narratif + moments clés | ⬜ [LLM] |
| 9.6 | Après débrief → « Voir ma carte » | La carte a bougé (essais source='simulation') | ⬜ [LLM] |
| 9.7 | Rouvrir une session terminée | Affiche le débrief mémorisé (pas de recalcul) | ⬜ [LLM] |
| 9.8 | Accès à une session d'un autre utilisateur | 404 (isolation) | ⬜ |

## 10. N2 — mini-scènes guidées (session 2 suite) — *[DB]* (conversation = *[LLM]*)

| # | Test | Attendu | Statut |
|---|------|---------|--------|
| 10.1 | Carte → « Mini-scène guidée » | Crée une session ciblant les 2 compétences prioritaires, ouvre `/sim/{id}` | ⬜ |
| 10.2 | Bannière objectif | Affiche « on travaille : X + Y · 4 tours » | ⬜ |
| 10.3 | Bouton « Indice » (avec clé) | Donne un conseil ciblé sans révéler la réponse | ⬜ [LLM] |
| 10.4 | Atteindre 4 tours | Saisie bloquée, invite à « Terminer » | ⬜ |
| 10.5 | Terminer (avec clé) | Débrief **uniquement sur les 2 compétences ciblées** + carte mise à jour | ⬜ [LLM] |

## 6. À automatiser (backlog qualité)
- Tests unitaires `mastery.ts` / `routing.ts` (Vitest) — couvre la section 1 sans DB.
- Tests d'intégration API avec une base de test (couvre sections 2/3).
- Le critère d'acceptation spec §9 « ajouter un référentiel sans modif de code » se
  testera en seedant un 2e référentiel (ex. ACT) et en rejouant les sections 4/5.
