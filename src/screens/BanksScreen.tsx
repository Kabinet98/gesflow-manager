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
  BankIcon,
  Copy01Icon,
} from "@hugeicons/core-free-icons";
import { BanksSkeleton } from "@/components/skeletons/BanksSkeleton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { TAB_BAR_PADDING_BOTTOM, REFRESH_CONTROL_COLOR } from "@/constants/layout";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { getErrorMessage } from "@/utils/get-error-message";

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

interface Bank {
  id: string;
  name: string;
  code: string | null;
  country: {
    id: string;
    name: string;
  } | null;
  isActive: boolean;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  website?: string | null;
}

interface Country {
  id: string;
  name: string;
}

// Composant pour une ligne de la table
const BankTableRow = ({
  bank,
  columnWidths,
  totalTableWidth,
  isDark,
  canUpdate,
  canDelete,
  onEdit,
  onDelete,
  onScroll,
  scrollRef,
}: {
  bank: Bank;
  columnWidths: any;
  totalTableWidth: number;
  isDark: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  onEdit: (bank: Bank) => void;
  onDelete: (bank: Bank) => void;
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
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={{ width: totalTableWidth, flexDirection: "row" }}>
          {/* Nom */}
          <View
            style={{
              width: columnWidths.name,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <Text
              className={`text-sm ${isDark ? "text-gray-200" : "text-gray-900"}`}
              numberOfLines={2}
            >
              {bank.name}
            </Text>
          </View>

          {/* Code */}
          <View
            style={{
              width: columnWidths.code,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <Text
              className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}
            >
              {bank.code || "-"}
            </Text>
          </View>

          {/* Pays */}
          <View
            style={{
              width: columnWidths.country,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <Text
              className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}
            >
              {bank.country?.name || "-"}
            </Text>
          </View>

          {/* Statut */}
          <View
            style={{
              width: columnWidths.status,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <View
              className={`px-2 py-1 rounded-full self-start ${
                bank.isActive
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
                  bank.isActive
                    ? isDark
                      ? "text-green-300"
                      : "text-green-800"
                    : isDark
                      ? "text-gray-400"
                      : "text-gray-600"
                }`}
              >
                {bank.isActive ? "Actif" : "Inactif"}
              </Text>
            </View>
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
          gap: 8,
        }}
      >
        {canUpdate && (
          <TouchableOpacity
            onPress={() => onEdit(bank)}
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
        {canDelete && (
          <TouchableOpacity
            onPress={() => onDelete(bank)}
            className="p-1.5 rounded-full"
            style={{ backgroundColor: isDark ? "#1e293b" : "#f3f4f6" }}
            activeOpacity={0.7}
          >
            <HugeiconsIcon
              icon={Delete01Icon}
              size={14}
              color="#ef4444"
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

export function BanksScreen() {
  const { isDark } = useTheme();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [countryFilter, setCountryFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showBankForm, setShowBankForm] = useState(false);
  const [showDeleteDrawer, setShowDeleteDrawer] = useState(false);
  const [editingBank, setEditingBank] = useState<Bank | null>(null);
  const [bankToDelete, setBankToDelete] = useState<Bank | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // États du formulaire
  const [formData, setFormData] = useState({
    name: "",
    code: "",
    countryId: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    isActive: true,
  });

  // Refs pour synchroniser le scroll
  const headerScrollRef = useRef<ScrollView>(null);
  const contentScrollRefs = useRef<Map<string, ScrollView>>(new Map());
  const scrollXRef = useRef(0);
  const isScrollingRef = useRef(false);

  const canView = hasPermission("banks.view");
  const canCreate = hasPermission("banks.create");
  const canUpdate = hasPermission("banks.update");
  const canDelete = hasPermission("banks.delete");


  React.useEffect(() => {
    // Initialisation
  }, []);

  // Récupérer les pays
  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: async () => {
      try {
        const response = await api.get("/api/countries");
        return response.data;
      } catch (err) {
        return [];
      }
    },
  });

  // Récupérer les banques
  const {
    data: banks,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["banks"],
    queryFn: async () => {
      try {
        const response = await api.get("/api/banks");
        return response.data;
      } catch (err: any) {
        throw err;
      }
    },
    enabled: canView,
  });

  // Largeurs des colonnes
  const columnWidths = {
    name: 200,
    code: 120,
    country: 150,
    status: 100,
    actions: 100,
  };

  const totalTableWidth = Object.values(columnWidths).reduce(
    (sum, width) => sum + width,
    0
  );

  // Synchroniser le scroll entre header et contenu
  const handleContentScroll = useCallback((event: any, bankId?: string) => {
    if (isScrollingRef.current) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    scrollXRef.current = offsetX;
    isScrollingRef.current = true;
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollTo({ x: offsetX, animated: false });
    }
    contentScrollRefs.current.forEach((ref, id) => {
      if (id !== bankId && ref) {
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

  // Filtrer les banques
  const filteredBanks = useMemo(() => {
    if (!banks) return [];
    return banks.filter((bank: Bank) => {
      const matchesSearch =
        !searchTerm ||
        bank.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bank.code?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        bank.country?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCountry = !countryFilter || bank.country?.id === countryFilter;
      const matchesStatus =
        statusFilter === "ALL" ||
        (statusFilter === "ACTIVE" && bank.isActive) ||
        (statusFilter === "INACTIVE" && !bank.isActive);
      return matchesSearch && matchesCountry && matchesStatus;
    });
  }, [banks, searchTerm, countryFilter, statusFilter]);

  // Vérifier si tous les champs obligatoires sont remplis
  // Basé sur les patterns de gesflow, les champs obligatoires sont généralement: name et countryId
  const isFormValid = useMemo(() => {
    return formData.name.trim() !== "" && formData.countryId !== "";
  }, [formData]);

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

  // Gestion de la création
  const handleCreate = useCallback(() => {
    if (!canCreate) {
      return;
    }
    setFormData({
      name: "",
      code: "",
      countryId: "",
      address: "",
      phone: "",
      email: "",
      website: "",
      isActive: true,
    });
    setEditingBank(null);
    setShowBankForm(true);
  }, [canCreate]);

  // Gestion de l'édition
  const handleEdit = useCallback(
    (bank: Bank) => {
      if (!canUpdate) {
        return;
      }
    setFormData({
      name: bank.name,
      code: bank.code || "",
      countryId: bank.country?.id || "",
      address: bank.address || "",
      phone: bank.phone || "",
      email: bank.email || "",
      website: bank.website || "",
      isActive: bank.isActive,
    });
      setEditingBank(bank);
      setShowBankForm(true);
    },
    [canUpdate]
  );

  // Gestion de la suppression
  const handleDelete = useCallback(
    (bank: Bank) => {
      if (!canDelete) {
        return;
      }
      setBankToDelete(bank);
      setDeleteConfirmation("");
      setShowDeleteDrawer(true);
    },
    [canDelete]
  );

  // Soumettre le formulaire
  const handleSubmit = useCallback(async () => {
    // Validation côté client
    if (!formData.name.trim()) {
      Alert.alert("Erreur", "Le nom de la banque est requis");
      return;
    }
    if (!formData.countryId) {
      Alert.alert("Erreur", "Le pays est requis");
      return;
    }

    setIsSubmitting(true);
    try {
      // Préparer les données à envoyer
      const payload: any = {
        name: formData.name.trim(),
        code: formData.code.trim() || null,
        countryId: formData.countryId || null,
        address: formData.address.trim() || null,
        phone: formData.phone.trim() || null,
        email: formData.email.trim() || null,
        website: formData.website.trim() || null,
        isActive: formData.isActive,
      };

      if (editingBank) {
        await api.put(`/api/banks/${editingBank.id}`, payload);
      } else {
        const res = await api.post("/api/banks", payload);
        const id = res.data?.id;
      }
      await queryClient.invalidateQueries({ queryKey: ["banks"] });
      setShowBankForm(false);
      setEditingBank(null);
      Alert.alert("Succès", editingBank ? "Banque mise à jour" : "Banque créée");
    } catch (err: any) {
      // Afficher les détails de validation si disponibles
      const validationDetails = err.response?.data?.details;
      let errorMessage = getErrorMessage(err);

      if (
        validationDetails &&
        Array.isArray(validationDetails) &&
        validationDetails.length > 0
      ) {
        // Construire un message détaillé avec tous les champs manquants
        const missingFields = validationDetails
          .map((detail: any) => {
            const fieldName = detail.path || detail.field || "champ";
            return `- ${fieldName}: ${detail.message || "requis"}`;
          })
          .join("\n");
        errorMessage = `${errorMessage}\n\nChamps manquants ou invalides:\n${missingFields}`;
      }

      Alert.alert("Erreur", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  }, [formData, editingBank, queryClient]);

  // Confirmer la suppression
  const handleConfirmDelete = useCallback(async () => {
    if (!bankToDelete) return;
    if (deleteConfirmation !== bankToDelete.name) {
      Alert.alert("Erreur", "Le nom de confirmation ne correspond pas");
      return;
    }

    setIsDeleting(true);
    try {
      const id = bankToDelete.id;
      const name = bankToDelete.name;
      await api.delete(`/api/banks/${id}`);
      await queryClient.invalidateQueries({ queryKey: ["banks"] });
      setShowDeleteDrawer(false);
      setBankToDelete(null);
      setDeleteConfirmation("");
      Alert.alert("Succès", "Banque supprimée");
    } catch (err: any) {
      Alert.alert("Erreur", getErrorMessage(err, "Impossible de supprimer la banque"));
    } finally {
      setIsDeleting(false);
    }
  }, [bankToDelete, deleteConfirmation, queryClient]);

  // Export Excel/CSV
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const dataToExport = filteredBanks.map((bank: Bank) => ({
        Nom: bank.name,
        Code: bank.code || "",
        Pays: bank.country?.name || "",
        Statut: bank.isActive ? "Actif" : "Inactif",
      }));

      const csvContent = [
        ["Nom", "Code", "Pays", "Statut"],
        ...dataToExport.map((row: { Nom: string; Code: string; Pays: string; Statut: string }) => [
          row.Nom,
          row.Code,
          row.Pays,
          row.Statut,
        ]),
      ]
        .map((row: string[]) => row.map((cell: string) => `"${cell}"`).join(","))
        .join("\n");

      const filename = `banques_${new Date().toISOString().split("T")[0]}.csv`;
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
  }, [filteredBanks]);

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
        {!(isLoading || !banks) && (
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
                  countryFilter || statusFilter !== "ALL"
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
                    countryFilter || statusFilter !== "ALL"
                      ? "#ffffff"
                      : isDark
                        ? "#9ca3af"
                        : "#6b7280"
                  }
                />
                {(countryFilter ? 1 : 0) + (statusFilter !== "ALL" ? 1 : 0) > 0 && (
                  <View
                    className="px-1.5 py-0.5 rounded-full"
                    style={{ backgroundColor: "rgba(255, 255, 255, 0.2)" }}
                  >
                    <Text className="text-white text-xs font-semibold">
                      {(countryFilter ? 1 : 0) + (statusFilter !== "ALL" ? 1 : 0)}
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
        {isLoading || !banks ? (
          <BanksSkeleton />
        ) : filteredBanks.length === 0 ? (
          <View className="flex-1 items-center justify-center py-12">
            <Text className={`${isDark ? "text-gray-400" : "text-gray-600"}`}>
              {searchTerm || countryFilter || statusFilter !== "ALL"
                ? "Aucune banque trouvée avec les filtres actuels"
                : "Aucune banque disponible"}
            </Text>
          </View>
        ) : (
          <>
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
            >
              {/* En-tête de la table */}
              <View
                className={`border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}
                style={{ position: "relative" }}
              >
                <ScrollView
                  ref={headerScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  onScroll={handleHeaderScroll}
                  scrollEventThrottle={16}
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
                        width: columnWidths.code,
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
                        Code
                      </Text>
                    </View>
                    <View
                      style={{
                        width: columnWidths.country,
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
                        Pays
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
              {filteredBanks.map((bank: Bank) => (
                <BankTableRow
                  key={bank.id}
                  bank={bank}
                  columnWidths={columnWidths}
                  totalTableWidth={totalTableWidth}
                  isDark={isDark}
                  canUpdate={canUpdate}
                  canDelete={canDelete}
                  onEdit={handleEdit}
                  onDelete={handleDelete}
                  onScroll={(e) => handleContentScroll(e, bank.id)}
                  scrollRef={(ref) => {
                    if (ref) {
                      contentScrollRefs.current.set(bank.id, ref);
                    } else {
                      contentScrollRefs.current.delete(bank.id);
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
              Pays
            </Text>
            <Select
              value={countryFilter}
              onValueChange={setCountryFilter}
              placeholder="Tous les pays"
              options={[
                { label: "Tous les pays", value: "" },
                ...(countries?.map((country: Country) => ({
                  label: country.name,
                  value: country.id,
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
                setCountryFilter("");
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
        open={showBankForm}
        onOpenChange={setShowBankForm}
        title={editingBank ? "Modifier la banque" : "Nouvelle banque"}
        footer={
          <View className="flex-row gap-3">
            <Button
              variant="outline"
              onPress={() => {
                setShowBankForm(false);
                setEditingBank(null);
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
              ) : editingBank ? (
                "Modifier"
              ) : (
                "Créer"
              )}
            </Button>
          </View>
        }
      >
        <View className="gap-4">
          <View>
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Nom <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              value={formData.name}
              onChangeText={(text) => setFormData({ ...formData, name: text })}
              placeholder="Nom de la banque"
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

          <View>
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Code
            </Text>
            <TextInput
              value={formData.code}
              onChangeText={(text) => setFormData({ ...formData, code: text })}
              placeholder="Code de la banque"
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

          <View>
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Pays <Text className="text-red-500">*</Text>
            </Text>
            <Select
              value={formData.countryId}
              onValueChange={(value) => setFormData({ ...formData, countryId: value })}
              placeholder="Sélectionner un pays"
              options={
                countries?.map((country: Country) => ({
                  label: country.name,
                  value: country.id,
                })) || []
              }
            />
          </View>

          <View>
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Adresse
            </Text>
            <TextInput
              value={formData.address}
              onChangeText={(text) => setFormData({ ...formData, address: text })}
              placeholder="Adresse complète"
              placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              multiline
              numberOfLines={3}
              className={`px-4 py-3 rounded-lg border ${
                isDark
                  ? "bg-[#1e293b] border-gray-700 text-gray-100"
                  : "bg-gray-100 border-gray-300 text-gray-900"
              }`}
              style={{ textAlignVertical: "top", minHeight: 80 }}
            />
          </View>

          <View>
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Téléphone
            </Text>
            <TextInput
              value={formData.phone}
              onChangeText={(text) => setFormData({ ...formData, phone: text })}
              placeholder="+224 XXX XXX XXX"
              placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              keyboardType="phone-pad"
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

          <View>
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Email
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

          <View>
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Site web
            </Text>
            <TextInput
              value={formData.website}
              onChangeText={(text) => setFormData({ ...formData, website: text })}
              placeholder="https://example.com"
              placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              keyboardType="url"
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

          <View className="flex-row items-center justify-between">
            <Text
              className={`text-sm font-semibold ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Statut actif
            </Text>
            <TouchableOpacity
              onPress={() =>
                setFormData({ ...formData, isActive: !formData.isActive })
              }
              className={`w-12 h-6 rounded-full flex-row items-center ${
                formData.isActive
                  ? "bg-blue-600 justify-end"
                  : isDark
                    ? "bg-gray-700 justify-start"
                    : "bg-gray-300 justify-start"
              }`}
              style={{ paddingHorizontal: 2 }}
            >
              <View className="w-5 h-5 rounded-full bg-white" />
            </TouchableOpacity>
          </View>
        </View>
      </Drawer>

      {/* Drawer de confirmation de suppression */}
      <Drawer
        open={showDeleteDrawer}
        onOpenChange={setShowDeleteDrawer}
        title="Supprimer la banque"
      >
        {bankToDelete && (
          <View className="gap-4">
            <Text
              className={`text-base leading-6 ${
                isDark ? "text-gray-200" : "text-gray-800"
              }`}
            >
              Êtes-vous sûr de vouloir supprimer la banque{" "}
              <Text className="font-bold">{bankToDelete.name}</Text> ?
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
                  Tapez le nom de la banque pour confirmer :
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Clipboard.setString(bankToDelete.name);
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
                placeholder={bankToDelete.name}
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
                  setBankToDelete(null);
                  setDeleteConfirmation("");
                }}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onPress={handleConfirmDelete}
                disabled={isDeleting || deleteConfirmation !== bankToDelete.name}
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
