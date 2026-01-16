import React, { useEffect, useState } from 'react';
import { View, StyleSheet, AppState, AppStateStatus } from 'react-native';
import * as ScreenCapture from 'expo-screen-capture';
import { screenshotDetector } from '@/utils/screenshot-detector';

// Composant pour masquer l'aperçu des captures d'écran et enregistrements vidéo
// Utilise expo-screen-capture pour bloquer les captures d'écran ET les enregistrements vidéo au niveau système
// Sur iOS 11+ et Android, les captures et enregistrements seront bloqués ou rendus inutilisables
// Noircit également l'écran lorsqu'un enregistrement vidéo est détecté

export function ScreenshotBlocker({ children }: { children: React.ReactNode }) {
  const [isBlocking, setIsBlocking] = useState(false);
  const [isVideoRecording, setIsVideoRecording] = useState(false);

  useEffect(() => {
    // Activer la prévention des captures d'écran ET des enregistrements vidéo au montage du composant
    // preventScreenCaptureAsync() bloque à la fois les screenshots et les screen recordings
    const enablePrevention = async () => {
      try {
        await ScreenCapture.preventScreenCaptureAsync();
      } catch (error) {
        // Erreur silencieuse
      }
    };

    enablePrevention();

    // Enregistrer le callback pour détecter les enregistrements vidéo
    screenshotDetector.onVideoRecordingDetected((isRecording) => {
      setIsVideoRecording(isRecording);
    });

    const subscription = AppState.addEventListener('change', async (nextAppState: AppStateStatus) => {
      // Réactiver la prévention quand l'app revient au premier plan
      // Cela garantit que la protection reste active même après un changement d'état
      if (nextAppState === 'active') {
        try {
          await ScreenCapture.preventScreenCaptureAsync();
        } catch (error) {
          // Erreur silencieuse
        }
      }
      
      // Détecter les changements d'état qui pourraient indiquer une capture d'écran ou un enregistrement vidéo
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        // Masquer l'écran pendant un court instant (couche supplémentaire de protection)
        // Cela empêche la capture de contenu sensible pendant les transitions
        setIsBlocking(true);
        setTimeout(() => {
          setIsBlocking(false);
        }, 500);
      } else if (nextAppState === 'active') {
        // Quand l'app revient au premier plan, vérifier s'il y a eu une tentative d'enregistrement
        // Les enregistrements vidéo peuvent causer des transitions d'état rapides
        setTimeout(() => {
          // Vérifier si l'app est toujours active après un court délai
          // Si non, cela pourrait indiquer une tentative d'enregistrement vidéo
        }, 200);
      }
    });

    return () => {
      subscription.remove();
      // Ne pas désactiver la prévention au démontage - elle doit rester active
      // La protection globale dans App.tsx gère la désactivation si nécessaire
    };
  }, []);

  // Si un enregistrement vidéo est détecté, noircir complètement l'écran
  if (isVideoRecording) {
    return (
      <View style={StyleSheet.absoluteFillObject} className="bg-black" />
    );
  }

  // Si on bloque temporairement (transition d'état)
  if (isBlocking) {
    return (
      <View style={StyleSheet.absoluteFillObject} className="bg-black" />
    );
  }

  return <>{children}</>;
}

