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
4. Copiez `.env.example` vers `.env.local` et remplissez les variables :

```
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
```

### 3. Clé API football-data.org

1. Créez un compte sur [football-data.org](https://www.football-data.org/)
2. Récupérez votre token API
3. Pour les Cloud Functions, configurez la variable :

```bash
firebase functions:config:set football.api_key="VOTRE_CLE_API"
```

Ou utilisez les secrets Firebase (recommandé) :

```bash
firebase functions:secrets:set FOOTBALL_API_KEY
```

Puis dans `functions/src/index.ts`, remplacez `process.env.FOOTBALL_API_KEY` par l’accès au secret si nécessaire.

### 4. Déploiement Firestore Rules

```bash
firebase deploy --only firestore
```

### 5. Premier sync des matchs

Les Cloud Functions sync les matchs toutes les 3 h. Pour un premier sync immédiat, déployez les functions puis appelez :

```bash
# Après déploiement des functions
curl -X POST https://REGION-PROJECT_ID.cloudfunctions.net/syncMatchesManual
```

## Développement

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

## Build & Déploiement

```bash
npm run build
firebase deploy
```

Le build Next.js génère le dossier `out/`, servi par Firebase Hosting.

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

Pour tester le calcul des scores sans attendre de vrais matchs Ligue 1, vous pouvez utiliser des matchs fictifs entre « Equipe 1 » et « Equipe 2 », etc.

### Prérequis

- Firebase Functions déployées ou émulateur actif
- URL de base : production = `https://REGION-PROJECT_ID.cloudfunctions.net`, émulateur = `http://localhost:5001/PROJECT_ID/REGION`

### 1. Ajouter 5 matchs de test

```bash
# Bash / Git Bash
curl -X POST https://REGION-PROJECT_ID.cloudfunctions.net/addTestMatches
```

```powershell
# PowerShell (Windows)
Invoke-WebRequest -Method POST -Uri "https://REGION-PROJECT_ID.cloudfunctions.net/addTestMatches"
```

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
curl -X POST https://REGION-PROJECT_ID.cloudfunctions.net/updateTestMatch \
  -H "Content-Type: application/json" \
  -d '{"matchId": "test-1", "status": "IN_PLAY"}'

# Terminer un match avec un score
curl -X POST https://REGION-PROJECT_ID.cloudfunctions.net/updateTestMatch \
  -H "Content-Type: application/json" \
  -d '{"matchId": "test-1", "status": "FINISHED", "homeScore": 2, "awayScore": 1}'

# Modifier uniquement le score (match déjà terminé)
curl -X POST https://REGION-PROJECT_ID.cloudfunctions.net/updateTestMatch \
  -H "Content-Type: application/json" \
  -d '{"matchId": "test-1", "homeScore": 3, "awayScore": 0}'
```

```powershell
# PowerShell (Windows)
Invoke-WebRequest -Method POST -Uri "https://REGION-PROJECT_ID.cloudfunctions.net/updateTestMatch" -ContentType "application/json" -Body '{"matchId": "test-1", "status": "FINISHED", "homeScore": 2, "awayScore": 1}'
```

Paramètres possibles (tous optionnels sauf `matchId`) :

- `matchId` (string, requis) : ID du match (`test-1`, `test-2`, etc.)
- `status` : `SCHEDULED`, `TIMED`, `IN_PLAY`, `FINISHED`
- `homeScore` : score de l’équipe à domicile (nombre)
- `awayScore` : score de l’équipe extérieure (nombre)

### 3. Calculer les points des pronostics

Après avoir terminé un match, le calcul des points est automatique toutes les 30 minutes. Pour l’exécuter immédiatement :

```bash
# Bash / Git Bash
curl -X POST https://REGION-PROJECT_ID.cloudfunctions.net/calculateScoresManual
```

```powershell
# PowerShell (Windows)
Invoke-WebRequest -Method POST -Uri "https://REGION-PROJECT_ID.cloudfunctions.net/calculateScoresManual"
```

### Workflow de test complet

1. `addTestMatches` — créer les 5 matchs
2. Se connecter sur l’app, aller sur **/matchs**, faire des pronostics
3. `updateTestMatch` avec `status: "FINISHED"` et scores pour clôturer un match
4. `calculateScoresManual` — mettre à jour les points
5. Vérifier le classement sur **/classement**
