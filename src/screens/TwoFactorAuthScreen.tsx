import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, TextInput, StyleSheet, ActivityIndicator, Image, Clipboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '@/contexts/ThemeContext';
import { authService } from '@/services/auth.service';
import { ScreenHeader } from '@/components/ScreenHeader';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { ShieldIcon, CheckmarkCircle02Icon, Cancel01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { User } from '@/types';
import api from '@/config/api';

export function TwoFactorAuthScreen() {
  const navigation = useNavigation();
  const { isDark } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [enabling, setEnabling] = useState(false);
  const [mfaSecret, setMfaSecret] = useState<{
    secret: string;
    otpauthUrl: string;
    manualEntryKey: string;
  } | null>(null);
  const [mfaSetupStep, setMfaSetupStep] = useState<"idle" | "setup" | "verify">("idle");
  const [verificationCode, setVerificationCode] = useState('');
  const [mfaDisableCode, setMfaDisableCode] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const currentUser = await authService.getCurrentUser();
        if (currentUser) {
          setUser(currentUser);
          setError(null);
          // Charger le statut MFA
          try {
            const mfaStatusRes = await api.get('/api/auth/2fa/status', {
              skipAuthError: true, // Ne pas déconnecter en cas d'erreur 401
            });
            const mfaStatus = mfaStatusRes.data;
            // Le statut est déjà dans currentUser.twoFactorEnabled, mais on peut le vérifier
            
            // Si le 2FA n'est pas activé, charger automatiquement le QR code
            if (!currentUser.twoFactorEnabled && !mfaSecret && mfaSetupStep === 'idle') {
              try {
                setEnabling(true);
                const response = await api.post('/api/auth/2fa/setup', {}, {
                  skipAuthError: true, // Ne pas déconnecter en cas d'erreur 401
                });
                // La réponse contient: { secret, otpauthUrl, manualEntryKey }
                setMfaSecret({
                  secret: response.data.secret,
                  otpauthUrl: response.data.otpauthUrl,
                  manualEntryKey: response.data.manualEntryKey,
                });
                setMfaSetupStep('setup');
              } catch (setupError: any) {
                // Erreur silencieuse - l'utilisateur pourra cliquer sur le bouton manuellement
              } finally {
                setEnabling(false);
              }
            }
          } catch (mfaError) {
            // Ignorer l'erreur si l'endpoint n'existe pas encore ou si c'est une 401
            // Ne pas déconnecter l'utilisateur
          }
        } else {
        setError('Utilisateur non trouvé');
      }
    } catch (error: any) {
      // Gérer l'erreur silencieusement, l'utilisateur sera redirigé si nécessaire
      setError('Erreur lors du chargement');
    }
    };
    loadUser();
  }, []);

  const refreshUser = async () => {
    try {
      // Utiliser refreshUser() qui fait un vrai appel API au lieu de getCurrentUser() qui retourne le cache
      const currentUser = await authService.refreshUser();
      if (currentUser) {
        setUser(currentUser);
      }
    } catch (error) {
      // En cas d'erreur, essayer quand même de récupérer depuis le cache
      try {
        const cachedUser = await authService.getCurrentUser();
        if (cachedUser) {
          setUser(cachedUser);
        }
      } catch (cacheError) {
        // Erreur silencieuse
      }
    }
  };

  const handleEnable2FA = async () => {
    if (loading || enabling) return;

    try {
      setEnabling(true);
      const response = await api.post('/api/auth/2fa/setup', {}, {
        skipAuthError: true, // Ne pas déconnecter en cas d'erreur 401
      });
      // La réponse contient: { secret, otpauthUrl, manualEntryKey }
      setMfaSecret({
        secret: response.data.secret,
        otpauthUrl: response.data.otpauthUrl,
        manualEntryKey: response.data.manualEntryKey,
      });
      setMfaSetupStep('setup');
    } catch (error: any) {
      // TOUJOURS utiliser le message du backend en priorité
      const backendError = error.response?.data?.error;
      const errorMessage = backendError || error.message || 'Impossible d\'activer l\'authentification à deux facteurs';
      if (error.response?.status === 401) {
        Alert.alert(
          'Session expirée',
          'Votre session a expiré. Veuillez vous reconnecter.',
          [
            {
              text: 'OK',
              onPress: async () => {
                await authService.logout();
              },
            },
          ]
        );
      } else {
        Alert.alert('Erreur', errorMessage);
      }
    } finally {
      setEnabling(false);
    }
  };

  const handleVerifyAndEnable = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      Alert.alert('Erreur', 'Veuillez entrer un code à 6 chiffres');
      return;
    }

    try {
      setIsVerifying(true);
      // Selon GesFlow, on envoie seulement le code, pas le secret
      await api.post('/api/auth/2fa/verify', {
        code: verificationCode,
      }, {
        skipAuthError: true, // Ne pas déconnecter en cas d'erreur 401
      });
      await refreshUser();
      Alert.alert('Succès', 'Authentification à deux facteurs activée avec succès', [
        {
          text: 'OK',
          onPress: () => {
            setMfaSecret(null);
            setMfaSetupStep('idle');
            setVerificationCode('');
          },
        },
      ]);
    } catch (error: any) {
      // TOUJOURS utiliser le message du backend en priorité
      const backendError = error.response?.data?.error;
      const errorMessage = backendError || error.message || 'Code invalide';
      if (error.response?.status === 401) {
        Alert.alert(
          'Session expirée',
          'Votre session a expiré. Veuillez vous reconnecter.',
          [
            {
              text: 'OK',
              onPress: async () => {
                await authService.logout();
              },
            },
          ]
        );
      } else {
        Alert.alert('Erreur', errorMessage);
      }
    } finally {
      setIsVerifying(false);
    }
  };

  const handleDisable2FA = async () => {
    if (!mfaDisableCode || mfaDisableCode.length !== 6) {
      Alert.alert('Erreur', 'Veuillez entrer un code à 6 chiffres pour désactiver MFA');
      return;
    }

    try {
      setLoading(true);
      // Selon GesFlow, on envoie le code pour désactiver
      await api.post('/api/auth/2fa/disable', {
        code: mfaDisableCode,
      }, {
        skipAuthError: true, // Ne pas déconnecter en cas d'erreur 401
      });
      await refreshUser();
      setMfaDisableCode('');
      Alert.alert('Succès', 'Authentification à deux facteurs désactivée');
    } catch (error: any) {
      // TOUJOURS utiliser le message du backend en priorité
      const backendError = error.response?.data?.error;
      const errorMessage = backendError || error.message || 'Impossible de désactiver l\'authentification à deux facteurs';
      if (error.response?.status === 401) {
        Alert.alert(
          'Session expirée',
          'Votre session a expiré. Veuillez vous reconnecter.',
          [
            {
              text: 'OK',
              onPress: async () => {
                await authService.logout();
              },
            },
          ]
        );
      } else {
        Alert.alert('Erreur', errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const isEnabled = user?.twoFactorEnabled || false;

  // Si erreur de chargement, afficher un message
  if (error && !user) {
    return (
      <SafeAreaView 
        className={`flex-1 ${isDark ? 'bg-[#0f172a]' : 'bg-white'}`}
        edges={['top', 'bottom']}
      >
        <ScreenHeader title="2FA" />
        <View className="flex-1 items-center justify-center px-6">
          <Text className={`text-base ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            {error}
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView 
      className={`flex-1 ${isDark ? 'bg-[#0f172a]' : 'bg-white'}`}
      edges={['top', 'bottom']}
    >
      <ScreenHeader title="2FA" />
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-6 pt-20 pb-4">
          {/* Statut actuel */}
          <View
            className={`mb-6 rounded-xl p-4 ${
              isDark ? 'bg-[#1e293b]' : 'bg-gray-50'
            }`}
            style={styles.card}
          >
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center flex-1">
                <View
                  className="w-12 h-12 rounded-full items-center justify-center mr-3"
                  style={{
                    backgroundColor: isDark ? 'rgba(14, 165, 233, 0.2)' : 'rgba(14, 165, 233, 0.1)',
                  }}
                >
                  <HugeiconsIcon 
                    icon={ShieldIcon} 
                    size={24} 
                    color="#0ea5e9"
                  />
                </View>
                <View className="flex-1">
                  <Text
                    className={`text-base font-semibold mb-1 ${
                      isDark ? 'text-gray-100' : 'text-gray-900'
                    }`}
                  >
                    Statut
                  </Text>
                  <View className="flex-row items-center">
                    <HugeiconsIcon 
                      icon={isEnabled ? CheckmarkCircle02Icon : Cancel01Icon} 
                      size={16} 
                      color={isEnabled ? '#10b981' : '#ef4444'} 
                    />
                    <Text
                      className={`ml-2 text-sm ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      {isEnabled ? 'Activée' : 'Désactivée'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>

          {/* Description */}
          <View
            className={`mb-6 rounded-xl p-4 ${
              isDark ? 'bg-[#1e293b]' : 'bg-gray-50'
            }`}
            style={styles.card}
          >
            <Text
              className={`text-sm leading-6 ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}
            >
              L'authentification à deux facteurs (2FA) ajoute une couche supplémentaire de sécurité à votre compte. 
              Après activation, vous devrez entrer un code à 6 chiffres généré par Microsoft Authenticator 
              en plus de votre mot de passe lors de la connexion.
              {"\n\n"}
              <Text className={isDark ? 'text-yellow-400' : 'text-yellow-700'}>
                ⚠️ Important : Scannez le QR code ci-dessous avec Microsoft Authenticator pour activer le 2FA.
              </Text>
            </Text>
          </View>

          {!isEnabled ? (
            <>
              {mfaSetupStep === "setup" && mfaSecret ? (
                <>
                  {/* Étape 1 : Scanner le QR Code */}
                  <View
                    className={`mb-6 rounded-xl p-4 ${
                      isDark ? 'bg-[#1e293b]' : 'bg-gray-50'
                    }`}
                    style={styles.card}
                  >
                    <Text
                      className={`text-base font-semibold mb-2 ${
                        isDark ? 'text-gray-100' : 'text-gray-900'
                      }`}
                    >
                      Étape 1 : Scanner le QR Code
                    </Text>
                    <Text
                      className={`text-sm mb-4 ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      Scannez ce QR code avec Microsoft Authenticator ou entrez la clé manuellement
                    </Text>
                    <View className="items-center mb-4">
                      <View className={`p-4 rounded-lg ${isDark ? 'bg-white' : 'bg-white'}`} style={styles.qrContainer}>
                        <Image
                          source={{
                            uri: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(mfaSecret.otpauthUrl)}`,
                          }}
                          style={styles.qrCode}
                          resizeMode="contain"
                        />
                      </View>
                      <View className="w-full mt-4">
                        <Text
                          className={`text-sm mb-2 ${
                            isDark ? 'text-gray-300' : 'text-gray-700'
                          }`}
                        >
                          Ou entrez cette clé manuellement :
                        </Text>
                        <View className="flex-row items-center gap-2">
                          <TextInput
                            value={mfaSecret.manualEntryKey}
                            editable={false}
                            className={`flex-1 p-3 rounded-lg font-mono text-sm ${
                              isDark ? 'bg-[#0f172a] text-white' : 'bg-white text-gray-900'
                            }`}
                            style={{
                              borderWidth: 1,
                              borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                            }}
                          />
                          <TouchableOpacity
                            onPress={() => {
                              Clipboard.setString(mfaSecret.manualEntryKey);
                              Alert.alert('Succès', 'Clé copiée dans le presse-papiers');
                            }}
                            className={`px-4 py-3 rounded-lg ${
                              isDark ? 'bg-[#1e293b]' : 'bg-gray-100'
                            }`}
                          >
                            <Text className={isDark ? 'text-gray-300' : 'text-gray-700'}>Copier</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Étape 2 : Vérifier le code */}
                  <View
                    className={`mb-6 rounded-xl p-4 ${
                      isDark ? 'bg-[#1e293b]' : 'bg-gray-50'
                    }`}
                    style={styles.card}
                  >
                    <Text
                      className={`text-base font-semibold mb-2 ${
                        isDark ? 'text-gray-100' : 'text-gray-900'
                      }`}
                    >
                      Étape 2 : Vérifier le code
                    </Text>
                    <Text
                      className={`text-sm mb-4 ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}
                    >
                      Entrez le code à 6 chiffres généré par Microsoft Authenticator
                    </Text>
                    <TextInput
                      value={verificationCode}
                      onChangeText={(text) => setVerificationCode(text.replace(/\D/g, '').slice(0, 6))}
                      placeholder="000000"
                      placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'}
                      keyboardType="number-pad"
                      maxLength={6}
                      className={`text-center text-2xl font-bold py-3 rounded-lg ${
                        isDark ? 'bg-[#0f172a] text-white' : 'bg-white text-gray-900'
                      }`}
                      style={{
                        letterSpacing: 8,
                        borderWidth: 1,
                        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                      }}
                    />
                    <View className="flex-row gap-2 mt-4">
                      <TouchableOpacity
                        onPress={handleVerifyAndEnable}
                        disabled={isVerifying || verificationCode.length !== 6}
                        className={`flex-1 rounded-xl p-4 flex-row items-center justify-center ${
                          isDark ? 'bg-blue-900/30' : 'bg-blue-50'
                        }`}
                        style={{
                          opacity: verificationCode.length === 6 ? 1 : 0.5,
                        }}
                        activeOpacity={0.7}
                      >
                        {isVerifying ? (
                          <ActivityIndicator size="small" color="#0ea5e9" />
                        ) : (
                          <>
                            <HugeiconsIcon icon={CheckmarkCircle02Icon} size={20} color="#0ea5e9" />
                            <Text className="text-base font-semibold text-blue-500 ml-3">
                              Activer MFA
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => {
                          setMfaSetupStep('idle');
                          setMfaSecret(null);
                          setVerificationCode('');
                        }}
                        className={`px-4 py-4 rounded-xl ${
                          isDark ? 'bg-[#1e293b]' : 'bg-gray-100'
                        }`}
                      >
                        <Text className={isDark ? 'text-gray-300' : 'text-gray-700'}>Annuler</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : (
                <>
                  {enabling ? (
                    <View className="items-center py-8">
                      <ActivityIndicator size="large" color="#0ea5e9" />
                      <Text className={`text-sm mt-4 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                        Chargement du QR code...
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      onPress={handleEnable2FA}
                      disabled={enabling}
                      className={`rounded-xl p-4 flex-row items-center justify-center ${
                        isDark ? 'bg-blue-900/30' : 'bg-blue-50'
                      }`}
                      style={styles.button}
                      activeOpacity={0.7}
                    >
                      <HugeiconsIcon icon={ShieldIcon} size={20} color="#0ea5e9" />
                      <Text className="text-base font-semibold text-blue-500 ml-3">
                        {mfaSecret ? 'Recharger le QR code' : 'Afficher le QR code'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </>
          ) : (
            <>
              {/* Statut MFA activé */}
              <View
                className={`mb-6 rounded-xl p-4 ${
                  isDark ? 'bg-green-900/20' : 'bg-green-50'
                }`}
                style={styles.card}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center flex-1">
                    <HugeiconsIcon icon={CheckmarkCircle02Icon} size={24} color="#10b981" />
                    <View className="ml-3 flex-1">
                      <Text
                        className={`text-base font-semibold ${
                          isDark ? 'text-green-100' : 'text-green-900'
                        }`}
                      >
                        MFA Activé
                      </Text>
                      <Text
                        className={`text-sm ${
                          isDark ? 'text-green-300' : 'text-green-700'
                        }`}
                      >
                        Votre compte est protégé par l'authentification à deux facteurs
                      </Text>
                    </View>
                  </View>
                </View>
              </View>

              {/* Section désactivation */}
              <View
                className={`mb-6 rounded-xl p-4 ${
                  isDark ? 'bg-[#1e293b]' : 'bg-gray-50'
                }`}
                style={styles.card}
              >
                <Text
                  className={`text-base font-semibold mb-2 ${
                    isDark ? 'text-gray-100' : 'text-gray-900'
                  }`}
                >
                  Désactiver MFA
                </Text>
                <Text
                  className={`text-sm mb-4 ${
                    isDark ? 'text-gray-400' : 'text-gray-600'
                  }`}
                >
                  Pour désactiver MFA, vous devez entrer un code de votre Microsoft Authenticator
                </Text>
                <TextInput
                  value={mfaDisableCode}
                  onChangeText={(text) => setMfaDisableCode(text.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  placeholderTextColor={isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.5)'}
                  keyboardType="number-pad"
                  maxLength={6}
                  className={`text-center text-2xl font-bold py-3 rounded-lg ${
                    isDark ? 'bg-[#0f172a] text-white' : 'bg-white text-gray-900'
                  }`}
                  style={{
                    letterSpacing: 8,
                    borderWidth: 1,
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                  }}
                />
                <TouchableOpacity
                  onPress={handleDisable2FA}
                  disabled={loading || mfaDisableCode.length !== 6}
                  className={`mt-4 rounded-xl p-4 flex-row items-center justify-center ${
                    isDark ? 'bg-red-900/30' : 'bg-red-50'
                  }`}
                  style={{
                    opacity: mfaDisableCode.length === 6 ? 1 : 0.5,
                  }}
                  activeOpacity={0.7}
                >
                  {loading ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <>
                      <HugeiconsIcon icon={Cancel01Icon} size={20} color="#ef4444" />
                      <Text className="text-base font-semibold text-red-500 ml-3">
                        Désactiver MFA
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  button: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  qrContainer: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  qrCode: {
    width: 200,
    height: 200,
  },
});

