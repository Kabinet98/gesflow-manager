import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Theme } from '@/config/theme';
import { authService } from '@/services/auth.service';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => Promise<void>;
  isDark: boolean;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemTheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>('light');

  useEffect(() => {
    // Charger le thème sauvegardé
    const loadTheme = async () => {
      try {
        // D'abord, essayer de charger depuis l'utilisateur connecté
        const user = await authService.getCurrentUser();
        if (user && (user.theme === 'light' || user.theme === 'dark')) {
          setThemeState(user.theme);
          await AsyncStorage.setItem('user_theme', user.theme);
          return;
        }
        
        // Sinon, charger depuis AsyncStorage
        const savedTheme = await AsyncStorage.getItem('user_theme');
        if (savedTheme === 'light' || savedTheme === 'dark') {
          setThemeState(savedTheme);
        } else {
          // Utiliser le thème système par défaut
          setThemeState(systemTheme === 'dark' ? 'dark' : 'light');
        }
      } catch (error) {
        // Utiliser le thème système par défaut en cas d'erreur
        setThemeState(systemTheme === 'dark' ? 'dark' : 'light');
      }
    };
    
    loadTheme();
  }, [systemTheme]);

  const setTheme = async (newTheme: Theme) => {
    setThemeState(newTheme);
    await AsyncStorage.setItem('user_theme', newTheme);
    
    // Sauvegarder sur le serveur si l'utilisateur est connecté
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        const { getApiBaseUrl } = await import('@/config/env');
        await fetch(`${getApiBaseUrl()}/api/users/theme`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ theme: newTheme }),
        });
        // Rafraîchir l'utilisateur pour mettre à jour le cache
        await authService.refreshUser();
      }
    } catch (error) {
      // Ignore error - le thème est déjà sauvegardé localement
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, isDark: theme === 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}







