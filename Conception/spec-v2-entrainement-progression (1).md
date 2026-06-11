# Spec V2 - Mode entraînement + Carte de progression (multi-référentiels)

*Extension de la spec MVP (`spec-mvp-simulateur-entretien.md`). Même stack : Go (chi + pgx) + PostgreSQL + React/TS. On réutilise la grille de compétences, le moteur évaluateur et les personas déjà spécifiés. Objectif : passer du simulateur seul à un moteur d'apprentissage par compétences - entraînement ciblé à feedback immédiat, carte de progression qui visualise forces / faiblesses / couverture, et une architecture pensée dès le départ pour accueillir plusieurs référentiels cliniques (entretien motivationnel, ACT, anamnèse, burnout...).*

---

## 1. La logique d'ensemble

Un continuum en trois niveaux, du guidé vers l'autonome :

- **Niveau 1 - Entraînement (drills)** : une compétence isolée à la fois. Rappel théorique -> mise en situation (un seul tour) -> réponse -> feedback immédiat. Couche "acquisition". *Spécifiée ici.*
- **Niveau 2 - Mini-scènes guidées** : 3 à 5 tours, deux compétences, indices possibles en cours de route. Le pont vers l'intégration. *Réutilise le moteur patient du MVP en bornant le nombre de tours ; détaillée plus tard.*
- **Niveau 3 - Simulation complète** : le scénario entier, sans filet, débrief sommatif. *C'est le MVP existant.*

Au-dessus des trois : **la carte de progression** suit la maîtrise de chaque compétence par apprenant, la visualise, et **route** vers ce qu'il faut travailler.

Point d'architecture clé : drills (N1) et simulations (N3) produisent tous des **scores par compétence**. Ils alimentent la même carte. Une seule source de vérité, deux producteurs.

---

## 2. Architecture multi-référentiels (le socle à poser maintenant)

### 2.1 Principe

Le **moteur** (les deux LLM patient + évaluateur, la boucle de drill, le calcul de maîtrise, le routage) est totalement agnostique au contenu. Ce qui change d'une discipline à l'autre, c'est la **donnée** : une grille de compétences, des personas, des drills, des cartes théoriques. L'unité qui regroupe tout ça est le **référentiel** (`framework`).

- L'entretien motivationnel = référentiel `em`.
- L'ACT = référentiel `act` (les six processus de l'hexaflex : défusion, acceptation, contact au présent, soi-observateur, valeurs, action engagée, + posture).
- Mener une anamnèse = référentiel `anamnese`.
- Prendre en charge un burnout = référentiel `burnout`.

Ajouter une discipline = **écrire du contenu**, pas du code. Le moteur est une plateforme ; le moat, c'est la bibliothèque de référentiels validés cliniquement.

### 2.2 Trois types de référentiels (à distinguer)

Tes exemples ne sont pas de même nature - on tague chaque référentiel par `type` :

