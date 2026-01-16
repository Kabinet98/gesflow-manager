import React, { useRef, useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, TouchableOpacity } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";

interface InputOTPProps {
  maxLength?: number;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}

interface InputOTPGroupProps {
  children: React.ReactNode;
}

interface InputOTPSlotProps {
  index: number;
}

export function InputOTP({
  maxLength = 6,
  value,
  onChange,
  disabled = false,
  autoFocus = false,
}: InputOTPProps) {
  const { isDark } = useTheme();
  const inputRefs = useRef<(TextInput | null)[]>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(
    autoFocus ? 0 : null
  );

  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0]?.focus();
    }
  }, [autoFocus]);

  const handleChange = (text: string, index: number) => {
    // Ne garder que les chiffres
    const numericText = text.replace(/[^0-9]/g, "");

    if (numericText.length > 1) {
      // Si plusieurs caractères (collage), distribuer dans les slots
      const newValue = value.split("");
      for (let i = 0; i < numericText.length && index + i < maxLength; i++) {
        newValue[index + i] = numericText[i];
      }
      const updatedValue = newValue.join("").slice(0, maxLength);
      onChange(updatedValue);

      // Focus sur le prochain slot vide ou le dernier
      const nextIndex = Math.min(index + numericText.length, maxLength - 1);
      if (nextIndex < maxLength && inputRefs.current[nextIndex]) {
        inputRefs.current[nextIndex]?.focus();
      }
    } else {
      // Un seul caractère
      const newValue = value.split("");
      newValue[index] = numericText;
      const updatedValue = newValue.join("").slice(0, maxLength);
      onChange(updatedValue);

      // Passer au slot suivant si un caractère a été saisi
      if (numericText && index < maxLength - 1) {
        inputRefs.current[index + 1]?.focus();
      }
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !value[index] && index > 0) {
      // Si le slot est vide et qu'on appuie sur backspace, aller au slot précédent
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleFocus = (index: number) => {
    setFocusedIndex(index);
  };

  const handleBlur = () => {
    setFocusedIndex(null);
  };

  return (
    <View style={styles.container}>
      {Array.from({ length: maxLength }).map((_, index) => (
        <TextInput
          key={index}
          ref={(ref) => {
            inputRefs.current[index] = ref;
          }}
          value={value[index] || ""}
          onChangeText={(text) => handleChange(text, index)}
          onKeyPress={(e) => handleKeyPress(e, index)}
          onFocus={() => handleFocus(index)}
          onBlur={handleBlur}
          keyboardType="number-pad"
          maxLength={1}
          editable={!disabled}
          selectTextOnFocus
          style={[
            styles.slot,
            {
              backgroundColor: isDark
                ? "rgba(255, 255, 255, 0.1)"
                : "rgba(0, 0, 0, 0.05)",
              borderColor:
                focusedIndex === index
                  ? "#0ea5e9"
                  : isDark
                  ? "rgba(255, 255, 255, 0.5)"
                  : "rgba(0, 0, 0, 0.3)",
              color: isDark ? "#ffffff" : "#000000",
              borderWidth: 2,
            },
          ]}
        />
      ))}
    </View>
  );
}

export function InputOTPGroup({ children }: InputOTPGroupProps) {
  return <View style={styles.group}>{children}</View>;
}

export function InputOTPSlot({ index }: InputOTPSlotProps) {
  // Ce composant est utilisé pour la structure, mais le rendu réel est géré par InputOTP
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
  },
  group: {
    flexDirection: "row",
    gap: 8,
  },
  slot: {
    minWidth: 48,
    maxWidth: 56,
    flex: 1,
    height: 56,
    borderRadius: 16,
    borderWidth: 2,
    fontSize: 22,
    fontWeight: "600",
    textAlign: "center",
    textAlignVertical: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 4,
  },
});
