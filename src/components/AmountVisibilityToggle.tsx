import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useAmountVisibility } from "@/contexts/AmountVisibilityContext";
import { useTheme } from "@/contexts/ThemeContext";
import { authService } from "@/services/auth.service";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { EyeIcon, ViewOffIcon, LockKeyIcon } from "@hugeicons/core-free-icons";
import { Button } from "./ui/Button";
import { InputOTP } from "./ui/InputOTP";

export function AmountVisibilityToggle() {
  const { isAmountVisible, setAmountVisible } = useAmountVisibility();
  const { isDark } = useTheme();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [hasMFA, setHasMFA] = useState(false);
  const [isLoadingMFA, setIsLoadingMFA] = useState(true);

  useEffect(() => {
    const fetchMFAStatus = async () => {
      try {
        const enabled = await authService.checkMFAStatus();
        setHasMFA(enabled);
      } catch (error) {
        // Ignore error
      } finally {
        setIsLoadingMFA(false);
      }
    };

    fetchMFAStatus();
  }, []);

  const handleToggle = () => {
    if (isAmountVisible) {
      // Masquer les montants - pas besoin de validation
      setAmountVisible(false);
    } else {
      // Afficher les montants - nécessite validation OTP si MFA activé
      if (hasMFA) {
        setIsModalOpen(true);
      } else {
        // Pas de MFA, afficher directement
        setAmountVisible(true);
      }
    }
  };

  const handleOTPSubmit = async () => {
    if (otpCode.length !== 6) {
      Alert.alert("Code invalide", "Veuillez entrer un code à 6 chiffres.");
      return;
    }

    setIsValidating(true);

    try {
      const success = await authService.validateOTPUnlock(otpCode);

      if (success) {
        setAmountVisible(true);
        setIsModalOpen(false);
        setOtpCode("");
      } else {
        Alert.alert(
          "Code invalide",
          "Le code d'authentification est incorrect."
        );
      }
    } catch (error) {
      Alert.alert(
        "Erreur",
        "Une erreur est survenue lors de la validation du code."
      );
    } finally {
      setIsValidating(false);
    }
  };

  const handleModalClose = () => {
    if (!isValidating) {
      setIsModalOpen(false);
      setOtpCode("");
    }
  };

  if (isLoadingMFA) {
    return (
      <TouchableOpacity
        disabled
        className="h-10 w-10 rounded-full items-center justify-center bg-transparent"
      >
        <HugeiconsIcon icon={EyeIcon} size={20} color={isDark ? "#9ca3af" : "#9ca3af"} />
      </TouchableOpacity>
    );
  }

  return (
    <>
      <TouchableOpacity
        onPress={handleToggle}
        className="h-10 w-10 rounded-full items-center justify-center bg-transparent"
      >
        {isAmountVisible ? (
          <HugeiconsIcon icon={EyeIcon} size={20} color={isDark ? "#0ea5e9" : "#0ea5e9"} />
        ) : (
          <HugeiconsIcon icon={ViewOffIcon} size={20} color={isDark ? "#fb923c" : "#ea580c"} />
        )}
      </TouchableOpacity>

      <Modal
        visible={isModalOpen}
        transparent
        animationType="fade"
        onRequestClose={handleModalClose}
      >
        <View className="flex-1 bg-black/50 items-center justify-center p-4">
          <View
            className={`w-full max-w-md rounded-lg p-6 ${
              isDark ? "bg-[#0F0F12]" : "bg-white"
            }`}
          >
            <View className="flex-row items-center gap-2 mb-4">
              <HugeiconsIcon icon={LockKeyIcon} size={20} color="#0ea5e9" />
              <Text
                className={`text-lg font-semibold ${
                  isDark ? "text-gray-100" : "text-gray-900"
                }`}
              >
                Afficher les montants
              </Text>
            </View>

            <Text
              className={`text-sm mb-4 ${
                isDark ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Pour afficher les montants, veuillez entrer le code
              d'authentification à 6 chiffres de votre application Microsoft
              Authenticator.
            </Text>

            <View className="mb-4 items-center justify-center">
              <InputOTP
                maxLength={6}
                value={otpCode}
                onChange={(value) => setOtpCode(value)}
                disabled={isValidating}
                autoFocus={true}
              />
            </View>

            <View className="flex-row gap-2">
              <Button
                variant="outline"
                onPress={handleModalClose}
                disabled={isValidating}
                className="flex-1"
                style={{
                  borderColor: isDark ? "#374151" : "#d1d5db",
                }}
              >
                <Text
                  className={`text-sm font-medium ${
                    isDark ? "text-gray-100" : "text-gray-900"
                  }`}
                >
                  Annuler
                </Text>
              </Button>
              <Button
                onPress={handleOTPSubmit}
                disabled={isValidating || otpCode.length !== 6}
                className="flex-1"
              >
                {isValidating ? "Vérification..." : "Valider"}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}
