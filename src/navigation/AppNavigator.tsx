import React, { useEffect, useState } from "react";
import { NavigationContainer, useNavigationState } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { View, TouchableOpacity, Text } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { authService } from "@/services/auth.service";
import { authEventEmitter } from "@/config/api";
import { LoginScreen } from "@/screens/LoginScreen";
import { DashboardScreen } from "@/screens/DashboardScreen";
import { CompaniesScreen } from "@/screens/CompaniesScreen";
import { ExpensesScreen } from "@/screens/ExpensesScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { InvestmentsScreen } from "@/screens/InvestmentsScreen";
import { MoreDrawer, openMoreDrawer } from "@/components/MoreDrawer";
import { LoansScreen } from "@/screens/LoansScreen";
import { DatScreen } from "@/screens/DatScreen";
import { BanksScreen } from "@/screens/BanksScreen";
import { UsersScreen } from "@/screens/UsersScreen";
import { RolesScreen } from "@/screens/RolesScreen";
import { AlertsScreen } from "@/screens/AlertsScreen";
import { LogsScreen } from "@/screens/LogsScreen";
import { StatisticsScreen } from "@/screens/StatisticsScreen";
import { ActivitySectorsScreen } from "@/screens/ActivitySectorsScreen";
import { InvestmentCategoriesScreen } from "@/screens/InvestmentCategoriesScreen";
import { TwoFactorAuthScreen } from "@/screens/TwoFactorAuthScreen";
import { SecurityQuestionsScreen } from "@/screens/SecurityQuestionsScreen";
import { usePermissions } from "@/hooks/usePermissions";
import { useTheme } from "@/contexts/ThemeContext";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  Home03Icon,
  Building04Icon,
  MoneyIcon,
  Settings01Icon,
  Link03Icon,
} from "@hugeicons/core-free-icons";
import api from "@/config/api";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Composant vide pour le bouton "Plus" (pas un vrai écran)
const EmptyScreen = () => null;

function MainTabs() {
  const { isDark } = useTheme();
  const { hasPermission } = usePermissions();
  const [isManager, setIsManager] = React.useState(false);

  // Vérifier si l'utilisateur est un manager
  React.useEffect(() => {
    const checkManager = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          const roleName = user?.role?.name?.toLowerCase() || "";
          const isManagerRole =
            roleName.includes("gestionnaire") || roleName.includes("manager");
          setIsManager(isManagerRole);
        }
      } catch (err) {
        // Erreur silencieuse
      }
    };
    checkManager();
  }, []);

  // Compter les tabs principaux visibles (sans More et Settings)
  const mainTabsCount = [
    hasPermission("dashboard.view"),
    hasPermission("companies.view"),
    hasPermission("expenses.view"),
  ].filter(Boolean).length;

  const hasSettings = hasPermission("settings.view");
  
  // Afficher "More" si on a au moins 3 tabs principaux
  // Cela garantit qu'on affiche "More" quand il y a au moins 4 tabs au total (3 principaux + More + Settings)
  // Le tab "More" doit toujours être visible quand il y a plus de 4 tabs au total
  const shouldShowMore = mainTabsCount >= 3;

  // Récupérer le nombre de dépenses en attente pour le badge
  // Seulement pour les admins (pas pour les managers)
  const { data: pendingCountData } = useQuery({
    queryKey: ["expenses-pending-count"],
    queryFn: async () => {
      try {
        const response = await api.get("/api/expenses/pending-count");
        return response.data;
      } catch (error) {
        return { count: 0 };
      }
    },
    refetchInterval: 30000, // Rafraîchir toutes les 30 secondes
    enabled: !isManager, // Ne pas récupérer le count si c'est un manager
  });

  // Les managers ne doivent pas voir le badge
  const pendingExpensesCount = isManager ? 0 : (pendingCountData?.count || 0);

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#0ea5e9",
        tabBarInactiveTintColor: isDark ? "#6b7280" : "#9ca3af",
        tabBarStyle: {
          backgroundColor: isDark ? "#1e293b" : "#ffffff",
          borderTopColor: isDark ? "#374151" : "#e5e7eb",
        },
      }}
    >
      {hasPermission("dashboard.view") && (
        <Tab.Screen
          name="Dashboard"
          component={DashboardScreen}
          options={{
            tabBarLabel: "Dashboard",
            tabBarIcon: ({ color, size }) => (
              <HugeiconsIcon icon={Home03Icon} size={size || 24} color={color} />
            ),
          }}
        />
      )}
      {hasPermission("companies.view") && (
        <Tab.Screen
          name="Companies"
          component={CompaniesScreen}
          options={{
            tabBarLabel: "Entreprises",
            tabBarIcon: ({ color, size }) => (
              <HugeiconsIcon icon={Building04Icon} size={size || 24} color={color} />
            ),
          }}
        />
      )}
      {hasPermission("expenses.view") && (
        <Tab.Screen
          name="Expenses"
          component={ExpensesScreen}
          options={{
            tabBarLabel: "Dépenses",
            tabBarIcon: ({ color, size }) => (
              <HugeiconsIcon icon={MoneyIcon} size={size || 24} color={color} />
            ),
            tabBarBadge: pendingExpensesCount > 0 ? pendingExpensesCount : undefined,
            tabBarBadgeStyle: {
              backgroundColor: "#eab308", // Couleur yellow-500 pour les dépenses en attente
            },
          }}
        />
      )}
      {shouldShowMore && (
        <Tab.Screen
          name="MoreButton"
          component={EmptyScreen}
          options={{
            tabBarLabel: "Plus",
            tabBarIcon: ({ color, size }) => (
              <HugeiconsIcon icon={Link03Icon} size={size || 24} color={color} />
            ),
            tabBarButton: (props: any) => {
              const { onPress, ...otherProps } = props;
              return (
                <TouchableOpacity
                  {...otherProps}
                  onPress={() => openMoreDrawer()}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <View style={{ alignItems: "center", gap: 4 }}>
                    <HugeiconsIcon 
                      icon={Link03Icon} 
                      size={24} 
                      color={isDark ? "#f1f5f9" : "#0f172a"} 
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        color: isDark ? "#f1f5f9" : "#0f172a",
                        fontWeight: "500",
                      }}
                    >
                      Plus
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            },
          }}
        />
      )}
    </Tab.Navigator>
  );
}