- **`approche`** - un modèle thérapeutique cohérent (EM, ACT, TCC, systémique, EMDR). Référentiel autonome avec sa propre grille.
- **`transversale`** - une compétence ou un acte clinique indépendant de toute approche (mener une anamnèse, annoncer une mauvaise nouvelle, gérer une crise suicidaire, clôturer une séance, l'alliance). Référentiel à part entière, mais transversal.
- **`situation`** - un motif, une population, une thématique (burnout, deuil, trauma, ado, couple). Attention : une situation **mobilise** plusieurs approches (psychoéducation, valeurs façon ACT, pose de limites, EM pour l'engagement...). En Option A, on l'écrit comme un parcours autonome avec sa propre grille, même si certaines compétences ressemblent à celles d'autres référentiels.

Le `type` sert au classement dans le catalogue et à la pédagogie ; il ne change pas le moteur.

### 2.3 Décision : Option A - référentiels autonomes

Chaque référentiel possède **sa propre grille**, y compris les thématiques. Une compétence comme "empathie" peut exister dans plusieurs grilles ; la progression dans l'une **ne se reporte pas** dans l'autre.

- Avantage : chaque parcours est auto-suffisant et vendable tel quel - idéal pour un solo.
- Limite acceptée : pas de report d'une compétence transversale d'un référentiel à l'autre.

On rend toutefois le schéma **conscient du référentiel** dès maintenant (`framework_id` partout) pour qu'une éventuelle Option B (bibliothèque de compétences partagées) reste ouverte **sans réécriture**.

### 2.4 Règle d'or de la carte

**La carte se calcule par référentiel.** L'apprenant voit son profil EM, son profil ACT, son profil anamnèse séparément, avec une vue d'ensemble au-dessus - **jamais une moyenne des trois** (moyenner une maîtrise EM avec une maîtrise ACT ne veut rien dire). Le routage reste **cantonné au référentiel en cours** (on ne route jamais d'un drill ACT vers un drill EM).

### 2.5 Données (socle)

```sql
CREATE TABLE frameworks (
  id          TEXT PRIMARY KEY,        -- 'em', 'act', 'anamnese', 'burnout'
  nom         TEXT NOT NULL,           -- 'Entretien motivationnel'
  type        TEXT NOT NULL,           -- 'approche' | 'transversale' | 'situation'
  grid_id     TEXT NOT NULL,           -- réf. competency_grids (1:1 en Option A)
  description TEXT,
  statut      TEXT NOT NULL DEFAULT 'brouillon'  -- 'brouillon' | 'calibre' | 'publie'
);
```

`competency_grids` (du MVP) reste : c'est la grille avec ses compétences et ancrages 1/3/5. Un `framework` possède exactement une grille (`frameworks.grid_id -> competency_grids.id`). On ajoute aussi `framework_id` à `scenarios` (du MVP) pour rattacher chaque cas à son référentiel.

### 2.6 Le coût réel d'un nouveau référentiel (lucidité)

Chaque référentiel demande **sa propre validation clinique** ET **sa propre calibration de l'évaluateur** : un évaluateur calé sur l'EM ne juge pas correctement l'ACT. C'est ça, le travail - et c'est exactement ce qui protège du concurrent qui voudrait tout copier en un week-end.

---

## 3. Prérequis : l'identité utilisateur (changement vs MVP)

La carte est par utilisateur -> il faut des comptes persistants, alors que le MVP était anonyme.

- Authentification légère par **lien magique email** (pas de mot de passe).
- Table `users (id, email, created_at)`. Les `sessions` du MVP et les nouvelles tables référencent `user_id`.
- RGPD : l'email est une donnée personnelle -> consentement explicite à l'inscription, suppression du compte / des données possible. (On ne stocke toujours aucune donnée patient réelle - voir §6.)

---

## 4. Mode entraînement (drills)

### 4.1 Structure d'un drill

Un drill cible UNE compétence, **d'un référentiel donné**, dans un contexte clinique, à un niveau de difficulté, sous l'un de deux modes.

- `id`, `framework_id`, `competency_id` (réf. grille du référentiel), `scenario_context` (la persona / le cas dont il est tiré), `difficulty` (1 à 3).
- `rappel_theorique` : carte courte, 2 à 4 phrases sur la compétence visée.
- `stimulus` : la réplique du patient (ou la consigne) à laquelle l'apprenant répond.
- `mode` : `reconnaissance` (QCM) ou `production` (réponse libre).
- Si `reconnaissance` : `options` = 3 propositions, chacune avec `is_best` (bool), `score` (0 à 1) et `feedback`.
- Si `production` : pas d'options ; noté par l'évaluateur mono-compétence (§4.3).
- `patient_reaction_si_bon` (optionnel) : ce que le patient répond à une bonne réponse, pour faire vivre la conséquence relationnelle.
- `modele_reponse` : exemple de réponse forte, affiché dans le feedback.

Principe pédagogique : pour les débutants, privilégier `reconnaissance` avant `production`. La difficulté monte avec la maîtrise (§5.4).

### 4.2 Données (PostgreSQL, ajouts)

```sql
CREATE TABLE drills (
  id               TEXT PRIMARY KEY,
  framework_id     TEXT NOT NULL,        -- réf. frameworks
  competency_id    TEXT NOT NULL,        -- réf. grille du référentiel
  scenario_context TEXT,                 -- réf. scenarios.id, nullable
  difficulty       INT  NOT NULL,        -- 1..3
  mode             TEXT NOT NULL,        -- 'reconnaissance' | 'production'
  rappel_theorique TEXT NOT NULL,
  stimulus         TEXT NOT NULL,
  options          JSONB,                -- [{text, is_best, score, feedback}] si reconnaissance
  patient_reaction_si_bon TEXT,
  modele_reponse   TEXT NOT NULL
);

CREATE TABLE attempts (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id),
  framework_id  TEXT NOT NULL,           -- réf. frameworks
  competency_id TEXT NOT NULL,
  source        TEXT NOT NULL,           -- 'drill' | 'simulation'
  source_ref    TEXT,                    -- drill_id ou session_id
  score         NUMERIC NOT NULL,        -- normalisé 0..1 (voir §5.1)
  raw           JSONB,                   -- feedback, citation, etc.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Les `evaluations` du MVP (par session) restent. En fin de simulation, on **dérive un `attempt` par compétence évaluée** (en reportant le `framework_id` du scénario) et on l'insère dans `attempts` : c'est ce qui unifie les deux sources dans la carte.

### 4.3 Évaluateur mono-compétence (réutilise l'annexe B du MVP)

Même moteur, version restreinte : on lui passe UNE compétence (avec ses ancrages), le `stimulus`, la `modele_reponse` visée, et la réponse de l'apprenant. Il renvoie un JSON court :

```json
{
  "score": 4,
  "justification": "...",
  "evidence": "la réponse de l'apprenant, citée",
  "suggested_better_response": "...",
  "non_evalue": false
}
```

Température basse (~0.2). Fiabilité **meilleure** qu'en simulation : un seul tour à juger. Le prompt évaluateur est **paramétré par référentiel** (les ancrages et la posture viennent de la grille du `framework_id`).

Pour le mode `reconnaissance` : **aucun appel LLM**. Le feedback est celui de l'option choisie ; le score = `options[].score`.

### 4.4 Flux d'un drill

1. La carte (ou l'apprenant) sélectionne un drill, dans le référentiel en cours.
2. Le front affiche `rappel_theorique`, puis `stimulus`.
3. **Reconnaissance** : choix d'une option -> feedback de l'option + `modele_reponse` + (option) `patient_reaction_si_bon`. **Production** : l'apprenant écrit -> appel évaluateur mono-compétence -> feedback + citation + `modele_reponse` + réaction patient.
4. Le score normalisé est écrit dans `attempts` (avec son `framework_id`) et **met à jour la carte en temps réel** (§5.5).
5. Propositions : « rejouer », « drill suivant (recommandé) », « voir ma carte ».

### 4.5 Seed (exemples de drills)

Au moins **2 drills par compétence** pour chaque référentiel publié (un `reconnaissance` niveau 1, un `production` niveau 2), tirés des cas existants.

Exemple - reflet complexe, production, référentiel EM :

```json
{
  "id": "DRL-REFLET-02",
  "framework_id": "em",
  "competency_id": "reflets",
  "scenario_context": "EM-ALC-01",
  "difficulty": 2,
  "mode": "production",
  "rappel_theorique": "Un reflet complexe ne répète pas : il ajoute du sens ou nomme l'émotion sous-jacente, et montre qu'on a compris au-delà des mots.",
  "stimulus": "De toute façon j'ai déjà essayé d'arrêter, ça n'a jamais marché.",
  "patient_reaction_si_bon": "Ouais... c'est exactement ça. J'ai peur de me planter encore.",
  "modele_reponse": "Après ces échecs, vous redoutez qu'une nouvelle tentative finisse pareil."
}
```

Exemple - questions ouvertes, reconnaissance, référentiel EM :

```json
{
  "id": "DRL-QO-01",
  "framework_id": "em",
  "competency_id": "questions_ouvertes",
  "scenario_context": "EM-ALC-01",
  "difficulty": 1,
  "mode": "reconnaissance",
  "rappel_theorique": "Une question ouverte invite à développer ; une fermée appelle oui/non ou oriente déjà la réponse.",
  "stimulus": "Je suis là parce que mon médecin a insisté, je vois pas le problème.",
  "modele_reponse": "Qu'est-ce qui rendrait ce temps utile pour vous, malgré tout ?",
  "options": [
    { "text": "Vous ne pensez pas que vous devriez réduire ?", "is_best": false, "score": 0, "feedback": "Question fermée et orientée : elle confronte et fait monter la résistance." },
    { "text": "Qu'est-ce qui vous amène ici, de votre point de vue ?", "is_best": true, "score": 1, "feedback": "Question ouverte qui respecte son cadre et ouvre l'exploration." },
    { "text": "Vous buvez depuis combien de temps ?", "is_best": false, "score": 0.5, "feedback": "Ouverte mais factuelle et un peu intrusive d'emblée ; elle n'explore pas la motivation." }
  ]
}
```

---

## 5. Carte de progression (par référentiel)

### 5.1 Normalisation des scores

Tout score (drill ou simulation) est ramené à [0,1] : `s = (note - 1) / 4` pour une note 1-5 ; pour un QCM, `s = options[].score`. Un item « non évalué » n'écrit **pas** d'attempt.

### 5.2 Calcul de la maîtrise (par utilisateur x référentiel x compétence)

```sql
CREATE TABLE user_competency_state (
  user_id        UUID NOT NULL REFERENCES users(id),
  framework_id   TEXT NOT NULL,          -- réf. frameworks
  competency_id  TEXT NOT NULL,
  mastery        NUMERIC,                -- 0..1, NULL si jamais pratiqué
  attempts       INT  NOT NULL DEFAULT 0,
  last_practiced TIMESTAMPTZ,
  PRIMARY KEY (user_id, framework_id, competency_id)
);
```

La clé primaire inclut `framework_id` : c'est ce qui empêche toute fusion entre référentiels (la même compétence "empathie" coexiste proprement en `em` et en `burnout` sans se mélanger).

À chaque nouvel attempt, moyenne mobile pondérée par la récence :

`mastery = (1 - α) * mastery + α * s`  avec `α = 0.4`  (et `mastery = s` au premier essai).
`attempts += 1`, `last_practiced = now()`.

### 5.3 Couverture, paliers et oubli

- **Couverture** (à quel point une compétence est pratiquée), dérivée de `attempts` : 0 = jamais ; 1-2 = effleurée ; 3-5 = pratiquée ; 6+ = bien couverte.
- **Palier de maîtrise** : `<0.40` faible ; `0.40-0.60` émergent ; `0.60-0.80` solide ; `>0.80` maîtrisé.
- **Oubli (révision espacée)** : au-delà de ~21 jours sans pratique, marquer « à réviser ». On ne baisse pas la maîtrise stockée ; on augmente sa priorité de routage.

La distinction maîtrise / couverture est essentielle : *bien couverte mais faible* (pratiquée en boucle sans progrès -> retravailler autrement) vs *non couverte* (jamais vue -> à découvrir, pas une faiblesse).

### 5.4 Routage adaptatif (scopé au référentiel en cours)

Pour chaque compétence **du référentiel travaillé**, un score de priorité :

`priorite = w1*(1 - mastery) + w2*(1 - couverture_norm) + w3*recence + w4*pertinence_scenario`

avec `couverture_norm = min(attempts / 6, 1)`, `recence = clamp(jours_depuis_pratique / 30, 0, 1)`, `mastery` non pratiqué traité comme 0. Poids par défaut : `w1=0.45, w2=0.30, w3=0.15, w4=0.10`.

- On recommande les compétences au plus haut score, **uniquement dans ce référentiel**.
- Difficulté du drill **juste au-dessus** de la maîtrise courante (zone proximale) : faible -> 1 ; émergent -> 2 ; solide et + -> 3 (ou bascule vers une mini-scène N2).
- Progression vers N2/N3 **recommandée** quand les briques clés du scénario atteignent un palier (ex. moyenne ciblée >= 0.60). **Recommandation, pas verrou certifiant** (§6).

### 5.5 Mise à jour temps réel

Après chaque drill et chaque fin de simulation : insérer les attempts -> recalculer `user_competency_state` -> la carte du référentiel concerné reflète immédiatement le nouveau profil et les nouvelles priorités.

### 5.6 Visualisation (front)

**Vue d'ensemble** - `GET /api/me/progress` renvoie un profil **par référentiel**, jamais de moyenne globale :

```json
{
  "frameworks": [
    { "id": "em", "nom": "Entretien motivationnel", "type": "approche", "mastery_moyenne": 0.56, "competences_couvertes": 9, "competences_total": 10, "niveau": "N1" },
    { "id": "anamnese", "nom": "Mener une anamnèse", "type": "transversale", "mastery_moyenne": 0.40, "competences_couvertes": 4, "competences_total": 8, "niveau": "N1" }
  ]
}
```

**Carte détaillée d'un référentiel** - `GET /api/me/progress/{framework_id}` :

```json
{
  "framework": { "id": "em", "nom": "Entretien motivationnel", "type": "approche" },
  "overall": { "mastery_moyenne": 0.56, "competences_couvertes": 9, "competences_total": 10, "niveau": "N1" },
  "categories": [
    { "id": "posture", "nom": "Posture et esprit", "competencies": [
      { "id": "empathie", "nom": "Empathie", "mastery": 0.78, "palier": "solide", "attempts": 9, "couverture": "bien couverte", "last_practiced": "..." }
    ]}
  ],
  "priorites": [
    { "competency_id": "evoquer_discours_changement", "raison": "maîtrise faible" },
    { "competency_id": "reflets", "raison": "fragile malgré la pratique" },
    { "competency_id": "resumes", "raison": "jamais abordée" }
  ]
}
```

Le front rend : un **catalogue / vue d'ensemble** (une tuile par référentiel avec son mini-profil) ; puis, en entrant dans un référentiel, le **tableau de bord détaillé** (cf. maquette présentée en conversation) - par catégorie, barre de maîtrise colorée par palier + indicateur de couverture (points), en-tête (maîtrise moyenne, couverture, niveau), panneau « à travailler en priorité » dont chaque ligne a un bouton « s'entraîner » branché sur `/api/frameworks/{id}/drills/next`.

---

## 6. API (ajouts)

| Méthode | Route | Rôle |
|---|---|---|
| POST | `/api/auth/magic-link` | Envoie un lien de connexion à un email. |
| GET  | `/api/auth/callback` | Valide le token, ouvre la session utilisateur. |
| GET  | `/api/frameworks` | Liste les référentiels publiés (catalogue). |
| GET  | `/api/frameworks/{framework_id}/drills/next` | Drill recommandé dans ce référentiel (routage §5.4). |
| GET  | `/api/drills/{id}` | Détail d'un drill (rappel, stimulus, options si reconnaissance). |
| POST | `/api/drills/{id}/attempt` | Body `{ answer }` (production) ou `{ option_index }` (reconnaissance). Renvoie feedback + score + (option) réaction patient ; met à jour la carte. |
| GET  | `/api/me/progress` | Vue d'ensemble : un profil par référentiel (cf. §5.6). |
| GET  | `/api/me/progress/{framework_id}` | Carte détaillée d'un référentiel (cf. §5.6). |

---

## 7. Garde-fous (la part d'honnêteté)

- **Cas "réels" = réalistes mais fictifs / composites.** Ne pas charger de transcriptions de vrais patients (consentement, RGPD, secret professionnel). Co-écrire des cas réalistes avec un clinicien.
- **Chaque référentiel = sa validation clinique ET sa calibration d'évaluateur.** Ne pas publier un référentiel (`statut = 'publie'`) avant que son évaluateur ait été calé sur un échantillon coté par un superviseur. Un évaluateur EM ne juge pas l'ACT.
- **Ne pas glisser vers une appli de quiz.** Les drills servent l'acquisition ; la simulation ouverte (N3) reste l'aboutissement. Garder un ratio sain drills / simulation.
- **Reconnaissance avant production** pour les débutants.
- **Formatif, non certifiant.** Routage et recommandations de niveau = pédagogiques. Conditionner durement la progression ou certifier sur la base des scores -> périmètre « éducation / évaluation » à haut risque de l'AI Act -> faire valider par un juriste avant tout usage de notation officielle.

---

## 8. Étapes de build

1. `users` + auth par lien magique ; rattacher `sessions` à `user_id`.
2. `frameworks` (+ `framework_id` sur `scenarios`) ; seed du référentiel `em` (grille `em-v1` déjà spécifiée).
3. `drills` + `attempts` + `user_competency_state` (tous avec `framework_id`) ; seed des drills EM.
4. Mode **reconnaissance** (sans LLM) de bout en bout : drill -> option -> feedback -> mise à jour carte. (Le plus rapide à valider.)
5. Mode **production** : évaluateur mono-compétence paramétré par référentiel -> feedback -> mise à jour carte.
6. Calcul maîtrise / couverture / priorité (§5) + endpoints `/api/me/progress` et `/api/me/progress/{framework_id}`.
7. Front : catalogue (vue d'ensemble) + tableau de bord détaillé + bouton « s'entraîner ».
8. Brancher la fin de simulation du MVP pour qu'elle écrive aussi des `attempts` (avec le `framework_id` du scénario).

---

## 9. Critères d'acceptation

- Je m'inscris par email et je retrouve ma progression d'une session à l'autre.
- Un drill m'affiche un rappel théorique, une mise en situation ; je réponds et j'ai un feedback immédiat (avec, en production, une citation de ma réponse et un modèle) ; à la bonne réponse, le patient réagit.
- Après chaque drill, la carte du référentiel concerné se met à jour en temps réel.
- La carte d'un référentiel montre, par catégorie, ma maîtrise (palier coloré) et ma couverture (points) par compétence, plus une liste « à travailler en priorité » (faibles, fragiles malgré la pratique, jamais abordées).
- « S'entraîner » me propose un drill ciblé sur une priorité **de ce référentiel**, à une difficulté adaptée à mon niveau.
- Une compétence jamais pratiquée apparaît comme **non couverte**, pas comme faible.
- **Multi-référentiels** : si je travaille l'EM et l'anamnèse, je vois **deux profils distincts** ; aucune moyenne ne fusionne les deux ; le routage ne me fait jamais passer d'un drill d'un référentiel à un drill d'un autre.
- Ajouter un référentiel (ex. ACT) ne nécessite **aucune modification de code** : seulement une grille, des personas, des drills et la calibration de son évaluateur.
