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
