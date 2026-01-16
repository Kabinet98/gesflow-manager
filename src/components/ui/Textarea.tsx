import React from 'react';
import { TextInput, TextInputProps, View, Text } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/utils/cn';

interface TextareaProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
  rows?: number;
}

export function Textarea({
  label,
  error,
  className,
  rows = 3,
  ...props
}: TextareaProps) {
  const { isDark } = useTheme();

  return (
    <View className="mb-4">
      {label && (
        <Text
          className={`text-sm font-medium mb-2 ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}
        >
          {label}
        </Text>
      )}
      <TextInput
        {...props}
        multiline
        numberOfLines={rows}
        className={cn(
          'px-4 py-3 rounded-lg border text-base',
          error
            ? 'border-red-500'
            : isDark
            ? 'bg-[#1e293b] border-gray-600 text-gray-100'
            : 'bg-white border-gray-300 text-gray-900',
          className
        )}
        placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
        style={[
          {
            textAlignVertical: 'top',
            includeFontPadding: false,
            minHeight: rows * 20 + 24, // Approximatif pour les lignes
          },
          props.style,
        ]}
      />
      {error && (
        <Text className="text-red-500 text-sm mt-1">{error}</Text>
      )}
    </View>
  );
}
