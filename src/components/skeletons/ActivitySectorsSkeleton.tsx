import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/contexts/ThemeContext';

const columnWidths = {
  name: 200,
  description: 350,
  status: 120,
  actions: 100,
};

const totalTableWidth = Object.values(columnWidths).reduce(
  (sum, width) => sum + width,
  0
);

export function ActivitySectorsSkeleton() {
  const { isDark } = useTheme();

  return (
    <View style={styles.container}>
      {/* Header de la table */}
      <View
        style={[
          styles.tableHeader,
          {
            backgroundColor: isDark ? '#1e293b' : '#f9fafb',
            borderBottomColor: isDark ? '#334155' : '#e5e7eb',
          },
        ]}
      >
        <View style={styles.headerRow}>
          {/* Nom */}
          <View
            style={[
              styles.headerCell,
              {
                width: columnWidths.name,
                borderRightColor: isDark ? '#334155' : '#e5e7eb',
              },
            ]}
          >
            <Skeleton width={60} height={12} borderRadius={4} />
          </View>

          {/* Description */}
          <View
            style={[
              styles.headerCell,
              {
                width: columnWidths.description,
                borderRightColor: isDark ? '#334155' : '#e5e7eb',
              },
            ]}
          >
            <Skeleton width={80} height={12} borderRadius={4} />
          </View>

          {/* Statut */}
          <View style={[styles.headerCell, { width: columnWidths.status }]}>
            <Skeleton width={50} height={12} borderRadius={4} />
          </View>
        </View>

        {/* Actions (sticky) */}
        <View
          style={[
            styles.actionsHeader,
            {
              width: columnWidths.actions,
              backgroundColor: isDark ? '#1e293b' : '#f9fafb',
              borderLeftColor: isDark ? '#334155' : '#e5e7eb',
            },
          ]}
        >
          <Skeleton width={60} height={12} borderRadius={4} />
        </View>
      </View>

      {/* Lignes de la table */}
      <View style={styles.tableBody}>
        {[...Array(5)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.tableRow,
              {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderBottomColor: isDark ? '#1e293b' : '#f3f4f6',
              },
            ]}
          >
            <View style={styles.rowContent}>
              {/* Nom */}
              <View
                style={[
                  styles.cell,
                  {
                    width: columnWidths.name,
                    borderRightColor: isDark ? '#1e293b' : '#e5e7eb',
                  },
                ]}
              >
                <Skeleton width={140} height={16} borderRadius={4} />
              </View>

              {/* Description */}
              <View
                style={[
                  styles.cell,
                  {
                    width: columnWidths.description,
                    borderRightColor: isDark ? '#1e293b' : '#e5e7eb',
                  },
                ]}
              >
                <Skeleton width={280} height={14} borderRadius={4} />
                <View style={{ height: 4 }} />
                <Skeleton width={200} height={14} borderRadius={4} />
              </View>

              {/* Statut */}
              <View style={[styles.cell, { width: columnWidths.status }]}>
                <Skeleton width={60} height={24} borderRadius={12} />
              </View>
            </View>

            {/* Actions (sticky) */}
            <View
              style={[
                styles.actionsCell,
                {
                  width: columnWidths.actions,
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderLeftColor: isDark ? '#1e293b' : '#e5e7eb',
                },
              ]}
            >
              <Skeleton width={32} height={32} borderRadius={16} />
              <View style={{ width: 4 }} />
              <Skeleton width={32} height={32} borderRadius={16} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  tableHeader: {
    position: 'relative',
    borderBottomWidth: 1,
  },
  headerRow: {
    flexDirection: 'row',
    minWidth: totalTableWidth - columnWidths.actions,
    paddingRight: columnWidths.actions,
  },
  headerCell: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    justifyContent: 'center',
  },
  actionsHeader: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    borderLeftWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  tableBody: {
    flex: 1,
  },
  tableRow: {
    position: 'relative',
    borderBottomWidth: 1,
  },
  rowContent: {
    flexDirection: 'row',
    minWidth: totalTableWidth - columnWidths.actions,
    paddingRight: columnWidths.actions,
  },
  cell: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRightWidth: 1,
    justifyContent: 'center',
  },
  actionsCell: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    borderLeftWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
});
