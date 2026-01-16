import { useEffect, useState } from 'react';
import { notificationsService } from '@/services/notifications.service';

export function useNotifications() {
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    const initNotifications = async () => {
      try {
        await notificationsService.initialize();
        setIsInitialized(notificationsService.isInitialized());
      } catch (error) {
        // Erreur silencieuse
      }
    };

    initNotifications();
  }, []);

  return {
    isInitialized,
    getToken: () => notificationsService.getToken(),
  };
}
