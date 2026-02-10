# Utiliser React Native DevTools

React Native DevTools permet de déboguer votre app (Console, Sources/breakpoints, Network, Memory, Components, Profiler). Il fonctionne avec **Hermes** (déjà activé dans ce projet).

## Configuration pour activer DevTools

Expo n’accepte les connexions au debugger qu’en **loopback** (même machine). Pour que DevTools détecte l’app, Metro doit écouter sur **localhost** et l’app doit tourner sur le **simulateur/émulateur** du même PC.

Utilisez le script dédié :

```bash
yarn start:dev:devtools
```

Ce script lance Metro avec :
- **`EXPO_DEBUG=1`** : active la redirection vers le navigateur pour DevTools et les logs détaillés ;
- **`--localhost`** : Metro écoute sur `http://127.0.0.1:8081`, ce qui permet au simulateur (même machine) de se connecter en loopback et d’être vu par DevTools.

Sans `--localhost`, Metro utilise l’IP LAN (ex. 172.20.10.7) et les connexions du debugger sont rejetées → « No compatible apps connected ».

## Étapes pour ouvrir DevTools

### 1. Démarrer Metro en mode DevTools (localhost)

Dans un terminal :

```bash
yarn start:dev:devtools
```

Cela lance Metro sur **http://127.0.0.1:8081** avec EXPO_DEBUG. Ne fermez pas ce terminal.

### 2. Lancer l’app sur le simulateur iOS (recommandé pour DevTools)

Dans le **même** terminal Metro, appuyez sur **`i`** pour ouvrir le simulateur iOS,  
**ou** dans un autre terminal :

```bash
yarn ios
```

Important : pour que DevTools détecte l’app, elle doit tourner sur le **simulateur iOS** (même Mac). Sur un appareil physique ou en WiFi, la connexion au debugger ne fonctionne pas (restriction loopback d’Expo).

Attendez que l’app soit ouverte et que le bundle soit chargé (écran d’accueil visible).

### 3. Ouvrir React Native DevTools

**Option A – Depuis le terminal Metro**  
Dans le terminal où tourne `yarn start:dev`, appuyez sur la touche **`j`**.  
Une fenêtre DevTools (Chrome/Edge) s’ouvre et se connecte à l’app.

**Option B – Depuis le menu développeur dans l’app**

- **Android** : `Ctrl+M` (ou `Cmd+M` sur Mac) ou secouer l’appareil  
  Ou en USB : `adb shell input keyevent 82`
- **iOS Simulator** : `Ctrl+Cmd+Z` ou `Cmd+D`  
- **iOS appareil** : secouer l’appareil

Dans le menu qui s’affiche, choisir **« Open JS debugger »** (ou équivalent pour ouvrir le debugger).

## Si vous voyez « No compatible apps connected »

Cela signifie qu’aucune app n’est encore reconnue par DevTools. Essayez dans cet ordre :

### 1. Ordre de démarrage

1. **Démarrer Metro en premier** : `yarn start:dev` (garder le terminal ouvert).
2. **Lancer l’app** : `yarn android` ou `yarn ios` dans un autre terminal.
3. **Attendre** que l’app soit ouverte et que le bundle soit chargé (écran d’accueil visible).
4. **Ensuite seulement** appuyer sur **`j`** dans le terminal Metro.

### 2. Workaround Expo (si ça ne connecte toujours pas)

1. Une fois l’app ouverte et connectée à Metro, aller sur **l’écran d’accueil** (Home) de l’app.
2. Revenir au terminal Metro et appuyer sur **`j`** pour ouvrir DevTools.
3. Si besoin : dans l’app, ouvrir le **menu développeur** (secouer l’appareil ou `Ctrl+M` / `Cmd+D`) → **Reload** → attendre le rechargement → réessayer **`j`**.

### 3. Vérifications

- L’app doit être un **development build** (pas Expo Go si vous utilisez des modules natifs type `expo-dev-client`).
- Hermes est activé dans le projet (`app.config.js` : `jsEngine: "hermes"`, `android/gradle.properties` : `hermesEnabled=true`).
- Aucun autre outil n’utilise le port **8081** (un seul serveur Metro).
- Sur **Android** : si vous êtes en WiFi, l’app et le PC doivent être sur le même réseau ; en USB, pas de souci.
- **Connexion DevTools** : Expo limite les connexions au debugger en « loopback » (même machine). DevTools se connecte donc plus facilement quand l’app tourne sur un **simulateur/émulateur sur le même PC** (ex. iOS Simulator). Sur un **appareil physique en WiFi**, la connexion peut échouer ; dans ce cas, privilégier l’émulateur ou le câble USB pour le débogage.

## Raccourcis utiles dans le terminal Metro

- **`j`** : Ouvrir React Native DevTools  
- **`m`** : Ouvrir le menu développeur sur l’appareil/émulateur  
- **`r`** : Recharger l’app  

## Fonctionnalités de DevTools

- **Console** : logs, exécution de JS, filtres  
- **Sources** : fichiers sources, breakpoints, `debugger;`  
- **Network** : requêtes (Expo : onglet dédié Expo Network)  
- **Memory** : heap snapshots, usage mémoire JS  
- **Components** : arbre React, props, state  
- **Profiler** : performances JS, re-renders  

## Erreur « WebSocket connection to debugger-proxy failed »

Si vous voyez dans la console du navigateur :

```
WebSocket connection to 'ws://localhost:8081/debugger-proxy?role=debugger&name=Chrome' failed
```

C’est l’**ancien** débogueur (Remote JS / « Debug with Chrome »), qui n’est plus supporté depuis React Native 0.76.

À faire :

1. **Ne pas** utiliser « Open JS Debugger » ou « Debug with Chrome » depuis le **menu développeur dans l’app** (secouer l’appareil ou Ctrl+M / Cmd+D). Ce menu ouvre encore l’ancien debugger qui utilise `debugger-proxy`.
2. **Fermer** l’onglet Chrome qui affiche cette erreur.
3. **Ouvrir DevTools uniquement** en appuyant sur **`j`** dans le **terminal Metro** (où tourne `yarn start:dev:devtools`). C’est la seule méthode qui ouvre le nouveau React Native DevTools (CDP, `/inspector/debug`).
4. Vérifier que l’app est lancée sur le **simulateur iOS** et connectée à Metro avant d’appuyer sur **`j`**.

Le nouveau DevTools utilise `/inspector/debug`, pas `/debugger-proxy`.

## Références

- [React Native DevTools (doc officielle)](https://reactnative.dev/docs/react-native-devtools)
- [Expo – Debugging and profiling tools](https://docs.expo.dev/debugging/tools/)
