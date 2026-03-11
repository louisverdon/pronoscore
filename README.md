# Pronoscore — POC Pronostics Ligue 1

Application web de pronostics pour les matchs de Ligue 1, développée en Next.js et Firebase.

## Prérequis

- Node.js 20+
- Compte Firebase
- Clé API [football-data.org](https://www.football-data.org/) (gratuite pour Ligue 1)

## Installation

### 1. Dépendances

```bash
npm install
cd functions && npm install && cd ..
```

### 2. Configuration Firebase

1. Créez un projet sur [Firebase Console](https://console.firebase.google.com/)
2. Activez **Authentication** → fournisseur **Google**
3. Créez une base **Firestore**
4. Copiez `.env.example` vers `.env.local` et remplissez les variables selon l’environnement cible (voir section Environnements ci-dessous)

## Environnements (dev vs prod)

Le projet utilise deux projets Firebase distincts, configurés dans `.firebaserc` :

| Alias      | Projet Firebase   | Usage                    |
|------------|-------------------|--------------------------|
| `production` | pronoscore-e143b | Production (utilisateurs réels) |
| `dev`       | pronoscore-dev   | Développement, tests     |

### Sélectionner l’environnement actif

```bash
# Travailler sur la prod
firebase use production

# Travailler sur le dev
firebase use dev
```

### Variables d’environnement par projet

L’app Next.js se connecte au projet Firebase défini dans `.env.local`. Chaque environnement doit avoir sa propre configuration.

Créez `.env.local` avec les variables **NEXT_PUBLIC_FIREBASE_*** correspondant au projet que vous ciblez :

- **Production** (`pronoscore-e143b`) : récupérez les valeurs dans [Firebase Console](https://console.firebase.google.com/project/pronoscore-e143b/settings/general)
- **Dev** (`pronoscore-dev`) : récupérez les valeurs dans [Firebase Console](https://console.firebase.google.com/project/pronoscore-dev/settings/general)

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

> **Important :** `NEXT_PUBLIC_FIREBASE_PROJECT_ID` doit correspondre au projet actif. Quand vous basculez de prod vers dev (ou l’inverse), mettez à jour `.env.local` puis redémarrez `npm run dev`.

### Clé API football-data.org (Cloud Functions)

Les Cloud Functions utilisent `FOOTBALL_API_KEY` pour synchroniser les matchs Ligue 1. Configurez ce secret **pour chaque projet** où vous déployez les functions.

```bash
firebase use dev  # ou production
firebase functions:secrets:set FOOTBALL_API_KEY
```

Sans cette clé, la sync automatique est ignorée. En revanche, `addTestMatches` fonctionne sans clé API (matchs fictifs).

### Premier sync des matchs

Après un déploiement, Firestore est vide. Deux options :

**Option A — Matchs de test (sans clé API)**

```bash
firebase use dev  # ou production
# Après déploiement des functions
curl -X POST https://us-central1-pronoscore-dev.cloudfunctions.net/addTestMatches
```

Pour la prod, remplacez `pronoscore-dev` par `pronoscore-e143b` dans l’URL.

**Option B — Vrais matchs Ligue 1 (FOOTBALL_API_KEY requise)**

```bash
curl -X POST https://us-central1-pronoscore-dev.cloudfunctions.net/syncMatchesManual
```

La sync planifiée (`syncMatches`) s’exécute toutes les minutes. Un sync manuel permet de remplir la base immédiatement.

## Développement local

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000). L’app se connecte au projet configuré dans `.env.local`.

## Build & déploiement

```bash
npm run build
firebase use production  # ou dev
firebase deploy
```

Le build Next.js génère le dossier `out/`, servi par Firebase Hosting.

**Workflow typique :**

1. `firebase use dev` — basculer sur l’environnement de dev
2. Mettre à jour `.env.local` avec les credentials du projet dev
3. `firebase deploy` — déployer Hosting + Firestore Rules + Functions sur pronoscore-dev
4. Appeler `addTestMatches` ou `syncMatchesManual` pour peupler les matchs

## Pages

- **/** — Redirection vers login ou matchs
- **/login** — Connexion Google
- **/matchs** — Liste des matchs + formulaire de pronostic
- **/matchs/match?id=** — Pronostics d’un match (après début)
- **/pronostics** — Mes pronostics
- **/classement** — Classement global

## Règles de points

- Score exact : 3 pts
- Bonne différence : 2 pts
- Bon vainqueur : 1 pt
- Sinon : 0 pt

---

## Mode test — Matchs fictifs

Pour tester le calcul des scores sans attendre de vrais matchs Ligue 1, utilisez des matchs fictifs via les endpoints déployés.

### 1. Ajouter 5 matchs de test

```bash
# Dev
curl -X POST https://us-central1-pronoscore-dev.cloudfunctions.net/addTestMatches
```

```powershell
# PowerShell (Windows)
Invoke-WebRequest -Method POST -UseBasicParsing -Uri "https://us-central1-pronoscore-dev.cloudfunctions.net/addTestMatches"
```

Pour la prod, remplacez `pronoscore-dev` par `pronoscore-e143b`. Adaptez la région si nécessaire (ex. `europe-west1`).

Cela crée 5 matchs avec les IDs `test-1` à `test-5` :

| ID     | Match          |
|--------|----------------|
| test-1 | Equipe 1 vs Equipe 2 |
| test-2 | Equipe 3 vs Equipe 4 |
| test-3 | Equipe 5 vs Equipe 6 |
| test-4 | Equipe 7 vs Equipe 8 |
| test-5 | Equipe 9 vs Equipe 10 |

Ils apparaissent sur la page **/matchs** et les utilisateurs peuvent pronostiquer directement.

### 2. Modifier l’état ou le score d’un match

```bash
# Bash / Git Bash
# Passer un match en cours
curl -X POST https://us-central1-pronoscore-dev.cloudfunctions.net/updateTestMatch \
  -H "Content-Type: application/json" \
  -d '{"matchId": "test-1", "status": "IN_PLAY"}'

# Terminer un match avec un score
curl -X POST https://us-central1-pronoscore-dev.cloudfunctions.net/updateTestMatch \
  -H "Content-Type: application/json" \
  -d '{"matchId": "test-1", "status": "FINISHED", "homeScore": 2, "awayScore": 1}'

# Modifier uniquement le score (match déjà terminé)
curl -X POST https://us-central1-pronoscore-dev.cloudfunctions.net/updateTestMatch \
  -H "Content-Type: application/json" \
  -d '{"matchId": "test-1", "homeScore": 3, "awayScore": 0}'
```

```powershell
# PowerShell (Windows)
Invoke-WebRequest -Method POST -UseBasicParsing -Uri "https://us-central1-pronoscore-dev.cloudfunctions.net/updateTestMatch" -ContentType "application/json" -Body '{"matchId": "test-1", "status": "FINISHED", "homeScore": 2, "awayScore": 1}'
```

Paramètres possibles (tous optionnels sauf `matchId`) :

- `matchId` (string, requis) : ID du match (`test-1`, `test-2`, etc.)
- `status` : `SCHEDULED`, `TIMED`, `IN_PLAY`, `FINISHED`
- `homeScore` : score de l’équipe à domicile (nombre)
- `awayScore` : score de l’équipe extérieure (nombre)

### 3. Calculer les points des pronostics

Après avoir terminé un match, le calcul des points est automatique toutes les 30 minutes. Pour l’exécuter immédiatement :

```bash
curl -X POST https://us-central1-pronoscore-dev.cloudfunctions.net/calculateScoresManual
```

```powershell
Invoke-WebRequest -Method POST -UseBasicParsing -Uri "https://us-central1-pronoscore-dev.cloudfunctions.net/calculateScoresManual"
```

### Workflow de test complet

1. `addTestMatches` — créer les 5 matchs
2. Se connecter sur l’app, aller sur **/matchs**, faire des pronostics
3. `updateTestMatch` avec `status: "FINISHED"` et scores pour clôturer un match
4. `calculateScoresManual` — mettre à jour les points
5. Vérifier le classement sur **/classement**
