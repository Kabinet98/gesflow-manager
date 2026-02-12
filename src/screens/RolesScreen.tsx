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
import { authService } from "@/services/auth.service";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  Search01Icon,
  PlusSignCircleIcon,
  Edit01Icon,
  Delete01Icon,
  LockKeyIcon,
  EyeIcon,
  Copy01Icon,
} from "@hugeicons/core-free-icons";
import { RolesSkeleton } from "@/components/skeletons/RolesSkeleton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { REFRESH_CONTROL_COLOR, TAB_BAR_PADDING_BOTTOM } from "@/constants/layout";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { getErrorMessage } from "@/utils/get-error-message";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_COLOR = "#0ea5e9";

interface Permission {
  id: string;
  name: string;
  description: string | null;
  resource: string;
  action: string;
  resourceLabel?: string;
  actionLabel?: string;
}

interface RolePermission {
  id: string;
  permission: Permission;
}

interface Role {
  id: string;
  name: string;
  description: string | null;
  permissions: RolePermission[];
  _count: {
    users: number;
  };
}

// Fonction pour normaliser le texte de confirmation
const normalizeConfirmationText = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/\u00A0/g, " ") // Remplacer les espaces insécables par des espaces normaux
    .replace(/\s+/g, " "); // Normaliser les espaces multiples en un seul espace
};

