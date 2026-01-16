import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, G, Text as SvgText, Line } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';

interface BarChartData {
  label: string;
  value: number;
  color?: string;
}

interface SimpleBarChartProps {
  data: BarChartData[];
  height?: number;
  currency?: string;
  showValues?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48; // Padding
const CHART_HEIGHT = 200;
const BAR_SPACING = 8;
const CHART_PADDING = 40;

export function SimpleBarChart({ 
  data, 
  height = CHART_HEIGHT, 
  currency = "GNF",
  showValues = true 
}: SimpleBarChartProps) {
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
  const barWidth = (CHART_WIDTH - CHART_PADDING * 2 - (data.length - 1) * BAR_SPACING) / data.length;
  const chartHeight = height - CHART_PADDING * 2;

  return (
    <View style={styles.container}>
      <Svg width={CHART_WIDTH} height={height}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
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

        {/* Bars */}
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * chartHeight;
          const x = CHART_PADDING + index * (barWidth + BAR_SPACING);
          const y = CHART_PADDING + chartHeight - barHeight;
          const color = item.color || "#0ea5e9";

          return (
            <G key={`bar-${index}`}>
              <Rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill={color}
                rx={4}
                opacity={0.8}
              />
              {showValues && item.value > 0 && (
                <SvgText
                  x={x + barWidth / 2}
                  y={y - 5}
                  fontSize="10"
                  fill={isDark ? "#9ca3af" : "#6b7280"}
                  textAnchor="middle"
                >
                  {item.value >= 1000000
                    ? `${(item.value / 1000000).toFixed(1)}M`
                    : item.value >= 1000
                    ? `${(item.value / 1000).toFixed(1)}K`
                    : item.value.toFixed(0)}
                </SvgText>
              )}
            </G>
          );
        })}

        {/* Labels */}
        {data.map((item, index) => {
          const x = CHART_PADDING + index * (barWidth + BAR_SPACING) + barWidth / 2;
          const y = height - CHART_PADDING + 20;
          
          return (
            <SvgText
              key={`label-${index}`}
              x={x}
              y={y}
              fontSize="10"
              fill={isDark ? "#9ca3af" : "#6b7280"}
              textAnchor="middle"
              transform={`rotate(-45 ${x} ${y})`}
            >
              {item.label.length > 8 ? item.label.substring(0, 8) + "..." : item.label}
            </SvgText>
          );
        })}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        {data.map((item, index) => (
          <View key={`legend-${index}`} style={styles.legendItem}>
            <View
              style={[
                styles.legendColor,
                { backgroundColor: item.color || "#0ea5e9" },
              ]}
            />
            <Text
              style={[
                styles.legendText,
                { color: isDark ? "#9ca3af" : "#6b7280" },
              ]}
            >
              {item.label}
            </Text>
          </View>
        ))}
      </View>
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
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginTop: 16,
    gap: 12,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: 2,
  },
  legendText: {
    fontSize: 12,
  },
});

