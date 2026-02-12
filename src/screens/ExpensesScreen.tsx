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
  Modal,
  Alert,
  ActivityIndicator,
  Linking,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import AsyncStorage from "@react-native-async-storage/async-storage";
import api from "@/config/api";
import { auditService } from "@/services/audit.service";
// Types axios sont automatiquement inclus via src/types/axios.d.ts
import { useTheme } from "@/contexts/ThemeContext";
import { useAmountVisibility } from "@/contexts/AmountVisibilityContext";
import { usePermissions } from "@/hooks/usePermissions";
import { authService } from "@/services/auth.service";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  ArrowUpLeft01Icon,
  ArrowDownLeft01Icon,
  Search01Icon,
  FilterIcon,
  PlusSignCircleIcon,
  Edit01Icon,
  Delete01Icon,
  Cancel01Icon,
  EyeIcon,
  Download01Icon,
  Calendar03Icon,
  Upload01Icon,
  File01Icon,
  ArrowLeft01Icon,
  CheckmarkCircle02Icon,
  AlertDiamondIcon,
} from "@hugeicons/core-free-icons";
import { Expense, Company } from "@/types";
import { ExpensesSkeleton } from "@/components/skeletons/ExpensesSkeleton";
import { Header } from "@/components/Header";
import { BlurredAmount } from "@/components/BlurredAmount";
import { PieChartComponent } from "@/components/charts/PieChart";
import {
  TAB_BAR_PADDING_BOTTOM,
  REFRESH_CONTROL_COLOR,
} from "@/constants/layout";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { formatDecimalInput } from "@/utils/numeric-input";
import { getErrorMessage } from "@/utils/get-error-message";
import { formatAmount as formatAmountUtil } from "@/utils/format-amount";
import { writeExcelFromJson } from "@/utils/excel-secure";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
// Importer l'API legacy pour documentDirectory, cacheDirectory et writeAsStringAsync
// Cela évite les avertissements de dépréciation dans expo-file-system v19+
let FileSystemLegacy: any = null;
try {
  FileSystemLegacy = require("expo-file-system/legacy");
} catch (e) {
  // L'API legacy n'est pas disponible, utiliser la nouvelle API
}
import * as Sharing from "expo-sharing";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_COLOR = "#0ea5e9"; // Couleur chart pour les boutons

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

      // Essayer différentes variantes de noms
      const docDir =
        paths.documentDirectory || paths.documentDir || paths.docDir;
      const cacheDir = paths.cacheDirectory || paths.cacheDir;

      if (docDir) {
        return docDir;
      }
      if (cacheDir) {
        return cacheDir;
      }
    }

    // expo-file-system v19+ a une structure imbriquée avec plusieurs niveaux de default
    // Parcourir récursivement les niveaux de default jusqu'à trouver documentDirectory ou cacheDirectory
    let FileSystemModule: any = FileSystem;
    let depth = 0;
    const maxDepth = 5;

    // Parcourir les niveaux de default jusqu'à trouver documentDirectory ou cacheDirectory
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

    // @ts-ignore - documentDirectory et cacheDirectory sont des propriétés statiques
    // Utiliser la même approche que l'export CSV qui fonctionne
    const docDir = FileSystemModule?.documentDirectory;
    // @ts-ignore
    const cacheDir = FileSystemModule?.cacheDirectory;

    // Si trouvé directement, retourner
    if (docDir || cacheDir) {
      const result = docDir || cacheDir;
      return result;
    }

    // Vérifier aussi dans FileSystemModule.Paths (nouvelle API expo-file-system)
    const pathsModule = FileSystemModule?.Paths;
    if (pathsModule) {
      const pathsKeys = Object.keys(pathsModule);

      // Essayer différentes variantes
      const pathsDocDir =
        pathsModule.documentDirectory ||
        pathsModule.documentDir ||
        pathsModule.docDir;
      const pathsCacheDir = pathsModule.cacheDirectory || pathsModule.cacheDir;

      if (pathsDocDir || pathsCacheDir) {
        const result = pathsDocDir || pathsCacheDir;
        return result;
      }
    }

    // Vérifier aussi directement dans FileSystem.Paths
    const directPaths = (FileSystem as any).Paths;
    if (directPaths) {
      const directPathsKeys = Object.keys(directPaths);

      const directPathsDocDir =
        directPaths.documentDirectory ||
        directPaths.documentDir ||
        directPaths.docDir;
      const directPathsCacheDir =
        directPaths.cacheDirectory || directPaths.cacheDir;

      if (directPathsDocDir || directPathsCacheDir) {
        const result = directPathsDocDir || directPathsCacheDir;
        return result;
      }
    }

    return null;
  } catch (error: any) {
    return null;
  }
};

// Composant SwipeableDocument pour afficher les actions au swipe
interface SwipeableDocumentProps {
  doc: any;
  editingExpense: Expense | null;
  isDark: boolean;
  onReload: () => Promise<any>;
}

const SwipeableDocument: React.FC<SwipeableDocumentProps> = ({
  doc,
  editingExpense,
  isDark,
  onReload,
}) => {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = () => {
    // Cacher le bouton Télécharger pour les documents uploadés (qui ont une propriété `file`)
    // Les documents sauvegardés n'ont pas de propriété `file` mais ont une URL
    const isUploadedDocument = doc.file && typeof doc.file === "object";
    const showDownloadButton = !isUploadedDocument;

    // Calculer la largeur pour que tous les boutons tiennent
    // 3 actions (Voir, Modifier, Supprimer) + 1 retour = 4 boutons (Télécharger caché)
    const actionWidth = 70;
    const numberOfActions = 3; // Télécharger toujours caché
    const totalActionsWidth = actionWidth * numberOfActions;
    const backButtonWidth = 60; // Bouton retour plus petit
    const actionHeight = "100%";

    return (
      <View
        className="flex-row items-stretch"
        style={{ height: "100%", width: totalActionsWidth + backButtonWidth }}
      >
        {/* Bouton Retour - Pour revenir à la vue du document */}
        <TouchableOpacity
          onPress={() => {
            swipeableRef.current?.close();
          }}
          style={{
            width: backButtonWidth,
            height: actionHeight,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: isDark ? "#374151" : "#6b7280",
            borderTopLeftRadius: 12,
            borderBottomLeftRadius: 12,
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 5,
          }}
          activeOpacity={0.8}
        >
          <View className="items-center">
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255, 255, 255, 0.2)",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 4,
                borderWidth: 1.5,
                borderColor: "rgba(255, 255, 255, 0.3)",
              }}
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color="#ffffff" />
            </View>
            <Text
              style={{
                color: "#ffffff",
                fontSize: 10,
                fontWeight: "600",
              }}
            >
              Retour
            </Text>
          </View>
        </TouchableOpacity>

        {/* Bouton Voir - Design moderne avec gradient et ombre */}
        <TouchableOpacity
          onPress={async () => {
            swipeableRef.current?.close();
            try {
              // Construire l'URL correctement
              // L'API peut retourner soit une URL complète MinIO, soit un chemin relatif
              let url = doc.url;

              // Si l'URL ne commence pas par http, c'est probablement un chemin relatif
              if (!url || typeof url !== "string") {
                Alert.alert("Erreur", "URL du document invalide ou manquante");
                return;
              }

              // Si l'URL est relative (commence par /api/files/), récupérer l'URL MinIO signée
              // L'endpoint /api/files/ redirige vers MinIO avec l'URL signée
              if (url.startsWith("/api/files/")) {
                try {
                  // Faire une requête GET qui suivra automatiquement les redirections
                  // pour obtenir l'URL MinIO signée finale
                  const apiUrl = `${api.defaults.baseURL}${url}`;
                  const response = await api.get(url, {
                    skipAuthError: true,
                    maxRedirects: 5, // Suivre les redirections
                    validateStatus: () => true, // Accepter tous les codes de statut
                  });

                  // Si on a une URL de redirection (après avoir suivi les redirections), l'utiliser
                  if (
                    response.request?.responseURL &&
                    response.request.responseURL !== apiUrl
                  ) {
                    url = response.request.responseURL;
                  } else if (response.status >= 300 && response.status < 400) {
                    // Si c'est une redirection, récupérer l'URL depuis le header Location
                    const location =
                      response.headers.location ||
                      response.headers.Location ||
                      response.headers["location"] ||
                      response.headers["Location"];
                    if (location) {
                      url = location;
                    } else {
                      // Pas de Location, utiliser l'URL de l'API qui redirigera
                      url = apiUrl;
                    }
                  } else {
                    // Si erreur, utiliser quand même l'URL de l'API
                    // Le navigateur/FileSystem suivra la redirection automatiquement
                    url = apiUrl;
                  }
                } catch (apiError: any) {
                  // En cas d'erreur, utiliser l'URL de l'API
                  // Le navigateur/FileSystem suivra la redirection automatiquement
                  url = `${api.defaults.baseURL}${url}`;
                }
              } else if (!url.startsWith("http")) {
                // Si c'est un chemin relatif sans /api/files/, essayer de construire l'URL MinIO
                // Format attendu: users/.../expenses/...
                if (url.includes("users/")) {
                  const usersIndex = url.indexOf("users/");
                  const cleanUrl = url.substring(usersIndex);
                  // Construire l'URL MinIO directement (comme dans GesFlow)
                  // L'URL MinIO devrait être: http://MINIO_ENDPOINT:MINIO_PORT/BUCKET_NAME/path
                  // Pour l'instant, on utilise l'endpoint API qui redirige vers MinIO
                  url = `${api.defaults.baseURL}/api/files/${encodeURIComponent(cleanUrl)}`;
                } else {
                  Alert.alert("Erreur", "Format d'URL du document non reconnu");
                  return;
                }
              }

              // Vérifier que l'URL est maintenant valide
              if (!url.startsWith("http")) {
                Alert.alert(
                  "Erreur",
                  "Impossible de construire une URL valide pour le document",
                );
                return;
              }

              // Ouvrir directement l'URL dans le navigateur/visualiseur
              const canOpen = await Linking.canOpenURL(url);
              if (canOpen) {
                await Linking.openURL(url);
              } else {
                Alert.alert("Erreur", "Impossible d'ouvrir le document");
              }
            } catch (error: any) {
              Alert.alert(
                "Erreur",
                getErrorMessage(error, "Impossible d'ouvrir le document"),
              );
            }
          }}
          style={{
            width: actionWidth,
            height: actionHeight,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: isDark ? "#1e40af" : "#3b82f6",
            shadowColor: "#3b82f6",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.4,
            shadowRadius: 6,
            elevation: 6,
          }}
          activeOpacity={0.8}
        >
          <View className="items-center">
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255, 255, 255, 0.25)",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 4,
                borderWidth: 1.5,
                borderColor: "rgba(255, 255, 255, 0.3)",
              }}
            >
              <HugeiconsIcon icon={EyeIcon} size={20} color="#ffffff" />
            </View>
            <Text
              style={{
                color: "#ffffff",
                fontSize: 10,
                fontWeight: "700",
                textShadowColor: "rgba(0, 0, 0, 0.2)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              }}
              numberOfLines={1}
            >
              Voir
            </Text>
          </View>
        </TouchableOpacity>

        {/* Bouton Modifier - Design moderne avec gradient et ombre */}
        <TouchableOpacity
          onPress={() => {
            swipeableRef.current?.close();
            // Ouvrir un prompt pour modifier le titre
            Alert.prompt(
              "Modifier le titre",
              "Entrez le nouveau titre du document",
              [
                {
                  text: "Annuler",
                  style: "cancel",
                },
                {
                  text: "Modifier",
                  onPress: async (newTitle: string | undefined) => {
                    if (newTitle && newTitle.trim() && newTitle !== doc.title) {
                      try {
                        await api.patch(
                          `/api/expenses/${editingExpense?.id}/documents`,
                          {
                            documentId: doc.id,
                            title: newTitle.trim(),
                          },
                          { skipAuthError: true },
                        );
                        // Recharger les documents
                        await onReload();
                      } catch (error: any) {
                        Alert.alert(
                          "Erreur",
                          "Impossible de modifier le titre",
                        );
                      }
                    }
                  },
                },
              ],
              "plain-text",
              doc.title,
            );
          }}
          style={{
            width: actionWidth,
            height: actionHeight,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: isDark ? "#92400e" : "#f59e0b",
            shadowColor: "#f59e0b",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.4,
            shadowRadius: 6,
            elevation: 6,
          }}
          activeOpacity={0.8}
        >
          <View className="items-center">
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 22,
                backgroundColor: "rgba(255, 255, 255, 0.25)",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 6,
                borderWidth: 1.5,
                borderColor: "rgba(255, 255, 255, 0.3)",
              }}
            >
              <HugeiconsIcon icon={Edit01Icon} size={22} color="#ffffff" />
            </View>
            <Text
              style={{
                color: "#ffffff",
                fontSize: 10,
                fontWeight: "700",
                textShadowColor: "rgba(0, 0, 0, 0.2)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              }}
              numberOfLines={1}
            >
              Modifier
            </Text>
          </View>
        </TouchableOpacity>

        {/* Bouton Supprimer - Design moderne avec gradient et ombre */}
        <TouchableOpacity
          onPress={() => {
            swipeableRef.current?.close();
            Alert.alert(
              "Supprimer le document",
              `Êtes-vous sûr de vouloir supprimer "${doc.title}" ?`,
              [
                {
                  text: "Annuler",
                  style: "cancel",
                },
                {
                  text: "Supprimer",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await api.delete(
                        `/api/expenses/${editingExpense?.id}/documents?documentId=${doc.id}`,
                        { skipAuthError: true },
                      );
                      // Recharger les documents
                      await onReload();
                    } catch (error: any) {
                      Alert.alert(
                        "Erreur",
                        "Impossible de supprimer le document",
                      );
                    }
                  },
                },
              ],
            );
          }}
          style={{
            width: actionWidth,
            height: actionHeight,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: isDark ? "#991b1b" : "#ef4444",
            borderTopRightRadius: 12,
            borderBottomRightRadius: 12,
            shadowColor: "#ef4444",
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.4,
            shadowRadius: 6,
            elevation: 6,
          }}
          activeOpacity={0.8}
        >
          <View className="items-center">
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: "rgba(255, 255, 255, 0.25)",
                justifyContent: "center",
                alignItems: "center",
                marginBottom: 4,
                borderWidth: 1.5,
                borderColor: "rgba(255, 255, 255, 0.3)",
              }}
            >
              <HugeiconsIcon icon={Delete01Icon} size={20} color="#ffffff" />
            </View>
            <Text
              style={{
                color: "#ffffff",
                fontSize: 10,
                fontWeight: "700",
                textShadowColor: "rgba(0, 0, 0, 0.2)",
                textShadowOffset: { width: 0, height: 1 },
                textShadowRadius: 2,
              }}
              numberOfLines={1}
            >
              Supprimer
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      overshootRight={false}
      containerStyle={{ marginBottom: 8 }}
    >
      <View
        className={`flex-row items-center gap-3 p-3 rounded-lg border ${
          isDark ? "bg-[#0f172a] border-gray-700" : "bg-gray-50 border-gray-200"
        }`}
        style={{ overflow: "hidden", minHeight: 70 }}
      >
        <HugeiconsIcon
          icon={File01Icon}
          size={20}
          color={isDark ? "#9ca3af" : "#6b7280"}
        />
        <View className="flex-1" style={{ minWidth: 0 }}>
          <Text
            className={`text-sm font-medium ${
              isDark ? "text-gray-100" : "text-gray-900"
            }`}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {doc.title}
          </Text>
          <Text
            className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {doc.filename}
          </Text>
        </View>
        <Text
          className={`text-xs ${isDark ? "text-gray-500" : "text-gray-400"}`}
          numberOfLines={1}
        >
          ← Glisser
        </Text>
      </View>
    </Swipeable>
  );
};

