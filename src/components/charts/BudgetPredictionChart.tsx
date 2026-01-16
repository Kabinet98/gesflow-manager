import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Rect, G, Text as SvgText, Line, Defs, LinearGradient, Stop, Polyline, Circle } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { BlurredAmount } from '@/components/BlurredAmount';

interface BudgetData {
  month: string;
  historique?: number;
  projection?: number;
  isProjection?: boolean;
}

interface BudgetPredictionChartProps {
  balanceHistory: Array<{ month: string; balance: number }>;
  balanceProjection?: Array<{ month: string; balance: number }>;
  currency?: string;
  height?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 450;
const CHART_PADDING = 50;
const BAR_SPACING = 8;

export function BudgetPredictionChart({
  balanceHistory,
  balanceProjection = [],
  currency = "GNF",
  height = CHART_HEIGHT,
}: BudgetPredictionChartProps) {
  const { isDark } = useTheme();

  // S'assurer que balanceHistory est un tableau valide
  const safeBalanceHistory = Array.isArray(balanceHistory) ? balanceHistory : [];
  
  // S'assurer que balanceProjection est un tableau
  const safeBalanceProjection = Array.isArray(balanceProjection) ? balanceProjection : [];

  // Vérifier qu'on a au moins des données
  if (safeBalanceHistory.length === 0 && safeBalanceProjection.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.emptyText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
          Aucune donnée disponible
        </Text>
      </View>
    );
  }

  // Combiner les données - s'assurer que les tableaux sont valides avant de mapper
  const historyData = Array.isArray(safeBalanceHistory) && safeBalanceHistory.length > 0
    ? safeBalanceHistory.map(item => ({
        month: new Date(item.month + "-01").toLocaleDateString("fr-FR", {
          month: "short",
          year: "numeric",
        }),
        historique: item.balance,
        projection: undefined,
        isProjection: false,
      }))
    : [];
    
  const projectionData = Array.isArray(safeBalanceProjection) && safeBalanceProjection.length > 0
    ? safeBalanceProjection.map(item => ({
        month: new Date(item.month + "-01").toLocaleDateString("fr-FR", {
          month: "short",
          year: "numeric",
        }),
        historique: undefined,
        projection: item.balance,
        isProjection: true,
      }))
    : [];

  // Combiner les données
  const safeCombinedData: BudgetData[] = [...historyData, ...projectionData];

  if (!safeCombinedData || safeCombinedData.length === 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.emptyText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
          Aucune donnée disponible
        </Text>
      </View>
    );
  }
  
  const maxValue = safeCombinedData.length > 0
    ? Math.max(
        ...safeCombinedData.map(d => Math.max(d.historique || 0, d.projection || 0)),
        1
      )
    : 1;

  const chartHeight = height - CHART_PADDING * 2 - 60; // 60 pour les labels et légende
  const barWidth = safeCombinedData.length > 0
    ? (CHART_WIDTH - CHART_PADDING * 2 - (safeCombinedData.length - 1) * BAR_SPACING) / safeCombinedData.length
    : 0;

  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toFixed(0);
  };

  // Points pour la ligne de projection
  const projectionPoints = safeCombinedData
    .filter(d => d.isProjection && d.projection !== undefined)
    .map((item, index) => {
      const dataIndex = safeCombinedData.findIndex(d => d.month === item.month);
      const x = CHART_PADDING + dataIndex * (barWidth + BAR_SPACING) + barWidth / 2;
      const y = CHART_PADDING + chartHeight - ((item.projection || 0) / maxValue) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <View style={styles.container}>
      <Svg width={CHART_WIDTH} height={height}>
        <Defs>
          <LinearGradient id="barBalanceGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="5%" stopColor="#0ea5e9" stopOpacity="0.9" />
            <Stop offset="95%" stopColor="#0ea5e9" stopOpacity="0.6" />
          </LinearGradient>
          <LinearGradient id="barProjectionGradient" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="5%" stopColor="#f59e0b" stopOpacity="0.9" />
            <Stop offset="95%" stopColor="#f59e0b" stopOpacity="0.6" />
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
              strokeDasharray="3,3"
              opacity={0.2}
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
        {safeCombinedData.map((item, index) => {
          const x = CHART_PADDING + index * (barWidth + BAR_SPACING);
          const bars = [];

          // Barre historique
          if (item.historique !== undefined) {
            const barHeight = (item.historique / maxValue) * chartHeight;
            const y = CHART_PADDING + chartHeight - barHeight;
            bars.push(
              <Rect
                key={`hist-${index}`}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="url(#barBalanceGradient)"
                rx={4}
              />
            );
          }

          // Barre projection
          if (item.projection !== undefined) {
            const barHeight = (item.projection / maxValue) * chartHeight;
            const y = CHART_PADDING + chartHeight - barHeight;
            bars.push(
              <Rect
                key={`proj-${index}`}
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                fill="url(#barProjectionGradient)"
                rx={4}
                opacity={0.8}
              />
            );
          }

          // Label X-axis
          const labelY = CHART_PADDING + chartHeight + 25;
          return (
            <G key={`group-${index}`}>
              {bars}
              <SvgText
                x={x + barWidth / 2}
                y={labelY}
                fontSize="10"
                fill={isDark ? "#9ca3af" : "#6b7280"}
                textAnchor="middle"
                fontWeight="500"
              >
                {item.month.length > 8 ? item.month.substring(0, 8) + "..." : item.month}
              </SvgText>
            </G>
          );
        })}

        {/* Ligne de projection (pointillée) */}
        {projectionPoints && (
          <Polyline
            points={projectionPoints}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="3"
            strokeDasharray="5,5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Points sur la ligne de projection */}
        {safeCombinedData
          .filter(d => d.isProjection && d.projection !== undefined)
          .map((item, index) => {
            const dataIndex = safeCombinedData.findIndex(d => d.month === item.month);
            const x = CHART_PADDING + dataIndex * (barWidth + BAR_SPACING) + barWidth / 2;
            const y = CHART_PADDING + chartHeight - ((item.projection || 0) / maxValue) * chartHeight;
            return (
              <G key={`dot-${index}`}>
                <Circle
                  cx={x}
                  cy={y}
                  r={6}
                  fill="#f59e0b"
                  stroke={isDark ? "#0f172a" : "#ffffff"}
                  strokeWidth="2"
                />
              </G>
            );
          })}
      </Svg>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: "#0ea5e9" }]} />
          <Text style={[styles.legendText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
            Solde Disponible (Historique)
          </Text>
        </View>
        {safeBalanceProjection.length > 0 && (
          <>
            <View style={styles.legendItem}>
              <View style={[styles.legendColor, { backgroundColor: "#f59e0b" }]} />
              <Text style={[styles.legendText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                Solde Disponible (Projection)
              </Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendLine, { borderColor: "#f59e0b" }]} />
              <Text style={[styles.legendText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
                Tendance (Projection)
              </Text>
            </View>
          </>
        )}
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
    marginTop: 20,
    gap: 16,
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
  legendLine: {
    width: 20,
    height: 2,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  legendText: {
    fontSize: 12,
    fontWeight: '500',
  },
});



