import React from "react";
import { View, StyleSheet, ScrollView, Dimensions } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTheme } from "@/contexts/ThemeContext";
import { TAB_BAR_PADDING_BOTTOM } from "@/constants/layout";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export function DashboardSkeleton() {
  const { isDark } = useTheme();

  // Calculer les dimensions des cartes exactement comme DashboardScreen
  const containerPadding = 48; // 24px padding de chaque côté (px-6)
  const availableWidth = SCREEN_WIDTH - containerPadding;
  const gapHorizontal = 16;
  const gapVertical = 8;
  const cardWidth = (availableWidth - gapHorizontal) / 2;
  const cardHeight = 110;
  const pageWidth = SCREEN_WIDTH - containerPadding;

  return (
    <ScrollView
      className="flex-1"
      showsVerticalScrollIndicator={false}
      contentContainerStyle={{
        paddingBottom: TAB_BAR_PADDING_BOTTOM,
      }}
    >
      {/* Container principal avec padding exactement comme DashboardScreen ligne 262 */}
      {/* Le pt-20 correspond au padding-top pour compenser le Header qui est en position absolute */}
      <View className="px-6 pt-20 pb-4">
        {/* Header avec titre et badge entreprise - mb-6 */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <View className="flex-row items-center gap-3 flex-1">
              <Skeleton width={120} height={32} borderRadius={8} />
              <Skeleton width={150} height={28} borderRadius={9999} />
            </View>
          </View>
        </View>

        {/* Container avec space-y-4 exactement comme DashboardScreen ligne 304 */}
        <View className="space-y-4">
          {/* KPIs Cards - Layout 2x2 avec ScrollView horizontal */}
          <View>
            <View
              className="relative"
              style={{ minHeight: cardHeight * 2 + gapVertical }}
            >
              <ScrollView
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                decelerationRate="fast"
                style={{
                  marginLeft: 0,
                  marginRight: 0,
                  paddingLeft: 0,
                  paddingRight: 0,
                }}
                contentContainerStyle={{
                  paddingRight: 40,
                  paddingLeft: 0,
                }}
              >
                {/* Première page (4 cartes) */}
                <View style={{ width: pageWidth }}>
                  <View style={{ gap: gapVertical }}>
                    {/* Première ligne (2 cartes) */}
                    <View className="flex-row" style={{ gap: gapHorizontal }}>
                      {[...Array(2)].map((_, i) => (
                        <View
                          key={i}
                          style={[
                            {
                              width: cardWidth,
                              height: cardHeight,
                              padding: 16,
                              borderRadius: 12,
                              position: "relative",
                              overflow: "hidden",
                              borderWidth: 1,
                              borderColor: isDark
                                ? "rgba(55, 65, 81, 0.5)"
                                : "#e5e7eb",
                              backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                              shadowColor: "#000",
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.1,
                              shadowRadius: 8,
                              elevation: 4,
                            },
                          ]}
                        >
                          {/* Cercle décoratif */}
                          <View
                            style={{
                              position: "absolute",
                              top: 0,
                              right: 0,
                              width: 80,
                              height: 80,
                              borderRadius: 40,
                              transform: [
                                { translateX: 40 },
                                { translateY: -40 },
                              ],
                              backgroundColor: isDark
                                ? "rgba(16, 185, 129, 0.1)"
                                : "rgba(16, 185, 129, 0.1)",
                            }}
                          />
                          <View style={{ position: "relative", zIndex: 10 }}>
                            <Skeleton
                              width="70%"
                              height={14}
                              borderRadius={4}
                            />
                            <View style={{ height: 8, marginTop: 8 }} />
                            <Skeleton
                              width="85%"
                              height={28}
                              borderRadius={4}
                            />
                            <View style={{ height: 8, marginTop: 8 }} />
                            <Skeleton
                              width="50%"
                              height={12}
                              borderRadius={4}
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                    {/* Deuxième ligne (2 cartes) */}
                    <View className="flex-row" style={{ gap: gapHorizontal }}>
                      {[...Array(2)].map((_, i) => (
                        <View
                          key={i + 2}
                          style={[
                            {
                              width: cardWidth,
                              height: cardHeight,
                              padding: 16,
                              borderRadius: 12,
                              position: "relative",
                              overflow: "hidden",
                              borderWidth: 1,
                              borderColor: isDark
                                ? "rgba(55, 65, 81, 0.5)"
                                : "#e5e7eb",
                              backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                              shadowColor: "#000",
                              shadowOffset: { width: 0, height: 4 },
                              shadowOpacity: 0.1,
                              shadowRadius: 8,
                              elevation: 4,
                            },
                          ]}
                        >
                          <View
                            style={{
                              position: "absolute",
                              top: 0,
                              right: 0,
                              width: 80,
                              height: 80,
                              borderRadius: 40,
                              transform: [
                                { translateX: 40 },
                                { translateY: -40 },
                              ],
                              backgroundColor: isDark
                                ? "rgba(14, 165, 233, 0.1)"
                                : "rgba(14, 165, 233, 0.1)",
                            }}
                          />
                          <View style={{ position: "relative", zIndex: 10 }}>
                            <Skeleton
                              width="70%"
                              height={14}
                              borderRadius={4}
                            />
                            <View style={{ height: 8, marginTop: 8 }} />
                            <Skeleton
                              width="85%"
                              height={28}
                              borderRadius={4}
                            />
                            <View style={{ height: 8, marginTop: 8 }} />
                            <Skeleton
                              width="50%"
                              height={12}
                              borderRadius={4}
                            />
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                </View>
              </ScrollView>
            </View>
          </View>

          {/* Graphique section - Evolution des dépenses */}
          <View>
            <View
              className={`p-5 rounded-xl shadow-sm mb-6 ${
                isDark ? "bg-[#1e293b]" : "bg-gray-50"
              }`}
            >
              {/* Header avec titre et toggle */}
              <View className="mb-6">
                {/* Titre */}
                <Skeleton
                  width={250}
                  height={24}
                  borderRadius={4}
                  style={{ marginBottom: 12 }}
                />
                {/* Toggle Évolution/Répartition */}
                <View className="flex-row justify-start">
                  <View
                    className="flex-row gap-1 rounded-full p-1"
                    style={{
                      backgroundColor: isDark ? "#1f2937" : "#f3f4f6",
                      borderWidth: 1,
                      borderColor: isDark ? "#374151" : "#e5e7eb",
                    }}
                  >
                    <Skeleton width={70} height={24} borderRadius={9999} />
                    <Skeleton width={90} height={24} borderRadius={9999} />
                  </View>
                </View>
              </View>
              {/* Graphique */}
              <View style={{ marginTop: 8 }}>
                <Skeleton width="100%" height={250} borderRadius={12} />
              </View>
            </View>
          </View>

          {/* Graphique section - Répartition */}
          <View>
            <View
              className={`p-5 rounded-xl shadow-sm ${
                isDark ? "bg-[#1e293b]" : "bg-gray-50"
              }`}
            >
              <Skeleton width={180} height={20} borderRadius={4} />
              <View style={{ height: 16, marginTop: 16 }} />
              <Skeleton width="100%" height={200} borderRadius={12} />
            </View>
          </View>

          {/* Graphique section - Prédiction budget */}
          <View>
            <View
              className={`p-5 rounded-xl shadow-sm ${
                isDark ? "bg-[#1e293b]" : "bg-gray-50"
              }`}
            >
              <Skeleton width={160} height={20} borderRadius={4} />
              <View style={{ height: 16, marginTop: 16 }} />
              <Skeleton width="100%" height={180} borderRadius={12} />
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
