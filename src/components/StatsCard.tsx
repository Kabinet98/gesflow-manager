import React from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { BlurredAmount } from "./BlurredAmount";

interface StatsCardProps {
  title: string;
  value: number | string;
  currency?: string;
  isAmount?: boolean;
  subtitle?: string;
  gradientColors: {
    dark: string;
    light: string;
    circle: string;
  };
  textColors: {
    dark: string;
    light: string;
  };
  isDark: boolean;
  width: number;
  height: number;
}

export function StatsCard({
  title,
  value,
  currency = "GNF",
  isAmount = false,
  subtitle,
  gradientColors,
  textColors,
  isDark,
  width,
  height,
}: StatsCardProps) {
  return (
    <View
      style={[
        {
          width,
          height,
          // iOS shadows
          ...(Platform.OS === 'ios' ? {
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.1,
            shadowRadius: 8,
          } : {}),
          // Android elevation (réduite pour éviter l'ombre bizarre)
          ...(Platform.OS === 'android' ? {
            elevation: 2,
          } : {}),
        },
      ]}
      className={`relative overflow-hidden p-4 rounded-lg border-0 ${
        isDark ? gradientColors.dark : gradientColors.light
      }`}
    >
      {/* Cercle décoratif */}
      <View
        className={`absolute top-0 right-0 w-20 h-20 rounded-full ${gradientColors.circle}`}
        style={{
          transform: [{ translateX: 40 }, { translateY: -40 }],
        }}
      />
      <View className="relative z-10">
        <Text
          className={`text-sm font-medium mb-2 ${
            isDark ? textColors.dark : textColors.light
          }`}
        >
          {title}
        </Text>
        {isAmount ? (
          <BlurredAmount
            amount={value as number}
            currency={currency}
            className={`text-xl font-bold ${
              isDark ? textColors.dark : textColors.light
            }`}
          />
        ) : (
          <Text
            className={`text-xl font-bold ${
              isDark ? textColors.dark : textColors.light
            }`}
          >
            {value}
          </Text>
        )}
        {subtitle && (
          <Text
            className={`text-xs mt-1 ${
              isDark ? textColors.dark : textColors.light
            }`}
            style={{ opacity: 0.8 }}
          >
            {subtitle}
          </Text>
        )}
      </View>
    </View>
  );
}



