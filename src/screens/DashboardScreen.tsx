import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Modal,
  Dimensions,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import api from "@/config/api";
import { useTheme } from "@/contexts/ThemeContext";
import { usePermissions } from "@/hooks/usePermissions";
import { TAB_BAR_PADDING_BOTTOM, REFRESH_CONTROL_COLOR } from "@/constants/layout";
import { authService } from "@/services/auth.service";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  Home03Icon,
  Building04Icon,
  Calendar03Icon,
  ArrowRight01Icon,
  ArrowLeft01Icon,
  Activity03Icon,
} from "@hugeicons/core-free-icons";
import { DashboardSkeleton } from "@/components/skeletons/DashboardSkeleton";
import { Header } from "@/components/Header";
import { EnhancedBarChart } from "@/components/charts/EnhancedBarChart";
import { SimpleLineChart } from "@/components/charts/SimpleLineChart";
import { PieChartComponent } from "@/components/charts/PieChart";
import { BudgetPredictionChart } from "@/components/charts/BudgetPredictionChart";
import { BlurredAmount } from "@/components/BlurredAmount";
import { Drawer } from "@/components/ui/Drawer";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export function DashboardScreen() {
  const { isDark } = useTheme();
  const { hasPermission } = usePermissions();
  const [refreshing, setRefreshing] = useState(false);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  // Initialiser avec l'année en cours par défaut (sera ajustée quand les années disponibles sont chargées)
  const currentYear = new Date().getFullYear().toString();
  const [selectedYear, setSelectedYear] = useState<string | null>("all");
  const [selectedActivitySector, setSelectedActivitySector] = useState<string | null>(null);
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"evolution" | "repartition">(
    "evolution"
  );
  const [showYearPicker, setShowYearPicker] = useState(false);
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);
  const [showScrollIndicator, setShowScrollIndicator] = useState(false);
  const [showLeftScrollIndicator, setShowLeftScrollIndicator] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const statsScrollViewRef = useRef<ScrollView>(null);

  // Récupérer le companyId de l'utilisateur s'il est gestionnaire
  useEffect(() => {
    const fetchUserCompany = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          // Vérifier si l'utilisateur est un gestionnaire en récupérant ses informations complètes
          const response = await api.get("/api/users/me");
          const fullUser = response.data;

          // Vérifier si l'utilisateur a un rôle de gestionnaire ou admin
          const roleName = fullUser?.role?.name?.toLowerCase() || "";
          const isManagerRole =
            roleName.includes("gestionnaire") || roleName.includes("manager");
          const isAdminRole = roleName.includes("admin") || roleName === "administrateur";

          if (isAdminRole) {
            setIsAdmin(true);
          }

          if (isManagerRole) {
            // Récupérer le companyId depuis l'API spécifique du gestionnaire
            try {
              const managerResponse = await api.get(
                `/api/users/${user.id}/company-manager`
              );
              const manager = managerResponse.data;

              if (manager?.companyId) {
                setUserCompanyId(manager.companyId);
                setIsManager(true);
              }
            } catch (managerErr: any) {
              // Si 404, l'utilisateur n'est pas un gestionnaire avec entreprise assignée
            }
          }
        }
      } catch (err: any) {
        // Erreur silencieuse
      }
    };

    fetchUserCompany();
  }, []);

  // Récupérer les années disponibles
  const { data: availableYears } = useQuery({
    queryKey: ["available-years", userCompanyId, selectedCompany],
    queryFn: async () => {
      if (isManager && userCompanyId) {
        try {
          const response = await api.get(
            `/api/dashboard/available-years?companyId=${userCompanyId}`
          );
          return Array.isArray(response.data) ? response.data : [];
        } catch (err) {
          return [];
        }
      } else if (isAdmin) {
        // Pour les admins, récupérer les années disponibles (avec ou sans filtres)
        try {
          const companyParam = selectedCompany ? `?companyId=${selectedCompany}` : "";
          const response = await api.get(
            `/api/dashboard/available-years${companyParam}`
          );
          return Array.isArray(response.data) ? response.data : [];
        } catch (err) {
          return [];
        }
      }
      return [];
    },
    enabled: (isManager && !!userCompanyId) || isAdmin,
  });

  // S'assurer que availableYears est toujours un tableau et trier par ordre décroissant (comme gesflow)
  const safeAvailableYears = Array.isArray(availableYears)
    ? [...availableYears].sort((a: string, b: string) => b.localeCompare(a))
    : [];

  // Ajuster l'année sélectionnée si elle n'est plus disponible (comme gesflow)
  useEffect(() => {
    // Ne pas ajuster si "all" est sélectionné
    if (selectedYear === "all") {
      return;
    }
    
    if (safeAvailableYears.length > 0 && selectedYear && !safeAvailableYears.includes(selectedYear)) {
      // Si l'année courante est disponible, l'utiliser, sinon utiliser la première année disponible (la plus récente)
      if (safeAvailableYears.includes(currentYear)) {
        setSelectedYear(currentYear);
      } else {
        setSelectedYear(safeAvailableYears[0]); // Première année = la plus récente (tri décroissant)
      }
    } else if (safeAvailableYears.length > 0 && !selectedYear) {
      // Si aucune année n'est sélectionnée, utiliser la première disponible (la plus récente)
      setSelectedYear(safeAvailableYears[0]);
    }
  }, [safeAvailableYears, selectedYear, currentYear]);

  // Récupérer les secteurs d'activité (pour les admins)
  const { data: activitySectors } = useQuery({
    queryKey: ["activity-sectors"],
    queryFn: async () => {
      try {
        const response = await api.get("/api/activity-sectors");
        return response.data || [];
      } catch (err) {
        return [];
      }
    },
    enabled: isAdmin,
  });

  // Récupérer les entreprises (pour les admins)
  const { data: companies } = useQuery({
    queryKey: ["companies", selectedActivitySector],
    queryFn: async () => {
      try {
        const sectorParam = selectedActivitySector ? `?activitySectorId=${selectedActivitySector}` : "";
        const response = await api.get(`/api/companies${sectorParam}`);
        return response.data || [];
      } catch (err) {
        return [];
      }
    },
    enabled: isAdmin,
  });

  // Initialiser avec la première entreprise disponible et gérer les changements de secteur
  useEffect(() => {
    if (!isAdmin || !companies || !Array.isArray(companies) || companies.length === 0) {
      return;
    }

    if (selectedActivitySector !== null) {
      // Si un secteur est sélectionné, filtrer les entreprises de ce secteur
      const filteredCompanies = companies.filter(
        (company: any) => company.activitySectorId === selectedActivitySector
      );
      if (filteredCompanies.length > 0) {
        // Sélectionner la première entreprise du secteur si aucune n'est sélectionnée
        // ou si l'entreprise actuelle n'est plus dans le secteur
        const currentCompanyInSector = filteredCompanies.some(
          (c: any) => c.id === selectedCompany
        );
        if (!selectedCompany || !currentCompanyInSector) {
          setSelectedCompany(filteredCompanies[0].id);
        }
      } else {
        // Aucune entreprise dans ce secteur
        setSelectedCompany(null);
      }
    } else {
      // Si aucun secteur n'est sélectionné, sélectionner la première entreprise disponible
      if (!selectedCompany) {
        setSelectedCompany(companies[0].id);
      }
    }
  }, [selectedActivitySector, companies, selectedCompany, isAdmin]);

  const {
    data: stats,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["dashboard-stats", userCompanyId, isManager, isAdmin, selectedYear, selectedCompany],
    queryFn: async () => {
      // IMPORTANT: Les gestionnaires DOIVENT toujours utiliser company-stats avec leur companyId
      // pour que le backend filtre correctement leurs données (via isManagerOnly et managerFilter)
      if (isManager && userCompanyId) {
        const yearParam = selectedYear ? `&year=${selectedYear}` : "";
        try {
          const response = await api.get(
            `/api/dashboard/company-stats?companyId=${userCompanyId}${yearParam}`
          );
          return response.data;
        } catch (err: any) {
          throw err;
        }
      } else if (isAdmin) {
        // Les admins: si une entreprise est sélectionnée, utiliser company-stats
        // Sinon, utiliser stats globales
        if (selectedCompany) {
          // Stats pour une entreprise spécifique (avec devise correcte)
          const params = new URLSearchParams();
          params.append("companyId", selectedCompany);
          // Si "all" est sélectionné, ne pas passer le paramètre year (comme gesflow)
          if (selectedYear && selectedYear !== "all") {
            params.append("year", selectedYear);
          }
          const url = `/api/dashboard/company-stats?${params.toString()}`;
          try {
            const response = await api.get(url);
            return response.data;
          } catch (err: any) {
            throw err;
          }
        } else {
          // Stats globales (en USD)
          const params = new URLSearchParams();
          if (selectedYear) params.append("year", selectedYear);
          const queryString = params.toString();
          const url = `/api/dashboard/stats${queryString ? `?${queryString}` : ""}`;
          try {
            const response = await api.get(url);
            // Pour les stats globales, ajouter une devise par défaut (USD)
            return {
              ...response.data,
              company: { currency: "USD" },
            };
          } catch (err: any) {
            throw err;
          }
        }
      } else {
        // Gestionnaire sans companyId - ne devrait pas arriver
        throw new Error("Gestionnaire sans entreprise assignée");
      }
    },
    enabled:
      hasPermission("dashboard.view") && (isManager ? !!userCompanyId : isAdmin ? true : false),
  });

  // Vérifier que stats existe et a la structure attendue
  const kpis = stats?.kpis || {};

  // Obtenir la devise correcte selon la sélection
  const getCurrency = (): string => {
    if (selectedCompany && companies && Array.isArray(companies)) {
      const company = companies.find((c: any) => c.id === selectedCompany);
      if (company?.currency) {
        return company.currency;
      }
    }
    // Si une entreprise est sélectionnée mais pas trouvée, utiliser celle des stats
    if (stats?.company?.currency) {
      return stats.company.currency;
    }
    // Stats globales = USD
    return "USD";
  };

  const displayCurrency = getCurrency();

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (err) {
      // Erreur silencieuse
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-[#0f172a]" : "bg-white"}`}
      edges={["top", "bottom"]}
    >
      <Header
        yearFilter={
          isManager && safeAvailableYears.length > 0
            ? {
                availableYears: safeAvailableYears,
                selectedYear,
                onYearChange: setSelectedYear,
                showYearPicker,
                setShowYearPicker,
              }
            : undefined
        }
        onOpenFilters={isAdmin ? () => setShowFiltersDrawer(true) : undefined}
        hasFilters={isAdmin}
        activeFiltersCount={
          isAdmin
            ? [
                selectedActivitySector,
                selectedCompany,
                selectedYear && selectedYear !== "all" ? selectedYear : null,
              ].filter((f) => f !== null).length
            : 0
        }
      />
      {/* Drawer de filtres pour admin */}
      {isAdmin && (
        <Drawer
          open={showFiltersDrawer}
          onOpenChange={setShowFiltersDrawer}
          title="Filtres"
        >
          {/* Header avec Clear all */}
          <View className="flex-row items-center justify-end mb-6">
            <TouchableOpacity
              onPress={() => {
                setSelectedActivitySector(null);
                setSelectedCompany(null);
                // Remettre l'année à "all" (toutes les années)
                setSelectedYear("all");
              }}
              activeOpacity={0.7}
            >
              <Text
                className={`text-sm font-medium ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Clear all
              </Text>
            </TouchableOpacity>
          </View>

          {/* Filtre Secteur d'activité */}
          {activitySectors && activitySectors.length > 0 && (
            <View className="mb-6">
              <Text
                className={`text-sm font-semibold mb-3 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Secteur d'activité
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 24 }}
              >
                <View className="flex-row gap-2">
                  <TouchableOpacity
                    onPress={() => setSelectedActivitySector(null)}
                    className={`px-4 py-2 rounded-full ${
                      selectedActivitySector === null
                        ? "bg-blue-600"
                        : isDark
                          ? "bg-[#0f172a]"
                          : "bg-gray-100"
                    }`}
                    activeOpacity={0.7}
                  >
                    <Text
                      className={`text-xs font-medium ${
                        selectedActivitySector === null
                          ? "text-white"
                          : isDark
                            ? "text-gray-300"
                            : "text-gray-700"
                      }`}
                    >
                      Tous
                    </Text>
                  </TouchableOpacity>
                  {activitySectors.map((sector: any) => (
                    <TouchableOpacity
                      key={sector.id}
                      onPress={() => setSelectedActivitySector(sector.id)}
                      className={`px-4 py-2 rounded-full ${
                        selectedActivitySector === sector.id
                          ? "bg-blue-600"
                          : isDark
                            ? "bg-[#0f172a]"
                            : "bg-gray-100"
                      }`}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          selectedActivitySector === sector.id
                            ? "text-white"
                            : isDark
                              ? "text-gray-300"
                              : "text-gray-700"
                        }`}
                      >
                        {sector.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Filtre Entreprise - Afficher uniquement les entreprises du secteur sélectionné */}
          {companies && Array.isArray(companies) && companies.length > 0 && (
            <View className="mb-6">
              <Text
                className={`text-sm font-semibold mb-3 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Entreprise
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 24 }}
              >
                <View className="flex-row gap-2">
                  {companies
                    .filter((company: any) => {
                      // Si un secteur est sélectionné, filtrer les entreprises de ce secteur
                      if (selectedActivitySector) {
                        return company.activitySectorId === selectedActivitySector;
                      }
                      // Sinon, afficher toutes les entreprises
                      return true;
                    })
                    .map((company: any) => (
                      <TouchableOpacity
                        key={company.id}
                        onPress={() => setSelectedCompany(company.id)}
                        className={`px-4 py-2 rounded-full ${
                          selectedCompany === company.id
                            ? "bg-blue-600"
                            : isDark
                              ? "bg-[#0f172a]"
                              : "bg-gray-100"
                        }`}
                        activeOpacity={0.7}
                      >
                        <Text
                          className={`text-xs font-medium ${
                            selectedCompany === company.id
                              ? "text-white"
                              : isDark
                                ? "text-gray-300"
                                : "text-gray-700"
                          }`}
                        >
                          {company.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* Filtre Année */}
          {safeAvailableYears && safeAvailableYears.length > 0 && (
            <View className="mb-6">
              <Text
                className={`text-sm font-semibold mb-3 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Année
              </Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingRight: 24 }}
              >
                <View className="flex-row gap-2">
                  {safeAvailableYears.map((year: string) => (
                    <TouchableOpacity
                      key={year}
                      onPress={() => setSelectedYear(year)}
                      className={`px-4 py-2 rounded-full ${
                        selectedYear === year
                          ? "bg-blue-600"
                          : isDark
                            ? "bg-[#0f172a]"
                            : "bg-gray-100"
                      }`}
                      activeOpacity={0.7}
                    >
                      <Text
                        className={`text-xs font-medium ${
                          selectedYear === year
                            ? "text-white"
                            : isDark
                              ? "text-gray-300"
                              : "text-gray-700"
                        }`}
                      >
                        {year}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}
        </Drawer>
      )}
      <ScrollView
        className="flex-1"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={isDark ? "#38bdf8" : REFRESH_CONTROL_COLOR}
            colors={isDark ? ["#38bdf8"] : [REFRESH_CONTROL_COLOR]}
          />
        }
        contentContainerStyle={{
          paddingBottom: TAB_BAR_PADDING_BOTTOM,
        }}
      >
        <View className="px-6 pt-20 pb-4">
          {/* Nom entreprise - affiché en haut, visible */}
          {!isLoading && stats?.company && (
            <View className="mb-4">
              <View
                className={`flex-row items-center gap-2 px-3 py-1.5 rounded-full self-start ${
                  isDark
                    ? "bg-primary-dynamic/10 border border-primary-dynamic/20"
                    : "bg-primary-dynamic/10 border border-primary-dynamic/20"
                }`}
              >
                <HugeiconsIcon
                  icon={Building04Icon}
                  size={16}
                  color="#0ea5e9"
                />
                <Text
                  className={`text-sm font-semibold ${
                    isDark ? "text-gray-100" : "text-gray-900"
                  }`}
                >
                  {stats.company.name}
                </Text>
              </View>
            </View>
          )}

          {isLoading || !stats ? (
            <View className="space-y-4">
              {/* Skeleton pour les KPIs - Structure exacte comme le contenu réel */}
              {(() => {
                const containerPadding = 48;
                const availableWidth = SCREEN_WIDTH - containerPadding;
                const gapHorizontal = 16;
                const gapVertical = 8;
                const cardWidth = (availableWidth - gapHorizontal) / 2;
                const cardHeight = 110;
                const pageWidth = SCREEN_WIDTH - containerPadding;

                return (
                  <View
                    className="relative"
                    style={{ minHeight: cardHeight * 2 + gapVertical }}
                  >
                    <ScrollView
                      horizontal
                      pagingEnabled
                      showsHorizontalScrollIndicator={false}
                      decelerationRate="fast"
                      style={{
                        marginLeft: 0,
                        marginRight: 0,
                        paddingLeft: 0,
                        paddingRight: 0,
                      }}
                      contentContainerStyle={{
                        paddingRight: 40,
                        paddingLeft: 0,
                      }}
                    >
                      <View style={{ width: pageWidth, paddingHorizontal: 0 }}>
                        <View style={{ gap: gapVertical }}>
                          {/* Première ligne (2 cartes) */}
                          <View
                            className="flex-row"
                            style={{ gap: gapHorizontal }}
                          >
                            {[...Array(2)].map((_, i) => (
                              <View
                                key={i}
                                style={{
                                  width: cardWidth,
                                  height: cardHeight,
                                  padding: 16,
                                  borderRadius: 12,
                                  position: "relative",
                                  overflow: "hidden",
                                  borderWidth: 1,
                                  borderColor: isDark
                                    ? "rgba(55, 65, 81, 0.5)"
                                    : "#e5e7eb",
                                  backgroundColor: isDark
                                    ? "#1e293b"
                                    : "#f9fafb",
                                  shadowColor: "#000",
                                  shadowOffset: { width: 0, height: 4 },
                                  shadowOpacity: 0.1,
                                  shadowRadius: 8,
                                  elevation: 4,
                                }}
                              >
                                <View
                                  style={{
                                    position: "absolute",
                                    top: 0,
                                    right: 0,
                                    width: 80,
                                    height: 80,
                                    borderRadius: 40,
                                    transform: [
                                      { translateX: 40 },
                                      { translateY: -40 },
                                    ],
                                    backgroundColor: isDark
                                      ? "rgba(16, 185, 129, 0.1)"
                                      : "rgba(16, 185, 129, 0.1)",
                                  }}
                                />
                                <View
                                  style={{ position: "relative", zIndex: 10 }}
                                >
                                  <View
                                    style={{
                                      width: "70%",
                                      height: 14,
                                      backgroundColor: isDark
                                        ? "#374151"
                                        : "#d1d5db",
                                      borderRadius: 4,
                                    }}
                                  />
                                  <View style={{ height: 8, marginTop: 8 }} />
                                  <View
                                    style={{
                                      width: "85%",
                                      height: 28,
                                      backgroundColor: isDark
                                        ? "#374151"
                                        : "#d1d5db",
                                      borderRadius: 4,
                                    }}
                                  />
                                  <View style={{ height: 8, marginTop: 8 }} />
                                  <View
                                    style={{
                                      width: "50%",
                                      height: 12,
                                      backgroundColor: isDark
                                        ? "#374151"
                                        : "#d1d5db",
                                      borderRadius: 4,
                                    }}
                                  />
                                </View>
                              </View>
                            ))}
                          </View>
                          {/* Deuxième ligne (2 cartes) */}
                          <View
                            className="flex-row"
                            style={{ gap: gapHorizontal }}
                          >
                            {[...Array(2)].map((_, i) => (
                              <View
                                key={i + 2}
                                style={{
                                  width: cardWidth,
                                  height: cardHeight,
                                  padding: 16,
                                  borderRadius: 12,
                                  position: "relative",
                                  overflow: "hidden",
                                  borderWidth: 1,
                                  borderColor: isDark
                                    ? "rgba(55, 65, 81, 0.5)"
                                    : "#e5e7eb",
                                  backgroundColor: isDark
                                    ? "#1e293b"
                                    : "#f9fafb",
                                  shadowColor: "#000",
                                  shadowOffset: { width: 0, height: 4 },
                                  shadowOpacity: 0.1,
                                  shadowRadius: 8,
                                  elevation: 4,
                                }}
                              >
                                <View
                                  style={{
                                    position: "absolute",
                                    top: 0,
                                    right: 0,
                                    width: 80,
                                    height: 80,
                                    borderRadius: 40,
                                    transform: [
                                      { translateX: 40 },
                                      { translateY: -40 },
                                    ],
                                    backgroundColor: isDark
                                      ? "rgba(14, 165, 233, 0.1)"
                                      : "rgba(14, 165, 233, 0.1)",
                                  }}
                                />
                                <View
                                  style={{ position: "relative", zIndex: 10 }}
                                >
                                  <View
                                    style={{
                                      width: "70%",
                                      height: 14,
                                      backgroundColor: isDark
                                        ? "#374151"
                                        : "#d1d5db",
                                      borderRadius: 4,
                                    }}
                                  />
                                  <View style={{ height: 8, marginTop: 8 }} />
                                  <View
                                    style={{
                                      width: "85%",
                                      height: 28,
                                      backgroundColor: isDark
                                        ? "#374151"
                                        : "#d1d5db",
                                      borderRadius: 4,
                                    }}
                                  />
                                  <View style={{ height: 8, marginTop: 8 }} />
                                  <View
                                    style={{
                                      width: "50%",
                                      height: 12,
                                      backgroundColor: isDark
                                        ? "#374151"
                                        : "#d1d5db",
                                      borderRadius: 4,
                                    }}
                                  />
                                </View>
                              </View>
                            ))}
                          </View>
                        </View>
                      </View>
                    </ScrollView>
                  </View>
                );
              })()}

              {/* Skeleton pour les graphiques - Structure exacte comme le contenu réel avec mt-6 */}
              <View className="mt-6">
                {/* Graphique Entrées vs Sorties */}
                <View
                  className={`p-5 rounded-xl shadow-sm mb-6 ${
                    isDark ? "bg-[#1e293b]" : "bg-gray-50"
                  }`}
                >
                  {/* Header avec titre et toggle */}
                  <View className="mb-6">
                    <View
                      style={{
                        width: 250,
                        height: 24,
                        backgroundColor: isDark ? "#374151" : "#d1d5db",
                        borderRadius: 4,
                        marginBottom: 12,
                      }}
                    />
                    <View className="flex-row justify-start">
                      <View
                        className={`flex-row gap-1 rounded-full p-1 ${
                          isDark
                            ? "bg-gray-800 border border-gray-700"
                            : "bg-gray-100 border border-gray-200"
                        }`}
                      >
                        <View
                          style={{
                            width: 70,
                            height: 24,
                            backgroundColor: isDark ? "#374151" : "#d1d5db",
                            borderRadius: 9999,
                          }}
                        />
                        <View
                          style={{
                            width: 90,
                            height: 24,
                            backgroundColor: isDark ? "#374151" : "#d1d5db",
                            borderRadius: 9999,
                          }}
                        />
                      </View>
                    </View>
                  </View>
                  <View style={{ marginTop: 8 }}>
                    <View
                      style={{
                        width: "100%",
                        height: 250,
                        backgroundColor: isDark ? "#374151" : "#d1d5db",
                        borderRadius: 12,
                      }}
                    />
                  </View>
                </View>

                {/* Graphique Répartition (Pie Chart) - mb-6 comme le contenu réel */}
                <View
                  className={`p-5 rounded-xl shadow-sm mb-6 ${
                    isDark ? "bg-[#1e293b]" : "bg-gray-50"
                  }`}
                >
                  <View
                    style={{
                      width: 180,
                      height: 20,
                      backgroundColor: isDark ? "#374151" : "#d1d5db",
                      borderRadius: 4,
                    }}
                  />
                  <View style={{ height: 16, marginTop: 16 }} />
                  <View
                    style={{
                      width: "100%",
                      height: 200,
                      backgroundColor: isDark ? "#374151" : "#d1d5db",
                      borderRadius: 12,
                    }}
                  />
                </View>

                {/* Graphique Prédiction (pour gestionnaires) - mb-6 comme le contenu réel */}
                <View
                  className={`p-5 rounded-xl shadow-sm mb-6 ${
                    isDark ? "bg-[#1e293b]" : "bg-gray-50"
                  }`}
                >
                  <View
                    style={{
                      width: 160,
                      height: 20,
                      backgroundColor: isDark ? "#374151" : "#d1d5db",
                      borderRadius: 4,
                    }}
                  />
                  <View style={{ height: 16, marginTop: 16 }} />
                  <View
                    style={{
                      width: "100%",
                      height: 180,
                      backgroundColor: isDark ? "#374151" : "#d1d5db",
                      borderRadius: 12,
                    }}
                  />
                </View>
              </View>
            </View>
          ) : stats && kpis ? (
            <View className="space-y-4">
              {/* KPIs avec scroll horizontal si plus de 6 cartes */}
              {(() => {
                // Compter le nombre de cartes
                let cardCount = 0;
                if (kpis.netBalance !== undefined) cardCount++;
                if (isManager) {
                  if (kpis.totalIncome !== undefined) cardCount++;
                  if (kpis.totalOutcome !== undefined) cardCount++;
                  if (kpis.totalPendingAmount !== undefined) cardCount++;
                  if (kpis.allocatedAmount !== undefined) cardCount++;
                  if (kpis.monthsRemaining !== undefined) cardCount++;
                  if (kpis.validatedExpensesCount !== undefined) cardCount++;
                  if (kpis.validationRate !== undefined) cardCount++;
                  if (kpis.rejectedExpensesCount !== undefined) cardCount++;
                  if (kpis.avgValidationTimeHours !== undefined) cardCount++;
                  if (kpis.avgMonthlyOutcome !== undefined) cardCount++;
                } else {
                  // Admins - compter uniquement les stats qui existent dans l'API
                  if (kpis.totalIncome !== undefined) cardCount++;
                  if (kpis.totalOutcome !== undefined) cardCount++;
                  if (kpis.totalInvestments !== undefined) cardCount++;
                  if (kpis.totalImmobilized !== undefined) cardCount++;
                  if (kpis.totalLoans !== undefined) cardCount++;
                  if (
                    kpis.pendingExpensesCount !== undefined &&
                    kpis.pendingExpensesCount > 0
                  )
                    cardCount++;
                  if (kpis.incomeOutcomeRatio !== undefined) cardCount++;
                  if (
                    kpis.datMaturities7Days !== undefined &&
                    kpis.datMaturities7Days > 0
                  )
                    cardCount++;
                  if (
                    kpis.loanMaturities7Days !== undefined &&
                    kpis.loanMaturities7Days > 0
                  )
                    cardCount++;
                }

                const needsScroll = cardCount > 4; // Plus de 4 cartes = besoin de scroll

                // Calculer les dimensions pour le layout 2x2 (4 cartes par page)
                // Les cartes doivent être alignées au même niveau que le label "Dashboard" (px-6 = 24px de chaque côté)
                const containerPadding = 48; // 24px padding de chaque côté (px-6) - même que le header
                const availableWidth = SCREEN_WIDTH - containerPadding; // Largeur disponible
                const gapHorizontal = 16; // gap-4 = 16px (espacement horizontal entre cartes)
                const gapVertical = 8; // espacement vertical réduit entre les lignes
                // cardWidth utilise toute la largeur disponible (pas de padding supplémentaire dans les pages)
                const cardWidth = (availableWidth - gapHorizontal) / 2; // 2 colonnes, 1 gap entre elles
                const cardHeight = 110; // Hauteur réduite pour mieux s'adapter
                const pageWidth = SCREEN_WIDTH - containerPadding; // Largeur d'une page (sans padding supplémentaire)
                const totalPages = Math.ceil(cardCount / 4); // 4 cartes par page (2x2)

                // Collecter toutes les cartes dans un tableau
                const allCards: React.ReactElement[] = [];

                // Fonction helper pour créer une carte
                const createCard = (
                  key: string,
                  title: string,
                  value: number | string,
                  isAmount: boolean,
                  subtitle: string | undefined,
                  gradientDark: string,
                  gradientLight: string,
                  circleColor: string,
                  textDark: string,
                  textLight: string
                ) => (
                  <View
                    key={key}
                    style={[
                      {
                        width: cardWidth,
                        height: cardHeight,
                        shadowColor: "#000",
                        shadowOffset: { width: 0, height: 4 },
                        shadowOpacity: 0.1,
                        shadowRadius: 8,
                        elevation: 4,
                      },
                    ]}
                    className={`relative overflow-hidden p-4 rounded-lg border ${
                      isDark
                        ? `${gradientDark} border-gray-700/50`
                        : `${gradientLight} border-gray-200`
                    }`}
                  >
                    <View
                      className={`absolute top-0 right-0 w-20 h-20 rounded-full ${circleColor}`}
                      style={{
                        transform: [{ translateX: 40 }, { translateY: -40 }],
                      }}
                    />
                    <View className="relative z-10">
                      <Text
                        className={`text-sm font-medium mb-2 ${
                          isDark ? textDark : textLight
                        }`}
                      >
                        {title}
                      </Text>
                      {isAmount ? (
                        <View style={{ flexShrink: 1 }}>
                          <BlurredAmount
                            amount={value as number}
                            currency={displayCurrency}
                            className={`text-lg font-bold ${
                              isDark ? textDark : textLight
                            }`}
                            style={{
                              fontSize: 16,
                              flexShrink: 1,
                            }}
                          />
                        </View>
                      ) : (
                        <Text
                          className={`text-xl font-bold ${
                            isDark ? textDark : textLight
                          }`}
                        >
                          {value}
                        </Text>
                      )}
                      {subtitle && (
                        <Text
                          className={`text-xs mt-1 ${
                            isDark ? textDark : textLight
                          }`}
                          style={{ opacity: 0.8 }}
                        >
                          {subtitle}
                        </Text>
                      )}
                    </View>
                  </View>
                );

                // Solde Disponible - Pour tous
                // Pour les admins: mobilizedBalance ?? netBalance - totalPendingAmount
                // Pour les managers: netBalance
                if (kpis.netBalance !== undefined) {
                  const soldeValue = isManager
                    ? kpis.netBalance ?? 0
                    : kpis.mobilizedBalance ??
                      (kpis.netBalance || 0) - (kpis.totalPendingAmount || 0);
                  const isPositive = soldeValue >= 0;
                  const subtitle = isManager
                    ? kpis.totalPendingAmount && kpis.totalPendingAmount > 0
                      ? `${kpis.totalPendingCount || 0} en attente`
                      : isPositive
                        ? "Disponible"
                        : "Déficit"
                    : kpis.totalPendingAmount && kpis.totalPendingAmount > 0
                      ? `${kpis.totalPendingCount || 0} en attente`
                      : isPositive
                        ? "Disponible"
                        : "Déficit";
                  allCards.push(
                    createCard(
                      "netBalance",
                      "Solde Disponible",
                      soldeValue,
                      true,
                      subtitle,
                      isPositive
                        ? "bg-gradient-to-br from-green-900/20 to-green-800/20"
                        : "bg-gradient-to-br from-red-900/20 to-red-800/20",
                      isPositive
                        ? "bg-gradient-to-br from-green-50 to-green-100"
                        : "bg-gradient-to-br from-red-50 to-red-100",
                      isPositive ? "bg-green-500/10" : "bg-red-500/10",
                      isPositive ? "text-green-200" : "text-red-200",
                      isPositive ? "text-green-800" : "text-red-800"
                    )
                  );
                }

                // KPIs spécifiques aux gestionnaires
                if (isManager) {
                  // Total Entrées
                  if (kpis.totalIncome !== undefined) {
                    allCards.push(
                      createCard(
                        "totalIncome",
                        "Total Entrées",
                        kpis.totalIncome || 0,
                        true,
                        undefined,
                        "bg-gradient-to-br from-emerald-900/20 to-emerald-800/20",
                        "bg-gradient-to-br from-emerald-50 to-emerald-100",
                        "bg-emerald-500/10",
                        "text-emerald-200",
                        "text-emerald-800"
                      )
                    );
                  }
                  // Total Sorties
                  if (kpis.totalOutcome !== undefined) {
                    allCards.push(
                      createCard(
                        "totalOutcome",
                        "Total Sorties",
                        kpis.totalOutcome || 0,
                        true,
                        undefined,
                        "bg-gradient-to-br from-orange-900/20 to-orange-800/20",
                        "bg-gradient-to-br from-orange-50 to-orange-100",
                        "bg-orange-500/10",
                        "text-orange-200",
                        "text-orange-800"
                      )
                    );
                  }
                  if (kpis.totalPendingAmount !== undefined) {
                    allCards.push(
                      createCard(
                        "totalPendingAmount",
                        "En Attente",
                        kpis.totalPendingAmount || 0,
                        true,
                        `${kpis.totalPendingCount || 0} dépense${
                          (kpis.totalPendingCount || 0) !== 1 ? "s" : ""
                        }`,
                        "bg-gradient-to-br from-yellow-900/20 to-yellow-800/20",
                        "bg-gradient-to-br from-yellow-50 to-yellow-100",
                        "bg-yellow-500/10",
                        "text-yellow-200",
                        "text-yellow-800"
                      )
                    );
                  }
                  if (kpis.allocatedAmount !== undefined) {
                    allCards.push(
                      createCard(
                        "allocatedAmount",
                        "Montant Alloué",
                        kpis.allocatedAmount || 0,
                        true,
                        undefined,
                        "bg-gradient-to-br from-blue-900/20 to-blue-800/20",
                        "bg-gradient-to-br from-blue-50 to-blue-100",
                        "bg-blue-500/10",
                        "text-blue-200",
                        "text-blue-800"
                      )
                    );
                  }
                  if (kpis.monthsRemaining !== undefined) {
                    const monthsRemainingText =
                      kpis.monthsRemaining !== null
                        ? kpis.monthsRemaining >= 12
                          ? `${(kpis.monthsRemaining / 12).toFixed(1)} an${
                              kpis.monthsRemaining >= 24 ? "s" : ""
                            }`
                          : kpis.monthsRemaining >= 1
                            ? `${kpis.monthsRemaining.toFixed(1)} mois`
                            : `${(kpis.monthsRemaining * 30).toFixed(0)} jours`
                        : "N/A";
                    allCards.push(
                      createCard(
                        "monthsRemaining",
                        "Durée Restante",
                        monthsRemainingText,
                        false,
                        undefined,
                        "bg-gradient-to-br from-violet-900/20 to-violet-800/20",
                        "bg-gradient-to-br from-violet-50 to-violet-100",
                        "bg-violet-500/10",
                        "text-violet-200",
                        "text-violet-800"
                      )
                    );
                  }
                  if (kpis.validatedExpensesCount !== undefined) {
                    allCards.push(
                      createCard(
                        "validatedExpensesCount",
                        "Validées ce Mois",
                        kpis.validatedExpensesAmount || 0,
                        true,
                        `${kpis.validatedExpensesCount || 0} dépense${
                          (kpis.validatedExpensesCount || 0) !== 1 ? "s" : ""
                        }`,
                        "bg-gradient-to-br from-green-900/20 to-green-800/20",
                        "bg-gradient-to-br from-green-50 to-green-100",
                        "bg-green-500/10",
                        "text-green-200",
                        "text-green-800"
                      )
                    );
                  }
                  if (kpis.validationRate !== undefined) {
                    allCards.push(
                      createCard(
                        "validationRate",
                        "Taux de Validation",
                        `${kpis.validationRate.toFixed(1)}%`,
                        false,
                        undefined,
                        "bg-gradient-to-br from-teal-900/20 to-teal-800/20",
                        "bg-gradient-to-br from-teal-50 to-teal-100",
                        "bg-teal-500/10",
                        "text-teal-200",
                        "text-teal-800"
                      )
                    );
                  }
                  if (kpis.rejectedExpensesCount !== undefined) {
                    allCards.push(
                      createCard(
                        "rejectedExpensesCount",
                        "Rejetées ce Mois",
                        kpis.rejectedExpensesAmount || 0,
                        true,
                        `${kpis.rejectedExpensesCount || 0} dépense${
                          (kpis.rejectedExpensesCount || 0) !== 1 ? "s" : ""
                        }`,
                        "bg-gradient-to-br from-red-900/20 to-red-800/20",
                        "bg-gradient-to-br from-red-50 to-red-100",
                        "bg-red-500/10",
                        "text-red-200",
                        "text-red-800"
                      )
                    );
                  }
                  if (kpis.avgValidationTimeHours !== undefined) {
                    const avgTimeText =
                      kpis.avgValidationTimeHours > 0
                        ? kpis.avgValidationTimeHours < 24
                          ? `${kpis.avgValidationTimeHours.toFixed(1)}h`
                          : `${(kpis.avgValidationTimeHours / 24).toFixed(1)}j`
                        : "N/A";
                    allCards.push(
                      createCard(
                        "avgValidationTimeHours",
                        "Temps Moyen Validation",
                        avgTimeText,
                        false,
                        undefined,
                        "bg-gradient-to-br from-pink-900/20 to-pink-800/20",
                        "bg-gradient-to-br from-pink-50 to-pink-100",
                        "bg-pink-500/10",
                        "text-pink-200",
                        "text-pink-800"
                      )
                    );
                  }
                  if (kpis.avgMonthlyOutcome !== undefined) {
                    allCards.push(
                      createCard(
                        "avgMonthlyOutcome",
                        "Moyenne Mensuelle",
                        kpis.avgMonthlyOutcome || 0,
                        true,
                        undefined,
                        "bg-gradient-to-br from-amber-900/20 to-amber-800/20",
                        "bg-gradient-to-br from-amber-50 to-amber-100",
                        "bg-amber-500/10",
                        "text-amber-200",
                        "text-amber-800"
                      )
                    );
                  }
                } else {
                  // KPIs spécifiques aux admins - selon gesflow (ordre exact)
                  // 1. Total Entrées
                  if (kpis.totalIncome !== undefined) {
                    allCards.push(
                      createCard(
                        "totalIncome",
                        "Total Entrées",
                        kpis.totalIncome || 0,
                        true,
                        "Revenus totaux",
                        "bg-gradient-to-br from-emerald-900/20 to-emerald-800/20",
                        "bg-gradient-to-br from-emerald-50 to-emerald-100",
                        "bg-emerald-500/10",
                        "text-emerald-200",
                        "text-emerald-800"
                      )
                    );
                  }
                  // 2. Total Sorties
                  if (kpis.totalOutcome !== undefined) {
                    allCards.push(
                      createCard(
                        "totalOutcome",
                        "Total Sorties",
                        kpis.totalOutcome || 0,
                        true,
                        "Dépenses + Investissements",
                        "bg-gradient-to-br from-orange-900/20 to-orange-800/20",
                        "bg-gradient-to-br from-orange-50 to-orange-100",
                        "bg-orange-500/10",
                        "text-orange-200",
                        "text-orange-800"
                      )
                    );
                  }
                  // 3. Investissements
                  if (kpis.totalInvestments !== undefined) {
                    allCards.push(
                      createCard(
                        "totalInvestments",
                        "Investissements",
                        kpis.totalInvestments || 0,
                        true,
                        undefined,
                        "bg-gradient-to-br from-purple-900/20 to-purple-800/20",
                        "bg-gradient-to-br from-purple-50 to-purple-100",
                        "bg-purple-500/10",
                        "text-purple-200",
                        "text-purple-800"
                      )
                    );
                  }
                  // 4. Montant Immobilisé
                  if (kpis.totalImmobilized !== undefined) {
                    allCards.push(
                      createCard(
                        "totalImmobilized",
                        "Montant Immobilisé",
                        kpis.totalImmobilized || 0,
                        true,
                        "Total DAT actifs",
                        "bg-gradient-to-br from-cyan-900/20 to-cyan-800/20",
                        "bg-gradient-to-br from-cyan-50 to-cyan-100",
                        "bg-cyan-500/10",
                        "text-cyan-200",
                        "text-cyan-800"
                      )
                    );
                  }
                  // 5. Emprunts
                  if (kpis.totalLoans !== undefined) {
                    allCards.push(
                      createCard(
                        "totalLoans",
                        "Emprunts",
                        kpis.totalLoans || 0,
                        true,
                        kpis.activeLoans !== undefined
                          ? `${kpis.activeLoans} actifs`
                          : undefined,
                        "bg-gradient-to-br from-indigo-900/20 to-indigo-800/20",
                        "bg-gradient-to-br from-indigo-50 to-indigo-100",
                        "bg-indigo-500/10",
                        "text-indigo-200",
                        "text-indigo-800"
                      )
                    );
                  }
                  // 6. Dépenses en Attente (si > 0)
                  // Utiliser pendingExpensesAmount si disponible (company-stats), sinon totalPendingAmount (stats globales)
                  const pendingAmount = (kpis as any).pendingExpensesAmount !== undefined
                    ? (kpis as any).pendingExpensesAmount
                    : kpis.totalPendingAmount;
                  if (
                    kpis.pendingExpensesCount !== undefined &&
                    kpis.pendingExpensesCount > 0 &&
                    pendingAmount !== undefined
                  ) {
                    allCards.push(
                      createCard(
                        "pendingExpenses",
                        "Dépenses en Attente",
                        pendingAmount || 0,
                        true,
                        `${kpis.pendingExpensesCount || 0} dépense${
                          (kpis.pendingExpensesCount || 0) !== 1 ? "s" : ""
                        } à valider`,
                        "bg-gradient-to-br from-amber-900/20 to-amber-800/20",
                        "bg-gradient-to-br from-amber-50 to-amber-100",
                        "bg-amber-500/10",
                        "text-amber-200",
                        "text-amber-800"
                      )
                    );
                  }
                  // 7. Ratio Entrées/Sorties
                  if (kpis.incomeOutcomeRatio !== undefined) {
                    allCards.push(
                      createCard(
                        "incomeOutcomeRatio",
                        "Ratio Entrées/Sorties",
                        `${kpis.incomeOutcomeRatio.toFixed(1)}%`,
                        false,
                        kpis.incomeOutcomeRatio >= 100
                          ? "Excédentaire"
                          : "Déficitaire",
                        "bg-gradient-to-br from-slate-900/20 to-slate-800/20",
                        "bg-gradient-to-br from-slate-50 to-slate-100",
                        "bg-slate-500/10",
                        "text-slate-200",
                        "text-slate-800"
                      )
                    );
                  }
                  // 8. DAT échéance 7 jours (si > 0)
                  if (
                    kpis.datMaturities7Days !== undefined &&
                    kpis.datMaturities7Days > 0
                  ) {
                    allCards.push(
                      createCard(
                        "datMaturities7Days",
                        "DAT (7 jours)",
                        kpis.datMaturities7Days || 0,
                        true,
                        "Échéances dans 7 jours",
                        "bg-gradient-to-br from-rose-900/20 to-rose-800/20",
                        "bg-gradient-to-br from-rose-50 to-rose-100",
                        "bg-rose-500/10",
                        "text-rose-200",
                        "text-rose-800"
                      )
                    );
                  }
                  // 9. Emprunts échéance 7 jours (si > 0)
                  if (
                    kpis.loanMaturities7Days !== undefined &&
                    kpis.loanMaturities7Days > 0
                  ) {
                    allCards.push(
                      createCard(
                        "loanMaturities7Days",
                        "Emprunts (7 jours)",
                        kpis.loanMaturities7Days || 0,
                        true,
                        "Échéances dans 7 jours",
                        "bg-gradient-to-br from-pink-900/20 to-pink-800/20",
                        "bg-gradient-to-br from-pink-50 to-pink-100",
                        "bg-pink-500/10",
                        "text-pink-200",
                        "text-pink-800"
                      )
                    );
                  }
                }

                // Organiser les cartes en pages de 4 (2x2)
                const pages: React.ReactElement[][] = [];
                for (let i = 0; i < allCards.length; i += 4) {
                  pages.push(allCards.slice(i, i + 4));
                }

                // S'assurer que pages est toujours un tableau
                const safePages = Array.isArray(pages) ? pages : [];

                return (
                  <View
                    className="relative"
                    style={{ minHeight: cardHeight * 2 + gapVertical }}
                  >
                    <ScrollView
                      ref={statsScrollViewRef}
                      horizontal
                      pagingEnabled={needsScroll}
                      showsHorizontalScrollIndicator={false}
                      decelerationRate="fast"
                      style={{
                        marginLeft: 0,
                        marginRight: 0,
                        paddingLeft: 0,
                        paddingRight: 0,
                      }}
                      contentContainerStyle={{
                        paddingRight: needsScroll ? 40 : 0,
                        paddingLeft: 0, // Pas de padding à gauche pour aligner avec le label "Dashboard"
                      }}
                      onContentSizeChange={(width) => {
                        const pageWidth = SCREEN_WIDTH - 48;
                        const canScroll = width > pageWidth;
                        // Si on ne peut pas scroller, cacher les indicateurs
                        if (!canScroll || !needsScroll) {
                          setShowScrollIndicator(false);
                          setShowLeftScrollIndicator(false);
                        } else {
                          // Si on peut scroller et qu'il y a plus d'une page, afficher l'indicateur de droite
                          // On est au début par défaut (page 0)
                          if (totalPages > 1) {
                            setShowScrollIndicator(true);
                            setShowLeftScrollIndicator(false);
                          } else {
                            // Une seule page, pas besoin d'indicateurs
                            setShowScrollIndicator(false);
                            setShowLeftScrollIndicator(false);
                          }
                        }
                      }}
                      onScroll={(event) => {
                        const {
                          contentOffset,
                          contentSize,
                          layoutMeasurement,
                        } = event.nativeEvent;
                        const scrollX = contentOffset.x;
                        const pageWidth = layoutMeasurement.width;
                        const totalWidth = contentSize.width;

                        const currentPageIndex = Math.round(
                          scrollX / pageWidth
                        );
                        setCurrentPage(currentPageIndex);

                        // Utiliser le nombre de pages pour détecter la fin
                        // On est à la dernière page si currentPageIndex >= totalPages - 1
                        const isAtLastPage = currentPageIndex >= totalPages - 1;
                        const isAtFirstPage = currentPageIndex <= 0;

                        // Tolérance pour détecter le début et la fin (vérification supplémentaire)
                        const tolerance = 15;
                        const isAtStart = scrollX <= tolerance;
                        const scrollEnd = scrollX + pageWidth;
                        const isAtEndByPosition =
                          scrollEnd >= totalWidth - tolerance;

                        // On est à la fin si on est à la dernière page OU si la position indique la fin
                        const isAtEnd = isAtLastPage || isAtEndByPosition;

                        // Mettre à jour les indicateurs seulement si on peut vraiment scroller
                        if (totalWidth > pageWidth && needsScroll) {
                          setShowLeftScrollIndicator(
                            !isAtFirstPage && !isAtStart
                          );
                          // Cacher la flèche droite si on est à la dernière page
                          setShowScrollIndicator(!isAtEnd);
                        } else {
                          setShowLeftScrollIndicator(false);
                          setShowScrollIndicator(false);
                        }
                      }}
                      onScrollEndDrag={(event) => {
                        const {
                          contentOffset,
                          contentSize,
                          layoutMeasurement,
                        } = event.nativeEvent;
                        const scrollX = contentOffset.x;
                        const pageWidth = layoutMeasurement.width;
                        const totalWidth = contentSize.width;

                        const currentPageIndex = Math.round(
                          scrollX / pageWidth
                        );
                        setCurrentPage(currentPageIndex);

                        // Utiliser le nombre de pages pour détecter la fin
                        const isAtLastPage = currentPageIndex >= totalPages - 1;
                        const isAtFirstPage = currentPageIndex <= 0;

                        const tolerance = 15;
                        const isAtStart = scrollX <= tolerance;
                        const scrollEnd = scrollX + pageWidth;
                        const isAtEndByPosition =
                          scrollEnd >= totalWidth - tolerance;

                        const isAtEnd = isAtLastPage || isAtEndByPosition;

                        if (totalWidth > pageWidth && needsScroll) {
                          setShowLeftScrollIndicator(
                            !isAtFirstPage && !isAtStart
                          );
                          setShowScrollIndicator(!isAtEnd);
                        } else {
                          setShowLeftScrollIndicator(false);
                          setShowScrollIndicator(false);
                        }
                      }}
                      onMomentumScrollEnd={(event) => {
                        const {
                          contentOffset,
                          contentSize,
                          layoutMeasurement,
                        } = event.nativeEvent;
                        const scrollX = contentOffset.x;
                        const pageWidth = layoutMeasurement.width;
                        const totalWidth = contentSize.width;

                        const currentPageIndex = Math.round(
                          scrollX / pageWidth
                        );
                        setCurrentPage(currentPageIndex);

                        // Utiliser le nombre de pages pour détecter la fin
                        const isAtLastPage = currentPageIndex >= totalPages - 1;
                        const isAtFirstPage = currentPageIndex <= 0;

                        const tolerance = 15;
                        const isAtStart = scrollX <= tolerance;
                        const scrollEnd = scrollX + pageWidth;
                        const isAtEndByPosition =
                          scrollEnd >= totalWidth - tolerance;

                        const isAtEnd = isAtLastPage || isAtEndByPosition;

                        if (totalWidth > pageWidth && needsScroll) {
                          setShowLeftScrollIndicator(
                            !isAtFirstPage && !isAtStart
                          );
                          setShowScrollIndicator(!isAtEnd);
                        } else {
                          setShowLeftScrollIndicator(false);
                          setShowScrollIndicator(false);
                        }
                      }}
                      scrollEventThrottle={16}
                    >
                      {safePages.map((pageCards, pageIndex) => (
                        <View
                          key={`page-${pageIndex}`}
                          style={{
                            width: pageWidth,
                            paddingHorizontal: 0, // Pas de padding supplémentaire - alignement avec les graphiques
                          }}
                        >
                          <View
                            className="flex-col"
                            style={{ gap: gapVertical }}
                          >
                            {/* Première ligne (2 cartes) */}
                            <View
                              className="flex-row"
                              style={{ gap: gapHorizontal }}
                            >
                              {Array.isArray(pageCards) &&
                                pageCards.slice(0, 2).map((card) => card)}
                            </View>
                            {/* Deuxième ligne (2 cartes) */}
                            {Array.isArray(pageCards) &&
                              pageCards.length > 2 && (
                                <View
                                  className="flex-row"
                                  style={{ gap: gapHorizontal }}
                                >
                                  {pageCards.slice(2, 4).map((card) => card)}
                                </View>
                              )}
                          </View>
                        </View>
                      ))}
                    </ScrollView>

                    {/* Bouton de scroll à gauche */}
                    {showLeftScrollIndicator && (
                      <TouchableOpacity
                        onPress={() => {
                          if (statsScrollViewRef.current) {
                            const targetPage = Math.max(0, currentPage - 1);
                            statsScrollViewRef.current.scrollTo({
                              x: targetPage * pageWidth,
                              animated: true,
                            });
                          }
                        }}
                        activeOpacity={0.7}
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 40,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: isDark
                              ? "rgba(15, 23, 42, 0.9)"
                              : "rgba(255, 255, 255, 0.9)",
                            borderRadius: 20,
                            padding: 8,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 4,
                            elevation: 5,
                            borderWidth: 1,
                            borderColor: isDark
                              ? "rgba(148, 163, 184, 0.2)"
                              : "rgba(107, 114, 128, 0.2)",
                          }}
                        >
                          <HugeiconsIcon
                            icon={ArrowLeft01Icon}
                            size={20}
                            color={isDark ? "#9ca3af" : "#6b7280"}
                          />
                        </View>
                      </TouchableOpacity>
                    )}

                    {/* Bouton de scroll à droite */}
                    {showScrollIndicator && (
                      <TouchableOpacity
                        onPress={() => {
                          if (statsScrollViewRef.current) {
                            const targetPage = Math.min(
                              totalPages - 1,
                              currentPage + 1
                            );
                            statsScrollViewRef.current.scrollTo({
                              x: targetPage * pageWidth,
                              animated: true,
                            });
                          }
                        }}
                        activeOpacity={0.7}
                        style={{
                          position: "absolute",
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: 40,
                          justifyContent: "center",
                          alignItems: "center",
                        }}
                      >
                        <View
                          style={{
                            backgroundColor: isDark
                              ? "rgba(15, 23, 42, 0.9)"
                              : "rgba(255, 255, 255, 0.9)",
                            borderRadius: 20,
                            padding: 8,
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.2,
                            shadowRadius: 4,
                            elevation: 5,
                            borderWidth: 1,
                            borderColor: isDark
                              ? "rgba(148, 163, 184, 0.2)"
                              : "rgba(107, 114, 128, 0.2)",
                          }}
                        >
                          <HugeiconsIcon
                            icon={ArrowRight01Icon}
                            size={20}
                            color={isDark ? "#9ca3af" : "#6b7280"}
                          />
                        </View>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })()}

              {/* Graphiques */}
              {stats?.charts && (
                <View className="mt-6">
                  {/* Graphique Entrées vs Sorties par mois avec toggle */}
                  {stats.charts?.expensesByMonth &&
                    Array.isArray(stats.charts?.expensesByMonth) &&
                    stats.charts?.expensesByMonth.length > 0 && (
                      <View
                        className={`p-5 rounded-xl shadow-sm mb-6 ${
                          isDark ? "bg-[#1e293b]" : "bg-gray-50"
                        }`}
                      >
                        {/* Header avec titre et toggle */}
                        <View className="mb-6">
                          <Text
                            className={`text-xl font-bold mb-3 ${
                              isDark ? "text-gray-100" : "text-gray-900"
                            }`}
                          >
                            {viewMode === "evolution"
                              ? `Évolution Entrées vs Sorties${
                                  selectedYear ? ` - ${selectedYear}` : ""
                                }`
                              : "Répartition Entrées vs Sorties"}
                          </Text>
                          {/* Toggle Évolution/Répartition - Juste en bas du label */}
                          <View className="flex-row justify-start">
                            <View
                              className={`flex-row gap-1 rounded-full p-1 ${
                                isDark
                                  ? "bg-gray-800 border border-gray-700"
                                  : "bg-gray-100 border border-gray-200"
                              }`}
                            >
                              <TouchableOpacity
                                onPress={() => setViewMode("evolution")}
                                className={`px-4 py-1.5 rounded-full ${
                                  viewMode === "evolution"
                                    ? isDark
                                      ? "bg-blue-600"
                                      : "bg-blue-500"
                                    : ""
                                }`}
                              >
                                <Text
                                  className={`text-xs font-medium ${
                                    viewMode === "evolution"
                                      ? "text-white"
                                      : isDark
                                        ? "text-gray-400"
                                        : "text-gray-600"
                                  }`}
                                >
                                  Évolution
                                </Text>
                              </TouchableOpacity>
                              <TouchableOpacity
                                onPress={() => setViewMode("repartition")}
                                className={`px-4 py-1.5 rounded-full ${
                                  viewMode === "repartition"
                                    ? isDark
                                      ? "bg-blue-600"
                                      : "bg-blue-500"
                                    : ""
                                }`}
                              >
                                <Text
                                  className={`text-xs font-medium ${
                                    viewMode === "repartition"
                                      ? "text-white"
                                      : isDark
                                        ? "text-gray-400"
                                        : "text-gray-600"
                                  }`}
                                >
                                  Répartition
                                </Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>

                        {/* Graphique selon le mode */}
                        {viewMode === "evolution" ? (
                          <EnhancedBarChart
                            data={(() => {
                              const expensesByMonth =
                                stats?.charts?.expensesByMonth;
                              if (
                                !Array.isArray(expensesByMonth) ||
                                expensesByMonth.length === 0
                              ) {
                                return [];
                              }
                              return expensesByMonth
                                .filter((item: any) => item && item.month)
                                .map((item: any) => ({
                                  label: new Date(
                                    item.month + "-01"
                                  ).toLocaleDateString("fr-FR", {
                                    month: "short",
                                  }),
                                  income: item.income || 0,
                                  outcome: item.outcome || 0,
                                }));
                            })()}
                            currency={stats?.company?.currency || "GNF"}
                            showLegend={true}
                            legendLabels={{
                              income: "Entrées",
                              outcome: "Sorties",
                            }}
                          />
                        ) : (
                          <PieChartComponent
                            data={(() => {
                              const expensesByMonth =
                                stats?.charts?.expensesByMonth;
                              if (
                                !Array.isArray(expensesByMonth) ||
                                expensesByMonth.length === 0
                              ) {
                                return [];
                              }
                              const validItems = expensesByMonth.filter(
                                (item: any) => item
                              );
                              return [
                                {
                                  name: "Entrées",
                                  value:
                                    validItems.reduce(
                                      (sum: number, item: any) =>
                                        sum + (item.income || 0),
                                      0
                                    ) || 0,
                                  color: "#10b981",
                                },
                                {
                                  name: "Sorties",
                                  value:
                                    validItems.reduce(
                                      (sum: number, item: any) =>
                                        sum + (item.outcome || 0),
                                      0
                                    ) || 0,
                                  color: "#ef4444",
                                },
                              ];
                            })()}
                            currency={stats?.company?.currency || "GNF"}
                          />
                        )}
                      </View>
                    )}

                  {/* Graphique Statut des Dépenses (Gestionnaires uniquement) */}
                  {isManager &&
                    stats.charts?.expensesByStatus &&
                    Array.isArray(stats.charts?.expensesByStatus) &&
                    stats.charts?.expensesByStatus.length > 0 && (
                      <View
                        className={`p-5 rounded-xl shadow-sm mb-6 ${
                          isDark ? "bg-[#1e293b]" : "bg-gray-50"
                        }`}
                      >
                        <Text
                          className={`text-xl font-bold mb-6 ${
                            isDark ? "text-gray-100" : "text-gray-900"
                          }`}
                        >
                          Statut des Dépenses
                          {selectedYear
                            ? ` - ${selectedYear}`
                            : " (6 derniers mois)"}
                        </Text>
                        <EnhancedBarChart
                          data={(() => {
                            const expensesByStatus =
                              stats?.charts?.expensesByStatus;
                            if (
                              !Array.isArray(expensesByStatus) ||
                              expensesByStatus.length === 0
                            ) {
                              return [];
                            }
                            return expensesByStatus
                              .filter((item: any) => item && item.month)
                              .map((item: any) => ({
                                label: new Date(
                                  item.month + "-01"
                                ).toLocaleDateString("fr-FR", {
                                  month: "short",
                                  year: selectedYear ? undefined : "numeric",
                                }),
                                pending: item?.pending || 0,
                                approved: item?.approved || 0,
                                rejected: item?.rejected || 0,
                              }));
                          })()}
                          currency={stats?.company?.currency || "GNF"}
                          showLegend={true}
                          stacked={true}
                          legendLabels={{
                            pending: "En Attente",
                            approved: "Validées",
                            rejected: "Rejetées",
                          }}
                        />
                      </View>
                    )}

                  {/* Graphique Prédiction de Budget (Gestionnaires et Admins) */}
                  {stats?.charts &&
                    stats.charts?.balanceHistory &&
                    Array.isArray(stats.charts?.balanceHistory) &&
                    stats.charts?.balanceHistory.length > 0 && (
                      <View
                        className={`p-5 rounded-xl shadow-sm mb-6 ${
                          isDark ? "bg-[#1e293b]" : "bg-gray-50"
                        }`}
                      >
                        <View className="mb-2">
                          <Text
                            className={`text-xl font-bold ${
                              isDark ? "text-gray-100" : "text-gray-900"
                            }`}
                          >
                            Prédiction de Budget
                          </Text>
                          <Text
                            className={`text-sm mt-1 ${
                              isDark ? "text-gray-400" : "text-gray-600"
                            }`}
                          >
                            Historique et projection basée sur la moyenne
                            mensuelle des sorties
                          </Text>
                        </View>
                        <BudgetPredictionChart
                          balanceHistory={(() => {
                            const balanceHistory =
                              stats?.charts?.balanceHistory;
                            return Array.isArray(balanceHistory)
                              ? balanceHistory
                              : [];
                          })()}
                          balanceProjection={(() => {
                            const balanceProjection =
                              stats?.charts?.balanceProjection;
                            return Array.isArray(balanceProjection)
                              ? balanceProjection
                              : [];
                          })()}
                          currency={stats?.company?.currency || "GNF"}
                        />
                      </View>
                    )}

                  {/* Graphique Investissements par Catégorie (Admins uniquement) */}
                  {!isManager &&
                    stats.charts?.investmentsByCategory &&
                    Array.isArray(stats.charts?.investmentsByCategory) &&
                    stats.charts?.investmentsByCategory.length > 0 && (
                      <View
                        className={`p-5 rounded-xl shadow-sm mb-6 ${
                          isDark ? "bg-[#1e293b]" : "bg-gray-50"
                        }`}
                      >
                        <Text
                          className={`text-xl font-bold mb-6 ${
                            isDark ? "text-gray-100" : "text-gray-900"
                          }`}
                        >
                          Investissements par Catégorie
                        </Text>
                        <EnhancedBarChart
                          data={(() => {
                            const investmentsByCategory =
                              stats?.charts?.investmentsByCategory;
                            if (
                              !Array.isArray(investmentsByCategory) ||
                              investmentsByCategory.length === 0
                            ) {
                              return [];
                            }
                            return investmentsByCategory
                              .filter((item: any) => item)
                              .map((item: any, index: number) => ({
                                label: item.category || "N/A",
                                value: item.amount || 0,
                                color: [
                                  "#8b5cf6",
                                  "#06b6d4",
                                  "#ec4899",
                                  "#14b8a6",
                                ][index % 4],
                              }));
                          })()}
                          currency={stats?.company?.currency || "GNF"}
                          showLegend={false}
                        />
                      </View>
                    )}
                </View>
              )}
            </View>
          ) : (
            <Text
              className={`text-center ${isDark ? "text-gray-400" : "text-gray-600"}`}
            >
              Aucune donnée disponible
            </Text>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
