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
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/config/api";
import { useTheme } from "@/contexts/ThemeContext";
import { usePermissions } from "@/hooks/usePermissions";
import { authService } from "@/services/auth.service";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  Search01Icon,
  FilterIcon,
  PlusSignCircleIcon,
  Edit01Icon,
  Cancel01Icon,
  Download01Icon,
  Calendar03Icon,
  AlertDiamondIcon,
  MoneyIcon,
  Copy01Icon,
} from "@hugeicons/core-free-icons";
import { Company } from "@/types";
import { InvestmentsSkeleton } from "@/components/skeletons/InvestmentsSkeleton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { BlurredAmount } from "@/components/BlurredAmount";
import {
  TAB_BAR_PADDING_BOTTOM,
  REFRESH_CONTROL_COLOR,
} from "@/constants/layout";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { formatDecimalInput } from "@/utils/numeric-input";
import { writeExcelFromJson } from "@/utils/excel-secure";
import { getErrorMessage } from "@/utils/get-error-message";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_COLOR = "#0ea5e9";

// Importer l'API legacy pour documentDirectory, cacheDirectory et writeAsStringAsync
// Cela évite les avertissements de dépréciation dans expo-file-system v19+
let FileSystemLegacy: any = null;
try {
  FileSystemLegacy = require("expo-file-system/legacy");
} catch (e) {
  // L'API legacy n'est pas disponible, utiliser la nouvelle API
}

// Helper function pour obtenir le répertoire de documents
const getDocumentDirectory = (): string | null => {
  try {
    // Essayer d'abord l'API legacy si disponible
    if (FileSystemLegacy) {
      const docDir = FileSystemLegacy.documentDirectory;
      if (docDir && typeof docDir === "string") {
        return docDir;
      }
      const cacheDir = FileSystemLegacy.cacheDirectory;
      if (cacheDir && typeof cacheDir === "string") {
        return cacheDir;
      }
    }

    // Dans expo-file-system v19, documentDirectory et cacheDirectory sont dans FileSystem.Paths
    // Vérifier FileSystem.Paths (nouvelle API)
    const paths = (FileSystem as any).Paths;
    if (paths) {
      const pathsKeys = Object.keys(paths || {});

      if (
        paths.documentDirectory &&
        typeof paths.documentDirectory === "string"
      ) {
        return paths.documentDirectory;
      }

      if (paths.cacheDirectory && typeof paths.cacheDirectory === "string") {
        return paths.cacheDirectory;
      }
    }

    // Fallback : essayer directement sur FileSystem
    if ((FileSystem as any).documentDirectory) {
      return (FileSystem as any).documentDirectory;
    }
    if ((FileSystem as any).cacheDirectory) {
      return (FileSystem as any).cacheDirectory;
    }

    return null;
  } catch (error: any) {
    return null;
  }
};

interface Investment {
  id: string;
  amount: number;
  currency: string;
  description: string | null;
  date: string;
  createdAt: string;
  status?: string;
  company: {
    id: string;
    name: string;
    currency?: string;
    country?:
      | {
          id: string;
          name: string;
        }
      | string;
  };
  category?: {
    id: string;
    name: string;
  };
  investmentCategory?: {
    id: string;
    name: string;
  };
  createdBy?: {
    id: string;
    name: string;
    email: string;
  };
}

interface InvestmentCategory {
  id: string;
  name: string;
}

// Fonction pour normaliser le texte de confirmation
const normalizeConfirmationText = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ");
};

// Fonction pour formater le montant
const formatAmount = (amount: number, currency: string): string => {
  return `${amount.toLocaleString("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency}`;
};

