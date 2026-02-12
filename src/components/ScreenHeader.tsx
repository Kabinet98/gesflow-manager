import React from "react";
import { View, TouchableOpacity, StyleSheet, Text } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "@/contexts/ThemeContext";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowLeft01Icon } from "@hugeicons/core-free-icons";
import { AmountVisibilityToggle } from "./AmountVisibilityToggle";
import { Avatar } from "./Avatar";

interface ScreenHeaderProps {
  showBack?: boolean;
  title?: string;
}

export function ScreenHeader({ showBack = true, title }: ScreenHeaderProps) {
  const navigation = useNavigation();
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  // Ne pas afficher le bouton back sur les screens qui sont dans les tabs
  const isTabScreen = ["Dashboard", "Companies", "Expenses", "More"].includes(
    route.name
  );
  const shouldShowBack = showBack && !isTabScreen;

  // Titre par défaut basé sur le nom de la route
  const getDefaultTitle = () => {
    const routeName = route.name;
    const titleMap: Record<string, string> = {
      Settings: "Paramètres",
      Profile: "Paramètres",
      Roles: "Rôles & Permissions",
      Alerts: "Alertes",
      ActivitySectors: "Secteurs d'activité",
      InvestmentCategories: "Catégories d'investissements",
      Statistics: "Statistiques",
      TwoFactorAuth: "2FA",
      SecurityQuestions: "Sécurité",
      Investments: "Investissements",
      Loans: "Emprunts",
      Dat: "Placements",
      Banks: "Banques",
      Users: "Utilisateurs",
      Logs: "Logs",
    };
    return titleMap[routeName] || routeName;
  };

  // Fonction pour raccourcir les titres longs
  const shortenTitle = (text: string): string => {
    const maxLength = 20; // Longueur maximale avant raccourcissement

    if (text.length <= maxLength) {
      return text;
    }

    // Mappings spécifiques pour les titres longs
    const shortcuts: Record<string, string> = {
      "Authentification à deux facteurs": "2FA",
      "Authentification à double facteur": "2FA",
      "Questions de sécurité": "Sécurité",
      "Rôles & Permissions": "Rôles",
      "Secteurs d'activité": "Secteurs",
      "Catégories d'investissements": "Catégories",
      "Investment Categories": "Catégories",
      "Activity Sectors": "Secteurs",
    };

    // Vérifier si on a un raccourci spécifique
    if (shortcuts[text]) {
      return shortcuts[text];
    }

    // Sinon, tronquer intelligemment
    // Chercher le dernier espace avant la limite
    const truncated = text.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(" ");

    if (lastSpace > maxLength * 0.6) {
      // Si on trouve un espace dans les 60% de la longueur, tronquer là
      return truncated.substring(0, lastSpace) + "...";
    }

    // Sinon, tronquer simplement
    return truncated + "...";
  };

  const defaultTitle = title || getDefaultTitle();
  const displayTitle = shortenTitle(defaultTitle);

  const handleBack = () => {
    if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          backgroundColor: isDark ? "#0f172a" : "#ffffff",
        },
      ]}
    >
      <View style={styles.content}>
        {shouldShowBack && (
          <TouchableOpacity
            onPress={handleBack}
            style={styles.backButton}
            activeOpacity={0.7}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} size={24} color="#0ea5e9" />
          </TouchableOpacity>
        )}
        {displayTitle && (
          <Text
            style={[
              styles.title,
              { color: isDark ? "#f1f5f9" : "#0f172a" },
              shouldShowBack && styles.titleWithBack,
            ]}
          >
            {displayTitle}
          </Text>
        )}
      </View>
      <View style={styles.rightContent}>
        <AmountVisibilityToggle />
        <Avatar />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    // Ombre subtile pour la profondeur
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  content: {
    flexDirection: "row",
    alignItems: "center",
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    marginLeft: 12,
  },
  titleWithBack: {
    marginLeft: 8,
  },
  rightContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
});
