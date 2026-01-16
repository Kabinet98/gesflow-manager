import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '@/contexts/ThemeContext';
import { authService } from '@/services/auth.service';
import { User } from '@/types';

interface AvatarTabProps {
  onPress: () => void;
  isFocused: boolean;
}

export function AvatarTab({ onPress, isFocused }: AvatarTabProps) {
  const { isDark } = useTheme();
  const [user, setUser] = React.useState<User | null>(null);

  React.useEffect(() => {
    const loadUser = async () => {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  const getInitials = (name?: string, email?: string) => {
    if (name) {
      const parts = name.trim().split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
      }
      return name.substring(0, 2).toUpperCase();
    }
    if (email) {
      return email.substring(0, 2).toUpperCase();
    }
    return 'U';
  };

  const initials = getInitials(user?.name, user?.email);

  // Couleurs pour le gradient 3D bleu - utiliser la couleur des tabs (#0ea5e9)
  const gradientColors = isFocused
    ? ['#0ea5e9', '#0284c7', '#0369a1'] // Bleu plus intense quand focus
    : ['#0ea5e9', '#0284c7', '#0369a1']; // Même couleur bleue que les tabs

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      style={styles.touchable}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.container,
          isFocused && styles.containerFocused,
        ]}
      >
        <View style={styles.innerShadow} />
        <Text style={styles.initials}>
          {initials}
        </Text>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchable: {
    marginBottom: -18, // Remonter de 50% (la tab fait environ 50px, donc -18px pour ~50%)
    marginTop: -18, // Remonter aussi par le haut
  },
  container: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#0ea5e9',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  containerFocused: {
    width: 38,
    height: 38,
    borderRadius: 19,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 6,
  },
  innerShadow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  initials: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    textShadowColor: 'rgba(0, 0, 0, 0.2)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    zIndex: 1,
  },
});

