import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import MapView, { Polygon, Polyline, Marker, PROVIDER_GOOGLE, PROVIDER_DEFAULT, Region } from "react-native-maps";
import * as Location from "expo-location";
import { useNavigation, useRoute } from "@react-navigation/native";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  ArrowLeft01Icon,
  PinLocation01Icon,
  SatelliteIcon,
  Tick01Icon,
  Delete01Icon,
  ArrowMoveDownLeftIcon,
} from "@hugeicons/core-free-icons";
import {
  calculatePolygonArea,
  calculatePolygonCenter,
  formatArea,
} from "@/utils/geo";

interface LatLng {
  lat: number;
  lng: number;
}

export function MapBoundaryScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const mapRef = useRef<MapView>(null);
  const currentRegionRef = useRef<Region | null>(null);

  const existingBoundaries: LatLng[] | undefined =
    route.params?.existingBoundaries;
  const onComplete: ((boundaries: LatLng[]) => void) | undefined =
    route.params?.onComplete;

  const [points, setPoints] = useState<LatLng[]>(existingBoundaries ?? []);
  const [mapType, setMapType] = useState<"standard" | "satellite">("standard");
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  // Center map on user's current location on mount
  useEffect(() => {
    if (existingBoundaries && existingBoundaries.length > 0) return;
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        mapRef.current?.animateToRegion(
          {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            latitudeDelta: 0.002,
            longitudeDelta: 0.002,
          },
          800
        );
      } catch {}
    })();
  }, []);

  const handleMapPress = useCallback(
    (e: any) => {
      const { latitude, longitude } = e.nativeEvent.coordinate;

      if (selectedIdx !== null) {
        // Move the selected point to tapped location
        setPoints((prev) => {
          const updated = [...prev];
          updated[selectedIdx] = { lat: latitude, lng: longitude };
          return updated;
        });
        setSelectedIdx(null);
      } else {
        // Add a new point
        setPoints((prev) => [...prev, { lat: latitude, lng: longitude }]);
      }
    },
    [selectedIdx]
  );

  const centerOnMe = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") return;
    try {
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      mapRef.current?.animateToRegion(
        {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          latitudeDelta: 0.001,
          longitudeDelta: 0.001,
        },
        500
      );
    } catch {}
  };

  const zoomIn = () => {
    const region = currentRegionRef.current;
    if (!region) return;
    mapRef.current?.animateToRegion(
      {
        ...region,
        latitudeDelta: region.latitudeDelta / 2,
        longitudeDelta: region.longitudeDelta / 2,
      },
      300
    );
  };

  const zoomOut = () => {
    const region = currentRegionRef.current;
    if (!region) return;
    mapRef.current?.animateToRegion(
      {
        ...region,
        latitudeDelta: region.latitudeDelta * 2,
        longitudeDelta: region.longitudeDelta * 2,
      },
      300
    );
  };

  const removeLastPoint = () => {
    setPoints((prev) => prev.slice(0, -1));
    setSelectedIdx(null);
  };

  const removePoint = (idx: number) => {
    setPoints((prev) => prev.filter((_, i) => i !== idx));
    setSelectedIdx(null);
  };

  const validate = () => {
    if (points.length < 3) {
      Alert.alert(
        "Pas assez de points",
        "Il faut au moins 3 points pour définir une parcelle."
      );
      return;
    }

    if (onComplete) {
      onComplete(points);
    }
    navigation.goBack();
  };

  const area = points.length >= 3 ? calculatePolygonArea(points) : 0;

  const mapCoords = points.map((p) => ({
    latitude: p.lat,
    longitude: p.lng,
  }));

  const initialRegion = existingBoundaries && existingBoundaries.length > 0
    ? {
        latitude: calculatePolygonCenter(existingBoundaries).lat,
        longitude: calculatePolygonCenter(existingBoundaries).lng,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }
    : {
        latitude: 9.5091,
        longitude: -13.7122,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFillObject}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : PROVIDER_DEFAULT}
        mapType={mapType}
        initialRegion={initialRegion}
        onPress={handleMapPress}
        onRegionChangeComplete={(region) => {
          currentRegionRef.current = region;
        }}
        showsUserLocation
        showsMyLocationButton={false}
        showsCompass={false}
        showsScale={false}
        toolbarEnabled={false}
        showsPointsOfInterest={false}
      >
        {/* Closed polygon when 3+ points */}
        {points.length >= 3 && (
          <Polygon
            coordinates={mapCoords}
            strokeColor="#0ea5e9"
            fillColor="rgba(14, 165, 233, 0.15)"
            strokeWidth={2.5}
          />
        )}

        {/* Line between 2 points */}
        {points.length === 2 && (
          <Polyline
            coordinates={mapCoords}
            strokeColor="#0ea5e9"
            strokeWidth={2.5}
          />
        )}

        {/* Markers — tap to select, then tap map to move */}
        {points.map((p, idx) => (
          <Marker
            key={`marker-${idx}`}
            coordinate={{ latitude: p.lat, longitude: p.lng }}
            onPress={(e) => {
              e.stopPropagation();
              setSelectedIdx(idx === selectedIdx ? null : idx);
            }}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View
              style={[
                styles.markerDot,
                idx === 0 && styles.markerDotFirst,
                selectedIdx === idx && styles.markerDotSelected,
              ]}
            >
              <Text style={styles.markerLabel}>{idx + 1}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* Right side floating buttons */}
      <View style={styles.sideButtons}>
        {/* Zoom in */}
        <TouchableOpacity style={styles.sideBtn} onPress={zoomIn}>
          <Text style={styles.zoomText}>+</Text>
        </TouchableOpacity>

        {/* Zoom out */}
        <TouchableOpacity style={styles.sideBtn} onPress={zoomOut}>
          <Text style={styles.zoomText}>−</Text>
        </TouchableOpacity>

        <View style={styles.sideDivider} />

        {/* Center on me */}
        <TouchableOpacity style={styles.sideBtn} onPress={centerOnMe}>
          <HugeiconsIcon icon={PinLocation01Icon} size={20} color="#0ea5e9" />
        </TouchableOpacity>

        {/* Toggle map type */}
        <TouchableOpacity
          style={styles.sideBtn}
          onPress={() =>
            setMapType((t) => (t === "standard" ? "satellite" : "standard"))
          }
        >
          <HugeiconsIcon
            icon={SatelliteIcon}
            size={20}
            color={mapType === "satellite" ? "#0ea5e9" : "#334155"}
          />
        </TouchableOpacity>
      </View>

      {/* Selected point banner */}
      {selectedIdx !== null && (
        <View style={styles.selectedBanner}>
          <Text style={styles.selectedText}>
            Point {selectedIdx + 1} — appuyez sur la carte pour déplacer
          </Text>
          <TouchableOpacity
            onPress={() => removePoint(selectedIdx)}
            style={styles.removePointBtn}
          >
            <HugeiconsIcon icon={Delete01Icon} size={16} color="#ffffff" />
          </TouchableOpacity>
        </View>
      )}

      {/* Top bar */}
      <SafeAreaView edges={["top"]} style={styles.topBar}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.topBtn}
        >
          <HugeiconsIcon icon={ArrowLeft01Icon} size={22} color="#ffffff" />
        </TouchableOpacity>

        <View style={styles.titleContainer}>
          <Text style={styles.titleText}>Définir les limites</Text>
          <Text style={styles.subtitleText}>
            {selectedIdx !== null
              ? "Appuyez pour repositionner le point"
              : "Appuyez sur la carte pour placer un point"}
          </Text>
        </View>

        <View style={{ width: 40 }} />
      </SafeAreaView>

      {/* Bottom panel */}
      <SafeAreaView edges={["bottom"]} style={styles.bottomPanel}>
        {/* Info row */}
        <View style={styles.infoRow}>
          <Text style={styles.infoText}>
            {points.length} point{points.length !== 1 ? "s" : ""}
          </Text>
          {area > 0 && (
            <Text style={styles.infoText}>Surface: {formatArea(area)}</Text>
          )}
        </View>

        {/* Action buttons */}
        <View style={styles.actionsRow}>
          {points.length > 0 && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#64748b" }]}
              onPress={removeLastPoint}
            >
              <HugeiconsIcon
                icon={ArrowMoveDownLeftIcon}
                size={18}
                color="#ffffff"
              />
              <Text style={styles.actionBtnText}>Annuler</Text>
            </TouchableOpacity>
          )}

          {points.length >= 3 && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#22c55e" }]}
              onPress={validate}
            >
              <HugeiconsIcon icon={Tick01Icon} size={20} color="#ffffff" />
              <Text style={styles.actionBtnText}>Valider</Text>
            </TouchableOpacity>
          )}

          {points.length > 0 && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: "#ef4444" }]}
              onPress={() => {
                setPoints([]);
                setSelectedIdx(null);
              }}
            >
              <HugeiconsIcon icon={Delete01Icon} size={18} color="#ffffff" />
              <Text style={styles.actionBtnText}>Effacer</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  sideButtons: {
    position: "absolute",
    right: 16,
    top: "30%",
    gap: 8,
    alignItems: "center",
  },
  sideBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 4,
  },
  sideDivider: {
    width: 24,
    height: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  zoomText: {
    fontSize: 22,
    fontWeight: "600",
    color: "#334155",
    marginTop: -1,
  },
  markerDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#0ea5e9",
    borderWidth: 3,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 4,
  },
  markerDotFirst: {
    backgroundColor: "#22c55e",
  },
  markerDotSelected: {
    borderColor: "#facc15",
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  markerLabel: {
    color: "#ffffff",
    fontSize: 11,
    fontWeight: "800",
  },
  selectedBanner: {
    position: "absolute",
    top: 110,
    left: 16,
    right: 16,
    backgroundColor: "rgba(14, 165, 233, 0.9)",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  selectedText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
    flex: 1,
  },
  removePointBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#ef4444",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  topBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  titleContainer: {
    alignItems: "center",
  },
  titleText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  subtitleText: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 12,
    fontWeight: "500",
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  bottomPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 12,
  },
  infoText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "500",
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    paddingBottom: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 22,
  },
  actionBtnText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
});
