import React, { useEffect } from "react";
import { StatusBar, AppState, AppStateStatus, View } from "react-native";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AmountVisibilityProvider } from "@/contexts/AmountVisibilityContext";
import { AppNavigator } from "@/navigation/AppNavigator";
import { setAuditLogsInvalidator } from "@/services/audit.service";
import { screenshotDetector } from "@/utils/screenshot-detector";
import { notificationsService } from "@/services/notifications.service";
import { authService } from "@/services/auth.service";
import { authEventEmitter } from "@/config/api";
import api from "@/config/api";
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
      staleTime: 0,
      refetchOnWindowFocus: false,
    },
  },
});

function AuditLogsInvalidatorSetup() {
  const client = useQueryClient();
  useEffect(() => {
    setAuditLogsInvalidator(() =>
      client.invalidateQueries({ queryKey: ["logs"] })
    );
    return () => setAuditLogsInvalidator(() => {});
  }, [client]);
  return null;
}

/** Précharge le compteur de dépenses en attente à la connexion et le rafraîchit au retour au premier plan. */
function PendingCountRefetchOnActive() {
  const queryClient = useQueryClient();
  const pendingCountQueryFn = async () => {
    try {
      const response = await api.get("/api/expenses/pending-count");
      return response.data;
    } catch {
      return { count: 0 };
    }
  };

  useEffect(() => {
    const onAuthChanged = (authenticated: boolean) => {
      if (authenticated) {
        queryClient.prefetchQuery({
          queryKey: ["expenses-pending-count"],
          queryFn: pendingCountQueryFn,
        });
      }
    };
    authEventEmitter.on("auth-changed", onAuthChanged);
    if (AppState.currentState === "active") {
      queryClient.invalidateQueries({ queryKey: ["expenses-pending-count"] });
    }
    const sub = AppState.addEventListener("change", (nextAppState) => {
      if (nextAppState === "active") {
        queryClient.invalidateQueries({ queryKey: ["expenses-pending-count"] });
      }
    });
    return () => {
      authEventEmitter.off("auth-changed", onAuthChanged);
      sub.remove();
    };
  }, [queryClient]);

  return null;
}

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
    authEventEmitter.on('auth-changed', handleAuthChange);

    // Écouter les changements d'état de l'application
    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (appState.match(/inactive|background/) && nextAppState === "active") {
        // L'application revient au premier plan : réactiver la protection uniquement
        // Ne pas logger de "suspected_capture" ici : cela créait des faux positifs (chaque retour = fausse alerte screenshot)
        screenshotDetector.init();
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
          <AuditLogsInvalidatorSetup />
          <PendingCountRefetchOnActive />
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
