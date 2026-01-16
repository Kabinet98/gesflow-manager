import api from '@/config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Permission } from '@/types';
import { authService } from '@/services/auth.service';

class PermissionsService {
  private cachedPermissions: string[] = [];
  private lastFetchTime: number = 0;
  private readonly CACHE_DURATION = 5 * 1000; // 5 secondes pour une réactivité immédiate aux changements de permissions

  /**
   * Extrait les noms des permissions depuis un tableau de permissions
   */
  private extractPermissionNames(permissions: any[]): string[] {
    if (!permissions || !Array.isArray(permissions)) {
      return [];
    }

    return permissions
      .map((rp: any) => {
        if (typeof rp === 'string') {
          return rp;
        }
        if (typeof rp === 'object' && rp !== null) {
          // Format: { permission: { name: string } }
          if (rp.permission) {
            return typeof rp.permission === 'string' 
              ? rp.permission 
              : rp.permission.name;
          }
          // Format: { name: string }
          if (rp.name) {
            return rp.name;
          }
        }
        return null;
      })
      .filter((name): name is string => name !== null);
  }

  /**
   * Récupère les permissions depuis le stockage local
   */
  private async getPermissionsFromStorage(): Promise<string[]> {
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (!userStr) {
        return [];
      }

      const user = JSON.parse(userStr);
      const userPermissions = user?.role?.permissions;

      if (!userPermissions || !Array.isArray(userPermissions)) {
        return [];
      }

      return this.extractPermissionNames(userPermissions);
    } catch (error) {
      return [];
    }
  }

  /**
   * Récupère les permissions depuis l'API
   * Utilise getCurrentUser() qui gère automatiquement les erreurs 401 et retourne l'utilisateur stocké si le token n'est pas expiré
   */
  private async getPermissionsFromAPI(): Promise<string[]> {
    try {
      // Essayer d'abord de récupérer l'utilisateur stocké (sans appel API)
      let user = await authService.getStoredUser();
      
      // Si pas d'utilisateur stocké, utiliser getCurrentUser() qui fera un appel API
      // mais retournera l'utilisateur stocké en cas d'erreur 401 si le token n'est pas expiré
      if (!user) {
        user = await authService.getCurrentUser();
      }
      
      if (!user) {
        return [];
      }

      // Extraire les permissions de l'utilisateur
      const userPermissions = user?.role?.permissions || [];
      const permissionNames = this.extractPermissionNames(userPermissions);

      return permissionNames;
    } catch (error: any) {
      // En cas d'erreur, essayer d'abord de retourner les permissions du stockage
      // Cela évite de perdre les permissions si c'est juste une erreur temporaire
      const storagePermissions = await this.getPermissionsFromStorage();
      if (storagePermissions.length > 0) {
        return storagePermissions;
      }

      // Pour les autres erreurs, retourner un tableau vide
      return [];
    }
  }

  /**
   * Récupère les permissions de l'utilisateur
   * @param forceRefresh Force la récupération depuis l'API même si le cache est valide
   */
  async getUserPermissions(forceRefresh: boolean = false): Promise<string[]> {
    const now = Date.now();
    const cacheValid = (now - this.lastFetchTime) < this.CACHE_DURATION;

    // Si on a un cache valide et qu'on ne force pas le refresh
    if (!forceRefresh && cacheValid && this.cachedPermissions.length > 0) {
      return this.cachedPermissions;
    }

    // Si on ne force pas le refresh, essayer d'abord depuis le stockage
    if (!forceRefresh) {
      const storagePermissions = await this.getPermissionsFromStorage();
      if (storagePermissions.length > 0) {
        this.cachedPermissions = storagePermissions;
        this.lastFetchTime = now;
        
        // Récupérer depuis l'API en arrière-plan pour mettre à jour
        this.getPermissionsFromAPI()
          .then(apiPermissions => {
            if (apiPermissions.length > 0) {
              this.cachedPermissions = apiPermissions;
              this.lastFetchTime = Date.now();
            }
          })
          .catch(error => {
            // Erreur silencieuse
          });

        return storagePermissions;
      }
    }

    // Récupérer depuis l'API
    const apiPermissions = await this.getPermissionsFromAPI();
    if (apiPermissions.length > 0) {
      this.cachedPermissions = apiPermissions;
      this.lastFetchTime = now;
    }

    return apiPermissions;
  }

  /**
   * Vérifie si l'utilisateur a une permission spécifique
   */
  hasPermission(permissions: (Permission | string)[], permissionName: string): boolean {
    if (!Array.isArray(permissions)) {
      return false;
    }

    return permissions.some((p) => {
      if (typeof p === 'string') {
        return p === permissionName;
      }
      if (typeof p === 'object' && p !== null) {
        const perm = p as Permission;
        return perm.name === permissionName;
      }
      return false;
    });
  }

  /**
   * Vérifie si l'utilisateur a au moins une des permissions spécifiées
   */
  hasAnyPermission(permissions: (Permission | string)[], permissionNames: string[]): boolean {
    return permissionNames.some((name) => this.hasPermission(permissions, name));
  }

  /**
   * Vérifie si l'utilisateur a toutes les permissions spécifiées
   */
  hasAllPermissions(permissions: (Permission | string)[], permissionNames: string[]): boolean {
    return permissionNames.every((name) => this.hasPermission(permissions, name));
  }

  /**
   * Vide le cache des permissions
   */
  clearCache(): void {
    this.cachedPermissions = [];
    this.lastFetchTime = 0;
  }
}

export const permissionsService = new PermissionsService();



