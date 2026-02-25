import React from 'react';
import { TextInput, TextInputProps, View, Text } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/utils/cn';
import { formatIntegerInput, formatDecimalInput } from '@/utils/numeric-input';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  className?: string;
  /** Icône affichée à gauche du champ (ex: calendrier pour un champ date) */
  leftIcon?: React.ReactNode;
  /** Champ entier : uniquement des chiffres (clavier numérique + filtre au collage) */
  numericOnly?: boolean;
  /** Champ décimal : chiffres et un point (clavier décimal + filtre) */
  decimalOnly?: boolean;
}

export function Input({ label, error, className, leftIcon, numericOnly, decimalOnly, onChangeText, ...props }: InputProps) {
  const { isDark } = useTheme();

  const handleChangeText = (text: string) => {
    let value = text;
    if (numericOnly) value = formatIntegerInput(text);
    else if (decimalOnly) value = formatDecimalInput(text);
    onChangeText?.(value);
  };

  const keyboardType = numericOnly ? 'numeric' : decimalOnly ? 'decimal-pad' : props.keyboardType;

  const inputClassName = cn(
    'rounded-lg border',
    error
      ? 'border-red-500'
      : isDark
      ? 'bg-[#1e293b] border-gray-700 text-gray-100'
      : 'bg-gray-100 border-gray-300 text-gray-900',
    leftIcon ? 'pl-2 flex-1' : 'px-4',
    'py-3',
    className
  );

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
      {leftIcon ? (
        <View
          className={cn(
            'flex-row items-center rounded-lg border gap-2',
            error
              ? 'border-red-500'
              : isDark
              ? 'bg-[#1e293b] border-gray-700'
              : 'bg-gray-100 border-gray-300'
          )}
          style={{ minHeight: 48 }}
        >
          <View className="pl-3">
            {leftIcon}
          </View>
          <TextInput
            {...props}
            keyboardType={keyboardType}
            onChangeText={numericOnly || decimalOnly ? handleChangeText : onChangeText}
            className={cn(
              'flex-1 text-sm',
              isDark ? 'text-gray-100' : 'text-gray-900'
            )}
            placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
            style={[
              {
                textAlignVertical: 'center',
                includeFontPadding: false,
                paddingVertical: 0,
                paddingRight: 16,
              },
              props.style,
            ]}
          />
        </View>
      ) : (
        <TextInput
          {...props}
          keyboardType={keyboardType}
          onChangeText={numericOnly || decimalOnly ? handleChangeText : onChangeText}
          className={inputClassName}
          placeholderTextColor={isDark ? '#6b7280' : '#9ca3af'}
          style={[
            {
              textAlignVertical: 'center',
              includeFontPadding: false,
              paddingVertical: 0,
              minHeight: 48,
            },
            props.style,
          ]}
        />
      )}
      {error && (
        <Text className="text-red-500 text-sm mt-1">{error}</Text>
      )}
    </View>
  );
}







