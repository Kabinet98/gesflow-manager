import React, { useState, useCallback, useMemo, useRef } from "react";

import {
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
  ScrollView,
  StyleSheet,
  Share,
  Platform,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import MapView, { Polygon, Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT } from "react-native-maps";
import api from "@/config/api";
import { authService } from "@/services/auth.service";
import { useTheme } from "@/contexts/ThemeContext";
import { useAmountVisibility } from "@/contexts/AmountVisibilityContext";
import { usePermissions } from "@/hooks/usePermissions";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  PlusSignCircleIcon,
  Edit01Icon,
  Delete01Icon,
  Search01Icon,
  Share01Icon,
  ArrowRight01Icon,
  MapsIcon,
  PinLocation03Icon,
  File01Icon,
  Cancel01Icon,
  Upload01Icon,
  EyeIcon,
} from "@hugeicons/core-free-icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { BlurredAmount } from "@/components/BlurredAmount";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { VAULT_CURRENCIES } from "@/constants/vault";
import { REFRESH_CONTROL_COLOR, TAB_BAR_PADDING_BOTTOM } from "@/constants/layout";
import { formatDecimalInput } from "@/utils/numeric-input";
import { LandTitlesSkeleton } from "@/components/skeletons/LandTitlesSkeleton";
import { formatArea, calculatePolygonArea, calculatePolygonCenter } from "@/utils/geo";
import type { LandTitle, LandTitleDocument } from "@/types";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";

let FileSystemLegacy: any = null;
try {
  FileSystemLegacy = require("expo-file-system/legacy");
} catch (e) {}

const getCacheDir = (): string => {
  try {
    if (FileSystemLegacy?.cacheDirectory) return FileSystemLegacy.cacheDirectory;
  } catch {}
  try {
    const paths = (FileSystem as any).Paths;
    if (paths?.cacheDirectory) return paths.cacheDirectory;
  } catch {}
  let mod: any = FileSystem;
  for (let i = 0; i < 5 && mod; i++) {
    if (mod.cacheDirectory) return mod.cacheDirectory;
    mod = mod.default;
  }
  return "";
};

const CONTENT_PADDING_TOP = 80;

