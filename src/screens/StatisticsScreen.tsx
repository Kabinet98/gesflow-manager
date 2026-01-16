import React, { useState } from 'react';
import { View, Text, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import api from '@/config/api';
import { useTheme } from '@/contexts/ThemeContext';
import { usePermissions } from '@/hooks/usePermissions';
import { StatisticsSkeleton } from '@/components/skeletons/StatisticsSkeleton';
import { ScreenHeader } from '@/components/ScreenHeader';
import { REFRESH_CONTROL_COLOR } from '@/constants/layout';

export function StatisticsScreen() {
  const { isDark } = useTheme();
  const { hasPermission } = usePermissions();
  const [refreshing, setRefreshing] = useState(false);

  const canView = hasPermission('statistics.view') || hasPermission('dashboard.view');

  const { data: stats, isLoading, error, refetch } = useQuery({
    queryKey: ['statistics'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/dashboard/company-stats');
        return response.data;
      } catch (err: any) {
        throw err;
      }
    },
    enabled: canView,
  });

  // Si l'utilisateur n'a pas la permission de voir, ne pas afficher l'écran
  if (!canView) {
    return (
      <View className={`flex-1 ${isDark ? 'bg-[#0f172a]' : 'bg-white'}`}>
        <View className="p-6">
          <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Vous n'avez pas la permission d'accéder à cette page.
          </Text>
        </View>
      </View>
    );
  }

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (err) {
      // Erreur silencieuse
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView 
      className={`flex-1 ${isDark ? 'bg-[#0f172a]' : 'bg-white'}`}
      edges={['top', 'bottom']}
    >
      <ScreenHeader />
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? "#38bdf8" : REFRESH_CONTROL_COLOR}
            colors={isDark ? ["#38bdf8"] : [REFRESH_CONTROL_COLOR]}
          />
        }
        contentContainerStyle={{ paddingBottom: 24 }}
      >
        <View className="px-6 pt-6 pb-4">
          <View className="mb-6">
            <Text
              className={`text-2xl font-bold ${
                isDark ? 'text-gray-100' : 'text-gray-900'
              }`}
            >
              Statistiques
            </Text>
          </View>

        {isLoading || !stats ? (
          <StatisticsSkeleton />
        ) : (
          <View>
            <Text
              className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}
            >
              Statistiques détaillées
            </Text>
          </View>
        )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
