import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, G, Text as SvgText, Line, Defs, LinearGradient, Stop } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { BlurredAmount } from '@/components/BlurredAmount';

interface BarData {
  label: string;
  income?: number;
  outcome?: number;
  value?: number;
  color?: string;
  // Pour les barres empilées (stacked)
  pending?: number;
  approved?: number;
  rejected?: number;
}

interface EnhancedBarChartProps {
  data: BarData[];
  height?: number;
  currency?: string;
  showLegend?: boolean;
  legendLabels?: { income?: string; outcome?: string; pending?: string; approved?: string; rejected?: string };
  stacked?: boolean; // Si true, utilise pending/approved/rejected en barres empilées
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 280;
const BAR_SPACING = 12;
const CHART_PADDING = 50;
const LEGEND_HEIGHT = 40;

export function EnhancedBarChart({ 
  data, 
  height = CHART_HEIGHT,
  currency = "GNF",
  showLegend = true,
  legendLabels = { income: "Entrées", outcome: "Sorties", pending: "En Attente", approved: "Validées", rejected: "Rejetées" },
  stacked = false
}: EnhancedBarChartProps) {
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

  // S'assurer que data est un tableau valide
  const safeData = Array.isArray(data) ? data : [];
  
  if (safeData.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.emptyText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
          Aucune donnée disponible
        </Text>
      </View>
    );
  }

  // Calculer les valeurs max pour l'échelle
  const maxValue = stacked
    ? Math.max(
        ...safeData.map(d => (d.pending || 0) + (d.approved || 0) + (d.rejected || 0)),
        1
      )
    : Math.max(
        ...safeData.map(d => Math.max(d.income || 0, d.outcome || 0, d.value || 0)),
        1
      );

