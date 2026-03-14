# PronoScore Mobile

Application mobile PronoScore (Expo + React Native).

## Démarrage

```bash
# Depuis la racine du monorepo
npm run dev:mobile

# Ou depuis apps/mobile
npm start
```

## Connexion Google

La connexion Google utilise `@react-native-google-signin/google-signin` et **ne fonctionne pas dans Expo Go** (code natif requis). Utilisez un development build :

```bash
# Préparer le projet natif
npx expo prebuild --clean

# Lancer sur Android
npx expo run:android

# Lancer sur iOS (macOS requis)
npx expo run:ios
```

### Configuration Firebase / Google

1. **Variables d'environnement** : Copiez `.env.example` en `.env` et renseignez les valeurs (identiques à `apps/web/.env.local` pour Firebase).

2. **Google Web Client ID** : Pour la connexion Google, ajoutez dans `.env` :
   ```
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=votre-client-id.apps.googleusercontent.com
   ```
   Récupérez-le dans Firebase Console > Authentication > Sign-in method > Google > Web SDK configuration.

3. **Fichiers natifs** (pour Android/iOS) : Téléchargez depuis Firebase Console :
   - `google-services.json` → placez dans `apps/mobile/`
   - `GoogleService-Info.plist` → placez dans `apps/mobile/`
   
   Puis ajoutez les chemins dans `app.config.js` :
   ```js
   android: {
     googleServicesFile: "./google-services.json",
     // ...
   },
   ios: {
     googleServicesFile: "./GoogleService-Info.plist",
     // ...
   },
   ```

## Partage du code

L'app mobile utilise `@pronoscore/shared` pour toute la logique métier :
- Firebase (auth, Firestore)
- Requêtes (matchs, pronostics, ligues, classement)
- Calcul des points
- Types TypeScript

Seuls les composants UI sont spécifiques à React Native.
