import React from 'react';
import { View, ViewProps } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';
import { cn } from '@/utils/cn';

interface CardProps extends ViewProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className, ...props }: CardProps) {
  const { isDark } = useTheme();

  return (
    <View
      {...props}
      className={cn(
        'p-4 rounded-lg',
        isDark ? 'bg-[#1e293b]' : 'bg-gray-50',
        className
      )}
    >
      {children}
    </View>
  );
}







