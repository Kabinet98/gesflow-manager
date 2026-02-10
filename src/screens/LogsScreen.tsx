import React, {
  useState,
  useMemo,
  useRef,
  useCallback,
  useEffect,
} from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Dimensions,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/config/api";
import { useTheme } from "@/contexts/ThemeContext";
import { usePermissions } from "@/hooks/usePermissions";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  Search01Icon,
  FilterIcon,
  Activity03Icon,
  CameraAiIcon,
  UserRoadsideIcon,
  EyeIcon,
} from "@hugeicons/core-free-icons";
import { LogsSkeleton } from "@/components/skeletons/LogsSkeleton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { REFRESH_CONTROL_COLOR, TAB_BAR_PADDING_BOTTOM } from "@/constants/layout";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_COLOR = "#0ea5e9";

interface AuditLog {
  id: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  description: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  userAgent: string | null;
  metadata: any;
  isScreenshot: boolean;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
}

interface LogsResponse {
  logs: AuditLog[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  screenshotCount: number;
}

// Note: On charge toutes les données sans pagination pour la table virtuelle

// Composant pour une ligne de log (nécessaire pour utiliser useRef correctement)
interface LogRowProps {
  log: AuditLog;
  isDark: boolean;
  columnWidths: Record<string, number>;
  totalTableWidth: number;
  formatDate: (dateString: string) => string;
  getActionBadgeColor: (action: string) => string;
  getActionTextColor: (action: string) => string;
  handleContentScroll: (logId: string) => (event: any) => void;
  handleViewScreenshot: (log: AuditLog) => void;
  contentScrollRefs: React.MutableRefObject<Map<string, ScrollView>>;
  scrollXRef: React.MutableRefObject<number>;
}

const LogRow = React.memo(({
  log,
  isDark,
  columnWidths,
  totalTableWidth,
  formatDate,
  getActionBadgeColor,
  getActionTextColor,
  handleContentScroll,
  handleViewScreenshot,
  contentScrollRefs,
  scrollXRef,
}: LogRowProps) => {
  const isScreenshot = log.isScreenshot;
  const isVideoRecording = log.action === 'video_recording_detected';

  return (
    <View
      className={`border-b ${
        isScreenshot
          ? isDark
            ? "border-l-4 border-l-orange-500 bg-orange-950/20"
            : "border-l-4 border-l-orange-500 bg-orange-50/50"
          : isVideoRecording
          ? isDark
            ? "border-l-4 border-l-red-500 bg-red-950/20"
            : "border-l-4 border-l-red-500 bg-red-50/50"
          : isDark
          ? "border-gray-800 bg-[#0f172a]"
          : "border-gray-100 bg-white"
      }`}
    >
      <ScrollView
        ref={(ref) => {
          if (ref) {
            contentScrollRefs.current.set(log.id, ref);
            // Synchroniser avec la position actuelle
            if (scrollXRef.current > 0) {
              requestAnimationFrame(() => {
                ref.scrollTo({
                  x: scrollXRef.current,
                  animated: false,
                });
              });
            }
          } else {
            contentScrollRefs.current.delete(log.id);
          }
        }}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleContentScroll(log.id)}
        scrollEventThrottle={16}
        contentContainerStyle={{
          minWidth: totalTableWidth - columnWidths.actions,
          paddingRight: columnWidths.actions,
        }}
      >
        <View
          className="flex-row"
          style={{
            minWidth: totalTableWidth - columnWidths.actions,
          }}
        >
          {/* Date/Heure */}
          <View
            style={{ width: columnWidths.date }}
            className="px-3 py-3"
          >
            <Text
              className={`text-xs font-mono ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
            >
              {formatDate(log.createdAt)}
            </Text>
          </View>

          {/* Utilisateur */}
          <View
            style={{ width: columnWidths.user }}
            className="px-3 py-3"
          >
            <Text
              className={`text-sm font-medium ${
                isDark ? "text-gray-200" : "text-gray-900"
              }`}
              numberOfLines={1}
            >
              {log.userName || log.user?.name || "N/A"}
            </Text>
            <Text
              className={`text-xs ${
                isDark ? "text-gray-500" : "text-gray-500"
              }`}
              numberOfLines={1}
            >
              {log.userEmail || log.user?.email || "N/A"}
            </Text>
          </View>

          {/* Action */}
          <View
            style={{ width: columnWidths.action }}
            className="px-3 py-3"
          >
            <View
              className="px-2 py-1 rounded-full"
              style={{
                backgroundColor: getActionBadgeColor(log.action),
                alignSelf: "flex-start",
              }}
            >
              <Text
                className="text-xs font-medium"
                style={{
                  color: getActionTextColor(log.action),
                  whiteSpace: "nowrap",
                }}
                numberOfLines={1}
              >
                {log.action}
              </Text>
            </View>
          </View>

          {/* Ressource */}
          <View
            style={{ width: columnWidths.resource }}
            className="px-3 py-3"
          >
            {log.resource ? (
              <View
                className="px-2 py-1 rounded-full self-start border"
                style={{
                  borderColor: isDark ? "#6b7280" : "#d1d5db",
                }}
              >
                <Text
                  className={`text-xs font-medium ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  {log.resource}
                </Text>
              </View>
            ) : (
              <Text
                className={`text-xs ${
                  isDark ? "text-gray-500" : "text-gray-400"
                }`}
              >
                -
              </Text>
            )}
          </View>

          {/* Description */}
          <View
            style={{ width: columnWidths.description }}
            className="px-3 py-3"
          >
            <View className="flex-row items-center gap-2">
              <Text
                className={`text-sm flex-1 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
                numberOfLines={2}
              >
                {log.description || "-"}
              </Text>
              {isScreenshot && (
                <HugeiconsIcon
                  icon={CameraAiIcon}
                  size={16}
                  color={isDark ? "#fb923c" : "#ea580c"}
                />
              )}
            </View>
          </View>

          {/* Adresse IP */}
          <View
            style={{ width: columnWidths.ip }}
            className="px-3 py-3"
          >
            <Text
              className={`text-xs font-mono ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
              numberOfLines={1}
            >
              {log.ipAddress || "-"}
            </Text>
          </View>

          {/* Type */}
          <View
            style={{ width: columnWidths.type }}
            className="px-3 py-3"
          >
            {isScreenshot ? (
              <View
                className="px-2 py-1 rounded-full self-start flex-row items-center gap-1"
                style={{
                  backgroundColor: isDark
                    ? "rgba(249, 115, 22, 0.2)"
                    : "#ffedd5",
                }}
              >
                <HugeiconsIcon
                  icon={CameraAiIcon}
                  size={12}
                  color={isDark ? "#fb923c" : "#ea580c"}
                />
                <Text
                  className="text-xs font-medium whitespace-nowrap"
                  style={{
                    color: isDark ? "#fb923c" : "#ea580c",
                  }}
                >
                  Capture
                </Text>
              </View>
            ) : log.action === 'video_recording_detected' ? (
              <View
                className="px-2 py-1 rounded-full self-start flex-row items-center gap-1"
                style={{
                  backgroundColor: isDark
                    ? "rgba(239, 68, 68, 0.2)"
                    : "#fee2e2",
                }}
              >
                <HugeiconsIcon
                  icon={CameraAiIcon}
                  size={12}
                  color={isDark ? "#f87171" : "#dc2626"}
                />
                <Text
                  className="text-xs font-medium whitespace-nowrap"
                  style={{
                    color: isDark ? "#f87171" : "#dc2626",
                  }}
                >
                  Enregistrement
                </Text>
              </View>
            ) : (
              <View
                className="px-2 py-1 rounded-full self-start border flex-row items-center"
                style={{
                  borderColor: isDark ? "#6b7280" : "#d1d5db",
                }}
              >
                <Text
                  className={`text-xs font-medium whitespace-nowrap ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Action
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Actions (sticky à droite - position absolute) */}
      <View
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: columnWidths.actions,
          backgroundColor: isScreenshot || isVideoRecording
            ? isDark
              ? "rgba(15, 23, 42, 0.95)"
              : "rgba(255, 255, 255, 0.95)"
            : isDark
            ? "#0f172a"
            : "#ffffff",
        }}
        className="flex-row items-center justify-center px-2 border-l"
      >
        {(isScreenshot || isVideoRecording) && (
          <TouchableOpacity
            onPress={() => handleViewScreenshot(log)}
            className="p-2 rounded-lg"
            style={{
              backgroundColor: isVideoRecording
                ? isDark
                  ? "rgba(239, 68, 68, 0.1)"
                  : "#fee2e2"
                : isDark
                ? "rgba(249, 115, 22, 0.1)"
                : "#ffedd5",
            }}
            activeOpacity={0.7}
          >
            <HugeiconsIcon
              icon={EyeIcon}
              size={18}
              color={isVideoRecording
                ? isDark ? "#f87171" : "#dc2626"
                : isDark ? "#fb923c" : "#ea580c"}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

LogRow.displayName = "LogRow";

export function LogsScreen() {
  const { isDark } = useTheme();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedAction, setSelectedAction] = useState<string>("all");
  const [selectedResource, setSelectedResource] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<string>("all");
  const [screenshotFilter, setScreenshotFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [selectedScreenshot, setSelectedScreenshot] = useState<AuditLog | null>(null);
  const [showFiltersDrawer, setShowFiltersDrawer] = useState(false);

  // Refs pour synchroniser le scroll
  const headerScrollRef = useRef<ScrollView>(null);
  const contentScrollRefs = useRef<Map<string, ScrollView>>(new Map());
  const scrollXRef = useRef(0);
  const isScrollingRef = useRef(false);

  const canView = hasPermission("logs.view");

  // Récupérer les logs - charger toutes les données sans pagination
  const {
    data: logsData,
    isLoading,
    error,
    refetch,
  } = useQuery<LogsResponse>({
    queryKey: [
      "logs",
      search,
      selectedAction,
      selectedResource,
      selectedUser,
      screenshotFilter,
      startDate,
      endDate,
    ],
    queryFn: async () => {
      try {
        // Charger toutes les données avec une limite élevée
        const params = new URLSearchParams({
          page: "1",
          limit: "10000", // Limite élevée pour charger toutes les données
        });

        if (search) params.append("search", search);
        if (selectedAction !== "all") params.append("action", selectedAction);
        if (selectedResource !== "all") params.append("resource", selectedResource);
        if (selectedUser !== "all") params.append("userId", selectedUser);
        if (screenshotFilter === "true") params.append("isScreenshot", "true");
        if (startDate) params.append("startDate", startDate);
        if (endDate) params.append("endDate", endDate);

        const response = await api.get(`/api/logs?${params.toString()}`);
        return response.data;
      } catch (err: any) {
        throw err;
      }
    },
    enabled: canView,
    refetchInterval: 30000, // Auto-refresh toutes les 30 secondes
  });

  const logs = logsData?.logs || [];
  const total = logsData?.pagination?.total || 0;
  const screenshotCount = logsData?.screenshotCount || 0;

  // Extraire les actions, ressources et utilisateurs uniques pour les filtres
  const uniqueActions = useMemo(() => {
    const actions = new Set<string>();
    logs.forEach((log) => {
      if (log.action) actions.add(log.action);
    });
    return Array.from(actions).sort();
  }, [logs]);

  const uniqueResources = useMemo(() => {
    const resources = new Set<string>();
    logs.forEach((log) => {
      if (log.resource) resources.add(log.resource);
    });
    return Array.from(resources).sort();
  }, [logs]);

  const uniqueUsers = useMemo(() => {
    const usersMap = new Map<string, { id: string; name: string; email: string }>();
    logs.forEach((log) => {
      if (log.userId) {
        usersMap.set(log.userId, {
          id: log.userId,
          name: log.userName || log.user?.name || "N/A",
          email: log.userEmail || log.user?.email || "N/A",
        });
      }
    });
    return Array.from(usersMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [logs]);

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

  const handleResetFilters = () => {
    setSearch("");
    setSelectedAction("all");
    setSelectedResource("all");
    setSelectedUser("all");
    setScreenshotFilter("all");
    setStartDate("");
    setEndDate("");
  };

  // Gestion du scroll synchronisé
  const handleHeaderScroll = useCallback(
    (event: any) => {
      if (isScrollingRef.current) return; // Éviter les boucles de synchronisation
      const offsetX = event.nativeEvent.contentOffset.x;
      scrollXRef.current = offsetX;
      isScrollingRef.current = true;

      // Synchroniser toutes les lignes
      contentScrollRefs.current.forEach((scrollView) => {
        if (scrollView) {
          scrollView.scrollTo({ x: offsetX, animated: false });
        }
      });

      // Réinitialiser le flag après un court délai
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 100);
    },
    []
  );

  const handleContentScroll = useCallback(
    (logId: string) => (event: any) => {
      if (isScrollingRef.current) return; // Éviter les boucles de synchronisation
      const offsetX = event.nativeEvent.contentOffset.x;
      scrollXRef.current = offsetX;
      isScrollingRef.current = true;

      // Synchroniser le header
      if (headerScrollRef.current) {
        headerScrollRef.current.scrollTo({ x: offsetX, animated: false });
      }

      // Synchroniser toutes les autres lignes
      contentScrollRefs.current.forEach((scrollView, id) => {
        if (id !== logId && scrollView) {
          scrollView.scrollTo({ x: offsetX, animated: false });
        }
      });

      // Réinitialiser le flag après un court délai
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 100);
    },
    []
  );

  // Largeurs des colonnes
  const columnWidths = {
    date: 150,
    user: 180,
    action: 120,
    resource: 120,
    description: 250,
    ip: 130,
    type: 120,
    actions: 80,
  };

  const totalTableWidth = Object.values(columnWidths).reduce(
    (sum, width) => sum + width,
    0
  );

  // Fonctions utilitaires
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat("fr-FR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).format(date);
  };

  const getActionBadgeColor = (action: string) => {
    if (action.includes("create")) return isDark ? "rgba(34, 197, 94, 0.2)" : "#dcfce7";
    if (action.includes("update")) return isDark ? "rgba(59, 130, 246, 0.2)" : "#dbeafe";
    if (action.includes("delete")) return isDark ? "rgba(239, 68, 68, 0.2)" : "#fee2e2";
    if (action.includes("login")) return isDark ? "rgba(168, 85, 247, 0.2)" : "#f3e8ff";
    if (action.includes("logout")) return isDark ? "rgba(100, 116, 139, 0.2)" : "#f1f5f9";
    if (action.includes("screenshot")) return isDark ? "rgba(249, 115, 22, 0.2)" : "#ffedd5";
    return isDark ? "rgba(107, 114, 128, 0.2)" : "#f3f4f6";
  };

  const getActionTextColor = (action: string) => {
    if (action.includes("create")) return isDark ? "#4ade80" : "#16a34a";
    if (action.includes("update")) return isDark ? "#60a5fa" : "#2563eb";
    if (action.includes("delete")) return isDark ? "#f87171" : "#dc2626";
    if (action.includes("login")) return isDark ? "#a78bfa" : "#9333ea";
    if (action.includes("logout")) return isDark ? "#94a3b8" : "#64748b";
    if (action.includes("screenshot")) return isDark ? "#fb923c" : "#ea580c";
    return isDark ? "#9ca3af" : "#6b7280";
  };

  const getDeviceInfo = (log: AuditLog) => {
    if (log.metadata?.device) {
      return log.metadata.device;
    }

    const userAgent = log.userAgent || "";
    const isExpo = /Expo\//i.test(userAgent);
    const isCFNetwork = /CFNetwork/i.test(userAgent);
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Expo|CFNetwork/i.test(userAgent);
    const isTablet = /iPad|Android/i.test(userAgent) && !/Mobile/i.test(userAgent) && !isExpo;
    const isDesktop = !isMobile && !isTablet;

    let browser = "Unknown";
    if (isExpo) {
      const expoMatch = userAgent.match(/Expo\/([\d.]+)/i);
      browser = expoMatch ? `Expo ${expoMatch[1]}` : "Expo";
    } else if (userAgent.indexOf("Chrome") > -1 && userAgent.indexOf("Edg") === -1) {
      browser = "Chrome";
    } else if (userAgent.indexOf("Safari") > -1 && userAgent.indexOf("Chrome") === -1) {
      browser = "Safari";
    } else if (userAgent.indexOf("Firefox") > -1) {
      browser = "Firefox";
    } else if (userAgent.indexOf("Edg") > -1) {
      browser = "Edge";
    } else if (isCFNetwork) {
      browser = "Safari (iOS)";
    }

    let os = "Unknown";
    if (isCFNetwork || isExpo) {
      os = "iOS";
    } else if (userAgent.indexOf("Win") > -1) {
      os = "Windows";
    } else if (userAgent.indexOf("Mac") > -1 && !isCFNetwork) {
      os = "macOS";
    } else if (userAgent.indexOf("Linux") > -1) {
      os = "Linux";
    } else if (userAgent.indexOf("Android") > -1) {
      os = "Android";
    }

    return {
      deviceType: isMobile ? "mobile" : isTablet ? "tablet" : "desktop",
      os,
      browser,
      userAgent,
      isSimulator: isExpo || /Simulator/i.test(userAgent),
    };
  };

  const handleViewScreenshot = (log: AuditLog) => {
    setSelectedScreenshot(log);
    setShowDetailsDrawer(true);
  };

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

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-[#0f172a]" : "bg-white"}`}
      edges={["top", "bottom"]}
    >
      <ScreenHeader />
      <View className="flex-1">
        <View className="px-6 pt-20 pb-4">
          {/* Statistiques */}
          <View className="mb-4">
            <View className="flex-row gap-3" style={{ flexWrap: "wrap" }}>
              {/* Total des actions */}
              <View
                style={{
                  width: (SCREEN_WIDTH - 48 - 12) / 2,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 4,
                }}
                className={`relative overflow-hidden p-4 rounded-lg border ${
                  isDark
                    ? "bg-gradient-to-br from-blue-900/20 to-blue-800/20 border-gray-700/50"
                    : "bg-gradient-to-br from-blue-50 to-blue-100 border-gray-200"
                }`}
              >
                <View
                  className="absolute top-0 right-0 w-20 h-20 rounded-full bg-blue-500/10"
                  style={{
                    transform: [{ translateX: 40 }, { translateY: -40 }],
                  }}
                />
                <View className="relative z-10">
                  <Text
                    className={`text-sm font-medium mb-2 ${
                      isDark ? "text-blue-200" : "text-blue-800"
                    }`}
                  >
                    Total des actions
                  </Text>
                  <Text
                    className={`text-xl font-bold ${
                      isDark ? "text-blue-200" : "text-blue-800"
                    }`}
                  >
                    {total.toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Captures d'écran */}
              <View
                style={{
                  width: (SCREEN_WIDTH - 48 - 12) / 2,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 4,
                }}
                className={`relative overflow-hidden p-4 rounded-lg border ${
                  isDark
                    ? "bg-gradient-to-br from-orange-900/20 to-orange-800/20 border-gray-700/50"
                    : "bg-gradient-to-br from-orange-50 to-orange-100 border-gray-200"
                }`}
              >
                <View
                  className="absolute top-0 right-0 w-20 h-20 rounded-full bg-orange-500/10"
                  style={{
                    transform: [{ translateX: 40 }, { translateY: -40 }],
                  }}
                />
                <View className="relative z-10">
                  <Text
                    className={`text-sm font-medium mb-2 ${
                      isDark ? "text-orange-200" : "text-orange-800"
                    }`}
                  >
                    Captures d'écran
                  </Text>
                  <Text
                    className={`text-xl font-bold ${
                      isDark ? "text-orange-200" : "text-orange-800"
                    }`}
                  >
                    {screenshotCount.toLocaleString()}
                  </Text>
                </View>
              </View>

              {/* Utilisateurs uniques */}
              <View
                style={{
                  width: (SCREEN_WIDTH - 48 - 12) / 2,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.1,
                  shadowRadius: 8,
                  elevation: 4,
                }}
                className={`relative overflow-hidden p-4 rounded-lg border ${
                  isDark
                    ? "bg-gradient-to-br from-purple-900/20 to-purple-800/20 border-gray-700/50"
                    : "bg-gradient-to-br from-purple-50 to-purple-100 border-gray-200"
                }`}
              >
                <View
                  className="absolute top-0 right-0 w-20 h-20 rounded-full bg-purple-500/10"
                  style={{
                    transform: [{ translateX: 40 }, { translateY: -40 }],
                  }}
                />
                <View className="relative z-10">
                  <Text
                    className={`text-sm font-medium mb-2 ${
                      isDark ? "text-purple-200" : "text-purple-800"
                    }`}
                  >
                    Utilisateurs uniques
                  </Text>
                  <Text
                    className={`text-xl font-bold ${
                      isDark ? "text-purple-200" : "text-purple-800"
                    }`}
                  >
                    {uniqueUsers.length}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Barre de recherche et filtre */}
          <View className="flex-row items-center gap-2 mb-4">
            <View
              className={`flex-1 flex-row items-center gap-2 px-4 py-2.5 rounded-full ${
                isDark ? "bg-[#1e293b]" : "bg-gray-100"
              }`}
            >
              <HugeiconsIcon
                icon={Search01Icon}
                size={18}
                color={isDark ? "#9ca3af" : "#6b7280"}
              />
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="Rechercher..."
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                className={`flex-1 text-sm ${
                  isDark ? "text-gray-100" : "text-gray-900"
                }`}
                style={{
                  textAlignVertical: "center",
                  includeFontPadding: false,
                  paddingVertical: 0,
                  minHeight: 20,
                }}
              />
            </View>
            <TouchableOpacity
              onPress={() => setShowFiltersDrawer(true)}
              className={`px-3 py-2.5 rounded-full flex-row items-center gap-1.5 ${
                isDark ? "bg-[#1e293b]" : "bg-gray-100"
              }`}
              activeOpacity={0.7}
            >
              <HugeiconsIcon
                icon={FilterIcon}
                size={18}
                color={isDark ? "#9ca3af" : "#6b7280"}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Table avec scroll horizontal synchronisé */}
        {isLoading || !logsData ? (
          <LogsSkeleton />
        ) : (
          <View className="flex-1">
            {/* En-têtes de colonnes avec scroll synchronisé */}
            <View
              className={`border-b ${
                isDark
                  ? "border-gray-700 bg-[#1e293b]"
                  : "border-gray-200 bg-gray-50"
              }`}
              style={{ position: "relative" }}
            >
              <ScrollView
                ref={headerScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                onScroll={handleHeaderScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{
                  minWidth: totalTableWidth - columnWidths.actions,
                  paddingRight: columnWidths.actions,
                }}
              >
                <View
                  className="flex-row"
                  style={{ minWidth: totalTableWidth - columnWidths.actions }}
                >
                  {/* Date/Heure */}
                  <View
                    style={{ width: columnWidths.date }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Date/Heure
                    </Text>
                  </View>

                  {/* Utilisateur */}
                  <View
                    style={{ width: columnWidths.user }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Utilisateur
                    </Text>
                  </View>

                  {/* Action */}
                  <View
                    style={{ width: columnWidths.action }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Action
                    </Text>
                  </View>

                  {/* Ressource */}
                  <View
                    style={{ width: columnWidths.resource }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Ressource
                    </Text>
                  </View>

                  {/* Description */}
                  <View
                    style={{ width: columnWidths.description }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Description
                    </Text>
                  </View>

                  {/* Adresse IP */}
                  <View
                    style={{ width: columnWidths.ip }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Adresse IP
                    </Text>
                  </View>

                  {/* Type */}
                  <View
                    style={{ width: columnWidths.type }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Type
                    </Text>
                  </View>
                </View>
              </ScrollView>
              {/* Actions (sticky à droite - position absolute) */}
              <View
                style={{
                  position: "absolute",
                  right: 0,
                  top: 0,
                  bottom: 0,
                  width: columnWidths.actions,
                  backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                }}
                className="flex-row items-center justify-center px-2 border-l"
              >
                <Text
                  className={`text-xs font-semibold uppercase ${
                    isDark ? "text-gray-400" : "text-gray-500"
                  }`}
                >
                  Actions
                </Text>
              </View>
            </View>

            {/* Contenu avec scroll synchronisé */}
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
              {logs.length === 0 ? (
                <View className="flex-1 justify-center items-center py-12">
                  <HugeiconsIcon
                    icon={Activity03Icon}
                    size={48}
                    color={isDark ? "#6b7280" : "#9ca3af"}
                  />
                  <Text
                    className={`text-center mt-4 ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    {search ||
                    selectedAction !== "all" ||
                    selectedResource !== "all" ||
                    screenshotFilter !== "all"
                      ? "Aucun log trouvé avec les filtres sélectionnés"
                      : "Aucun log enregistré"}
                  </Text>
                </View>
              ) : (
                logs.map((log: AuditLog) => (
                  <LogRow
                    key={log.id}
                    log={log}
                    isDark={isDark}
                    columnWidths={columnWidths}
                    totalTableWidth={totalTableWidth}
                    formatDate={formatDate}
                    getActionBadgeColor={getActionBadgeColor}
                    getActionTextColor={getActionTextColor}
                    handleContentScroll={handleContentScroll}
                    handleViewScreenshot={handleViewScreenshot}
                    contentScrollRefs={contentScrollRefs}
                    scrollXRef={scrollXRef}
                  />
                ))
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Drawer Filtres */}
      <Drawer
        open={showFiltersDrawer}
        onOpenChange={setShowFiltersDrawer}
        title="Filtrer les logs"
      >
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-4 pb-4">
            {/* Filtre par type d'action */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Type d'action
              </Text>
              <Select
                value={selectedAction}
                onValueChange={setSelectedAction}
                placeholder="Toutes les actions"
                options={[
                  { label: "Toutes les actions", value: "all" },
                  ...uniqueActions.map((action) => ({
                    label: action,
                    value: action,
                  })),
                ]}
              />
            </View>

            {/* Filtre par ressource */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Ressource
              </Text>
              <Select
                value={selectedResource}
                onValueChange={setSelectedResource}
                placeholder="Toutes les ressources"
                options={[
                  { label: "Toutes les ressources", value: "all" },
                  ...uniqueResources.map((resource) => ({
                    label: resource,
                    value: resource,
                  })),
                ]}
              />
            </View>

            {/* Filtre par utilisateur */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Utilisateur
              </Text>
              <Select
                value={selectedUser}
                onValueChange={setSelectedUser}
                placeholder="Tous les utilisateurs"
                options={[
                  { label: "Tous les utilisateurs", value: "all" },
                  ...uniqueUsers.map((user) => ({
                    label: user.name,
                    value: user.id,
                  })),
                ]}
              />
            </View>

            {/* Filtre captures d'écran */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Type de log
              </Text>
              <Select
                value={screenshotFilter}
                onValueChange={setScreenshotFilter}
                placeholder="Tous les types"
                options={[
                  { label: "Tous les types", value: "all" },
                  { label: "Uniquement les captures d'écran", value: "true" },
                ]}
              />
            </View>

            {/* Date de début */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                À partir de cette date
              </Text>
              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                className={`px-4 py-3 rounded-lg border ${
                  isDark
                    ? "bg-[#1e293b] border-gray-700 text-gray-100"
                    : "bg-gray-100 border-gray-300 text-gray-900"
                }`}
                style={{
                  textAlignVertical: "center",
                  includeFontPadding: false,
                  paddingVertical: 0,
                  minHeight: 48,
                }}
              />
            </View>

            {/* Date de fin */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Jusqu'à cette date
              </Text>
              <TextInput
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                className={`px-4 py-3 rounded-lg border ${
                  isDark
                    ? "bg-[#1e293b] border-gray-700 text-gray-100"
                    : "bg-gray-100 border-gray-300 text-gray-900"
                }`}
                style={{
                  textAlignVertical: "center",
                  includeFontPadding: false,
                  paddingVertical: 0,
                  minHeight: 48,
                }}
              />
            </View>

            {/* Bouton réinitialiser */}
            <View className="mt-4">
              <TouchableOpacity
                onPress={handleResetFilters}
                className={`px-4 py-3 rounded-full border ${
                  isDark
                    ? "border-gray-600 bg-[#1e293b]"
                    : "border-gray-300 bg-white"
                }`}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-sm font-medium text-center ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Réinitialiser tous les filtres
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </Drawer>

      {/* Drawer Détails capture d'écran */}
      <Drawer
        open={showDetailsDrawer}
        onOpenChange={(open) => {
          setShowDetailsDrawer(open);
          if (!open) {
            setSelectedScreenshot(null);
          }
        }}
        title="Détails de la capture d'écran"
      >
        {selectedScreenshot && (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="gap-4 pb-4">
              {/* Informations générales */}
              <View className="gap-2">
                <Text
                  className={`text-sm font-semibold ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Informations générales
                </Text>
                <View
                  className={`p-4 rounded-lg gap-3 ${
                    isDark ? "bg-[#1e293b]" : "bg-gray-50"
                  }`}
                >
                  <View className="flex-row justify-between">
                    <Text
                      className={`text-xs ${
                        isDark ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      Date:
                    </Text>
                    <Text
                      className={`text-sm font-medium ${
                        isDark ? "text-gray-200" : "text-gray-900"
                      }`}
                    >
                      {formatDate(selectedScreenshot.createdAt)}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text
                      className={`text-xs ${
                        isDark ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      Méthode:
                    </Text>
                    <Text
                      className={`text-sm font-medium ${
                        isDark ? "text-gray-200" : "text-gray-900"
                      }`}
                    >
                      {selectedScreenshot.metadata?.method || "N/A"}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text
                      className={`text-xs ${
                        isDark ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      URL:
                    </Text>
                    <Text
                      className={`text-sm font-medium flex-1 text-right ${
                        isDark ? "text-gray-200" : "text-gray-900"
                      }`}
                      numberOfLines={1}
                    >
                      {selectedScreenshot.metadata?.url || "N/A"}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text
                      className={`text-xs ${
                        isDark ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      Adresse IP:
                    </Text>
                    <Text
                      className={`text-sm font-medium ${
                        isDark ? "text-gray-200" : "text-gray-900"
                      }`}
                    >
                      {selectedScreenshot.ipAddress || "N/A"}
                    </Text>
                  </View>
                  <View className="flex-row justify-between">
                    <Text
                      className={`text-xs ${
                        isDark ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      Utilisateur:
                    </Text>
                    <Text
                      className={`text-sm font-medium ${
                        isDark ? "text-gray-200" : "text-gray-900"
                      }`}
                    >
                      {selectedScreenshot.userName ||
                        selectedScreenshot.user?.name ||
                        "N/A"}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Device qui a pris la capture */}
              {(() => {
                const deviceInfo = getDeviceInfo(selectedScreenshot);
                return (
                  <View className="gap-2">
                    <Text
                      className={`text-sm font-semibold ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Device qui a pris la capture
                    </Text>
                    <View
                      className={`p-4 rounded-lg border gap-3 ${
                        isDark
                          ? "bg-orange-950/20 border-orange-800"
                          : "bg-orange-50 border-orange-200"
                      }`}
                    >
                      <View className="flex-row items-center gap-2 flex-wrap">
                        <View
                          className="px-2 py-1 rounded-full"
                          style={{
                            backgroundColor: isDark
                              ? "rgba(249, 115, 22, 0.2)"
                              : "#ffedd5",
                          }}
                        >
                          <Text
                            className="text-xs font-medium"
                            style={{
                              color: isDark ? "#fb923c" : "#ea580c",
                            }}
                          >
                            {deviceInfo.deviceType === "mobile" && "📱 Mobile"}
                            {deviceInfo.deviceType === "tablet" && "📱 Tablet"}
                            {deviceInfo.deviceType === "desktop" && "💻 Desktop"}
                            {!["mobile", "tablet", "desktop"].includes(
                              deviceInfo.deviceType
                            ) &&
                              `❓ ${deviceInfo.deviceType || "Unknown"}`}
                          </Text>
                        </View>
                        <View
                          className="px-2 py-1 rounded-full border"
                          style={{
                            borderColor: isDark ? "#6b7280" : "#d1d5db",
                          }}
                        >
                          <Text
                            className={`text-xs font-medium ${
                              isDark ? "text-gray-300" : "text-gray-700"
                            }`}
                          >
                            {deviceInfo.os || "N/A"}
                          </Text>
                        </View>
                        <View
                          className="px-2 py-1 rounded-full border"
                          style={{
                            borderColor: isDark ? "#6b7280" : "#d1d5db",
                          }}
                        >
                          <Text
                            className={`text-xs font-medium ${
                              isDark ? "text-gray-300" : "text-gray-700"
                            }`}
                          >
                            {deviceInfo.browser || "N/A"}
                          </Text>
                        </View>
                        {(deviceInfo.isSimulator ||
                          selectedScreenshot.metadata?.device?.isSimulator) && (
                          <View
                            className="px-2 py-1 rounded-full border"
                            style={{
                              borderColor: isDark ? "#fbbf24" : "#f59e0b",
                              backgroundColor: isDark
                                ? "rgba(251, 191, 36, 0.1)"
                                : "#fef3c7",
                            }}
                          >
                            <Text
                              className="text-xs font-medium"
                              style={{
                                color: isDark ? "#fbbf24" : "#d97706",
                              }}
                            >
                              🧪 Simulateur
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                );
              })()}

              {/* Informations détaillées du device */}
              {(() => {
                const deviceInfo = getDeviceInfo(selectedScreenshot);
                if (
                  !selectedScreenshot.metadata?.device &&
                  !selectedScreenshot.userAgent
                ) {
                  return null;
                }
                return (
                  <View className="gap-4">
                    <Text
                      className={`text-sm font-semibold ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Informations détaillées du device
                    </Text>

                    {/* Type d'appareil */}
                    <View className="gap-2">
                      <Text
                        className={`text-xs font-medium ${
                          isDark ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        Type d'appareil
                      </Text>
                      <View
                        className={`p-3 rounded-lg gap-3 ${
                          isDark ? "bg-[#1e293b]" : "bg-gray-50"
                        }`}
                      >
                        <View className="flex-row justify-between">
                          <Text
                            className={`text-xs ${
                              isDark ? "text-gray-400" : "text-gray-600"
                            }`}
                          >
                            Type:
                          </Text>
                          <Text
                            className={`text-sm font-medium capitalize ${
                              isDark ? "text-gray-200" : "text-gray-900"
                            }`}
                          >
                            {deviceInfo.deviceType || "N/A"}
                          </Text>
                        </View>
                        <View className="flex-row justify-between">
                          <Text
                            className={`text-xs ${
                              isDark ? "text-gray-400" : "text-gray-600"
                            }`}
                          >
                            OS:
                          </Text>
                          <Text
                            className={`text-sm font-medium ${
                              isDark ? "text-gray-200" : "text-gray-900"
                            }`}
                          >
                            {deviceInfo.os || "N/A"}
                          </Text>
                        </View>
                        {deviceInfo.osVersion && (
                          <View className="flex-row justify-between">
                            <Text
                              className={`text-xs ${
                                isDark ? "text-gray-400" : "text-gray-600"
                              }`}
                            >
                              Version OS:
                            </Text>
                            <Text
                              className={`text-sm font-medium ${
                                isDark ? "text-gray-200" : "text-gray-900"
                              }`}
                            >
                              {deviceInfo.osVersion}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Navigateur */}
                    <View className="gap-2">
                      <Text
                        className={`text-xs font-medium ${
                          isDark ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        Navigateur
                      </Text>
                      <View
                        className={`p-3 rounded-lg gap-3 ${
                          isDark ? "bg-[#1e293b]" : "bg-gray-50"
                        }`}
                      >
                        <View className="flex-row justify-between">
                          <Text
                            className={`text-xs ${
                              isDark ? "text-gray-400" : "text-gray-600"
                            }`}
                          >
                            Navigateur:
                          </Text>
                          <Text
                            className={`text-sm font-medium ${
                              isDark ? "text-gray-200" : "text-gray-900"
                            }`}
                          >
                            {deviceInfo.browser || "N/A"}
                          </Text>
                        </View>
                        {deviceInfo.browserVersion && (
                          <View className="flex-row justify-between">
                            <Text
                              className={`text-xs ${
                                isDark ? "text-gray-400" : "text-gray-600"
                              }`}
                            >
                              Version:
                            </Text>
                            <Text
                              className={`text-sm font-medium ${
                                isDark ? "text-gray-200" : "text-gray-900"
                              }`}
                            >
                              {deviceInfo.browserVersion}
                            </Text>
                          </View>
                        )}
                        {deviceInfo.userAgent && (
                          <View className="gap-1">
                            <Text
                              className={`text-xs ${
                                isDark ? "text-gray-400" : "text-gray-600"
                              }`}
                            >
                              User Agent:
                            </Text>
                            <Text
                              className={`text-xs font-mono ${
                                isDark ? "text-gray-300" : "text-gray-700"
                              }`}
                              numberOfLines={3}
                            >
                              {deviceInfo.userAgent}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Écran - seulement si disponible */}
                    {selectedScreenshot.metadata?.device?.screenWidth && (
                      <View className="gap-2">
                        <Text
                          className={`text-xs font-medium ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          Écran
                        </Text>
                        <View
                          className={`p-3 rounded-lg gap-3 ${
                            isDark ? "bg-[#1e293b]" : "bg-gray-50"
                          }`}
                        >
                          <View className="flex-row justify-between">
                            <Text
                              className={`text-xs ${
                                isDark ? "text-gray-400" : "text-gray-600"
                              }`}
                            >
                              Résolution:
                            </Text>
                            <Text
                              className={`text-sm font-medium ${
                                isDark ? "text-gray-200" : "text-gray-900"
                              }`}
                            >
                              {selectedScreenshot.metadata.device.screenWidth}x
                              {selectedScreenshot.metadata.device.screenHeight}
                            </Text>
                          </View>
                          {selectedScreenshot.metadata.device.viewportWidth && (
                            <View className="flex-row justify-between">
                              <Text
                                className={`text-xs ${
                                  isDark ? "text-gray-400" : "text-gray-600"
                                }`}
                              >
                                Viewport:
                              </Text>
                              <Text
                                className={`text-sm font-medium ${
                                  isDark ? "text-gray-200" : "text-gray-900"
                                }`}
                              >
                                {selectedScreenshot.metadata.device.viewportWidth}x
                                {selectedScreenshot.metadata.device.viewportHeight}
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })()}
            </View>
          </ScrollView>
        )}
      </Drawer>
    </SafeAreaView>
  );
}
