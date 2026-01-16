import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/contexts/ThemeContext';

export function AlertsSkeleton() {
  const { isDark } = useTheme();

  return (
    <View style={styles.container}>
      <Skeleton width="80%" height={16} borderRadius={4} />
      <View style={styles.spacing} />
      <Skeleton width="60%" height={14} borderRadius={4} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
  },
  spacing: {
    height: 8,
  },
});