export function AppNavigator() {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    checkAuth();

    // Écouter les changements d'authentification
    const handleAuthChange = async (authenticated: boolean) => {
      // Utiliser la valeur passée directement, puis vérifier pour confirmer
      setIsAuthenticated(authenticated);
      // Vérifier l'état réel pour s'assurer de la cohérence (en arrière-plan)
      const actualAuth = await authService.isAuthenticated();
      if (actualAuth !== authenticated) {
        setIsAuthenticated(actualAuth);
      }
    };

    authEventEmitter.on('auth-changed', handleAuthChange);

    // Nettoyer le listener au démontage
    return () => {
      authEventEmitter.off('auth-changed', handleAuthChange);
    };
  }, []);

  const checkAuth = async () => {
    const authenticated = await authService.isAuthenticated();
    setIsAuthenticated(authenticated);
  };

  if (isAuthenticated === null) {
    // Loading state
    return null;
  }

  return (
    <NavigationContainer>
      <MoreDrawer />
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen 
              name="Investments" 
              component={InvestmentsScreen as React.ComponentType}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen 
              name="Loans" 
              component={LoansScreen as React.ComponentType}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen 
              name="Dat" 
              component={DatScreen as React.ComponentType}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen 
              name="Banks" 
              component={BanksScreen as React.ComponentType}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen 
              name="Users" 
              component={UsersScreen as React.ComponentType}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen 
              name="Roles" 
              component={RolesScreen as React.ComponentType}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen 
              name="Alerts" 
              component={AlertsScreen as React.ComponentType}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen 
              name="Logs" 
              component={LogsScreen as React.ComponentType}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen 
              name="Statistics" 
              component={StatisticsScreen as React.ComponentType}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen 
              name="ActivitySectors" 
              component={ActivitySectorsScreen as React.ComponentType}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen 
              name="InvestmentCategories" 
              component={InvestmentCategoriesScreen as React.ComponentType}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen 
              name="TwoFactorAuth" 
              component={TwoFactorAuthScreen as React.ComponentType}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen 
              name="SecurityQuestions" 
              component={SecurityQuestionsScreen as React.ComponentType}
              options={{ presentation: 'card' }}
            />
            <Stack.Screen 
              name="Settings" 
              component={SettingsScreen as React.ComponentType}
              options={{ presentation: 'card' }}
            />
          </>
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
