import React from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function ExpensesSkeleton() {
  const { isDark } = useTheme();

  // Dimensions des colonnes comme dans ExpensesScreen
  const columnWidths = {
    date: 110,
    status: 80,
    description: 200,
    company: 150,
    amount: 140,
    actions: 100,
  };

  return (
    <View style={styles.container}>
      {/* Header avec barre de recherche et boutons */}
      <View style={styles.headerContainer}>
        <View style={styles.searchBar}>
          <Skeleton width="100%" height={40} borderRadius={20} />
        </View>
        <View style={styles.headerActions}>
          <Skeleton width={40} height={40} borderRadius={20} />
          <Skeleton width={40} height={40} borderRadius={20} />
          <Skeleton width={100} height={40} borderRadius={20} />
        </View>
      </View>

      {/* En-têtes de colonnes avec scroll horizontal */}
      <View style={[styles.tableHeaderContainer, { backgroundColor: isDark ? '#1e293b' : '#f9fafb' }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.headerScroll}>
          <View style={styles.tableHeader}>
            <View style={{ width: columnWidths.date }}>
              <Skeleton width={80} height={14} borderRadius={4} />
            </View>
            <View style={{ width: columnWidths.status }}>
              <Skeleton width={60} height={14} borderRadius={4} />
            </View>
            <View style={{ width: columnWidths.description }}>
              <Skeleton width={120} height={14} borderRadius={4} />
            </View>
            <View style={{ width: columnWidths.company }}>
              <Skeleton width={100} height={14} borderRadius={4} />
            </View>
            <View style={{ width: columnWidths.amount }}>
              <Skeleton width={90} height={14} borderRadius={4} />
            </View>
          </View>
        </ScrollView>
        {/* Actions column (sticky) */}
        <View style={[styles.actionsHeader, { width: columnWidths.actions, backgroundColor: isDark ? '#1e293b' : '#f9fafb' }]}>
          <Skeleton width={70} height={14} borderRadius={4} />
        </View>
      </View>

      {/* Lignes de données */}
      <ScrollView style={styles.listContainer} showsVerticalScrollIndicator={false}>
        {[...Array(8)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.tableRowContainer,
              {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderBottomColor: isDark ? '#1e293b' : '#e5e7eb',
              },
            ]}
          >
            {/* Contenu scrollable */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.rowScroll}>
              <View style={styles.tableRow}>
                {/* Date */}
                <View style={[styles.cell, { width: columnWidths.date }]}>
                  <Skeleton width={80} height={14} borderRadius={4} />
                </View>
                {/* Statut */}
                <View style={[styles.cell, { width: columnWidths.status }]}>
                  <Skeleton width={60} height={24} borderRadius={12} />
                </View>
                {/* Description */}
                <View style={[styles.cell, { width: columnWidths.description }]}>
                  <Skeleton width="90%" height={16} borderRadius={4} />
                  <View style={styles.spacing} />
                  <Skeleton width="60%" height={12} borderRadius={4} />
                </View>
                {/* Entreprise */}
                <View style={[styles.cell, { width: columnWidths.company }]}>
                  <Skeleton width="80%" height={14} borderRadius={4} />
                </View>
                {/* Montant */}
                <View style={[styles.cell, { width: columnWidths.amount }]}>
                  <Skeleton width={100} height={16} borderRadius={4} />
                </View>
              </View>
            </ScrollView>
            {/* Actions (sticky à droite) */}
            <View style={[styles.actionsCell, { width: columnWidths.actions, backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
              <View style={styles.actionsContainer}>
                <Skeleton width={32} height={32} borderRadius={16} />
                <Skeleton width={32} height={32} borderRadius={16} />
              </View>
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerContainer: {
    padding: 24,
    paddingTop: 20,
  },
  searchBar: {
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  tableHeaderContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    position: 'relative',
  },
  headerScroll: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
    alignItems: 'center',
  },
  actionsHeader: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#e5e7eb',
  },
  listContainer: {
    flex: 1,
  },
  tableRowContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    position: 'relative',
  },
  rowScroll: {
    flex: 1,
  },
  tableRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 16,
    gap: 8,
    alignItems: 'center',
  },
  cell: {
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 4,
  },
  actionsCell: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#e5e7eb',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  spacing: {
    height: 6,
    marginTop: 4,
  },
});

