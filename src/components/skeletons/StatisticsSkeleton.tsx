import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/contexts/ThemeContext';

export function StatisticsSkeleton() {
  const { isDark } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.cardsContainer}>
        {[...Array(4)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.card,
              {
                backgroundColor: isDark ? '#1e293b' : '#f9fafb',
              },
            ]}
          >
            <Skeleton width="80%" height={14} borderRadius={4} />
            <View style={styles.spacing} />
            <Skeleton width="60%" height={28} borderRadius={4} />
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  cardsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  card: {
    flex: 1,
    minWidth: 150,
    padding: 16,
    borderRadius: 12,
  },
  spacing: {
    height: 8,
  },
});




