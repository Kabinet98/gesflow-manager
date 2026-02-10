import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import api from '@/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Configuration des notifications
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export interface PushNotificationToken {
  token: string;
  deviceId: string;
  platform: 'ios' | 'android';
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
      // Vérifier si on est sur un appareil physique
      if (!Device.isDevice) {
        return;
      }

      // Demander les permissions (iOS et Android)
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== 'granted') {
        // Pour iOS, demander les permissions avec les options appropriées
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
      }

      if (finalStatus !== 'granted') {
        return;
      }

      // Configurer le canal de notification Android (doit être fait avant d'obtenir le token)
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

      // Obtenir le token
      const tokenData = await this.getPushToken();
      if (tokenData) {
        await this.registerToken(tokenData);
      }

      // Configurer les listeners
      this.setupNotificationListeners();
    } catch (error: any) {
      // Erreur silencieuse
    }
  }

  /**
   * Obtient le token de push notification
   */
  async getPushToken(): Promise<PushNotificationToken | null> {
    try {
      if (!Device.isDevice) {
        return null;
      }

      // Vérifier les permissions
      const { status } = await Notifications.getPermissionsAsync();
      if (status !== 'granted') {
        return null;
      }

      // Obtenir le token Expo
      // Pour iOS, le Project ID est essentiel pour les notifications push.
      // En prod (EAS Build), projectId est fourni par app.config.js → extra.eas.projectId.
      const projectId = 
        Constants.expoConfig?.extra?.eas?.projectId || 
        Constants.easConfig?.projectId ||
        Constants.expoConfig?.extra?.projectId;
      
      if (!projectId) {
        // Pour iOS, on ne peut pas continuer sans Project ID
        if (Platform.OS === 'ios') {
          return null;
        }
      }
      
      try {
        const token = await Notifications.getExpoPushTokenAsync({
          projectId: projectId || undefined,
        });
        
        if (!token || !token.data) {
          return null;
        }
        
        // Obtenir ou créer un device ID
        let deviceId = await AsyncStorage.getItem('device_id');
        if (!deviceId) {
          deviceId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          await AsyncStorage.setItem('device_id', deviceId);
        }

        this.token = token.data;
        this.deviceId = deviceId;

        return {
          token: token.data,
          deviceId,
          platform: Platform.OS as 'ios' | 'android',
        };
      } catch (error: any) {
        return null;
      }
    } catch (error: any) {
      return null;
    }
  }

  /**
   * Enregistre le token sur le serveur
   */
  async registerToken(tokenData: PushNotificationToken): Promise<void> {
    try {
      const storedToken = await AsyncStorage.getItem('push_token');
      if (storedToken === tokenData.token && this.isRegistered) {
        // Token déjà enregistré
        return;
      }

      await api.post('/api/notifications/register', {
        token: tokenData.token,
        deviceId: tokenData.deviceId,
        platform: tokenData.platform,
      });

      await AsyncStorage.setItem('push_token', tokenData.token);
      this.isRegistered = true;
    } catch (error: any) {
      // Erreur silencieuse
    }
  }

  /**
   * Configure les listeners de notifications
   */
  private setupNotificationListeners(): void {
    // Notification reçue en foreground
    Notifications.addNotificationReceivedListener((notification) => {
      // Notification reçue
    });

    // Notification tapée par l'utilisateur
    Notifications.addNotificationResponseReceivedListener((response) => {
      const notification = response.notification;

      // Ici, vous pouvez naviguer vers un écran spécifique basé sur les données
      // Par exemple: navigation.navigate('Expenses') si c'est une notification de dépense
    });
  }

  /**
   * Supprime le token du serveur (lors de la déconnexion)
   */
  async unregisterToken(): Promise<void> {
    try {
      if (!this.deviceId) {
        return;
      }

      await api.post('/api/notifications/unregister', {
        deviceId: this.deviceId,
      });

      await AsyncStorage.removeItem('push_token');
      this.token = null;
      this.deviceId = null;
      this.isRegistered = false;
    } catch (error: any) {
      // Erreur silencieuse
    }
  }

  /**
   * Obtient le token actuel
   */
  getToken(): string | null {
    return this.token;
  }

  /**
   * Vérifie si le service est initialisé
   */
  isInitialized(): boolean {
    return this.isRegistered;
  }
}

// Créer une instance singleton
export const notificationsService = new NotificationsService();
