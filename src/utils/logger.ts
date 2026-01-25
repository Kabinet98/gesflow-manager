/**
 * Utilitaire de logging pour le débogage
 * Tous les logs sont préfixés avec un emoji et le nom du composant/service
 */

const isDev = __DEV__;

export const logger = {
  info: (component: string, message: string, data?: any) => {
    // Logs supprimés
  },

  success: (component: string, message: string, data?: any) => {
    // Logs supprimés
  },

  error: (component: string, message: string, error?: any) => {
    // Logs supprimés
  },

  warn: (component: string, message: string, data?: any) => {
    // Logs supprimés
  },

  debug: (component: string, message: string, data?: any) => {
    // Logs supprimés
  },

  api: (component: string, method: string, url: string, data?: any) => {
    // Logs supprimés
  },

  permission: (component: string, permission: string, granted: boolean) => {
    // Logs supprimés
  },
};




