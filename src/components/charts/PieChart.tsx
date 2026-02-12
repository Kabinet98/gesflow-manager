import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { G, Path, Circle, Text as SvgText } from 'react-native-svg';
import { useTheme } from '@/contexts/ThemeContext';
import { BlurredAmount } from '@/components/BlurredAmount';

interface PieData {
  name: string;
  value: number;
  color: string;
}

interface PieChartProps {
  data: PieData[];
  currency?: string;
  height?: number;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_SIZE = Math.min(SCREEN_WIDTH - 96, 280);
const CENTER = CHART_SIZE / 2;
const RADIUS = CHART_SIZE / 2 - 40;
const INNER_RADIUS = RADIUS * 0.4;

export function PieChartComponent({ data, currency = "GNF", height = 400 }: PieChartProps) {
  const { isDark } = useTheme();

  // S'assurer que data est un tableau valide
  const safeData = Array.isArray(data) ? data : [];

  const total = safeData.reduce((sum, item) => sum + (item.value || 0), 0);

  if (safeData.length === 0 || total <= 0) {
    return (
      <View style={styles.container}>
        <Text style={[styles.emptyText, { color: isDark ? "#9ca3af" : "#6b7280" }]}>
          Aucune donnée disponible
        </Text>
      </View>
    );
  }
  
  // Calculer les angles pour chaque segment
  let currentAngle = -90; // Commencer en haut
  const segments = safeData.map((item, index) => {
    const percentage = (item.value / total) * 100;
    const angle = (item.value / total) * 360;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    // Calculer les coordonnées pour l'arc
    const startRad = (startAngle * Math.PI) / 180;
    const endRad = (endAngle * Math.PI) / 180;
    
    // Arrondir et protéger contre NaN/Infinity pour le PathParser Android
    const r = (n: number) => {
      if (!isFinite(n)) return 0;
      return Math.round(n * 100) / 100;
    };

    // Ignorer les segments sans valeur
    if (!item.value || item.value <= 0) {
      return { ...item, pathData: '', innerPathData: '', percentage: 0, labelX: 0, labelY: 0, angle: 0 };
    }

    const x1 = r(CENTER + RADIUS * Math.cos(startRad));
    const y1 = r(CENTER + RADIUS * Math.sin(startRad));
    const x2 = r(CENTER + RADIUS * Math.cos(endRad));
    const y2 = r(CENTER + RADIUS * Math.sin(endRad));

    const largeArcFlag = angle > 180 ? 1 : 0;

    // Si l'angle est ~360° (un seul segment), réduire légèrement pour éviter un arc dégénéré
    const adjustedX2 = angle >= 359.99 ? r(CENTER + RADIUS * Math.cos(endRad - 0.01)) : x2;
    const adjustedY2 = angle >= 359.99 ? r(CENTER + RADIUS * Math.sin(endRad - 0.01)) : y2;

    const pathData = [
      `M ${CENTER} ${CENTER}`,
      `L ${x1} ${y1}`,
      `A ${RADIUS} ${RADIUS} 0 ${largeArcFlag} 1 ${adjustedX2} ${adjustedY2}`,
      'Z',
    ].join(' ');

    const innerX1 = r(CENTER + INNER_RADIUS * Math.cos(startRad));
    const innerY1 = r(CENTER + INNER_RADIUS * Math.sin(startRad));
    const innerX2 = r(CENTER + INNER_RADIUS * Math.cos(endRad));
    const innerY2 = r(CENTER + INNER_RADIUS * Math.sin(endRad));

    const adjustedInnerX2 = angle >= 359.99 ? r(CENTER + INNER_RADIUS * Math.cos(endRad - 0.01)) : innerX2;
    const adjustedInnerY2 = angle >= 359.99 ? r(CENTER + INNER_RADIUS * Math.sin(endRad - 0.01)) : innerY2;

    const innerPathData = [
      `M ${CENTER} ${CENTER}`,
      `L ${adjustedInnerX2} ${adjustedInnerY2}`,
      `A ${INNER_RADIUS} ${INNER_RADIUS} 0 ${largeArcFlag} 0 ${innerX1} ${innerY1}`,
      'Z',
    ].join(' ');

    // Position du label (milieu de l'arc)
    const labelAngle = (startAngle + endAngle) / 2;
    const labelRad = (labelAngle * Math.PI) / 180;
    const labelRadius = (RADIUS + INNER_RADIUS) / 2;
    const labelX = CENTER + labelRadius * Math.cos(labelRad);
    const labelY = CENTER + labelRadius * Math.sin(labelRad);

    return {
      ...item,
      pathData,
      innerPathData,
      percentage,
      labelX,
      labelY,
      angle,
    };
  });

  return (
    <View style={styles.container}>
      <Svg width={CHART_SIZE} height={CHART_SIZE} viewBox={`0 0 ${CHART_SIZE} ${CHART_SIZE}`}>
        {segments.filter(s => s.pathData).map((segment, index) => (
          <G key={`segment-${index}`}>
            {/* Arc extérieur */}
            <Path
              d={segment.pathData}
              fill={segment.color}
              opacity={0.9}
              stroke={isDark ? "#0f172a" : "#ffffff"}
              strokeWidth="2"
            />
            {/* Arc intérieur pour créer le donut */}
            <Path
              d={segment.innerPathData}
              fill={isDark ? "#0f172a" : "#ffffff"}
              stroke={segment.color}
              strokeWidth="1"
            />
            {segment.percentage > 5 && (
              <SvgText
                x={segment.labelX}
                y={segment.labelY}
                fontSize="11"
                fill={isDark ? "#ffffff" : "#1f2937"}
                textAnchor="middle"
                fontWeight="600"
              >
                {segment.percentage.toFixed(1)}%
              </SvgText>
            )}
          </G>
        ))}
      </Svg>

      {/* Legend avec détails */}
      <View style={styles.legendContainer}>
        {segments
          .sort((a, b) => b.value - a.value)
          .map((segment, index) => (
            <View
              key={`legend-${index}`}
              style={[
                styles.legendItem,
                {
                  backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                  borderColor: isDark ? "#374151" : "#e5e7eb",
                },
              ]}
            >
              <View style={styles.legendLeft}>
                <View
                  style={[styles.legendColor, { backgroundColor: segment.color }]}
                />
                <Text
                  style={[
                    styles.legendName,
                    { color: isDark ? "#f1f5f9" : "#111827" },
                  ]}
                >
                  {segment.name}
                </Text>
              </View>
              <View style={styles.legendRight}>
                <BlurredAmount
                  amount={segment.value}
                  currency={currency}
                  textClassName={`text-sm font-bold ${
                    isDark ? "text-gray-100" : "text-gray-900"
                  }`}
                />
                <Text
                  style={[
                    styles.legendPercentage,
                    { color: isDark ? "#9ca3af" : "#6b7280" },
                  ]}
                >
                  {segment.percentage.toFixed(1)}%
                </Text>
              </View>
            </View>
          ))}
        <View
          style={[
            styles.totalContainer,
            {
              backgroundColor: isDark ? "#1e293b" : "#f9fafb",
              borderColor: isDark ? "#374151" : "#e5e7eb",
            },
          ]}
        >
          <Text
            style={[
              styles.totalLabel,
              { color: isDark ? "#9ca3af" : "#6b7280" },
            ]}
          >
            Total:
          </Text>
          <BlurredAmount
            amount={total}
            currency={currency}
            textClassName={`text-base font-bold ${
              isDark ? "text-gray-100" : "text-gray-900"
            }`}
          />
        </View>
      </View>
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
  legendContainer: {
    width: '100%',
    marginTop: 24,
    gap: 8,
  },
  legendItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  legendLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendName: {
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  legendRight: {
    alignItems: 'flex-end',
    gap: 2,
  },
  legendPercentage: {
    fontSize: 11,
  },
  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
  },
  totalLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
});

