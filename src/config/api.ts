import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSecureItem, deleteSecureItem } from '@/utils/secure-storage';
import { authService } from '@/services/auth.service';
import { getApiBaseUrl } from './env';
// Types axios sont automatiquement inclus via src/types/axios.d.ts

const API_BASE_URL = getApiBaseUrl();

// EventEmitter simple pour React Native (le module 'events' de Node.js n'est pas disponible)
class SimpleEventEmitter {
  private listeners: Map<string, Set<(...args: any[]) => void>> = new Map();

  on(event: string, listener: (...args: any[]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener);
  }

  off(event: string, listener: (...args: any[]) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(listener);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.forEach(listener => {
        try {
          listener(...args);
        } catch (error) {
          // Erreur silencieuse
        }
      });
    }
  }

  removeAllListeners(event?: string): void {
    if (event) {
      this.listeners.delete(event);
    } else {
      this.listeners.clear();
    }
  }
}

// EventEmitter pour notifier les changements d'authentification
export const authEventEmitter = new SimpleEventEmitter();

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token d'authentification
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await getSecureItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (e) {
      // Erreur silencieuse
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Compteur de 401 consécutifs avec token valide (détection compte désactivé)
let consecutive401Count = 0;
let isLoggingOut = false;

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => {
    // Réponse réussie → réinitialiser le compteur
    consecutive401Count = 0;
    return response;
  },
  async (error) => {
    const skipAuthError = error.config?.skipAuthError;

    if (error.response?.status === 401 && !skipAuthError && !isLoggingOut) {
      try {
        const token = await getSecureItem('auth_token');

        if (token) {
          if (authService.isTokenExpired(token)) {
            // Token expiré → déconnecter immédiatement
            isLoggingOut = true;
            await deleteSecureItem('auth_token');
            await AsyncStorage.removeItem('user_id');
            await AsyncStorage.removeItem('user');
            authEventEmitter.emit('auth-logout');
            isLoggingOut = false;
          } else {
            // Token valide mais rejeté → le serveur refuse (compte désactivé ?)
            consecutive401Count++;
            if (consecutive401Count >= 3) {
              // 3 rejets consécutifs avec token valide → forcer la déconnexion
              consecutive401Count = 0;
              isLoggingOut = true;
              await deleteSecureItem('auth_token');
              await AsyncStorage.removeItem('user_id');
              await AsyncStorage.removeItem('user');
              authEventEmitter.emit('auth-logout');
              isLoggingOut = false;
            }
          }
        }
      } catch (e) {
        isLoggingOut = false;
      }
    }
    return Promise.reject(error);
  }
);

export default api;

