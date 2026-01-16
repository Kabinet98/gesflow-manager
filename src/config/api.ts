import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
    const token = await AsyncStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les erreurs
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Ne pas déconnecter l'utilisateur si skipAuthError est défini
    const skipAuthError = error.config?.skipAuthError;
    
    if (error.response?.status === 401 && !skipAuthError) {
      // Token expiré ou invalide - seulement si skipAuthError n'est pas défini
      await AsyncStorage.removeItem('auth_token');
      await AsyncStorage.removeItem('user');
      // Émettre un événement pour notifier la déconnexion
      authEventEmitter.emit('auth-logout');
    }
    return Promise.reject(error);
  }
);

export default api;

