import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { HugeiconsIcon } from "@hugeicons/react-native";
import { ArrowDown01Icon, ArrowUp01Icon, Cancel01Icon } from "@hugeicons/core-free-icons";

interface SelectOption {
  label: string;
  value: string;
}

interface SelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  options?: SelectOption[];
  items?: SelectOption[]; // Alias pour options (compatibilité)
  placeholder?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

export const Select = function Select({
  value,
  onValueChange,
  options,
  items,
  placeholder = "Sélectionner...",
  label,
  required = false,
  disabled = false,
}: SelectProps) {
  const { isDark } = useTheme();
  const [isOpen, setIsOpen] = useState(false);

  // Utiliser items si fourni, sinon options, sinon tableau vide
  const selectOptions = items || options || [];

  // Filtrer les options invalides
  const validOptions = selectOptions.filter(
    (opt) => opt && opt.value && opt.label
  );

  const selectedOption = validOptions.find((opt) => opt.value === value);

  return (
    <View>
      {label && (
        <Text
          className={`text-sm font-medium mb-2 ${
            isDark ? "text-gray-300" : "text-gray-700"
          }`}
        >
          {label} {required && <Text className="text-red-500">*</Text>}
        </Text>
      )}
      <TouchableOpacity
        onPress={() => !disabled && setIsOpen(true)}
        disabled={disabled}
        className={`px-4 py-3 rounded-lg border flex-row items-center justify-between ${
          isDark
            ? "bg-[#1e293b] border-gray-700"
            : "bg-gray-100 border-gray-300"
        } ${disabled ? "opacity-50" : ""}`}
        activeOpacity={0.7}
        style={{
          minHeight: 48,
        }}
      >
        <Text
          className={`text-sm flex-1 ${
            selectedOption
              ? isDark
                ? "text-gray-100"
                : "text-gray-900"
              : isDark
                ? "text-gray-500"
                : "text-gray-500"
          }`}
          numberOfLines={1}
          style={{
            textAlignVertical: "center",
            includeFontPadding: false,
            flexShrink: 1,
            marginRight: 8,
          }}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </Text>
        <HugeiconsIcon
          icon={isOpen ? ArrowUp01Icon : ArrowDown01Icon}
          size={18}
          color={isDark ? "#9ca3af" : "#6b7280"}
          style={{ flexShrink: 0 }}
        />
      </TouchableOpacity>

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={() => setIsOpen(false)}
          />
          <View
            className={`rounded-xl ${
              isDark ? "bg-[#1e293b]" : "bg-white"
            }`}
            style={styles.modalContent}
            onStartShouldSetResponder={() => true}
          >
            <View
              className={`px-6 py-4 border-b flex-row items-center justify-between ${
                isDark ? "border-gray-700" : "border-gray-200"
              }`}
            >
              <Text
                className={`text-lg font-bold ${
                  isDark ? "text-gray-100" : "text-gray-900"
                }`}
              >
                {label || "Sélectionner"}
              </Text>
              <TouchableOpacity
                onPress={() => setIsOpen(false)}
                className="p-2"
                activeOpacity={0.7}
              >
                <HugeiconsIcon
                  icon={Cancel01Icon}
                  size={20}
                  color={isDark ? "#9ca3af" : "#6b7280"}
                />
              </TouchableOpacity>
            </View>
            <ScrollView
              style={styles.scrollView}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {validOptions.length === 0 ? (
                <View className="px-6 py-8 items-center">
                  <Text
                    className={`text-sm ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Aucune option disponible
                  </Text>
                </View>
              ) : (
                validOptions.map((option, index) => (
                <TouchableOpacity
                  key={option.value || index}
                  onPress={() => {
                    onValueChange(option.value);
                    setIsOpen(false);
                  }}
                  className={`px-6 py-4 border-b ${
                    value === option.value
                      ? isDark
                        ? "bg-blue-600/20"
                        : "bg-blue-50"
                      : ""
                  }`}
                  style={[
                    styles.optionItem,
                    {
                      borderBottomColor: isDark ? "#374151" : "#e5e7eb",
                    },
                  ]}
                  activeOpacity={0.7}
                >
                  <View className="flex-row items-center justify-between">
                    <Text
                      className={`text-sm ${
                        value === option.value
                          ? isDark
                            ? "text-blue-400 font-semibold"
                            : "text-blue-600 font-semibold"
                          : isDark
                            ? "text-gray-100"
                            : "text-gray-900"
                      }`}
                    >
                      {option.label}
                    </Text>
                    {value === option.value && (
                      <View
                        className="w-2 h-2 rounded-full"
                        style={{
                          backgroundColor: isDark ? "#60a5fa" : "#3b82f6",
                        }}
                      />
                    )}
                  </View>
                </TouchableOpacity>
                ))
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  modalContent: {
    width: "100%",
    maxWidth: 400,
    maxHeight: "80%",
    minHeight: 200,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomColor: "#e5e7eb",
  },
  scrollView: {
    maxHeight: 400,
    minHeight: 150,
  },
  optionItem: {
    borderBottomWidth: 1,
  },
});

