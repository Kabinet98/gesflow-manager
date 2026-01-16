import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { usePermissions } from '@/hooks/usePermissions';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { 
  Settings01Icon, 
  MoneyIcon, 
  Building04Icon,
  ReverseWithdrawal02Icon,
  Coins01Icon,
  UserRoadsideIcon,
  LockKeyIcon,
  AlertDiamondIcon,
  Activity03Icon,
} from '@hugeicons/core-free-icons';
import { Drawer } from '@/components/ui/Drawer';

interface MenuItem {
  name: string;
  screen: string;
  icon: any;
  permission?: string;
}

// Contexte global pour gérer l'état du drawer
let drawerState: { open: boolean; setOpen: ((open: boolean) => void) | null } = {
  open: false,
  setOpen: null,
};

export function openMoreDrawer() {
  if (drawerState.setOpen) {
    drawerState.setOpen(true);
  }
}

export function MoreDrawer() {
  const { isDark } = useTheme();
  const { hasPermission } = usePermissions();
  const navigation = useNavigation<any>();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Mettre à jour le contexte global
  useEffect(() => {
    drawerState.setOpen = setDrawerOpen;
    return () => {
      drawerState.setOpen = null;
    };
  }, []);

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
      name: 'DAT',
      screen: 'Dat',
      icon: Coins01Icon,
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

  const filteredItems = menuItems.filter(
    (item) => !item.permission || hasPermission(item.permission)
  );

  const handleNavigate = (screen: string) => {
    setDrawerOpen(false);
    try {
      navigation.navigate(screen);
    } catch (err) {
      // Erreur silencieuse
    }
  };

  return (
    <Drawer
      open={drawerOpen}
      onOpenChange={setDrawerOpen}
      title="Plus"
    >
      <View style={{ gap: 0 }}>
        {filteredItems.map((item, index) => (
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
        ))}
      </View>
    </Drawer>
  );
}
