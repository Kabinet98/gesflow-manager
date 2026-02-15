import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform, Linking, Alert } from 'react-native';
import Constants from 'expo-constants';
import api from '@/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { navigate } from '@/utils/navigation';

// Configuration des notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export interface PushNotificationToken {
  token: string;
  deviceId: string;
  platform: 'ios' | 'android';
}

const STORAGE_KEYS = {
  PUSH_TOKEN: 'push_token',
  DEVICE_ID: 'device_id',
  TOKEN_REGISTERED_AT: 'push_token_registered_at',
  PERMISSION_DENIED: 'push_permission_denied',
} as const;

/** Durée minimale entre deux enregistrements de token (1 heure). */
const REGISTER_COOLDOWN_MS = 60 * 60 * 1000;
/** Durée avant revalidation du token (7 jours). */
const TOKEN_REVALIDATION_MS = 7 * 24 * 60 * 60 * 1000;
/** Nombre max de tentatives de retry. */
const MAX_RETRIES = 3;

/** Délai exponentiel : 2s, 4s, 8s */
function retryDelay(attempt: number): number {
  return Math.min(2000 * Math.pow(2, attempt), 8000);
}

class NotificationsService {
  private token: string | null = null;
  private deviceId: string | null = null;
  private isRegistered = false;

  /**
   * Initialise le service de notifications
   */
  async initialize(): Promise<void> {
    try {
      if (!Device.isDevice) {
        return;
      }

      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        // Vérifier si l'utilisateur a déjà refusé
        const wasDenied = await AsyncStorage.getItem(STORAGE_KEYS.PERMISSION_DENIED);

        if (wasDenied === 'true') {
          // Déjà refusé auparavant — proposer d'ouvrir les réglages
          this.promptOpenSettings();
          return;
        }

        const permissionRequest = Platform.OS === 'ios'
          ? {
              ios: {
                allowAlert: true,
                allowBadge: true,
                allowSound: true,
                allowAnnouncements: false,
              },
            }
          : {};

        const { status } = await Notifications.requestPermissionsAsync(permissionRequest);
        finalStatus = status;

        if (finalStatus !== 'granted') {
          await AsyncStorage.setItem(STORAGE_KEYS.PERMISSION_DENIED, 'true');
          return;
        }

        // Permission accordée — réinitialiser le flag
        await AsyncStorage.removeItem(STORAGE_KEYS.PERMISSION_DENIED);
      }

      // Configurer le canal de notification Android
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('gesflow-notifications', {
          name: 'GesFlow Notifications',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#0ea5e9',
          sound: 'default',
          showBadge: true,
        });
      }

      // Obtenir le token (avec revalidation si nécessaire)
      const tokenData = await this.getPushToken();
      if (tokenData) {
        await this.registerTokenWithRetry(tokenData);
      }

      // Configurer les listeners
      this.setupNotificationListeners();

