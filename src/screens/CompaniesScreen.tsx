import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
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
  Clipboard,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Swipeable } from "react-native-gesture-handler";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/config/api";
import { useTheme } from "@/contexts/ThemeContext";
import { usePermissions } from "@/hooks/usePermissions";
import { authService } from "@/services/auth.service";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  Building04Icon,
  PlusSignCircleIcon,
  Search01Icon,
  Edit01Icon,
  Delete01Icon,
  Cancel01Icon,
  EyeIcon,
  Download01Icon,
  Upload01Icon,
  File01Icon,
  ArrowLeft01Icon,
  Copy01Icon,
} from "@hugeicons/core-free-icons";
import { CompaniesSkeleton } from "@/components/skeletons/CompaniesSkeleton";
import { Header } from "@/components/Header";
import { TAB_BAR_PADDING_BOTTOM, REFRESH_CONTROL_COLOR } from "@/constants/layout";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_COLOR = "#0ea5e9";

// Liste complète des devises
const CURRENCIES = [
  { code: "GNF", name: "Franc guinéen" },
  { code: "USD", name: "Dollar américain" },
  { code: "EUR", name: "Euro" },
  { code: "XOF", name: "Franc CFA (BCEAO)" },
  { code: "XAF", name: "Franc CFA (BEAC)" },
  { code: "GBP", name: "Livre sterling" },
  { code: "JPY", name: "Yen japonais" },
  { code: "CNY", name: "Yuan chinois" },
  { code: "CAD", name: "Dollar canadien" },
  { code: "AUD", name: "Dollar australien" },
  { code: "CHF", name: "Franc suisse" },
  { code: "NGN", name: "Naira nigérian" },
  { code: "ZAR", name: "Rand sud-africain" },
  { code: "EGP", name: "Livre égyptienne" },
  { code: "KES", name: "Shilling kényan" },
  { code: "GHS", name: "Cedi ghanéen" },
  { code: "MAD", name: "Dirham marocain" },
  { code: "TND", name: "Dinar tunisien" },
  { code: "DZD", name: "Dinar algérien" },
  { code: "XPF", name: "Franc CFP" },
  { code: "INR", name: "Roupie indienne" },
  { code: "PKR", name: "Roupie pakistanaise" },
  { code: "THB", name: "Baht thaïlandais" },
  { code: "SGD", name: "Dollar de Singapour" },
  { code: "BRL", name: "Real brésilien" },
  { code: "RUB", name: "Rouble russe" },
  { code: "TRY", name: "Livre turque" },
  { code: "AED", name: "Dirham des Émirats arabes unis" },
  { code: "SAR", name: "Riyal saoudien" },
  { code: "CDF", name: "Franc congolais" },
  { code: "RWF", name: "Franc rwandais" },
  { code: "BIF", name: "Franc burundais" },
];

// Composant SwipeableDocument pour les entreprises
interface SwipeableCompanyDocumentProps {
  doc: {
    id: string;
    title: string;
    filename: string;
    url: string;
    fileType?: string;
    createdAt: string;
  };
  editingCompany: Company | null;
  isDark: boolean;
  onReload: () => Promise<void>;
  onOpenDocument: (doc: any) => Promise<void>;
}

