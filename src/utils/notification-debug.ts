/**
 * Utilitaires de débogage pour les notifications push
 */

import { notificationsService } from '@/services/notifications.service';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from '@/config/api';

export async function debugNotifications(): Promise<void> {
  // 1. Vérifier si on est sur un appareil physique
  const isDevice = Device.isDevice;
  if (!isDevice) {
    // Les notifications ne fonctionnent que sur un appareil physique
  }

  // 2. Vérifier les permissions
  const permissions = await Notifications.getPermissionsAsync();

  if (!permissions.granted) {
    // Permissions non accordées
  }

  // 3. Vérifier le Project ID
  const projectId = 
    Constants.expoConfig?.extra?.eas?.projectId || 
    Constants.easConfig?.projectId ||
    Constants.expoConfig?.extra?.projectId;

  if (!projectId && Platform.OS === 'ios') {
    // Project ID manquant - Les notifications iOS ne fonctionneront pas
  }

  // 4. Obtenir le token
  try {
    const token = await Notifications.getExpoPushTokenAsync({
      projectId: projectId || undefined,
    });
  } catch (error: any) {
    // Erreur silencieuse
  }

  // 5. Vérifier le token stocké localement
  const storedToken = await AsyncStorage.getItem('push_token');

  // 6. Vérifier le device ID
  const deviceId = await AsyncStorage.getItem('device_id');

  // 7. Vérifier si le token est enregistré sur le serveur
  try {
    const response = await api.get('/api/notifications/check');
  } catch (error: any) {
    // Erreur silencieuse
  }

  // 8. Vérifier l'état du service
  notificationsService.isInitialized();
  notificationsService.getToken();

  // 9. Tester l'envoi d'une notification locale
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Test de notification',
        body: 'Si vous voyez ce message, les notifications fonctionnent localement',
        data: { test: true },
      },
      trigger: null, // Immédiat
    });
  } catch (error: any) {
    // Erreur silencieuse
  }
}

// Fonction pour forcer la réinitialisation
export async function resetNotifications(): Promise<void> {
  // Supprimer les tokens stockés
  await AsyncStorage.removeItem('push_token');
  await AsyncStorage.removeItem('device_id');
  
  // Réinitialiser le service
  await notificationsService.initialize();
}
