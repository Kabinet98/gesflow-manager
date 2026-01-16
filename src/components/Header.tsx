import React from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRoute } from "@react-navigation/native";
import { AmountVisibilityToggle } from "@/components/AmountVisibilityToggle";
import { Avatar } from "@/components/Avatar";
import { useTheme } from "@/contexts/ThemeContext";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { FilterIcon, Calendar03Icon } from "@hugeicons/core-free-icons";

interface HeaderProps {
  yearFilter?: {
    availableYears?: string[];
    selectedYear: string | null;
    onYearChange: (year: string | null) => void;
    showYearPicker: boolean;
    setShowYearPicker: (show: boolean) => void;
  };
  onOpenFilters?: () => void;
  hasFilters?: boolean;
  activeFiltersCount?: number;
}

export function Header({ yearFilter, onOpenFilters, hasFilters, activeFiltersCount = 0 }: HeaderProps) {
  const route = useRoute();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  // Titre par défaut basé sur le nom de la route
  const getDefaultTitle = () => {
    const routeName = route.name;
    const titleMap: Record<string, string> = {
      Dashboard: "Dashboard",
      Companies: "Entreprises",
      Expenses: "Dépenses",
      Investments: "Investissements",
      Loans: "Emprunts",
      Dat: "DAT",
      Banks: "Banques",
      Users: "Utilisateurs",
      Roles: "Rôles & Permissions",
      Alerts: "Alertes",
      ActivitySectors: "Secteurs d'activité",
      InvestmentCategories: "Catégories d'investissements",
      Statistics: "Statistiques",
      Logs: "Logs",
      Settings: "Paramètres",
      Profile: "Paramètres",
      TwoFactorAuth: "2FA",
      SecurityQuestions: "Sécurité",
    };
    return titleMap[routeName] || routeName;
  };

  const displayTitle = getDefaultTitle();
  const isDashboard = route.name === "Dashboard";

  // Pour les tab screens (sauf Dashboard), afficher le titre dans le header à gauche de toggleview et avatarTab
  const isTabScreen = [
    "Dashboard",
    "Companies",
    "Expenses",
    "Investments",
    "Loans",
    "Dat",
    "Banks",
    "Users",
    "Logs",
    "More",
  ].includes(route.name);
  const shouldShowTitle =
    !isTabScreen || (isTabScreen && route.name !== "Dashboard");

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top + 8,
          backgroundColor: isDark ? "#0f172a" : "#ffffff",
        },
      ]}
    >
      <View style={styles.content}>
        {isDashboard && (
          <Text
            style={[styles.title, { color: isDark ? "#f1f5f9" : "#0f172a" }]}
            numberOfLines={1}
          >
            {displayTitle}
          </Text>
        )}
        {shouldShowTitle && !isDashboard && (
          <Text
            style={[styles.title, { color: isDark ? "#f1f5f9" : "#0f172a" }]}
            numberOfLines={1}
          >
            {displayTitle}
          </Text>
        )}
        <View
          style={[
            styles.rightContent,
            (shouldShowTitle || isDashboard) && styles.rightContentWithTitle,
          ]}
        >
          {/* Bouton Filtre pour Dashboard admin */}
          {isDashboard && hasFilters && onOpenFilters && (
            <TouchableOpacity
              onPress={onOpenFilters}
              style={[
                styles.filterButton,
                {
                  backgroundColor: isDark ? "#1e293b" : "#ffffff",
                  borderColor: isDark ? "#374151" : "#e5e7eb",
                },
              ]}
            >
              <HugeiconsIcon
                icon={FilterIcon}
                size={18}
                color={isDark ? "#9ca3af" : "#6b7280"}
              />
              <Text
                style={[
                  styles.filterButtonText,
                  { color: isDark ? "#f1f5f9" : "#111827" },
                ]}
              >
                Filtre
              </Text>
              {activeFiltersCount > 0 && (
                <View
                  style={{
                    position: "absolute",
                    top: -4,
                    right: -4,
                    backgroundColor: "#0ea5e9",
                    borderRadius: 10,
                    minWidth: 20,
                    height: 20,
                    paddingHorizontal: 6,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <Text
                    style={{
                      color: "#ffffff",
                      fontSize: 11,
                      fontWeight: "600",
                    }}
                  >
                    {activeFiltersCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          )}
          {/* Filtre Année pour les managers (Dashboard et autres écrans) */}
          {yearFilter &&
            yearFilter.availableYears &&
            Array.isArray(yearFilter.availableYears) &&
            yearFilter.availableYears.length > 0 && (
              <>
                <TouchableOpacity
                  onPress={() =>
                    yearFilter &&
                    yearFilter.setShowYearPicker &&
                    yearFilter.setShowYearPicker(!yearFilter.showYearPicker)
                  }
                  style={[
                    styles.yearFilterContainer,
                    {
                      backgroundColor: isDark ? "#1e293b" : "#ffffff",
                      borderColor: isDark ? "#374151" : "#e5e7eb",
                    },
                  ]}
                >
                  <HugeiconsIcon
                    icon={Calendar03Icon}
                    size={16}
                    color={isDark ? "#9ca3af" : "#6b7280"}
                  />
                  <Text
                    style={[
                      styles.yearFilterText,
                      { color: isDark ? "#f1f5f9" : "#111827" },
                    ]}
                  >
                    {yearFilter?.selectedYear || "Toutes"}
                  </Text>
                  <Text
                    style={[
                      styles.yearFilterArrow,
                      { color: isDark ? "#6b7280" : "#9ca3af" },
                    ]}
                  >
                    ▼
                  </Text>
                </TouchableOpacity>
                {yearFilter &&
                  yearFilter.availableYears &&
                  Array.isArray(yearFilter.availableYears) && (
                    <Modal
                      visible={yearFilter.showYearPicker || false}
                      transparent={true}
                      animationType="fade"
                      onRequestClose={() =>
                        yearFilter?.setShowYearPicker &&
                        yearFilter.setShowYearPicker(false)
                      }
                    >
                      <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() =>
                          yearFilter?.setShowYearPicker &&
                          yearFilter.setShowYearPicker(false)
                        }
                      >
                        <TouchableOpacity
                          activeOpacity={1}
                          onPress={(e) => e.stopPropagation()}
                        >
                          <View
                            style={[
                              styles.yearPickerContainer,
                              {
                                backgroundColor: isDark ? "#1e293b" : "#ffffff",
                                borderColor: isDark ? "#374151" : "#e5e7eb",
                              },
                            ]}
                          >
                            <ScrollView>
                              <TouchableOpacity
                                onPress={() => {
                                  if (yearFilter?.onYearChange)
                                    yearFilter.onYearChange(null);
                                  if (yearFilter?.setShowYearPicker)
                                    yearFilter.setShowYearPicker(false);
                                }}
                                style={[
                                  styles.yearPickerItem,
                                  {
                                    borderBottomColor: isDark
                                      ? "#374151"
                                      : "#e5e7eb",
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.yearPickerText,
                                    { color: isDark ? "#f1f5f9" : "#111827" },
                                  ]}
                                >
                                  Toutes les années
                                </Text>
                              </TouchableOpacity>
                              {yearFilter &&
                                yearFilter.availableYears &&
                                Array.isArray(yearFilter.availableYears) &&
                                yearFilter.availableYears.map(
                                  (year: string) => (
                                    <TouchableOpacity
                                      key={year}
                                      onPress={() => {
                                        if (yearFilter?.onYearChange)
                                          yearFilter.onYearChange(year);
                                        if (yearFilter?.setShowYearPicker)
                                          yearFilter.setShowYearPicker(false);
                                      }}
                                      style={[
                                        styles.yearPickerItem,
                                        yearFilter?.selectedYear === year && {
                                          backgroundColor: isDark
                                            ? "#1e40af"
                                            : "#dbeafe",
                                        },
                                      ]}
                                    >
                                      <Text
                                        style={[
                                          styles.yearPickerText,
                                          {
                                            color:
                                              yearFilter?.selectedYear === year
                                                ? "#3b82f6"
                                                : isDark
                                                  ? "#f1f5f9"
                                                  : "#111827",
                                            fontWeight:
                                              yearFilter?.selectedYear === year
                                                ? "600"
                                                : "400",
                                          },
                                        ]}
                                      >
                                        {year}
                                      </Text>
                                    </TouchableOpacity>
                                  )
                                )}
                            </ScrollView>
                          </View>
                        </TouchableOpacity>
                      </TouchableOpacity>
                    </Modal>
                  )}
              </>
            )}
          <View style={styles.rightActions}>
            <AmountVisibilityToggle />
            <Avatar />
          </View>
        </View>
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
    paddingHorizontal: 16,
    paddingBottom: 12,
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
    justifyContent: "space-between",
    flex: 1,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    flex: 1,
    marginRight: 12,
  },
  rightContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "flex-end",
  },
  rightContentWithTitle: {
    flex: 0,
    marginLeft: "auto",
  },
  filterButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999, // rounded-full
    borderWidth: 1,
  },
  filterButtonText: {
    fontSize: 13,
    fontWeight: "500",
  },
  yearFilterContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9999, // rounded-full
    borderWidth: 1,
  },
  rightActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginLeft: "auto", // Pousse vers la droite au fond
  },
  yearFilterText: {
    fontSize: 13,
    fontWeight: "500",
  },
  yearFilterArrow: {
    fontSize: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  pickerContainer: {
    position: "absolute",
    top: 120,
    left: 24,
    right: 24,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 300,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  pickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  pickerText: {
    fontSize: 14,
  },
  yearPickerContainer: {
    position: "absolute",
    top: 120,
    left: 24,
    right: 24,
    borderRadius: 12,
    borderWidth: 1,
    maxHeight: 300,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  yearPickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  yearPickerText: {
    fontSize: 14,
  },
});