export function InvestmentsScreen() {
  const { isDark } = useTheme();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showInvestmentForm, setShowInvestmentForm] = useState(false);
  const [showCancelDrawer, setShowCancelDrawer] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | null>(
    null,
  );
  const [investmentToCancel, setInvestmentToCancel] =
    useState<Investment | null>(null);
  const [cancelConfirmation, setCancelConfirmation] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);

  // État du formulaire
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    currency: "GNF",
    companyId: "",
    countryId: "",
    categoryId: "",
    date: "",
  });

  // États de loading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Refs pour synchroniser le scroll
  const headerScrollRef = useRef<ScrollView>(null);
  const contentScrollRefs = useRef<Map<string, ScrollView>>(new Map());
  const scrollXRef = useRef(0);
  const isScrollingRef = useRef(false);

  const canView = hasPermission("investments.view");
  const canCreate = hasPermission("investments.create");
  const canUpdate = hasPermission("investments.update");
  const canDelete = hasPermission("investments.delete");

  // Récupérer l'ID de l'utilisateur actuel
  useEffect(() => {
    const fetchCurrentUser = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          setCurrentUserId(user.id);
        }
      } catch (err: any) {
        // Erreur silencieuse
      }
    };
    fetchCurrentUser();
  }, []);

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

  // Récupérer les catégories d'investissement
  const { data: categories } = useQuery({
    queryKey: ["investment-categories"],
    queryFn: async () => {
      try {
        const response = await api.get("/api/investment-categories");
        return response.data;
      } catch (err) {
        return [];
      }
    },
  });

  // Récupérer les investissements
  const {
    data: investments,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["investments"],
    queryFn: async () => {
      try {
        const response = await api.get("/api/investments");
        // Trier par date de création décroissante
        const sortedData = (response.data || []).sort(
          (a: Investment, b: Investment) => {
            const dateA = new Date(a.createdAt).getTime();
            const dateB = new Date(b.createdAt).getTime();
            return dateB - dateA;
          },
        );
        return sortedData;
      } catch (err: any) {
        throw err;
      }
    },
    enabled: canView,
  });

  // Filtrer les investissements
  const filteredInvestments = useMemo(() => {
    if (!investments) return [];

    return investments.filter((investment: Investment) => {
      // Filtre par recherche
      const matchesSearch =
        investment.description
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        investment.company?.name
          ?.toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (investment.category?.name || investment.investmentCategory?.name || "")
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      // Filtre par date (date de l'investissement)
      const investmentDate = new Date(investment.date);
      const matchesStartDate =
        !startDate || investmentDate >= new Date(startDate);
      const matchesEndDate =
        !endDate || investmentDate <= new Date(endDate + "T23:59:59");

      // Filtre par montant
      const min = minAmount ? parseFloat(minAmount) : 0;
      const max = maxAmount ? parseFloat(maxAmount) : Infinity;
      const matchesAmount =
        investment.amount >= min && investment.amount <= max;

      return (
        matchesSearch && matchesStartDate && matchesEndDate && matchesAmount
      );
    });
  }, [investments, searchTerm, startDate, endDate, minAmount, maxAmount]);

  // Vérifier si tous les champs obligatoires sont remplis
  const isFormValid = useMemo(() => {
    return (
      formData.description.trim() &&
      formData.amount &&
      formData.companyId &&
      formData.date
    );
  }, [formData]);

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

  // Synchroniser le scroll
  const handleContentScroll = useCallback(
    (event: any, investmentId?: string) => {
      if (isScrollingRef.current) return;
      const offsetX = event.nativeEvent.contentOffset.x;
      scrollXRef.current = offsetX;
      isScrollingRef.current = true;

      if (headerScrollRef.current) {
        headerScrollRef.current.scrollTo({ x: offsetX, animated: false });
      }

      contentScrollRefs.current.forEach((ref, id) => {
        if (id !== investmentId && ref) {
          ref.scrollTo({ x: offsetX, animated: false });
        }
      });

      setTimeout(() => {
        isScrollingRef.current = false;
      }, 100);
    },
    [],
  );

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

  // Vérifier si une transaction peut être annulée (24h)
  const canCancelTransaction = (createdAt: string): boolean => {
    const now = new Date();
    const created = new Date(createdAt);
    const diffInMs = now.getTime() - created.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    return diffInHours < 24;
  };

  // Vérifier si un investissement peut être annulé
  const canCancelInvestment = (investment: Investment): boolean => {
    if (investment.status === "CANCELLED") return false;
    if (!canCancelTransaction(investment.createdAt)) return false;

    // Un utilisateur ne peut annuler que ses propres transactions
    // Si currentUserId n'est pas encore chargé, on permet l'affichage du bouton
    // La vérification finale se fera dans handleCancelInvestment
    const investmentCreatorId = investment.createdBy?.id;
    if (
      currentUserId &&
      investmentCreatorId &&
      investmentCreatorId !== currentUserId
    ) {
      return false;
    }

    return true;
  };

  // Vérifier si un investissement peut être modifié (24h)
  const canEditInvestment = (investment: Investment): boolean => {
    if (investment.status === "CANCELLED") return false;
    return canCancelTransaction(investment.createdAt);
  };

  const handleCreate = () => {
    if (!canCreate) {
      return;
    }

    const getLocalDateString = (): string => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    setFormData({
      description: "",
      amount: "",
      currency: "GNF",
      companyId: "",
      countryId: "",
      categoryId: "",
      date: getLocalDateString(),
    });
    setEditingInvestment(null);
    setShowInvestmentForm(true);
  };

  const handleEdit = async (investment: Investment) => {
    if (!canUpdate) {
      return;
    }

    const investmentDate = investment.date
      ? new Date(investment.date)
      : new Date();
    const year = investmentDate.getFullYear();
    const month = String(investmentDate.getMonth() + 1).padStart(2, "0");
    const day = String(investmentDate.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;

    const company = companies?.find(
      (c: Company) => c.id === investment.company.id,
    );
    const countryId = company?.country
      ? typeof company.country === "string"
        ? company.country
        : (company.country as any)?.id || ""
      : "";

    setFormData({
      description: investment.description || "",
      amount: investment.amount.toString(),
      currency: investment.currency || "GNF",
      companyId: investment.company.id,
      countryId: countryId,
      categoryId:
        investment.category?.id || investment.investmentCategory?.id || "",
      date: formattedDate,
    });
    setEditingInvestment(investment);
    setShowInvestmentForm(true);
  };

  const handleSubmitInvestment = async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      if (
        !formData.description ||
        !formData.amount ||
        !formData.companyId ||
        !formData.date
      ) {
        Alert.alert("Erreur", "Veuillez remplir tous les champs obligatoires");
        setIsSubmitting(false);
        return;
      }

      // Récupérer le countryId depuis l'entreprise
      const company = companies?.find(
        (c: Company) => c.id === formData.companyId,
      );
      let finalCountryId = formData.countryId;
      if (company?.country) {
        finalCountryId =
          typeof company.country === "string"
            ? company.country
            : (company.country as any)?.id || "";
      }

      if (!finalCountryId) {
        Alert.alert(
          "Erreur",
          "Impossible de déterminer le pays de l'entreprise",
        );
        setIsSubmitting(false);
        return;
      }

      const payload: any = {
        description: formData.description,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        companyId: formData.companyId,
        countryId: finalCountryId,
        date: formData.date,
      };

      if (formData.categoryId) {
        payload.categoryId = formData.categoryId;
      }

      if (editingInvestment) {
        await api.put(`/api/investments/${editingInvestment.id}`, payload);
      } else {
        const res = await api.post("/api/investments", payload);
        const id = res.data?.id;
      }

      setShowInvestmentForm(false);
      setEditingInvestment(null);
      setFormData({
        description: "",
        amount: "",
        currency: "GNF",
        companyId: "",
        countryId: "",
        categoryId: "",
        date: "",
      });

      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error: any) {
      Alert.alert("Erreur", getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelInvestment = (investment: Investment) => {
    if (!canCancelInvestment(investment)) {
      Alert.alert(
        "Impossible d'annuler",
        "Cette transaction ne peut pas être annulée. Elle a peut-être déjà été annulée, ou plus de 24h se sont écoulées depuis sa création, ou vous n'êtes pas l'auteur de cette transaction.",
      );
      return;
    }

    setInvestmentToCancel(investment);
    setCancelConfirmation("");
    setShowCancelDrawer(true);
  };

  const confirmCancel = async () => {
    if (!investmentToCancel || isCancelling) return;

    const confirmationText = `${investmentToCancel.company.name} - ${formatAmount(
      investmentToCancel.amount,
      investmentToCancel.currency || "GNF",
    )}`;

    if (
      normalizeConfirmationText(cancelConfirmation) !==
      normalizeConfirmationText(confirmationText)
    ) {
      Alert.alert("Erreur", "La confirmation ne correspond pas");
      return;
    }

    try {
      setIsCancelling(true);

      const id = investmentToCancel.id;
      await api.delete(`/api/investments/${id}`, {
        skipAuthError: true,
      });

      setShowCancelDrawer(false);
      setInvestmentToCancel(null);
      setCancelConfirmation("");

      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error: any) {
      Alert.alert("Erreur", getErrorMessage(error));
    } finally {
      setIsCancelling(false);
    }
  };

  const handleExportExcel = async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);

      if (!filteredInvestments || filteredInvestments.length === 0) {
        Alert.alert(
          "Aucune donnée",
          "Il n'y a aucun investissement à exporter avec les filtres actuels.",
        );
        return;
      }

      // Préparer les données pour l'export
      const exportData = filteredInvestments.map((investment: Investment) => {
        const formatDate = (dateString: string) => {
          const date = new Date(dateString);
          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const year = date.getFullYear();
          return `${day}/${month}/${year}`;
        };

        return {
          Date: formatDate(investment.date),
          Entreprise: investment.company?.name || "N/A",
          Catégorie:
            investment.category?.name ||
            investment.investmentCategory?.name ||
            "",
          Description: investment.description || "",
          Montant: formatAmount(
            investment.amount,
            investment.currency || "GNF",
          ),
          Devise: investment.currency || "GNF",
        };
      });

      // Créer un fichier Excel avec exceljs (sécurisé)
      try {
        let fileContent: string;
        let filename: string;
        let mimeType: string;
        let useExcel = false;
        try {
          fileContent = await writeExcelFromJson(exportData, "Investissements");
          filename = `investissements_${new Date().toISOString().split("T")[0]}.xlsx`;
          mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          useExcel = true;
        } catch (e) {
          // Fallback CSV
          // Fallback vers CSV
          const headers = Object.keys(exportData[0]);
          const csvRows = [
            headers.join(","),
            ...exportData.map((row: any) =>
              headers
                .map((header) => {
                  const value = row[header as keyof typeof row];
                  if (
                    typeof value === "string" &&
                    (value.includes(",") ||
                      value.includes('"') ||
                      value.includes("\n"))
                  ) {
                    return `"${value.replace(/"/g, '""')}"`;
                  }
                  return value ?? "";
                })
                .join(","),
            ),
          ];
          fileContent = csvRows.join("\n");
          filename = `investissements_${new Date().toISOString().split("T")[0]}.csv`;
          mimeType = "text/csv";
        }

        // Utiliser la même logique que getDocumentDirectory() pour trouver le répertoire
        let directory = getDocumentDirectory();

        // Si getDocumentDirectory() ne trouve pas de répertoire, essayer d'utiliser FileSystem.Directory
        if (!directory) {
          try {
            const Directory = (FileSystem as any).Directory;
            if (Directory) {
              if (typeof Directory.cacheDirectory === "function") {
                const cacheDir = await Directory.cacheDirectory();
                if (cacheDir && typeof cacheDir === "string") {
                  directory = cacheDir;
                }
              } else if (typeof Directory.cacheDirectory === "string") {
                directory = Directory.cacheDirectory;
              } else if (Directory.cacheDirectory) {
                directory =
                  Directory.cacheDirectory.path ||
                  Directory.cacheDirectory.uri ||
                  Directory.cacheDirectory;
              }
            }
          } catch (e) {
            // Erreur silencieuse
          }
        }

        // Utiliser l'API legacy pour writeAsStringAsync
        let writeFn: any = null;

        if (FileSystemLegacy && FileSystemLegacy.writeAsStringAsync) {
          writeFn = FileSystemLegacy.writeAsStringAsync;
        } else {
          // Fallback : chercher dans FileSystem standard
          let FileSystemModule: any = FileSystem;
          let depth = 0;
          const maxDepth = 5;

          while (
            depth < maxDepth &&
            FileSystemModule &&
            !FileSystemModule.writeAsStringAsync
          ) {
            if (FileSystemModule.default) {
              FileSystemModule = FileSystemModule.default;
              depth++;
            } else {
              break;
            }
          }

          writeFn = FileSystemModule?.writeAsStringAsync;
        }

        if (!writeFn || typeof writeFn !== "function") {
          throw new Error("writeAsStringAsync not found in expo-file-system");
        }

        // Si directory n'est toujours pas disponible, utiliser un chemin relatif
        if (!directory) {
          directory = "";
        }

        const fileUri = directory ? `${directory}${filename}` : filename;

        // Écrire le fichier (Excel en base64 ou CSV en utf8)
        try {
          if (useExcel) {
            await writeFn(fileUri, fileContent, {
              encoding: "base64",
            });
          } else {
            // Pour CSV, utiliser utf8
            await writeFn(fileUri, fileContent, {
              encoding: "utf8",
            });
          }
        } catch (writeError: any) {
          throw new Error(
            `Impossible d'écrire le fichier: ${writeError.message}`,
          );
        }

        // Partager le fichier
        const isAvailable = await Sharing.isAvailableAsync();
        if (isAvailable) {
          await Sharing.shareAsync(fileUri, {
            mimeType: mimeType,
            dialogTitle: useExcel
              ? "Partager le fichier Excel"
              : "Partager le fichier CSV",
          });
        } else {
          Alert.alert(
            "Export réussi",
            `Le fichier ${useExcel ? "Excel" : "CSV"} a été sauvegardé : ${filename}`,
          );
        }
      } catch (exportError: any) {
        Alert.alert(
          "Erreur",
          exportError.message || "Impossible d'exporter le fichier Excel",
        );
      }
    } catch (error: any) {
      Alert.alert("Erreur", "Une erreur est survenue lors de l'export.");
    } finally {
      setIsExporting(false);
    }
  };

  // Largeurs des colonnes
  const columnWidths = {
    date: 110,
    company: 150,
    category: 150,
    description: 200,
    amount: 140,
    actions: 100,
  };

  const totalTableWidth = Object.values(columnWidths).reduce(
    (sum, width) => sum + width,
    0,
  );

  if (!canView) {
    return (
      <SafeAreaView
        className={`flex-1 ${isDark ? "bg-[#0f172a]" : "bg-white"}`}
        edges={["top", "bottom"]}
      >
        <View className="flex-1 justify-center items-center px-6">
          <Text
            className={`text-center ${isDark ? "text-gray-400" : "text-gray-600"}`}
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
      <ScreenHeader title="Investissements" />
      <View className="flex-1">
        <View className="px-6 pt-20 pb-4">
          {/* Barre de recherche, filtre et bouton créer */}
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
                  minHeight: 20,
                }}
              />
            </View>

            {/* Bouton filtre */}
            <TouchableOpacity
              onPress={() => setShowFiltersModal(true)}
              className={`px-3 py-2.5 rounded-full flex-row items-center gap-1.5 ${
                startDate || endDate || minAmount || maxAmount
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
                  startDate || endDate || minAmount || maxAmount
                    ? "#ffffff"
                    : isDark
                      ? "#9ca3af"
                      : "#6b7280"
                }
              />
              {(startDate ? 1 : 0) +
                (endDate ? 1 : 0) +
                (minAmount ? 1 : 0) +
                (maxAmount ? 1 : 0) >
                0 && (
                <View
                  className="px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(255, 255, 255, 0.2)" }}
                >
                  <Text className="text-white text-xs font-semibold">
                    {(startDate ? 1 : 0) +
                      (endDate ? 1 : 0) +
                      (minAmount ? 1 : 0) +
                      (maxAmount ? 1 : 0)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Bouton export */}
            <TouchableOpacity
              onPress={handleExportExcel}
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

        {/* Table avec scroll horizontal synchronisé */}
        {isLoading || !investments ? (
          <InvestmentsSkeleton />
        ) : (
          <View className="flex-1">
            {/* En-têtes de colonnes */}
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
                  {/* Date */}
                  <View
                    style={{ width: columnWidths.date }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Date
                    </Text>
                  </View>

                  {/* Entreprise */}
                  <View
                    style={{ width: columnWidths.company }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Entreprise
                    </Text>
                  </View>

                  {/* Catégorie */}
                  <View
                    style={{ width: columnWidths.category }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Catégorie
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

                  {/* Montant */}
                  <View
                    style={{ width: columnWidths.amount }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Montant
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

            {/* Liste des investissements */}
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
              contentContainerStyle={{ paddingBottom: TAB_BAR_PADDING_BOTTOM }}
            >
              {filteredInvestments.length === 0 ? (
                <View className="items-center justify-center py-12 px-6">
                  <Text
                    className={`text-center text-sm ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    {searchTerm ||
                    startDate ||
                    endDate ||
                    minAmount ||
                    maxAmount
                      ? "Aucun investissement trouvé"
                      : "Aucun investissement disponible"}
                  </Text>
                </View>
              ) : (
                filteredInvestments.map((investment: Investment) => {
                  // Vérifier les permissions et les conditions pour les actions
                  const canEdit = canUpdate && canEditInvestment(investment);
                  const canCancel =
                    canDelete && canCancelInvestment(investment);
                  const hasEditAction = canEdit;
                  const hasCancelAction = canCancel;
                  const hasAnyAction = hasEditAction || hasCancelAction;
                  const actionCount = [hasEditAction, hasCancelAction].filter(
                    Boolean,
                  ).length;

                  return (
                    <View
                      key={investment.id}
                      className={`border-b ${
                        isDark
                          ? "border-gray-800 bg-[#0f172a]"
                          : "border-gray-100 bg-white"
                      }`}
                      style={{ position: "relative" }}
                    >
                      {/* Contenu scrollable */}
                      <ScrollView
                        nestedScrollEnabled={true}
                        ref={(ref) => {
                          if (ref) {
                            contentScrollRefs.current.set(investment.id, ref);
                            if (scrollXRef.current > 0) {
                              requestAnimationFrame(() => {
                                ref.scrollTo({
                                  x: scrollXRef.current,
                                  animated: false,
                                });
                              });
                            }
                          } else {
                            contentScrollRefs.current.delete(investment.id);
                          }
                        }}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        onScroll={(e) => handleContentScroll(e, investment.id)}
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
                          {/* Date */}
                          <View
                            style={{ width: columnWidths.date }}
                            className="px-3 py-4 justify-center"
                          >
                            <Text
                              className={`text-xs ${
                                isDark ? "text-gray-400" : "text-gray-600"
                              }`}
                            >
                              {new Date(investment.date).toLocaleDateString(
                                "fr-FR",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                },
                              )}
                            </Text>
                          </View>

                          {/* Entreprise */}
                          <View
                            style={{ width: columnWidths.company }}
                            className="px-3 py-4 justify-center"
                          >
                            <Text
                              className={`text-xs ${
                                isDark ? "text-gray-400" : "text-gray-600"
                              }`}
                              numberOfLines={1}
                            >
                              {investment.company?.name || "N/A"}
                            </Text>
                          </View>

                          {/* Catégorie */}
                          <View
                            style={{ width: columnWidths.category }}
                            className="px-3 py-4 justify-center"
                          >
                            <View className="gap-1">
                              <Text
                                className={`text-xs ${
                                  isDark ? "text-gray-400" : "text-gray-600"
                                }`}
                                numberOfLines={1}
                              >
                                {investment.category?.name ||
                                  investment.investmentCategory?.name ||
                                  "-"}
                              </Text>
                              {investment.status === "CANCELLED" && (
                                <View
                                  className="px-2 py-0.5 rounded-full self-start"
                                  style={{ backgroundColor: "#ef444420" }}
                                >
                                  <Text
                                    className="text-[10px] font-medium"
                                    style={{ color: "#ef4444" }}
                                  >
                                    Annulé
                                  </Text>
                                </View>
                              )}
                            </View>
                          </View>

                          {/* Description */}
                          <View
                            style={{ width: columnWidths.description }}
                            className="px-3 py-4 justify-center"
                          >
                            <Text
                              className={`text-sm font-medium ${
                                isDark ? "text-gray-100" : "text-gray-900"
                              }`}
                              numberOfLines={2}
                            >
                              {investment.description || "Sans description"}
                            </Text>
                          </View>

                          {/* Montant */}
                          <View
                            style={{ width: columnWidths.amount }}
                            className="px-3 py-4 justify-center"
                          >
                            <BlurredAmount
                              amount={investment.amount}
                              currency={investment.currency}
                              className="text-xs font-semibold"
                            />
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
                          borderLeftColor: isDark ? "#1e293b" : "#e5e7eb",
                        }}
                        className="px-3 justify-center items-center flex-row gap-2"
                        pointerEvents="auto"
                      >
                        {hasAnyAction ? (
                          <>
                            {hasEditAction && (
                              <TouchableOpacity
                                className="rounded-full"
                                style={{
                                  backgroundColor: `${CHART_COLOR}20`,
                                  padding: actionCount >= 2 ? 6 : 8,
                                }}
                                activeOpacity={0.7}
                                onPress={() => handleEdit(investment)}
                              >
                                <HugeiconsIcon
                                  icon={Edit01Icon}
                                  size={actionCount >= 2 ? 14 : 16}
                                  color={CHART_COLOR}
                                />
                              </TouchableOpacity>
                            )}
                            {hasCancelAction && (
                              <TouchableOpacity
                                className="rounded-full"
                                style={{
                                  backgroundColor: "#ef444420",
                                  padding: actionCount >= 2 ? 6 : 8,
                                }}
                                activeOpacity={0.7}
                                onPress={() =>
                                  handleCancelInvestment(investment)
                                }
                              >
                                <HugeiconsIcon
                                  icon={Cancel01Icon}
                                  size={actionCount >= 2 ? 14 : 16}
                                  color="#ef4444"
                                />
                              </TouchableOpacity>
                            )}
                          </>
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
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Drawer Filtres */}
      <Drawer
        open={showFiltersModal}
        onOpenChange={setShowFiltersModal}
        title="Filtres"
      >
        {/* Filtre Date */}
        <View className="mb-6">
          <Text
            className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}
          >
            Date
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text
                className={`text-xs mb-2 ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Du
              </Text>
              <View
                className={`flex-row items-center gap-2 px-4 py-2 rounded-lg border ${
                  isDark
                    ? "bg-[#1e293b] border-gray-700"
                    : "bg-gray-100 border-gray-300"
                }`}
              >
                <HugeiconsIcon
                  icon={Calendar03Icon}
                  size={16}
                  color={isDark ? "#9ca3af" : "#6b7280"}
                />
                <TextInput
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                  className={`flex-1 ${
                    isDark ? "text-gray-100" : "text-gray-900"
                  }`}
                  style={{
                    textAlignVertical: "center",
                    textAlign: "left",
                    includeFontPadding: false,
                    paddingVertical: 0,
                    minHeight: 36,
                  }}
                />
              </View>
            </View>
            <View className="flex-1">
              <Text
                className={`text-xs mb-2 ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Au
              </Text>
              <View
                className={`flex-row items-center gap-2 px-4 py-2 rounded-lg border ${
                  isDark
                    ? "bg-[#1e293b] border-gray-700"
                    : "bg-gray-100 border-gray-300"
                }`}
              >
                <HugeiconsIcon
                  icon={Calendar03Icon}
                  size={16}
                  color={isDark ? "#9ca3af" : "#6b7280"}
                />
                <TextInput
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                  className={`flex-1 ${
                    isDark ? "text-gray-100" : "text-gray-900"
                  }`}
                  style={{
                    textAlignVertical: "center",
                    textAlign: "left",
                    includeFontPadding: false,
                    paddingVertical: 0,
                    minHeight: 36,
                  }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Filtre Montant */}
        <View className="mb-6">
          <Text
            className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}
          >
            Montant
          </Text>
          <View className="flex-row gap-3">
            <View className="flex-1">
              <Text
                className={`text-xs mb-2 ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Min
              </Text>
              <View
                className={`flex-row items-center gap-2 px-4 py-2 rounded-lg border ${
                  isDark
                    ? "bg-[#1e293b] border-gray-700"
                    : "bg-gray-100 border-gray-300"
                }`}
              >
                <Text
                  className={`text-sm ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                  style={{ includeFontPadding: false }}
                >
                  {investments?.[0]?.currency || "GNF"}
                </Text>
                <TextInput
                  value={minAmount}
                  onChangeText={(text) => setMinAmount(formatDecimalInput(text))}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                  keyboardType="numeric"
                  className={`flex-1 ${
                    isDark ? "text-gray-100" : "text-gray-900"
                  }`}
                  style={{
                    textAlignVertical: "center",
                    textAlign: "left",
                    includeFontPadding: false,
                    paddingVertical: 0,
                    minHeight: 36,
                  }}
                />
              </View>
            </View>
            <View className="flex-1">
              <Text
                className={`text-xs mb-2 ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Max
              </Text>
              <View
                className={`flex-row items-center gap-2 px-4 py-2 rounded-lg border ${
                  isDark
                    ? "bg-[#1e293b] border-gray-700"
                    : "bg-gray-100 border-gray-300"
                }`}
              >
                <Text
                  className={`text-sm ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                  style={{ includeFontPadding: false }}
                >
                  {investments?.[0]?.currency || "GNF"}
                </Text>
                <TextInput
                  value={maxAmount}
                  onChangeText={(text) => setMaxAmount(formatDecimalInput(text))}
                  placeholder="0.00"
                  placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                  keyboardType="numeric"
                  className={`flex-1 ${
                    isDark ? "text-gray-100" : "text-gray-900"
                  }`}
                  style={{
                    textAlignVertical: "center",
                    textAlign: "left",
                    includeFontPadding: false,
                    paddingVertical: 0,
                    minHeight: 36,
                  }}
                />
              </View>
            </View>
          </View>
        </View>

        <TouchableOpacity
          onPress={() => {
            setStartDate("");
            setEndDate("");
            setMinAmount("");
            setMaxAmount("");
          }}
          className="mb-4"
          activeOpacity={0.7}
        >
          <Text
            className={`text-sm font-medium text-center ${
              isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Clear all
          </Text>
        </TouchableOpacity>
      </Drawer>

      {/* Drawer Formulaire Investissement */}
      <Drawer
        open={showInvestmentForm}
        onOpenChange={(open) => {
          setShowInvestmentForm(open);
          if (!open) {
            setEditingInvestment(null);
            const getLocalDateString = (): string => {
              const now = new Date();
              const year = now.getFullYear();
              const month = String(now.getMonth() + 1).padStart(2, "0");
              const day = String(now.getDate()).padStart(2, "0");
              return `${year}-${month}-${day}`;
            };
            setFormData({
              description: "",
              amount: "",
              currency: "GNF",
              companyId: "",
              countryId: "",
              categoryId: "",
              date: getLocalDateString(),
            });
          }
        }}
        title={
          editingInvestment
            ? "Modifier l'investissement"
            : "Nouvel investissement"
        }
        footer={
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => {
                setShowInvestmentForm(false);
                setEditingInvestment(null);
                const getLocalDateString = (): string => {
                  const now = new Date();
                  const year = now.getFullYear();
                  const month = String(now.getMonth() + 1).padStart(2, "0");
                  const day = String(now.getDate()).padStart(2, "0");
                  return `${year}-${month}-${day}`;
                };
                setFormData({
                  description: "",
                  amount: "",
                  currency: "GNF",
                  companyId: "",
                  countryId: "",
                  categoryId: "",
                  date: getLocalDateString(),
                });
              }}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: 9999,
                borderWidth: 1,
                borderColor: isDark ? "#374151" : "#e5e7eb",
                backgroundColor: "transparent",
              }}
              activeOpacity={0.7}
            >
              <Text
                style={{
                  textAlign: "center",
                  fontWeight: "600",
                  color: isDark ? "#d1d5db" : "#374151",
                }}
              >
                Annuler
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSubmitInvestment}
              disabled={isSubmitting || !isFormValid}
              className="flex-1 py-3 rounded-full flex-row items-center justify-center gap-2"
              style={{
                backgroundColor: CHART_COLOR,
                opacity: isSubmitting ? 0.7 : 1,
              }}
              activeOpacity={0.7}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : null}
              <Text className="text-white text-center font-semibold">
                {editingInvestment ? "Modifier" : "Créer"}
              </Text>
            </TouchableOpacity>
          </View>
        }
      >
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Entreprise - Premier champ */}
          <View className="mb-4">
            <Text
              className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}
            >
              Entreprise <Text className="text-red-500">*</Text>
            </Text>
            <Select
              value={formData.companyId}
              onValueChange={(value: string) => {
                const selectedCompany = companies?.find(
                  (c: Company) => c.id === value,
                );
                if (selectedCompany) {
                  const countryId = selectedCompany.country
                    ? typeof selectedCompany.country === "string"
                      ? selectedCompany.country
                      : (selectedCompany.country as any)?.id || ""
                    : "";
                  setFormData({
                    ...formData,
                    companyId: value,
                    countryId: countryId,
                    currency: selectedCompany.currency || "GNF",
                  });
                } else {
                  setFormData({ ...formData, companyId: value });
                }
              }}
              placeholder="Sélectionner une entreprise"
              options={
                companies?.map((company: Company) => ({
                  label: company.name,
                  value: company.id,
                })) || []
              }
            />
          </View>

          {/* Catégorie */}
          <View className="mb-4">
            <Text
              className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}
            >
              Catégorie
            </Text>
            <Select
              value={formData.categoryId}
              onValueChange={(value: string) =>
                setFormData({ ...formData, categoryId: value })
              }
              placeholder="Sélectionner une catégorie (optionnel)"
              options={
                categories?.map((category: InvestmentCategory) => ({
                  label: category.name,
                  value: category.id,
                })) || []
              }
            />
          </View>

          {/* Montant */}
          <View className="mb-4">
            <Text
              className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}
            >
              Montant <Text className="text-red-500">*</Text>
            </Text>
            <View
              className={`flex-row items-center gap-2 px-4 py-2 rounded-lg border ${
                isDark
                  ? "bg-[#1e293b] border-gray-700"
                  : "bg-gray-100 border-gray-300"
              }`}
            >
              <Text
                className={`text-sm ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
                style={{ includeFontPadding: false }}
              >
                {formData.currency}
              </Text>
              <TextInput
                value={formData.amount}
                onChangeText={(text) =>
                  setFormData({ ...formData, amount: formatDecimalInput(text) })
                }
                placeholder="0.00"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                keyboardType="numeric"
                className={`flex-1 ${
                  isDark ? "text-gray-100" : "text-gray-900"
                }`}
                style={{
                  textAlignVertical: "center",
                  textAlign: "left",
                  includeFontPadding: false,
                  paddingVertical: 0,
                  minHeight: 36,
                }}
              />
            </View>
          </View>

          {/* Date */}
          <View className="mb-4">
            <Text
              className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}
            >
              Date <Text className="text-red-500">*</Text>
            </Text>
            <View
              className={`flex-row items-center gap-2 px-4 py-2 rounded-lg border ${
                isDark
                  ? "bg-[#1e293b] border-gray-700"
                  : "bg-gray-100 border-gray-300"
              }`}
            >
              <HugeiconsIcon
                icon={Calendar03Icon}
                size={16}
                color={isDark ? "#9ca3af" : "#6b7280"}
              />
              <TextInput
                value={formData.date}
                onChangeText={(text) =>
                  setFormData({ ...formData, date: text })
                }
                placeholder="YYYY-MM-DD"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                className={`flex-1 ${
                  isDark ? "text-gray-100" : "text-gray-900"
                }`}
                style={{
                  textAlignVertical: "center",
                  textAlign: "left",
                  includeFontPadding: false,
                  paddingVertical: 0,
                  minHeight: 36,
                }}
              />
            </View>
          </View>

          {/* Description */}
          <View className="mb-4">
            <Text
              className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}
            >
              Description <Text className="text-red-500">*</Text>
            </Text>
            <TextInput
              value={formData.description}
              onChangeText={(text) =>
                setFormData({ ...formData, description: text })
              }
              placeholder="Entrez la description"
              placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              multiline
              numberOfLines={3}
              className={`px-4 py-3 rounded-lg border ${
                isDark
                  ? "bg-[#1e293b] border-gray-700 text-gray-100"
                  : "bg-gray-100 border-gray-300 text-gray-900"
              }`}
              style={{
                textAlignVertical: "top",
                textAlign: "left",
                includeFontPadding: false,
                minHeight: 80,
              }}
            />
          </View>
        </ScrollView>
      </Drawer>

      {/* Drawer Confirmation Annulation */}
      <Drawer
        open={showCancelDrawer}
        onOpenChange={setShowCancelDrawer}
        title="Confirmer l'annulation"
      >
        {investmentToCancel && (
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
              Êtes-vous sûr de vouloir annuler cette transaction de{" "}
              <Text className="font-bold">
                {investmentToCancel.company.name}
              </Text>{" "}
              ?{"\n\n"}
              Cette action est irréversible et mettra à jour les soldes de
              l'entreprise.
            </Text>

            <View>
              <View className="flex-row items-center justify-between mb-3">
                <Text
                  className={`text-sm font-semibold flex-1 ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Tapez "{investmentToCancel.company.name} -{" "}
                  {formatAmount(
                    investmentToCancel.amount,
                    investmentToCancel.currency || "GNF",
                  )}
                  " pour confirmer :
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    const textToCopy = `${investmentToCancel.company.name} - ${formatAmount(
                      investmentToCancel.amount,
                      investmentToCancel.currency || "GNF",
                    )}`;
                    Clipboard.setString(textToCopy);
                  }}
                  className="flex-row items-center gap-1 px-2 py-1 rounded-lg ml-2"
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
                value={cancelConfirmation}
                onChangeText={setCancelConfirmation}
                placeholder={`${investmentToCancel.company.name} - ${formatAmount(
                  investmentToCancel.amount,
                  investmentToCancel.currency || "GNF",
                )}`}
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                className={`px-4 py-3.5 rounded-xl border text-sm ${
                  isDark
                    ? "bg-[#1e293b] border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                autoCapitalize="none"
                autoCorrect={false}
                contextMenuHidden={false}
                selectTextOnFocus={true}
              />
            </View>

            <View
              className={`p-4 rounded-lg ${
                isDark ? "bg-red-900/20" : "bg-red-50"
              }`}
            >
              <View className="flex-row gap-3">
                <HugeiconsIcon
                  icon={AlertDiamondIcon}
                  size={20}
                  color={isDark ? "#fca5a5" : "#dc2626"}
                />
                <View className="flex-1">
                  <Text
                    className={`text-sm font-medium mb-1 ${
                      isDark ? "text-red-200" : "text-red-800"
                    }`}
                  >
                    Attention
                  </Text>
                  <Text
                    className={`text-xs ${
                      isDark ? "text-red-300" : "text-red-700"
                    }`}
                  >
                    Cette action annulera définitivement cette transaction. Les
                    soldes de l'entreprise seront automatiquement mis à jour.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        <View className="flex-row gap-3 mt-6">
          <Button
            onPress={confirmCancel}
            disabled={
              isCancelling ||
              !investmentToCancel ||
              !cancelConfirmation ||
              normalizeConfirmationText(cancelConfirmation) !==
                normalizeConfirmationText(
                  `${investmentToCancel?.company.name} - ${formatAmount(
                    investmentToCancel?.amount || 0,
                    investmentToCancel?.currency || "GNF",
                  )}`,
                )
            }
            loading={isCancelling}
            className="flex-1 h-12 py-0"
            style={{
              backgroundColor: "#ef4444",
              opacity:
                investmentToCancel &&
                cancelConfirmation &&
                normalizeConfirmationText(cancelConfirmation) ===
                  normalizeConfirmationText(
                    `${investmentToCancel.company.name} - ${formatAmount(
                      investmentToCancel.amount,
                      investmentToCancel.currency || "GNF",
                    )}`,
                  ) &&
                !isCancelling
                  ? 1
                  : 0.5,
            }}
          >
            Annuler la transaction
          </Button>
          <TouchableOpacity
            onPress={() => {
              setShowCancelDrawer(false);
              setInvestmentToCancel(null);
              setCancelConfirmation("");
            }}
            className="flex-1 py-3 rounded-full items-center border"
            style={{
              borderColor: isDark ? "#374151" : "#e5e7eb",
            }}
            activeOpacity={0.7}
          >
            <Text
              className={`font-semibold ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Annuler
            </Text>
          </TouchableOpacity>
        </View>
      </Drawer>
    </SafeAreaView>
  );
}
