import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TextInput,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/config/api";
import { useTheme } from "@/contexts/ThemeContext";
import { usePermissions } from "@/hooks/usePermissions";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  Settings01Icon,
  AlertDiamondIcon,
  Notification01Icon,
  Mail01Icon,
  Message01Icon,
  MoneySend01Icon,
  Calendar03Icon,
  BankIcon,
  CheckmarkCircle02Icon,
} from "@hugeicons/core-free-icons";
import { AlertsSkeleton } from "@/components/skeletons/AlertsSkeleton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { REFRESH_CONTROL_COLOR, TAB_BAR_PADDING_BOTTOM } from "@/constants/layout";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Switch } from "@/components/ui/Switch";
import { formatDecimalInput, formatIntegerInput } from "@/utils/numeric-input";
import { getErrorMessage } from "@/utils/get-error-message";

const CHART_COLOR = "#0ea5e9";

interface Company {
  id: string;
  name: string;
  expenseThreshold: number | null;
}

interface AlertConfig {
  companyId: string;
  expenseThreshold: number | null;
  lowBalanceThreshold: number | null;
  enableExpenseAlerts: boolean;
  enableLowBalanceAlerts: boolean;
  enableMaturityAlerts: boolean;
  enableLoanAlerts: boolean;
  enableInvestmentAlerts: boolean;
  notifyByEmail: boolean;
  notifyBySMS: boolean;
  notifyInApp: boolean;
  alertFrequency: "IMMEDIATE" | "DAILY" | "WEEKLY";
  alertBeforeDays: number;
}