function MapPreviewDrawer({
  item,
  isDark,
  onClose,
}: {
  item: LandTitle;
  isDark: boolean;
  onClose: () => void;
}) {
  const mapRef = useRef<MapView>(null);

  const hasBounds =
    item.boundaries &&
    Array.isArray(item.boundaries) &&
    item.boundaries.length >= 3;
  const center = hasBounds
    ? calculatePolygonCenter(item.boundaries!)
    : item.centerLat && item.centerLng
    ? { lat: item.centerLat, lng: item.centerLng }
    : null;
  const coords = hasBounds
    ? item.boundaries!.map((p) => ({ latitude: p.lat, longitude: p.lng }))
    : [];

  if (!center) return null;

  return (
    <Drawer open onOpenChange={(open) => { if (!open) onClose(); }} title={item.name}>
      <View style={{ gap: 12 }}>
        <View style={{ height: 350, borderRadius: 12, overflow: "hidden" }}>
          <MapView
            ref={mapRef}
            style={{ flex: 1 }}
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
            mapType="standard"
            initialRegion={{
              latitude: center.lat,
              longitude: center.lng,
              latitudeDelta: 0.004,
              longitudeDelta: 0.004,
            }}
            onMapReady={() => {
              if (coords.length >= 3) {
                setTimeout(() => {
                  mapRef.current?.fitToCoordinates(coords, {
                    edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
                    animated: true,
                  });
                }, 300);
              }
            }}
            showsCompass={false}
            toolbarEnabled={false}
            showsPointsOfInterest={false}
          >
            {hasBounds && (
              <Polygon
                coordinates={coords}
                strokeColor="#0ea5e9"
                fillColor="rgba(14, 165, 233, 0.2)"
                strokeWidth={2.5}
              />
            )}
            {coords.map((c, idx) => (
              <Marker key={idx} coordinate={c} anchor={{ x: 0.5, y: 0.5 }}>
                <View
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 12,
                    backgroundColor: idx === 0 ? "#22c55e" : "#0ea5e9",
                    borderWidth: 2,
                    borderColor: "#ffffff",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text style={{ color: "#fff", fontSize: 10, fontWeight: "800" }}>
                    {idx + 1}
                  </Text>
                </View>
              </Marker>
            ))}
          </MapView>
        </View>

        <View
          style={{
            flexDirection: "row",
            justifyContent: "space-around",
            paddingVertical: 10,
            backgroundColor: isDark ? "#1e293b" : "#f8fafc",
            borderRadius: 10,
          }}
        >
          {hasBounds && (
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}>
                Points
              </Text>
              <Text style={{ color: isDark ? "#f1f5f9" : "#0f172a", fontSize: 16, fontWeight: "700" }}>
                {item.boundaries!.length}
              </Text>
            </View>
          )}
          {item.area != null && item.area > 0 && (
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}>
                Surface
              </Text>
              <Text style={{ color: isDark ? "#f1f5f9" : "#0f172a", fontSize: 16, fontWeight: "700" }}>
                {formatArea(item.area)}
              </Text>
            </View>
          )}
          {(item.city || item.region) && (
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: 11 }}>
                Localisation
              </Text>
              <Text
                style={{ color: isDark ? "#f1f5f9" : "#0f172a", fontSize: 14, fontWeight: "600" }}
                numberOfLines={1}
              >
                {[item.city, item.region].filter(Boolean).join(", ")}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Drawer>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function LandTitlesScreen() {
  const { isDark } = useTheme();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();

  const canCreate = hasPermission("land-titles.create");
  const canUpdate = hasPermission("land-titles.update");
  const canDelete = hasPermission("land-titles.delete");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LandTitle | null>(null);
  const [mapDrawerItem, setMapDrawerItem] = useState<LandTitle | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState<string | null>(null);

  // Document upload state
  const [pendingDocuments, setPendingDocuments] = useState<
    Array<{ file: any; title: string; id: string }>
  >([]);
  const [isAddingDocument, setIsAddingDocument] = useState(false);

  const [form, setForm] = useState({
    name: "",
    titleNumber: "",
    description: "",
    purchasePrice: "",
    currency: "GNF",
    purchaseDate: "",
    address: "",
    city: "",
    region: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});


  // Boundaries from MapBoundary screen
  const [pendingBoundaries, setPendingBoundaries] = useState<
    Array<{ lat: number; lng: number }> | null
  >(null);

  const { data: items = [], isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["land-titles"],
    queryFn: async () => {
      const res = await api.get<LandTitle[]>("/api/land-titles");
      return Array.isArray(res.data) ? res.data : [];
    },
    refetchInterval: 30000,
  });

  const filteredItems = useMemo(() => {
    if (!searchTerm.trim()) return items;
    const lower = searchTerm.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(lower) ||
        item.city?.toLowerCase().includes(lower) ||
        item.titleNumber?.toLowerCase().includes(lower) ||
        item.region?.toLowerCase().includes(lower)
    );
  }, [items, searchTerm]);

  const totalParcels = items.length;
  const totalArea = items.reduce((sum, it) => sum + (it.area ?? 0), 0);
  const totalValue = items.reduce((sum, it) => sum + (it.purchasePrice ?? 0), 0);
  const mainCurrency = items[0]?.currency ?? "GNF";

  const resetForm = useCallback(() => {
    setForm({
      name: "",
      titleNumber: "",
      description: "",
      purchasePrice: "",
      currency: "GNF",
      purchaseDate: "",
      address: "",
      city: "",
      region: "",
    });
    setFormErrors({});
    setPendingBoundaries(null);
    setPendingDocuments([]);
  }, []);

  const openAdd = useCallback(() => {
    setEditingItem(null);
    resetForm();
    setDrawerOpen(true);
  }, [resetForm]);

  const openEdit = useCallback((item: LandTitle) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      titleNumber: item.titleNumber ?? "",
      description: item.description ?? "",
      purchasePrice: item.purchasePrice?.toString() ?? "",
      currency: item.currency,
      purchaseDate: item.purchaseDate
        ? item.purchaseDate.substring(0, 10)
        : "",
      address: item.address ?? "",
      city: item.city ?? "",
      region: item.region ?? "",
    });
    setPendingBoundaries(item.boundaries ?? null);
    setPendingDocuments([]);
    setFormErrors({});
    setDrawerOpen(true);
  }, []);

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = "Le nom est requis";
    if (form.purchasePrice && isNaN(parseFloat(form.purchasePrice))) {
      errors.purchasePrice = "Montant invalide";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const uploadDocuments = async (landTitleId: string) => {
    if (pendingDocuments.length === 0) return;

    try {
      await authService.refreshToken();
    } catch {}

    const errors: string[] = [];

    for (const doc of pendingDocuments) {
      try {
        const formData = new FormData();
        formData.append("file", {
          uri: doc.file.uri,
          type: doc.file.mimeType || "application/octet-stream",
          name: doc.file.name || "document",
        } as any);
        formData.append("title", doc.title || doc.file.name || "Document");
        formData.append("type", "land-titles");

        const uploadRes = await api.post("/api/upload", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (uploadRes.data) {
          const ud = uploadRes.data;
          await api.post(`/api/land-titles/${landTitleId}/documents`, {
            title: doc.title || ud.filename,
            filename: ud.filename || doc.file.name,
            objectName: ud.objectName,
            fileType: ud.fileType || doc.file.mimeType || doc.file.type,
            fileSize: ud.fileSize || doc.file.size,
          });
        }
      } catch (err: any) {
        const name = doc.title || doc.file.name || "document";
        const detail =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          err?.message ||
          "";
        errors.push(detail ? `${name}: ${detail}` : name);
      }
    }

    // Invalidate detail query so documents appear immediately
    queryClient.invalidateQueries({ queryKey: ["land-title", landTitleId] });

    if (errors.length > 0) {
      Alert.alert(
        "Erreur d'upload",
        `Impossible d'uploader: ${errors.join(", ")}`
      );
    }
  };

  const submitForm = async () => {
    if (!validateForm()) return;
    setSubmitting(true);

    try {
      const payload: any = {
        name: form.name.trim(),
        titleNumber: form.titleNumber.trim() || undefined,
        description: form.description.trim() || undefined,
        purchasePrice: form.purchasePrice
          ? parseFloat(form.purchasePrice)
          : undefined,
        currency: form.currency,
        purchaseDate: form.purchaseDate || undefined,
        address: form.address.trim() || undefined,
        city: form.city.trim() || undefined,
        region: form.region.trim() || undefined,
        boundaries: pendingBoundaries,
      };

      // Compute area & center from boundaries
      if (pendingBoundaries && pendingBoundaries.length >= 3) {
        payload.area = calculatePolygonArea(pendingBoundaries);
        payload.areaUnit = "m2";
        const center = pendingBoundaries.reduce(
          (acc, c) => ({ lat: acc.lat + c.lat, lng: acc.lng + c.lng }),
          { lat: 0, lng: 0 }
        );
        payload.centerLat = center.lat / pendingBoundaries.length;
        payload.centerLng = center.lng / pendingBoundaries.length;
      }

      if (editingItem) {
        await api.put(`/api/land-titles/${editingItem.id}`, payload);
        await uploadDocuments(editingItem.id);
      } else {
        const res = await api.post("/api/land-titles", payload);
        if (res.data?.id) {
          await uploadDocuments(res.data.id);
        }
      }

      queryClient.invalidateQueries({ queryKey: ["land-titles"] });
      setDrawerOpen(false);
      resetForm();
    } catch (error: any) {
      const msg =
        error.response?.data?.error || "Erreur lors de l'enregistrement";
      Alert.alert("Erreur", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (item: LandTitle) => {
    Alert.alert(
      "Archiver",
      `Voulez-vous archiver "${item.name}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Archiver",
          style: "destructive",
          onPress: async () => {
            setArchiving(item.id);
            try {
              await api.delete(`/api/land-titles/${item.id}`);
              queryClient.invalidateQueries({ queryKey: ["land-titles"] });
            } catch {
              Alert.alert("Erreur", "Impossible d'archiver ce titre");
            } finally {
              setArchiving(null);
            }
          },
        },
      ]
    );
  };

  const handleShare = (item: LandTitle) => {
    let message = `${item.name}`;
    if (item.titleNumber) message += `\nTitre: ${item.titleNumber}`;
    if (item.area) message += `\nSurface: ${formatArea(item.area)}`;
    if (item.city) message += `\nVille: ${item.city}`;
    if (item.region) message += `\nRégion: ${item.region}`;
    if (item.centerLat && item.centerLng) {
      message += `\nhttps://www.google.com/maps?q=${item.centerLat},${item.centerLng}`;
    }
    Share.share({ message });
  };

  const handleOpenDocument = async (doc: LandTitleDocument) => {
    try {
      let url = doc.url;
      if (!url) return;

      if (url.startsWith("/api/files/")) {
        try {
          const response = await api.get(url, {
            maxRedirects: 5,
            validateStatus: () => true,
          });
          const apiUrl = `${api.defaults.baseURL}${url}`;
          if (
            response.request?.responseURL &&
            response.request.responseURL !== apiUrl
          ) {
            url = response.request.responseURL;
          } else if (response.status >= 300 && response.status < 400) {
            const location =
              response.headers?.location || response.headers?.Location;
            url = location || apiUrl;
          } else {
            url = apiUrl;
          }
        } catch {
          url = `${api.defaults.baseURL}${url}`;
        }
      } else if (!url.startsWith("http")) {
        url = `${api.defaults.baseURL}${url}`;
      }

      if (url.startsWith("http")) {
        await Linking.openURL(url);
      }
    } catch {
      Alert.alert("Erreur", "Impossible d'ouvrir le document");
    }
  };

  const handleDeleteDocument = (doc: LandTitleDocument) => {
    if (!editingItem) return;
    Alert.alert(
      "Supprimer le document",
      `Supprimer "${doc.title || doc.filename}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            try {
              await api.delete(
                `/api/land-titles/${editingItem.id}/documents?documentId=${doc.id}`
              );
              queryClient.invalidateQueries({
                queryKey: ["land-title", editingItem.id],
              });
              queryClient.invalidateQueries({ queryKey: ["land-titles"] });
            } catch {
              Alert.alert("Erreur", "Impossible de supprimer le document");
            }
          },
        },
      ]
    );
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
        const cacheDir = getCacheDir();
        const stableAssets: Array<{ file: any; title: string; id: string }> = [];

        for (const asset of result.assets) {
          try {
            // Copy to a stable cache path to avoid iOS cleaning up Inbox files
            const fileName = asset.name || `doc_${Date.now()}`;
            const stableUri = cacheDir
              ? `${cacheDir}landtitle_${Date.now()}_${fileName}`
              : asset.uri;

            if (cacheDir && asset.uri !== stableUri) {
              if (FileSystemLegacy?.copyAsync) {
                await FileSystemLegacy.copyAsync({ from: asset.uri, to: stableUri });
              } else if ((FileSystem as any).copyAsync) {
                await (FileSystem as any).copyAsync({ from: asset.uri, to: stableUri });
              }
            }

            stableAssets.push({
              file: { ...asset, uri: cacheDir ? stableUri : asset.uri },
              title: asset.name || "Document",
              id: stableUri + Date.now(),
            });
          } catch {
            // Fallback: use original URI
            stableAssets.push({
              file: asset,
              title: asset.name || "Document",
              id: asset.uri + Date.now(),
            });
          }
        }

        setPendingDocuments((prev) => [...prev, ...stableAssets]);
      }
    } catch (error: any) {
      Alert.alert("Erreur", "Impossible de sélectionner le document");
    } finally {
      setIsAddingDocument(false);
    }
  };

  const navigateToMapBoundary = () => {
    setDrawerOpen(false);
    setTimeout(() => {
      navigation.navigate("MapBoundary", {
        existingBoundaries: pendingBoundaries,
        onComplete: (boundaries: Array<{ lat: number; lng: number }>) => {
          setPendingBoundaries(boundaries);
          // Delay reopening to let the screen fully settle after navigation back
          setTimeout(() => setDrawerOpen(true), 400);
        },
      });
    }, 400);
  };

  const navigateToDetail = (item: LandTitle) => {
    navigation.navigate("LandTitleDetail", { landTitle: item });
  };

  const currencyOptions = VAULT_CURRENCIES.map((c) => ({
    label: `${c.code} - ${c.name}`,
    value: c.code,
  }));

  // --- RENDER ---

  const renderStatCard = (
    label: string,
    value: React.ReactNode,
    gradientDark: string,
    gradientLight: string,
    circleColor: string,
    textDark: string,
    textLight: string,
  ) => (
    <View
      style={[
        styles.statCard,
        Platform.OS === "ios" && {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 8,
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
          className={`text-xs font-medium mb-2 ${
            isDark ? textDark : textLight
          }`}
          numberOfLines={1}
        >
          {label}
        </Text>
        {typeof value === "string" || typeof value === "number" ? (
          <Text
            className={`text-lg font-bold ${isDark ? textDark : textLight}`}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {value}
          </Text>
        ) : (
          <View style={{ flexShrink: 1 }}>{value}</View>
        )}
      </View>
    </View>
  );

  const renderCard = (item: LandTitle) => {
    const hasBounds =
      item.boundaries && Array.isArray(item.boundaries) && item.boundaries.length >= 3;
    const locationText = [item.city, item.region].filter(Boolean).join(", ");

    return (
      <TouchableOpacity
        key={item.id}
        activeOpacity={0.7}
        onPress={() => navigateToDetail(item)}
        style={[
          styles.landCard,
          { backgroundColor: isDark ? "#1e293b" : "#ffffff" },
        ]}
      >
        {/* Card content */}
        <View style={styles.cardContent}>
          <View style={styles.cardHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <View
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 18,
                  backgroundColor: isDark ? "#0f172a" : "#f1f5f9",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <HugeiconsIcon
                  icon={PinLocation03Icon}
                  size={18}
                  color={hasBounds ? "#0ea5e9" : isDark ? "#475569" : "#94a3b8"}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text
                  style={[
                    styles.cardTitle,
                    { color: isDark ? "#f1f5f9" : "#0f172a" },
                  ]}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
                {item.titleNumber && (
                  <Text
                    style={[
                      styles.cardSubtitle,
                      { color: isDark ? "#64748b" : "#94a3b8" },
                    ]}
                    numberOfLines={1}
                  >
                    {item.titleNumber}
                  </Text>
                )}
              </View>
            </View>
          </View>

          <View style={styles.cardRow}>
            {item.area ? (
              <Text
                style={[
                  styles.cardMeta,
                  { color: isDark ? "#94a3b8" : "#64748b" },
                ]}
              >
                {formatArea(item.area)}
              </Text>
            ) : null}
            {locationText ? (
              <Text
                style={[
                  styles.cardMeta,
                  { color: isDark ? "#94a3b8" : "#64748b" },
                ]}
                numberOfLines={1}
              >
                {locationText}
              </Text>
            ) : null}
          </View>

          <View style={styles.cardFooter}>
            {item.purchasePrice ? (
              <BlurredAmount
                amount={item.purchasePrice}
                currency={item.currency}
                className={isDark ? "text-sm text-green-400" : "text-sm text-green-600"}
              />
            ) : (
              <View />
            )}

            <View style={styles.cardActions}>
              {hasBounds && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation?.();
                    setMapDrawerItem(item);
                  }}
                  style={styles.iconBtn}
                >
                  <HugeiconsIcon icon={MapsIcon} size={16} color="#0ea5e9" />
                </TouchableOpacity>
              )}
              {canUpdate && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation?.();
                    handleShare(item);
                  }}
                  style={styles.iconBtn}
                >
                  <HugeiconsIcon icon={Share01Icon} size={16} color="#0ea5e9" />
                </TouchableOpacity>
              )}
              {canUpdate && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation?.();
                    openEdit(item);
                  }}
                  style={styles.iconBtn}
                >
                  <HugeiconsIcon icon={Edit01Icon} size={16} color="#0ea5e9" />
                </TouchableOpacity>
              )}
              {canDelete && (
                <TouchableOpacity
                  onPress={(e) => {
                    e.stopPropagation?.();
                    handleArchive(item);
                  }}
                  style={styles.iconBtn}
                  disabled={archiving === item.id}
                >
                  {archiving === item.id ? (
                    <ActivityIndicator size="small" color="#ef4444" />
                  ) : (
                    <HugeiconsIcon
                      icon={Delete01Icon}
                      size={16}
                      color="#ef4444"
                    />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? "#0f172a" : "#ffffff" },
      ]}
      edges={["top", "bottom"]}
    >
      <ScreenHeader title="Espace Foncier" />

      {isLoading ? (
        <LandTitlesSkeleton />
      ) : (
        <ScrollView
          style={{ flex: 1, paddingTop: CONTENT_PADDING_TOP }}
          contentContainerStyle={{
            padding: 16,
            paddingBottom: TAB_BAR_PADDING_BOTTOM + 20,
            gap: 16,
          }}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={refetch}
              tintColor={REFRESH_CONTROL_COLOR}
              colors={[REFRESH_CONTROL_COLOR]}
              progressViewOffset={CONTENT_PADDING_TOP}
            />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Stats */}
          <View style={styles.statsRow}>
            {renderStatCard(
              "Parcelles",
              totalParcels.toString(),
              "bg-blue-900/20",
              "bg-blue-50",
              "bg-blue-500/10",
              "text-blue-200",
              "text-blue-800",
            )}
            {renderStatCard(
              "Surface totale",
              totalArea > 0 ? formatArea(totalArea) : "—",
              "bg-emerald-900/20",
              "bg-emerald-50",
              "bg-emerald-500/10",
              "text-emerald-200",
              "text-emerald-800",
            )}
            {renderStatCard(
              "Valeur estimée",
              totalValue > 0 ? (
                <BlurredAmount
                  amount={totalValue}
                  currency={mainCurrency}
                  className={
                    isDark ? "text-lg font-bold text-amber-200" : "text-lg font-bold text-amber-800"
                  }
                  style={{ fontSize: 16, flexShrink: 1 }}
                />
              ) : (
                "—"
              ),
              "bg-amber-900/20",
              "bg-amber-50",
              "bg-amber-500/10",
              "text-amber-200",
              "text-amber-800",
            )}
          </View>

          {/* Search + Toggle + Add */}
          <View style={styles.searchRow}>
            <View
              style={[
                styles.searchBar,
                {
                  backgroundColor: isDark ? "#1e293b" : "#f1f5f9",
                  borderColor: isDark ? "#374151" : "#e2e8f0",
                },
              ]}
            >
              <HugeiconsIcon
                icon={Search01Icon}
                size={18}
                color={isDark ? "#64748b" : "#94a3b8"}
              />
              <TextInput
                style={[
                  styles.searchInput,
                  { color: isDark ? "#f1f5f9" : "#0f172a" },
                ]}
                placeholder="Rechercher..."
                placeholderTextColor={isDark ? "#64748b" : "#94a3b8"}
                value={searchTerm}
                onChangeText={setSearchTerm}
              />
            </View>
            {canCreate && (
              <Button onPress={openAdd} size="default">
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <HugeiconsIcon icon={PlusSignCircleIcon} size={16} color="#ffffff" />
                  <Text style={{ color: "#ffffff", fontWeight: "600", fontSize: 14 }}>
                    Ajouter
                  </Text>
                </View>
              </Button>
            )}
          </View>

          {/* Cards list */}
          {filteredItems.length === 0 ? (
            <View style={styles.emptyState}>
              <HugeiconsIcon
                icon={PinLocation03Icon}
                size={48}
                color={isDark ? "#374151" : "#cbd5e1"}
              />
              <Text
                style={[
                  styles.emptyText,
                  { color: isDark ? "#64748b" : "#94a3b8" },
                ]}
              >
                {searchTerm
                  ? "Aucun résultat"
                  : "Aucun titre foncier enregistré"}
              </Text>
            </View>
          ) : (
            filteredItems.map(renderCard)
          )}
        </ScrollView>
      )}

      {/* Create/Edit Drawer */}
      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={editingItem ? "Modifier le titre" : "Nouveau titre foncier"}
        footer={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button
              variant="outline"
              onPress={() => setDrawerOpen(false)}
              style={{ flex: 1 }}
            >
              Annuler
            </Button>
            <Button
              onPress={submitForm}
              loading={submitting}
              disabled={submitting}
              style={{ flex: 1 }}
            >
              {editingItem ? "Modifier" : "Créer"}
            </Button>
          </View>
        }
      >
        <View style={{ gap: 0 }}>
          <Input
            label="Nom de la parcelle"
            required
            value={form.name}
            onChangeText={(v: string) => setForm((f) => ({ ...f, name: v }))}
            error={formErrors.name}
            placeholder="Ex: Terrain Conakry Nord"
          />
          <Input
            label="Numéro du titre foncier"
            value={form.titleNumber}
            onChangeText={(v: string) =>
              setForm((f) => ({ ...f, titleNumber: v }))
            }
            placeholder="Ex: TF-2025-0001"
          />
          <Input
            label="Description"
            value={form.description}
            onChangeText={(v: string) =>
              setForm((f) => ({ ...f, description: v }))
            }
            multiline
            numberOfLines={3}
            placeholder="Description de la parcelle..."
          />

          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Prix d'achat"
                value={form.purchasePrice}
                onChangeText={(v: string) =>
                  setForm((f) => ({ ...f, purchasePrice: formatDecimalInput(v) }))
                }
                error={formErrors.purchasePrice}
                keyboardType="decimal-pad"
                placeholder="0"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Select
                label="Devise"
                value={form.currency}
                onValueChange={(v: string) =>
                  setForm((f) => ({ ...f, currency: v }))
                }
                options={currencyOptions}
              />
            </View>
          </View>

          <Input
            label="Date d'achat"
            value={form.purchaseDate}
            onChangeText={(v: string) =>
              setForm((f) => ({ ...f, purchaseDate: v }))
            }
            placeholder="YYYY-MM-DD"
          />
          <Input
            label="Adresse"
            value={form.address}
            onChangeText={(v: string) =>
              setForm((f) => ({ ...f, address: v }))
            }
            placeholder="Adresse de la parcelle"
          />
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Input
                label="Ville"
                value={form.city}
                onChangeText={(v: string) =>
                  setForm((f) => ({ ...f, city: v }))
                }
              />
            </View>
            <View style={{ flex: 1 }}>
              <Input
                label="Région"
                value={form.region}
                onChangeText={(v: string) =>
                  setForm((f) => ({ ...f, region: v }))
                }
              />
            </View>
          </View>

          {/* Boundaries */}
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "500",
                marginBottom: 8,
                color: isDark ? "#e2e8f0" : "#334155",
              }}
            >
              Limites de la parcelle
            </Text>
            {pendingBoundaries && pendingBoundaries.length >= 3 ? (
              <View
                style={{
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: isDark ? "#0f172a" : "#f0fdf4",
                  borderWidth: 1,
                  borderColor: isDark ? "#166534" : "#bbf7d0",
                  gap: 4,
                }}
              >
                <Text style={{ color: "#22c55e", fontWeight: "600" }}>
                  {pendingBoundaries.length} points GPS
                </Text>
                <Text
                  style={{
                    color: isDark ? "#94a3b8" : "#64748b",
                    fontSize: 13,
                  }}
                >
                  Surface:{" "}
                  {formatArea(calculatePolygonArea(pendingBoundaries))}
                </Text>
              </View>
            ) : (
              <Text
                style={{
                  color: isDark ? "#64748b" : "#94a3b8",
                  fontSize: 13,
                  marginBottom: 8,
                }}
              >
                Appuyez ci-dessous pour définir les limites
              </Text>
            )}
            <Button
              variant="outline"
              onPress={navigateToMapBoundary}
              style={{ marginTop: 8 }}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <HugeiconsIcon
                  icon={PinLocation03Icon}
                  size={16}
                  color="#0ea5e9"
                />
                <Text style={{ color: "#0ea5e9", fontWeight: "600" }}>
                  {pendingBoundaries
                    ? "Modifier les limites"
                    : "Définir les limites"}
                </Text>
              </View>
            </Button>
          </View>

          {/* Documents */}
          <View style={{ marginBottom: 16 }}>
            <Text
              style={{
                fontSize: 14,
                fontWeight: "500",
                marginBottom: 8,
                color: isDark ? "#e2e8f0" : "#334155",
              }}
            >
              Documents
            </Text>

            {/* Existing documents (edit mode) */}
            {editingItem?.documents.map((doc) => (
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
                <View className="flex-1" style={{ minWidth: 0 }}>
                  <Text
                    className={`text-sm font-medium ${
                      isDark ? "text-gray-100" : "text-gray-900"
                    }`}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {doc.title || doc.filename}
                  </Text>
                  <Text
                    className={`text-xs ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {doc.filename}
                  </Text>
                </View>
                <View style={{ flexDirection: "row", gap: 6 }}>
                  <TouchableOpacity
                    onPress={() => handleOpenDocument(doc)}
                    className="p-2 rounded-full"
                    style={{
                      backgroundColor: isDark
                        ? "rgba(14,165,233,0.1)"
                        : "#e0f2fe",
                    }}
                    activeOpacity={0.7}
                  >
                    <HugeiconsIcon
                      icon={EyeIcon}
                      size={16}
                      color="#0ea5e9"
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => handleDeleteDocument(doc)}
                    className="p-2 rounded-full"
                    style={{
                      backgroundColor: isDark
                        ? "rgba(239,68,68,0.1)"
                        : "#fee2e2",
                    }}
                    activeOpacity={0.7}
                  >
                    <HugeiconsIcon
                      icon={Delete01Icon}
                      size={16}
                      color="#ef4444"
                    />
                  </TouchableOpacity>
                </View>
              </View>
            ))}

            {/* Pending uploads */}
            {pendingDocuments.map((doc, idx) => (
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
                    className={`text-xs ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {doc.file.name || "Document"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() =>
                    setPendingDocuments((prev) =>
                      prev.filter((_, i) => i !== idx)
                    )
                  }
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

            {/* Add document button */}
            <TouchableOpacity
              onPress={handleAddDocument}
              disabled={isAddingDocument}
              className={`flex-row items-center justify-center gap-2 py-3 rounded-full border-2 border-dashed ${
                isDark
                  ? "border-gray-600 bg-[#0f172a]"
                  : "border-gray-300 bg-gray-50"
              }`}
              style={{ opacity: isAddingDocument ? 0.6 : 1, marginTop: 4 }}
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
        </View>
      </Drawer>

      {/* Map Preview Drawer */}
      {mapDrawerItem && (
        <MapPreviewDrawer
          item={mapDrawerItem}
          isDark={isDark}
          onClose={() => setMapDrawerItem(null)}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statsRow: { flexDirection: "row", gap: 8 },
  statCard: {
    flex: 1,
    height: 90,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 15, height: 44 },
  landCard: {
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  cardContent: { padding: 12, gap: 6 },
  cardHeader: { gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: "600" },
  cardSubtitle: { fontSize: 12 },
  cardRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  cardMeta: { fontSize: 13 },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  cardActions: { flexDirection: "row", gap: 8 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
    gap: 12,
  },
  emptyText: { fontSize: 15, textAlign: "center" },
});