export function RolesScreen() {
  const { isDark } = useTheme();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showRoleForm, setShowRoleForm] = useState(false);
  const [showDeleteDrawer, setShowDeleteDrawer] = useState(false);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleToDelete, setRoleToDelete] = useState<Role | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [selectedRoleForDetails, setSelectedRoleForDetails] = useState<Role | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // État du formulaire
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    selectedPermissions: [] as string[],
  });

  // Refs pour synchroniser le scroll
  const headerScrollRef = useRef<ScrollView>(null);
  const contentScrollRefs = useRef<Map<string, ScrollView>>(new Map());
  const scrollXRef = useRef(0);
  const isScrollingRef = useRef(false);

  const canView = hasPermission("roles.view");
  const canCreate = hasPermission("roles.create");
  const canUpdate = hasPermission("roles.update");
  const canDelete = hasPermission("roles.delete");

  // Récupérer l'ID de l'utilisateur actuel
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          setCurrentUserId(user.id);
        }
      } catch (err) {
        // Erreur silencieuse
      }
    };

    fetchUserInfo();
  }, []);

  // Récupérer les rôles
  const {
    data: roles,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["roles"],
    queryFn: async () => {
      try {
        const response = await api.get("/api/roles");
        return response.data;
      } catch (err: any) {
        throw err;
      }
    },
    enabled: canView,
  });

  // Récupérer les permissions
  const { data: permissionsData } = useQuery({
    queryKey: ["permissions"],
    queryFn: async () => {
      try {
        const response = await api.get("/api/permissions");
        return response.data;
      } catch (err) {
        return { permissions: [], groupedPermissions: {} };
      }
    },
  });

  const permissions: Permission[] = permissionsData?.permissions || [];
  const groupedPermissions: Record<string, Permission[]> = permissionsData?.groupedPermissions || {};

  // Filtrer les rôles
  const filteredRoles = useMemo(() => {
    if (!roles) return [];

    return roles.filter((role: Role) => {
      const matchesSearch =
        role.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        role.description?.toLowerCase().includes(searchTerm.toLowerCase());

      return matchesSearch;
    });
  }, [roles, searchTerm]);

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

  // Synchroniser le scroll entre header et contenu
  const handleContentScroll = useCallback((event: any, roleId?: string) => {
    if (isScrollingRef.current) return;

    const offsetX = event.nativeEvent.contentOffset.x;
    scrollXRef.current = offsetX;
    isScrollingRef.current = true;

    // Synchroniser le header
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollTo({ x: offsetX, animated: false });
    }

    // Synchroniser toutes les autres lignes
    contentScrollRefs.current.forEach((ref, id) => {
      if (id !== roleId && ref) {
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

    // Synchroniser toutes les lignes
    contentScrollRefs.current.forEach((ref) => {
      if (ref) {
        ref.scrollTo({ x: offsetX, animated: false });
      }
    });

    setTimeout(() => {
      isScrollingRef.current = false;
    }, 100);
  }, []);

  // Largeurs des colonnes
  const columnWidths = {
    name: 200,
    description: 250,
    permissions: 150,
    users: 120,
    actions: 120,
  };

  const totalTableWidth = Object.values(columnWidths).reduce(
    (sum, width) => sum + width,
    0
  );

  // Ouvrir le formulaire de création
  const handleCreate = () => {
    if (!canCreate) {
      Alert.alert("Permission refusée", "Vous n'avez pas la permission de créer un rôle");
      return;
    }
    setEditingRole(null);
    setFormData({
      name: "",
      description: "",
      selectedPermissions: [],
    });
    setShowRoleForm(true);
  };

  // Ouvrir le formulaire d'édition
  const handleEdit = (role: Role) => {
    if (!canUpdate) {
      Alert.alert("Permission refusée", "Vous n'avez pas la permission de modifier un rôle");
      return;
    }
    setEditingRole(role);
    setFormData({
      name: role.name,
      description: role.description || "",
      selectedPermissions: role.permissions.map((rp) => rp.permission.id),
    });
    setShowRoleForm(true);
  };

  // Ouvrir le drawer de détails
  const handleViewDetails = (role: Role) => {
    setSelectedRoleForDetails(role);
    setShowDetailsDrawer(true);
  };

  // Ouvrir le drawer de suppression
  const handleDelete = (role: Role) => {
    if (!canDelete) {
      Alert.alert("Permission refusée", "Vous n'avez pas la permission de supprimer un rôle");
      return;
    }

    // Vérifier si le rôle a des utilisateurs assignés
    if (role._count.users > 0) {
      Alert.alert(
        "Impossible de supprimer",
        `Ce rôle est utilisé par ${role._count.users} utilisateur(s) et ne peut pas être supprimé`
      );
      return;
    }

    // Empêcher la suppression du rôle Admin
    if (role.name === "Admin") {
      Alert.alert("Impossible de supprimer", "Le rôle Admin ne peut pas être supprimé");
      return;
    }

    setRoleToDelete(role);
    setDeleteConfirmation("");
    setShowDeleteDrawer(true);
  };

  // Soumettre le formulaire
  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      Alert.alert("Erreur", "Le nom du rôle est requis");
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingRole ? `/api/roles/${editingRole.id}` : "/api/roles";
      const method = editingRole ? "PUT" : "POST";

      const requestBody = {
        name: formData.name.trim(),
        description: formData.description || null,
        permissionIds: formData.selectedPermissions,
      };

      const response = await api({
        url,
        method,
        data: requestBody,
      });

      if (response.status === 201 || response.status === 200) {
        Alert.alert(
          "Succès",
          editingRole ? "Rôle mis à jour avec succès" : "Rôle créé avec succès"
        );
        setShowRoleForm(false);
        setEditingRole(null);
        setFormData({
          name: "",
          description: "",
          selectedPermissions: [],
        });

        // Rafraîchir les données
        await queryClient.invalidateQueries({ queryKey: ["roles"] });

        // Rafraîchir les permissions si le rôle modifié est celui de l'utilisateur actuel
        if (editingRole && currentUserId) {
          try {
            const userResponse = await api.get("/api/users/me");
            const currentUser = userResponse.data;
            if (currentUser.role?.id === response.data.id) {
              // Le rôle de l'utilisateur actuel a été modifié, rafraîchir les permissions
              await queryClient.invalidateQueries({ queryKey: ["permissions"] });
            }
          } catch (error) {
            // Erreur silencieuse
          }
        }
      }
    } catch (err: any) {
      Alert.alert("Erreur", getErrorMessage(err, "Erreur lors de l'opération"));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Supprimer le rôle
  const handleDeleteConfirm = async () => {
    if (!roleToDelete) return;

    // Vérifier la confirmation
    if (
      normalizeConfirmationText(deleteConfirmation) !==
      normalizeConfirmationText(roleToDelete.name)
    ) {
      Alert.alert("Erreur", "Le nom du rôle ne correspond pas");
      return;
    }

    setIsDeleting(true);
    try {
      const id = roleToDelete.id;
      const name = roleToDelete.name;
      const response = await api.delete(`/api/roles/${id}`);

      if (response.status === 200) {
        Alert.alert("Succès", "Rôle supprimé avec succès");
        setShowDeleteDrawer(false);
        setRoleToDelete(null);
        setDeleteConfirmation("");
        await queryClient.invalidateQueries({ queryKey: ["roles"] });
      }
    } catch (err: any) {
      Alert.alert("Erreur", getErrorMessage(err, "Erreur lors de la suppression"));
    } finally {
      setIsDeleting(false);
    }
  };

  // Toggle une permission
  const togglePermission = (permissionId: string) => {
    const currentPermissions = formData.selectedPermissions || [];
    const isSelected = currentPermissions.includes(permissionId);

    // Trouver la permission et sa ressource
    const permission = permissions.find((p) => p.id === permissionId);
    if (!permission) return;

    let newPermissions: string[];

    // Si on décoche "view" (accès à la page), décocher automatiquement toutes les autres permissions de cette ressource
    if (permission.action === "view" && isSelected) {
      const resourcePermissions =
        groupedPermissions[permission.resource] || [];
      const otherPermissionIds = resourcePermissions
        .filter((p) => p.action !== "view")
        .map((p) => p.id);

      newPermissions = currentPermissions.filter(
        (id) => id !== permissionId && !otherPermissionIds.includes(id)
      );
    }
    // Si on coche une permission autre que "view" mais que "view" n'est pas coché, cocher aussi "view"
    else if (permission.action !== "view" && !isSelected) {
      const resourcePermissions =
        groupedPermissions[permission.resource] || [];
      const viewPermission = resourcePermissions.find(
        (p) => p.action === "view"
      );

      newPermissions = [...currentPermissions, permissionId];
      if (viewPermission && !newPermissions.includes(viewPermission.id)) {
        newPermissions.push(viewPermission.id);
      }
    }
    // Sinon, toggle normal
    else {
      newPermissions = isSelected
        ? currentPermissions.filter((id) => id !== permissionId)
        : [...currentPermissions, permissionId];
    }

    setFormData({
      ...formData,
      selectedPermissions: newPermissions,
    });
  };

  // Toggle toutes les permissions d'une ressource
  const toggleAllPermissionsForResource = (resource: string) => {
    const resourcePermissions = groupedPermissions[resource] || [];
    const resourcePermissionIds = resourcePermissions.map((p) => p.id);
    const currentPermissions = formData.selectedPermissions || [];
    const allSelected = resourcePermissionIds.every((id) =>
      currentPermissions.includes(id)
    );

    if (allSelected) {
      // Désélectionner toutes les permissions de cette ressource
      setFormData({
        ...formData,
        selectedPermissions: currentPermissions.filter(
          (id) => !resourcePermissionIds.includes(id)
        ),
      });
    } else {
      // Sélectionner toutes les permissions de cette ressource
      const newPermissions = [...currentPermissions];
      resourcePermissionIds.forEach((id) => {
        if (!newPermissions.includes(id)) {
          newPermissions.push(id);
        }
      });
      setFormData({
        ...formData,
        selectedPermissions: newPermissions,
      });
    }
  };

  // Vérifier si une permission est désactivée
  const isPermissionDisabled = (permission: Permission): boolean => {
    // Si c'est la permission "view", elle n'est jamais désactivée
    if (permission.action === "view") return false;

    // Pour les autres permissions (create, update, delete), elles sont désactivées si "view" n'est pas coché
    const resourcePermissions = groupedPermissions[permission.resource] || [];
    const viewPermission = resourcePermissions.find((p) => p.action === "view");

    if (!viewPermission) return false;

    return !formData.selectedPermissions.includes(viewPermission.id);
  };

  const resourceLabels: Record<string, string> = {
    dashboard: "Dashboard",
    companies: "Entreprises",
    "activity-sectors": "Secteurs d'activité",
    expenses: "Dépenses",
    "investment-categories": "Catégories d'investissements",
    investments: "Investissements",
    loans: "Emprunts",
    dat: "Placements",
    banks: "Banques",
    alerts: "Alertes",
    users: "Utilisateurs",
    roles: "Rôles & Permissions",
    settings: "Paramètres",
  };

  const actionLabels: Record<string, string> = {
    view: "Accès à la page",
    create: "Créer",
    update: "Mettre à jour",
    delete: "Supprimer",
  };

  // Si l'utilisateur n'a pas la permission de voir, ne pas afficher l'écran
  if (!canView) {
    return (
      <SafeAreaView
        className={`flex-1 ${isDark ? "bg-[#0f172a]" : "bg-white"}`}
        edges={["top", "bottom"]}
      >
        <ScreenHeader />
        <View className="flex-1 justify-center items-center p-6">
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
      <ScreenHeader />
      <View className="flex-1">
        {/* Header avec recherche et boutons */}
        <View
          className={`px-6 pt-6 pb-4 border-b ${
            isDark ? "border-gray-800" : "border-gray-200"
          }`}
        >
          <View className="flex-row items-center justify-between mb-4">
            <View>
              <Text
                className={`text-2xl font-bold mb-1 ${
                  isDark ? "text-gray-100" : "text-gray-900"
                }`}
              >
                Rôles & Permissions
              </Text>
            </View>
          </View>

          <View className="flex-row items-center gap-3">
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
        {isLoading || !roles ? (
          <RolesSkeleton />
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

                  {/* Permissions */}
                  <View
                    style={{ width: columnWidths.permissions }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Permissions
                    </Text>
                  </View>

                  {/* Utilisateurs */}
                  <View
                    style={{ width: columnWidths.users }}
                    className="px-3 py-3"
                  >
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Utilisateurs
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

            {/* Liste des rôles */}
            <ScrollView
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  tintColor={isDark ? "#38bdf8" : REFRESH_CONTROL_COLOR}
                  colors={isDark ? ["#38bdf8"] : [REFRESH_CONTROL_COLOR]}
                />
              }
              style={{ flex: 1 }}
            >
              {filteredRoles.length === 0 ? (
                <View className="items-center justify-center py-12 px-6">
                  <Text
                    className={`text-center ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    {searchTerm
                      ? "Aucun rôle trouvé"
                      : "Aucun rôle disponible"}
                  </Text>
                </View>
              ) : (
                filteredRoles.map((role: Role) => {
                  const isAdmin = role.name === "Admin";

                  return (
                    <View
                      key={role.id}
                      className={`border-b ${
                        isDark
                          ? "border-gray-800 bg-[#0f172a]"
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
                            contentScrollRefs.current.set(role.id, ref);
                            if (scrollXRef.current > 0) {
                              requestAnimationFrame(() => {
                                ref.scrollTo({
                                  x: scrollXRef.current,
                                  animated: false,
                                });
                              });
                            }
                          } else {
                            contentScrollRefs.current.delete(role.id);
                          }
                        }}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        onScroll={(e) => handleContentScroll(e, role.id)}
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
                            style={{ width: columnWidths.name }}
                            className="px-3 py-4 justify-center"
                          >
                            <View className="flex-row items-center gap-2">
                              <Text
                                className={`text-sm font-semibold ${
                                  isDark ? "text-gray-100" : "text-gray-900"
                                }`}
                              >
                                {role.name}
                              </Text>
                              {isAdmin && (
                                <View
                                  className="px-2 py-0.5 rounded-full flex-row items-center gap-1"
                                  style={{
                                    backgroundColor: isDark
                                      ? "rgba(59, 130, 246, 0.2)"
                                      : "#dbeafe",
                                  }}
                                >
                                  <HugeiconsIcon
                                    icon={LockKeyIcon}
                                    size={12}
                                    color={isDark ? "#93c5fd" : "#2563eb"}
                                  />
                                  <Text
                                    className="text-xs font-medium"
                                    style={{
                                      color: isDark ? "#93c5fd" : "#2563eb",
                                    }}
                                  >
                                    Admin
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
                              className={`text-xs ${
                                isDark ? "text-gray-400" : "text-gray-600"
                              }`}
                              numberOfLines={2}
                            >
                              {role.description || "-"}
                            </Text>
                          </View>

                          {/* Permissions */}
                          <View
                            style={{ width: columnWidths.permissions }}
                            className="px-3 py-4 justify-center"
                          >
                            <View
                              className="px-2 py-1 rounded-full self-start"
                              style={{
                                backgroundColor: isDark
                                  ? "rgba(107, 114, 128, 0.2)"
                                  : "#f3f4f6",
                                borderWidth: 1,
                                borderColor: isDark ? "#6b7280" : "#d1d5db",
                              }}
                            >
                              <Text
                                className="text-xs font-medium"
                                style={{
                                  color: isDark ? "#d1d5db" : "#374151",
                                }}
                              >
                                {role.permissions.length} permission(s)
                              </Text>
                            </View>
                          </View>

                          {/* Utilisateurs */}
                          <View
                            style={{ width: columnWidths.users }}
                            className="px-3 py-4 justify-center"
                          >
                            <View
                              className="px-2 py-1 rounded-full self-start"
                              style={{
                                backgroundColor: isDark
                                  ? "rgba(107, 114, 128, 0.2)"
                                  : "#f3f4f6",
                                borderWidth: 1,
                                borderColor: isDark ? "#6b7280" : "#d1d5db",
                              }}
                            >
                              <Text
                                className="text-xs font-medium"
                                style={{
                                  color: isDark ? "#d1d5db" : "#374151",
                                }}
                              >
                                {role._count.users} utilisateur(s)
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
                        className="px-3 justify-center items-center flex-row gap-2"
                        pointerEvents="box-none"
                      >
                        {/* Bouton Voir détails */}
                        <TouchableOpacity
                          className="rounded-full"
                          style={{
                            backgroundColor: `${CHART_COLOR}20`,
                            padding: 8,
                          }}
                          activeOpacity={0.7}
                          onPress={() => handleViewDetails(role)}
                        >
                          <HugeiconsIcon
                            icon={EyeIcon}
                            size={16}
                            color={CHART_COLOR}
                          />
                        </TouchableOpacity>

                        {/* Bouton Modifier */}
                        {canUpdate && (
                          <TouchableOpacity
                            className="rounded-full"
                            style={{
                              backgroundColor: `${CHART_COLOR}20`,
                              padding: 8,
                            }}
                            activeOpacity={0.7}
                            onPress={() => handleEdit(role)}
                          >
                            <HugeiconsIcon
                              icon={Edit01Icon}
                              size={16}
                              color={CHART_COLOR}
                            />
                          </TouchableOpacity>
                        )}

                        {/* Bouton Supprimer */}
                        {canDelete && (
                          <TouchableOpacity
                            className="rounded-full"
                            style={{
                              backgroundColor: "#ef444420",
                              padding: 8,
                            }}
                            activeOpacity={0.7}
                            onPress={() => handleDelete(role)}
                            disabled={isAdmin || role._count.users > 0}
                          >
                            <HugeiconsIcon
                              icon={Delete01Icon}
                              size={16}
                              color={
                                isAdmin || role._count.users > 0
                                  ? "#9ca3af"
                                  : "#ef4444"
                              }
                            />
                          </TouchableOpacity>
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

      {/* Drawer Formulaire (Créer/Éditer) */}
      <Drawer
        open={showRoleForm}
        onOpenChange={(open) => {
          setShowRoleForm(open);
          if (!open) {
            setEditingRole(null);
            setFormData({
              name: "",
              description: "",
              selectedPermissions: [],
            });
          }
        }}
        title={editingRole ? "Modifier le rôle" : "Créer un nouveau rôle"}
      >
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-4 pb-4">
            {/* Nom */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Nom du rôle <Text className="text-red-500">*</Text>
              </Text>
              <Input
                value={formData.name}
                onChangeText={(text) =>
                  setFormData({ ...formData, name: text })
                }
                placeholder="Ex: Gestionnaire"
              />
            </View>

            {/* Description */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Description
              </Text>
              <Textarea
                value={formData.description}
                onChangeText={(text) =>
                  setFormData({ ...formData, description: text })
                }
                placeholder="Description du rôle..."
                rows={3}
              />
            </View>

            {/* Permissions */}
            <View className="gap-4">
              <Text className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Permissions
              </Text>
              <View
                className={`rounded-lg border ${
                  isDark
                    ? "bg-gray-900/50 border-gray-700"
                    : "bg-gray-50 border-gray-200"
                }`}
                style={{ maxHeight: 400 }}
              >
                <ScrollView
                  nestedScrollEnabled={true}
                  showsVerticalScrollIndicator={true}
                  className="p-4"
                >
                  <View className="gap-4">
                    {Object.entries(groupedPermissions).map(
                      ([resource, resourcePermissions]) => {
                        // Filtrer les permissions selon la ressource
                        let filteredPermissions = resourcePermissions;
                        if (resource === "dashboard") {
                          filteredPermissions = resourcePermissions.filter(
                            (p) => p.action === "view"
                          );
                        } else if (resource === "alerts") {
                          filteredPermissions = resourcePermissions.filter(
                            (p) => p.action === "view"
                          );
                        } else if (resource === "settings") {
                          filteredPermissions = resourcePermissions.filter(
                            (p) => p.action === "view" || p.action === "update"
                          );
                        }

                        // Cacher le bouton "Tout sélectionner" pour dashboard, alerts et settings
                        const showSelectAllButton =
                          resource !== "dashboard" &&
                          resource !== "alerts" &&
                          resource !== "settings";

                        return (
                          <View
                            key={resource}
                            className={`p-3 rounded-lg gap-2 ${
                              isDark
                                ? "bg-[#0f172a] border border-gray-700"
                                : "bg-white border border-gray-200"
                            }`}
                          >
                            <View className="flex-row items-center justify-between pb-2 border-b border-gray-200 dark:border-gray-700">
                              <Text
                                className={`font-semibold text-base ${
                                  isDark ? "text-gray-100" : "text-gray-900"
                                }`}
                              >
                                {resourceLabels[resource] || resource}
                              </Text>
                              {showSelectAllButton && (
                                <TouchableOpacity
                                  onPress={() =>
                                    toggleAllPermissionsForResource(resource)
                                  }
                                  activeOpacity={0.7}
                                >
                                  <Text
                                    className={`text-xs ${
                                      filteredPermissions.every((p) =>
                                        formData.selectedPermissions.includes(
                                          p.id
                                        )
                                      )
                                        ? isDark
                                          ? "text-blue-400"
                                          : "text-blue-600"
                                        : isDark
                                        ? "text-gray-400"
                                        : "text-gray-600"
                                    }`}
                                  >
                                    {filteredPermissions.every((p) =>
                                      formData.selectedPermissions.includes(
                                        p.id
                                      )
                                    )
                                      ? "Tout désélectionner"
                                      : "Tout sélectionner"}
                                  </Text>
                                </TouchableOpacity>
                              )}
                            </View>
                            <View
                              className="flex-row flex-wrap gap-3 pt-2"
                              style={{
                                flexDirection: "row",
                                flexWrap: "wrap",
                              }}
                            >
                              {filteredPermissions.map((permission) => {
                                const isDisabled =
                                  isPermissionDisabled(permission);
                                return (
                                  <View
                                    key={permission.id}
                                    style={{
                                      width: "48%",
                                      minWidth: 140,
                                    }}
                                  >
                                    <Checkbox
                                      checked={formData.selectedPermissions.includes(
                                        permission.id
                                      )}
                                      onCheckedChange={() =>
                                        togglePermission(permission.id)
                                      }
                                      disabled={isDisabled}
                                      label={
                                        actionLabels[permission.action] ||
                                        permission.action
                                      }
                                    />
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        );
                      }
                    )}
                  </View>
                </ScrollView>
              </View>
            </View>

            {/* Boutons */}
            <View className="flex-row gap-3 mt-4">
              <Button
                variant="outline"
                onPress={() => {
                  setShowRoleForm(false);
                  setEditingRole(null);
                  setFormData({
                    name: "",
                    description: "",
                    selectedPermissions: [],
                  });
                }}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onPress={handleSubmit}
                disabled={isSubmitting || !isFormValid}
                loading={isSubmitting}
                className="flex-1"
              >
                {editingRole ? "Mettre à jour" : "Créer"}
              </Button>
            </View>
          </View>
        </ScrollView>
      </Drawer>

      {/* Drawer Détails */}
      <Drawer
        open={showDetailsDrawer}
        onOpenChange={(open) => {
          setShowDetailsDrawer(open);
          if (!open) {
            setSelectedRoleForDetails(null);
          }
        }}
        title="Détails du rôle"
      >
        {selectedRoleForDetails && (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="gap-4 pb-4">
              {/* Nom */}
              <View className="gap-2">
                <Text
                  className={`text-sm font-semibold ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Nom du rôle
                </Text>
                <View className="flex-row items-center gap-2">
                  <Text
                    className={`text-base font-medium ${
                      isDark ? "text-gray-100" : "text-gray-900"
                    }`}
                  >
                    {selectedRoleForDetails.name}
                  </Text>
                  {selectedRoleForDetails.name === "Admin" && (
                    <View
                      className="px-2 py-0.5 rounded-full flex-row items-center gap-1"
                      style={{
                        backgroundColor: isDark
                          ? "rgba(59, 130, 246, 0.2)"
                          : "#dbeafe",
                      }}
                    >
                      <HugeiconsIcon
                        icon={LockKeyIcon}
                        size={12}
                        color={isDark ? "#93c5fd" : "#2563eb"}
                      />
                      <Text
                        className="text-xs font-medium"
                        style={{
                          color: isDark ? "#93c5fd" : "#2563eb",
                        }}
                      >
                        Admin
                      </Text>
                    </View>
                  )}
                </View>
              </View>

              {/* Description */}
              <View className="gap-2">
                <Text
                  className={`text-sm font-semibold ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Description
                </Text>
                <Text
                  className={`text-sm ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  {selectedRoleForDetails.description || "Aucune description"}
                </Text>
              </View>

              {/* Nombre d'utilisateurs */}
              <View className="gap-2">
                <Text
                  className={`text-sm font-semibold ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Nombre d'utilisateurs
                </Text>
                <View
                  className="px-2 py-1 rounded-full self-start"
                  style={{
                    backgroundColor: isDark
                      ? "rgba(107, 114, 128, 0.2)"
                      : "#f3f4f6",
                    borderWidth: 1,
                    borderColor: isDark ? "#6b7280" : "#d1d5db",
                  }}
                >
                  <Text
                    className="text-xs font-medium"
                    style={{
                      color: isDark ? "#d1d5db" : "#374151",
                    }}
                  >
                    {selectedRoleForDetails._count.users} utilisateur(s)
                  </Text>
                </View>
              </View>

              {/* Permissions */}
              <View className="gap-2">
                <Text
                  className={`text-sm font-semibold ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Permissions ({selectedRoleForDetails.permissions.length})
                </Text>
                <View
                  className={`rounded-lg border ${
                    isDark
                      ? "bg-gray-900/50 border-gray-700"
                      : "bg-gray-50 border-gray-200"
                  }`}
                  style={{ maxHeight: 400 }}
                >
                  <ScrollView
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                    className="p-4"
                  >
                    <View className="gap-4">
                      {Object.entries(groupedPermissions).map(
                        ([resource, resourcePermissions]) => {
                          const rolePermissionsForResource =
                            selectedRoleForDetails.permissions
                              .filter(
                                (rp) => rp.permission.resource === resource
                              )
                              .map((rp) => rp.permission.id);

                          if (rolePermissionsForResource.length === 0)
                            return null;

                          const filteredPermissions =
                            resourcePermissions.filter((p) =>
                              rolePermissionsForResource.includes(p.id)
                            );

                          return (
                            <View
                              key={resource}
                              className={`p-3 rounded-lg gap-2 ${
                                isDark
                                  ? "bg-[#0f172a] border border-gray-700"
                                  : "bg-white border border-gray-200"
                              }`}
                            >
                              <View className="pb-2 border-b border-gray-200 dark:border-gray-700 mb-2">
                                <Text
                                  className={`font-semibold text-base ${
                                    isDark ? "text-gray-100" : "text-gray-900"
                                  }`}
                                >
                                  {resourceLabels[resource] || resource}
                                </Text>
                              </View>
                              <View
                                className="flex-row flex-wrap gap-3 pt-2"
                                style={{
                                  flexDirection: "row",
                                  flexWrap: "wrap",
                                }}
                              >
                                {filteredPermissions.map((permission) => (
                                  <View
                                    key={permission.id}
                                    className="flex-row items-center gap-2 px-2 py-1.5 rounded-md"
                                    style={{
                                      width: "48%",
                                      minWidth: 140,
                                      backgroundColor: isDark
                                        ? "rgba(59, 130, 246, 0.1)"
                                        : "#eff6ff",
                                    }}
                                  >
                                    <View
                                      className="h-2 w-2 rounded-full"
                                      style={{
                                        backgroundColor: CHART_COLOR,
                                      }}
                                    />
                                    <Text
                                      className={`text-sm font-medium ${
                                        isDark
                                          ? "text-gray-200"
                                          : "text-gray-800"
                                      }`}
                                    >
                                      {actionLabels[permission.action] ||
                                        permission.action}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            </View>
                          );
                        }
                      )}
                    </View>
                  </ScrollView>
                </View>
              </View>
            </View>
          </ScrollView>
        )}
      </Drawer>

      {/* Drawer Suppression */}
      <Drawer
        open={showDeleteDrawer}
        onOpenChange={(open) => {
          setShowDeleteDrawer(open);
          if (!open) {
            setRoleToDelete(null);
            setDeleteConfirmation("");
          }
        }}
        title="Supprimer le rôle"
      >
        {roleToDelete && (
          <View className="gap-4 pb-4">
            {roleToDelete._count.users > 0 ? (
              <Text
                className={`text-red-600 dark:text-red-400 font-medium ${
                  isDark ? "text-red-400" : "text-red-600"
                }`}
              >
                Ce rôle est utilisé par {roleToDelete._count.users}{" "}
                utilisateur(s) et ne peut pas être supprimé.
              </Text>
            ) : roleToDelete.name === "Admin" ? (
              <Text
                className={`text-red-600 dark:text-red-400 font-medium ${
                  isDark ? "text-red-400" : "text-red-600"
                }`}
              >
                Le rôle Admin ne peut pas être supprimé.
              </Text>
            ) : (
              <>
                <Text
                  className={`text-sm ${
                    isDark ? "text-gray-400" : "text-gray-600"
                  }`}
                >
                  Cette action est irréversible. Tapez le nom du rôle{" "}
                  <Text
                    className="font-semibold"
                    style={{
                      color: isDark ? "#f3f4f6" : "#111827",
                    }}
                  >
                    "{roleToDelete.name}"
                  </Text>{" "}
                  pour confirmer la suppression.
                </Text>
                <View className="gap-2">
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`text-sm font-medium ${
                        isDark ? "text-gray-300" : "text-gray-700"
                      }`}
                    >
                      Tapez "{roleToDelete.name}" pour confirmer
                    </Text>
                    <TouchableOpacity
                      onPress={() => {
                        const textToCopy = roleToDelete.name || "";
                        const normalizedText =
                          normalizeConfirmationText(textToCopy);
                        Clipboard.setString(normalizedText);
                        setDeleteConfirmation(normalizedText);
                        Alert.alert(
                          "Copié",
                          "Le texte a été copié et collé automatiquement"
                        );
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
                    placeholder={roleToDelete.name}
                    placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                    className={`h-12 px-4 rounded-lg border text-base ${
                      isDark
                        ? "bg-[#1e293b] border-gray-600 text-gray-100"
                        : "bg-white border-gray-300 text-gray-900"
                    }`}
                    style={{
                      textAlignVertical: "center",
                      includeFontPadding: false,
                      paddingVertical: 0,
                      color: isDark ? "#f3f4f6" : "#111827",
                    }}
                  />
                </View>
                <View className="flex-row gap-3 mt-4">
                  <Button
                    variant="outline"
                    onPress={() => {
                      setShowDeleteDrawer(false);
                      setRoleToDelete(null);
                      setDeleteConfirmation("");
                    }}
                    className="flex-1"
                  >
                    Annuler
                  </Button>
                  <Button
                    onPress={handleDeleteConfirm}
                    disabled={
                      !roleToDelete ||
                      roleToDelete._count.users > 0 ||
                      roleToDelete.name === "Admin" ||
                      normalizeConfirmationText(deleteConfirmation) !==
                        normalizeConfirmationText(roleToDelete.name) ||
                      isDeleting
                    }
                    loading={isDeleting}
                    variant="destructive"
                    className="flex-1"
                  >
                    Supprimer
                  </Button>
                </View>
              </>
            )}
          </View>
        )}
      </Drawer>
    </SafeAreaView>
  );
}