  const hasMultipleSeries = !stacked && safeData.some(d => d.income !== undefined && d.outcome !== undefined);
  const barWidth = hasMultipleSeries 
    ? ((CHART_WIDTH - CHART_PADDING * 2 - (safeData.length - 1) * BAR_SPACING) / safeData.length) / 2 - 2
    : (CHART_WIDTH - CHART_PADDING * 2 - (safeData.length - 1) * BAR_SPACING) / safeData.length;
  const chartHeight = height - CHART_PADDING * 2 - (showLegend ? LEGEND_HEIGHT : 0);

  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(0);
  };

  return (
    <View style={styles.container}>
      <Svg width={CHART_WIDTH} height={height}>
        <Defs>
          <LinearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#10b981" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#10b981" stopOpacity="0.7" />
          </LinearGradient>
          <LinearGradient id="outcomeGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#ef4444" stopOpacity="0.9" />
            <Stop offset="100%" stopColor="#ef4444" stopOpacity="0.7" />
          </LinearGradient>
          {/* Gradients pour les barres empilées */}
          <LinearGradient id="pendingGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="5%" stopColor="#f59e0b" stopOpacity="0.9" />
            <Stop offset="95%" stopColor="#f59e0b" stopOpacity="0.7" />
          </LinearGradient>
          <LinearGradient id="approvedGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="5%" stopColor="#10b981" stopOpacity="0.9" />
            <Stop offset="95%" stopColor="#10b981" stopOpacity="0.7" />
          </LinearGradient>
          <LinearGradient id="rejectedGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="5%" stopColor="#ef4444" stopOpacity="0.9" />
            <Stop offset="95%" stopColor="#ef4444" stopOpacity="0.7" />
          </LinearGradient>
        </Defs>

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
              opacity={0.3}
            />
          );
        })}

        {/* Y-axis labels */}
        {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
          const value = maxValue * ratio;
          const y = CHART_PADDING + chartHeight * (1 - ratio);
          return (
            <SvgText
              key={`y-label-${index}`}
              x={CHART_PADDING - 8}
              y={y + 4}
              fontSize="10"
              fill={isDark ? "#9ca3af" : "#6b7280"}
              textAnchor="end"
            >
              {formatValue(value)}
            </SvgText>
          );
        })}

        {/* Bars */}
        {safeData.map((item, index) => {
          const groupX = CHART_PADDING + index * (hasMultipleSeries ? barWidth * 2 + BAR_SPACING + 4 : barWidth + BAR_SPACING);
          
          const bars = [];
          
          if (stacked) {
            // Barres empilées pour pending/approved/rejected
            let currentY = CHART_PADDING + chartHeight;
            
            // Pending (en bas)
            if (item.pending !== undefined && item.pending > 0) {
              const barHeight = (item.pending / maxValue) * chartHeight;
              currentY -= barHeight;
              bars.push(
                <Rect
                  key={`pending-${index}`}
                  x={groupX}
                  y={currentY}
                  width={barWidth}
                  height={barHeight}
                  fill="url(#pendingGradient)"
                  rx={0}
                />
              );
            }
            
            // Approved (au milieu)
            if (item.approved !== undefined && item.approved > 0) {
              const barHeight = (item.approved / maxValue) * chartHeight;
              currentY -= barHeight;
              bars.push(
                <Rect
                  key={`approved-${index}`}
                  x={groupX}
                  y={currentY}
                  width={barWidth}
                  height={barHeight}
                  fill="url(#approvedGradient)"
                  rx={0}
                />
              );
            }
            
            // Rejected (en haut, avec coins arrondis)
            if (item.rejected !== undefined && item.rejected > 0) {
              const barHeight = (item.rejected / maxValue) * chartHeight;
              currentY -= barHeight;
              bars.push(
                <Rect
                  key={`rejected-${index}`}
                  x={groupX}
                  y={currentY}
                  width={barWidth}
                  height={barHeight}
                  fill="url(#rejectedGradient)"
                  rx={4}
                />
              );
            }
          } else if (hasMultipleSeries) {
            // Barres côte à côte pour income/outcome
            if (item.income !== undefined && item.income > 0) {
              const barHeight = (item.income / maxValue) * chartHeight;
              const y = CHART_PADDING + chartHeight - barHeight;
              bars.push(
                <G key={`income-${index}`}>
                  <Rect
                    x={groupX}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill="url(#incomeGradient)"
                    rx={6}
                  />
                  {item.income > maxValue * 0.05 && (
                    <SvgText
                      x={groupX + barWidth / 2}
                      y={y - 6}
                      fontSize="9"
                      fill={isDark ? "#10b981" : "#059669"}
                      textAnchor="middle"
                      fontWeight="600"
                    >
                      {formatValue(item.income)}
                    </SvgText>
                  )}
                </G>
              );
            }
            
            if (item.outcome !== undefined && item.outcome > 0) {
              const barHeight = (item.outcome / maxValue) * chartHeight;
              const y = CHART_PADDING + chartHeight - barHeight;
              bars.push(
                <G key={`outcome-${index}`}>
                  <Rect
                    x={groupX + barWidth + 4}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill="url(#outcomeGradient)"
                    rx={6}
                  />
                  {item.outcome > maxValue * 0.05 && (
                    <SvgText
                      x={groupX + barWidth + 4 + barWidth / 2}
                      y={y - 6}
                      fontSize="9"
                      fill={isDark ? "#ef4444" : "#dc2626"}
                      textAnchor="middle"
                      fontWeight="600"
                    >
                      {formatValue(item.outcome)}
                    </SvgText>
                  )}
                </G>
              );
            }
          } else {
            // Barre unique
            const value = item.value || 0;
            if (value > 0) {
              const barHeight = (value / maxValue) * chartHeight;
              const y = CHART_PADDING + chartHeight - barHeight;
              const color = item.color || "#0ea5e9";
              bars.push(
                <G key={`bar-${index}`}>
                  <Rect
                    x={groupX}
                    y={y}
                    width={barWidth}
                    height={barHeight}
                    fill={color}
                    rx={6}
                    opacity={0.85}
                  />
                  {value > maxValue * 0.05 && (
                    <SvgText
                      x={groupX + barWidth / 2}
                      y={y - 6}
                      fontSize="9"
                      fill={isDark ? "#9ca3af" : "#6b7280"}
                      textAnchor="middle"
                      fontWeight="600"
                    >
                      {formatValue(value)}
                    </SvgText>
                  )}
                </G>
              );
            }
          }

          return <G key={`group-${index}`}>{bars}</G>;
        })}

        {/* X-axis labels */}
        {safeData.map((item, index) => {
          const groupX = CHART_PADDING + index * (hasMultipleSeries ? barWidth * 2 + BAR_SPACING + 4 : barWidth + BAR_SPACING) + (hasMultipleSeries ? barWidth : barWidth / 2);
          const y = CHART_PADDING + chartHeight + 25;
          
          return (
            <SvgText
              key={`x-label-${index}`}
              x={groupX}
              y={y}
              fontSize="11"
              fill={isDark ? "#9ca3af" : "#6b7280"}
              textAnchor="middle"
              fontWeight="500"
            >
              {item.label.length > 10 ? item.label.substring(0, 10) + "..." : item.label}
            </SvgText>
          );
        })}
      </Svg>

      {/* Legend */}
      {showLegend && (hasMultipleSeries || stacked) && (
        <View style={styles.legend}>
          {stacked ? (
            <>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#f59e0b" }]} />
                <Text style={[styles.legendText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                  {legendLabels.pending || "En Attente"}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#10b981" }]} />
                <Text style={[styles.legendText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                  {legendLabels.approved || "Validées"}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#ef4444" }]} />
                <Text style={[styles.legendText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                  {legendLabels.rejected || "Rejetées"}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#10b981" }]} />
                <Text style={[styles.legendText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                  {legendLabels.income || "Entrées"}
                </Text>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.legendColor, { backgroundColor: "#ef4444" }]} />
                <Text style={[styles.legendText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                  {legendLabels.outcome || "Sorties"}
                </Text>
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: 20,
  },
  emptyText: {
    fontSize: 14,
    textAlign: 'center',
    paddingVertical: 32,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 16,
    gap: 24,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 13,
    fontWeight: '500',
  },
});

