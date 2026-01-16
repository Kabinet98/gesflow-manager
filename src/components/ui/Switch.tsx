import React from "react";
import { TouchableOpacity, View, Animated } from "react-native";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/utils/cn";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Switch({
  checked,
  onCheckedChange,
  disabled = false,
  className,
}: SwitchProps) {
  const { isDark } = useTheme();
  const animatedValue = React.useRef(new Animated.Value(checked ? 1 : 0)).current;

  React.useEffect(() => {
    Animated.timing(animatedValue, {
      toValue: checked ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [checked, animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  });

  const backgroundColor = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [isDark ? "#4b5563" : "#d1d5db", "#0ea5e9"],
  });

  return (
    <TouchableOpacity
      onPress={() => !disabled && onCheckedChange(!checked)}
      disabled={disabled}
      className={cn("relative", disabled && "opacity-50", className)}
      activeOpacity={0.7}
    >
      <Animated.View
        className="h-6 w-11 rounded-full"
        style={{ backgroundColor }}
      >
        <Animated.View
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white"
          style={{
            transform: [{ translateX }],
          }}
        />
      </Animated.View>
    </TouchableOpacity>
  );
}
