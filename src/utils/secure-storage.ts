/**
 * Wrapper pour SecureStore avec fallback vers AsyncStorage
 * Permet de tester l'app même si le module natif n'est pas encore compilé
 */

import AsyncStorage from "@react-native-async-storage/async-storage";

let SecureStore: any = null;
let isSecureStoreAvailable = false;

// Essayer de charger SecureStore
try {
  SecureStore = require("expo-secure-store");
  isSecureStoreAvailable = true;
} catch (e) {
  // SecureStore n'est pas disponible (module natif pas compilé)
  isSecureStoreAvailable = false;
}

/**
 * Stocke une valeur de manière sécurisée
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  if (isSecureStoreAvailable && SecureStore) {
    try {
      await SecureStore.setItemAsync(key, value);
      return;
    } catch (e) {}
  }

  // Fallback vers AsyncStorage
  await AsyncStorage.setItem(key, value);
}

/**
 * Récupère une valeur stockée de manière sécurisée
 */
export async function getSecureItem(key: string): Promise<string | null> {
  if (isSecureStoreAvailable && SecureStore) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (e) {}
  }

  // Fallback vers AsyncStorage
  return await AsyncStorage.getItem(key);
}

/**
 * Supprime une valeur stockée de manière sécurisée
 */
export async function deleteSecureItem(key: string): Promise<void> {
  if (isSecureStoreAvailable && SecureStore) {
    try {
      await SecureStore.deleteItemAsync(key);
      // Nettoyer aussi AsyncStorage au cas où
      await AsyncStorage.removeItem(key);
      return;
    } catch (e) {}
  }

  // Fallback vers AsyncStorage
  await AsyncStorage.removeItem(key);
}

/**
 * Vérifie si SecureStore est disponible
 */
export function isSecureStoreReady(): boolean {
  return isSecureStoreAvailable;
}
