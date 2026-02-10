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
  Clipboard,
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
  PlusSignCircleIcon,
  Edit01Icon,
  Delete01Icon,
  Download01Icon,
  UserRoadsideIcon,
  Copy01Icon,
  EyeIcon,
  ViewOffSlashIcon,
  WalletDone01Icon,
  WalletNotFound02Icon,
  CircleLock01Icon,
  CircleUnlock01Icon,
  AlertDiamondIcon,
} from "@hugeicons/core-free-icons";
import { UsersSkeleton } from "@/components/skeletons/UsersSkeleton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TAB_BAR_PADDING_BOTTOM, REFRESH_CONTROL_COLOR } from "@/constants/layout";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { BlurredAmount } from "@/components/BlurredAmount";
import { formatDecimalInput } from "@/utils/numeric-input";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_COLOR = "#0ea5e9";

// Helper pour obtenir le répertoire de documents
let FileSystemLegacy: any = null;
try {
  FileSystemLegacy = require("expo-file-system/legacy");
} catch (e) {
  // L'API legacy n'est pas disponible
}

const getDocumentDirectory = (): string | null => {
  try {
    if (FileSystemLegacy) {
      const docDir = FileSystemLegacy.documentDirectory;
      if (docDir && typeof docDir === "string") return docDir;
      const cacheDir = FileSystemLegacy.cacheDirectory;
      if (cacheDir && typeof cacheDir === "string") return cacheDir;
    }
    const paths = (FileSystem as any).Paths;
    if (paths) {
      const docDir = paths.documentDirectory || paths.documentDir || paths.docDir;
      const cacheDir = paths.cacheDirectory || paths.cacheDir;
      if (docDir) return docDir;
      if (cacheDir) return cacheDir;
    }
    let FileSystemModule: any = FileSystem;
    let depth = 0;
    const maxDepth = 5;
    while (
      depth < maxDepth &&
      FileSystemModule &&
      !FileSystemModule.documentDirectory &&
      !FileSystemModule.cacheDirectory
    ) {
      if (FileSystemModule.default) {
        FileSystemModule = FileSystemModule.default;
        depth++;
      } else {
        break;
      }
    }
    const docDir = FileSystemModule?.documentDirectory;
    const cacheDir = FileSystemModule?.cacheDirectory;
    if (docDir) return docDir;
    if (cacheDir) return cacheDir;
  } catch (e) {
    // Erreur silencieuse
  }
  return null;
};

interface User {
  id: string;
  email: string;
  name: string;
  active: boolean;
  twoFactorEnabled: boolean;
  role: {
    id: string;
    name: string;
  };
  companyManager?: {
    id: string;
    companyId: string;
    company: {
      id: string;
      name: string;
      currency: string;
    };
    allocatedAmount: number;
    availableBalance: number;
    isFrozen: boolean;
    frozenAt: string | null;
  } | null;
  createdAt: string;
  firstLoginAt?: string | null;
  lastLogin?: string | null;
}

interface Role {
  id: string;
  name: string;
}

interface Company {
  id: string;
  name: string;
  currency: string;
}

// Fonction helper pour obtenir les initiales d'un nom
const getInitials = (name?: string, email?: string) => {
  if (name) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  }
  if (email) {
    return email.substring(0, 2).toUpperCase();
  }
  return "U";
};

// Fonction helper pour obtenir les styles de badge selon le rôle
const getRoleBadgeStyle = (roleName: string, isDark: boolean) => {
  const roleLower = roleName?.toLowerCase() || "";
  
  if (roleLower.includes("admin") || roleLower === "admin") {
    return {
      backgroundColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#fee2e2",
      borderColor: isDark ? "#dc2626" : "#fca5a5",
      textColor: isDark ? "#fca5a5" : "#dc2626",
    };
  } else if (roleLower.includes("manager") || roleLower.includes("gestionnaire")) {
    return {
      backgroundColor: isDark ? "rgba(59, 130, 246, 0.2)" : "#dbeafe",
      borderColor: isDark ? "#3b82f6" : "#93c5fd",
      textColor: isDark ? "#93c5fd" : "#2563eb",
    };
  } else if (roleLower.includes("comptable") || roleLower.includes("accountant")) {
    return {
      backgroundColor: isDark ? "rgba(34, 197, 94, 0.2)" : "#dcfce7",
      borderColor: isDark ? "#22c55e" : "#86efac",
      textColor: isDark ? "#86efac" : "#16a34a",
    };
  } else if (roleLower.includes("audit") || roleLower.includes("auditeur")) {
    return {
      backgroundColor: isDark ? "rgba(168, 85, 247, 0.2)" : "#f3e8ff",
      borderColor: isDark ? "#a855f7" : "#c084fc",
      textColor: isDark ? "#c084fc" : "#9333ea",
    };
  } else {
    // Par défaut (bleu)
    return {
      backgroundColor: isDark ? "rgba(59, 130, 246, 0.2)" : "#dbeafe",
      borderColor: isDark ? "#3b82f6" : "#93c5fd",
      textColor: isDark ? "#93c5fd" : "#2563eb",
    };
  }
};

