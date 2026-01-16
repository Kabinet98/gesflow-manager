import React, { useEffect, useRef, useMemo } from "react";
import { Text, View, StyleSheet, Animated } from "react-native";
import { BlurView } from "expo-blur";
import { useAmountVisibility } from "@/contexts/AmountVisibilityContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/utils/cn";

interface BlurredAmountProps {
  amount: number;
  currency: string;
  className?: string;
  textClassName?: string; // Alias pour className pour compatibilité
  style?: any;
  prefix?: string;
}

// Mapper les classes Tailwind de couleur aux valeurs réelles
const colorMap: Record<string, string> = {
  // Dark mode (200)
  "text-green-200": "#bbf7d0",
  "text-emerald-200": "#a7f3d0",
  "text-orange-200": "#fed7aa",
  "text-yellow-200": "#fef08a",
  "text-blue-200": "#bfdbfe",
  "text-violet-200": "#ddd6fe",
  "text-teal-200": "#99f6e4",
  "text-red-200": "#fecaca",
  "text-pink-200": "#fbcfe8",
  // Light mode (800)
  "text-green-800": "#166534",
  "text-emerald-800": "#065f46",
  "text-orange-800": "#9a3412",
  "text-yellow-800": "#854d0e",
  "text-blue-800": "#1e40af",
  "text-violet-800": "#6b21a8",
  "text-teal-800": "#115e59",
  "text-red-800": "#991b1b",
  "text-pink-800": "#9f1239",
  // Gray scale
  "text-gray-100": "#f9fafb", // Très clair (presque blanc) pour dark mode
  "text-gray-900": "#111827", // Très foncé (presque noir) pour light mode
  // White
  "text-white": "#ffffff",
};

// Extraire la couleur de la className
function extractColorFromClassName(className?: string): string | undefined {
  if (!className) return undefined;

  // Chercher une classe de couleur dans className
  const colorClass = className
    .split(" ")
    .find((cls) => cls.startsWith("text-") && colorMap[cls]);

  return colorClass ? colorMap[colorClass] : undefined;
}

export function BlurredAmount({
  amount,
  currency,
  className,
  textClassName,
  style,
  prefix,
}: BlurredAmountProps) {
  const { isAmountVisible } = useAmountVisibility();
  const { isDark } = useTheme();
  const blurOpacity = useRef(
    new Animated.Value(isAmountVisible ? 0 : 1)
  ).current;

  const formattedAmount = new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2, // Arrondir à 2 décimales
  }).format(amount);

  const displayText = prefix ? `${prefix}${formattedAmount}` : formattedAmount;

  // Utiliser textClassName si fourni, sinon className
  const finalClassName = textClassName || className;

  // Extraire la couleur de className ou utiliser celle du style
  const textColor = useMemo(() => {
    if (style && typeof style === "object" && "color" in style) {
      return style.color;
    }
    const extractedColor = extractColorFromClassName(finalClassName);
    // Si aucune couleur n'est spécifiée, utiliser blanc pour dark mode et noir pour light mode
    if (!extractedColor) {
      return isDark ? "#ffffff" : "#111827";
    }
    return extractedColor;
  }, [finalClassName, style, isDark]);

  useEffect(() => {
    Animated.timing(blurOpacity, {
      toValue: isAmountVisible ? 0 : 1,
      duration: 300, // transition-all duration-300
      useNativeDriver: true,
    }).start();
  }, [isAmountVisible]);

  // Design simple comme dans amount-display.tsx : filter: blur(8px) avec transition
  // Un seul BlurView avec intensité ~20-25 pour simuler blur(8px)
  // Extraire la taille de la className ou utiliser celle du style
  const extractFontSize = (className?: string): number | undefined => {
    if (!className) return undefined;

    // text-xs = 12px, text-sm = 14px, text-base = 16px, text-lg = 18px, text-xl = 20px
    if (className.includes("text-xs")) return 12;
    if (className.includes("text-sm")) return 14;
    if (className.includes("text-base")) return 16;
    if (className.includes("text-lg")) return 18;
    if (className.includes("text-xl")) return 20;
    if (className.includes("text-2xl")) return 24;

    return undefined;
  };

  const fontSize = style?.fontSize || extractFontSize(finalClassName) || 16; // default to text-base

  const textStyle = textColor
    ? { ...style, color: textColor, fontSize }
    : { ...style, fontSize };

  return (
    <View style={[styles.container, { flexShrink: 1 }]}>
      <Text
        className={cn(
          "transition-all duration-300",
          !isAmountVisible && "select-none",
          finalClassName
        )}
        style={[textStyle, { flexShrink: 1 }]}
        numberOfLines={1}
        adjustsFontSizeToFit={true}
        minimumFontScale={0.7}
      >
        {displayText}
      </Text>

      {/* Blur simple - simule filter: blur(8px) */}
      {!isAmountVisible && (
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            styles.blurOverlay,
            { opacity: blurOpacity },
          ]}
        >
          <BlurView
            intensity={22} // Simule approximativement blur(8px)
            tint={isDark ? "dark" : "light"}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "relative",
    alignSelf: "flex-start", // Prendre seulement la taille du contenu
    overflow: "hidden",
    borderRadius: 9999, // rounded-full
  },
  blurOverlay: {
    borderRadius: 9999, // rounded-full pour le blur
  },
});
