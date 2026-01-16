/**
 * Utilitaire de logging pour le débogage
 * Tous les logs sont préfixés avec un emoji et le nom du composant/service
 */

const isDev = __DEV__;

export const logger = {
  info: (component: string, message: string, data?: any) => {
    if (isDev) {
      console.log(`ℹ️ [${component}] ${message}`, data || '');
    }
  },

  success: (component: string, message: string, data?: any) => {
    if (isDev) {
      console.log(`✅ [${component}] ${message}`, data || '');
    }
  },

  error: (component: string, message: string, error?: any) => {
    if (isDev) {
      console.error(`❌ [${component}] ${message}`, error || '');
    }
  },

  warn: (component: string, message: string, data?: any) => {
    if (isDev) {
      console.warn(`⚠️ [${component}] ${message}`, data || '');
    }
  },

  debug: (component: string, message: string, data?: any) => {
    if (isDev) {
      console.log(`🐛 [${component}] ${message}`, data || '');
    }
  },

  api: (component: string, method: string, url: string, data?: any) => {
    if (isDev) {
      console.log(`📡 [${component}] ${method} ${url}`, data || '');
    }
  },

  permission: (component: string, permission: string, granted: boolean) => {
    if (isDev) {
      console.log(
        `🔐 [${component}] Permission "${permission}": ${granted ? '✅ Accordée' : '❌ Refusée'}`
      );
    }
  },
};




