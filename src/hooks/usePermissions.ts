import { useState, useEffect, useCallback } from 'react';
import { permissionsService } from '@/services/permissions.service';
import { Permission } from '@/types';
import { authEventEmitter } from '@/config/api';

export function usePermissions() {
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPermissions = useCallback(async (forceRefresh: boolean = false, setLoadingState: boolean = true) => {
    try {
      // Ne mettre loading à true que lors du chargement initial ou si explicitement demandé
      if (setLoadingState) {
        setLoading(true);
      }
      
      const userPermissions = await permissionsService.getUserPermissions(forceRefresh);
      
      // S'assurer que c'est toujours un tableau
      const safePermissions = Array.isArray(userPermissions) ? userPermissions : [];
      
      setPermissions(safePermissions);
    } catch (error: any) {
      // En cas d'erreur, essayer de récupérer depuis le stockage
      try {
        const storagePermissions = await permissionsService.getUserPermissions(false);
        setPermissions(Array.isArray(storagePermissions) ? storagePermissions : []);
      } catch (e) {
        setPermissions([]);
      }
    } finally {
      if (setLoadingState) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    // Charger les permissions au montage
    loadPermissions(false).catch(error => {
      setLoading(false);
      setPermissions([]);
    });

    // Écouter les événements de rafraîchissement
    const handlePermissionsRefresh = () => {
      // Ne pas mettre loading à true lors du rafraîchissement pour éviter de recréer le navigator
      loadPermissions(true, false).catch(error => {
        // Erreur silencieuse
      });
    };

    authEventEmitter.on('permissions-should-refresh', handlePermissionsRefresh);

    // Polling automatique désactivé - on se fie uniquement aux événements pour éviter les rafraîchissements intempestifs
    // Les permissions seront rafraîchies uniquement via l'événement 'permissions-should-refresh'
    // ou lors du chargement initial

    return () => {
      authEventEmitter.off('permissions-should-refresh', handlePermissionsRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // loadPermissions est stable grâce à useCallback avec dépendances vides

  const hasPermission = useCallback((permissionName: string): boolean => {
    // Pendant le chargement ou si aucune permission n'est chargée,
    // permettre Dashboard et Settings par défaut pour éviter l'erreur "Couldn't find any screens"
    if (loading || permissions.length === 0) {
      return permissionName === 'dashboard.view' || permissionName === 'settings.view';
    }
    return permissionsService.hasPermission(permissions, permissionName);
  }, [loading, permissions]);

  const hasAnyPermission = useCallback((permissionNames: string[]): boolean => {
    if (loading || permissions.length === 0) {
      return permissionNames.some(name => name === 'dashboard.view' || name === 'settings.view');
    }
    return permissionsService.hasAnyPermission(permissions, permissionNames);
  }, [loading, permissions]);

  const hasAllPermissions = useCallback((permissionNames: string[]): boolean => {
    return permissionsService.hasAllPermissions(permissions, permissionNames);
  }, [permissions]);

  return {
    permissions,
    loading,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    refreshPermissions: () => loadPermissions(true, false), // Ne pas mettre loading à true lors du refresh manuel
  };
}