// Composant pour une ligne de la table
const UserTableRow = ({
  user,
  columnWidths,
  totalTableWidth,
  isDark,
  canUpdate,
  onEdit,
  onToggleActive,
  onFreeze,
  onUnfreeze,
  onScroll,
  scrollRef,
}: {
  user: User;
  columnWidths: any;
  totalTableWidth: number;
  isDark: boolean;
  canUpdate: boolean;
  onEdit: (user: User) => void;
  onToggleActive: (user: User) => void;
  onFreeze: (user: User) => void;
  onUnfreeze: (user: User) => void;
  onScroll: (e: any) => void;
  scrollRef: (ref: ScrollView | null) => void;
}) => {
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (scrollViewRef.current) {
      scrollRef(scrollViewRef.current);
    }
    return () => {
      scrollRef(null);
    };
  }, []);

  const roleBadgeStyle = getRoleBadgeStyle(user.role?.name || "", isDark);

  return (
    <View
      className={`border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}
      style={{
        position: "relative",
        backgroundColor: isDark ? "#0f172a" : "#ffffff",
      }}
    >
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={true}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingRight: columnWidths.actions }}
      >
        <View style={{ width: totalTableWidth, flexDirection: "row" }}>
          {/* Nom */}
          <View
            style={{
              width: columnWidths.name,
              paddingVertical: 12,
              paddingHorizontal: 6,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
            }}
          >
            <LinearGradient
              colors={["#0ea5e9", "#0284c7", "#0369a1"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                justifyContent: "center",
                alignItems: "center",
                borderWidth: 1,
                borderColor: "rgba(255, 255, 255, 0.2)",
              }}
            >
              <Text
                style={{
                  fontSize: 10,
                  fontWeight: "700",
                  color: "#ffffff",
                }}
              >
                {getInitials(user.name, user.email)}
              </Text>
            </LinearGradient>
            <Text
              className={`text-xs flex-1 ${isDark ? "text-gray-200" : "text-gray-900"}`}
              numberOfLines={2}
            >
              {user.name}
            </Text>
          </View>

          {/* Email */}
          <View
            style={{
              width: columnWidths.email,
              paddingVertical: 12,
              paddingHorizontal: 6,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <Text
              className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}
              numberOfLines={1}
            >
              {user.email}
            </Text>
          </View>

          {/* Rôle */}
          <View
            style={{
              width: columnWidths.role,
              paddingVertical: 12,
              paddingHorizontal: 6,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            {user.role?.name ? (
              <View
                className="px-1.5 py-0.5 rounded-full self-start"
                style={{
                  backgroundColor: roleBadgeStyle.backgroundColor,
                  borderWidth: 1,
                  borderColor: roleBadgeStyle.borderColor,
                }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: roleBadgeStyle.textColor }}
                >
                  {user.role.name}
                </Text>
              </View>
            ) : (
              <Text
                className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}
              >
                -
              </Text>
            )}
          </View>

          {/* Statut */}
          <View
            style={{
              width: columnWidths.status,
              paddingVertical: 12,
              paddingHorizontal: 6,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <View
              className={`px-1.5 py-0.5 rounded-full self-start ${
                user.active
                  ? isDark
                    ? "bg-green-900/30 border border-green-700"
                    : "bg-green-100 border border-green-300"
                  : isDark
                    ? "bg-gray-700 border border-gray-600"
                    : "bg-gray-200 border border-gray-300"
              }`}
            >
              <Text
                className={`text-xs ${
                  user.active
                    ? isDark
                      ? "text-green-300"
                      : "text-green-800"
                    : isDark
                      ? "text-gray-400"
                      : "text-gray-600"
                }`}
              >
                {user.active ? "Actif" : "Inactif"}
              </Text>
            </View>
          </View>

          {/* Entreprise assignée */}
          <View
            style={{
              width: columnWidths.company,
              paddingVertical: 12,
              paddingHorizontal: 6,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            {user.companyManager ? (
              <View className="gap-1">
                <View
                  className="px-1.5 py-0.5 rounded-full self-start"
                  style={{
                    backgroundColor: isDark ? "rgba(59, 130, 246, 0.2)" : "#dbeafe",
                    borderWidth: 1,
                    borderColor: isDark ? "#3b82f6" : "#93c5fd",
                  }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{ color: isDark ? "#93c5fd" : "#2563eb" }}
                    numberOfLines={1}
                  >
                    {user.companyManager.company.name}
                  </Text>
                </View>
                {user.companyManager.isFrozen && (
                  <View
                    className="px-1.5 py-0.5 rounded-full self-start"
                    style={{
                      backgroundColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#fee2e2",
                      borderWidth: 1,
                      borderColor: isDark ? "#dc2626" : "#fca5a5",
                    }}
                  >
                    <Text
                      className="text-xs font-medium"
                      style={{ color: isDark ? "#fca5a5" : "#dc2626" }}
                    >
                      Gelé
                    </Text>
                  </View>
                )}
              </View>
            ) : user.role?.name?.toLowerCase() === "admin" ? (
              <View
                className="px-1.5 py-0.5 rounded-full self-start"
                style={{
                  backgroundColor: isDark ? "rgba(59, 130, 246, 0.2)" : "#dbeafe",
                  borderWidth: 1,
                  borderColor: isDark ? "#3b82f6" : "#93c5fd",
                }}
              >
                <Text
                  className="text-xs font-medium"
                  style={{ color: isDark ? "#93c5fd" : "#2563eb" }}
                >
                  Toutes
                </Text>
              </View>
            ) : (
              <Text
                className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}
              >
                -
              </Text>
            )}
          </View>

          {/* Solde disponible */}
          <View
            style={{
              width: columnWidths.balance,
              paddingVertical: 12,
              paddingHorizontal: 6,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
              justifyContent: "center",
            }}
          >
            {user.companyManager ? (
              <View style={{ gap: 4 }}>
                <BlurredAmount
                  amount={user.companyManager.availableBalance}
                  currency={user.companyManager.company.currency}
                  className={`text-sm font-medium ${isDark ? "text-gray-200" : "text-gray-900"}`}
                />
                <View style={{ flexDirection: "row", alignItems: "center", flexWrap: "wrap" }}>
                  <Text
                    className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}
                  >
                    Alloué:{" "}
                  </Text>
                  <BlurredAmount
                    amount={user.companyManager.allocatedAmount}
                    currency={user.companyManager.company.currency}
                    className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}
                  />
                </View>
              </View>
            ) : (
              <Text
                className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}
              >
                -
              </Text>
            )}
          </View>

          {/* Première connexion */}
          <View
            style={{
              width: columnWidths.firstLogin,
              paddingVertical: 12,
              paddingHorizontal: 4,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
              justifyContent: "center",
            }}
          >
            <Text
              className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}
              numberOfLines={2}
            >
              {user.firstLoginAt
                ? new Date(user.firstLoginAt).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Jamais"}
            </Text>
          </View>

          {/* Dernière connexion */}
          <View
            style={{
              width: columnWidths.lastLogin,
              paddingVertical: 12,
              paddingHorizontal: 4,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
              justifyContent: "center",
            }}
          >
            <Text
              className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}
              numberOfLines={2}
            >
              {user.lastLogin
                ? new Date(user.lastLogin).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "Jamais"}
            </Text>
          </View>
        </View>
      </ScrollView>
      {/* Actions (sticky à droite) */}
      <View
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: columnWidths.actions,
          backgroundColor: isDark ? "#0f172a" : "#ffffff",
          borderLeftWidth: 1,
          borderLeftColor: isDark ? "#334155" : "#e5e7eb",
          paddingVertical: 12,
          paddingHorizontal: 8,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
        }}
      >
        {canUpdate && user.companyManager && (
          <>
            {user.companyManager.isFrozen ? (
              <TouchableOpacity
                onPress={() => onUnfreeze(user)}
                className="p-1.5 rounded-full"
                style={{ backgroundColor: isDark ? "rgba(34, 197, 94, 0.2)" : "#dcfce7" }}
                activeOpacity={0.7}
              >
                <HugeiconsIcon
                  icon={WalletDone01Icon}
                  size={14}
                  color={isDark ? "#86efac" : "#16a34a"}
                />
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                onPress={() => onFreeze(user)}
                className="p-1.5 rounded-full"
                style={{ backgroundColor: isDark ? "rgba(249, 115, 22, 0.2)" : "#fed7aa" }}
                activeOpacity={0.7}
              >
                <HugeiconsIcon
                  icon={WalletNotFound02Icon}
                  size={14}
                  color={isDark ? "#fb923c" : "#ea580c"}
                />
              </TouchableOpacity>
            )}
          </>
        )}
        {canUpdate && (
          <TouchableOpacity
            onPress={() => onToggleActive(user)}
            className="p-1.5 rounded-full"
            style={{ backgroundColor: isDark ? "#1e293b" : "#f3f4f6" }}
            activeOpacity={0.7}
          >
            <HugeiconsIcon
              icon={user.active ? CircleLock01Icon : CircleUnlock01Icon}
              size={14}
              color={user.active ? (isDark ? "#fb923c" : "#ea580c") : (isDark ? "#86efac" : "#16a34a")}
            />
          </TouchableOpacity>
        )}
        {canUpdate && (
          <TouchableOpacity
            onPress={() => onEdit(user)}
            className="p-1.5 rounded-full"
            style={{ backgroundColor: isDark ? "#1e293b" : "#f3f4f6" }}
            activeOpacity={0.7}
          >
            <HugeiconsIcon
              icon={Edit01Icon}
              size={14}
              color={isDark ? "#9ca3af" : "#6b7280"}
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export function UsersScreen() {
  const { isDark } = useTheme();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showUserForm, setShowUserForm] = useState(false);
  const [showDeleteDrawer, setShowDeleteDrawer] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [mobilizedBalance, setMobilizedBalance] = useState<{
    amount: number;
    currency: string;
  } | null>(null);
  const [loadingMobilizedBalance, setLoadingMobilizedBalance] = useState(false);
  const [showFreezeDrawer, setShowFreezeDrawer] = useState(false);
  const [userToFreeze, setUserToFreeze] = useState<User | null>(null);
  const [returnAmount, setReturnAmount] = useState(false);
  const [isFreezing, setIsFreezing] = useState(false);

  // États du formulaire
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    roleId: "",
    assignCompany: false,
    activitySectorId: "",
    companyManager: {
      companyId: "",
      allocatedAmount: "",
    },
  });

  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);

  // Refs pour synchroniser le scroll
  const headerScrollRef = useRef<ScrollView>(null);
  const contentScrollRefs = useRef<Map<string, ScrollView>>(new Map());
  const scrollXRef = useRef(0);
  const isScrollingRef = useRef(false);

  const canView = hasPermission("users.view");
  const canCreate = hasPermission("users.create");
  const canUpdate = hasPermission("users.update");
  const canDelete = hasPermission("users.delete");

  React.useEffect(() => {
    // Initialisation
  }, []);

  // Récupérer les rôles
  const { data: roles } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      try {
        const response = await api.get("/api/roles");
        return response.data;
      } catch (err) {
        return [];
      }
    },
  });

  // Récupérer les secteurs d'activité
  const { data: activitySectors } = useQuery({
    queryKey: ["activity-sectors"],
    queryFn: async () => {
      try {
        const response = await api.get("/api/activity-sectors?isActive=true");
        return response.data;
      } catch (err) {
        return [];
      }
    },
  });

  // Récupérer les entreprises
  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      try {
        const response = await api.get("/api/companies");
        return response.data;
      } catch (err) {
        return [];
      }
    },
  });

  // Récupérer les utilisateurs
  const {
    data: users,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      try {
        const response = await api.get("/api/users");
        return response.data;
      } catch (err: any) {
        throw err;
      }
    },
    enabled: canView,
  });

  // Largeurs des colonnes - optimisées pour afficher toutes les colonnes visibles
  const columnWidths = {
    name: 150, // Réduit mais suffisant pour avatar + nom
    email: 150, // Réduit
    role: 100, // Réduit
    status: 70, // Réduit
    company: 130, // Réduit
    balance: 120, // Réduit
    firstLogin: 130, // Augmenté pour accommoder date + heure
    lastLogin: 130, // Augmenté pour accommoder date + heure
    actions: 110, // Réduit
  };

  const totalTableWidth = Object.values(columnWidths).reduce(
    (sum, width) => sum + width,
    0
  ) - columnWidths.actions;

  // Synchroniser le scroll entre header et contenu
  const handleContentScroll = useCallback((event: any, userId?: string) => {
    if (isScrollingRef.current) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    scrollXRef.current = offsetX;
    isScrollingRef.current = true;
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollTo({ x: offsetX, animated: false });
    }
    contentScrollRefs.current.forEach((ref, id) => {
      if (id !== userId && ref) {
        ref.scrollTo({ x: offsetX, animated: false });
      }
    });
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 100);
  }, []);

  const handleHeaderScroll = useCallback((event: any) => {
    if (isScrollingRef.current) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    scrollXRef.current = offsetX;
    isScrollingRef.current = true;
    contentScrollRefs.current.forEach((ref) => {
      if (ref) {
        ref.scrollTo({ x: offsetX, animated: false });
      }
    });
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 100);
  }, []);

  // Filtrer les utilisateurs
  const filteredUsers = useMemo(() => {
    if (!users) return [];
    return users.filter((user: User) => {
      const matchesSearch =
        !searchTerm ||
        user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.role?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesRole = !roleFilter || user.role?.id === roleFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && user.active) ||
        (statusFilter === "INACTIVE" && !user.active);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, roleFilter, statusFilter]);

  // Vérifier si tous les champs obligatoires sont remplis
  const isFormValid = useMemo(() => {
    const baseValid =
      formData.name.trim() !== "" &&
      formData.email.trim() !== "" &&
      formData.roleId !== "" &&
      (editingUser || formData.password.trim() !== "");

    // Si le mot de passe est fourni, il doit avoir au moins 8 caractères
    if (formData.password && formData.password.length > 0 && formData.password.length < 8) {
      return false;
    }

    // Si assignCompany est coché, vérifier les champs de l'assignation
    if (formData.assignCompany) {
      return (
        baseValid &&
        formData.activitySectorId !== "" &&
        formData.companyManager.companyId !== "" &&
        formData.companyManager.allocatedAmount !== ""
      );
    }

    return baseValid;
  }, [formData, editingUser]);

  // Gestion du refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (err) {
      // Erreur silencieuse
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  // Gérer le changement de secteur d'activité
  const handleSectorChange = useCallback((sectorId: string) => {
    setFormData((prev) => ({
      ...prev,
      activitySectorId: sectorId,
      companyManager: {
        ...prev.companyManager,
        companyId: "",
        allocatedAmount: "",
      },
    }));
    setSelectedCompany(null);
    setMobilizedBalance(null);
    if (sectorId) {
      const filtered = (companies || []).filter(
        (company: Company) => company.activitySectorId === sectorId
      );
      setFilteredCompanies(filtered);
    } else {
      setFilteredCompanies([]);
    }
  }, [companies]);

  // Gérer le changement d'entreprise
  const handleCompanyChange = useCallback(async (companyId: string) => {
    setFormData((prev) => ({
      ...prev,
      companyManager: {
        ...prev.companyManager,
        companyId: companyId,
        allocatedAmount: "",
      },
    }));
    const company = companies?.find((c: Company) => c.id === companyId);
    if (company) {
      setSelectedCompany(company);
      // Récupérer le solde mobilisé calculé dynamiquement
      setLoadingMobilizedBalance(true);
      try {
        const response = await api.get(
          `/api/dashboard/company-stats?companyId=${companyId}`
        );
        if (response.data && response.data.kpis?.mobilizedBalance !== undefined) {
          setMobilizedBalance({
            amount: response.data.kpis.mobilizedBalance,
            currency: company.currency || "GNF",
          });
        } else {
          setMobilizedBalance({
            amount: 0,
            currency: company.currency || "GNF",
          });
        }
      } catch (err) {
        setMobilizedBalance({
          amount: 0,
          currency: company.currency || "GNF",
        });
      } finally {
        setLoadingMobilizedBalance(false);
      }
    } else {
      setSelectedCompany(null);
      setMobilizedBalance(null);
    }
  }, [companies]);

  // Générer un mot de passe fort
  const generateStrongPassword = useCallback((): string => {
    const length = 16;
    const uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const lowercase = "abcdefghijklmnopqrstuvwxyz";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
    const allChars = uppercase + lowercase + numbers + symbols;

    // S'assurer qu'au moins un caractère de chaque type est inclus
    let password = "";
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += symbols[Math.floor(Math.random() * symbols.length)];

    // Remplir le reste avec des caractères aléatoires
    for (let i = password.length; i < length; i++) {
      password += allChars[Math.floor(Math.random() * allChars.length)];
    }

    // Mélanger le mot de passe
    return password
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
  }, []);

  // Gestion de la création
  const handleCreate = useCallback(() => {
    if (!canCreate) {
      return;
    }
    setFormData({
      name: "",
      email: "",
      password: "",
      roleId: "",
      assignCompany: false,
      activitySectorId: "",
      companyManager: {
        companyId: "",
        allocatedAmount: "",
      },
    });
    setEditingUser(null);
    setShowPassword(false);
    setSelectedCompany(null);
    setFilteredCompanies([]);
    setMobilizedBalance(null);
    setShowUserForm(true);
  }, [canCreate]);

  // Gestion de l'édition
  const handleEdit = useCallback(
    async (user: User) => {
      if (!canUpdate) {
        return;
      }

      // Récupérer les informations de l'entreprise assignée si elle existe
      let companyManager = null;
      try {
        const response = await api.get(`/api/users/${user.id}/company-manager`);
        if (response.data) {
          companyManager = response.data;
        }
      } catch (err) {
        // Ignore error
      }

      setFormData({
        name: user.name,
        email: user.email,
        password: "",
        roleId: user.role?.id || "",
        assignCompany: !!companyManager,
        activitySectorId: companyManager?.company?.activitySectorId || "",
        companyManager: {
          companyId: companyManager?.companyId || "",
          allocatedAmount: companyManager?.allocatedAmount
            ? companyManager.allocatedAmount.toString()
            : "",
        },
      });

      if (companyManager?.company) {
        // Récupérer le solde mobilisé calculé dynamiquement
        setLoadingMobilizedBalance(true);
        try {
          const statsResponse = await api.get(
            `/api/dashboard/company-stats?companyId=${companyManager.companyId}`
          );
          if (statsResponse.data && statsResponse.data.kpis?.mobilizedBalance !== undefined) {
            setSelectedCompany({
              ...companyManager.company,
              mobilizedBalance: statsResponse.data.kpis.mobilizedBalance || 0,
            } as any);
            setMobilizedBalance({
              amount: statsResponse.data.kpis.mobilizedBalance || 0,
              currency: companyManager.company.currency || "GNF",
            });
          } else {
            setSelectedCompany(companyManager.company as any);
            setMobilizedBalance({
              amount: 0,
              currency: companyManager.company.currency || "GNF",
            });
          }
        } catch (err) {
          setSelectedCompany(companyManager.company as any);
          setMobilizedBalance({
            amount: 0,
            currency: companyManager.company.currency || "GNF",
          });
        } finally {
          setLoadingMobilizedBalance(false);
        }

        const filtered = (companies || []).filter(
          (c: Company) => c.activitySectorId === companyManager.company.activitySectorId
        );
        setFilteredCompanies(filtered);
      } else {
        setSelectedCompany(null);
        setFilteredCompanies([]);
        setMobilizedBalance(null);
      }

      setEditingUser(user);
      setShowPassword(false);
      setShowUserForm(true);
    },
    [canUpdate, companies]
  );

  // Gestion de la suppression
  const handleDelete = useCallback(
    (user: User) => {
      if (!canDelete) {
        return;
      }
      setUserToDelete(user);
      setDeleteConfirmation("");
      setShowDeleteDrawer(true);
    },
    [canDelete]
  );

  // Soumettre le formulaire
  const handleSubmit = useCallback(async () => {
    if (!formData.name.trim()) {
      Alert.alert("Erreur", "Le nom est requis");
      return;
    }
    if (!formData.email.trim()) {
      Alert.alert("Erreur", "L'email est requis");
      return;
    }
    if (!formData.roleId) {
      Alert.alert("Erreur", "Le rôle est requis");
      return;
    }
    if (!editingUser && !formData.password.trim()) {
      Alert.alert("Erreur", "Le mot de passe est requis");
      return;
    }
    if (formData.password && formData.password.length < 8) {
      Alert.alert("Erreur", "Le mot de passe doit contenir au moins 8 caractères");
      return;
    }

    setIsSubmitting(true);
    try {
      // Préparer les données à envoyer
      const payload: any = {
        name: formData.name.trim(),
        email: formData.email.trim().toLowerCase(),
        roleId: formData.roleId,
      };

      // Ajouter le mot de passe seulement s'il est fourni
      if (formData.password.trim()) {
        payload.password = formData.password;
      }

      // Gérer l'assignation d'entreprise
      // Si on est en mode édition et que l'utilisateur a déjà une assignation, la préserver
      if (editingUser && editingUser.companyManager) {
        // Si la checkbox est cochée, utiliser les nouvelles valeurs ou conserver les anciennes
        if (formData.assignCompany) {
          const companyId = formData.companyManager.companyId || editingUser.companyManager.companyId;
          const allocatedAmount = parseFloat(formData.companyManager.allocatedAmount || "0") || editingUser.companyManager.allocatedAmount;
          
          if (!companyId) {
            Alert.alert("Erreur", "Veuillez sélectionner une entreprise");
            setIsSubmitting(false);
            return;
          }
          
          if (isNaN(allocatedAmount) || allocatedAmount <= 0) {
            Alert.alert("Erreur", "Le montant alloué doit être supérieur à 0");
            setIsSubmitting(false);
            return;
          }
          
          payload.companyManager = {
            companyId: companyId,
            allocatedAmount: allocatedAmount,
          };
        } else {
          // Si la checkbox est décochée, envoyer null pour supprimer l'assignation
          payload.companyManager = null;
        }
      } else if (formData.assignCompany) {
        // Nouvelle assignation
        const allocatedAmount = parseFloat(formData.companyManager.allocatedAmount || "0");
        const companyId = formData.companyManager.companyId || "";
        
        if (!companyId) {
          Alert.alert("Erreur", "Veuillez sélectionner une entreprise");
          setIsSubmitting(false);
          return;
        }
        
        if (isNaN(allocatedAmount) || allocatedAmount <= 0) {
          Alert.alert("Erreur", "Le montant alloué doit être supérieur à 0");
          setIsSubmitting(false);
          return;
        }
        
        payload.companyManager = {
          companyId: companyId,
          allocatedAmount: allocatedAmount,
        };
      }

      if (editingUser) {
        await api.put(`/api/users/${editingUser.id}`, payload);
      } else {
        const res = await api.post("/api/users", payload);
        const id = res.data?.id;
      }
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowUserForm(false);
      setEditingUser(null);
      Alert.alert("Succès", editingUser ? "Utilisateur mis à jour" : "Utilisateur créé");
    } catch (err: any) {
      Alert.alert(
        "Erreur",
        err.response?.data?.error || "Une erreur est survenue"
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, editingUser, queryClient]);

  // Toggle statut actif/inactif
  const handleToggleActive = useCallback(async (user: User) => {
    try {
      await api.put(`/api/users/${user.id}`, {
        email: user.email,
        name: user.name,
        roleId: user.role.id,
        active: !user.active,
      });
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      Alert.alert(
        "Succès",
        user.active ? "Compte désactivé avec succès" : "Compte activé avec succès"
      );
    } catch (err: any) {
      Alert.alert(
        "Erreur",
        err.response?.data?.error || "Erreur lors de la mise à jour"
      );
    }
  }, [queryClient]);

  // Ouvrir le drawer pour geler le compte
  const handleFreeze = useCallback((user: User) => {
    setUserToFreeze(user);
    setReturnAmount(false);
    setShowFreezeDrawer(true);
  }, []);

  // Dégeler le compte — compatible avec les deux routes backend possibles
  const handleUnfreeze = useCallback(async (user: User) => {
    if (!user.companyManager) return;
    const cmId = user.companyManager.id;
    const onSuccess = async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      Alert.alert("Succès", "Compte dégelé avec succès");
    };
    const getErrMsg = (e: any) =>
      e.response?.data?.error ?? e.response?.data?.message ?? "Erreur lors du dégel du compte";

    try {
      await api.delete(`/api/company-managers/${cmId}/freeze`);
      await onSuccess();
    } catch (e1: any) {
      if (e1.response?.status === 404 || e1.response?.status === 401) {
        try {
          await api.delete(`/api/users/${user.id}/company-manager/freeze`);
          await onSuccess();
        } catch (e2: any) {
          Alert.alert("Erreur", String(getErrMsg(e2)));
        }
      } else {
        Alert.alert("Erreur", String(getErrMsg(e1)));
      }
    }
  }, [queryClient]);

  // Gel du compte — compatible avec les deux routes backend possibles, body minimal
  const handleConfirmFreeze = useCallback(async () => {
    if (!userToFreeze?.companyManager) return;
    const cmId = userToFreeze.companyManager.id;
    const body = { returnAmount: !!returnAmount };
    const onSuccess = async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowFreezeDrawer(false);
      setUserToFreeze(null);
      setReturnAmount(false);
      Alert.alert("Succès", "Compte gelé avec succès");
    };
    const getErrMsg = (e: any) =>
      e.response?.data?.error ?? e.response?.data?.message ?? "Erreur lors du gel du compte";

    setIsFreezing(true);
    try {
      await api.post(`/api/company-managers/${cmId}/freeze`, body);
      await onSuccess();
    } catch (e1: any) {
      if (e1.response?.status === 404 || e1.response?.status === 401) {
        try {
          await api.post(`/api/users/${userToFreeze.id}/company-manager/freeze`, body);
          await onSuccess();
        } catch (e2: any) {
          Alert.alert("Erreur", String(getErrMsg(e2)));
        }
      } else {
        Alert.alert("Erreur", String(getErrMsg(e1)));
      }
    } finally {
      setIsFreezing(false);
    }
  }, [userToFreeze, returnAmount, queryClient]);

  // Confirmer la suppression
  const handleConfirmDelete = useCallback(async () => {
    if (!userToDelete) return;
    if (deleteConfirmation !== userToDelete.name) {
      Alert.alert("Erreur", "Le nom de confirmation ne correspond pas");
      return;
    }

    setIsDeleting(true);
    try {
      const id = userToDelete.id;
      const name = userToDelete.name;
      await api.delete(`/api/users/${id}`);
      await queryClient.invalidateQueries({ queryKey: ["users"] });
      setShowDeleteDrawer(false);
      setUserToDelete(null);
      setDeleteConfirmation("");
      Alert.alert("Succès", "Utilisateur supprimé");
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.error ||
        err.response?.data?.details ||
        "Impossible de supprimer l'utilisateur";
      Alert.alert("Erreur", errorMessage);
    } finally {
      setIsDeleting(false);
    }
  }, [userToDelete, deleteConfirmation, queryClient]);

  // Export Excel/CSV
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const dataToExport = filteredUsers.map((user: User) => ({
        Nom: user.name,
        Email: user.email,
        Rôle: user.role?.name || "",
        Entreprise: user.companyManager?.company.name || "",
        "Montant alloué": user.companyManager
          ? `${user.companyManager.allocatedAmount} ${user.companyManager.company.currency}`
          : "",
        Statut: user.active ? "Actif" : "Inactif",
        "2FA": user.twoFactorEnabled ? "Oui" : "Non",
      }));

      const csvContent = [
        ["Nom", "Email", "Rôle", "Entreprise", "Montant alloué", "Statut", "2FA"],
        ...dataToExport.map((row) => [
          row.Nom,
          row.Email,
          row.Rôle,
          row.Entreprise,
          row["Montant alloué"],
          row.Statut,
          row["2FA"],
        ]),
      ]
        .map((row) => row.map((cell) => `"${cell}"`).join(","))
        .join("\n");

      const filename = `utilisateurs_${new Date().toISOString().split("T")[0]}.csv`;
      const directory = getDocumentDirectory();
      const writeFn = FileSystemLegacy?.writeAsStringAsync || FileSystem.writeAsStringAsync;
      if (!writeFn) {
        throw new Error("writeAsStringAsync not found");
      }
      const fileUri = directory ? `${directory}${filename}` : filename;
      await writeFn(fileUri, csvContent, { encoding: "utf8" });
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "Partager le fichier CSV",
        });
      } else {
        Alert.alert("Export réussi", `Le fichier CSV a été sauvegardé : ${filename}`);
      }
    } catch (error: any) {
      Alert.alert("Erreur", "Impossible d'exporter le fichier");
    } finally {
      setIsExporting(false);
    }
  }, [filteredUsers]);

  // Si l'utilisateur n'a pas la permission de voir
  if (!canView) {
    return (
      <SafeAreaView
        className={`flex-1 ${isDark ? "bg-[#0f172a]" : "bg-white"}`}
        edges={["top", "bottom"]}
      >
        <ScreenHeader />
        <View className="flex-1 items-center justify-center px-6">
          <Text className={`text-center ${isDark ? "text-gray-400" : "text-gray-600"}`}>
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
        {!(isLoading || !users) && (
          <View className="px-4 pt-20 pb-4">
            {/* Barre de recherche, filtre et boutons */}
            <View className="flex-row items-center gap-2 mb-4">
              {/* Barre de recherche */}
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
                  value={searchTerm}
                  onChangeText={setSearchTerm}
                  placeholder="Rechercher..."
                  placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                  className={`flex-1 text-sm ${
                    isDark ? "text-gray-100" : "text-gray-900"
                  }`}
                  style={{
                    textAlignVertical: "center",
                    includeFontPadding: false,
                    paddingVertical: 0,
                  }}
                />
              </View>

              {/* Bouton filtre */}
              <TouchableOpacity
                onPress={() => setShowFiltersModal(true)}
                className={`px-3 py-2.5 rounded-full flex-row items-center gap-1.5 ${
                  roleFilter || statusFilter !== "ALL"
                    ? "bg-blue-600"
                    : isDark
                      ? "bg-[#1e293b]"
                      : "bg-gray-100"
                }`}
                activeOpacity={0.7}
              >
                <HugeiconsIcon
                  icon={FilterIcon}
                  size={18}
                  color={
                    roleFilter || statusFilter !== "ALL"
                      ? "#ffffff"
                      : isDark
                        ? "#9ca3af"
                        : "#6b7280"
                  }
                />
                {(roleFilter ? 1 : 0) + (statusFilter !== "ALL" ? 1 : 0) > 0 && (
                  <View
                    className="px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: "rgba(255, 255, 255, 0.2)" }}
                  >
                    <Text className="text-white text-xs font-semibold">
                      {(roleFilter ? 1 : 0) + (statusFilter !== "ALL" ? 1 : 0)}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>

              {/* Bouton export */}
              <TouchableOpacity
                onPress={handleExport}
                disabled={isExporting}
                className="px-3 py-2.5 rounded-full flex-row items-center gap-1.5"
                style={{
                  backgroundColor: isDark ? "#1e293b" : "#f3f4f6",
                  opacity: isExporting ? 0.6 : 1,
                }}
                activeOpacity={0.7}
              >
                {isExporting ? (
                  <ActivityIndicator
                    size="small"
                    color={isDark ? "#9ca3af" : "#6b7280"}
                  />
                ) : (
                  <HugeiconsIcon
                    icon={Download01Icon}
                    size={18}
                    color={isDark ? "#9ca3af" : "#6b7280"}
                  />
                )}
              </TouchableOpacity>

              {/* Bouton créer */}
              {canCreate && (
                <TouchableOpacity
                  onPress={handleCreate}
                  className="px-4 py-2.5 rounded-full flex-row items-center gap-2"
                  style={{ backgroundColor: CHART_COLOR }}
                  activeOpacity={0.7}
                >
                  <HugeiconsIcon
                    icon={PlusSignCircleIcon}
                    size={18}
                    color="#ffffff"
                  />
                  <Text className="text-white text-sm font-semibold">
                    Nouveau
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* Table */}
        {isLoading || !users ? (
          <UsersSkeleton />
        ) : filteredUsers.length === 0 ? (
          <View className="flex-1 items-center justify-center py-12">
            <Text className={`${isDark ? "text-gray-400" : "text-gray-600"}`}>
              {searchTerm || roleFilter || statusFilter !== "ALL"
                ? "Aucun utilisateur trouvé avec les filtres actuels"
                : "Aucun utilisateur disponible"}
            </Text>
          </View>
        ) : (
          <>
            <ScrollView
              className="flex-1"
              horizontal={false}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={isDark ? "#38bdf8" : REFRESH_CONTROL_COLOR}
                  colors={isDark ? ["#38bdf8"] : [REFRESH_CONTROL_COLOR]}
                />
              }
            >
              {/* En-tête de la table */}
              <View
                className={`border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}
                style={{ position: "relative" }}
              >
                <ScrollView
                  ref={headerScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  onScroll={handleHeaderScroll}
                  scrollEventThrottle={16}
                  contentContainerStyle={{ paddingRight: columnWidths.actions }}
                >
                  <View style={{ width: totalTableWidth, flexDirection: "row" }}>
                    <View
                      style={{
                        width: columnWidths.name,
                        paddingVertical: 12,
                        paddingHorizontal: 8,
                        backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                        borderRightWidth: 1,
                        borderRightColor: isDark ? "#374151" : "#e5e7eb",
                      }}
                    >
                      <Text
                        className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
                      >
                        Nom
                      </Text>
                    </View>
                    <View
                      style={{
                        width: columnWidths.email,
                        paddingVertical: 12,
                        paddingHorizontal: 8,
                        backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                        borderRightWidth: 1,
                        borderRightColor: isDark ? "#374151" : "#e5e7eb",
                      }}
                    >
                      <Text
                        className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
                      >
                        Email
                      </Text>
                    </View>
                    <View
                      style={{
                        width: columnWidths.role,
                        paddingVertical: 12,
                        paddingHorizontal: 8,
                        backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                        borderRightWidth: 1,
                        borderRightColor: isDark ? "#374151" : "#e5e7eb",
                      }}
                    >
                      <Text
                        className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
                      >
                        Rôle
                      </Text>
                    </View>
                    <View
                      style={{
                        width: columnWidths.status,
                        paddingVertical: 12,
                        paddingHorizontal: 8,
                        backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                        borderRightWidth: 1,
                        borderRightColor: isDark ? "#374151" : "#e5e7eb",
                      }}
                    >
                      <Text
                        className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
                      >
                        Statut
                      </Text>
                    </View>
                    <View
                      style={{
                        width: columnWidths.company,
                        paddingVertical: 12,
                        paddingHorizontal: 8,
                        backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                        borderRightWidth: 1,
                        borderRightColor: isDark ? "#374151" : "#e5e7eb",
                      }}
                    >
                      <Text
                        className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
                      >
                        Entreprise assignée
                      </Text>
                    </View>
                    <View
                      style={{
                        width: columnWidths.balance,
                        paddingVertical: 12,
                        paddingHorizontal: 8,
                        backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                        borderRightWidth: 1,
                        borderRightColor: isDark ? "#374151" : "#e5e7eb",
                      }}
                    >
                      <Text
                        className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
                      >
                        Solde disponible
                      </Text>
                    </View>
                    <View
                      style={{
                        width: columnWidths.firstLogin,
                        paddingVertical: 12,
                        paddingHorizontal: 4,
                        backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                        borderRightWidth: 1,
                        borderRightColor: isDark ? "#374151" : "#e5e7eb",
                      }}
                    >
                      <Text
                        className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
                      >
                        Première connexion
                      </Text>
                    </View>
                    <View
                      style={{
                        width: columnWidths.lastLogin,
                        paddingVertical: 12,
                        paddingHorizontal: 4,
                        backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                        borderRightWidth: 1,
                        borderRightColor: isDark ? "#374151" : "#e5e7eb",
                      }}
                    >
                      <Text
                        className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
                      >
                        Dernière connexion
                      </Text>
                    </View>
                  </View>
                </ScrollView>
                {/* Actions (sticky à droite) */}
                <View
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: columnWidths.actions,
                    backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                    borderLeftWidth: 1,
                    borderLeftColor: isDark ? "#334155" : "#e5e7eb",
                  }}
                  className="px-3 py-3 justify-center items-center"
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

              {/* Lignes de données */}
              {filteredUsers.map((user: User) => (
                <UserTableRow
                  key={user.id}
                  user={user}
                  columnWidths={columnWidths}
                  totalTableWidth={totalTableWidth}
                  isDark={isDark}
                  canUpdate={canUpdate}
                  onEdit={handleEdit}
                  onToggleActive={handleToggleActive}
                  onFreeze={handleFreeze}
                  onUnfreeze={handleUnfreeze}
                  onScroll={(e) => handleContentScroll(e, user.id)}
                  scrollRef={(ref) => {
                    if (ref) {
                      contentScrollRefs.current.set(user.id, ref);
                    } else {
                      contentScrollRefs.current.delete(user.id);
                    }
                  }}
                />
              ))}
            </ScrollView>
          </>
        )}
      </View>

      {/* Drawer de filtres */}
      <Drawer
        open={showFiltersModal}
        onOpenChange={setShowFiltersModal}
        title="Filtres"
      >
        <View className="gap-4">
          <View>
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Rôle
            </Text>
            <Select
              value={roleFilter}
              onValueChange={setRoleFilter}
              placeholder="Tous les rôles"
              options={[
                { label: "Tous les rôles", value: "" },
                ...(roles?.map((role: Role) => ({
                  label: role.name,
                  value: role.id,
                })) || []),
              ]}
            />
          </View>

          <View>
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Statut
            </Text>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as "ALL" | "ACTIVE" | "INACTIVE")}
              options={[
                { label: "Tous", value: "ALL" },
                { label: "Actif", value: "ACTIVE" },
                { label: "Inactif", value: "INACTIVE" },
              ]}
            />
          </View>

          <View className="flex-row gap-3 mt-4">
            <Button
              variant="outline"
              onPress={() => {
                setRoleFilter("");
                setStatusFilter("ALL");
              }}
              className="flex-1"
            >
              Réinitialiser
            </Button>
            <Button
              onPress={() => setShowFiltersModal(false)}
              className="flex-1"
            >
              Appliquer
            </Button>
          </View>
        </View>
      </Drawer>

      {/* Drawer de formulaire (Créer/Éditer) */}
      <Drawer
        open={showUserForm}
        onOpenChange={setShowUserForm}
        title={editingUser ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
        footer={
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              onPress={() => {
                setShowUserForm(false);
                setEditingUser(null);
              }}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              onPress={handleSubmit}
              disabled={isSubmitting || !isFormValid}
              className="flex-1"
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : editingUser ? (
                "Mettre à jour"
              ) : (
                "Créer l'utilisateur"
              )}
            </Button>
          </View>
        }
      >
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-4">
            {/* 1. Nom complet */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Nom complet <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                value={formData.name}
                onChangeText={(text) => setFormData({ ...formData, name: text })}
                placeholder="Nom complet"
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

            {/* 2. Email */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Email <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                value={formData.email}
                onChangeText={(text) => setFormData({ ...formData, email: text })}
                placeholder="email@example.com"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                keyboardType="email-address"
                autoCapitalize="none"
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

            {/* 3. Rôle */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Rôle <Text className="text-red-500">*</Text>
              </Text>
              <Select
                value={formData.roleId}
                onValueChange={(value) => setFormData({ ...formData, roleId: value })}
                placeholder="Sélectionner un rôle"
                options={
                  roles?.map((role: Role) => ({
                    label: role.name,
                    value: role.id,
                  })) || []
                }
              />
            </View>

            {/* 4. Mot de passe */}
            <View>
              <View className="flex-row items-center justify-between mb-2">
                <Text className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  {editingUser
                    ? "Nouveau mot de passe (optionnel)"
                    : (
                      <>
                        Mot de passe <Text className="text-red-500">*</Text>
                      </>
                    )}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const newPassword = generateStrongPassword();
                    setFormData({ ...formData, password: newPassword });
                  }}
                  className="px-3 py-1.5 rounded-full"
                  style={{
                    backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                  }}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-xs font-medium ${
                      isDark ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Générer
                  </Text>
                </TouchableOpacity>
              </View>
              <View
                className={`flex-row items-center px-4 py-3 rounded-lg border ${
                  isDark
                    ? "bg-[#1e293b] border-gray-700"
                    : "bg-gray-100 border-gray-300"
                }`}
                style={{
                  minHeight: 48,
                }}
              >
                <TextInput
                  value={formData.password}
                  onChangeText={(text) => setFormData({ ...formData, password: text })}
                  placeholder={editingUser ? "Nouveau mot de passe (optionnel)" : "Mot de passe"}
                  placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  className={`flex-1 ${
                    isDark ? "text-gray-100" : "text-gray-900"
                  }`}
                  style={{
                    textAlignVertical: "center",
                    includeFontPadding: false,
                    paddingVertical: 0,
                  }}
                />
                <View className="flex-row items-center gap-1 ml-2">
                  {formData.password && (
                    <TouchableOpacity
                      onPress={() => {
                        Clipboard.setString(formData.password);
                        Alert.alert("Succès", "Mot de passe copié dans le presse-papier");
                      }}
                      className="p-1.5"
                      activeOpacity={0.7}
                    >
                      <HugeiconsIcon
                        icon={Copy01Icon}
                        size={16}
                        color={isDark ? "#9ca3af" : "#6b7280"}
                      />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    className="p-1.5"
                    activeOpacity={0.7}
                  >
                    <Text className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                      {showPassword ? "Masquer" : "Afficher"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            {/* 5. Section Assignation d'entreprise - seulement pour le rôle Manager */}
            {(() => {
              // Vérifier le rôle sélectionné ou le rôle de l'utilisateur en édition
              let roleNameToCheck: string | null = null;

              // Si on est en mode édition, utiliser le nom du rôle de l'utilisateur
              if (editingUser?.role?.name) {
                roleNameToCheck = editingUser.role.name;
              } else if (formData.roleId) {
                // Sinon, chercher le rôle dans la liste des rôles
                const selectedRole = roles?.find(
                  (r: Role) => r.id === formData.roleId
                );
                roleNameToCheck = selectedRole?.name || null;
              }

              // Si aucun nom de rôle n'est disponible, ne pas afficher la section
              if (!roleNameToCheck) return null;

              // Vérifier si c'est le rôle Manager (insensible à la casse)
              const roleNameLower = roleNameToCheck.toLowerCase();
              const isManagerRole =
                roleNameLower === "manager" ||
                roleNameLower === "gestionnaire" ||
                roleNameLower.includes("manager") ||
                roleNameLower.includes("gestionnaire");

              if (!isManagerRole) return null;

              return (
                <View className="gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <View className="flex-row items-center gap-3">
                    <TouchableOpacity
                      onPress={() =>
                        setFormData({ ...formData, assignCompany: !formData.assignCompany })
                      }
                      className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                        formData.assignCompany
                          ? "bg-blue-600 border-blue-600"
                          : isDark
                            ? "border-gray-600"
                            : "border-gray-300"
                      }`}
                      activeOpacity={0.7}
                    >
                      {formData.assignCompany && (
                        <Text className="text-white text-xs">✓</Text>
                      )}
                    </TouchableOpacity>
                    <Text
                      className={`text-sm font-medium ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Assigner une entreprise à gérer
                    </Text>
                  </View>

                  {formData.assignCompany && (
                    <View className="pl-6 border-l-2 border-blue-600/20 gap-4">
                      {/* Secteur d'activité */}
                      <View>
                        <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Secteur d&apos;activité <Text className="text-red-500">*</Text>
                        </Text>
                        <Select
                          value={formData.activitySectorId}
                          onValueChange={handleSectorChange}
                          placeholder="Sélectionner un secteur"
                          options={[
                            { label: "Sélectionner un secteur", value: "" },
                            ...(activitySectors?.map((sector: any) => ({
                              label: sector.name,
                              value: sector.id,
                            })) || []),
                          ]}
                        />
                      </View>

                      {/* Entreprise */}
                      {formData.activitySectorId && (
                        <View>
                          <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                            Entreprise <Text className="text-red-500">*</Text>
                          </Text>
                          <Select
                            value={formData.companyManager.companyId}
                            onValueChange={handleCompanyChange}
                            placeholder="Sélectionner une entreprise"
                            options={filteredCompanies.map((company: Company) => ({
                              label: company.name,
                              value: company.id,
                            }))}
                          />
                        </View>
                      )}

                      {/* Solde mobilisé et montant alloué */}
                      {selectedCompany && (
                        <>
                          {/* Solde mobilisé - design comme ExpensesScreen */}
                          <View>
                            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              Solde mobilisé de l&apos;entreprise
                            </Text>
                            {loadingMobilizedBalance ? (
                              <Text
                                className={`text-sm ${
                                  isDark ? "text-gray-400" : "text-gray-500"
                                }`}
                              >
                                Chargement...
                              </Text>
                            ) : mobilizedBalance !== null ? (
                              <View className="flex-row items-center gap-2">
                                <BlurredAmount
                                  amount={mobilizedBalance.amount}
                                  currency={selectedCompany.currency || "GNF"}
                                  className={`text-base font-bold ${
                                    isDark ? "text-blue-400" : "text-blue-600"
                                  }`}
                                />
                                {parseFloat(formData.companyManager.allocatedAmount || "0") >
                                  mobilizedBalance.amount && (
                                  <Text
                                    className={`text-xs font-medium ${
                                      isDark ? "text-red-400" : "text-red-600"
                                    }`}
                                  >
                                    ⚠️ Montant supérieur au solde disponible
                                  </Text>
                                )}
                              </View>
                            ) : (
                              <Text
                                className={`text-sm ${
                                  isDark ? "text-gray-400" : "text-gray-500"
                                }`}
                              >
                                Sélectionnez une entreprise
                              </Text>
                            )}
                          </View>

                          {/* Montant à attribuer */}
                          <View>
                            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                              Montant à attribuer au gestionnaire <Text className="text-red-500">*</Text>
                            </Text>
                            <TextInput
                              value={formData.companyManager.allocatedAmount}
                              onChangeText={(text) =>
                                setFormData({
                                  ...formData,
                                  companyManager: {
                                    ...formData.companyManager,
                                    allocatedAmount: formatDecimalInput(text),
                                  },
                                })
                              }
                              placeholder="0.00"
                              placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                              keyboardType="numeric"
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
                            {formData.companyManager.allocatedAmount &&
                              parseFloat(formData.companyManager.allocatedAmount || "0") >
                                (mobilizedBalance?.amount || 0) + 0.01 && (
                                <Text
                                  className={`text-xs mt-1 ${
                                    isDark ? "text-red-400" : "text-red-600"
                                  }`}
                                >
                                  Le montant ne peut pas dépasser le solde mobilisé
                                </Text>
                              )}
                          </View>
                        </>
                      )}
                    </View>
                  )}
                </View>
              );
            })()}
          </View>
        </ScrollView>
      </Drawer>

      {/* Drawer pour geler le compte */}
      <Drawer
        open={showFreezeDrawer}
        onOpenChange={setShowFreezeDrawer}
        title="Geler le compte"
      >
        {userToFreeze && userToFreeze.companyManager && (
          <View className="gap-4">
            <Text
              className={`text-base leading-6 ${
                isDark ? "text-gray-200" : "text-gray-800"
              }`}
            >
              Voulez-vous geler le compte de{" "}
              <Text className="font-bold">{userToFreeze.name}</Text> ?
            </Text>

            <View
              className={`p-4 rounded-lg ${
                isDark ? "bg-orange-900/20" : "bg-orange-50"
              } border ${isDark ? "border-orange-800" : "border-orange-200"}`}
            >
              <View className="gap-2">
                <View className="flex-row items-center justify-between">
                  <Text
                    className={`text-sm font-medium ${
                      isDark ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Solde non consommé (disponible):
                  </Text>
                  <BlurredAmount
                    amount={userToFreeze.companyManager.availableBalance}
                    currency={userToFreeze.companyManager.company.currency || "GNF"}
                    className={`text-sm font-semibold ${
                      isDark ? "text-gray-100" : "text-gray-900"
                    }`}
                  />
                </View>
                <View className="flex-row items-center justify-between">
                  <Text
                    className={`text-sm font-medium ${
                      isDark ? "text-gray-300" : "text-gray-700"
                    }`}
                  >
                    Montant alloué:
                  </Text>
                  <BlurredAmount
                    amount={userToFreeze.companyManager.allocatedAmount}
                    currency={userToFreeze.companyManager.company.currency || "GNF"}
                    className={`text-sm font-semibold ${
                      isDark ? "text-gray-100" : "text-gray-900"
                    }`}
                  />
                </View>
              </View>
            </View>

            <View className="flex-row items-center gap-3">
              <TouchableOpacity
                onPress={() => setReturnAmount(!returnAmount)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                  returnAmount
                    ? "bg-blue-600 border-blue-600"
                    : isDark
                      ? "border-gray-600"
                      : "border-gray-300"
                }`}
                activeOpacity={0.7}
              >
                {returnAmount && (
                  <Text className="text-white text-xs">✓</Text>
                )}
              </TouchableOpacity>
              <Text
                className={`text-sm font-medium flex-1 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Transférer le solde non consommé au solde mobilisé de
                l&apos;entreprise (sera retourné au gestionnaire au dégel)
              </Text>
            </View>

            <View
              className={`p-4 rounded-lg ${
                isDark ? "bg-orange-900/20" : "bg-orange-50"
              } border ${isDark ? "border-orange-800" : "border-orange-200"}`}
            >
              <View className="flex-row gap-3">
                <HugeiconsIcon
                  icon={AlertDiamondIcon}
                  size={20}
                  color={isDark ? "#fb923c" : "#ea580c"}
                />
                <View className="flex-1">
                  <Text
                    className={`text-sm font-medium mb-2 ${
                      isDark ? "text-orange-200" : "text-orange-800"
                    }`}
                  >
                    Attention
                  </Text>
                  <Text
                    className={`text-sm ${
                      isDark ? "text-orange-300" : "text-orange-700"
                    }`}
                  >
                    Le gel du compte empêchera le gestionnaire
                    d&apos;effectuer de nouvelles transactions. Si vous
                    choisissez de transférer le solde non consommé, ce
                    montant sera retourné au gestionnaire lors du dégel.
                  </Text>
                </View>
              </View>
            </View>

            <View className="flex-row gap-3 mt-4">
              <Button
                variant="outline"
                onPress={() => {
                  setShowFreezeDrawer(false);
                  setUserToFreeze(null);
                  setReturnAmount(false);
                }}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onPress={handleConfirmFreeze}
                disabled={isFreezing}
                className="flex-1"
                style={{ backgroundColor: "#ea580c" }}
              >
                {isFreezing ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  "Geler le compte"
                )}
              </Button>
            </View>
          </View>
        )}
      </Drawer>

      {/* Drawer de confirmation de suppression */}
      <Drawer
        open={showDeleteDrawer}
        onOpenChange={setShowDeleteDrawer}
        title="Supprimer l'utilisateur"
      >
        {userToDelete && (
          <View className="gap-4">
            <Text
              className={`text-base leading-6 ${
                isDark ? "text-gray-200" : "text-gray-800"
              }`}
            >
              Êtes-vous sûr de vouloir supprimer l'utilisateur{" "}
              <Text className="font-bold">{userToDelete.name}</Text> ?
              {"\n\n"}
              Cette action est irréversible et supprimera toutes les données associées.
            </Text>
            <View>
              <View className="flex-row items-center justify-between mb-3">
                <Text
                  className={`text-sm font-semibold ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Tapez le nom de l'utilisateur pour confirmer :
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Clipboard.setString(userToDelete.name);
                  }}
                  className="flex-row items-center gap-1 px-2 py-1 rounded-lg"
                  style={{
                    backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                  }}
                  activeOpacity={0.7}
                >
                  <HugeiconsIcon
                    icon={Copy01Icon}
                    size={16}
                    color={isDark ? "#60a5fa" : "#0ea5e9"}
                  />
                  <Text
                    className={`text-xs font-medium ${
                      isDark ? "text-blue-400" : "text-blue-600"
                    }`}
                  >
                    Copier
                  </Text>
                </TouchableOpacity>
              </View>
              <TextInput
                value={deleteConfirmation}
                onChangeText={setDeleteConfirmation}
                placeholder={userToDelete.name}
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                className={`px-4 py-3 rounded-xl border text-sm ${
                  isDark
                    ? "bg-[#1e293b] border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                style={{
                  textAlignVertical: "center",
                  includeFontPadding: false,
                  paddingVertical: 0,
                }}
              />
            </View>
            <View className="flex-row gap-3 mt-4">
              <Button
                variant="outline"
                onPress={() => {
                  setShowDeleteDrawer(false);
                  setUserToDelete(null);
                  setDeleteConfirmation("");
                }}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onPress={handleConfirmDelete}
                disabled={isDeleting || deleteConfirmation !== userToDelete.name}
                className="flex-1"
                style={{ backgroundColor: "#ef4444" }}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  "Supprimer"
                )}
              </Button>
            </View>
          </View>
        )}
      </Drawer>
    </SafeAreaView>
  );
}
