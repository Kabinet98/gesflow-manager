import React, { useEffect } from "react";
import { StatusBar, AppState, AppStateStatus, View, Platform } from "react-native";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ThemeProvider, useTheme } from "@/contexts/ThemeContext";
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

/** StatusBar toujours visible et adaptée au thème (heure, batterie lisibles en dark/light). */
function StatusBarThemed() {
  const { isDark } = useTheme();
  return (
    <StatusBar
      barStyle={isDark ? "light-content" : "dark-content"}
      backgroundColor={isDark ? "#0f172a" : "#ffffff"}
      translucent={Platform.OS === "android"}
    />
  );
}

export default function App() {
  const [appState, setAppState] = React.useState<AppStateStatus>(
    AppState.currentState
  );
  const [isVideoRecording, setIsVideoRecording] = React.useState(false);

  // Effet unique au montage : screenshot detector, auth listener, init notifications
  useEffect(() => {
    screenshotDetector.init();
    screenshotDetector.onVideoRecordingDetected((isRecording) => {
      setIsVideoRecording(isRecording);
    });

    const initNotifications = async () => {
      const isAuthenticated = await authService.isAuthenticated();
      if (isAuthenticated) {
        await notificationsService.initialize();
      }
    };

    initNotifications();

    const handleAuthChange = async (authenticated: boolean) => {
      if (authenticated) {
        await notificationsService.initialize();
      } else {
        await notificationsService.unregisterToken();
      }
    };

    authEventEmitter.on('auth-changed', handleAuthChange);

    return () => {
      screenshotDetector.destroy();
      authEventEmitter.off('auth-changed', handleAuthChange);
    };
  }, []);

  // Effet séparé pour le retour au premier plan (dépend de appState pour avoir le bon closure)
  useEffect(() => {
    const initNotificationsOnForeground = async () => {
      const isAuthenticated = await authService.isAuthenticated();
      if (isAuthenticated) {
        await notificationsService.initialize();
      }
    };

    const subscription = AppState.addEventListener("change", (nextAppState) => {
      if (appState.match(/inactive|background/) && nextAppState === "active") {
        screenshotDetector.init();
        initNotificationsOnForeground();
      }
      setAppState(nextAppState);
    });

    return () => {
      subscription.remove();
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
              {isVideoRecording ? (
                <View style={{ flex: 1, backgroundColor: '#000000', justifyContent: 'center', alignItems: 'center' }}>
                  <StatusBar barStyle="light-content" backgroundColor="#000000" />
                </View>
              ) : (
                <>
                  <StatusBarThemed />
                  <AppNavigator />
                </>
              )}
            </AmountVisibilityProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </GestureHandlerRootView>
    </SafeAreaProvider>
  );
}
