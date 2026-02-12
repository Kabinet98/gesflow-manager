import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { usePermissions } from '@/hooks/usePermissions';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { Settings01Icon, MoneyIcon, Building04Icon, Home03Icon, ReverseWithdrawal02Icon, PiggyBankIcon, BankIcon, UserRoadsideIcon, LockKeyIcon, AlertDiamondIcon, Activity03Icon, Chart01Icon } from '@hugeicons/core-free-icons';
import { Header } from '@/components/Header';
import { Drawer } from '@/components/ui/Drawer';

interface MenuItem {
  name: string;
  screen: string;
  icon: any;
  permission?: string;
}

export function MoreScreen() {
  const { isDark } = useTheme();
  const { hasPermission } = usePermissions();
  const navigation = useNavigation<any>();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Ouvrir automatiquement le drawer quand on arrive sur l'écran
  useFocusEffect(
    React.useCallback(() => {
      setDrawerOpen(true);
    }, [])
  );

  const menuItems: MenuItem[] = [
    {
      name: 'Investissements',
      screen: 'Investments',
      icon: MoneyIcon,
      permission: 'investments.view',
    },
    {
      name: 'Emprunts',
      screen: 'Loans',
      icon: ReverseWithdrawal02Icon,
      permission: 'loans.view',
    },
    {
      name: 'Placements',
      screen: 'Dat',
      icon: PiggyBankIcon,
      permission: 'dat.view',
    },
    {
      name: 'Banques',
      screen: 'Banks',
      icon: Building04Icon,
      permission: 'banks.view',
    },
    {
      name: 'Utilisateurs',
      screen: 'Users',
      icon: UserRoadsideIcon,
      permission: 'users.view',
    },
    {
      name: 'Rôles & Permissions',
      screen: 'Roles',
      icon: LockKeyIcon,
      permission: 'roles.view',
    },
    {
      name: 'Alertes',
      screen: 'Alerts',
      icon: AlertDiamondIcon,
      permission: 'alerts.view',
    },
    {
      name: 'Logs',
      screen: 'Logs',
      icon: Activity03Icon,
      permission: 'logs.view',
    },
    {
      name: 'Statistiques',
      screen: 'Statistics',
      icon: Home03Icon,
      permission: 'dashboard.view',
    },
    {
      name: 'Secteurs d\'activité',
      screen: 'ActivitySectors',
      icon: Building04Icon,
      permission: 'activity-sectors.view',
    },
    {
      name: 'Catégories d\'investissements',
      screen: 'InvestmentCategories',
      icon: MoneyIcon,
      permission: 'investment-categories.view',
    },
  ];

  let filteredItems: MenuItem[] = [];
  try {
    if (!Array.isArray(menuItems)) {
      filteredItems = [];
    } else {
      filteredItems = menuItems.filter(
        (item) => !item.permission || hasPermission(item.permission)
      );
    }
  } catch (error: any) {
    filteredItems = [];
  }

  const handleNavigate = (screen: string) => {
    setDrawerOpen(false);
    try {
      navigation.navigate(screen);
    } catch (err) {
      // Erreur silencieuse
    }
  };

  return (
    <>
      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title="Plus"
      >
        <View style={{ gap: 0 }}>
          {(() => {
            try {
              if (!Array.isArray(filteredItems)) {
                return null;
              }
              
              return filteredItems.map((item, index) => {
                try {
                  return (
                    <TouchableOpacity
                      key={item.screen}
                      onPress={() => handleNavigate(item.screen)}
                      className={`flex-row items-center py-3 ${
                        index !== filteredItems.length - 1 ? 'border-b' : ''
                      }`}
                      style={{
                        borderBottomColor: isDark ? '#374151' : '#e5e7eb',
                      }}
                    >
                      <View style={{ width: 24, height: 24, alignItems: 'center', justifyContent: 'center' }}>
                        <HugeiconsIcon
                          icon={item.icon}
                          size={20}
                          color="#0ea5e9"
                        />
                      </View>
                      <Text
                        className={`text-base ml-3 flex-1 ${
                          isDark ? 'text-gray-100' : 'text-gray-900'
                        }`}
                      >
                        {item.name}
                      </Text>
                    </TouchableOpacity>
                  );
                } catch (error: any) {
                  return null;
                }
              });
            } catch (error: any) {
              return null;
            }
          })()}
        </View>
      </Drawer>
    </>
  );
}

