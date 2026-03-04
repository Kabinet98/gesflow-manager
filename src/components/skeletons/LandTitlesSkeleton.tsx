import React from "react";
import { View, ScrollView } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTheme } from "@/contexts/ThemeContext";
import { TAB_BAR_PADDING_BOTTOM } from "@/constants/layout";

const CONTENT_PADDING_TOP = 80;

export function LandTitlesSkeleton() {
  const { isDark } = useTheme();
  const cardBg = isDark ? "#1e293b" : "#f1f5f9";

  return (
    <ScrollView
      style={{ flex: 1, paddingTop: CONTENT_PADDING_TOP }}
      contentContainerStyle={{ padding: 16, paddingBottom: TAB_BAR_PADDING_BOTTOM + 20, gap: 16 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Stats row */}
      <View style={{ flexDirection: "row", gap: 8 }}>
        {[1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              backgroundColor: cardBg,
              borderRadius: 12,
              padding: 12,
              gap: 8,
            }}
          >
            <Skeleton width="60%" height={12} borderRadius={6} />
            <Skeleton width="80%" height={20} borderRadius={6} />
          </View>
        ))}
      </View>

      {/* Search + button row */}
      <View style={{ flexDirection: "row", gap: 8, alignItems: "center" }}>
        <Skeleton width="100%" height={44} borderRadius={22} style={{ flex: 1 }} />
        <Skeleton width={100} height={44} borderRadius={22} />
      </View>

      {/* 3 card placeholders */}
      {[1, 2, 3].map((i) => (
        <View
          key={i}
          style={{
            backgroundColor: cardBg,
            borderRadius: 12,
            overflow: "hidden",
          }}
        >
          {/* Map area */}
          <Skeleton width="100%" height={160} borderRadius={0} />
          {/* Text content */}
          <View style={{ padding: 12, gap: 8 }}>
            <Skeleton width="70%" height={16} borderRadius={6} />
            <Skeleton width="50%" height={12} borderRadius={6} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Skeleton width="30%" height={12} borderRadius={6} />
              <Skeleton width="25%" height={12} borderRadius={6} />
            </View>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}
