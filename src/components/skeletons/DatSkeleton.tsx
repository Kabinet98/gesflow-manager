import React from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function DatSkeleton() {
  const { isDark } = useTheme();

  // Dimensions des colonnes comme dans DatScreen
  const columnWidths = {
    bank: 150,
    company: 150,
    amount: 140,
    interest: 140,
    duration: 100,
    rate: 100,
    startDate: 120,
    maturityDate: 120,
    actions: 120,
  };

  const totalTableWidth = Object.values(columnWidths).reduce((sum, width) => sum + width, 0) - columnWidths.actions;

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
          <Skeleton width={120} height={40} borderRadius={20} />
        </View>
      </View>

      {/* En-têtes de colonnes avec scroll horizontal */}
      <View style={[styles.tableHeaderContainer, { backgroundColor: isDark ? '#1e293b' : '#f9fafb' }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.headerScroll}>
          <View style={[styles.tableHeader, { width: totalTableWidth }]}>
            {/* Banque */}
            <View style={[styles.headerCell, { width: columnWidths.bank }]}>
              <Skeleton width={60} height={14} borderRadius={4} />
            </View>
            {/* Entreprise */}
            <View style={[styles.headerCell, { width: columnWidths.company }]}>
              <Skeleton width={80} height={14} borderRadius={4} />
            </View>
            {/* Montant */}
            <View style={[styles.headerCell, { width: columnWidths.amount }]}>
              <Skeleton width={70} height={14} borderRadius={4} />
            </View>
            {/* Intérêts */}
            <View style={[styles.headerCell, { width: columnWidths.interest }]}>
              <Skeleton width={70} height={14} borderRadius={4} />
            </View>
            {/* Durée */}
            <View style={[styles.headerCell, { width: columnWidths.duration }]}>
              <Skeleton width={50} height={14} borderRadius={4} />
            </View>
            {/* Taux */}
            <View style={[styles.headerCell, { width: columnWidths.rate }]}>
              <Skeleton width={40} height={14} borderRadius={4} />
            </View>
            {/* Début */}
            <View style={[styles.headerCell, { width: columnWidths.startDate }]}>
              <Skeleton width={60} height={14} borderRadius={4} />
            </View>
            {/* Échéance */}
            <View style={[styles.headerCell, { width: columnWidths.maturityDate }]}>
              <Skeleton width={70} height={14} borderRadius={4} />
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
              <View style={[styles.tableRow, { width: totalTableWidth }]}>
                {/* Banque */}
                <View style={[styles.cell, { width: columnWidths.bank }]}>
                  <Skeleton width="80%" height={14} borderRadius={4} />
                  <View style={styles.spacing} />
                  <Skeleton width={60} height={20} borderRadius={10} />
                </View>
                {/* Entreprise */}
                <View style={[styles.cell, { width: columnWidths.company }]}>
                  <Skeleton width="85%" height={14} borderRadius={4} />
                </View>
                {/* Montant */}
                <View style={[styles.cell, { width: columnWidths.amount }]}>
                  <Skeleton width={90} height={16} borderRadius={4} />
                </View>
                {/* Intérêts */}
                <View style={[styles.cell, { width: columnWidths.interest }]}>
                  <Skeleton width="70%" height={14} borderRadius={4} />
                  <View style={styles.spacing} />
                  <Skeleton width="50%" height={12} borderRadius={4} />
                </View>
                {/* Durée */}
                <View style={[styles.cell, { width: columnWidths.duration }]}>
                  <Skeleton width={50} height={14} borderRadius={4} />
                </View>
                {/* Taux */}
                <View style={[styles.cell, { width: columnWidths.rate }]}>
                  <Skeleton width={40} height={14} borderRadius={4} />
                </View>
                {/* Début */}
                <View style={[styles.cell, { width: columnWidths.startDate }]}>
                  <Skeleton width={80} height={14} borderRadius={4} />
                </View>
                {/* Échéance */}
                <View style={[styles.cell, { width: columnWidths.maturityDate }]}>
                  <Skeleton width={90} height={14} borderRadius={4} />
                  <View style={styles.spacing} />
                  <Skeleton width={100} height={24} borderRadius={12} />
                </View>
              </View>
            </ScrollView>
            {/* Actions (sticky à droite) */}
            <View style={[styles.actionsCell, { width: columnWidths.actions, backgroundColor: isDark ? '#0f172a' : '#ffffff' }]}>
              <View style={styles.actionsContainer}>
                <Skeleton width={26} height={26} borderRadius={13} />
                <Skeleton width={26} height={26} borderRadius={13} />
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
    padding: 16,
    paddingTop: 20,
  },
  searchBar: {
    marginBottom: 12,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
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
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  headerCell: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    justifyContent: 'center',
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
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  cell: {
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  actionsCell: {
    paddingVertical: 12,
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
    justifyContent: 'center',
  },
  spacing: {
    height: 4,
    marginTop: 4,
  },
});