// Composant pour la ligne de dépense avec animation pulse pour les dépenses en attente
interface PendingExpenseRowWrapperProps {
  expenseId: string;
  isPending: boolean;
  isDark: boolean;
  children: React.ReactNode;
}

const PendingExpenseRowWrapper: React.FC<PendingExpenseRowWrapperProps> = ({
  expenseId,
  isPending,
  isDark,
  children,
}) => {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isPending) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ]),
      );
      pulse.start();
      return () => {
        pulse.stop();
        pulseAnim.setValue(1);
      };
    } else {
      pulseAnim.setValue(1);
    }
  }, [isPending, pulseAnim]);

  const animatedStyle = { opacity: pulseAnim };

  if (isPending) {
    return <Animated.View style={animatedStyle}>{children}</Animated.View>;
  }

  return <>{children}</>;
};

export function ExpensesScreen() {
  const { isDark } = useTheme();
  const { isAmountVisible } = useAmountVisibility();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<"ALL" | "INCOME" | "OUTCOME">(
    "ALL",
  );
  const [statusFilter, setStatusFilter] = useState<
    "ALL" | "PENDING" | "APPROVED" | "REJECTED"
  >("ALL");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showExpenseForm, setShowExpenseForm] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [isManagerAccountFrozen, setIsManagerAccountFrozen] = useState(false);
  const [frozenAmount, setFrozenAmount] = useState<number | null>(null);
  const [frozenCurrency, setFrozenCurrency] = useState<string>("GNF");
  const [isAdmin, setIsAdmin] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  // État du formulaire
  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    currency: "GNF",
    type: "OUTCOME" as "INCOME" | "OUTCOME",
    companyId: "",
    countryId: "",
    date: "",
    category: "Business" as "Business" | "Famille" | "",
  });

  // État pour le solde mobilisé
  const [mobilizedBalance, setMobilizedBalance] = useState<{
    amount: number;
    currency: string;
  } | null>(null);
  const [loadingMobilizedBalance, setLoadingMobilizedBalance] = useState(false);

  // États de loading pour les actions
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isAddingDocument, setIsAddingDocument] = useState(false);
  const [isCancellingExpense, setIsCancellingExpense] = useState(false);

  // État pour les documents/preuves
  const [documents, setDocuments] = useState<
    Array<{ file: any; title: string; id: string }>
  >([]);
  const [expenseDocuments, setExpenseDocuments] = useState<
    Array<{
      id: string;
      title: string;
      filename: string;
      url: string;
      fileType?: string;
      createdAt: string;
    }>
  >([]);

  // États pour le modal de visualisation et validation
  const [showViewModal, setShowViewModal] = useState(false);
  const [expenseToView, setExpenseToView] = useState<Expense | null>(null);
  const [viewExpenseDocuments, setViewExpenseDocuments] = useState<
    Array<{
      id: string;
      title: string;
      filename: string;
      url: string;
      fileType?: string;
      createdAt: string;
    }>
  >([]);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [expenseToValidate, setExpenseToValidate] = useState<Expense | null>(
    null,
  );
  const [validationAction, setValidationAction] = useState<
    "approve" | "reject" | null
  >(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  // Refs pour synchroniser le scroll (utiliser ref au lieu de state pour éviter les re-renders)
  const headerScrollRef = useRef<ScrollView>(null);
  const contentScrollRefs = useRef<Map<string, ScrollView>>(new Map());
  const scrollXRef = useRef(0);
  const isScrollingRef = useRef(false);

  const canView = hasPermission("expenses.view");
  const canCreate = hasPermission("expenses.create");
  const canUpdate = hasPermission("expenses.update");
  const canDelete = hasPermission("expenses.delete");

  // Récupérer le companyId de l'utilisateur s'il est gestionnaire
  useEffect(() => {
    const fetchUserCompany = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          // Stocker l'ID de l'utilisateur actuel
          setCurrentUserId(user.id);

          // Vérifier si l'utilisateur est un gestionnaire
          const response = await api.get("/api/users/me");
          const fullUser = response.data;

          // Vérifier si l'utilisateur a un rôle de gestionnaire ou admin
          const roleName = fullUser?.role?.name?.toLowerCase() || "";
          const isManagerRole =
            roleName.includes("gestionnaire") || roleName.includes("manager");
          const isAdminRole =
            roleName.includes("admin") || roleName === "administrateur";

          if (isAdminRole) {
            setIsAdmin(true);
          }

          // Compte gelé : comme GesFlow, on utilise GET /api/users/:id/company-manager
          // (manager.frozenBalance ?? null et affichage avec ?? 0)
          const companyManagerFromMe = (fullUser as any)?.companyManager;
          if (companyManagerFromMe?.isFrozen === true) {
            setIsManagerAccountFrozen(true);
            setFrozenAmount(companyManagerFromMe.frozenBalance ?? 0);
            setFrozenCurrency(companyManagerFromMe?.company?.currency ?? "GNF");
          }

          if (isManagerRole) {
            // Récupérer le companyId et infos gel depuis company-manager (comme GesFlow dashboard/expenses)
            try {
              const managerResponse = await api.get(
                `/api/users/${user.id}/company-manager`,
              );
              const manager = managerResponse.data;

              if (manager?.companyId) {
                setUserCompanyId(manager.companyId);
                setIsManager(true);
                if (manager.isFrozen === true) {
                  setIsManagerAccountFrozen(true);
                  setFrozenAmount(manager.frozenBalance ?? 0);
                  setFrozenCurrency(manager?.company?.currency ?? "GNF");
                }
              }
            } catch (managerErr: any) {
              if (managerErr.response?.status !== 404) {
                // Erreur silencieuse
              }
            }
          }
        }
      } catch (err: any) {
        // Erreur silencieuse
      }
    };

    fetchUserCompany();
  }, []);

  useEffect(() => {
    // Initialisation
  }, []); // Seulement au montage

  // Récupérer les entreprises pour le filtre
  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      try {
        const response = await api.get("/api/companies");
        const data = response.data;
        return Array.isArray(data) ? data : data?.data ?? data ?? [];
      } catch (err) {
        return [];
      }
    },
  });

  // Garder la devise du formulaire synchronisée avec l'entreprise sélectionnée (dès que companies est chargé)
  useEffect(() => {
    if (!showExpenseForm || !formData.companyId || !companies?.length) return;
    const company = companies.find(
      (c: Company) => c.id === formData.companyId,
    ) as Company | undefined;
    const companyCurrency = company?.currency;
    if (companyCurrency && companyCurrency !== formData.currency) {
      setFormData((prev) => ({ ...prev, currency: companyCurrency }));
    }
  }, [showExpenseForm, formData.companyId, companies]);

  // Récupérer les gestionnaires pour le filtre
  const { data: managers } = useQuery({
    queryKey: ["managers"],
    queryFn: async () => {
      try {
        const response = await api.get("/api/users/managers");
        return response.data || [];
      } catch (err) {
        return [];
      }
    },
  });

  const {
    data: expenses,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      try {
        // S'assurer que l'API inclut la relation company avec le country
        // Essayer d'abord avec include, sinon sans paramètre (l'API peut inclure par défaut)
        const response = await api.get("/api/expenses");
        return response.data;
      } catch (err: any) {
        throw err;
      }
    },
    enabled: canView,
  });

  // Filtrer les dépenses - DOIT être avant tout return conditionnel (règle des hooks)
  const filteredExpenses = useMemo(() => {
    // Normaliser en tableau : l'API peut renvoyer un tableau ou un objet { data: [...] } / { expenses: [...] }
    const list = Array.isArray(expenses)
      ? expenses
      : Array.isArray((expenses as any)?.data)
        ? (expenses as any).data
        : Array.isArray((expenses as any)?.expenses)
          ? (expenses as any).expenses
          : [];

    // Les admins voient TOUTES les dépenses - pas de filtre par créateur
    // Pour les managers, s'assurer qu'ils ne voient que leurs propres dépenses
    // (le backend devrait déjà filtrer, mais on double-vérifie côté client pour sécurité)
    let expensesToFilter = list;
    if (!isAdmin && isManager && currentUserId) {
      expensesToFilter = list.filter(
        (expense: Expense) => (expense as any).createdBy?.id === currentUserId,
      );
    }

    return expensesToFilter.filter((expense: Expense) => {
      // Filtre par recherche
      const matchesSearch =
        expense.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        expense.company?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      // Filtre par type
      const matchesType = typeFilter === "ALL" || expense.type === typeFilter;

      // Filtre par statut de validation
      const matchesValidationStatus =
        statusFilter === "ALL" || expense.validationStatus === statusFilter;

      // Filtre par date
      const expenseDate = new Date(expense.createdAt);
      const matchesStartDate = !startDate || expenseDate >= new Date(startDate);
      const matchesEndDate =
        !endDate || expenseDate <= new Date(endDate + "T23:59:59");

      // Filtre par montant
      const min = minAmount ? parseFloat(minAmount) : 0;
      const max = maxAmount ? parseFloat(maxAmount) : Infinity;
      const matchesAmount = expense.amount >= min && expense.amount <= max;

      // Filtre par gestionnaire (seulement pour les admins, pas pour les managers)
      // Les admins peuvent filtrer par gestionnaire, les managers voient déjà uniquement les leurs
      const matchesUser =
        (!isAdmin && isManager) || // Les managers ne filtrent pas par utilisateur (ils voient déjà uniquement les leurs)
        (isAdmin &&
          (!selectedUserId ||
            selectedUserId === "all" ||
            (expense as any).createdBy?.id === selectedUserId)); // Pour les admins : voir toutes si "Tous" ou aucun filtre, sinon filtrer par gestionnaire sélectionné

      // Filtre par catégorie (uniquement pour l'admin)
      // Mapper "Personnelle" (de l'API) vers "Famille" (pour le filtre)
      const expenseCategory = (expense as any).category === "Personnelle" ? "Famille" : (expense as any).category;
      const matchesCategory =
        !selectedCategory ||
        selectedCategory === "all" ||
        (selectedCategory === "none" && !expenseCategory) ||
        expenseCategory === selectedCategory;

      return (
        matchesSearch &&
        matchesType &&
        matchesValidationStatus &&
        matchesStartDate &&
        matchesEndDate &&
        matchesAmount &&
        matchesUser &&
        matchesCategory
      );
    });
  }, [
    expenses,
    searchTerm,
    typeFilter,
    statusFilter,
    startDate,
    endDate,
    minAmount,
    maxAmount,
    selectedUserId,
    selectedCategory,
    isManager,
    isAdmin,
    currentUserId,
  ]);

  // Extraire les pays uniques
  const uniqueCountries = useMemo(() => {
    const list = Array.isArray(expenses)
      ? expenses
      : Array.isArray((expenses as any)?.data)
        ? (expenses as any).data
        : Array.isArray((expenses as any)?.expenses)
          ? (expenses as any).expenses
          : [];
    const countries = new Set<string>();
    list.forEach((expense: Expense) => {
      if (expense.company?.country) {
        const countryValue =
          typeof expense.company.country === "string"
            ? expense.company.country
            : (expense.company.country as any)?.id || expense.company.country;
        if (countryValue) {
          countries.add(countryValue);
        }
      }
    });
    return Array.from(countries).sort();
  }, [expenses]);

  // Calculer la répartition des dépenses par catégorie
  const expensesByCategory = useMemo(() => {
    if (!filteredExpenses || filteredExpenses.length === 0) return [];
    
    const categoryMap = new Map<string, number>();
    
    filteredExpenses.forEach((expense: Expense) => {
      // Mapper "Personnelle" (de l'API) vers "Famille" (pour l'affichage)
      let category = (expense as any).category || "none";
      if (category === "Personnelle") {
        category = "Famille";
      }
      const currentAmount = categoryMap.get(category) || 0;
      categoryMap.set(category, currentAmount + (expense.amount || 0));
    });
    
    const result: Array<{ name: string; value: number; color: string }> = [];
    
    // Famille (mappé depuis "Personnelle" de l'API)
    const familleAmount = categoryMap.get("Famille") || 0;
    if (familleAmount > 0) {
      result.push({
        name: "Famille",
        value: familleAmount,
        color: "#ec4899",
      });
    }
    
    // Business
    const businessAmount = categoryMap.get("Business") || 0;
    if (businessAmount > 0) {
      result.push({
        name: "Business",
        value: businessAmount,
        color: "#10b981",
      });
    }
    
    return result;
  }, [filteredExpenses]);

  // Vérifier si tous les champs obligatoires sont remplis
  const isFormValid = useMemo(() => {
    const baseValid =
      formData.description.trim() &&
      formData.amount &&
      formData.companyId &&
      formData.date;

    // Pour l'admin, la catégorie est obligatoire
    if (isAdmin) {
      return (
        baseValid &&
        (formData.category === "Business" ||
          formData.category === "Famille")
      );
    }

    return baseValid;
  }, [formData, isAdmin]);

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

  // Synchroniser le scroll entre header et contenu
  // Utiliser useCallback pour mémoriser les handlers et éviter les re-renders
  const handleContentScroll = useCallback((event: any, expenseId?: string) => {
    if (isScrollingRef.current) return; // Éviter les boucles de synchronisation

    const offsetX = event.nativeEvent.contentOffset.x;
    scrollXRef.current = offsetX;
    isScrollingRef.current = true;

    // Synchroniser le header
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollTo({ x: offsetX, animated: false });
    }

    // Synchroniser toutes les autres lignes
    contentScrollRefs.current.forEach((ref, id) => {
      if (id !== expenseId && ref) {
        ref.scrollTo({ x: offsetX, animated: false });
      }
    });

    // Réinitialiser le flag après un court délai
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 100);
  }, []);

  const handleHeaderScroll = useCallback((event: any) => {
    if (isScrollingRef.current) return; // Éviter les boucles de synchronisation

    const offsetX = event.nativeEvent.contentOffset.x;
    scrollXRef.current = offsetX;
    isScrollingRef.current = true;

    // Synchroniser toutes les lignes
    contentScrollRefs.current.forEach((ref) => {
      if (ref) {
        ref.scrollTo({ x: offsetX, animated: false });
      }
    });

    // Réinitialiser le flag après un court délai
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 100);
  }, []);

  // Si l'utilisateur n'a pas la permission de voir, ne pas afficher l'écran
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

  const getValidationStatusColor = (validationStatus?: string) => {
    switch (validationStatus) {
      case "APPROVED":
        return "#10b981";
      case "REJECTED":
        return "#ef4444";
      case "PENDING":
        return "#f59e0b";
      default:
        return "#6b7280";
    }
  };

  const getValidationStatusLabel = (validationStatus?: string) => {
    switch (validationStatus) {
      case "APPROVED":
        return "Approuvé";
      case "REJECTED":
        return "Rejeté";
      case "PENDING":
        return "En attente";
      default:
        return "N/A";
    }
  };

  const getExpenseStatusColor = (status: string) => {
    switch (status) {
      case "INACTIVE":
        return "#6b7280";
      case "CANCELLED":
        return "#ef4444";
      default:
        return "#10b981"; // Par défaut, considérer comme actif
    }
  };

  const getExpenseStatusLabel = (status: string) => {
    switch (status) {
      case "INACTIVE":
        return "Inactif";
      case "CANCELLED":
        return "Annulé";
      default:
        return ""; // Ne pas afficher si actif
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "INCOME":
        return "Entrée";
      case "OUTCOME":
        return "Sortie";
      default:
        return "";
    }
  };

  // Vérifier si un gestionnaire peut agir sur une dépense
  const canManagerActOnExpense = (expense: Expense): boolean => {
    if (!isManager || !userCompanyId) return true; // Si pas gestionnaire, permissions normales
    // Un gestionnaire ne peut agir que sur les dépenses de son entreprise
    return expense.companyId === userCompanyId;
  };

  // Fonction pour cacher les actions pour l'admin (comme dans GesFlow)
  const shouldHideActionsForAdmin = (expense: Expense): boolean => {
    // Si c'est un gestionnaire, toujours afficher les boutons
    if (isManager) {
      return false;
    }

    // Pour l'admin, cacher les boutons modifier/annuler si :
    // 1. Gain Placement (isDatTransfer && type === "INCOME")
    // 2. Emprunt (isLoanInvestment ou loanId)
    // 3. Transaction créée par un gestionnaire (même si en attente de validation)
    const isGainDat =
      (expense as any).isDatTransfer && expense.type === "INCOME";
    const isLoan =
      (expense as any).isLoanInvestment || Boolean((expense as any).loanId);
    const isManagerTransaction =
      (expense as any).createdBy?.role?.name &&
      ((expense as any).createdBy.role.name.toLowerCase() === "gestionnaire" ||
        (expense as any).createdBy.role.name.toLowerCase() === "manager" ||
        (expense as any).createdBy.role.name
          .toLowerCase()
          .includes("gestionnaire") ||
        (expense as any).createdBy.role.name.toLowerCase().includes("manager"));

    return isGainDat || isLoan || Boolean(isManagerTransaction);
  };

  // Même règle que GesFlow : annulation possible si < 25h et pas dans le futur (marge -10 min)
  const canCancelTransaction = (createdAt: string | undefined | null): boolean => {
    if (!createdAt) return false;
    try {
      const now = new Date();
      const created = new Date(createdAt);
      if (isNaN(created.getTime())) return false;
      const diffInMs = now.getTime() - created.getTime();
      const diffInHours = diffInMs / (1000 * 60 * 60);
      return diffInHours < 25 && diffInMs > -600000;
    } catch {
      return false;
    }
  };

  // Vérifier si une dépense peut être modifiée (conditions selon GesFlow)
  const canEditExpense = (expense: Expense): boolean => {
    if (isManagerAccountFrozen) return false;
    if (
      expense.validationStatus === "APPROVED" ||
      expense.validationStatus === "REJECTED"
    )
      return false;
    if (expense.status === "CANCELLED") return false;
    return canCancelTransaction(expense.createdAt);
  };

  // Vérifier si une dépense peut être supprimée (conditions selon GesFlow - pour admins)
  const canDeleteExpense = (expense: Expense): boolean => {
    if (isManagerAccountFrozen) return false;
    if (
      expense.validationStatus === "APPROVED" ||
      expense.validationStatus === "REJECTED"
    )
      return false;
    if (expense.status === "CANCELLED") return false;
    return canCancelTransaction(expense.createdAt);
  };

  // Vérifier si une dépense peut être annulée (conditions selon GesFlow)
  const canCancelExpense = (expense: Expense): boolean => {
    if (isManagerAccountFrozen) return false;
    if (
      expense.validationStatus === "APPROVED" ||
      expense.validationStatus === "REJECTED"
    )
      return false;
    if (expense.status === "CANCELLED") return false;
    // L'admin ne peut pas annuler les transactions des gestionnaires (comme GesFlow)
    const isManagerTransaction = (expense as any).createdBy?.role?.name &&
      ((expense as any).createdBy.role.name.toLowerCase() === "gestionnaire" ||
        (expense as any).createdBy.role.name.toLowerCase() === "manager" ||
        (expense as any).createdBy.role.name?.toLowerCase()?.includes("gestionnaire") ||
        (expense as any).createdBy.role.name?.toLowerCase()?.includes("manager"));
    if (!isManager && isManagerTransaction) return false;
    // Un gestionnaire ne peut annuler que ses propres transactions
    const expenseCreatorId = (expense as any).createdBy?.id;
    if (
      currentUserId &&
      expenseCreatorId &&
      expenseCreatorId !== currentUserId
    )
      return false;
    return canCancelTransaction(expense.createdAt);
  };

  const handleCreate = () => {
    if (isManagerAccountFrozen) {
      Alert.alert(
        "Compte gelé",
        "Votre compte a été gelé. Vous ne pouvez plus effectuer de dépenses. Contactez l'administrateur.",
      );
      return;
    }
    if (!canCreate) {
      return;
    }
    // Réinitialiser le formulaire
    // Pour les managers, pré-remplir avec leur companyId
    const initialCompanyId = isManager && userCompanyId ? userCompanyId : "";
    const initialCompany = companies?.find(
      (c: Company) => c.id === initialCompanyId,
    );

    // Obtenir la date locale au format YYYY-MM-DD
    const getLocalDateString = (): string => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };

    const initialCountryId = initialCompany?.country
      ? typeof initialCompany.country === "string"
        ? initialCompany.country
        : (initialCompany.country as any)?.id || ""
      : "";

    setFormData({
      description: "",
      amount: "",
      currency: initialCompany?.currency || expenses?.[0]?.currency || "GNF",
      type: "OUTCOME",
      companyId: initialCompanyId,
      countryId: initialCountryId,
      date: getLocalDateString(),
      category: isAdmin ? "Business" : "",
    });
    setEditingExpense(null);
    setMobilizedBalance(null);
    setLoadingMobilizedBalance(false);

    // Charger le solde mobilisé si c'est une sortie et qu'une entreprise est sélectionnée
    if (initialCompanyId && initialCompany) {
      loadMobilizedBalance(initialCompanyId, initialCompany.currency || "GNF");
    }

    setShowExpenseForm(true);
  };

  const handleCancelExpense = async (expense: Expense) => {
    // Vérifier si on peut annuler
    if (!canCancelExpense(expense)) {
      Alert.alert(
        "Impossible d'annuler",
        "Cette transaction ne peut pas être annulée. Elle a peut-être déjà été annulée, validée, rejetée, ou plus de 24h se sont écoulées depuis sa création.",
      );
      return;
    }

    // Afficher une confirmation (comme dans GesFlow)
    Alert.alert(
      "Annuler la transaction",
      `Êtes-vous sûr de vouloir annuler cette ${expense.type === "INCOME" ? "entrée" : "sortie"} de ${expense.amount.toLocaleString(
        "fr-FR",
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        },
      )} ${expense.currency || "GNF"} ?\n\nCette action est irréversible et remboursera le solde du gestionnaire si nécessaire.`,
      [
        {
          text: "Non",
          style: "cancel",
        },
        {
          text: "Oui, annuler",
          style: "destructive",
          onPress: async () => {
            if (isCancellingExpense) return;
            try {
              setIsCancellingExpense(true);
              // Appeler l'API DELETE pour annuler la dépense
              await api.delete(`/api/expenses/${expense.id}`, {
                skipAuthError: true,
              });
              await auditService.logAction("expenses.delete", {
                resource: "expense",
                resourceId: expense.id,
                description: `Dépense annulée: ${expense.description || expense.id}`,
              });

              // Recharger les données
              await queryClient.invalidateQueries({ queryKey: ["expenses"] });
              await queryClient.invalidateQueries({
                queryKey: ["expenses", userCompanyId],
              });
              await refetch();
            } catch (error: any) {
              // Afficher un message d'erreur approprié
              Alert.alert("Erreur", getErrorMessage(error, "Impossible d'annuler la transaction"));
            } finally {
              setIsCancellingExpense(false);
            }
          },
        },
      ],
    );
  };

  const handleEdit = async (expense: Expense) => {
    if (!canUpdate) {
      return;
    }
    // Pré-remplir le formulaire avec les données de la dépense
    // Convertir la date en format local YYYY-MM-DD
    const expenseDate = expense.createdAt
      ? new Date(expense.createdAt)
      : new Date();
    const year = expenseDate.getFullYear();
    const month = String(expenseDate.getMonth() + 1).padStart(2, "0");
    const day = String(expenseDate.getDate()).padStart(2, "0");
    const formattedDate = `${year}-${month}-${day}`;

    setFormData({
      description: expense.description || "",
      amount: expense.amount.toString(),
      currency: expense.currency || "GNF",
      type: expense.type,
      companyId: expense.companyId,
      countryId:
        typeof expense.company?.country === "string"
          ? expense.company.country
          : (expense.company?.country as any)?.id || "",
      date: formattedDate,
      // Mapper "Personnelle" (de l'API) vers "Famille" (pour l'affichage dans le formulaire)
      category: (expense as any).category === "Personnelle" 
        ? "Famille" 
        : ((expense as any).category || (isAdmin ? "Business" : "")),
    });
    setEditingExpense(expense);
    setDocuments([]); // Réinitialiser les nouveaux documents

    // Charger les documents existants
    await loadExpenseDocuments(expense.id);

    // Charger le solde mobilisé si c'est une sortie
    if (expense.type === "OUTCOME" && expense.companyId) {
      const company = companies?.find(
        (c: Company) => c.id === expense.companyId,
      );
      if (company) {
        // Ajuster le solde en ajoutant le montant actuel de la dépense (car on va la remplacer)
        loadMobilizedBalance(
          expense.companyId,
          expense.currency || "GNF",
          expense.amount,
        );
      }
    } else {
      setMobilizedBalance(null);
      setLoadingMobilizedBalance(false);
    }

    setShowExpenseForm(true);
  };

  // Fonction pour ouvrir le modal de visualisation (comme dans GesFlow)
  const handleViewExpense = async (expense: Expense) => {
    setExpenseToView(expense);
    setShowViewModal(true);

    // Charger les documents de la dépense
    try {
      const docs = await loadExpenseDocuments(expense.id);
      setViewExpenseDocuments(docs);
    } catch (error) {
      setViewExpenseDocuments([]);
    }
  };

  // Fonction pour ouvrir le modal de validation
  const handleOpenValidation = async (
    expense: Expense,
    action: "approve" | "reject",
  ) => {
    // Fermer d'abord le modal de visualisation
    setShowViewModal(false);
    setExpenseToView(null);

    // Préparer les données pour la validation
    setExpenseToValidate(expense);
    setValidationAction(action);
    setRejectionReason("");

    // Charger les documents de la dépense
    try {
      const docs = await loadExpenseDocuments(expense.id);
      setViewExpenseDocuments(docs);
    } catch (error) {
      setViewExpenseDocuments([]);
    }

    // Ouvrir le modal de validation après un court délai pour laisser le modal de détails se fermer
    setTimeout(() => {
      setShowValidationModal(true);
    }, 300);
  };

  // Fonction pour valider/rejeter une dépense
  const handleValidateExpense = async () => {
    if (!expenseToValidate || !validationAction) return;

    if (validationAction === "reject" && !rejectionReason.trim()) {
      Alert.alert("Erreur", "Veuillez saisir la cause de refus");
      return;
    }

    try {
      setIsValidating(true);
      const response = await api.patch(
        `/api/expenses/${expenseToValidate.id}/validate`,
        {
          action: validationAction,
          ...(validationAction === "reject" && rejectionReason
            ? { rejectionReason }
            : {}),
        },
      );

      setShowValidationModal(false);
      setShowViewModal(false);
      setExpenseToValidate(null);
      setExpenseToView(null);
      setViewExpenseDocuments([]);
      setValidationAction(null);
      setRejectionReason("");

      // Rafraîchir les données
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      // Mettre à jour le nombre de demandes en attente
      await queryClient.invalidateQueries({
        queryKey: ["expenses-pending-count"],
      });
    } catch (error: any) {
      Alert.alert("Erreur", getErrorMessage(error));
    } finally {
      setIsValidating(false);
    }
  };

  // Fonction helper pour ouvrir un document (même logique que SwipeableDocument)
  const openDocument = async (doc: {
    id: string;
    title: string;
    filename: string;
    url: string;
  }) => {
    try {
      // Construire l'URL correctement
      // L'API peut retourner soit une URL complète MinIO, soit un chemin relatif
      let url = doc.url;

      // Si l'URL ne commence pas par http, c'est probablement un chemin relatif
      if (!url || typeof url !== "string") {
        Alert.alert("Erreur", "URL du document invalide ou manquante");
        return;
      }

      // Si l'URL est relative (commence par /api/files/), récupérer l'URL MinIO signée
      // L'endpoint /api/files/ redirige vers MinIO avec l'URL signée
      if (url.startsWith("/api/files/")) {
        try {
          // Faire une requête GET qui suivra automatiquement les redirections
          // pour obtenir l'URL MinIO signée finale
          const apiUrl = `${api.defaults.baseURL}${url}`;
          const response = await api.get(url, {
            skipAuthError: true,
            maxRedirects: 5, // Suivre les redirections
            validateStatus: () => true, // Accepter tous les codes de statut
          });

          // Si on a une URL de redirection (après avoir suivi les redirections), l'utiliser
          if (
            response.request?.responseURL &&
            response.request.responseURL !== apiUrl
          ) {
            url = response.request.responseURL;
          } else if (response.status >= 300 && response.status < 400) {
            // Si c'est une redirection, récupérer l'URL depuis le header Location
            const location =
              response.headers.location ||
              response.headers.Location ||
              response.headers["location"] ||
              response.headers["Location"];
            if (location) {
              url = location;
            } else {
              // Pas de Location, utiliser l'URL de l'API qui redirigera
              url = apiUrl;
            }
          } else {
            // Si erreur, utiliser quand même l'URL de l'API
            // Le navigateur/FileSystem suivra la redirection automatiquement
            url = apiUrl;
          }
        } catch (apiError: any) {
          // En cas d'erreur, utiliser l'URL de l'API
          // Le navigateur/FileSystem suivra la redirection automatiquement
          url = `${api.defaults.baseURL}${url}`;
        }
      } else if (!url.startsWith("http")) {
        // Si c'est un chemin relatif sans /api/files/, essayer de construire l'URL MinIO
        // Format attendu: users/.../expenses/...
        if (url.includes("users/")) {
          const usersIndex = url.indexOf("users/");
          const cleanUrl = url.substring(usersIndex);
          // Construire l'URL MinIO directement (comme dans GesFlow)
          url = `${api.defaults.baseURL}/api/files/${encodeURIComponent(cleanUrl)}`;
        } else {
          Alert.alert("Erreur", "Format d'URL du document non reconnu");
          return;
        }
      }

      // Vérifier que l'URL est maintenant valide
      if (!url.startsWith("http")) {
        Alert.alert(
          "Erreur",
          "Impossible de construire une URL valide pour le document",
        );
        return;
      }

      // Ouvrir directement l'URL dans le navigateur/visualiseur
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Erreur", "Impossible d'ouvrir le document");
      }
    } catch (error: any) {
      Alert.alert("Erreur", getErrorMessage(error, "Impossible d'ouvrir le document"));
    }
  };

  // Fonction pour charger le solde mobilisé
  const loadMobilizedBalance = async (
    companyId: string,
    currency: string,
    currentExpenseAmount?: number,
  ) => {
    try {
      setLoadingMobilizedBalance(true);
      const response = await api.get(
        `/api/dashboard/company-stats?companyId=${companyId}`,
        {
          skipAuthError: true, // Ne pas déconnecter l'utilisateur si erreur 401 (requête optionnelle)
        },
      );
      const balance = {
        amount:
          (response.data?.kpis?.mobilizedBalance || 0) +
          (currentExpenseAmount || 0),
        currency: response.data?.company?.currency || currency || "GNF",
      };
      setMobilizedBalance(balance);
    } catch (error: any) {
      // Si c'est une erreur 401, on ignore silencieusement (requête optionnelle)
      if (error.response?.status === 401) {
        // Erreur 401 ignorée silencieusement
      } else {
        // Erreur silencieuse
      }
      setMobilizedBalance(null);
    } finally {
      setLoadingMobilizedBalance(false);
    }
  };

  // Fonction pour sélectionner des documents
  const handleAddDocument = async () => {
    if (isAddingDocument) return; // Empêcher les doubles sélections

    try {
      setIsAddingDocument(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets) {
        const newDocuments = result.assets.map((asset: any) => ({
          file: asset,
          title: asset.name || "Document",
          id: asset.uri + Date.now(),
        }));
        setDocuments([...documents, ...newDocuments]);
      }
    } catch (error: any) {
      // Si expo-document-picker n'est pas installé, afficher un message
      if (
        error.message?.includes("Cannot find module") ||
        error.code === "MODULE_NOT_FOUND"
      ) {
        Alert.alert(
          "Package manquant",
          "Veuillez installer expo-document-picker: npm install expo-document-picker",
        );
      } else {
        // Erreur silencieuse
      }
    } finally {
      setIsAddingDocument(false);
    }
  };

  // Fonction pour charger les documents d'une dépense
  const loadExpenseDocuments = async (expenseId: string) => {
    try {
      const response = await api.get(`/api/expenses/${expenseId}/documents`, {
        skipAuthError: true,
      });

      if (response.data && Array.isArray(response.data)) {
        setExpenseDocuments(response.data);
        return response.data;
      } else {
        setExpenseDocuments([]);
        return [];
      }
    } catch (error: any) {
      // Si c'est une erreur 401, c'est probablement un problème de permissions
      if (error.response?.status === 401) {
        // Erreur 401 ignorée silencieusement
      } else {
        // Erreur silencieuse
      }
      setExpenseDocuments([]);
      return [];
    }
  };

  // Fonction pour uploader les documents
  const uploadDocuments = async (expenseId: string) => {
    if (documents.length === 0) return;

    // Toujours renouveler le token avant l'upload pour s'assurer qu'il est frais
    try {
      await authService.refreshToken();
    } catch (tokenError) {
      // Continuation avec le token actuel
    }

    const uploadedCount = 0;
    for (const doc of documents) {
      try {
        const formData = new FormData();
        // Pour React Native, on doit utiliser l'URI du fichier
        formData.append("file", {
          uri: doc.file.uri,
          type: doc.file.mimeType || "application/octet-stream",
          name: doc.file.name || "document",
        } as any);
        formData.append("title", doc.title || doc.file.name || "Document");
        formData.append("type", "expenses");

        const uploadResponse = await api.post("/api/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          skipAuthError: true, // Ne pas déconnecter l'utilisateur en cas d'erreur 401 (peut être dû à rate limiting ou permissions)
        });

        if (uploadResponse.data) {
          const uploadData = uploadResponse.data;

          // Vérifier si le document existe déjà avant de le créer (comme dans GesFlow)
          try {
            const existingDocsResponse = await api.get(
              `/api/expenses/${expenseId}/documents`,
              { skipAuthError: true },
            );

            if (
              existingDocsResponse.data &&
              Array.isArray(existingDocsResponse.data)
            ) {
              const existingDocs = existingDocsResponse.data;
              // Construire l'URL comme dans GesFlow
              const uploadUrl = uploadData.objectName
                ? `/api/files/${encodeURIComponent(uploadData.objectName)}`
                : uploadData.url;

              const alreadyExists = existingDocs.some((existingDoc: any) => {
                // Vérifier si le filename ET l'url correspondent (pour détecter les vrais doublons)
                const sameFilename =
                  existingDoc.filename ===
                  (uploadData.filename || doc.file.name);
                const sameUrl = existingDoc.url === uploadUrl;
                return sameFilename && sameUrl;
              });

              if (alreadyExists) {
                continue; // Passer au document suivant
              }
            }
          } catch (checkError: any) {
            // Continuation silencieuse
          }

          // Renouveler le token avant la création de l'entrée en base
          try {
            await authService.refreshToken();
          } catch (tokenError) {
            // Continuation avec le token actuel
          }

          // Créer l'entrée du document dans la base de données
          // Utiliser exactement la même structure que GesFlow
          const documentData = {
            title: doc.title || uploadData.filename,
            filename: uploadData.filename || doc.file.name,
            url: uploadData.url, // Pour compatibilité avec anciens fichiers
            objectName: uploadData.objectName, // Nom de l'objet MinIO
            fileType: doc.file.mimeType || doc.file.type, // Utiliser mimeType ou type
            fileSize: doc.file.size,
          };

          try {
            // Utiliser exactement la même structure que GesFlow
            const createResponse = await api.post(
              `/api/expenses/${expenseId}/documents`,
              documentData,
              {
                headers: {
                  "Content-Type": "application/json",
                },
                skipAuthError: true, // Ne pas déconnecter l'utilisateur en cas d'erreur 401
              },
            );

            // Recharger les documents après création réussie si on est en mode édition
            if (editingExpense && editingExpense.id === expenseId) {
              await loadExpenseDocuments(expenseId);
            }
          } catch (createError: any) {
            // Afficher un message d'erreur à l'utilisateur
            Alert.alert(
              "Attention",
              `Le fichier "${doc.title || doc.file.name}" a été uploadé dans MinIO mais n'a pas pu être associé à la dépense. L'erreur est : ${createError.response?.data?.error || createError.message}. Veuillez contacter l'administrateur.`,
              [{ text: "OK" }],
            );

            // Ne pas bloquer l'upload des autres documents
            continue;
          }
        }
      } catch (error: any) {
        // Si c'est une erreur 401, essayer de renouveler le token et réessayer une fois
        if (error.response?.status === 401) {
          try {
            // Renouveler le token
            await authService.refreshToken();

            // Réessayer la requête qui a échoué
            if (error.config?.url?.includes("/api/upload")) {
              // Réessayer l'upload du fichier
              const formData = new FormData();
              formData.append("file", {
                uri: doc.file.uri,
                type: doc.file.mimeType || "application/octet-stream",
                name: doc.file.name || "document",
              } as any);
              formData.append(
                "title",
                doc.title || doc.file.name || "Document",
              );
              formData.append("type", "expenses");

              const retryUploadResponse = await api.post(
                "/api/upload",
                formData,
                {
                  headers: {
                    "Content-Type": "multipart/form-data",
                  },
                  skipAuthError: true,
                },
              );

              if (retryUploadResponse.data) {
                const retryUploadData = retryUploadResponse.data;

                // Vérifier si le document existe déjà avant de le créer (comme dans GesFlow)
                try {
                  const existingDocsResponse = await api.get(
                    `/api/expenses/${expenseId}/documents`,
                    { skipAuthError: true },
                  );

                  if (
                    existingDocsResponse.data &&
                    Array.isArray(existingDocsResponse.data)
                  ) {
                    const existingDocs = existingDocsResponse.data;
                    const uploadUrl = retryUploadData.objectName
                      ? `/api/files/${encodeURIComponent(retryUploadData.objectName)}`
                      : retryUploadData.url;

                    const alreadyExists = existingDocs.some(
                      (existingDoc: any) => {
                        const sameFilename =
                          existingDoc.filename ===
                          (retryUploadData.filename || doc.file.name);
                        const sameUrl = existingDoc.url === uploadUrl;
                        return sameFilename && sameUrl;
                      },
                    );

                    if (alreadyExists) {
                      continue;
                    }
                  }
                } catch (checkError: any) {
                  // Continuation silencieuse
                }

                // Créer l'entrée en base
                try {
                  const documentData = {
                    title: doc.title || retryUploadData.filename,
                    filename: retryUploadData.filename || doc.file.name,
                    url: retryUploadData.url, // Pour compatibilité avec anciens fichiers
                    objectName: retryUploadData.objectName, // Nom de l'objet MinIO
                    fileType: doc.file.mimeType || doc.file.type,
                    fileSize: doc.file.size,
                  };

                  await api.post(
                    `/api/expenses/${expenseId}/documents`,
                    documentData,
                    {
                      headers: {
                        "Content-Type": "application/json",
                      },
                      skipAuthError: true,
                    },
                  );

                  // Recharger les documents après création réussie si on est en mode édition
                  if (editingExpense && editingExpense.id === expenseId) {
                    await loadExpenseDocuments(expenseId);
                  }
                } catch (createError: any) {
                  Alert.alert(
                    "Attention",
                    `Le fichier "${doc.title || doc.file.name}" a été uploadé dans MinIO mais n'a pas pu être associé à la dépense. L'erreur est : ${createError.response?.data?.error || createError.message}. Veuillez contacter l'administrateur.`,
                    [{ text: "OK" }],
                  );
                }

                continue; // Passer au document suivant
              }
            } else if (error.config?.url?.includes("/documents")) {
              // Réessayer la création de l'entrée en base
              // On ne peut pas réessayer directement car on n'a pas les données de l'upload
              // Il faudrait les stocker, mais pour simplifier, on affiche juste l'erreur
            }
          } catch (retryError: any) {
            Alert.alert(
              "Erreur d'upload",
              `Impossible d'uploader "${doc.title || doc.file.name}". Vérifiez vos permissions ou réessayez plus tard.`,
            );
          }
        } else {
          Alert.alert(
            "Erreur d'upload",
            `Une erreur s'est produite lors de l'upload de "${doc.title || doc.file.name}".`,
          );
        }
      }
    }
  };

  const handleSubmitExpense = async () => {
    if (isSubmitting || !isFormValid) return; // Empêcher les doubles soumissions

    try {
      setIsSubmitting(true);

      // Validation
      if (
        !formData.description ||
        !formData.amount ||
        !formData.companyId ||
        !formData.date ||
        (isAdmin && !formData.category)
      ) {
        Alert.alert(
          "Champs obligatoires",
          "Veuillez remplir tous les champs obligatoires marqués d'un astérisque (*).",
        );
        setIsSubmitting(false);
        return;
      }

      // Validation du format du montant
      const amount = parseFloat(formData.amount);
      if (isNaN(amount) || amount <= 0) {
        Alert.alert(
          "Erreur de validation",
          "Le montant doit être un nombre positif.",
        );
        setIsSubmitting(false);
        return;
      }

      // Validation du format de la date (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(formData.date)) {
        Alert.alert(
          "Erreur de validation",
          "Le format de la date est invalide. Utilisez le format YYYY-MM-DD (ex: 2024-01-25).",
        );
        setIsSubmitting(false);
        return;
      }

      // Pour les managers, récupérer le countryId depuis l'entreprise
      let finalCountryId = formData.countryId;
      if (isManager && userCompanyId && !finalCountryId) {
        const company = companies?.find((c: Company) => c.id === userCompanyId);
        // company.country peut être un objet avec id ou une string selon l'API
        if (company?.country) {
          finalCountryId =
            typeof company.country === "string"
              ? company.country
              : (company.country as any)?.id || company.country;
        }
      }

      // Pour les admins, vérifier que countryId est défini
      if (!isManager && !finalCountryId) {
        const company = companies?.find(
          (c: Company) => c.id === formData.companyId,
        );
        // company.country peut être un objet avec id ou une string selon l'API
        if (company?.country) {
          finalCountryId =
            typeof company.country === "string"
              ? company.country
              : (company.country as any)?.id || company.country;
        }
      }

      if (!finalCountryId) {
        Alert.alert(
          "Erreur",
          "Le pays de l'entreprise est requis. Veuillez sélectionner une entreprise valide.",
        );
        setIsSubmitting(false);
        return;
      }

      // S'assurer que finalCountryId est une string
      finalCountryId = String(finalCountryId);

      // Vérifier le solde mobilisé pour les sorties
      if (formData.type === "OUTCOME" && mobilizedBalance) {
        const amount = parseFloat(formData.amount);
        if (amount > mobilizedBalance.amount) {
          // On peut quand même soumettre
        }
      }

      let expenseId: string;

      if (editingExpense) {
        // Mise à jour - envoyer tous les champs nécessaires
        const updatePayload: any = {
          description: formData.description.trim(),
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          type: formData.type,
          companyId: formData.companyId,
          countryId: finalCountryId,
          date: formData.date,
          exchangeRate: null,
        };

        // Pour l'admin, category est obligatoire (Business par défaut)
        // Mapper "Famille" vers "Personnelle" pour l'API backend
        if (isAdmin) {
          const categoryValue = formData.category || "Business";
          updatePayload.category = categoryValue === "Famille" ? "Personnelle" : categoryValue;
        } else if (formData.category) {
          updatePayload.category = formData.category === "Famille" ? "Personnelle" : formData.category;
        }

        const response = await api.put(
          `/api/expenses/${editingExpense.id}`,
          updatePayload,
        );
        expenseId = editingExpense.id;
        await auditService.logAction("expenses.update", {
          resource: "expense",
          resourceId: expenseId,
          description: `Dépense modifiée: ${updatePayload.description || expenseId}`,
        });
      } else {
        // Création - envoyer tous les champs requis
        const createPayload: any = {
          description: formData.description.trim(),
          amount: parseFloat(formData.amount),
          currency: formData.currency,
          type: formData.type,
          companyId: formData.companyId,
          countryId: finalCountryId,
          date: formData.date,
          exchangeRate: null,
        };

        // Pour l'admin, category est obligatoire (Business par défaut)
        // Mapper "Famille" vers "Personnelle" pour l'API backend (l'API n'accepte que "Personnelle" ou "Business")
        if (isAdmin) {
          const categoryValue = formData.category || "Business";
          createPayload.category = categoryValue === "Famille" ? "Personnelle" : categoryValue;
        } else if (formData.category) {
          createPayload.category = formData.category === "Famille" ? "Personnelle" : formData.category;
        }

        const response = await api.post("/api/expenses", createPayload);
        expenseId = response.data.id;
      }

      // Upload des documents si présents
      if (documents.length > 0 && expenseId) {
        try {
          await uploadDocuments(expenseId);
          setDocuments([]); // Vider la liste après l'upload

          // Si on est en mode édition, recharger les documents pour les afficher
          // (même si le drawer va se fermer, cela garantit que les documents sont à jour)
          if (editingExpense && editingExpense.id === expenseId) {
            await loadExpenseDocuments(expenseId);
          }
        } catch (error: any) {
          Alert.alert(
            "Attention",
            `La dépense a été créée mais certains documents n'ont pas pu être uploadés. ${getErrorMessage(error, "")}`,
          );
        }
      }

      // Fermer le formulaire et rafraîchir les données
      setShowExpenseForm(false);
      setEditingExpense(null);
      setMobilizedBalance(null);
      setDocuments([]);
      setExpenseDocuments([]);

      // Invalider et rafraîchir les queries
      await refetch();
      // Invalider les queries du dashboard pour qu'elles se mettent à jour
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error: any) {
      // Calculer finalCountryId pour le logging si nécessaire
      let loggedCountryId = formData.countryId;
      try {
        if (isManager && userCompanyId && !loggedCountryId) {
          const company = companies?.find((c: Company) => c.id === userCompanyId);
          if (company?.country) {
            loggedCountryId =
              typeof company.country === "string"
                ? company.country
                : (company.country as any)?.id || company.country;
          }
        } else if (!isManager && !loggedCountryId) {
          const company = companies?.find(
            (c: Company) => c.id === formData.companyId,
          );
          if (company?.country) {
            loggedCountryId =
              typeof company.country === "string"
                ? company.country
                : (company.country as any)?.id || company.country;
          }
        }
      } catch (e) {
        // Ignorer les erreurs de calcul pour le logging
      }
      
      let errorMessage = "Une erreur est survenue lors de la création de la dépense.";
      
      if (error.response?.status === 400) {
        // Erreur de validation
        const errorData = error.response?.data;
        if (errorData?.error) {
          errorMessage = errorData.error;
        } else if (errorData?.message) {
          errorMessage = errorData.message;
        } else if (Array.isArray(errorData)) {
          // Erreurs de validation multiples
          errorMessage = errorData.map((err: any) => err.message || err).join("\n");
        } else {
          errorMessage = "Les données envoyées sont invalides. Veuillez vérifier tous les champs.";
        }
      } else if (error.response?.status === 401) {
        errorMessage = "Vous n'êtes pas autorisé à effectuer cette action.";
      } else if (error.response?.status === 403) {
        errorMessage = "Vous n'avez pas les permissions nécessaires.";
      } else if (error.response?.status === 404) {
        errorMessage = "La ressource demandée n'a pas été trouvée.";
      } else if (error.response?.status >= 500) {
        errorMessage = "Une erreur serveur est survenue. Veuillez réessayer plus tard.";
      } else {
        errorMessage = getErrorMessage(error, errorMessage);
      }
      
      Alert.alert("Erreur", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleExportExcel = async () => {
    if (isExporting) return; // Empêcher les doubles exports

    try {
      setIsExporting(true);

      // Utiliser les données déjà filtrées
      if (!filteredExpenses || filteredExpenses.length === 0) {
        Alert.alert(
          "Aucune donnée",
          "Il n'y a aucune dépense à exporter avec les filtres actuels.",
        );
        return;
      }

      // Préparer les données pour l'export (format similaire à gesflow)
      const exportData = filteredExpenses.map((expense: Expense) => {
        const statusMap: { [key: string]: string } = {
          PENDING: "En attente",
          APPROVED: "Approuvé",
          REJECTED: "Rejeté",
        };

        const typeMap: { [key: string]: string } = {
          INCOME: "Entrée",
          OUTCOME: "Sortie",
        };

        // Formater le montant
        const formatAmount = (amount: number, currency: string) => {
          return `${amount.toLocaleString("fr-FR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} ${currency}`;
        };

        // Formater la date
        const formatDate = (dateString: string) => {
          const date = new Date(dateString);
          const day = String(date.getDate()).padStart(2, "0");
          const month = String(date.getMonth() + 1).padStart(2, "0");
          const year = date.getFullYear();
          return `${day}/${month}/${year}`;
        };

        return {
          Entreprise: expense.company?.name || "N/A",
          Pays:
            typeof expense.company?.country === "object"
              ? expense.company.country.name
              : expense.company?.country || "N/A",
          Type: typeMap[expense.type] || expense.type,
          Montant: formatAmount(expense.amount, expense.currency),
          Devise: expense.currency,
          Description: expense.description || "",
          Date: formatDate((expense as any).date || expense.createdAt),
          Statut: expense.validationStatus
            ? statusMap[expense.validationStatus] || expense.validationStatus
            : "N/A",
          Catégorie: (expense as any).category === "Personnelle" ? "Famille" : ((expense as any).category || ""),
        };
      });

      // Créer un fichier Excel avec exceljs (sécurisé)
      try {
        let fileContent: string;
        let filename: string;
        let mimeType: string;
        let useExcel = false;

        try {
          fileContent = await writeExcelFromJson(exportData, "Dépenses");
          filename = `depenses_${new Date().toISOString().split("T")[0]}.xlsx`;
          mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
          useExcel = true;
        } catch (e) {
          // Fallback CSV
          const headers = Object.keys(exportData[0]);
          const csvRows = [
            headers.join(","), // En-têtes
            ...exportData.map((row: any) =>
              headers
                .map((header) => {
                  const value = row[header as keyof typeof row];
                  // Échapper les valeurs contenant des virgules ou guillemets
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
          filename = `depenses_${new Date().toISOString().split("T")[0]}.csv`;
          mimeType = "text/csv";
        }

        // Utiliser la même logique que getDocumentDirectory() pour trouver le répertoire
        let directory = getDocumentDirectory();

        // Si getDocumentDirectory() ne trouve pas de répertoire, essayer d'utiliser FileSystem.Directory
        if (!directory) {
          try {
            const Directory = (FileSystem as any).Directory;
            if (Directory) {
              // Essayer d'obtenir le répertoire de cache via Directory (peut être une méthode async ou une propriété)
              if (typeof Directory.cacheDirectory === "function") {
                const cacheDir = await Directory.cacheDirectory();
                if (cacheDir && typeof cacheDir === "string") {
                  directory = cacheDir;
                }
              } else if (typeof Directory.cacheDirectory === "string") {
                directory = Directory.cacheDirectory;
              } else if (Directory.cacheDirectory) {
                // Peut-être un objet avec une propriété path ou uri
                directory =
                  Directory.cacheDirectory.path ||
                  Directory.cacheDirectory.uri ||
                  Directory.cacheDirectory;
                if (directory && typeof directory === "string") {
                  // Directory trouvé
                }
              }
            }
          } catch (e) {
            // Erreur silencieuse
          }
        }

        // Utiliser l'API legacy pour writeAsStringAsync (évite les avertissements de dépréciation)
        let writeFn: any = null;

        if (FileSystemLegacy && FileSystemLegacy.writeAsStringAsync) {
          writeFn = FileSystemLegacy.writeAsStringAsync;
        } else {
          // Fallback : chercher dans FileSystem standard (déprécié mais fonctionne)
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
        // FileSystem.writeAsStringAsync peut résoudre automatiquement les chemins relatifs dans le cache
        if (!directory) {
          // Utiliser juste le filename - FileSystem le résoudra dans le cache ou le répertoire de documents
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
    status: 120,
    description: 200,
    manager: managers && managers.length > 0 ? 130 : 0,
    amount: 140, // Augmenté de 130 à 140 pour éviter que les montants deviennent trop petits
    actions: 100, // Sticky à droite
  };

  const totalTableWidth = Object.values(columnWidths).reduce(
    (sum, width) => sum + width,
    0,
  );

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-[#0f172a]" : "bg-white"}`}
      edges={["top", "bottom"]}
    >
      <Header />
      <View className="flex-1">
        <View className="px-6 pt-20 pb-4">
          {/* Barre de recherche, filtre et bouton créer sur la même ligne */}
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
                typeFilter !== "ALL" ||
                statusFilter !== "ALL" ||
                startDate ||
                endDate ||
                minAmount ||
                maxAmount
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
                  typeFilter !== "ALL" ||
                  statusFilter !== "ALL" ||
                  startDate ||
                  endDate ||
                  minAmount ||
                  maxAmount
                    ? "#ffffff"
                    : isDark
                      ? "#9ca3af"
                      : "#6b7280"
                }
              />
              {(typeFilter !== "ALL" ? 1 : 0) +
                (statusFilter !== "ALL" ? 1 : 0) +
                (startDate ? 1 : 0) +
                (endDate ? 1 : 0) +
                (minAmount ? 1 : 0) +
                (maxAmount ? 1 : 0) >
                0 && (
                <View
                  className="px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(255, 255, 255, 0.2)" }}
                >
                  <Text className="text-white text-xs font-semibold">
                    {(typeFilter !== "ALL" ? 1 : 0) +
                      (statusFilter !== "ALL" ? 1 : 0) +
                      (startDate ? 1 : 0) +
                      (endDate ? 1 : 0) +
                      (minAmount ? 1 : 0) +
                      (maxAmount ? 1 : 0)}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Bouton export Excel */}
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
                style={{
                  backgroundColor: isManagerAccountFrozen ? (isDark ? "#475569" : "#94a3b8") : CHART_COLOR,
                  opacity: isManagerAccountFrozen ? 0.8 : 1,
                }}
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

        {/* Bannière compte gelé : montant = ce que le gestionnaire récupérera au dégel */}
        {isManagerAccountFrozen && (
          <View
            className="mx-4 mt-4 mb-4 px-4 py-3 rounded-xl flex-row items-center gap-3"
            style={{
              backgroundColor: isDark ? "rgba(245, 158, 11, 0.15)" : "#fffbeb",
              borderWidth: 1,
              borderColor: isDark ? "#d97706" : "#fcd34d",
            }}
          >
            <HugeiconsIcon
              icon={AlertDiamondIcon}
              size={22}
              color={isDark ? "#fbbf24" : "#d97706"}
            />
            <Text
              className="flex-1 text-sm"
              style={{ color: isDark ? "#fcd34d" : "#92400e" }}
            >
              Votre compte est gelé. Montant que vous récupérerez au dégel :{" "}
              <Text className="font-semibold">
                {formatAmountUtil(frozenAmount ?? 0, frozenCurrency, isAmountVisible)}
              </Text>
              . Vous ne pouvez pas effectuer de nouvelles dépenses.
            </Text>
          </View>
        )}

        {/* Table avec scroll horizontal synchronisé */}
        {isLoading || !expenses ? (
          <ExpensesSkeleton />
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

                  {/* Statut */}
                  <View
                    style={{ width: columnWidths.status }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Statut
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

                  {/* Gestionnaire */}
                  {managers && managers.length > 0 && (
                    <View
                      style={{ width: columnWidths.manager }}
                      className="px-3 py-3"
                    >
                      <Text
                        className={`text-xs font-semibold uppercase ${
                          isDark ? "text-gray-400" : "text-gray-500"
                        }`}
                      >
                        Gestionnaire
                      </Text>
                    </View>
                  )}

                  {/* Montant */}
                  <View
                    style={{ width: columnWidths.amount }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                      numberOfLines={1}
                    >
                      Montant
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

            {/* Liste des dépenses avec scroll synchronisé */}
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
              {filteredExpenses.length === 0 ? (
                <View className="items-center justify-center py-12 px-6">
                  <Text
                    className={`text-center text-sm ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    {searchTerm ||
                    typeFilter !== "ALL" ||
                    statusFilter !== "ALL" ||
                    startDate ||
                    endDate ||
                    minAmount ||
                    maxAmount
                      ? "Aucune dépense trouvée"
                      : "Aucune dépense disponible"}
                  </Text>
                </View>
              ) : (
                filteredExpenses.map((expense: Expense) => {
                  // Vérifier si c'est une dépense de type placement, investissement ou emprunt
                  const isGainDat =
                    expense.isDatTransfer && expense.type === "INCOME";
                  const isDatTransfer =
                    expense.isDatTransfer && expense.type !== "INCOME";
                  const isLoanInvestment = expense.isLoanInvestment;
                  // Les dépenses de paiement d'échéance (avec loanId et type OUTCOME, mais pas isLoanInvestment) ne doivent pas avoir d'actions
                  const isInstallmentPayment =
                    Boolean(expense.loanId) &&
                    expense.type === "OUTCOME" &&
                    !expense.isLoanInvestment;
                  // Vérifier aussi par description au cas où loanId n'est pas défini (pour les anciennes dépenses)
                  const isInstallmentPaymentByDescription =
                    expense.description
                      ?.toLowerCase()
                      .includes("paiement échéance") &&
                    expense.type === "OUTCOME";
                  const isLoan =
                    isLoanInvestment ||
                    (Boolean(expense.loanId) &&
                      !isInstallmentPayment &&
                      !isInstallmentPaymentByDescription);
                  // Dépenses système gel/dégel de compte gestionnaire (comme GesFlow : pas d'actions)
                  const isFreezeExpense =
                    expense.type === "INCOME" &&
                    expense.description?.includes("Retour solde gestionnaire (gel du compte)");
                  const isUnfreezeExpense =
                    expense.type === "OUTCOME" &&
                    expense.description?.includes("Dégel - retour au gestionnaire");
                  const isFreezeUnfreezeExpense = isFreezeExpense || isUnfreezeExpense;
                  // Paiement d'emprunt (description) : pas de bouton Valider comme GesFlow
                  const isLoanPayment =
                    Boolean((expense as any).loanId) ||
                    Boolean((expense as any).isLoanInvestment) ||
                    expense.description?.toLowerCase().includes("paiement échéance") ||
                    expense.description?.toLowerCase().includes("échéance");
                  const shouldHideAllActions =
                    isGainDat ||
                    isDatTransfer ||
                    isLoan ||
                    isInstallmentPayment ||
                    isInstallmentPaymentByDescription ||
                    isFreezeUnfreezeExpense;

                  // Calculer les actions disponibles
                  const shouldHideActions = shouldHideActionsForAdmin(expense);
                  const hasEditAction =
                    !shouldHideAllActions &&
                    !shouldHideActions &&
                    canUpdate &&
                    canManagerActOnExpense(expense) &&
                    canEditExpense(expense);
                  // Le bouton cancel doit être disponible pour tous si la transaction peut être annulée
                  const hasCancelAction =
                    !shouldHideAllActions &&
                    canManagerActOnExpense(expense) &&
                    canCancelExpense(expense);
                  // Bouton View pour les admins - afficher pour les dépenses en attente (comme GesFlow, pas pour paiement emprunt)
                  const hasViewAction =
                    !shouldHideAllActions &&
                    !isManager &&
                    canUpdate &&
                    expense.validationStatus === "PENDING" &&
                    expense.type === "OUTCOME" &&
                    expense.status !== "CANCELLED" &&
                    !isLoanPayment;
                  const hasAnyAction =
                    hasEditAction || hasCancelAction || hasViewAction;

                  // Compter le nombre d'actions pour ajuster la taille des boutons
                  const actionCount = [
                    hasEditAction,
                    hasCancelAction,
                    hasViewAction,
                  ].filter(Boolean).length;

                  // Style spécial pour les dépenses en attente (comme dans GesFlow)
                  const isPendingForAdmin =
                    !isManager &&
                    expense.validationStatus === "PENDING" &&
                    expense.status !== "CANCELLED" &&
                    expense.type === "OUTCOME";

                  return (
                    <PendingExpenseRowWrapper
                      key={expense.id}
                      expenseId={expense.id}
                      isPending={isPendingForAdmin}
                      isDark={isDark}
                    >
                      <View
                        className={`border-b ${
                          isDark
                            ? isPendingForAdmin
                              ? "border-gray-800 bg-yellow-900/10"
                              : "border-gray-800 bg-[#0f172a]"
                            : isPendingForAdmin
                              ? "border-gray-100 bg-yellow-50/50"
                              : "border-gray-100 bg-white"
                        }`}
                        style={{
                          position: "relative",
                        }}
                      >
                        {/* Contenu scrollable */}
                        <ScrollView
                          nestedScrollEnabled={true}
                          ref={(ref) => {
                            if (ref) {
                              contentScrollRefs.current.set(expense.id, ref);
                              // Synchroniser avec la position actuelle (utiliser ref au lieu de state)
                              if (scrollXRef.current > 0) {
                                // Utiliser requestAnimationFrame pour éviter les problèmes de timing
                                requestAnimationFrame(() => {
                                  ref.scrollTo({
                                    x: scrollXRef.current,
                                    animated: false,
                                  });
                                });
                              }
                            } else {
                              contentScrollRefs.current.delete(expense.id);
                            }
                          }}
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          onScroll={(e) => handleContentScroll(e, expense.id)}
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
                                {new Date(expense.createdAt).toLocaleDateString(
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
                              {expense.company?.name ? (
                                <View
                                  className="px-2 py-1 rounded-full self-start"
                                  style={{
                                    backgroundColor: isDark
                                      ? "rgba(59, 130, 246, 0.2)"
                                      : "#dbeafe",
                                    borderWidth: 1,
                                    borderColor: isDark ? "#3b82f6" : "#93c5fd",
                                  }}
                                >
                                  <Text
                                    className="text-xs font-medium"
                                    style={{
                                      color: isDark ? "#93c5fd" : "#2563eb",
                                    }}
                                    numberOfLines={1}
                                  >
                                    {expense.company.name}
                                  </Text>
                                </View>
                              ) : (
                                <Text
                                  className={`text-xs ${
                                    isDark ? "text-gray-400" : "text-gray-600"
                                  }`}
                                >
                                  N/A
                                </Text>
                              )}
                            </View>

                            {/* Statut */}
                            <View
                              style={{ width: columnWidths.status }}
                              className="px-3 py-4 justify-center"
                            >
                              <View className="flex-row gap-1 flex-wrap">
                                {/* Type (Entrée/Sortie) */}
                                <View
                                  className="px-2 py-1 rounded-full self-start"
                                  style={{
                                    backgroundColor:
                                      expense.type === "INCOME"
                                        ? "#10b98120"
                                        : "#ef444420",
                                  }}
                                >
                                  <Text
                                    className="text-xs font-medium"
                                    style={{
                                      color:
                                        expense.type === "INCOME"
                                          ? "#10b981"
                                          : "#ef4444",
                                    }}
                                  >
                                    {getTypeLabel(expense.type)}
                                  </Text>
                                </View>

                                {/* Gain Placement */}
                                {expense.isDatTransfer &&
                                  expense.type === "INCOME" && (
                                    <View
                                      className="px-2 py-1 rounded-full self-start"
                                      style={{
                                        backgroundColor: isDark
                                          ? "rgba(168, 85, 247, 0.2)"
                                          : "#f3e8ff",
                                        borderWidth: 1,
                                        borderColor: isDark
                                          ? "#a855f7"
                                          : "#c084fc",
                                      }}
                                    >
                                      <Text
                                        className="text-xs font-medium"
                                        style={{
                                          color: isDark ? "#c084fc" : "#9333ea",
                                        }}
                                      >
                                        Gain Placement
                                      </Text>
                                    </View>
                                  )}

                                {/* Transfert Placement */}
                                {expense.isDatTransfer &&
                                  expense.type !== "INCOME" && (
                                    <View
                                      className="px-2 py-1 rounded-full self-start"
                                      style={{
                                        backgroundColor: isDark
                                          ? "rgba(59, 130, 246, 0.2)"
                                          : "#dbeafe",
                                        borderWidth: 1,
                                        borderColor: isDark
                                          ? "#3b82f6"
                                          : "#93c5fd",
                                      }}
                                    >
                                      <Text
                                        className="text-xs font-medium"
                                        style={{
                                          color: isDark ? "#93c5fd" : "#2563eb",
                                        }}
                                      >
                                        Transfert Placement
                                      </Text>
                                    </View>
                                  )}

                                {/* Emprunt */}
                                {expense.isLoanInvestment && (
                                  <View
                                    className="px-2 py-1 rounded-full self-start"
                                    style={{
                                      backgroundColor: isDark
                                        ? "rgba(249, 115, 22, 0.2)"
                                        : "#fed7aa",
                                      borderWidth: 1,
                                      borderColor: isDark
                                        ? "#f97316"
                                        : "#fb923c",
                                    }}
                                  >
                                    <Text
                                      className="text-xs font-medium"
                                      style={{
                                        color: isDark ? "#fb923c" : "#ea580c",
                                      }}
                                    >
                                      Emprunt
                                    </Text>
                                  </View>
                                )}

                                {/* Paiement d'échéance annulé */}
                                {expense.installmentPaymentReversed && (
                                  <View
                                    className="px-2 py-1 rounded-full self-start"
                                    style={{
                                      backgroundColor: isDark
                                        ? "rgba(239, 68, 68, 0.2)"
                                        : "#fee2e2",
                                      borderWidth: 1,
                                      borderColor: isDark
                                        ? "#dc2626"
                                        : "#fca5a5",
                                    }}
                                  >
                                    <Text
                                      className="text-xs font-medium"
                                      style={{
                                        color: isDark ? "#fca5a5" : "#dc2626",
                                      }}
                                    >
                                      Paiement annulé
                                    </Text>
                                  </View>
                                )}

                                {/* Gel de compte gestionnaire */}
                                {expense.type === "INCOME" &&
                                  expense.description?.includes(
                                    "Retour solde gestionnaire (gel du compte)",
                                  ) && (
                                    <View
                                      className="px-2 py-1 rounded-full self-start"
                                      style={{
                                        backgroundColor: isDark
                                          ? "rgba(100, 116, 139, 0.2)"
                                          : "#f1f5f9",
                                        borderWidth: 1,
                                        borderColor: isDark
                                          ? "#64748b"
                                          : "#94a3b8",
                                      }}
                                    >
                                      <Text
                                        className="text-xs font-medium"
                                        style={{
                                          color: isDark ? "#94a3b8" : "#64748b",
                                        }}
                                      >
                                        Gel
                                      </Text>
                                    </View>
                                  )}

                                {/* Dégel de compte gestionnaire */}
                                {expense.type === "OUTCOME" &&
                                  expense.description?.includes(
                                    "Dégel - retour au gestionnaire",
                                  ) && (
                                    <View
                                      className="px-2 py-1 rounded-full self-start"
                                      style={{
                                        backgroundColor: isDark
                                          ? "rgba(20, 184, 166, 0.2)"
                                          : "#ccfbf1",
                                        borderWidth: 1,
                                        borderColor: isDark
                                          ? "#14b8a6"
                                          : "#5eead4",
                                      }}
                                    >
                                      <Text
                                        className="text-xs font-medium"
                                        style={{
                                          color: isDark ? "#5eead4" : "#0d9488",
                                        }}
                                      >
                                        Dégel
                                      </Text>
                                    </View>
                                  )}

                                {/* Statut de validation (PENDING, APPROVED, REJECTED) */}
                                {expense.validationStatus && (
                                  <View
                                    className="px-2 py-1 rounded-full self-start"
                                    style={{
                                      backgroundColor: `${getValidationStatusColor(expense.validationStatus)}20`,
                                    }}
                                  >
                                    <Text
                                      className="text-xs font-medium"
                                      style={{
                                        color: getValidationStatusColor(
                                          expense.validationStatus,
                                        ),
                                      }}
                                    >
                                      {getValidationStatusLabel(
                                        expense.validationStatus,
                                      )}
                                    </Text>
                                  </View>
                                )}

                                {/* Statut de dépense (INACTIVE, CANCELLED) - seulement si différent de ACTIVE */}
                                {expense.status !== "ACTIVE" &&
                                  getExpenseStatusLabel(expense.status) && (
                                    <View
                                      className="px-2 py-0.5 rounded-full self-start"
                                      style={{
                                        backgroundColor: `${getExpenseStatusColor(expense.status)}20`,
                                      }}
                                    >
                                      <Text
                                        className="text-[10px] font-medium"
                                        style={{
                                          color: getExpenseStatusColor(
                                            expense.status,
                                          ),
                                        }}
                                      >
                                        {getExpenseStatusLabel(expense.status)}
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
                                {expense.description || "Sans description"}
                              </Text>
                            </View>

                            {/* Gestionnaire */}
                            {managers && managers.length > 0 && (
                              <View
                                style={{ width: columnWidths.manager }}
                                className="px-3 py-4 justify-center"
                              >
                                {(expense as any).createdBy ? (
                                  <View
                                    className="px-2 py-1 rounded-full self-start"
                                    style={{
                                      backgroundColor: isDark
                                        ? "rgba(107, 114, 128, 0.2)"
                                        : "#f3f4f6",
                                      borderWidth: 1,
                                      borderColor: isDark
                                        ? "#6b7280"
                                        : "#d1d5db",
                                    }}
                                  >
                                    <Text
                                      className="text-xs font-medium"
                                      style={{
                                        color: isDark ? "#d1d5db" : "#374151",
                                      }}
                                      numberOfLines={1}
                                    >
                                      {(expense as any).createdBy.name}
                                    </Text>
                                  </View>
                                ) : (
                                  <Text
                                    className={`text-xs ${
                                      isDark ? "text-gray-400" : "text-gray-600"
                                    }`}
                                  >
                                    -
                                  </Text>
                                )}
                              </View>
                            )}

                            {/* Montant */}
                            <View
                              style={{ width: columnWidths.amount }}
                              className="px-3 py-4 justify-center"
                            >
                              <BlurredAmount
                                amount={expense.amount}
                                currency={expense.currency}
                                className="text-xs font-semibold"
                                style={{ minWidth: 100 }}
                              />
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
                            backgroundColor: isDark ? "#0f172a" : "#ffffff",
                            borderLeftWidth: 1,
                            borderLeftColor: isDark ? "#1e293b" : "#e5e7eb",
                          }}
                          className="px-3 justify-center items-center flex-row gap-2"
                          pointerEvents="box-none"
                        >
                          {/* Vérifier les permissions selon le rôle (gestionnaire vs admin) et le statut */}
                          {hasAnyAction ? (
                            <>
                              {hasEditAction && (
                                <TouchableOpacity
                                  className="rounded-full"
                                  style={{
                                    backgroundColor: `${CHART_COLOR}20`,
                                    padding: actionCount >= 3 ? 6 : 8,
                                  }}
                                  activeOpacity={0.7}
                                  onPress={() => handleEdit(expense)}
                                >
                                  <HugeiconsIcon
                                    icon={Edit01Icon}
                                    size={actionCount >= 3 ? 14 : 16}
                                    color={CHART_COLOR}
                                  />
                                </TouchableOpacity>
                              )}
                              {/* Bouton Cancel pour annuler une transaction */}
                              {hasCancelAction && (
                                <TouchableOpacity
                                  className="rounded-full"
                                  style={{
                                    backgroundColor: "#ef444420",
                                    padding: actionCount >= 3 ? 6 : 8,
                                  }}
                                  activeOpacity={0.7}
                                  onPress={() => handleCancelExpense(expense)}
                                >
                                  <HugeiconsIcon
                                    icon={Cancel01Icon}
                                    size={actionCount >= 3 ? 14 : 16}
                                    color="#ef4444"
                                  />
                                </TouchableOpacity>
                              )}
                              {/* Le bouton "Voir détails" n'existe pas pour les gestionnaires, seulement pour les admins */}
                              {hasViewAction && (
                                <TouchableOpacity
                                  className="rounded-full"
                                  style={{
                                    backgroundColor: `${CHART_COLOR}20`,
                                    padding: actionCount >= 3 ? 6 : 8,
                                  }}
                                  activeOpacity={0.7}
                                  onPress={() => handleViewExpense(expense)}
                                >
                                  <HugeiconsIcon
                                    icon={EyeIcon}
                                    size={actionCount >= 3 ? 14 : 16}
                                    color={CHART_COLOR}
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
                    </PendingExpenseRowWrapper>
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
        {/* Header avec Reset */}
        <View className="flex-row items-center justify-between mb-6">
          <TouchableOpacity
            onPress={() => {
              setTypeFilter("ALL");
              setStatusFilter("ALL");
              setStartDate("");
              setEndDate("");
              setMinAmount("");
              setMaxAmount("");
              setSelectedUserId("all");
            }}
            activeOpacity={0.7}
          >
            <Text
              className={`text-sm font-medium ${
                isDark ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Reset
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filtre Type */}
        <View className="mb-6">
          <Text
            className={`text-sm font-semibold mb-3 ${
              isDark ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Type
          </Text>
          <View className="flex-row gap-2 flex-wrap">
            <TouchableOpacity
              onPress={() => setTypeFilter("ALL")}
              className={`px-4 py-2 rounded-full ${
                typeFilter === "ALL"
                  ? "bg-blue-600"
                  : isDark
                    ? "bg-[#0f172a]"
                    : "bg-gray-100"
              }`}
              activeOpacity={0.7}
            >
              <Text
                className={`text-xs font-medium ${
                  typeFilter === "ALL"
                    ? "text-white"
                    : isDark
                      ? "text-gray-300"
                      : "text-gray-700"
                }`}
              >
                Tous
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTypeFilter("INCOME")}
              className={`px-4 py-2 rounded-full flex-row items-center gap-1.5 ${
                typeFilter === "INCOME"
                  ? "bg-green-600"
                  : isDark
                    ? "bg-[#0f172a]"
                    : "bg-gray-100"
              }`}
              activeOpacity={0.7}
            >
              <HugeiconsIcon
                icon={ArrowDownLeft01Icon}
                size={14}
                color={
                  typeFilter === "INCOME"
                    ? "#ffffff"
                    : isDark
                      ? "#10b981"
                      : "#059669"
                }
              />
              <Text
                className={`text-xs font-medium ${
                  typeFilter === "INCOME"
                    ? "text-white"
                    : isDark
                      ? "text-gray-300"
                      : "text-gray-700"
                }`}
              >
                Entrées
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setTypeFilter("OUTCOME")}
              className={`px-4 py-2 rounded-full flex-row items-center gap-1.5 ${
                typeFilter === "OUTCOME"
                  ? "bg-red-600"
                  : isDark
                    ? "bg-[#0f172a]"
                    : "bg-gray-100"
              }`}
              activeOpacity={0.7}
            >
              <HugeiconsIcon
                icon={ArrowUpLeft01Icon}
                size={14}
                color={
                  typeFilter === "OUTCOME"
                    ? "#ffffff"
                    : isDark
                      ? "#ef4444"
                      : "#dc2626"
                }
              />
              <Text
                className={`text-xs font-medium ${
                  typeFilter === "OUTCOME"
                    ? "text-white"
                    : isDark
                      ? "text-gray-300"
                      : "text-gray-700"
                }`}
              >
                Sorties
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filtre Statut de validation */}
        <View className="mb-6">
          <Text
            className={`text-sm font-semibold mb-3 ${
              isDark ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Statut de validation
          </Text>
          <View className="flex-row gap-2 flex-wrap">
            <TouchableOpacity
              onPress={() => setStatusFilter("ALL")}
              className={`px-4 py-2 rounded-full ${
                statusFilter === "ALL"
                  ? "bg-blue-600"
                  : isDark
                    ? "bg-[#0f172a]"
                    : "bg-gray-100"
              }`}
              activeOpacity={0.7}
            >
              <Text
                className={`text-xs font-medium ${
                  statusFilter === "ALL"
                    ? "text-white"
                    : isDark
                      ? "text-gray-300"
                      : "text-gray-700"
                }`}
              >
                Tous
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setStatusFilter("PENDING")}
              className={`px-4 py-2 rounded-full ${
                statusFilter === "PENDING"
                  ? "bg-yellow-500"
                  : isDark
                    ? "bg-[#0f172a]"
                    : "bg-gray-100"
              }`}
              activeOpacity={0.7}
            >
              <Text
                className={`text-xs font-medium ${
                  statusFilter === "PENDING"
                    ? "text-white"
                    : isDark
                      ? "text-gray-300"
                      : "text-gray-700"
                }`}
              >
                En attente
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setStatusFilter("APPROVED")}
              className={`px-4 py-2 rounded-full ${
                statusFilter === "APPROVED"
                  ? "bg-green-500"
                  : isDark
                    ? "bg-[#0f172a]"
                    : "bg-gray-100"
              }`}
              activeOpacity={0.7}
            >
              <Text
                className={`text-xs font-medium ${
                  statusFilter === "APPROVED"
                    ? "text-white"
                    : isDark
                      ? "text-gray-300"
                      : "text-gray-700"
                }`}
              >
                Approuvé
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setStatusFilter("REJECTED")}
              className={`px-4 py-2 rounded-full ${
                statusFilter === "REJECTED"
                  ? "bg-red-500"
                  : isDark
                    ? "bg-[#0f172a]"
                    : "bg-gray-100"
              }`}
              activeOpacity={0.7}
            >
              <Text
                className={`text-xs font-medium ${
                  statusFilter === "REJECTED"
                    ? "text-white"
                    : isDark
                      ? "text-gray-300"
                      : "text-gray-700"
                }`}
              >
                Rejeté
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Filtre Gestionnaire - Seulement pour les admins (pas pour les managers) */}
        {isAdmin && managers && managers.length > 0 && (
          <View className="mb-6">
            <Text
              className={`text-sm font-semibold mb-3 ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Gestionnaire
            </Text>
            <View className="flex-row gap-2 flex-wrap">
              <TouchableOpacity
                onPress={() => setSelectedUserId("all")}
                className={`px-4 py-2 rounded-full ${
                  selectedUserId === "all"
                    ? "bg-blue-600"
                    : isDark
                      ? "bg-[#0f172a]"
                      : "bg-gray-100"
                }`}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-xs font-medium ${
                    selectedUserId === "all"
                      ? "text-white"
                      : isDark
                        ? "text-gray-300"
                        : "text-gray-700"
                  }`}
                >
                  Tous
                </Text>
              </TouchableOpacity>
              {managers.map((manager: any) => (
                <TouchableOpacity
                  key={manager.id}
                  onPress={() => setSelectedUserId(manager.id)}
                  className={`px-4 py-2 rounded-full ${
                    selectedUserId === manager.id
                      ? "bg-blue-600"
                      : isDark
                        ? "bg-[#0f172a]"
                        : "bg-gray-100"
                  }`}
                  activeOpacity={0.7}
                >
                  <Text
                    className={`text-xs font-medium ${
                      selectedUserId === manager.id
                        ? "text-white"
                        : isDark
                          ? "text-gray-300"
                          : "text-gray-700"
                    }`}
                  >
                    {manager.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Filtre Catégorie - Seulement pour les admins */}
        {isAdmin && (
          <View className="mb-6">
            <Text
              className={`text-sm font-semibold mb-3 ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Catégorie
            </Text>
            <View className="flex-row gap-2 flex-wrap">
              <TouchableOpacity
                onPress={() => setSelectedCategory("all")}
                className={`px-4 py-2 rounded-full ${
                  selectedCategory === "all"
                    ? "bg-blue-600"
                    : isDark
                      ? "bg-[#0f172a]"
                      : "bg-gray-100"
                }`}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-xs font-medium ${
                    selectedCategory === "all"
                      ? "text-white"
                      : isDark
                        ? "text-gray-300"
                        : "text-gray-700"
                  }`}
                >
                  Toutes les catégories
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelectedCategory("none")}
                className={`px-4 py-2 rounded-full ${
                  selectedCategory === "none"
                    ? "bg-blue-600"
                    : isDark
                      ? "bg-[#0f172a]"
                      : "bg-gray-100"
                }`}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-xs font-medium ${
                    selectedCategory === "none"
                      ? "text-white"
                      : isDark
                        ? "text-gray-300"
                        : "text-gray-700"
                  }`}
                >
                  Sans catégorie
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelectedCategory("Famille")}
                className={`px-4 py-2 rounded-full ${
                  selectedCategory === "Famille"
                    ? "bg-blue-600"
                    : isDark
                      ? "bg-[#0f172a]"
                      : "bg-gray-100"
                }`}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-xs font-medium ${
                    selectedCategory === "Famille"
                      ? "text-white"
                      : isDark
                        ? "text-gray-300"
                        : "text-gray-700"
                  }`}
                >
                  Famille
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => setSelectedCategory("Business")}
                className={`px-4 py-2 rounded-full ${
                  selectedCategory === "Business"
                    ? "bg-blue-600"
                    : isDark
                      ? "bg-[#0f172a]"
                      : "bg-gray-100"
                }`}
                activeOpacity={0.7}
              >
                <Text
                  className={`text-xs font-medium ${
                    selectedCategory === "Business"
                      ? "text-white"
                      : isDark
                        ? "text-gray-300"
                        : "text-gray-700"
                  }`}
                >
                  Business
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Filtre Date */}
        <View className="mb-6">
          <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
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
          <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
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
                  style={{
                    includeFontPadding: false,
                  }}
                >
                  {expenses?.[0]?.currency || "GNF"}
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
                  style={{
                    includeFontPadding: false,
                  }}
                >
                  {expenses?.[0]?.currency || "GNF"}
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

        {/* Bouton Clear all */}
        <TouchableOpacity
          onPress={() => {
            setTypeFilter("ALL");
            setStatusFilter("ALL");
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

      {/* Drawer Formulaire Dépense */}
      <Drawer
        open={showExpenseForm}
        onOpenChange={(open) => {
          setShowExpenseForm(open);
          if (!open) {
            // Réinitialiser quand le drawer se ferme
            setEditingExpense(null);
            setMobilizedBalance(null);
            setLoadingMobilizedBalance(false);
            // Réinitialiser le formulaire
            const getLocalDateString = (): string => {
              const now = new Date();
              const year = now.getFullYear();
              const month = String(now.getMonth() + 1).padStart(2, "0");
              const day = String(now.getDate()).padStart(2, "0");
              return `${year}-${month}-${day}`;
            };
            const initialCompanyId =
              isManager && userCompanyId ? userCompanyId : "";
            const initialCompany = companies?.find(
              (c: Company) => c.id === initialCompanyId,
            );
            const resetCountryId = initialCompany?.country
              ? typeof initialCompany.country === "string"
                ? initialCompany.country
                : (initialCompany.country as any)?.id || ""
              : "";
            setFormData({
              description: "",
              amount: "",
              currency: initialCompany?.currency || "GNF",
              type: "OUTCOME",
              companyId: initialCompanyId,
              countryId: resetCountryId,
              date: getLocalDateString(),
              category: isAdmin ? "Business" : "",
            });
            setDocuments([]);
            setExpenseDocuments([]);
          }
        }}
        title={editingExpense ? "Modifier la dépense" : "Nouvelle dépense"}
        footer={
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => {
                // Fermer le drawer du formulaire directement sans confirmation
                setShowExpenseForm(false);
                setEditingExpense(null);
                setMobilizedBalance(null);
                setLoadingMobilizedBalance(false);
                // Réinitialiser le formulaire
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
                  type: "OUTCOME",
                  companyId: "",
                  countryId: "",
                  date: getLocalDateString(),
                  category: "",
                });
                setDocuments([]);
                setExpenseDocuments([]);
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
            <Button
              onPress={handleSubmitExpense}
              disabled={isSubmitting || !isFormValid}
              loading={isSubmitting}
              className="flex-1 h-12 py-0"
              style={{ backgroundColor: CHART_COLOR }}
            >
              {editingExpense ? "Modifier" : "Créer"}
            </Button>
          </View>
        }
      >
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          {/* Entreprise (seulement pour les admins) - Premier champ */}
          {!isManager && (
            <View className="mb-4">
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Entreprise <Text className="text-red-500">*</Text>
              </Text>
              <Select
                value={formData.companyId}
                onValueChange={(value: string) => {
                  const company = companies?.find(
                    (c: Company) => c.id === value,
                  );
                  const companyCurrency =
                    (company as any)?.currency || "GNF";
                  setFormData({
                    ...formData,
                    companyId: value,
                    currency: companyCurrency,
                  });
                  if (formData.type === "OUTCOME" && value) {
                    if (company) {
                      loadMobilizedBalance(value, companyCurrency);
                    }
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
          )}

          {/* Type */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Type <Text className="text-red-500">*</Text>
            </Text>
            <View className="flex-row gap-2">
              <TouchableOpacity
                onPress={() => {
                  const newType = "INCOME";
                  setFormData({ ...formData, type: newType });
                  // Réinitialiser le solde mobilisé pour les entrées
                  setMobilizedBalance(null);
                  setLoadingMobilizedBalance(false);
                }}
                className={`flex-1 px-4 py-3 rounded-full flex-row items-center justify-center gap-2 ${
                  formData.type === "INCOME"
                    ? "bg-green-600"
                    : isDark
                      ? "bg-[#0f172a]"
                      : "bg-gray-100"
                }`}
                activeOpacity={0.7}
              >
                <HugeiconsIcon
                  icon={ArrowDownLeft01Icon}
                  size={16}
                  color={
                    formData.type === "INCOME"
                      ? "#ffffff"
                      : isDark
                        ? "#10b981"
                        : "#059669"
                  }
                />
                <Text
                  className={`text-sm font-medium ${
                    formData.type === "INCOME"
                      ? "text-white"
                      : isDark
                        ? "text-gray-300"
                        : "text-gray-700"
                  }`}
                >
                  Entrée
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  const newType = "OUTCOME";
                  setFormData({ ...formData, type: newType });
                  // Charger le solde mobilisé pour les sorties
                  if (formData.companyId) {
                    const company = companies?.find(
                      (c: Company) => c.id === formData.companyId,
                    );
                    if (company) {
                      loadMobilizedBalance(
                        formData.companyId,
                        formData.currency,
                      );
                    }
                  }
                }}
                className={`flex-1 px-4 py-3 rounded-full flex-row items-center justify-center gap-2 ${
                  formData.type === "OUTCOME"
                    ? "bg-red-600"
                    : isDark
                      ? "bg-[#0f172a]"
                      : "bg-gray-100"
                }`}
                activeOpacity={0.7}
              >
                <HugeiconsIcon
                  icon={ArrowUpLeft01Icon}
                  size={16}
                  color={
                    formData.type === "OUTCOME"
                      ? "#ffffff"
                      : isDark
                        ? "#ef4444"
                        : "#dc2626"
                  }
                />
                <Text
                  className={`text-sm font-medium ${
                    formData.type === "OUTCOME"
                      ? "text-white"
                      : isDark
                        ? "text-gray-300"
                        : "text-gray-700"
                  }`}
                >
                  Sortie
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Montant — la devise est celle de l'entreprise (pas de taux d'échange) */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
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
                className={`text-sm font-medium ${
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
            {/* Affichage du solde mobilisé pour les sorties */}
            {formData.type === "OUTCOME" && formData.companyId && (
              <View
                className={`mt-2 p-3 rounded-lg border ${
                  isDark
                    ? "bg-blue-900/20 border-blue-800"
                    : "bg-blue-50 border-blue-200"
                }`}
              >
                <Text
                  className={`text-xs mb-1 ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Solde mobilisé disponible
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
                      currency={mobilizedBalance.currency}
                      className={`text-base font-bold ${
                        isDark ? "text-blue-400" : "text-blue-600"
                      }`}
                    />
                    {parseFloat(formData.amount || "0") >
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
            )}
          </View>

          {/* Date */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
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
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
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

          {/* Catégorie - Seulement pour l'admin */}
          {isAdmin && (
            <View className="mb-4">
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Catégorie <Text className="text-red-500">*</Text>
              </Text>
              <Select
                value={formData.category || "Business"}
                onValueChange={(value: string) => {
                  if (value === "Famille" || value === "Business") {
                    setFormData({
                      ...formData,
                      category: value as "Business" | "Famille",
                    });
                  }
                }}
                options={[
                  { label: "Business", value: "Business" },
                  { label: "Famille", value: "Famille" },
                ]}
                placeholder="Sélectionner une catégorie"
              />
            </View>
          )}

          {/* Preuves (optionnel) */}
          <View className="mb-4">
            <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
              Preuves (optionnel)
            </Text>
            <View className="space-y-3">
              {/* Documents existants (en mode édition) */}
              {editingExpense && expenseDocuments.length > 0 && (
                <View className="mb-3">
                  <Text
                    className={`text-xs mb-2 ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Documents existants
                  </Text>
                  {expenseDocuments.map((doc) => (
                    <SwipeableDocument
                      key={doc.id}
                      doc={doc}
                      editingExpense={editingExpense}
                      isDark={isDark}
                      onReload={() => loadExpenseDocuments(editingExpense.id)}
                    />
                  ))}
                </View>
              )}

              {/* Documents sélectionnés */}
              {documents.map((doc) => (
                <View
                  key={doc.id}
                  className={`flex-row items-center gap-3 p-3 mb-2 rounded-lg border ${
                    isDark
                      ? "bg-[#0f172a] border-gray-700"
                      : "bg-gray-50 border-gray-200"
                  }`}
                >
                  <HugeiconsIcon
                    icon={File01Icon}
                    size={20}
                    color={isDark ? "#9ca3af" : "#6b7280"}
                  />
                  <View className="flex-1">
                    <Text
                      className={`text-sm font-medium ${
                        isDark ? "text-gray-100" : "text-gray-900"
                      }`}
                      numberOfLines={1}
                    >
                      {doc.title}
                    </Text>
                    <Text
                      className={`text-xs ${
                        isDark ? "text-gray-400" : "text-gray-600"
                      }`}
                      numberOfLines={1}
                    >
                      {doc.file.name || "Document"}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setDocuments(documents.filter((d) => d.id !== doc.id));
                    }}
                    className="p-1"
                    activeOpacity={0.7}
                  >
                    <HugeiconsIcon
                      icon={Cancel01Icon}
                      size={18}
                      color={isDark ? "#ef4444" : "#dc2626"}
                    />
                  </TouchableOpacity>
                </View>
              ))}

              {/* Bouton Ajouter une preuve */}
              <TouchableOpacity
                onPress={handleAddDocument}
                disabled={isAddingDocument}
                className={`flex-row items-center justify-center gap-2 py-3 rounded-full border-2 border-dashed ${
                  isDark
                    ? "border-gray-600 bg-[#0f172a]"
                    : "border-gray-300 bg-gray-50"
                }`}
                style={{ opacity: isAddingDocument ? 0.6 : 1 }}
                activeOpacity={0.7}
              >
                {isAddingDocument ? (
                  <ActivityIndicator
                    size="small"
                    color={isDark ? "#9ca3af" : "#6b7280"}
                  />
                ) : (
                  <HugeiconsIcon
                    icon={Upload01Icon}
                    size={16}
                    color={isDark ? "#9ca3af" : "#6b7280"}
                  />
                )}
                <Text
                  className={`text-sm font-medium ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  {isAddingDocument ? "Ajout..." : "Ajouter une preuve"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </Drawer>

      {/* Drawer Confirmation Annulation */}
      <Drawer
        open={showCancelConfirm}
        onOpenChange={(open) => {
          setShowCancelConfirm(open);
          // Si on ferme le drawer de confirmation sans confirmer, rouvrir le drawer du formulaire
          if (!open) {
            // On ne rouvre pas automatiquement, l'utilisateur doit cliquer sur "Non, continuer"
          }
        }}
        title="Annuler les modifications ?"
      >
        <View className="mb-6">
          <Text
            className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}
          >
            Êtes-vous sûr de vouloir annuler ? Toutes les modifications non
            enregistrées seront perdues.
          </Text>
        </View>
        <View className="flex-row gap-3">
          <TouchableOpacity
            onPress={() => {
              setShowCancelConfirm(false);
              // Rouvrir le drawer du formulaire après un court délai
              setTimeout(() => {
                setShowExpenseForm(true);
              }, 300);
            }}
            className="flex-1 py-3 rounded-full border"
            style={{
              borderColor: isDark ? "#374151" : "#e5e7eb",
            }}
            activeOpacity={0.7}
          >
            <Text
              className={`text-center font-semibold ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
            >
              Non, continuer
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              setShowCancelConfirm(false);
              setEditingExpense(null);
              setMobilizedBalance(null);
              setLoadingMobilizedBalance(false);
              // Réinitialiser le formulaire
              const getLocalDateString = (): string => {
                const now = new Date();
                const year = now.getFullYear();
                const month = String(now.getMonth() + 1).padStart(2, "0");
                const day = String(now.getDate()).padStart(2, "0");
                return `${year}-${month}-${day}`;
              };
              const initialCompanyId =
                isManager && userCompanyId ? userCompanyId : "";
              const initialCompany = companies?.find(
                (c: Company) => c.id === initialCompanyId,
              );
              const confirmCountryId = initialCompany?.country
                ? typeof initialCompany.country === "string"
                  ? initialCompany.country
                  : (initialCompany.country as any)?.id || ""
                : "";
              setFormData({
                description: "",
                amount: "",
                currency: initialCompany?.currency || "GNF",
                type: "OUTCOME",
                companyId: initialCompanyId,
                countryId: confirmCountryId,
                date: getLocalDateString(),
                category: "",
              });
            }}
            className="flex-1 py-3 rounded-full"
            style={{ backgroundColor: "#ef4444" }}
            activeOpacity={0.7}
          >
            <Text className="text-white text-center font-semibold">
              Oui, annuler
            </Text>
          </TouchableOpacity>
        </View>
      </Drawer>

      {/* Modal de visualisation des détails (comme dans GesFlow) */}
      <Modal
        visible={showViewModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowViewModal(false);
          setExpenseToView(null);
          setViewExpenseDocuments([]);
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            setShowViewModal(false);
            setExpenseToView(null);
            setViewExpenseDocuments([]);
          }}
          className="flex-1 bg-black/50 justify-end"
        >
          <View
            className={`w-full rounded-t-3xl p-6 ${
              isDark ? "bg-[#0f172a]" : "bg-white"
            }`}
            style={{ maxHeight: "90%" }}
            onStartShouldSetResponder={() => true}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View className="flex-row items-center justify-between mb-6">
                <Text
                  className={`text-xl font-bold ${
                    isDark ? "text-gray-100" : "text-gray-900"
                  }`}
                >
                  Détails de la dépense
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowViewModal(false);
                    setExpenseToView(null);
                    setViewExpenseDocuments([]);
                  }}
                  className="p-2"
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={24}
                    color={isDark ? "#9ca3af" : "#6b7280"}
                  />
                </TouchableOpacity>
              </View>

              {expenseToView && (
                <>
                  {/* Informations de la dépense */}
                  <View className="mb-6">
                    <View className="flex-row justify-between mb-4">
                      <View className="flex-1 mr-2">
                        <Text
                          className={`text-xs mb-1 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          Entreprise
                        </Text>
                        <Text
                          className={`text-sm font-medium ${
                            isDark ? "text-gray-100" : "text-gray-900"
                          }`}
                        >
                          {expenseToView.company?.name || "N/A"}
                        </Text>
                      </View>
                      <View className="flex-1 ml-2">
                        <Text
                          className={`text-xs mb-1 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          Type
                        </Text>
                        <Text
                          className={`text-sm font-medium ${
                            isDark ? "text-gray-100" : "text-gray-900"
                          }`}
                        >
                          {getTypeLabel(expenseToView.type)}
                        </Text>
                      </View>
                    </View>

                    <View className="flex-row justify-between mb-4">
                      <View className="flex-1 mr-2">
                        <Text
                          className={`text-xs mb-1 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          Montant
                        </Text>
                        <BlurredAmount
                          amount={expenseToView.amount}
                          currency={expenseToView.currency}
                          prefix=""
                          textClassName={`text-sm font-semibold ${
                            isDark ? "text-white" : "text-gray-900"
                          }`}
                        />
                      </View>
                      <View className="flex-1 ml-2">
                        <Text
                          className={`text-xs mb-1 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          Date
                        </Text>
                        <Text
                          className={`text-sm font-medium ${
                            isDark ? "text-gray-100" : "text-gray-900"
                          }`}
                        >
                          {new Date(expenseToView.createdAt).toLocaleDateString(
                            "fr-FR",
                            {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            },
                          )}
                        </Text>
                      </View>
                    </View>

                    {expenseToView.description && (
                      <View className="mb-4">
                        <Text
                          className={`text-xs mb-1 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          Description
                        </Text>
                        <Text
                          className={`text-sm ${
                            isDark ? "text-gray-100" : "text-gray-900"
                          }`}
                        >
                          {expenseToView.description}
                        </Text>
                      </View>
                    )}

                    {(expenseToView as any).category && (
                      <View className="mb-4">
                        <Text
                          className={`text-xs mb-1 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          Catégorie
                        </Text>
                        <Text
                          className={`text-sm font-medium ${
                            isDark ? "text-gray-100" : "text-gray-900"
                          }`}
                        >
                          {(expenseToView as any).category === "Personnelle" 
                            ? "Famille" 
                            : (expenseToView as any).category}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Documents associés */}
                  <View className="mb-6">
                    <Text
                      className={`text-sm font-semibold mb-3 ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Documents associés ({viewExpenseDocuments.length})
                    </Text>
                    {viewExpenseDocuments.length > 0 ? (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                      >
                        <View className="flex-row gap-3">
                          {viewExpenseDocuments.map((doc) => (
                            <TouchableOpacity
                              key={doc.id}
                              onPress={() => openDocument(doc)}
                              className={`p-3 rounded-lg border ${
                                isDark
                                  ? "bg-[#1e293b] border-gray-700"
                                  : "bg-gray-50 border-gray-200"
                              }`}
                              style={{ minWidth: 150 }}
                              activeOpacity={0.7}
                            >
                              <View className="flex-row items-center gap-2 mb-2">
                                <HugeiconsIcon
                                  icon={File01Icon}
                                  size={16}
                                  color={isDark ? "#9ca3af" : "#6b7280"}
                                />
                                <Text
                                  className={`text-xs font-medium flex-1 ${
                                    isDark ? "text-gray-300" : "text-gray-700"
                                  }`}
                                  numberOfLines={1}
                                >
                                  {doc.title || doc.filename}
                                </Text>
                              </View>
                              <Text
                                className={`text-[10px] ${
                                  isDark ? "text-gray-500" : "text-gray-500"
                                }`}
                              >
                                {new Date(doc.createdAt).toLocaleDateString(
                                  "fr-FR",
                                )}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    ) : (
                      <Text
                        className={`text-sm text-center py-4 ${
                          isDark ? "text-gray-500" : "text-gray-500"
                        }`}
                      >
                        Aucun document associé
                      </Text>
                    )}
                  </View>

                  {/* Boutons de validation - uniquement si la dépense est en attente */}
                  {expenseToView.validationStatus === "PENDING" &&
                    expenseToView.type === "OUTCOME" &&
                    canUpdate &&
                    !isManager && (
                      <View
                        className="flex-row gap-3 pt-4 border-t border-gray-700"
                        onStartShouldSetResponder={() => false}
                      >
                        <TouchableOpacity
                          onPress={() => {
                            handleOpenValidation(expenseToView, "approve");
                          }}
                          className="flex-1 py-3 rounded-full items-center"
                          style={{ backgroundColor: "#10b981" }}
                          activeOpacity={0.8}
                        >
                          <View className="flex-row items-center gap-2">
                            <HugeiconsIcon
                              icon={CheckmarkCircle02Icon}
                              size={18}
                              color="#ffffff"
                            />
                            <Text className="text-white font-semibold">
                              Valider
                            </Text>
                          </View>
                        </TouchableOpacity>
                        <TouchableOpacity
                          onPress={() => {
                            handleOpenValidation(expenseToView, "reject");
                          }}
                          className="flex-1 py-3 rounded-full items-center"
                          style={{ backgroundColor: "#ef4444" }}
                          activeOpacity={0.8}
                        >
                          <View className="flex-row items-center gap-2">
                            <HugeiconsIcon
                              icon={AlertDiamondIcon}
                              size={18}
                              color="#ffffff"
                            />
                            <Text className="text-white font-semibold">
                              Rejeter
                            </Text>
                          </View>
                        </TouchableOpacity>
                      </View>
                    )}
                </>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Modal de validation (confirmation) */}
      <Modal
        visible={showValidationModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowValidationModal(false);
          setExpenseToValidate(null);
          setValidationAction(null);
          setRejectionReason("");
          setViewExpenseDocuments([]);
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            setShowValidationModal(false);
            setExpenseToValidate(null);
            setValidationAction(null);
            setRejectionReason("");
            setViewExpenseDocuments([]);
          }}
          className="flex-1 bg-black/50 justify-end"
        >
          <View
            className={`w-full rounded-t-3xl p-6 ${
              isDark ? "bg-[#0f172a]" : "bg-white"
            }`}
            style={{ maxHeight: "90%" }}
            onStartShouldSetResponder={() => true}
          >
            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Header */}
              <View className="flex-row items-center justify-between mb-6">
                <Text
                  className={`text-xl font-bold ${
                    isDark ? "text-gray-100" : "text-gray-900"
                  }`}
                >
                  {expenseToValidate && validationAction
                    ? validationAction === "approve"
                      ? "Valider la dépense"
                      : "Rejeter la dépense"
                    : ""}
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowValidationModal(false);
                    setExpenseToValidate(null);
                    setValidationAction(null);
                    setRejectionReason("");
                    setViewExpenseDocuments([]);
                  }}
                  className="p-2"
                >
                  <HugeiconsIcon
                    icon={Cancel01Icon}
                    size={24}
                    color={isDark ? "#9ca3af" : "#6b7280"}
                  />
                </TouchableOpacity>
              </View>

              {expenseToValidate && validationAction && (
                <>
                  {/* Icône de confirmation */}
                  <View
                    className={`w-16 h-16 rounded-full items-center justify-center mx-auto mb-4 ${
                      validationAction === "approve"
                        ? "bg-green-100 dark:bg-green-900/20"
                        : "bg-red-100 dark:bg-red-900/20"
                    }`}
                  >
                    <HugeiconsIcon
                      icon={
                        validationAction === "approve"
                          ? CheckmarkCircle02Icon
                          : AlertDiamondIcon
                      }
                      size={32}
                      color={
                        validationAction === "approve" ? "#10b981" : "#ef4444"
                      }
                    />
                  </View>

                  <Text
                    className={`text-sm text-center mb-6 ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    {validationAction === "approve" ? (
                      <>
                        Êtes-vous sûr de vouloir valider cette dépense de{" "}
                        <Text className="font-semibold">
                          {expenseToValidate?.company?.name || "N/A"}
                        </Text>
                        ? Le montant sera déduit du solde du gestionnaire.
                      </>
                    ) : (
                      <>
                        Êtes-vous sûr de vouloir rejeter cette dépense de{" "}
                        <Text className="font-semibold">
                          {expenseToValidate?.company?.name || "N/A"}
                        </Text>
                        . La dépense sera annulée.
                      </>
                    )}
                  </Text>

                  {/* Informations de la dépense */}
                  <View
                    className={`p-4 rounded-lg mb-6 ${
                      isDark ? "bg-[#1e293b]" : "bg-gray-50"
                    }`}
                  >
                    <View className="flex-row justify-between mb-2">
                      <Text
                        className={`text-xs ${
                          isDark ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        Montant:
                      </Text>
                      <BlurredAmount
                        amount={expenseToValidate?.amount || 0}
                        currency={expenseToValidate?.currency || "GNF"}
                        prefix=""
                        textClassName={`text-xs font-semibold ${
                          isDark ? "text-gray-100" : "text-gray-900"
                        }`}
                      />
                    </View>
                    <View className="flex-row justify-between">
                      <Text
                        className={`text-xs ${
                          isDark ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        Description:
                      </Text>
                      <Text
                        className={`text-xs font-medium flex-1 text-right ml-2 ${
                          isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                        numberOfLines={2}
                      >
                        {expenseToValidate?.description || "N/A"}
                      </Text>
                    </View>
                  </View>

                  {/* Documents associés */}
                  {viewExpenseDocuments.length > 0 && (
                    <View className="mb-6">
                      <Text
                        className={`text-sm font-semibold mb-3 ${
                          isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        Documents associés ({viewExpenseDocuments.length})
                      </Text>
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                      >
                        <View className="flex-row gap-3">
                          {viewExpenseDocuments.map((doc) => (
                            <TouchableOpacity
                              key={doc.id}
                              onPress={() => openDocument(doc)}
                              className={`p-3 rounded-lg border ${
                                isDark
                                  ? "bg-[#1e293b] border-gray-700"
                                  : "bg-gray-50 border-gray-200"
                              }`}
                              style={{ minWidth: 150 }}
                              activeOpacity={0.7}
                            >
                              <View className="flex-row items-center gap-2 mb-2">
                                <HugeiconsIcon
                                  icon={File01Icon}
                                  size={16}
                                  color={isDark ? "#9ca3af" : "#6b7280"}
                                />
                                <Text
                                  className={`text-xs font-medium flex-1 ${
                                    isDark ? "text-gray-300" : "text-gray-700"
                                  }`}
                                  numberOfLines={1}
                                >
                                  {doc.title || doc.filename}
                                </Text>
                              </View>
                              <Text
                                className={`text-[10px] ${
                                  isDark ? "text-gray-500" : "text-gray-500"
                                }`}
                              >
                                {new Date(doc.createdAt).toLocaleDateString(
                                  "fr-FR",
                                )}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </ScrollView>
                    </View>
                  )}

                  {/* Champ de raison de refus (seulement pour reject) */}
                  {validationAction === "reject" && (
                    <View className="mb-6">
                      <Text
                        className={`text-sm font-semibold mb-2 ${
                          isDark ? "text-gray-300" : "text-gray-700"
                        }`}
                      >
                        Cause de refus <Text className="text-red-500">*</Text>
                      </Text>
                      <TextInput
                        value={rejectionReason}
                        onChangeText={setRejectionReason}
                        placeholder="Saisissez la cause de refus..."
                        placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                        multiline
                        numberOfLines={4}
                        className={`w-full min-h-[100px] px-3 py-2 rounded-lg border text-sm ${
                          isDark
                            ? "bg-[#1e293b] border-gray-600 text-gray-100"
                            : "bg-white border-gray-300 text-gray-900"
                        }`}
                        style={{
                          textAlignVertical: "top",
                        }}
                      />
                    </View>
                  )}

                  {/* Boutons */}
                  <View className="flex-row gap-3">
                    <TouchableOpacity
                      onPress={handleValidateExpense}
                      disabled={
                        isValidating ||
                        (validationAction === "reject" &&
                          !rejectionReason.trim())
                      }
                      className={`flex-1 py-3 rounded-full items-center ${
                        validationAction === "approve"
                          ? "bg-green-600"
                          : "bg-red-600"
                      }`}
                      style={{
                        opacity:
                          isValidating ||
                          (validationAction === "reject" &&
                            !rejectionReason.trim())
                            ? 0.5
                            : 1,
                      }}
                      activeOpacity={0.8}
                    >
                      {isValidating ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                      ) : (
                        <Text className="text-white font-semibold">
                          {validationAction === "approve"
                            ? "Valider"
                            : "Rejeter"}
                        </Text>
                      )}
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => {
                        setShowValidationModal(false);
                        setExpenseToValidate(null);
                        setValidationAction(null);
                        setRejectionReason("");
                      }}
                      disabled={isValidating}
                      className={`flex-1 py-3 rounded-full items-center border ${
                        isDark
                          ? "border-gray-600 bg-[#1e293b]"
                          : "border-gray-300 bg-white"
                      }`}
                      activeOpacity={0.8}
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
                </>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}
