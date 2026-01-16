import React, { useEffect } from "react";
import { StatusBar, AppState, AppStateStatus, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AmountVisibilityProvider } from "@/contexts/AmountVisibilityContext";
import { AppNavigator } from "@/navigation/AppNavigator";
import { screenshotDetector } from "@/utils/screenshot-detector";
import { notificationsService } from "@/services/notifications.service";
import { authService } from "@/services/auth.service";
import "@/styles/global.css";

// Désactiver le mode strict de Reanimated pour éviter les avertissements
// lors de l'utilisation de Animated.Value de React Native
try {
  const Reanimated = require('react-native-reanimated');
  if (Reanimated && Reanimated.configureReanimatedLogger) {
    Reanimated.configureReanimatedLogger({
      strict: false,
    });
  }
} catch (e) {
  // Reanimated n'est pas disponible ou la méthode n'existe pas
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

export default function App() {
  const [appState, setAppState] = React.useState<AppStateStatus>(
    AppState.currentState
  );
  const [isVideoRecording, setIsVideoRecording] = React.useState(false);

  useEffect(() => {
    // Initialiser la détection de captures d'écran
    screenshotDetector.init();
    
    // Enregistrer le callback pour détecter les enregistrements vidéo
    screenshotDetector.onVideoRecordingDetected((isRecording) => {
      setIsVideoRecording(isRecording);
    });

    // Fonction pour initialiser les notifications
    const initNotifications = async () => {
      const isAuthenticated = await authService.isAuthenticated();
      if (isAuthenticated) {
        await notificationsService.initialize();
      }
    };

    // Initialiser les notifications au démarrage
    initNotifications();

    // Écouter les changements d'authentification pour réinitialiser les notifications
    const handleAuthChange = async (authenticated: boolean) => {
      if (authenticated) {
        // Réinitialiser les notifications après la connexion
        await notificationsService.initialize();
      } else {
        // Supprimer le token lors de la déconnexion
        await notificationsService.unregisterToken();
      }
    };

    // Écouter les événements d'authentification
    const { authEventEmitter } = require('@/config/api');
    authEventEmitter.on('auth-changed', handleAuthChange);

    // Écouter les changements d'état de l'application
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (appState.match(/inactive|background/) && nextAppState === "active") {
        // L'application revient au premier plan
        // Réactiver la protection contre les captures et enregistrements vidéo
        screenshotDetector.init();
        // Vérifier si une capture d'écran ou un enregistrement vidéo a été effectué
        // On log les deux types de tentatives pour être exhaustif
        screenshotDetector.logCapture("app_state_change_to_active", {
          type: 'suspected_capture',
        });
        // Réinitialiser les notifications au cas où elles auraient été perdues
        initNotifications();
      }
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
      screenshotDetector.destroy();
      const { authEventEmitter } = require('@/config/api');
      authEventEmitter.off('auth-changed', handleAuthChange);
      // Supprimer le token de notification lors de la déconnexion
      notificationsService.unregisterToken();
    };
  }, [appState]);

  return (
    <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AmountVisibilityProvider>
              <StatusBar barStyle="default" />
              {isVideoRecording ? (
                <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
                  <StatusBar barStyle="light-content" backgroundColor="#000000" />
                </View>
              ) : (
                <AppNavigator />
              )}
            </AmountVisibilityProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