interface AlertTypeToggleProps {
  icon: any;
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

function AlertTypeToggle({
  icon,
  label,
  description,
  enabled,
  onChange,
}: AlertTypeToggleProps) {
  const { isDark } = useTheme();

  return (
    <TouchableOpacity
      onPress={() => onChange(!enabled)}
      className={`p-4 rounded-lg border-2 ${
        enabled
          ? isDark
            ? "border-blue-500 bg-blue-500/10"
            : "border-blue-500 bg-blue-50"
          : isDark
          ? "border-gray-700 bg-[#1e293b]"
          : "border-gray-200 bg-white"
      }`}
      activeOpacity={0.7}
    >
      <View className="flex-row items-start gap-3">
        <View
          className={`p-2 rounded-lg ${
            enabled
              ? isDark
                ? "bg-blue-500/20"
                : "bg-blue-100"
              : isDark
              ? "bg-gray-800"
              : "bg-gray-100"
          }`}
        >
          <HugeiconsIcon
            icon={icon}
            size={20}
            color={
              enabled
                ? isDark
                  ? "#60a5fa"
                  : "#2563eb"
                : isDark
                ? "#9ca3af"
                : "#6b7280"
            }
          />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-1">
            <Text
              className={`font-semibold text-sm ${
                isDark ? "text-gray-200" : "text-gray-900"
              }`}
            >
              {label}
            </Text>
            <Switch checked={enabled} onCheckedChange={onChange} />
          </View>
          <Text
            className={`text-xs ${
              isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {description}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

interface NotificationChannelToggleProps {
  icon: any;
  label: string;
  description: string;
  enabled: boolean;
  onChange: (enabled: boolean) => void;
}

function NotificationChannelToggle({
  icon,
  label,
  description,
  enabled,
  onChange,
}: NotificationChannelToggleProps) {
  const { isDark } = useTheme();

  return (
    <TouchableOpacity
      onPress={() => onChange(!enabled)}
      className={`p-4 rounded-lg border-2 ${
        enabled
          ? isDark
            ? "border-blue-500 bg-blue-500/10"
            : "border-blue-500 bg-blue-50"
          : isDark
          ? "border-gray-700 bg-[#1e293b]"
          : "border-gray-200 bg-white"
      }`}
      activeOpacity={0.7}
    >
      <View className="flex-row items-start gap-3">
        <View
          className={`p-2 rounded-lg ${
            enabled
              ? isDark
                ? "bg-blue-500/20"
                : "bg-blue-100"
              : isDark
              ? "bg-gray-800"
              : "bg-gray-100"
          }`}
        >
          <HugeiconsIcon
            icon={icon}
            size={20}
            color={
              enabled
                ? isDark
                  ? "#60a5fa"
                  : "#2563eb"
                : isDark
                ? "#9ca3af"
                : "#6b7280"
            }
          />
        </View>
        <View className="flex-1">
          <View className="flex-row items-center justify-between mb-1">
            <Text
              className={`font-semibold text-sm ${
                isDark ? "text-gray-200" : "text-gray-900"
              }`}
            >
              {label}
            </Text>
            <Switch checked={enabled} onCheckedChange={onChange} />
          </View>
          <Text
            className={`text-xs ${
              isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            {description}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export function AlertsScreen() {
  const { isDark } = useTheme();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [configs, setConfigs] = useState<Record<string, AlertConfig>>({});

  const canView = hasPermission("alerts.view");
  const canUpdate = hasPermission("alerts.update");

  // Récupérer les entreprises
  const {
    data: companies,
    isLoading: companiesLoading,
    refetch: refetchCompanies,
  } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      try {
        const response = await api.get("/api/companies");
        // S'assurer que la réponse est un tableau
        const data = response.data;
        const companiesArray = Array.isArray(data) ? data : [];
        return companiesArray;
      } catch (err: any) {
        // Retourner un tableau vide en cas d'erreur
        return [];
      }
    },
    enabled: canView,
    initialData: [],
  });

  // Charger la configuration quand une entreprise est sélectionnée
  useEffect(() => {
    if (
      selectedCompanyId &&
      Array.isArray(companies) &&
      companies.length > 0
    ) {
      loadCompanyConfig(selectedCompanyId);
    }
  }, [selectedCompanyId, companies]);

  // Sélectionner la première entreprise par défaut
  useEffect(() => {
    if (
      Array.isArray(companies) &&
      companies.length > 0 &&
      !selectedCompanyId
    ) {
      setSelectedCompanyId(companies[0].id);
    }
  }, [companies, selectedCompanyId]);

  const loadCompanyConfig = async (companyId: string) => {
    try {
      const response = await api.get(`/api/alerts/config?companyId=${companyId}`);
      if (response.status === 200) {
        const config = response.data;
        setConfigs((prev) => ({
          ...prev,
          [companyId]: config,
        }));
      } else {
        // Créer une configuration par défaut
        const defaultConfig: AlertConfig = {
          companyId,
          expenseThreshold: null,
          lowBalanceThreshold: null,
          enableExpenseAlerts: true,
          enableLowBalanceAlerts: true,
          enableMaturityAlerts: true,
          enableLoanAlerts: true,
          enableInvestmentAlerts: true,
          notifyByEmail: true,
          notifyBySMS: false,
          notifyInApp: true,
          alertFrequency: "IMMEDIATE",
          alertBeforeDays: 7,
        };
        setConfigs((prev) => ({
          ...prev,
          [companyId]: defaultConfig,
        }));
      }
    } catch (err: any) {
      // Si erreur 404 ou autre, créer une configuration par défaut
      const defaultConfig: AlertConfig = {
        companyId,
        expenseThreshold: null,
        lowBalanceThreshold: null,
        enableExpenseAlerts: true,
        enableLowBalanceAlerts: true,
        enableMaturityAlerts: true,
        enableLoanAlerts: true,
        enableInvestmentAlerts: true,
        notifyByEmail: true,
        notifyBySMS: false,
        notifyInApp: true,
        alertFrequency: "IMMEDIATE",
        alertBeforeDays: 7,
      };
      setConfigs((prev) => ({
        ...prev,
        [companyId]: defaultConfig,
      }));
    }
  };

  const updateConfig = (companyId: string, updates: Partial<AlertConfig>) => {
    setConfigs((prev) => ({
      ...prev,
      [companyId]: {
        ...prev[companyId],
        ...updates,
      },
    }));
  };

  const saveConfig = async () => {
    if (!selectedCompanyId) return;

    const config = configs[selectedCompanyId];
    if (!config) return;

    try {
      setSaving(true);
      const response = await api.post("/api/alerts/config", config);

      if (response.status === 200) {
        Alert.alert("Succès", "Configuration sauvegardée avec succès");
        queryClient.invalidateQueries({ queryKey: ["companies"] });
      } else {
        throw new Error("Failed to save configuration");
      }
    } catch (err: any) {
      Alert.alert("Erreur", getErrorMessage(err, "Erreur lors de la sauvegarde"));
    } finally {
      setSaving(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetchCompanies();
      if (selectedCompanyId) {
        await loadCompanyConfig(selectedCompanyId);
      }
    } catch (err) {
      // Erreur silencieuse
    } finally {
      setRefreshing(false);
    }
  };

  const currentConfig = selectedCompanyId ? configs[selectedCompanyId] : null;

  if (!canView) {
    return (
      <SafeAreaView
        className={`flex-1 ${isDark ? "bg-[#0f172a]" : "bg-white"}`}
        edges={["top", "bottom"]}
      >
        <ScreenHeader />
        <View className="flex-1 justify-center items-center p-6">
          <Text
            className={`text-center ${
              isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Vous n'avez pas la permission d'accéder à cette page.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (companiesLoading || !companies || !Array.isArray(companies)) {
    return (
      <SafeAreaView
        className={`flex-1 ${isDark ? "bg-[#0f172a]" : "bg-white"}`}
        edges={["top", "bottom"]}
      >
        <ScreenHeader />
        <AlertsSkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-[#0f172a]" : "bg-white"}`}
      edges={["top", "bottom"]}
    >
      <ScreenHeader />
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
          paddingBottom: TAB_BAR_PADDING_BOTTOM + 20,
        }}
      >
        <View className="px-6 pt-6 pb-4">
          {/* Header */}
          <View className="mb-6">
            <Text
              className={`text-2xl font-bold mb-1 ${
                isDark ? "text-gray-100" : "text-gray-900"
              }`}
            >
              Configuration des Alertes
            </Text>
          </View>

          {/* Sélection d'entreprise */}
          <View
            className={`p-4 rounded-lg mb-4 ${
              isDark ? "bg-[#1e293b] border border-gray-700" : "bg-white border border-gray-200"
            }`}
          >
            <View className="flex-row items-center gap-2 mb-3">
              <HugeiconsIcon
                icon={AlertDiamondIcon}
                size={20}
                color={isDark ? "#60a5fa" : "#2563eb"}
              />
              <Text
                className={`text-base font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-900"
                }`}
              >
                Sélectionner une entreprise
              </Text>
            </View>
            <Text
              className={`text-sm mb-3 ${
                isDark ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Choisissez l'entreprise pour laquelle vous souhaitez configurer
              les alertes
            </Text>
            {Array.isArray(companies) && companies.length > 0 ? (
              <Select
                value={selectedCompanyId}
                onValueChange={setSelectedCompanyId}
                placeholder="Choisir une entreprise"
                options={companies.map((company: Company) => ({
                  label: company.name,
                  value: company.id,
                }))}
              />
            ) : (
              <View
                className={`px-4 py-3 rounded-lg border ${
                  isDark
                    ? "bg-[#1e293b] border-gray-700"
                    : "bg-gray-100 border-gray-300"
                }`}
              >
                <Text
                  className={`text-sm ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Aucune entreprise disponible
                </Text>
              </View>
            )}
          </View>

          {selectedCompanyId && currentConfig && (
            <>
              {/* Seuils d'alertes */}
              <View
                className={`p-4 rounded-lg mb-4 ${
                  isDark
                    ? "bg-[#1e293b] border border-gray-700"
                    : "bg-white border border-gray-200"
                }`}
              >
                <View className="flex-row items-center gap-2 mb-3">
                  <HugeiconsIcon
                    icon={MoneySend01Icon}
                    size={20}
                    color={isDark ? "#60a5fa" : "#2563eb"}
                  />
                  <Text
                    className={`text-base font-semibold ${
                      isDark ? "text-gray-200" : "text-gray-900"
                    }`}
                  >
                    Seuils d'Alertes
                  </Text>
                </View>
                <Text
                  className={`text-sm mb-4 ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Définissez les seuils qui déclencheront des alertes
                </Text>
                <View className="gap-4">
                  <View className="gap-2">
                    <Text
                      className={`text-sm font-medium ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Seuil de dépenses (GNF)
                    </Text>
                    <TextInput
                      value={
                        currentConfig.expenseThreshold?.toString() || ""
                      }
                      onChangeText={(text) => {
                        const filtered = formatDecimalInput(text);
                        updateConfig(selectedCompanyId, {
                          expenseThreshold: filtered
                            ? parseFloat(filtered)
                            : null,
                        });
                      }}
                      placeholder="Ex: 1000000"
                      keyboardType="numeric"
                      className={`h-12 px-4 rounded-lg border text-base ${
                        isDark
                          ? "bg-[#0f172a] border-gray-600 text-gray-100"
                          : "bg-white border-gray-300 text-gray-900"
                      }`}
                      placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                      style={{
                        textAlignVertical: "center",
                        includeFontPadding: false,
                        paddingVertical: 0,
                      }}
                    />
                    <Text
                      className={`text-xs ${
                        isDark ? "text-gray-500" : "text-gray-500"
                      }`}
                    >
                      Alerte lorsque les dépenses mensuelles dépassent ce montant
                    </Text>
                  </View>

                  <View className="gap-2">
                    <Text
                      className={`text-sm font-medium ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Seuil de solde bas (GNF)
                    </Text>
                    <TextInput
                      value={
                        currentConfig.lowBalanceThreshold?.toString() || ""
                      }
                      onChangeText={(text) => {
                        const filtered = formatDecimalInput(text);
                        updateConfig(selectedCompanyId, {
                          lowBalanceThreshold: filtered
                            ? parseFloat(filtered)
                            : null,
                        });
                      }}
                      placeholder="Ex: 500000"
                      keyboardType="numeric"
                      className={`h-12 px-4 rounded-lg border text-base ${
                        isDark
                          ? "bg-[#0f172a] border-gray-600 text-gray-100"
                          : "bg-white border-gray-300 text-gray-900"
                      }`}
                      placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                      style={{
                        textAlignVertical: "center",
                        includeFontPadding: false,
                        paddingVertical: 0,
                      }}
                    />
                    <Text
                      className={`text-xs ${
                        isDark ? "text-gray-500" : "text-gray-500"
                      }`}
                    >
                      Alerte lorsque le solde descend en dessous de ce montant
                    </Text>
                  </View>
                </View>
              </View>

              {/* Types d'alertes */}
              <View
                className={`p-4 rounded-lg mb-4 ${
                  isDark
                    ? "bg-[#1e293b] border border-gray-700"
                    : "bg-white border border-gray-200"
                }`}
              >
                <View className="flex-row items-center gap-2 mb-3">
                  <HugeiconsIcon
                    icon={Notification01Icon}
                    size={20}
                    color={isDark ? "#60a5fa" : "#2563eb"}
                  />
                  <Text
                    className={`text-base font-semibold ${
                      isDark ? "text-gray-200" : "text-gray-900"
                    }`}
                  >
                    Types d'Alertes
                  </Text>
                </View>
                <Text
                  className={`text-sm mb-4 ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Activez ou désactivez les différents types d'alertes
                </Text>
                <View className="gap-3">
                  <AlertTypeToggle
                    icon={MoneySend01Icon}
                    label="Alertes de dépenses"
                    description="Alertes lorsque les dépenses dépassent le seuil"
                    enabled={currentConfig.enableExpenseAlerts}
                    onChange={(enabled) =>
                      updateConfig(selectedCompanyId, {
                        enableExpenseAlerts: enabled,
                      })
                    }
                  />

                  <AlertTypeToggle
                    icon={BankIcon}
                    label="Alertes de solde bas"
                    description="Alertes lorsque le solde est faible"
                    enabled={currentConfig.enableLowBalanceAlerts}
                    onChange={(enabled) =>
                      updateConfig(selectedCompanyId, {
                        enableLowBalanceAlerts: enabled,
                      })
                    }
                  />

                  <AlertTypeToggle
                    icon={Calendar03Icon}
                    label="Alertes d'échéance"
                    description="Alertes pour les échéances de Placements et prêts"
                    enabled={currentConfig.enableMaturityAlerts}
                    onChange={(enabled) =>
                      updateConfig(selectedCompanyId, {
                        enableMaturityAlerts: enabled,
                      })
                    }
                  />

                  <AlertTypeToggle
                    icon={MoneySend01Icon}
                    label="Alertes de prêts"
                    description="Alertes pour les remboursements de prêts"
                    enabled={currentConfig.enableLoanAlerts}
                    onChange={(enabled) =>
                      updateConfig(selectedCompanyId, {
                        enableLoanAlerts: enabled,
                      })
                    }
                  />

                  <AlertTypeToggle
                    icon={MoneySend01Icon}
                    label="Alertes d'investissements"
                    description="Alertes pour les investissements importants"
                    enabled={currentConfig.enableInvestmentAlerts}
                    onChange={(enabled) =>
                      updateConfig(selectedCompanyId, {
                        enableInvestmentAlerts: enabled,
                      })
                    }
                  />
                </View>
              </View>

              {/* Canaux de notification */}
              <View
                className={`p-4 rounded-lg mb-4 ${
                  isDark
                    ? "bg-[#1e293b] border border-gray-700"
                    : "bg-white border border-gray-200"
                }`}
              >
                <View className="flex-row items-center gap-2 mb-3">
                  <HugeiconsIcon
                    icon={Notification01Icon}
                    size={20}
                    color={isDark ? "#60a5fa" : "#2563eb"}
                  />
                  <Text
                    className={`text-base font-semibold ${
                      isDark ? "text-gray-200" : "text-gray-900"
                    }`}
                  >
                    Canaux de Notification
                  </Text>
                </View>
                <Text
                  className={`text-sm mb-4 ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Choisissez comment vous souhaitez recevoir les alertes
                </Text>
                <View className="gap-3">
                  <NotificationChannelToggle
                    icon={Mail01Icon}
                    label="Email"
                    description="Recevoir les alertes par email"
                    enabled={currentConfig.notifyByEmail}
                    onChange={(enabled) =>
                      updateConfig(selectedCompanyId, {
                        notifyByEmail: enabled,
                      })
                    }
                  />

                  <NotificationChannelToggle
                    icon={Message01Icon}
                    label="SMS"
                    description="Recevoir les alertes par SMS"
                    enabled={currentConfig.notifyBySMS}
                    onChange={(enabled) =>
                      updateConfig(selectedCompanyId, {
                        notifyBySMS: enabled,
                      })
                    }
                  />

                  <NotificationChannelToggle
                    icon={Notification01Icon}
                    label="Dans l'application"
                    description="Afficher les alertes dans l'application"
                    enabled={currentConfig.notifyInApp}
                    onChange={(enabled) =>
                      updateConfig(selectedCompanyId, {
                        notifyInApp: enabled,
                      })
                    }
                  />
                </View>
              </View>

              {/* Préférences */}
              <View
                className={`p-4 rounded-lg mb-4 ${
                  isDark
                    ? "bg-[#1e293b] border border-gray-700"
                    : "bg-white border border-gray-200"
                }`}
              >
                <View className="flex-row items-center gap-2 mb-3">
                  <HugeiconsIcon
                    icon={Settings01Icon}
                    size={20}
                    color={isDark ? "#60a5fa" : "#2563eb"}
                  />
                  <Text
                    className={`text-base font-semibold ${
                      isDark ? "text-gray-200" : "text-gray-900"
                    }`}
                  >
                    Préférences
                  </Text>
                </View>
                <Text
                  className={`text-sm mb-4 ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Configurez la fréquence et les paramètres des alertes
                </Text>
                <View className="gap-4">
                  <View className="gap-2">
                    <Text
                      className={`text-sm font-medium ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Fréquence des alertes
                    </Text>
                    <Select
                      value={currentConfig.alertFrequency}
                      onValueChange={(value) =>
                        updateConfig(selectedCompanyId, {
                          alertFrequency: value as
                            | "IMMEDIATE"
                            | "DAILY"
                            | "WEEKLY",
                        })
                      }
                      options={[
                        { label: "Immédiat", value: "IMMEDIATE" },
                        { label: "Quotidien (résumé)", value: "DAILY" },
                        { label: "Hebdomadaire (résumé)", value: "WEEKLY" },
                      ]}
                    />
                    <Text
                      className={`text-xs ${
                        isDark ? "text-gray-500" : "text-gray-500"
                      }`}
                    >
                      Détermine à quelle fréquence vous recevrez les alertes
                    </Text>
                  </View>

                  <View className="gap-2">
                    <Text
                      className={`text-sm font-medium ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Alerter avant l'échéance (jours)
                    </Text>
                    <TextInput
                      value={currentConfig.alertBeforeDays.toString()}
                      onChangeText={(text) =>
                        updateConfig(selectedCompanyId, {
                          alertBeforeDays: parseInt(formatIntegerInput(text), 10) || 7,
                        })
                      }
                      placeholder="7"
                      keyboardType="numeric"
                      className={`h-12 px-4 rounded-lg border text-base ${
                        isDark
                          ? "bg-[#0f172a] border-gray-600 text-gray-100"
                          : "bg-white border-gray-300 text-gray-900"
                      }`}
                      placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                      style={{
                        textAlignVertical: "center",
                        includeFontPadding: false,
                        paddingVertical: 0,
                      }}
                    />
                    <Text
                      className={`text-xs ${
                        isDark ? "text-gray-500" : "text-gray-500"
                      }`}
                    >
                      Nombre de jours avant l'échéance pour recevoir une alerte
                    </Text>
                  </View>
                </View>
              </View>

              {/* Bouton de sauvegarde */}
              <View className="mb-4">
                <TouchableOpacity
                  onPress={saveConfig}
                  disabled={saving || !canUpdate}
                  className={`w-full flex-row items-center justify-center rounded-full h-12 px-4 ${
                    saving || !canUpdate ? "opacity-50" : ""
                  }`}
                  style={{ backgroundColor: CHART_COLOR }}
                  activeOpacity={0.7}
                >
                  {saving ? (
                    <ActivityIndicator color="#ffffff" size="small" />
                  ) : (
                    <>
                      <HugeiconsIcon
                        icon={CheckmarkCircle02Icon}
                        size={18}
                        color="#ffffff"
                      />
                      <Text className="text-white font-semibold ml-2">
                        Enregistrer la configuration
                      </Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}

          {selectedCompanyId && !currentConfig && (
            <View
              className={`p-12 rounded-lg items-center ${
                isDark ? "bg-[#1e293b] border border-gray-700" : "bg-white border border-gray-200"
              }`}
            >
              <HugeiconsIcon
                icon={AlertDiamondIcon}
                size={48}
                color={isDark ? "#9ca3af" : "#6b7280"}
              />
              <Text
                className={`text-center mt-4 ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Chargement de la configuration...
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
