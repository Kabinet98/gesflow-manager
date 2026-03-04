import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  Share,
  ActivityIndicator,
  Linking,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, {
  Polygon,
  Marker,
  PROVIDER_GOOGLE,
  PROVIDER_DEFAULT,
} from "react-native-maps";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/config/api";
import { useTheme } from "@/contexts/ThemeContext";
import { usePermissions } from "@/hooks/usePermissions";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  ArrowLeft01Icon,
  Delete01Icon,
  Share01Icon,
  Location01Icon,
  File01Icon,
  Calendar03Icon,
  PinLocation03Icon,
  Money01Icon,
  MapsIcon,
  GridTableIcon,
} from "@hugeicons/core-free-icons";
import { BlurredAmount } from "@/components/BlurredAmount";
import { formatArea, calculatePolygonCenter } from "@/utils/geo";
import type { LandTitle, LandTitleDocument } from "@/types";
import { TAB_BAR_PADDING_BOTTOM } from "@/constants/layout";

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

export function LandTitleDetailScreen() {
  const { isDark } = useTheme();
  const { hasPermission } = usePermissions();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();

  const canUpdate = hasPermission("land-titles.update");

  const passedItem: LandTitle = route.params?.landTitle;

  const { data: item } = useQuery({
    queryKey: ["land-title", passedItem?.id],
    queryFn: async () => {
      const res = await api.get<LandTitle>(
        `/api/land-titles/${passedItem.id}`
      );
      return res.data;
    },
    initialData: passedItem,
    enabled: !!passedItem?.id,
  });

  const [deletingDoc, setDeletingDoc] = useState<string | null>(null);

  if (!item) return null;

  const hasBounds =
    item.boundaries &&
    Array.isArray(item.boundaries) &&
    item.boundaries.length >= 3;

  const center = hasBounds
    ? calculatePolygonCenter(item.boundaries!)
    : item.centerLat && item.centerLng
    ? { lat: item.centerLat, lng: item.centerLng }
    : null;

  const mapCoords = hasBounds
    ? item.boundaries!.map((p) => ({
        latitude: p.lat,
        longitude: p.lng,
      }))
    : [];

  const handleShare = () => {
    let message = `${item.name}`;
    if (item.titleNumber) message += `\nTitre: ${item.titleNumber}`;
    if (item.area) message += `\nSurface: ${formatArea(item.area)}`;
    if (item.address) message += `\nAdresse: ${item.address}`;
    if (item.city) message += `\nVille: ${item.city}`;
    if (item.region) message += `\nRégion: ${item.region}`;
    if (center) {
      message += `\nhttps://www.google.com/maps?q=${center.lat},${center.lng}`;
    }
    Share.share({ message });
  };

  const handleDeleteDocument = (doc: LandTitleDocument) => {
    Alert.alert(
      "Supprimer le document",
      `Supprimer "${doc.title || doc.filename}" ?`,
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Supprimer",
          style: "destructive",
          onPress: async () => {
            setDeletingDoc(doc.id);
            try {
              await api.delete(
                `/api/land-titles/${item.id}/documents?documentId=${doc.id}`
              );
              queryClient.invalidateQueries({
                queryKey: ["land-title", item.id],
              });
              queryClient.invalidateQueries({ queryKey: ["land-titles"] });
            } catch {
              Alert.alert("Erreur", "Impossible de supprimer le document");
            } finally {
              setDeletingDoc(null);
            }
          },
        },
      ]
    );
  };

  const handleOpenDocument = async (doc: LandTitleDocument) => {
    try {
      let url = doc.url;
      if (!url) {
        Alert.alert("Erreur", "URL du document manquante");
        return;
      }

      // For /api/files/ URLs, fetch the signed MinIO URL via authenticated request
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
            if (location) url = location;
            else url = apiUrl;
          } else {
            url = apiUrl;
          }
        } catch {
          url = `${api.defaults.baseURL}${url}`;
        }
      } else if (!url.startsWith("http")) {
        url = `${api.defaults.baseURL}${url}`;
      }

      if (!url.startsWith("http")) {
        Alert.alert("Erreur", "URL du document invalide");
        return;
      }

      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        Alert.alert("Erreur", "Impossible d'ouvrir le document");
      }
    } catch {
      Alert.alert("Erreur", "Impossible d'ouvrir le document");
    }
  };

  // --- Colors ---
  const bgColor = isDark ? "#0f172a" : "#ffffff";
  const cardBg = isDark ? "#1e293b" : "#f8fafc";
  const textColor = isDark ? "#f1f5f9" : "#0f172a";
  const mutedColor = isDark ? "#94a3b8" : "#64748b";
  const borderColor = isDark ? "#334155" : "#e2e8f0";
  const subtleBg = isDark ? "rgba(14, 165, 233, 0.08)" : "rgba(14, 165, 233, 0.06)";

  // Location text
  const locationParts = [item.city, item.region].filter(Boolean);
  const locationText = locationParts.length > 0 ? locationParts.join(", ") : null;

  // Build info rows
  const infoRows: Array<{
    icon: any;
    label: string;
    value: React.ReactNode;
    isAmount?: boolean;
  }> = [];

  if (item.titleNumber) {
    infoRows.push({
      icon: GridTableIcon,
      label: "N° Titre foncier",
      value: item.titleNumber,
    });
  }
  if (item.area != null && item.area > 0) {
    infoRows.push({
      icon: MapsIcon,
      label: "Surface",
      value: formatArea(item.area),
    });
  }
  if (item.address) {
    infoRows.push({
      icon: Location01Icon,
      label: "Adresse",
      value: item.address,
    });
  }
  if (item.city) {
    infoRows.push({
      icon: PinLocation03Icon,
      label: "Ville",
      value: item.city,
    });
  }
  if (item.region) {
    infoRows.push({
      icon: PinLocation03Icon,
      label: "Région",
      value: item.region,
    });
  }
  if (item.purchasePrice != null) {
    infoRows.push({
      icon: Money01Icon,
      label: "Prix d'achat",
      value: null,
      isAmount: true,
    });
  }
  if (item.purchaseDate) {
    infoRows.push({
      icon: Calendar03Icon,
      label: "Date d'achat",
      value: formatDate(item.purchaseDate),
    });
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: bgColor }]}
      edges={["top", "bottom"]}
    >
      {/* ─── FIXED HEADER ─── */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: bgColor,
            borderBottomColor: borderColor,
            borderBottomWidth: StyleSheet.hairlineWidth,
          },
        ]}
      >
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={[styles.headerIconBtn, { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" }]}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={20} color={textColor} />
        </TouchableOpacity>

        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text
            style={[styles.headerTitle, { color: textColor }]}
            numberOfLines={1}
          >
            {item.name}
          </Text>
          {locationText && (
            <Text style={{ color: mutedColor, fontSize: 12, marginTop: 1 }} numberOfLines={1}>
              {locationText}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={handleShare}
          style={[
            styles.headerIconBtn,
            { backgroundColor: isDark ? "#1e293b" : "#f1f5f9" },
          ]}
        >
          <HugeiconsIcon icon={Share01Icon} size={18} color="#0ea5e9" />
        </TouchableOpacity>
      </View>

      {/* ─── FIXED MAP ─── */}
      {center && (
        <View style={styles.mapContainer}>
          <MapView
            style={styles.map}
            provider={
              Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT
            }
            mapType="satellite"
            initialRegion={{
              latitude: center.lat,
              longitude: center.lng,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }}
            scrollEnabled={false}
            zoomEnabled={false}
            pitchEnabled={false}
            rotateEnabled={false}
          >
            {hasBounds && (
              <Polygon
                coordinates={mapCoords}
                strokeColor="#0ea5e9"
                fillColor="rgba(14, 165, 233, 0.25)"
                strokeWidth={2}
              />
            )}
            <Marker
              coordinate={{ latitude: center.lat, longitude: center.lng }}
              pinColor="#0ea5e9"
            />
          </MapView>
          {/* Map overlay badges */}
          <View style={styles.mapOverlay}>
            {hasBounds && (
              <View style={styles.mapBadge}>
                <HugeiconsIcon icon={PinLocation03Icon} size={12} color="#ffffff" />
                <Text style={styles.mapBadgeText}>
                  {item.boundaries!.length} points
                </Text>
              </View>
            )}
            {item.area != null && item.area > 0 && (
              <View style={styles.mapBadge}>
                <HugeiconsIcon icon={MapsIcon} size={12} color="#ffffff" />
                <Text style={styles.mapBadgeText}>{formatArea(item.area)}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* ─── SCROLLABLE CONTENT ─── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: TAB_BAR_PADDING_BOTTOM + 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Informations ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <Text style={[styles.sectionTitle, { color: textColor }]}>
            Informations
          </Text>
          <View
            style={[
              styles.card,
              {
                backgroundColor: cardBg,
                borderColor: borderColor,
              },
            ]}
          >
            {infoRows.map((row, index) => (
              <View
                key={row.label}
                style={[
                  styles.infoRow,
                  index < infoRows.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: borderColor,
                  },
                ]}
              >
                <View
                  style={[
                    styles.infoIconWrap,
                    { backgroundColor: subtleBg },
                  ]}
                >
                  <HugeiconsIcon icon={row.icon} size={16} color="#0ea5e9" />
                </View>
                <Text style={[styles.infoLabel, { color: mutedColor }]}>
                  {row.label}
                </Text>
                {row.isAmount ? (
                  <BlurredAmount
                    amount={item.purchasePrice!}
                    currency={item.currency}
                    className={
                      isDark
                        ? "text-sm text-white font-semibold"
                        : "text-sm text-gray-900 font-semibold"
                    }
                  />
                ) : (
                  <Text
                    style={[styles.infoValue, { color: textColor }]}
                    numberOfLines={2}
                  >
                    {row.value as string}
                  </Text>
                )}
              </View>
            ))}

            {infoRows.length === 0 && (
              <View style={{ padding: 16, alignItems: "center" }}>
                <Text style={{ color: mutedColor, fontSize: 13 }}>
                  Aucune information disponible
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Description ── */}
        {item.description && (
          <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
            <Text style={[styles.sectionTitle, { color: textColor }]}>
              Description
            </Text>
            <View
              style={[
                styles.card,
                {
                  backgroundColor: cardBg,
                  borderColor: borderColor,
                  padding: 16,
                },
              ]}
            >
              <Text
                style={{
                  color: textColor,
                  fontSize: 14,
                  lineHeight: 20,
                }}
              >
                {item.description}
              </Text>
            </View>
          </View>
        )}

        {/* ── Documents ── */}
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 10,
            }}
          >
            <Text style={[styles.sectionTitle, { color: textColor, marginBottom: 0 }]}>
              Documents
            </Text>
            {item.documents && item.documents.length > 0 && (
              <View
                style={[
                  styles.countBadge,
                  { backgroundColor: isDark ? "rgba(14,165,233,0.15)" : "#e0f2fe" },
                ]}
              >
                <Text style={{ color: "#0ea5e9", fontSize: 12, fontWeight: "600" }}>
                  {item.documents.length}
                </Text>
              </View>
            )}
          </View>

          {item.documents && item.documents.length > 0 ? (
            <View
              style={[
                styles.card,
                { backgroundColor: cardBg, borderColor: borderColor },
              ]}
            >
              {item.documents.map((doc, index) => (
                <TouchableOpacity
                  key={doc.id}
                  style={[
                    styles.docRow,
                    index < item.documents.length - 1 && {
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: borderColor,
                    },
                  ]}
                  onPress={() => handleOpenDocument(doc)}
                  activeOpacity={0.6}
                >
                  <View
                    style={[
                      styles.docIconWrap,
                      {
                        backgroundColor: isDark
                          ? "rgba(14,165,233,0.1)"
                          : "#e0f2fe",
                      },
                    ]}
                  >
                    <HugeiconsIcon icon={File01Icon} size={16} color="#0ea5e9" />
                  </View>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={{ color: textColor, fontSize: 14, fontWeight: "500" }}
                      numberOfLines={1}
                    >
                      {doc.title || doc.filename}
                    </Text>
                    {(doc.fileType || doc.fileSize) && (
                      <Text style={{ color: mutedColor, fontSize: 11 }}>
                        {[
                          doc.fileType,
                          doc.fileSize
                            ? `${(doc.fileSize / 1024).toFixed(0)} KB`
                            : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    )}
                  </View>
                  {canUpdate && (
                    <TouchableOpacity
                      onPress={() => handleDeleteDocument(doc)}
                      disabled={deletingDoc === doc.id}
                      style={[
                        styles.docDeleteBtn,
                        {
                          backgroundColor: isDark
                            ? "rgba(239,68,68,0.1)"
                            : "#fee2e2",
                        },
                      ]}
                    >
                      {deletingDoc === doc.id ? (
                        <ActivityIndicator size="small" color="#ef4444" />
                      ) : (
                        <HugeiconsIcon
                          icon={Delete01Icon}
                          size={14}
                          color="#ef4444"
                        />
                      )}
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: cardBg,
                  borderColor: borderColor,
                  padding: 20,
                  alignItems: "center",
                },
              ]}
            >
              <HugeiconsIcon
                icon={File01Icon}
                size={20}
                color={isDark ? "#475569" : "#94a3b8"}
              />
              <Text
                style={{
                  color: mutedColor,
                  fontSize: 13,
                  marginTop: 6,
                }}
              >
                Aucun document joint
              </Text>
            </View>
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  headerIconBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },

  // Map
  mapContainer: {
    height: 200,
    position: "relative",
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapOverlay: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    gap: 6,
  },
  mapBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 20,
  },
  mapBadgeText: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "600",
  },
  // Sections
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 10,
  },

  // Cards
  card: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: "hidden",
  },

  // Info rows
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  infoIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  infoLabel: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "right",
    maxWidth: "45%",
  },

  // Documents
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  docIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  docDeleteBtn: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
});
