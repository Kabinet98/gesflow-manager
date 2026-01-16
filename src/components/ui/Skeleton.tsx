import React from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

interface SkeletonProps {
  width?: number | string;
  height?: number | string;
  borderRadius?: number;
  className?: string;
  style?: any;
}

export function Skeleton({ 
  width = '100%', 
  height = 20, 
  borderRadius = 8,
  className,
  style 
}: SkeletonProps) {
  const { isDark } = useTheme();
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
          opacity,
        },
        style,
      ]}
    />
  );
}

interface SkeletonCardProps {
  isDark?: boolean;
}

export function SkeletonCard({ isDark }: SkeletonCardProps) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#1e293b' : '#f9fafb',
        },
      ]}
    >
      <Skeleton width="60%" height={16} borderRadius={4} />
      <View style={styles.spacing} />
      <Skeleton width="40%" height={24} borderRadius={4} />
    </View>
  );
}

interface SkeletonListItemProps {
  isDark?: boolean;
}

export function SkeletonListItem({ isDark }: SkeletonListItemProps) {
  return (
    <View
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
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    gap: 12,
  },
  listItemContent: {
    flex: 1,
  },
  spacing: {
    height: 8,
  },
});




