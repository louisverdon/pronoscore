# Document technique — POC Application Web de Pronostics Ligue 1

## 1. Contexte du projet

L'objectif est de développer un Proof of Concept (POC) d'une application web permettant à un groupe d'amis d'enregistrer leurs pronostics sur les matchs de Ligue 1.

L'application doit être simple, rapide à développer et facilement évolutive.

### Contraintes

- 100 utilisateurs maximum
- accès privé (amis uniquement)
- authentification Google
- récupération automatique des matchs via l'API football-data.org
- pronostics cachés jusqu'au début du match
- classement automatique basé sur les résultats

Le projet privilégie la rapidité de développement plutôt que la complexité technique.

## 2. Stack technique

- **Frontend** : Next.js, React, Tailwind CSS
- **Backend** : Firebase (Auth, Firestore, Functions, Hosting)

## 3. Architecture

```
Utilisateur → Frontend (Next.js) → Firebase Auth → Firestore → Cloud Functions → Football Data API
```

## 4. Modèle de données

- **users** : uid, name, email, avatar, created_at
- **teams** : id, name, crest
- **matches** : id, homeTeam, awayTeam, matchDate, status, homeScore, awayScore
- **predictions** : userId, matchId, homeScore, awayScore, points, created_at

## 5. Règles des pronostics

- Un seul pronostic par utilisateur par match
- Modifiable jusqu'au début du match
- Visibilité : cachés jusqu'au début du match
- Points : score exact = 3, bonne diff = 2, bon vainqueur = 1, sinon = 0

## 6. Automatisation

- **syncMatches** : toutes les 3 h (API football-data.org)
- **calculateScores** : toutes les 30 min (calcul des points)
- **syncMatchesManual** : endpoint HTTP pour sync manuel
