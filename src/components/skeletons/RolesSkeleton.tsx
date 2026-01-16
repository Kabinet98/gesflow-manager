import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/contexts/ThemeContext';

export function RolesSkeleton() {
  const { isDark } = useTheme();

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <View style={styles.header}>
          <Skeleton width={24} height={24} borderRadius={12} />
          <Skeleton width={180} height={28} borderRadius={8} />
        </View>
      </View>

      <View style={styles.listContainer}>
        {[...Array(5)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.listItem,
              {
                backgroundColor: isDark ? '#1e293b' : '#f9fafb',
              },
            ]}
          >
            <Skeleton width={24} height={24} borderRadius={12} />
            <View style={styles.listItemContent}>
              <Skeleton width="70%" height={16} borderRadius={4} />
              <View style={styles.spacing} />
              <Skeleton width="50%" height={14} borderRadius={4} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 24,
  },
  listContainer: {
    paddingHorizontal: 24,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  listItemContent: {
    flex: 1,
  },
  spacing: {
    height: 6,
  },
});




