import React from 'react';
import { TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

export function ThemeToggle() {
  const { theme, setTheme, isDark } = useTheme();

  const handleToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return (
    <TouchableOpacity
      onPress={handleToggle}
      className="h-10 w-10 rounded-full items-center justify-center bg-transparent"
      style={styles.container}
    >
      {isDark ? (
        <Image
          source={require('../../assets/sun.png')}
          style={styles.icon}
          resizeMode="contain"
        />
      ) : (
        <Image
          source={require('../../assets/moon.png')}
          style={styles.icon}
          resizeMode="contain"
        />
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  icon: {
    width: 24,
    height: 24,
  },
});