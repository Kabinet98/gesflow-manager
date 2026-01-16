import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polyline, Circle, G, Line, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';

interface LineChartData {
  label: string;
  value: number;
  color?: string;
}

interface SimpleLineChartProps {
  data: LineChartData[];
  height?: number;
  showDots?: boolean;
  showGrid?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 200;
const CHART_PADDING = 40;

export function SimpleLineChart({ 
  data, 
  height = CHART_HEIGHT,
  showDots = true,
  showGrid = true
}: SimpleLineChartProps) {
  const { isDark } = useTheme();

  if (!data || data.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.emptyText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
          Aucune donnée disponible
        </Text>
      </View>
    );
  }

  const maxValue = Math.max(...data.map(d => d.value), 1);
  const chartHeight = height - CHART_PADDING * 2;
  const stepX = (CHART_WIDTH - CHART_PADDING * 2) / (data.length - 1 || 1);

  // Generate points for the line
  const points = data.map((item, index) => {
    const x = CHART_PADDING + index * stepX;
    const y = CHART_PADDING + chartHeight - (item.value / maxValue) * chartHeight;
    return `${x},${y}`;
  }).join(' ');

  const color = data[0]?.color || "#0ea5e9";

  return (
    <View style={styles.container}>
      <Svg width={CHART_WIDTH} height={height}>
        {/* Grid lines */}
        {showGrid && [0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
          const y = CHART_PADDING + chartHeight * (1 - ratio);
          return (
            <Line
              key={`grid-${index}`}
              x1={CHART_PADDING}
              y1={y}
              x2={CHART_WIDTH - CHART_PADDING}
              y2={y}
              stroke={isDark ? "#374151" : "#e5e7eb"}
              strokeWidth="1"
              strokeDasharray="4,4"
            />
          );
        })}

        {/* Line */}
        <Polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Dots */}
        {showDots && data.map((item, index) => {
          const x = CHART_PADDING + index * stepX;
          const y = CHART_PADDING + chartHeight - (item.value / maxValue) * chartHeight;
          
          return (
            <G key={`dot-${index}`}>
              <Circle
                cx={x}
                cy={y}
                r={6}
                fill={color}
                stroke={isDark ? "#0f172a" : "#ffffff"}
                strokeWidth="2"
              />
            </G>
          );
        })}

        {/* Labels */}
        {data.map((item, index) => {
          const x = CHART_PADDING + index * stepX;
          const y = height - CHART_PADDING + 20;
          
          return (
            <SvgText
              key={`label-${index}`}
              x={x}
              y={y}
              fontSize="10"
              fill={isDark ? "#9ca3af" : "#6b7280"}
              textAnchor="middle"
            >
              {item.label.length > 6 ? item.label.substring(0, 6) : item.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 16,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 32,
  },
});



