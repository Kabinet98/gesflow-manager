import React, { useRef, useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, Platform, Pressable } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface InputOTPProps {
  maxLength?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

export function InputOTP({
  maxLength = 6,
  value,
  onChange,
  disabled = false,
  autoFocus = false,
}: InputOTPProps) {
  const { isDark } = useTheme();
  const inputRef = useRef<TextInput | null>(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    if (autoFocus) {
      // Petit délai pour laisser le layout se stabiliser
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [autoFocus]);

  const handleChange = (text: string) => {
    const numericText = text.replace(/[^0-9]/g, "").slice(0, maxLength);
    onChange(numericText);
  };

  const handlePress = () => {
    inputRef.current?.focus();
  };

  // Index actif = longueur du texte actuel (prochain slot à remplir)
  const activeIndex = Math.min(value.length, maxLength - 1);

  return (
    <Pressable onPress={handlePress} style={styles.container}>
      {/* TextInput caché qui gère toute la saisie */}
      <TextInput
        ref={inputRef}
        value={value}
        onChangeText={handleChange}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        keyboardType="number-pad"
        maxLength={maxLength}
        editable={!disabled}
        caretHidden
        autoComplete="one-time-code"
        style={styles.hiddenInput}
      />
      {/* Slots visuels */}
      {Array.from({ length: maxLength }).map((_, index) => {
        const char = value[index] || "";
        const isActive = isFocused && index === activeIndex;
        const isFilled = !!char;

        return (
          <View
            key={index}
            style={[
              styles.slot,
              {
                backgroundColor: isDark
                  ? isFilled
                    ? "rgba(255, 255, 255, 0.15)"
                    : "rgba(255, 255, 255, 0.07)"
                  : isFilled
                  ? "rgba(0, 0, 0, 0.06)"
                  : "rgba(0, 0, 0, 0.03)",
                borderColor: isActive
                  ? "#0ea5e9"
                  : isFilled
                  ? isDark
                    ? "rgba(255, 255, 255, 0.3)"
                    : "rgba(0, 0, 0, 0.2)"
                  : isDark
                  ? "rgba(255, 255, 255, 0.12)"
                  : "rgba(0, 0, 0, 0.1)",
                borderWidth: isActive ? 2 : 1.5,
              },
            ]}
          >
            {isFilled && (
              <Text
                style={[
                  styles.slotText,
                  { color: isDark ? "#ffffff" : "#000000" },
                ]}
              >
                {char}
              </Text>
            )}
            {/* Curseur clignotant */}
            {isActive && !isFilled && (
              <View
                style={[
                  styles.cursor,
                  { backgroundColor: "#0ea5e9" },
                ]}
              />
            )}
          </View>
        );
      })}
    </Pressable>
  );
}

export function InputOTPGroup({ children }: { children: React.ReactNode }) {
  return <View style={styles.group}>{children}</View>;
}

export function InputOTPSlot({ index }: { index: number }) {
  return null;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 4,
    position: "relative",
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0,
    width: 1,
    height: 1,
  },
  group: {
    flexDirection: "row",
    gap: 8,
  },
  slot: {
    minWidth: 44,
    maxWidth: 52,
    flex: 1,
    height: 52,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    ...(Platform.OS === "ios"
      ? {
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.06,
          shadowRadius: 6,
        }
      : {}),
  },
  slotText: {
    fontSize: 22,
    fontWeight: "700",
    textAlign: "center",
    ...(Platform.OS === "android" ? { includeFontPadding: false } : {}),
  },
  cursor: {
    position: "absolute",
    width: 2,
    height: 24,
    borderRadius: 1,
  },
});
