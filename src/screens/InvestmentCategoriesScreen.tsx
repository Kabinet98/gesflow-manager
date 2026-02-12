import React, {
  useState,
  useMemo,
  useRef,
  useCallback,
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
  PlusSignCircleIcon,
  Edit01Icon,
  Delete01Icon,
  Copy01Icon,
  MoneyIcon,
} from "@hugeicons/core-free-icons";
import { InvestmentCategoriesSkeleton } from "@/components/skeletons/InvestmentCategoriesSkeleton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { REFRESH_CONTROL_COLOR, TAB_BAR_PADDING_BOTTOM } from "@/constants/layout";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Switch } from "@/components/ui/Switch";
import { getErrorMessage } from "@/utils/get-error-message";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_COLOR = "#0ea5e9";

interface InvestmentCategory {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  _count?: {
    investments: number;
  };
}

// Fonction pour normaliser le texte de confirmation
const normalizeConfirmationText = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ");
};

export function InvestmentCategoriesScreen() {
  const { isDark } = useTheme();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [showDeleteDrawer, setShowDeleteDrawer] = useState(false);
  const [editingCategory, setEditingCategory] = useState<InvestmentCategory | null>(null);
  const [categoryToDelete, setCategoryToDelete] = useState<InvestmentCategory | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // État du formulaire
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isActive: true,
  });

  // Refs pour synchroniser le scroll
  const headerScrollRef = useRef<ScrollView>(null);
  const contentScrollRefs = useRef<Map<string, ScrollView>>(new Map());
  const scrollXRef = useRef(0);
  const isScrollingRef = useRef(false);

  const canView = hasPermission("investment-categories.view");
  const canCreate = hasPermission("investment-categories.create");
  const canUpdate = hasPermission("investment-categories.update");
  const canDelete = hasPermission("investment-categories.delete");

  // Récupérer les catégories d'investissements
  const {
    data: categories,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["investment-categories"],
    queryFn: async () => {
      try {
        const response = await api.get("/api/investment-categories");
        return response.data || [];
      } catch (err: any) {
        throw err;
      }
    },
    enabled: canView,
  });

  // Filtrer les catégories
  const filteredCategories = useMemo(() => {
    if (!categories) return [];

    return categories.filter((category: InvestmentCategory) => {
      const matchesSearch =
        category.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        category.description?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
  }, [categories, searchTerm]);

  // Vérifier si tous les champs obligatoires sont remplis
  const isFormValid = useMemo(() => {
    return formData.name.trim() !== "";
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

  // Gestion du scroll synchronisé
  const handleHeaderScroll = useCallback(
    (event: any) => {
      if (isScrollingRef.current) return;
      const offsetX = event.nativeEvent.contentOffset.x;
      scrollXRef.current = offsetX;
      isScrollingRef.current = true;

      contentScrollRefs.current.forEach((scrollView) => {
        if (scrollView) {
          scrollView.scrollTo({ x: offsetX, animated: false });
        }
      });

      setTimeout(() => {
        isScrollingRef.current = false;
      }, 100);
    },
    []
  );

  const handleContentScroll = useCallback(
    (categoryId: string) => (event: any) => {
      if (isScrollingRef.current) return;
      const offsetX = event.nativeEvent.contentOffset.x;
      scrollXRef.current = offsetX;
      isScrollingRef.current = true;

      if (headerScrollRef.current) {
        headerScrollRef.current.scrollTo({ x: offsetX, animated: false });
      }

      contentScrollRefs.current.forEach((scrollView, id) => {
        if (id !== categoryId && scrollView) {
          scrollView.scrollTo({ x: offsetX, animated: false });
        }
      });

      setTimeout(() => {
        isScrollingRef.current = false;
      }, 100);
    },
    []
  );

  // Largeurs des colonnes
  const columnWidths = {
    name: 200,
    description: 350,
    status: 120,
    actions: 100,
  };

  const totalTableWidth = Object.values(columnWidths).reduce(
    (sum, width) => sum + width,
    0
  );

  // Handlers
  const handleCreate = () => {
    if (!canCreate) {
      return;
    }
    setFormData({
      name: "",
      description: "",
      isActive: true,
    });
    setEditingCategory(null);
    setShowCategoryForm(true);
  };

  const handleEdit = (category: InvestmentCategory) => {
    if (!canUpdate) {
      return;
    }
    setFormData({
      name: category.name || "",
      description: category.description || "",
      isActive: category.isActive ?? true,
    });
    setEditingCategory(category);
    setShowCategoryForm(true);
  };

  const handleDelete = (category: InvestmentCategory) => {
    if (!canDelete) {
      return;
    }
    setCategoryToDelete(category);
    setDeleteConfirmation("");
    setShowDeleteDrawer(true);
  };

  const handleCopyCategoryName = () => {
    if (categoryToDelete) {
      Clipboard.setString(categoryToDelete.name);
      setDeleteConfirmation(categoryToDelete.name);
      Alert.alert("Copié", "Le nom de la catégorie a été copié");
    }
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert("Erreur", "Le nom est requis");
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingCategory) {
        await api.put(`/api/investment-categories/${editingCategory.id}`, formData);
      } else {
        const res = await api.post("/api/investment-categories", formData);
      }

      await queryClient.invalidateQueries({ queryKey: ["investment-categories"] });
      setShowCategoryForm(false);
      setFormData({
        name: "",
        description: "",
        isActive: true,
      });
      setEditingCategory(null);
      Alert.alert("Succès", editingCategory ? "Catégorie d'investissement modifiée avec succès" : "Catégorie d'investissement créée avec succès");
    } catch (err: any) {
      Alert.alert("Erreur", getErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!categoryToDelete) return;

    const normalizedConfirmation = normalizeConfirmationText(deleteConfirmation);
    const normalizedCategoryName = normalizeConfirmationText(categoryToDelete.name);

    if (normalizedConfirmation !== normalizedCategoryName) {
      Alert.alert("Erreur", "Le nom de confirmation ne correspond pas");
      return;
    }

    setIsDeleting(true);
    try {
      const id = categoryToDelete.id;
      const name = categoryToDelete.name;
      await api.delete(`/api/investment-categories/${id}`);

      await queryClient.invalidateQueries({ queryKey: ["investment-categories"] });
      setShowDeleteDrawer(false);
      setCategoryToDelete(null);
      setDeleteConfirmation("");
      Alert.alert("Succès", "Catégorie d'investissement supprimée avec succès");
    } catch (err: any) {
      Alert.alert("Erreur", getErrorMessage(err));
    } finally {
      setIsDeleting(false);
    }
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
        {/* Header avec recherche et boutons */}
        <View className="px-6 pt-20 pb-4">
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
        {isLoading || !categories ? (
          <InvestmentCategoriesSkeleton />
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
                    style={{
                      width: columnWidths.name,
                      borderRightWidth: 1,
                      borderRightColor: isDark ? "#334155" : "#e5e7eb",
                    }}
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

                  {/* Description */}
                  <View
                    style={{
                      width: columnWidths.description,
                      borderRightWidth: 1,
                      borderRightColor: isDark ? "#334155" : "#e5e7eb",
                    }}
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
                className="flex-row items-center justify-center px-2"
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
              {filteredCategories.length === 0 ? (
                <View className="flex-1 justify-center items-center py-12">
                  <HugeiconsIcon
                    icon={MoneyIcon}
                    size={48}
                    color={isDark ? "#6b7280" : "#9ca3af"}
                  />
                  <Text
                    className={`text-center mt-4 ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    {searchTerm
                      ? "Aucune catégorie trouvée"
                      : "Aucune catégorie d'investissement disponible"}
                  </Text>
                </View>
              ) : (
                filteredCategories.map((category: InvestmentCategory) => (
                  <CategoryRow
                    key={category.id}
                    category={category}
                    isDark={isDark}
                    columnWidths={columnWidths}
                    totalTableWidth={totalTableWidth}
                    handleContentScroll={handleContentScroll}
                    handleEdit={handleEdit}
                    handleDelete={handleDelete}
                    canUpdate={canUpdate}
                    canDelete={canDelete}
                    contentScrollRefs={contentScrollRefs}
                    scrollXRef={scrollXRef}
                  />
                ))
              )}
            </ScrollView>
          </View>
        )}
      </View>

      {/* Drawer Formulaire */}
      <Drawer
        open={showCategoryForm}
        onOpenChange={setShowCategoryForm}
        title={editingCategory ? "Modifier la catégorie d'investissement" : "Nouvelle catégorie d'investissement"}
      >
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-4 pb-4">
            <View className="gap-2">
              <Text
                className={`text-sm font-semibold ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Nom <Text className="text-red-500">*</Text>
              </Text>
              <Input
                value={formData.name}
                onChangeText={(text) =>
                  setFormData({ ...formData, name: text })
                }
                placeholder="Nom de la catégorie d'investissement"
              />
            </View>

            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Description
              </Text>
              <Textarea
                value={formData.description}
                onChangeText={(text) =>
                  setFormData({ ...formData, description: text })
                }
                placeholder="Description de la catégorie d'investissement"
                numberOfLines={4}
              />
            </View>

            <View>
              <View className="flex-row items-center justify-between">
                <Text className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Actif
                </Text>
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData({ ...formData, isActive: checked })
                  }
                />
              </View>
            </View>

            <View className="flex-row gap-3 pt-4">
              <Button
                variant="outline"
                onPress={() => {
                  setShowCategoryForm(false);
                  setFormData({
                    name: "",
                    description: "",
                    isActive: true,
                  });
                  setEditingCategory(null);
                }}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onPress={handleSubmit}
                disabled={isSubmitting || !isFormValid}
                className="flex-1"
                style={{ backgroundColor: CHART_COLOR }}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text className="text-white font-semibold">
                    {editingCategory ? "Modifier" : "Créer"}
                  </Text>
                )}
              </Button>
            </View>
          </View>
        </ScrollView>
      </Drawer>

      {/* Drawer Confirmation Suppression */}
      <Drawer
        open={showDeleteDrawer}
        onOpenChange={setShowDeleteDrawer}
        title="Supprimer la catégorie d'investissement"
      >
        {categoryToDelete && (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="gap-4 pb-4">
              <Text
                className={`text-base ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Êtes-vous sûr de vouloir supprimer la catégorie d'investissement{" "}
                <Text className="font-semibold">{categoryToDelete.name}</Text> ?
                Cette action est irréversible.
              </Text>

              {categoryToDelete._count?.investments && categoryToDelete._count.investments > 0 && (
                <View
                  className={`p-3 rounded-lg ${
                    isDark ? "bg-yellow-900/20" : "bg-yellow-50"
                  }`}
                >
                  <Text
                    className={`text-sm ${
                      isDark ? "text-yellow-200" : "text-yellow-800"
                    }`}
                  >
                    ⚠️ Cette catégorie d'investissement est associée à {categoryToDelete._count.investments}{" "}
                    investissement(s). La suppression peut affecter ces investissements.
                  </Text>
                </View>
              )}

              <View className="gap-2">
                <Text
                  className={`text-sm font-semibold ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Tapez le nom de la catégorie pour confirmer :{" "}
                  <Text
                    className="font-bold"
                    style={{ color: isDark ? "#f3f4f6" : "#111827" }}
                  >
                    {categoryToDelete.name}
                  </Text>
                </Text>
                <View className="flex-row items-center gap-2">
                  <TextInput
                    value={deleteConfirmation}
                    onChangeText={setDeleteConfirmation}
                    placeholder={categoryToDelete.name}
                    placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                    className={`flex-1 px-4 py-3 rounded-lg border ${
                      isDark
                        ? "bg-[#1e293b] border-gray-700 text-gray-100"
                        : "bg-gray-100 border-gray-300 text-gray-900"
                    }`}
                    style={{
                      textAlignVertical: "center",
                      includeFontPadding: false,
                      minHeight: 48,
                    }}
                  />
                  <TouchableOpacity
                    onPress={handleCopyCategoryName}
                    className={`p-2.5 rounded-lg ${
                      isDark ? "bg-[#1e293b]" : "bg-gray-100"
                    }`}
                    activeOpacity={0.7}
                  >
                    <HugeiconsIcon
                      icon={Copy01Icon}
                      size={18}
                      color={isDark ? "#9ca3af" : "#6b7280"}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              <View className="flex-row gap-3 pt-4">
                <Button
                  variant="outline"
                  onPress={() => {
                    setShowDeleteDrawer(false);
                    setCategoryToDelete(null);
                    setDeleteConfirmation("");
                  }}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onPress={handleConfirmDelete}
                  disabled={
                    isDeleting ||
                    normalizeConfirmationText(deleteConfirmation) !==
                      normalizeConfirmationText(categoryToDelete.name)
                  }
                  className="flex-1"
                  style={{ backgroundColor: "#ef4444" }}
                >
                  {isDeleting ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text className="text-white font-semibold">Supprimer</Text>
                  )}
                </Button>
              </View>
            </View>
          </ScrollView>
        )}
      </Drawer>
    </SafeAreaView>
  );
}

// Composant pour une ligne de catégorie
interface CategoryRowProps {
  category: InvestmentCategory;
  isDark: boolean;
  columnWidths: Record<string, number>;
  totalTableWidth: number;
  handleContentScroll: (categoryId: string) => (event: any) => void;
  handleEdit: (category: InvestmentCategory) => void;
  handleDelete: (category: InvestmentCategory) => void;
  canUpdate: boolean;
  canDelete: boolean;
  contentScrollRefs: React.MutableRefObject<Map<string, ScrollView>>;
  scrollXRef: React.MutableRefObject<number>;
}

const CategoryRow = React.memo(({
  category,
  isDark,
  columnWidths,
  totalTableWidth,
  handleContentScroll,
  handleEdit,
  handleDelete,
  canUpdate,
  canDelete,
  contentScrollRefs,
  scrollXRef,
}: CategoryRowProps) => {
  return (
    <View
      className={`border-b ${
        isDark ? "border-gray-800 bg-[#0f172a]" : "border-gray-100 bg-white"
      }`}
    >
      <ScrollView
        ref={(ref) => {
          if (ref) {
            contentScrollRefs.current.set(category.id, ref);
            if (scrollXRef.current > 0) {
              requestAnimationFrame(() => {
                ref.scrollTo({
                  x: scrollXRef.current,
                  animated: false,
                });
              });
            }
          } else {
            contentScrollRefs.current.delete(category.id);
          }
        }}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleContentScroll(category.id)}
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
          {/* Nom */}
          <View
            style={{
              width: columnWidths.name,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#1e293b" : "#e5e7eb",
            }}
            className="px-3 py-3"
          >
            <Text
              className={`text-sm font-medium ${
                isDark ? "text-gray-200" : "text-gray-900"
              }`}
              numberOfLines={1}
            >
              {category.name}
            </Text>
          </View>

          {/* Description */}
          <View
            style={{
              width: columnWidths.description,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#1e293b" : "#e5e7eb",
            }}
            className="px-3 py-3"
          >
            <Text
              className={`text-sm ${
                isDark ? "text-gray-300" : "text-gray-700"
              }`}
              numberOfLines={2}
            >
              {category.description || "-"}
            </Text>
          </View>

          {/* Statut */}
          <View
            style={{ width: columnWidths.status }}
            className="px-3 py-3"
          >
            <View
              className={`px-2 py-1 rounded-full self-start ${
                category.isActive
                  ? isDark
                    ? "bg-green-900"
                    : "bg-green-100"
                  : isDark
                  ? "bg-gray-800"
                  : "bg-gray-100"
              }`}
            >
              <Text
                className={`text-xs font-medium whitespace-nowrap ${
                  category.isActive
                    ? isDark
                      ? "text-green-200"
                      : "text-green-800"
                    : isDark
                    ? "text-gray-200"
                    : "text-gray-800"
                }`}
              >
                {category.isActive ? "Active" : "Inactive"}
              </Text>
            </View>
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
        className="flex-row items-center justify-center gap-1 px-2"
      >
        {canUpdate && (
          <TouchableOpacity
            onPress={() => handleEdit(category)}
            className="p-2 rounded-full"
            style={{
              backgroundColor: isDark ? "rgba(14, 165, 233, 0.1)" : "#e0f2fe",
            }}
            activeOpacity={0.7}
          >
            <HugeiconsIcon
              icon={Edit01Icon}
              size={18}
              color={CHART_COLOR}
            />
          </TouchableOpacity>
        )}
        {canDelete && (
          <TouchableOpacity
            onPress={() => handleDelete(category)}
            className="p-2 rounded-full"
            style={{
              backgroundColor: isDark ? "rgba(239, 68, 68, 0.1)" : "#fee2e2",
            }}
            activeOpacity={0.7}
          >
            <HugeiconsIcon
              icon={Delete01Icon}
              size={18}
              color="#ef4444"
            />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
});

CategoryRow.displayName = "CategoryRow";