      // Gérer le cas où l'app a été ouverte via un tap sur une notification (app killed)
      const lastResponse = await Notifications.getLastNotificationResponseAsync();
      if (lastResponse) {
        const data = lastResponse.notification.request.content.data;
        const type = data?.type as string | undefined;
        if (type) {
          const screen = this.getScreenForNotificationType(type);
          if (screen) {
            setTimeout(() => navigate(screen), 500);
          }
        }
      }
    } catch (error) {
      console.error('[Notifications] Échec initialisation', error);
    }
  }

  /**
   * Obtient le token de push notification, avec revalidation périodique.
   */
  async getPushToken(): Promise<PushNotificationToken | null> {
    try {
      if (!Device.isDevice) {
        return null;
      }

      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      // Vérifier si le token stocké doit être revalidé
      const shouldRevalidate = await this.shouldRevalidateToken();

      // Si on a un token en mémoire et pas besoin de revalider, le retourner
      if (this.token && this.deviceId && !shouldRevalidate) {
        return {
          token: this.token,
          deviceId: this.deviceId,
          platform: Platform.OS as 'ios' | 'android',
        };
      }

      const projectId =
        Constants.expoConfig?.extra?.eas?.projectId ||
        Constants.easConfig?.projectId ||
        Constants.expoConfig?.extra?.projectId;

      if (!projectId && Platform.OS === 'ios') {
        console.error('[Notifications] Project ID manquant');
        return null;
      }

      const token = await Notifications.getExpoPushTokenAsync({
        projectId: projectId || undefined,
      });

      if (!token || !token.data) {
        return null;
      }

      // Obtenir ou créer un device ID
      let deviceId = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
      if (!deviceId) {
        deviceId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, deviceId);
      }

      this.token = token.data;
      this.deviceId = deviceId;

      return {
        token: token.data,
        deviceId,
        platform: Platform.OS as 'ios' | 'android',
      };
    } catch (error) {
      console.error('[Notifications] Échec obtention token', error);
      return null;
    }
  }

  /**
   * Enregistre le token sur le serveur avec retry exponentiel.
   */
  async registerTokenWithRetry(tokenData: PushNotificationToken): Promise<void> {
    // Vérifier le cooldown pour éviter le spam
    if (await this.isWithinCooldown(tokenData.token)) {
      return;
    }

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await api.post('/api/notifications/register', {
          token: tokenData.token,
          deviceId: tokenData.deviceId,
          platform: tokenData.platform,
        });

        await AsyncStorage.setItem(STORAGE_KEYS.PUSH_TOKEN, tokenData.token);
        await AsyncStorage.setItem(STORAGE_KEYS.TOKEN_REGISTERED_AT, Date.now().toString());
        this.isRegistered = true;
        return;
      } catch (error: any) {
        console.error(`[Notifications] Échec enregistrement (${attempt + 1}/${MAX_RETRIES})`, error?.response?.status, error?.message);
        if (attempt < MAX_RETRIES - 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelay(attempt)));
        }
      }
    }

    console.error(`[Notifications] Enregistrement abandonné après ${MAX_RETRIES} tentatives`);
  }

  /**
   * Configure les listeners de notifications
   */
  private setupNotificationListeners(): void {
    Notifications.addNotificationReceivedListener(() => {});

    Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data;
      const type = data?.type as string | undefined;
      if (!type) return;

      const screen = this.getScreenForNotificationType(type);
      if (screen) {
        navigate(screen);
      }
    });
  }

  private getScreenForNotificationType(type: string): string | null {
    switch (type) {
      case 'expense_approved':
      case 'expense_rejected':
      case 'expense_pending':
      case 'pending_expenses':
        return 'Expenses';
      case 'dat_maturity_soon':
        return 'Dat';
      case 'installment_due_today':
        return 'Loans';
      case 'manager_balance_low':
        return 'Companies';
      case 'screenshot_detected':
      case 'video_recording_detected':
        return 'Logs';
      case 'net_balance_low':
        return 'Dashboard';
      default:
        return null;
    }
  }

  /**
   * Supprime le token du serveur (lors de la déconnexion)
   */
  async unregisterToken(): Promise<void> {
    try {
      const deviceId = this.deviceId || await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
      if (!deviceId) {
        return;
      }

      await api.post('/api/notifications/unregister', { deviceId });

      await AsyncStorage.removeItem(STORAGE_KEYS.PUSH_TOKEN);
      await AsyncStorage.removeItem(STORAGE_KEYS.TOKEN_REGISTERED_AT);
      this.token = null;
      this.deviceId = null;
      this.isRegistered = false;
    } catch (error) {
      console.error('[Notifications] Échec désinscription token', error);
    }
  }

  getToken(): string | null {
    return this.token;
  }

  isInitialized(): boolean {
    return this.isRegistered;
  }

  /** Vérifie si le token doit être revalidé (> 7 jours). */
  private async shouldRevalidateToken(): Promise<boolean> {
    try {
      const registeredAt = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN_REGISTERED_AT);
      if (!registeredAt) return true;
      return Date.now() - parseInt(registeredAt, 10) > TOKEN_REVALIDATION_MS;
    } catch {
      return true;
    }
  }

  /** Vérifie si on est dans le cooldown d'enregistrement (< 1h et même token). */
  private async isWithinCooldown(newToken: string): Promise<boolean> {
    try {
      const storedToken = await AsyncStorage.getItem(STORAGE_KEYS.PUSH_TOKEN);
      if (storedToken !== newToken) return false;
      if (this.isRegistered) return true;

      const registeredAt = await AsyncStorage.getItem(STORAGE_KEYS.TOKEN_REGISTERED_AT);
      if (!registeredAt) return false;
      return Date.now() - parseInt(registeredAt, 10) < REGISTER_COOLDOWN_MS;
    } catch {
      return false;
    }
  }

  /** Propose à l'utilisateur d'ouvrir les réglages pour activer les notifications. */
  private promptOpenSettings(): void {
    Alert.alert(
      'Notifications désactivées',
      'Activez les notifications dans les réglages pour recevoir les alertes importantes.',
      [
        { text: 'Plus tard', style: 'cancel' },
        {
          text: 'Ouvrir Réglages',
          onPress: () => {
            if (Platform.OS === 'ios') {
              Linking.openURL('app-settings:');
            } else {
              Linking.openSettings();
            }
          },
        },
      ]
    );
  }
}

export const notificationsService = new NotificationsService();
