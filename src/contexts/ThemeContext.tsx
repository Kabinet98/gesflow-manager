import React, { createContext, useContext, useEffect, useState } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme } from '@/config/theme';

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
        // D'abord, essayer de charger depuis l'utilisateur stocké
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
          const user = JSON.parse(userStr);
          if (user.theme === 'light' || user.theme === 'dark') {
            setThemeState(user.theme);
            await AsyncStorage.setItem('user_theme', user.theme);
            return;
          }
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
    
    // Mettre à jour l'utilisateur stocké
    try {
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        user.theme = newTheme;
        await AsyncStorage.setItem('user', JSON.stringify(user));
      }
    } catch (error) {
      // Erreur silencieuse
    }
    
    // Sauvegarder sur le serveur si l'utilisateur est connecté
    try {
      const token = await AsyncStorage.getItem('auth_token');
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







