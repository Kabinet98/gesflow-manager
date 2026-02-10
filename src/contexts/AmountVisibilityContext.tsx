import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AmountVisibilityContextType {
  isAmountVisible: boolean;
  setAmountVisible: (visible: boolean) => Promise<void>;
  toggleAmountVisibility: () => Promise<void>;
}

const AmountVisibilityContext = createContext<AmountVisibilityContextType | undefined>(undefined);

export function AmountVisibilityProvider({ children }: { children: React.ReactNode }) {
  // Initialiser à null pour savoir si on a chargé depuis AsyncStorage
  const [isAmountVisible, setIsAmountVisible] = useState<boolean | null>(null);

  useEffect(() => {
    // Charger l'état depuis AsyncStorage de manière synchrone si possible
    const loadVisibility = async () => {
      try {
        const saved = await AsyncStorage.getItem('amountVisibility');
        if (saved !== null) {
          setIsAmountVisible(saved === 'true');
        } else {
          // Par défaut, les montants sont visibles
          setIsAmountVisible(true);
        }
      } catch (error) {
          // En cas d'erreur, par défaut visible
          setIsAmountVisible(true);
        }
    };
    loadVisibility();
  }, []);

  const setAmountVisible = async (visible: boolean) => {
    setIsAmountVisible(visible);
    await AsyncStorage.setItem('amountVisibility', String(visible));
  };

  const toggleAmountVisibility = async () => {
    await setAmountVisible(!isAmountVisible);
  };

  return (
    <AmountVisibilityContext.Provider
      value={{
        // Retourner true par défaut si pas encore chargé (pour éviter les problèmes d'affichage)
        isAmountVisible: isAmountVisible ?? true,
        setAmountVisible,
        toggleAmountVisibility,
      }}
    >
      {children}
    </AmountVisibilityContext.Provider>
  );
}

export function useAmountVisibility() {
  const context = useContext(AmountVisibilityContext);
  if (!context) {
    throw new Error('useAmountVisibility must be used within AmountVisibilityProvider');
  }
  return context;
}







