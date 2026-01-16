import React from 'react';
import { TouchableOpacity, Text, ActivityIndicator, ViewStyle } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/utils/cn';

interface ButtonProps {
  children: React.ReactNode;
  onPress: () => void;
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  disabled?: boolean;
  loading?: boolean;
  className?: string;
  style?: ViewStyle;
}

export function Button({
  children,
  onPress,
  variant = 'default',
  size = 'default',
  disabled = false,
  loading = false,
  className,
  style,
}: ButtonProps) {
  const { isDark } = useTheme();

  const baseStyles = 'flex-row items-center justify-center rounded-full';
  
  const variantStyles = {
    default: isDark
      ? 'bg-primary-dynamic'
      : 'bg-primary-dynamic',
    destructive: isDark
      ? 'bg-destructive'
      : 'bg-destructive',
    outline: isDark
      ? 'border border-border bg-transparent'
      : 'border border-border bg-transparent',
    secondary: isDark
      ? 'bg-secondary'
      : 'bg-secondary',
    ghost: isDark
      ? 'bg-transparent'
      : 'bg-transparent',
    link: 'bg-transparent',
  };

  const sizeStyles = {
    default: 'h-10 px-4 py-2',
    sm: 'h-9 px-3',
    lg: 'h-11 px-8',
    icon: 'h-10 w-10',
  };

  const textStyles = {
    default: isDark ? 'text-white' : 'text-white',
    destructive: isDark ? 'text-white' : 'text-white',
    outline: isDark ? 'text-gray-200' : 'text-gray-900',
    secondary: isDark ? 'text-secondary-foreground' : 'text-secondary-foreground',
    ghost: isDark ? 'text-foreground' : 'text-foreground',
    link: isDark ? 'text-primary-dynamic' : 'text-primary-dynamic',
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      className={cn(
        baseStyles,
        variantStyles[variant],
        sizeStyles[size],
        disabled && 'opacity-50',
        className
      )}
      style={style}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'outline' || variant === 'ghost' ? undefined : 'white'}
          size="small"
        />
      ) : (
        typeof children === 'string' ? (
          <Text
            className={cn(
              'text-sm font-medium',
              textStyles[variant]
            )}
          >
            {children}
          </Text>
        ) : (
          children
        )
      )}
    </TouchableOpacity>
  );
}







