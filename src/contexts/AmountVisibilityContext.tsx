import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface AmountVisibilityContextType {
  isAmountVisible: boolean;
  setAmountVisible: (visible: boolean) => Promise<void>;
  toggleAmountVisibility: () => Promise<void>;
}

const AmountVisibilityContext = createContext<AmountVisibilityContextType | undefined>(undefined);

export function AmountVisibilityProvider({ children }: { children: React.ReactNode }) {
  const [isAmountVisible, setIsAmountVisible] = useState(true);

  useEffect(() => {
    // Charger l'état depuis AsyncStorage
    AsyncStorage.getItem('amountVisibility').then((saved) => {
      if (saved !== null) {
        setIsAmountVisible(saved === 'true');
      }
    });
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
        isAmountVisible,
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







