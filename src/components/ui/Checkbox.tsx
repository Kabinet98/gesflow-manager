import React from 'react';
import { TouchableOpacity, View, Text } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { HugeiconsIcon } from '@hugeicons/react-native';
import { CheckmarkCircle02Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/utils/cn';

interface CheckboxProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}

export function Checkbox({
  checked,
  onCheckedChange,
  disabled = false,
  className,
  label,
}: CheckboxProps) {
  const { isDark } = useTheme();

  return (
    <TouchableOpacity
      onPress={() => !disabled && onCheckedChange(!checked)}
      disabled={disabled}
      className={cn('flex-row items-center gap-2', disabled && 'opacity-50', className)}
      activeOpacity={0.7}
    >
      <View
        className={cn(
          'h-5 w-5 rounded border-2 items-center justify-center',
          checked
            ? isDark
              ? 'bg-blue-600 border-blue-600'
              : 'bg-blue-600 border-blue-600'
            : isDark
            ? 'border-gray-600 bg-[#1e293b]'
            : 'border-gray-300 bg-white'
        )}
      >
        {checked && (
          <HugeiconsIcon
            icon={CheckmarkCircle02Icon}
            size={16}
            color="white"
          />
        )}
      </View>
      {label && (
        <Text
          className={cn(
            'text-sm',
            disabled
              ? isDark
                ? 'text-gray-600'
                : 'text-gray-400'
              : isDark
              ? 'text-gray-300'
              : 'text-gray-700'
          )}
        >
          {label}
        </Text>
      )}
    </TouchableOpacity>
  );
}
