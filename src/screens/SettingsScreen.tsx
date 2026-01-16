import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { authService } from '@/services/auth.service';
import { ThemeToggle } from '@/components/ThemeToggle';
import { AmountVisibilityToggle } from '@/components/AmountVisibilityToggle';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Drawer } from '@/components/ui/Drawer';
import { Button } from '@/components/ui/Button';
import { REFRESH_CONTROL_COLOR } from '@/constants/layout';
import { LinearGradient } from 'expo-linear-gradient';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { 
  Settings01Icon, 
  LogoutIcon, 
  UserRoadsideIcon,
  ArrowRight01Icon,
  LockKeyIcon,
  ShieldIcon,
  Calendar03Icon,
  Clock01Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  AlertDiamondIcon,
} from '@hugeicons/core-free-icons';
import { User } from '@/types';

interface SettingsItem {
  icon: any;
  label: string;
  value?: string;
  onPress?: () => void;
  showArrow?: boolean;
}

export function SettingsScreen() {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [showLogoutDrawer, setShowLogoutDrawer] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      const currentUser = await authService.getCurrentUser();
      setUser(currentUser);
    };
    loadUser();
  }, []);

  // Rafraîchir l'utilisateur après modification
  const refreshUser = async () => {
    const currentUser = await authService.getCurrentUser();
    setUser(currentUser);
  };

  // Fonction pour le refresh control
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshUser();
    } catch (error) {
      // Erreur silencieuse
    } finally {
      setRefreshing(false);
    }
  };

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

  const handleLogout = () => {
    setShowLogoutDrawer(true);
  };

  const confirmLogout = async () => {
    try {
      setIsLoggingOut(true);
      await authService.logout();
    } catch (error) {
      // Erreur silencieuse
    } finally {
      setIsLoggingOut(false);
      setShowLogoutDrawer(false);
    }
  };

  const initials = getInitials(user?.name, user?.email);

  // Formater la date
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return dateString;
    }
  };

  // Liste des informations de compte
  const accountInfoList: SettingsItem[] = [
    {
      icon: UserRoadsideIcon,
      label: 'Email',
      value: user?.email || 'N/A',
      showArrow: false,
    },
    {
      icon: Calendar03Icon,
      label: 'Date de création',
      value: formatDate(user?.createdAt),
      showArrow: false,
    },
    {
      icon: Clock01Icon,
      label: 'Dernière connexion',
      value: user?.lastLogin ? formatDate(user.lastLogin) : 'Jamais',
      showArrow: false,
    },
    {
      icon: user?.active ? CheckmarkCircle02Icon : Cancel01Icon,
      label: 'Statut',
      value: user?.active ? 'Actif' : 'Inactif',
      showArrow: false,
    },
  ];

  // Naviguer vers l'écran 2FA
  const handleNavigate2FA = () => {
    navigation.navigate('TwoFactorAuth' as never);
  };

  // Naviguer vers l'écran des questions de sécurité
  const handleNavigateSecurityQuestions = () => {
    navigation.navigate('SecurityQuestions' as never);
  };

  // Liste des paramètres de sécurité
  const securitySettingsList: SettingsItem[] = [
    {
      icon: ShieldIcon,
      label: 'Authentification à deux facteurs',
      value: user?.twoFactorEnabled ? 'Activée' : 'Désactivée',
      onPress: handleNavigate2FA,
    },
    {
      icon: LockKeyIcon,
      label: 'Questions de sécurité',
      value: user?.securityQuestionsEnabled ? 'Activées' : 'Désactivées',
      onPress: handleNavigateSecurityQuestions,
    },
  ];

  const renderSettingsItem = (item: SettingsItem, index: number, isLast: boolean = false) => (
    <TouchableOpacity
      key={index}
      onPress={item.onPress || undefined}
      disabled={!item.onPress}
      className={`flex-row items-center justify-between py-4 ${
        !isLast ? 'border-b' : ''
      }`}
      style={{
        borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
        opacity: item.onPress ? 1 : 0.7,
      }}
    >
      <View className="flex-row items-center flex-1">
        <View
          className="w-10 h-10 rounded-full items-center justify-center mr-3"
          style={{
            backgroundColor: isDark ? 'rgba(14, 165, 233, 0.2)' : 'rgba(14, 165, 233, 0.1)',
          }}
        >
          <HugeiconsIcon 
            icon={item.icon} 
            size={20} 
            color="#0ea5e9"
          />
        </View>
        <View className="flex-1">
          <Text
            className={`text-base font-medium ${
              isDark ? 'text-gray-100' : 'text-gray-900'
            }`}
          >
            {item.label}
          </Text>
          {item.value && (
            <Text
              className={`text-sm mt-1 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}
            >
              {item.value}
            </Text>
          )}
        </View>
      </View>
      {item.showArrow !== false && item.onPress && (
        <HugeiconsIcon 
          icon={ArrowRight01Icon} 
          size={20} 
          color={isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'} 
        />
      )}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView 
      className={`flex-1 ${isDark ? 'bg-[#0f172a]' : 'bg-white'}`}
      edges={['top', 'bottom']}
    >
      <ScreenHeader />
      <ScrollView
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? "#38bdf8" : REFRESH_CONTROL_COLOR}
            colors={isDark ? ["#38bdf8"] : [REFRESH_CONTROL_COLOR]}
          />
        }
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-20 pb-4">
          {/* Section Profil avec gradient 3D bleu */}
          <View className="mb-6 rounded-2xl overflow-hidden" style={styles.profileCard}>
            <LinearGradient
              colors={['#0ea5e9', '#0284c7', '#0369a1']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.profileGradient}
            >
              <View className="p-6">
                <View className="flex-row items-center">
                  {/* Avatar avec effet 3D */}
                  <View
                    className="w-20 h-20 rounded-full items-center justify-center mr-4"
                    style={styles.avatarContainer}
                  >
                    <Text className="text-white text-2xl font-bold">
                      {initials}
                    </Text>
                  </View>
                  
                  {/* Nom et tag */}
                  <View className="flex-1">
                    <Text className="text-white text-xl font-bold mb-2">
                      {user?.name || 'Utilisateur'}
                    </Text>
                    {user?.role?.name && (
                      <View className="self-start px-3 py-1 rounded-full bg-white/20">
                        <Text className="text-white text-xs font-semibold">
                          {user.role.name}
                        </Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </LinearGradient>
          </View>

          {/* Informations de compte */}
          <View
            className={`mb-4 rounded-xl overflow-hidden ${
              isDark ? 'bg-[#1e293b]' : 'bg-gray-50'
            }`}
            style={styles.card}
          >
            <View className="p-4">
              <Text
                className={`text-sm font-semibold mb-3 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                INFORMATIONS DE COMPTE
              </Text>
              {accountInfoList.map((item, index) => 
                renderSettingsItem(item, index, index === accountInfoList.length - 1)
              )}
            </View>
          </View>

          {/* Paramètres de sécurité */}
          <View
            className={`mb-4 rounded-xl overflow-hidden ${
              isDark ? 'bg-[#1e293b]' : 'bg-gray-50'
            }`}
            style={styles.card}
          >
            <View className="p-4">
              <Text
                className={`text-sm font-semibold mb-3 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                SÉCURITÉ
              </Text>
              {securitySettingsList.map((item, index) => 
                renderSettingsItem(item, index, index === securitySettingsList.length - 1)
              )}
            </View>
          </View>

          {/* Section Préférences */}
          <View
            className={`mb-4 rounded-xl overflow-hidden ${
              isDark ? 'bg-[#1e293b]' : 'bg-gray-50'
            }`}
            style={styles.card}
          >
            <View className="p-4">
              <Text
                className={`text-sm font-semibold mb-3 ${
                  isDark ? 'text-gray-400' : 'text-gray-600'
                }`}
              >
                PRÉFÉRENCES
              </Text>
              <View className="flex-row items-center justify-between py-3">
                <View className="flex-row items-center flex-1">
                  <View
                    className="w-10 h-10 rounded-full items-center justify-center mr-3"
                    style={{
                      backgroundColor: isDark ? 'rgba(14, 165, 233, 0.2)' : 'rgba(14, 165, 233, 0.1)',
                    }}
                  >
                    <HugeiconsIcon 
                      icon={Settings01Icon} 
                      size={20} 
                      color="#0ea5e9"
                    />
                  </View>
                  <View className="flex-1">
                    <Text
                      className={`text-base font-medium ${
                        isDark ? 'text-gray-100' : 'text-gray-900'
                      }`}
                    >
                      Thème
                    </Text>
                    <Text
                      className={`text-sm mt-1 ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      Changer entre le thème clair et sombre
                    </Text>
                  </View>
                </View>
                <ThemeToggle />
              </View>
            </View>
          </View>

          {/* Déconnexion */}
          <TouchableOpacity
            onPress={handleLogout}
            className={`rounded-xl p-4 flex-row items-center justify-center ${
              isDark ? 'bg-red-900/30' : 'bg-red-50'
            }`}
            style={styles.logoutButton}
            activeOpacity={0.7}
          >
            <HugeiconsIcon icon={LogoutIcon} size={20} color="#ef4444" />
            <Text className="text-base font-semibold text-red-500 ml-3">
              Se déconnecter
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Drawer de confirmation de déconnexion */}
      <Drawer
        open={showLogoutDrawer}
        onOpenChange={setShowLogoutDrawer}
        title="Confirmer la déconnexion"
      >
        <View style={{ gap: 20 }}>
          <View className="items-center mb-4">
            <View
              className="w-16 h-16 rounded-full items-center justify-center"
              style={{ backgroundColor: "#ef444420" }}
            >
              <HugeiconsIcon
                icon={AlertDiamondIcon}
                size={32}
                color="#ef4444"
              />
            </View>
          </View>

          <Text
            className={`text-base leading-6 ${
              isDark ? "text-gray-200" : "text-gray-800"
            }`}
          >
            Êtes-vous sûr de vouloir vous déconnecter ?
            {"\n\n"}
            Vous devrez vous reconnecter pour accéder à nouveau à votre compte.
          </Text>

          <View className="flex-row gap-3 mt-4">
            <View className="flex-1">
              <Button
                variant="outline"
                onPress={() => setShowLogoutDrawer(false)}
                disabled={isLoggingOut}
                className="w-full"
              >
                <Text
                  className={`text-base font-semibold ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Annuler
                </Text>
              </Button>
            </View>
            <View className="flex-1">
              <Button
                onPress={confirmLogout}
                disabled={isLoggingOut}
                loading={isLoggingOut}
                className="w-full"
                style={{ backgroundColor: "#ef4444" }}
              >
                <View className="flex-row items-center gap-2">
                  <HugeiconsIcon icon={LogoutIcon} size={18} color="#ffffff" />
                  <Text className="text-base font-semibold text-white">
                    Se déconnecter
                  </Text>
                </View>
              </Button>
            </View>
          </View>
        </View>
      </Drawer>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  profileCard: {
    shadowColor: '#0ea5e9',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  profileGradient: {
    borderRadius: 16,
  },
  avatarContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  logoutButton: {
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
});



