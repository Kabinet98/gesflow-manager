import React, { useEffect } from "react";
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Animated,
  Dimensions,
  TouchableWithoutFeedback,
} from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

interface DrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Drawer({
  open,
  onOpenChange,
  title,
  children,
  footer,
}: DrawerProps) {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const slideAnimRef = React.useRef(new Animated.Value(SCREEN_HEIGHT));
  const backdropOpacityRef = React.useRef(new Animated.Value(0));
  const slideAnim = slideAnimRef.current;
  const backdropOpacity = backdropOpacityRef.current;

  useEffect(() => {
    if (open) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: SCREEN_HEIGHT,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(backdropOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [open, slideAnim, backdropOpacity]);

  if (!open) return null;

  return (
    <Modal
      visible={open}
      transparent
      animationType="none"
      onRequestClose={() => onOpenChange(false)}
    >
      <TouchableWithoutFeedback onPress={() => onOpenChange(false)}>
        <Animated.View
          style={[
            styles.backdrop,
            {
              opacity: backdropOpacity,
            },
          ]}
        />
      </TouchableWithoutFeedback>

      <Animated.View
        style={[
          styles.drawerContainer,
          {
            transform: [{ translateY: slideAnim }],
            backgroundColor: isDark ? "#1e293b" : "#ffffff",
            paddingBottom: insets.bottom,
            maxHeight: SCREEN_HEIGHT * 0.85,
          },
        ]}
      >
        {/* Handle bar */}
        <View className="items-center py-3">
          <View
            className="w-12 h-1 rounded-full"
            style={{ backgroundColor: isDark ? "#374151" : "#e5e7eb" }}
          />
        </View>

        {/* Header */}
        {title && (
          <View className="px-6 pb-4">
            <Text
              className="text-lg font-bold"
              style={{ color: isDark ? "#f1f5f9" : "#0f172a" }}
            >
              {title}
            </Text>
          </View>
        )}

        {/* Content */}
        <ScrollView
          style={{ flex: 1 }}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 16 }}
          nestedScrollEnabled={true}
        >
          {children}
        </ScrollView>

        {/* Footer */}
        {footer && (
          <View
            className="px-6 pt-4 border-t"
            style={{
              borderTopColor: isDark ? "#374151" : "#e5e7eb",
              zIndex: 10,
            }}
            onStartShouldSetResponder={() => true}
          >
            {footer}
          </View>
        )}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  drawerContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: -4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 16,
  },
});


