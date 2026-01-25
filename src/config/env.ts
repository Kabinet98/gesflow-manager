import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Pour Expo, utiliser Constants.expoConfig.extra
const getEnvVar = (key: string, defaultValue: string): string => {
  // Essayer d'abord avec expo-constants
  if (Constants.expoConfig?.extra?.[key]) {
    return Constants.expoConfig.extra[key];
  }
  // Fallback sur process.env
  return process.env[key] || defaultValue;
};

export const ENV = {
  API_BASE_URL: getEnvVar('API_BASE_URL', 'http://localhost:3000'),
};

// Helper pour obtenir l'URL de base selon la plateforme
export const getApiBaseUrl = () => {
  const apiUrl = ENV.API_BASE_URL;
  
  // Si une URL personnalisée est définie (pas localhost), l'utiliser directement
  // Cela permet d'utiliser une IP locale pour les appareils physiques
  if (apiUrl && !apiUrl.includes('localhost') && apiUrl !== 'http://localhost:3000') {
    return apiUrl;
  }

  // En développement, détecter la plateforme et adapter l'URL
  if (__DEV__) {
    if (Platform.OS === 'android') {
      // Android Emulator - utilise 10.0.2.2 pour accéder à localhost de la machine hôte
      return 'http://10.0.2.2:3000';
    } else if (Platform.OS === 'ios') {
      // iOS Simulator - localhost fonctionne
      return 'http://localhost:3000';
    } else {
      // Web ou autres plateformes
      return 'http://localhost:3000';
    }
  }

  // En production, utiliser la valeur du .env ou la valeur par défaut
  // En production, ne JAMAIS utiliser localhost
  if (!__DEV__) {
    // En production, forcer une URL de production
    if (apiUrl && (apiUrl.includes('localhost') || apiUrl.includes('127.0.0.1') || apiUrl.includes('192.168') || apiUrl.includes('10.0'))) {
      throw new Error('Configuration invalide: localhost ne peut pas être utilisé en production. Veuillez définir API_BASE_URL avec une URL de production.');
    }
  }
  return apiUrl || 'http://localhost:3000';
};