const SwipeableCompanyDocument: React.FC<SwipeableCompanyDocumentProps> = ({
  doc,
  editingCompany,
  isDark,
  onReload,
  onOpenDocument,
}) => {
  const swipeableRef = useRef<Swipeable>(null);

  const renderRightActions = () => {
    const actionWidth = 70;
    const numberOfActions = 3;
    const totalActionsWidth = actionWidth * numberOfActions;
    const backButtonWidth = 60;
    const actionHeight = "100%";

    return (
      <View
        className="flex-row items-stretch"
        style={{ height: "100%", width: totalActionsWidth + backButtonWidth }}
      >
        {/* Bouton Retour */}
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

        {/* Bouton Voir */}
        <TouchableOpacity
          onPress={async () => {
            swipeableRef.current?.close();
            await onOpenDocument(doc);
          }}
          style={{
            width: actionWidth,
            height: actionHeight,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: isDark ? "#1e40af" : "#3b82f6",
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
              }}
            >
              <HugeiconsIcon icon={EyeIcon} size={20} color="#ffffff" />
            </View>
            <Text
              style={{
                color: "#ffffff",
                fontSize: 10,
                fontWeight: "700",
              }}
              numberOfLines={1}
            >
              Voir
            </Text>
          </View>
        </TouchableOpacity>

        {/* Bouton Modifier */}
        <TouchableOpacity
          onPress={() => {
            swipeableRef.current?.close();
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
                        // Utiliser PATCH comme pour les expenses
                        await api.patch(
                          `/api/companies/${editingCompany?.id}/documents`,
                          {
                            documentId: doc.id,
                            title: newTitle.trim(),
                          }
                        );
                        await onReload();
                      } catch (error: any) {
                        Alert.alert(
                          "Erreur",
                          error.response?.data?.error || "Impossible de modifier le titre"
                        );
                      }
                    }
                  },
                },
              ],
              "plain-text",
              doc.title
            );
          }}
          style={{
            width: actionWidth,
            height: actionHeight,
            justifyContent: "center",
            alignItems: "center",
            backgroundColor: isDark ? "#92400e" : "#f59e0b",
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
              }}
            >
              <HugeiconsIcon icon={Edit01Icon} size={20} color="#ffffff" />
            </View>
            <Text
              style={{
                color: "#ffffff",
                fontSize: 10,
                fontWeight: "700",
              }}
              numberOfLines={1}
            >
              Modifier
            </Text>
          </View>
        </TouchableOpacity>

        {/* Bouton Supprimer */}
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
                        `/api/companies/${editingCompany?.id}/documents/${doc.id}`
                      );
                      await onReload();
                    } catch (error: any) {
                      Alert.alert(
                        "Erreur",
                        "Impossible de supprimer le document"
                      );
                    }
                  },
                },
              ]
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
              }}
            >
              <HugeiconsIcon icon={Delete01Icon} size={20} color="#ffffff" />
            </View>
            <Text
              style={{
                color: "#ffffff",
                fontSize: 10,
                fontWeight: "700",
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

// Types
interface Company {
  id: string;
  name: string;
  registrationNumber: string;
  currency?: string;
  country: {
    id: string;
    name: string;
  };
  activitySector?: {
    id: string;
    name: string;
  } | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  status: string;
  expenseThreshold: number | null;
  createdAt: string;
  documents?: Array<{
    id: string;
    title: string;
    filename: string;
    url: string;
    fileType?: string;
    fileSize?: number;
    createdAt: string;
  }>;
  _count?: {
    expenses: number;
    investments: number;
    loans: number;
    documents: number;
  };
}

interface Country {
  id: string;
  name: string;
  code: string;
}

interface ActivitySector {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
}

export function CompaniesScreen() {
  const { isDark } = useTheme();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCompanyForm, setShowCompanyForm] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showDeleteDrawer, setShowDeleteDrawer] = useState(false);
  const [editingCompany, setEditingCompany] = useState<Company | null>(null);
  const [viewingCompany, setViewingCompany] = useState<Company | null>(null);
  const [companyToDelete, setCompanyToDelete] = useState<Company | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isAddingDocument, setIsAddingDocument] = useState(false);

  // États du formulaire
  const [formData, setFormData] = useState({
    name: "",
    registrationNumber: "",
    currency: "GNF",
    countryId: "",
    activitySectorId: "",
    address: "",
    phone: "",
    email: "",
    website: "",
    expenseThreshold: "",
  });

  // États pour les documents
  const [documents, setDocuments] = useState<
    Array<{ file: any; title: string; id: string }>
  >([]);
  const [companyDocuments, setCompanyDocuments] = useState<
    Array<{
      id: string;
      title: string;
      filename: string;
      url: string;
      fileType?: string;
      createdAt: string;
    }>
  >([]);

  // Refs pour synchroniser le scroll
  const headerScrollRef = useRef<ScrollView>(null);
  const contentScrollRefs = useRef<Map<string, ScrollView>>(new Map());
  const scrollXRef = useRef(0);
  const isScrollingRef = useRef(false);

  const canView = hasPermission("companies.view");
  const canCreate = hasPermission("companies.create");
  const canUpdate = hasPermission("companies.update");
  const canDelete = hasPermission("companies.delete");

  // Récupérer les entreprises
  const {
    data: companies,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const response = await api.get("/api/companies");
      return response.data;
    },
    enabled: canView,
  });

  // Récupérer les pays
  const { data: countries } = useQuery({
    queryKey: ["countries"],
    queryFn: async () => {
      const response = await api.get("/api/countries");
      return response.data;
    },
  });

  // Récupérer les secteurs d'activité
  const { data: activitySectors } = useQuery({
    queryKey: ["activity-sectors"],
    queryFn: async () => {
      const response = await api.get("/api/activity-sectors?isActive=true");
      return response.data;
    },
  });

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

  // Filtrer les entreprises
  const filteredCompanies = useMemo(() => {
    if (!companies) return [];
    return companies.filter((company: Company) => {
      const matchesSearch =
        !searchTerm ||
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.registrationNumber
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        (company.email &&
          company.email.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchesSearch;
    });
  }, [companies, searchTerm]);

  // Fonction helper pour ouvrir un document
  const openDocument = async (doc: {
    id: string;
    title: string;
    filename: string;
    url: string;
  }) => {
    try {
      let url = doc.url;
      if (!url || typeof url !== "string") {
        Alert.alert("Erreur", "URL du document invalide ou manquante");
        return;
      }

      if (url.startsWith("/api/files/")) {
        try {
          const apiUrl = `${api.defaults.baseURL}${url}`;
          const response = await api.get(url, {
            skipAuthError: true,
            maxRedirects: 5,
            validateStatus: () => true,
          });

          if (
            response.request?.responseURL &&
            response.request.responseURL !== apiUrl
          ) {
            url = response.request.responseURL;
          } else if (response.status >= 300 && response.status < 400) {
            const location =
              response.headers.location ||
              response.headers.Location ||
              response.headers["location"] ||
              response.headers["Location"];
            if (location) {
              url = location;
            } else {
              url = apiUrl;
            }
          } else {
            url = apiUrl;
          }
        } catch (apiError: any) {
          url = `${api.defaults.baseURL}${url}`;
        }
      } else if (!url.startsWith("http")) {
        if (url.includes("users/")) {
          const usersIndex = url.indexOf("users/");
          const cleanUrl = url.substring(usersIndex);
          url = `${api.defaults.baseURL}/api/files/${encodeURIComponent(cleanUrl)}`;
        } else {
          Alert.alert("Erreur", "Format d'URL du document non reconnu");
          return;
        }
      }

      if (!url.startsWith("http")) {
        Alert.alert(
          "Erreur",
          "Impossible de construire une URL valide pour le document"
        );
        return;
      }

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Erreur", "Impossible d'ouvrir le document");
      }
    } catch (error: any) {
      Alert.alert(
        "Erreur",
        error.message || "Impossible d'ouvrir le document"
      );
    }
  };

  // Gestion du scroll horizontal synchronisé
  const handleContentScroll = useCallback((event: any, companyId: string) => {
    if (isScrollingRef.current) return;

    const offsetX = event.nativeEvent.contentOffset.x;
    scrollXRef.current = offsetX;
    isScrollingRef.current = true;

    if (headerScrollRef.current) {
      headerScrollRef.current.scrollTo({ x: offsetX, animated: false });
    }

    contentScrollRefs.current.forEach((ref, id) => {
      if (id !== companyId && ref) {
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

  // Fonctions de gestion
  const handleCreate = () => {
    if (!canCreate) return;
    setEditingCompany(null);
    setFormData({
      name: "",
      registrationNumber: "",
      currency: "GNF",
      countryId: "",
      activitySectorId: "",
      address: "",
      phone: "",
      email: "",
      website: "",
      expenseThreshold: "",
    });
    setDocuments([]);
    setCompanyDocuments([]);
    setShowCompanyForm(true);
  };

  const handleEdit = async (company: Company) => {
    if (!canUpdate) return;
    
    // Charger les détails complets de l'entreprise pour s'assurer que tous les champs sont disponibles
    try {
      const response = await api.get(`/api/companies/${company.id}`);
      const fullCompany = response.data;
      
      if (!fullCompany.activitySector?.id) {
        Alert.alert(
          "Erreur",
          "Cette entreprise n'a pas de secteur d'activité. Veuillez en sélectionner un."
        );
        return;
      }
      
      setEditingCompany(fullCompany);
      
      setFormData({
        name: fullCompany.name,
        registrationNumber: fullCompany.registrationNumber,
        currency: fullCompany.currency || "GNF",
        countryId:
          typeof fullCompany.country === "object"
            ? fullCompany.country.id
            : fullCompany.country || "",
        activitySectorId: fullCompany.activitySector?.id || "",
        address: fullCompany.address || "",
        phone: fullCompany.phone || "",
        email: fullCompany.email || "",
        website: fullCompany.website || "",
        expenseThreshold: fullCompany.expenseThreshold?.toString() || "",
      });
      setDocuments([]);
      await loadCompanyDocuments(company.id);
      setShowCompanyForm(true);
    } catch (error: any) {
      Alert.alert("Erreur", "Impossible de charger les détails de l'entreprise");
    }
  };

  const handleView = async (company: Company) => {
    setViewingCompany(null);
    setShowViewModal(true);
    
    try {
      // Charger les détails complets de l'entreprise (inclut les documents)
      const response = await api.get(`/api/companies/${company.id}`);
      if (response.data) {
        setViewingCompany(response.data);
        // Les documents sont inclus dans la réponse de l'API
        // On les stocke aussi dans companyDocuments pour compatibilité
        if (response.data.documents && Array.isArray(response.data.documents)) {
          setCompanyDocuments(response.data.documents);
        } else {
          setCompanyDocuments([]);
        }
      }
    } catch (error: any) {
      Alert.alert("Erreur", "Impossible de charger les détails de l'entreprise");
      setShowViewModal(false);
    }
  };

  const handleDelete = (company: Company) => {
    if (!canDelete) return;
    setCompanyToDelete(company);
    setDeleteConfirmation("");
    setShowDeleteDrawer(true);
  };

  const loadCompanyDocuments = async (companyId: string) => {
    try {
      const response = await api.get(`/api/companies/${companyId}/documents`, {
        skipAuthError: true,
      });
      if (response.data && Array.isArray(response.data)) {
        setCompanyDocuments(response.data);
      } else {
        setCompanyDocuments([]);
      }
    } catch (error: any) {
      setCompanyDocuments([]);
    }
  };

  const handleAddDocument = async () => {
    if (isAddingDocument) return;
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
      if (
        error.message?.includes("Cannot find module") ||
        error.code === "MODULE_NOT_FOUND"
      ) {
        Alert.alert(
          "Package manquant",
          "Veuillez installer expo-document-picker: npm install expo-document-picker"
        );
      }
    } finally {
      setIsAddingDocument(false);
    }
  };

  const uploadDocuments = async (companyId: string) => {
    if (documents.length === 0) return;

    try {
      await authService.refreshToken();
    } catch (tokenError) {
      // Erreur silencieuse
    }

    for (const doc of documents) {
      try {
        const formData = new FormData();
        formData.append("file", {
          uri: doc.file.uri,
          type: doc.file.mimeType || "application/octet-stream",
          name: doc.file.name || "document",
        } as any);
        formData.append("title", doc.title || doc.file.name || "Document");
        formData.append("type", "companies");

        const uploadResponse = await api.post("/api/upload", formData, {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          skipAuthError: true,
        });

        if (uploadResponse.data) {
          const uploadData = uploadResponse.data;
          await api.post(`/api/companies/${companyId}/documents`, {
            title: doc.title || doc.file.name || "Document",
            filename: uploadData.filename || doc.file.name,
            url: uploadData.url,
            objectName: uploadData.objectName,
            fileType: doc.file.mimeType || "application/octet-stream",
            fileSize: doc.file.size,
          });
        }
      } catch (error: any) {
        throw error;
      }
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    // Vérifier que tous les documents ont un titre
    const documentsWithoutTitle = documents.filter((doc) => !doc.title.trim());
    if (documentsWithoutTitle.length > 0) {
      Alert.alert("Erreur", "Veuillez renseigner l'intitulé pour tous les documents");
      return;
    }

    // Validation
    if (!formData.name.trim()) {
      Alert.alert("Erreur", "Le nom de l'entreprise est requis");
      return;
    }
    if (!formData.registrationNumber.trim()) {
      Alert.alert("Erreur", "Le numéro d'enregistrement est requis");
      return;
    }
    if (!formData.countryId) {
      Alert.alert("Erreur", "Le pays est requis");
      return;
    }
    if (!formData.activitySectorId) {
      Alert.alert("Erreur", "Le secteur d'activité est requis");
      return;
    }

    try {
      setIsSubmitting(true);
      let companyId: string;

      // Préparer les données
      // En mode édition, on envoie tous les champs (même vides) pour permettre de les vider
      // En mode création, on n'envoie que les champs avec des valeurs
      const payload: any = {
        name: formData.name.trim(),
        registrationNumber: formData.registrationNumber.trim(),
        currency: formData.currency,
        countryId: formData.countryId,
        activitySectorId: formData.activitySectorId, // Obligatoire
      };

      if (editingCompany) {
        // Mode édition : envoyer tous les champs optionnels (même vides) pour permettre de les vider
        payload.address = formData.address.trim() || null;
        payload.phone = formData.phone.trim() || null;
        payload.email = formData.email.trim() || null;
        payload.website = formData.website.trim() || null;
        payload.expenseThreshold = formData.expenseThreshold
          ? parseFloat(formData.expenseThreshold)
          : null;
      } else {
        // Mode création : envoyer tous les champs optionnels (même vides) car l'API peut les exiger
        payload.address = formData.address.trim() || null;
        payload.phone = formData.phone.trim() || null;
        payload.email = formData.email.trim() || null;
        payload.website = formData.website.trim() || null;
        payload.expenseThreshold = formData.expenseThreshold
          ? parseFloat(formData.expenseThreshold)
          : null;
      }


      if (editingCompany) {
        // Mise à jour
        const response = await api.put(`/api/companies/${editingCompany.id}`, payload);
        companyId = editingCompany.id;
      } else {
        // Création
        const response = await api.post("/api/companies", payload);
        companyId = response.data.id;
      }

      // Upload des documents
      if (documents.length > 0 && companyId) {
        try {
          await uploadDocuments(companyId);
          setDocuments([]);
        } catch (error: any) {
          // Erreur silencieuse
        }
      }

      setShowCompanyForm(false);
      setEditingCompany(null);
      setDocuments([]);
      setCompanyDocuments([]);
      
      // Rafraîchir la query locale
      await refetch();
      
      // Invalider les queries pour que les autres écrans se mettent à jour
      queryClient.invalidateQueries({ 
        queryKey: ["companies"]
      });
      queryClient.invalidateQueries({ 
        queryKey: ["dashboard-stats"]
      });
      queryClient.invalidateQueries({ 
        queryKey: ["dashboard"]
      });
    } catch (error: any) {
      // Afficher les détails de validation si disponibles
      const validationDetails = error.response?.data?.details;
      let errorMessage = error.response?.data?.error || error.message || "Une erreur est survenue";
      
      if (validationDetails && Array.isArray(validationDetails) && validationDetails.length > 0) {
        const firstError = validationDetails[0];
        errorMessage = `${errorMessage}\n\n${firstError.path}: ${firstError.message}`;
      }
      
      Alert.alert("Erreur", errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!companyToDelete || isDeleting) return;

    if (
      deleteConfirmation.toLowerCase().trim() !==
      companyToDelete.name.toLowerCase().trim()
    ) {
      Alert.alert("Erreur", "Le nom de l'entreprise ne correspond pas");
      return;
    }

    try {
      setIsDeleting(true);
      await api.delete(`/api/companies/${companyToDelete.id}`);
      setShowDeleteDrawer(false);
      setCompanyToDelete(null);
      setDeleteConfirmation("");
      
      // Rafraîchir la query locale
      await refetch();
      
      // Invalider les queries pour que les autres écrans se mettent à jour
      queryClient.invalidateQueries({ 
        queryKey: ["companies"]
      });
      queryClient.invalidateQueries({ 
        queryKey: ["dashboard-stats"]
      });
      queryClient.invalidateQueries({ 
        queryKey: ["dashboard"]
      });
    } catch (error: any) {
      Alert.alert(
        "Erreur",
        error.response?.data?.error || error.message || "Une erreur est survenue"
      );
    } finally {
      setIsDeleting(false);
    }
  };

  // Largeurs des colonnes
  const columnWidths = {
    name: 180,
    registrationNumber: 150,
    country: 120,
    sector: 150,
    email: 180,
    status: 100,
    expenses: 90,
    investments: 110,
    loans: 90,
    actions: 100,
  };

  const totalTableWidth = Object.values(columnWidths).reduce(
    (sum, width) => sum + width,
    0
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
      <Header />
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

            {/* Bouton créer */}
            {canCreate && (
              <TouchableOpacity
                onPress={() => {
                  handleCreate();
                }}
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
        {isLoading || !companies ? (
          <CompaniesSkeleton />
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
                  {/* Nom */}
                  <View
                    style={{ width: columnWidths.name }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Nom
                    </Text>
                  </View>

                  {/* Numéro d'enregistrement */}
                  <View
                    style={{ width: columnWidths.registrationNumber }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Numéro
                    </Text>
                  </View>

                  {/* Pays */}
                  <View
                    style={{ width: columnWidths.country }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Pays
                    </Text>
                  </View>

                  {/* Secteur */}
                  <View
                    style={{ width: columnWidths.sector }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Secteur
                    </Text>
                  </View>

                  {/* Email */}
                  <View
                    style={{ width: columnWidths.email }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Email
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

                  {/* Dépenses */}
                  <View
                    style={{ width: columnWidths.expenses }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Dépenses
                    </Text>
                  </View>

                  {/* Investissements */}
                  <View
                    style={{ width: columnWidths.investments }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Investissements
                    </Text>
                  </View>

                  {/* Emprunts */}
                  <View
                    style={{ width: columnWidths.loans }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Emprunts
                    </Text>
                  </View>
                </View>
              </ScrollView>

              {/* Colonne Actions (sticky à droite) */}
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

            {/* Liste des entreprises avec scroll synchronisé */}
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
              {filteredCompanies.length === 0 ? (
                <View className="items-center justify-center py-12 px-6">
                  <Text
                    className={`text-center text-sm ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    {searchTerm
                      ? "Aucune entreprise trouvée"
                      : "Aucune entreprise disponible"}
                  </Text>
                </View>
              ) : (
                filteredCompanies.map((company: Company) => {
                  const hasEditAction = canUpdate;
                  const hasDeleteAction = canDelete;
                  const hasViewAction = canView;
                  const hasAnyAction =
                    hasEditAction || hasDeleteAction || hasViewAction;

                  const actionCount = [
                    hasEditAction,
                    hasDeleteAction,
                    hasViewAction,
                  ].filter(Boolean).length;

                  return (
                    <View
                      key={company.id}
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
                            contentScrollRefs.current.set(company.id, ref);
                            if (scrollXRef.current > 0) {
                              requestAnimationFrame(() => {
                                ref.scrollTo({
                                  x: scrollXRef.current,
                                  animated: false,
                                });
                              });
                            }
                          } else {
                            contentScrollRefs.current.delete(company.id);
                          }
                        }}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        onScroll={(e) => handleContentScroll(e, company.id)}
                        scrollEventThrottle={16}
                        scrollEnabled={true}
                        contentContainerStyle={{
                          minWidth: totalTableWidth - columnWidths.actions,
                          paddingRight: columnWidths.actions,
                        }}
                        style={{ flex: 1 }}
                        pointerEvents="box-none"
                      >
                        <View
                          className="flex-row"
                          style={{
                            minWidth: totalTableWidth - columnWidths.actions,
                          }}
                        >
                          {/* Nom */}
                          <View
                            style={{ width: columnWidths.name }}
                            className="px-3 py-4 justify-center"
                          >
                            <Text
                              className={`text-sm font-medium ${
                                isDark ? "text-gray-100" : "text-gray-900"
                              }`}
                              numberOfLines={1}
                            >
                              {company.name}
                            </Text>
                          </View>

                          {/* Numéro d'enregistrement */}
                          <View
                            style={{ width: columnWidths.registrationNumber }}
                            className="px-3 py-4 justify-center"
                          >
                            <Text
                              className={`text-xs ${
                                isDark ? "text-gray-400" : "text-gray-600"
                              }`}
                              numberOfLines={1}
                            >
                              {company.registrationNumber}
                            </Text>
                          </View>

                          {/* Pays */}
                          <View
                            style={{ width: columnWidths.country }}
                            className="px-3 py-4 justify-center"
                          >
                            <Text
                              className={`text-xs ${
                                isDark ? "text-gray-400" : "text-gray-600"
                              }`}
                              numberOfLines={1}
                            >
                              {typeof company.country === "object"
                                ? company.country.name
                                : company.country || "N/A"}
                            </Text>
                          </View>

                          {/* Secteur */}
                          <View
                            style={{ width: columnWidths.sector }}
                            className="px-3 py-4 justify-center"
                          >
                            <Text
                              className={`text-xs ${
                                isDark ? "text-gray-400" : "text-gray-600"
                              }`}
                              numberOfLines={1}
                            >
                              {company.activitySector?.name || "-"}
                            </Text>
                          </View>

                          {/* Email */}
                          <View
                            style={{ width: columnWidths.email }}
                            className="px-3 py-4 justify-center"
                          >
                            <Text
                              className={`text-xs ${
                                isDark ? "text-gray-400" : "text-gray-600"
                              }`}
                              numberOfLines={1}
                            >
                              {company.email || "-"}
                            </Text>
                          </View>

                          {/* Statut */}
                          <View
                            style={{ width: columnWidths.status }}
                            className="px-3 py-4 justify-center"
                          >
                            <View
                              className="px-2 py-1 rounded-full self-start"
                              style={{
                                backgroundColor:
                                  company.status === "ACTIVE"
                                    ? "#10b98120"
                                    : "#6b728020",
                              }}
                            >
                              <Text
                                className="text-xs font-medium"
                                style={{
                                  color:
                                    company.status === "ACTIVE"
                                      ? "#10b981"
                                      : "#6b7280",
                                }}
                              >
                                {company.status === "ACTIVE" ? "Actif" : "Inactif"}
                              </Text>
                            </View>
                          </View>

                          {/* Dépenses */}
                          <View
                            style={{ width: columnWidths.expenses }}
                            className="px-3 py-4 justify-center"
                          >
                            <Text
                              className={`text-xs ${
                                isDark ? "text-gray-400" : "text-gray-600"
                              }`}
                            >
                              {company._count?.expenses || 0}
                            </Text>
                          </View>

                          {/* Investissements */}
                          <View
                            style={{ width: columnWidths.investments }}
                            className="px-3 py-4 justify-center"
                          >
                            <Text
                              className={`text-xs ${
                                isDark ? "text-gray-400" : "text-gray-600"
                              }`}
                            >
                              {company._count?.investments || 0}
                            </Text>
                          </View>

                          {/* Emprunts */}
                          <View
                            style={{ width: columnWidths.loans }}
                            className="px-3 py-4 justify-center"
                          >
                            <Text
                              className={`text-xs ${
                                isDark ? "text-gray-400" : "text-gray-600"
                              }`}
                            >
                              {company._count?.loans || 0}
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
                          borderLeftColor: isDark ? "#1e293b" : "#e5e7eb",
                          zIndex: 10,
                        }}
                        className="px-3 justify-center items-center flex-row gap-2"
                        pointerEvents="box-none"
                      >
                        {hasAnyAction ? (
                          <>
                            {hasViewAction && (
                              <TouchableOpacity
                                className="rounded-full"
                                style={{
                                  backgroundColor: `${CHART_COLOR}20`,
                                  padding: actionCount >= 3 ? 6 : 8,
                                }}
                                activeOpacity={0.7}
                                onPress={() => {
                                  handleView(company);
                                }}
                              >
                                <HugeiconsIcon
                                  icon={EyeIcon}
                                  size={actionCount >= 3 ? 14 : 16}
                                  color={CHART_COLOR}
                                />
                              </TouchableOpacity>
                            )}
                            {hasEditAction && (
                              <TouchableOpacity
                                className="rounded-full"
                                style={{
                                  backgroundColor: `${CHART_COLOR}20`,
                                  padding: actionCount >= 3 ? 6 : 8,
                                }}
                                activeOpacity={0.7}
                                onPress={() => {
                                  handleEdit(company);
                                }}
                              >
                                <HugeiconsIcon
                                  icon={Edit01Icon}
                                  size={actionCount >= 3 ? 14 : 16}
                                  color={CHART_COLOR}
                                />
                              </TouchableOpacity>
                            )}
                            {hasDeleteAction && (
                              <TouchableOpacity
                                className="rounded-full"
                                style={{
                                  backgroundColor: "#ef444420",
                                  padding: actionCount >= 3 ? 6 : 8,
                                }}
                                activeOpacity={0.7}
                                onPress={() => {
                                  handleDelete(company);
                                }}
                              >
                                <HugeiconsIcon
                                  icon={Delete01Icon}
                                  size={actionCount >= 3 ? 14 : 16}
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

      {/* Modal/Drawer de formulaire (Add/Edit) */}
      <Drawer
        open={showCompanyForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowCompanyForm(false);
            setEditingCompany(null);
            setDocuments([]);
            setCompanyDocuments([]);
          }
        }}
        title={editingCompany ? "Modifier l'entreprise" : "Nouvelle entreprise"}
        footer={
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => {
                setShowCompanyForm(false);
                setEditingCompany(null);
                setDocuments([]);
                setCompanyDocuments([]);
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
            <Button
              onPress={handleSubmit}
              disabled={isSubmitting}
              loading={isSubmitting}
              className="flex-1 h-12 py-0"
              style={{ backgroundColor: CHART_COLOR }}
            >
              {editingCompany ? "Mettre à jour" : "Créer"}
            </Button>
          </View>
        }
      >
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={{ gap: 20 }}>
            {/* Nom */}
            <View>
              <Text
                className={`text-sm font-semibold mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Nom de l'entreprise <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                value={formData.name}
                onChangeText={(text) =>
                  setFormData({ ...formData, name: text })
                }
                placeholder="Nom de l'entreprise"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                className={`px-4 py-3 rounded-xl border text-sm ${
                  isDark
                    ? "bg-[#1e293b] border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                style={{
                  textAlignVertical: 'center',
                  includeFontPadding: false,
                  paddingVertical: 0,
                }}
              />
            </View>

            {/* Numéro d'enregistrement */}
            <View>
              <Text
                className={`text-sm font-semibold mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Numéro d'enregistrement <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                value={formData.registrationNumber}
                onChangeText={(text) =>
                  setFormData({ ...formData, registrationNumber: text })
                }
                placeholder="Numéro d'enregistrement"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                className={`px-4 py-3 rounded-xl border text-sm ${
                  isDark
                    ? "bg-[#1e293b] border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                style={{
                  textAlignVertical: 'center',
                  includeFontPadding: false,
                  paddingVertical: 0,
                }}
              />
            </View>

            {/* Pays */}
            <Select
              label="Pays"
              required
              value={formData.countryId}
              onValueChange={(value) =>
                setFormData({ ...formData, countryId: value })
              }
              placeholder="Sélectionner un pays"
              options={
                countries?.map((country: Country) => ({
                  label: country.name,
                  value: country.id,
                })) || []
              }
            />

            {/* Devise */}
            <Select
              label="Devise"
              required
              value={formData.currency}
              onValueChange={(value) =>
                setFormData({ ...formData, currency: value })
              }
              placeholder="Sélectionner une devise"
              options={CURRENCIES.map((currency) => ({
                label: `${currency.code} - ${currency.name}`,
                value: currency.code,
              }))}
            />

            {/* Secteur d'activité */}
            {activitySectors && activitySectors.length > 0 && (
              <Select
                label="Secteur d'activité"
                required
                value={formData.activitySectorId}
                onValueChange={(value) =>
                  setFormData({ ...formData, activitySectorId: value })
                }
                placeholder="Sélectionner un secteur d'activité"
                options={activitySectors.map((sector: ActivitySector) => ({
                  label: sector.name,
                  value: sector.id,
                }))}
              />
            )}

            {/* Email */}
            <View>
              <Text
                className={`text-sm font-semibold mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Email
              </Text>
              <TextInput
                value={formData.email}
                onChangeText={(text) =>
                  setFormData({ ...formData, email: text })
                }
                placeholder="email@example.com"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                keyboardType="email-address"
                autoCapitalize="none"
                className={`px-4 py-3 rounded-xl border text-sm ${
                  isDark
                    ? "bg-[#1e293b] border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                style={{
                  textAlignVertical: 'center',
                  includeFontPadding: false,
                  paddingVertical: 0,
                }}
              />
            </View>

            {/* Téléphone */}
            <View>
              <Text
                className={`text-sm font-semibold mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Téléphone
              </Text>
              <TextInput
                value={formData.phone}
                onChangeText={(text) =>
                  setFormData({ ...formData, phone: text })
                }
                placeholder="+224 XXX XXX XXX"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                keyboardType="phone-pad"
                className={`px-4 py-3 rounded-xl border text-sm ${
                  isDark
                    ? "bg-[#1e293b] border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                style={{
                  textAlignVertical: 'center',
                  includeFontPadding: false,
                  paddingVertical: 0,
                }}
              />
            </View>

            {/* Site web */}
            <View>
              <Text
                className={`text-sm font-semibold mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Site web
              </Text>
              <TextInput
                value={formData.website}
                onChangeText={(text) =>
                  setFormData({ ...formData, website: text })
                }
                placeholder="https://example.com"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                keyboardType="url"
                autoCapitalize="none"
                className={`px-4 py-3 rounded-xl border text-sm ${
                  isDark
                    ? "bg-[#1e293b] border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                style={{
                  textAlignVertical: 'center',
                  includeFontPadding: false,
                  paddingVertical: 0,
                }}
              />
            </View>

            {/* Adresse */}
            <View>
              <Text
                className={`text-sm font-semibold mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Adresse
              </Text>
              <TextInput
                value={formData.address}
                onChangeText={(text) =>
                  setFormData({ ...formData, address: text })
                }
                placeholder="Adresse complète"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                multiline
                numberOfLines={3}
                className={`px-4 py-3 rounded-xl border text-sm ${
                  isDark
                    ? "bg-[#1e293b] border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                style={{ textAlignVertical: "top", minHeight: 80 }}
              />
            </View>

            {/* Seuil de dépenses */}
            <View>
              <Text
                className={`text-sm font-semibold mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Seuil de dépenses
              </Text>
              <TextInput
                value={formData.expenseThreshold}
                onChangeText={(text) => {
                  // Permettre uniquement les nombres et un point décimal
                  const numericValue = text.replace(/[^0-9.]/g, '');
                  // Permettre un seul point décimal
                  const parts = numericValue.split('.');
                  const filteredValue = parts.length > 2 
                    ? parts[0] + '.' + parts.slice(1).join('')
                    : numericValue;
                  setFormData({ ...formData, expenseThreshold: filteredValue });
                }}
                placeholder="0"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                keyboardType="numeric"
                className={`px-4 py-3 rounded-xl border text-sm ${
                  isDark
                    ? "bg-[#1e293b] border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                style={{
                  textAlignVertical: 'center',
                  includeFontPadding: false,
                  paddingVertical: 0,
                }}
              />
            </View>

            {/* Documents existants (en mode édition) */}
            {editingCompany && companyDocuments.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text
                  className={`text-sm font-semibold mb-3 ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Documents existants ({companyDocuments.length})
                </Text>
                {companyDocuments.map((doc) => (
                  <SwipeableCompanyDocument
                    key={doc.id}
                    doc={doc}
                    editingCompany={editingCompany}
                    isDark={isDark}
                    onReload={async () => {
                      await loadCompanyDocuments(editingCompany.id);
                    }}
                    onOpenDocument={openDocument}
                  />
                ))}
              </View>
            )}

            {/* Nouveaux documents */}
            {documents.length > 0 && (
              <View style={{ marginTop: 8 }}>
                <Text
                  className={`text-sm font-semibold mb-3 ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Nouveaux documents ({documents.length})
                </Text>
                <View style={{ gap: 12 }}>
                  {documents.map((doc) => (
                    <View
                      key={doc.id}
                      className={`flex-row items-center gap-3 p-4 rounded-lg border ${
                        isDark
                          ? "bg-[#1e293b] border-gray-700"
                          : "bg-gray-50 border-gray-200"
                      }`}
                    >
                      <HugeiconsIcon
                        icon={File01Icon}
                        size={18}
                        color={isDark ? "#9ca3af" : "#6b7280"}
                      />
                      <View className="flex-1">
                        <TextInput
                          value={doc.title}
                          onChangeText={(text) => {
                            setDocuments(
                              documents.map((d) =>
                                d.id === doc.id ? { ...d, title: text } : d
                              )
                            );
                          }}
                          placeholder="Intitulé du document"
                          placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                          className={`text-sm px-3 py-2 rounded-lg border ${
                            isDark
                              ? "bg-[#0f172a] border-gray-600 text-gray-100"
                              : "bg-white border-gray-300 text-gray-900"
                          }`}
                          style={{
                            textAlignVertical: 'center',
                            includeFontPadding: false,
                            paddingVertical: 0,
                          }}
                        />
                        <Text
                          className={`text-xs mt-2 ${
                            isDark ? "text-gray-500" : "text-gray-500"
                          }`}
                          numberOfLines={1}
                        >
                          {doc.file.name}
                        </Text>
                      </View>
                      <TouchableOpacity
                        onPress={() => {
                          setDocuments(documents.filter((d) => d.id !== doc.id));
                        }}
                        className="p-2 rounded-full"
                        style={{ backgroundColor: "#ef444420" }}
                        activeOpacity={0.7}
                      >
                        <HugeiconsIcon
                          icon={Cancel01Icon}
                          size={18}
                          color="#ef4444"
                        />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Bouton Ajouter document */}
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
                {isAddingDocument ? "Ajout..." : "Ajouter un document"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Drawer>

      {/* Modal de visualisation */}
      <Modal
        visible={showViewModal}
        transparent
        animationType="slide"
        onRequestClose={() => {
          setShowViewModal(false);
          setViewingCompany(null);
          setCompanyDocuments([]);
        }}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            setShowViewModal(false);
            setViewingCompany(null);
            setCompanyDocuments([]);
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
                  Détails de l'entreprise
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    setShowViewModal(false);
                    setViewingCompany(null);
                    setCompanyDocuments([]);
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

              {viewingCompany && (
                <>
                  {/* Informations */}
                  <View className="mb-6">
                    <View className="flex-row justify-between mb-4">
                      <View className="flex-1 mr-2">
                        <Text
                          className={`text-xs mb-1 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          Nom
                        </Text>
                        <Text
                          className={`text-sm font-medium ${
                            isDark ? "text-gray-100" : "text-gray-900"
                          }`}
                        >
                          {viewingCompany.name}
                        </Text>
                      </View>
                      <View className="flex-1 ml-2">
                        <Text
                          className={`text-xs mb-1 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          Statut
                        </Text>
                        <View
                          className="px-2 py-1 rounded-full self-start"
                          style={{
                            backgroundColor:
                              viewingCompany.status === "ACTIVE"
                                ? "#10b98120"
                                : "#6b728020",
                          }}
                        >
                          <Text
                            className="text-xs font-medium"
                            style={{
                              color:
                                viewingCompany.status === "ACTIVE"
                                  ? "#10b981"
                                  : "#6b7280",
                            }}
                          >
                            {viewingCompany.status === "ACTIVE"
                              ? "Actif"
                              : "Inactif"}
                          </Text>
                        </View>
                      </View>
                    </View>

                    <View className="flex-row justify-between mb-4">
                      <View className="flex-1 mr-2">
                        <Text
                          className={`text-xs mb-1 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          Numéro d'enregistrement
                        </Text>
                        <Text
                          className={`text-sm font-medium ${
                            isDark ? "text-gray-100" : "text-gray-900"
                          }`}
                        >
                          {viewingCompany.registrationNumber}
                        </Text>
                      </View>
                      <View className="flex-1 ml-2">
                        <Text
                          className={`text-xs mb-1 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          Pays
                        </Text>
                        <Text
                          className={`text-sm font-medium ${
                            isDark ? "text-gray-100" : "text-gray-900"
                          }`}
                        >
                          {typeof viewingCompany.country === "object"
                            ? viewingCompany.country.name
                            : viewingCompany.country || "N/A"}
                        </Text>
                      </View>
                    </View>

                    {viewingCompany.activitySector && (
                      <View className="mb-4">
                        <Text
                          className={`text-xs mb-1 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          Secteur d'activité
                        </Text>
                        <Text
                          className={`text-sm font-medium ${
                            isDark ? "text-gray-100" : "text-gray-900"
                          }`}
                        >
                          {viewingCompany.activitySector.name}
                        </Text>
                      </View>
                    )}

                    {viewingCompany.email && (
                      <View className="mb-4">
                        <Text
                          className={`text-xs mb-1 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          Email
                        </Text>
                        <Text
                          className={`text-sm font-medium ${
                            isDark ? "text-gray-100" : "text-gray-900"
                          }`}
                        >
                          {viewingCompany.email}
                        </Text>
                      </View>
                    )}

                    {viewingCompany.phone && (
                      <View className="mb-4">
                        <Text
                          className={`text-xs mb-1 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          Téléphone
                        </Text>
                        <Text
                          className={`text-sm font-medium ${
                            isDark ? "text-gray-100" : "text-gray-900"
                          }`}
                        >
                          {viewingCompany.phone}
                        </Text>
                      </View>
                    )}

                    {viewingCompany.website && (
                      <View className="mb-4">
                        <Text
                          className={`text-xs mb-1 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          Site web
                        </Text>
                        <TouchableOpacity
                          onPress={() => {
                            const url = viewingCompany.website?.startsWith("http")
                              ? viewingCompany.website
                              : `https://${viewingCompany.website}`;
                            Linking.openURL(url).catch(() => {
                              Alert.alert("Erreur", "Impossible d'ouvrir l'URL");
                            });
                          }}
                        >
                          <Text
                            className={`text-sm font-medium ${
                              isDark ? "text-blue-400" : "text-blue-600"
                            }`}
                          >
                            {viewingCompany.website}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    {viewingCompany.address && (
                      <View className="mb-4">
                        <Text
                          className={`text-xs mb-1 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          Adresse
                        </Text>
                        <Text
                          className={`text-sm ${
                            isDark ? "text-gray-100" : "text-gray-900"
                          }`}
                        >
                          {viewingCompany.address}
                        </Text>
                      </View>
                    )}

                    {viewingCompany.expenseThreshold && (
                      <View className="mb-4">
                        <Text
                          className={`text-xs mb-1 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          Seuil de dépenses
                        </Text>
                        <Text
                          className={`text-sm font-medium ${
                            isDark ? "text-gray-100" : "text-gray-900"
                          }`}
                        >
                          {viewingCompany.expenseThreshold.toLocaleString("fr-FR")}{" "}
                          {viewingCompany.currency || "GNF"}
                        </Text>
                      </View>
                    )}

                    {/* Statistiques */}
                    <View className="mb-4">
                      <Text
                        className={`text-xs mb-2 ${
                          isDark ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        Statistiques
                      </Text>
                      <View className="flex-row gap-4">
                        <View className="flex-1 p-3 rounded-lg bg-blue-500/10">
                          <Text
                            className={`text-xs mb-1 ${
                              isDark ? "text-gray-400" : "text-gray-600"
                            }`}
                          >
                            Dépenses
                          </Text>
                          <Text
                            className={`text-lg font-bold ${
                              isDark ? "text-gray-100" : "text-gray-900"
                            }`}
                          >
                            {viewingCompany._count?.expenses || 0}
                          </Text>
                        </View>
                        <View className="flex-1 p-3 rounded-lg bg-green-500/10">
                          <Text
                            className={`text-xs mb-1 ${
                              isDark ? "text-gray-400" : "text-gray-600"
                            }`}
                          >
                            Investissements
                          </Text>
                          <Text
                            className={`text-lg font-bold ${
                              isDark ? "text-gray-100" : "text-gray-900"
                            }`}
                          >
                            {viewingCompany._count?.investments || 0}
                          </Text>
                        </View>
                        <View className="flex-1 p-3 rounded-lg bg-orange-500/10">
                          <Text
                            className={`text-xs mb-1 ${
                              isDark ? "text-gray-400" : "text-gray-600"
                            }`}
                          >
                            Emprunts
                          </Text>
                          <Text
                            className={`text-lg font-bold ${
                              isDark ? "text-gray-100" : "text-gray-900"
                            }`}
                          >
                            {viewingCompany._count?.loans || 0}
                          </Text>
                        </View>
                      </View>
                    </View>
                  </View>

                  {/* Documents associés */}
                  <View className="mb-6">
                    <Text
                      className={`text-sm font-semibold mb-3 ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Documents associés (
                      {(viewingCompany as any).documents?.length ||
                        companyDocuments.length ||
                        0}
                      )
                    </Text>
                    {((viewingCompany as any).documents?.length > 0 ||
                      companyDocuments.length > 0) ? (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        <View className="flex-row gap-3">
                          {((viewingCompany as any).documents || companyDocuments).map(
                            (doc: any) => (
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
                                    "fr-FR"
                                  )}
                                </Text>
                              </TouchableOpacity>
                            )
                          )}
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
                </>
              )}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Drawer de confirmation de suppression */}
      <Drawer
        open={showDeleteDrawer}
        onOpenChange={(open) => {
          if (!open) {
            setShowDeleteDrawer(false);
            setCompanyToDelete(null);
            setDeleteConfirmation("");
          }
        }}
        title="Supprimer l'entreprise"
        footer={
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={() => {
                setShowDeleteDrawer(false);
                setCompanyToDelete(null);
                setDeleteConfirmation("");
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
            <Button
              onPress={confirmDelete}
              disabled={
                isDeleting ||
                !companyToDelete ||
                deleteConfirmation.toLowerCase().trim() !==
                  companyToDelete.name.toLowerCase().trim()
              }
              loading={isDeleting}
              className="flex-1 h-12 py-0"
              style={{
                backgroundColor: "#ef4444",
                opacity:
                  companyToDelete &&
                  deleteConfirmation.toLowerCase().trim() ===
                    companyToDelete.name.toLowerCase().trim() &&
                  !isDeleting
                    ? 1
                    : 0.5,
              }}
            >
              Supprimer
            </Button>
          </View>
        }
      >
        {companyToDelete && (
          <View style={{ gap: 20 }}>
            <Text
              className={`text-base leading-6 ${
                isDark ? "text-gray-200" : "text-gray-800"
              }`}
            >
              Êtes-vous sûr de vouloir supprimer l'entreprise{" "}
              <Text className="font-bold">{companyToDelete.name}</Text> ?
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
                  Tapez le nom de l'entreprise pour confirmer :
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Clipboard.setString(companyToDelete.name);
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
                placeholder={companyToDelete.name}
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
                style={{
                  textAlignVertical: 'center',
                  includeFontPadding: false,
                  paddingVertical: 0,
                }}
              />
            </View>
          </View>
        )}
      </Drawer>
    </SafeAreaView>
  );
}
