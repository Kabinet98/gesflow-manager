# Hermes et React Native DevTools

## Message : "No compatible apps connected, React Native DevTools can only be used with Hermes"

Ce message **n’est pas une erreur** et **Hermes n’a pas besoin d’être installé** : il est déjà activé dans le projet.

### Ce que ça signifie

- **Hermes** : moteur JavaScript utilisé par l’app (déjà activé dans `android/gradle.properties` et iOS).
- **React Native DevTools** : outil de debug (inspecteur, profiler, etc.) qui ne fonctionne qu’avec Hermes.
- Le message indique simplement qu’**aucune app en cours d’exécution n’est connectée à DevTools** au moment où DevTools s’ouvre.

### Que faire

1. **Si vous ne utilisez pas DevTools**  
   Vous pouvez ignorer le message. L’app tourne normalement avec Hermes.

2. **Si vous voulez utiliser DevTools**  
   - Lancez d’abord l’app en mode **debug** (development build) :
     - `yarn android` ou `yarn ios`
     - Puis `yarn start:dev` (ou `expo start --dev-client`)
   - Ouvrez l’app sur l’émulateur / appareil et laissez-la se connecter au serveur Metro.
   - Ensuite ouvrez React Native DevTools (menu dev dans l’app ou outil fourni par Expo).  
   Tant qu’une app Hermes est connectée au bundler, DevTools pourra s’y connecter.

### Vérifier qu’Hermes est bien utilisé

- **Android** : `android/gradle.properties` → `hermesEnabled=true`
- **iOS** : `ios/Podfile.properties.json` → `"expo.jsEngine": "hermes"`

Aucune installation supplémentaire n’est nécessaire pour Hermes.
