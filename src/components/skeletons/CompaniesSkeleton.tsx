import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/contexts/ThemeContext';

export function CompaniesSkeleton() {
  const { isDark } = useTheme();

  // Dimensions des colonnes comme dans CompaniesScreen
  const columnWidths = {
    name: 180,
    registrationNumber: 150,
    country: 120,
    sector: 150,
    email: 180,
    status: 100,
    expenses: 90,
    investments: 110,
    loans: 90,
    actions: 100,
  };

  const totalTableWidth = Object.values(columnWidths).reduce(
    (sum, width) => sum + width,
    0
  );

  return (
    <View style={styles.container}>
      {/* Header avec barre de recherche et bouton créer */}
      <View style={styles.headerContainer}>
        <View style={styles.searchAndButtonRow}>
          <View style={styles.searchBar}>
            <Skeleton width="100%" height={40} borderRadius={20} />
          </View>
          <Skeleton width={100} height={40} borderRadius={20} />
        </View>
      </View>

      {/* En-têtes de colonnes avec scroll horizontal synchronisé */}
      <View style={[styles.tableHeaderContainer, { backgroundColor: isDark ? '#1e293b' : '#f9fafb', borderBottomColor: isDark ? '#334155' : '#e5e7eb' }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.headerScroll}>
          <View style={[styles.tableHeader, { minWidth: totalTableWidth - columnWidths.actions }]}>
            <View style={[styles.headerCell, { width: columnWidths.name }]}>
              <Skeleton width={40} height={12} borderRadius={4} />
            </View>
            <View style={[styles.headerCell, { width: columnWidths.registrationNumber }]}>
              <Skeleton width={70} height={12} borderRadius={4} />
            </View>
            <View style={[styles.headerCell, { width: columnWidths.country }]}>
              <Skeleton width={40} height={12} borderRadius={4} />
            </View>
            <View style={[styles.headerCell, { width: columnWidths.sector }]}>
              <Skeleton width={50} height={12} borderRadius={4} />
            </View>
            <View style={[styles.headerCell, { width: columnWidths.email }]}>
              <Skeleton width={45} height={12} borderRadius={4} />
            </View>
            <View style={[styles.headerCell, { width: columnWidths.status }]}>
              <Skeleton width={50} height={12} borderRadius={4} />
            </View>
            <View style={[styles.headerCell, { width: columnWidths.expenses }]}>
              <Skeleton width={60} height={12} borderRadius={4} />
            </View>
            <View style={[styles.headerCell, { width: columnWidths.investments }]}>
              <Skeleton width={85} height={12} borderRadius={4} />
            </View>
            <View style={[styles.headerCell, { width: columnWidths.loans }]}>
              <Skeleton width={55} height={12} borderRadius={4} />
            </View>
          </View>
        </ScrollView>
        {/* Colonne Actions (sticky à droite) */}
        <View style={[styles.actionsHeader, { width: columnWidths.actions, backgroundColor: isDark ? '#1e293b' : '#f9fafb', borderLeftColor: isDark ? '#334155' : '#e5e7eb' }]}>
          <Skeleton width={60} height={12} borderRadius={4} />
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
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.rowScroll}
              contentContainerStyle={{
                minWidth: totalTableWidth - columnWidths.actions,
                paddingRight: columnWidths.actions,
              }}
            >
              <View style={[styles.tableRow, { minWidth: totalTableWidth - columnWidths.actions }]}>
                {/* Nom */}
                <View style={[styles.cell, { width: columnWidths.name }]}>
                  <Skeleton width="85%" height={16} borderRadius={4} />
                </View>
                {/* Numéro */}
                <View style={[styles.cell, { width: columnWidths.registrationNumber }]}>
                  <Skeleton width="75%" height={14} borderRadius={4} />
                </View>
                {/* Pays */}
                <View style={[styles.cell, { width: columnWidths.country }]}>
                  <Skeleton width="70%" height={14} borderRadius={4} />
                </View>
                {/* Secteur */}
                <View style={[styles.cell, { width: columnWidths.sector }]}>
                  <Skeleton width="75%" height={14} borderRadius={4} />
                </View>
                {/* Email */}
                <View style={[styles.cell, { width: columnWidths.email }]}>
                  <Skeleton width="80%" height={14} borderRadius={4} />
                </View>
                {/* Statut */}
                <View style={[styles.cell, { width: columnWidths.status }]}>
                  <Skeleton width={55} height={24} borderRadius={12} />
                </View>
                {/* Dépenses */}
                <View style={[styles.cell, { width: columnWidths.expenses }]}>
                  <Skeleton width={25} height={14} borderRadius={4} />
                </View>
                {/* Investissements */}
                <View style={[styles.cell, { width: columnWidths.investments }]}>
                  <Skeleton width={25} height={14} borderRadius={4} />
                </View>
                {/* Emprunts */}
                <View style={[styles.cell, { width: columnWidths.loans }]}>
                  <Skeleton width={25} height={14} borderRadius={4} />
                </View>
              </View>
            </ScrollView>
            {/* Actions (sticky à droite) */}
            <View style={[styles.actionsCell, { 
              position: 'absolute',
              right: 0,
              top: 0,
              bottom: 0,
              width: columnWidths.actions, 
              backgroundColor: isDark ? '#0f172a' : '#ffffff', 
              borderLeftColor: isDark ? '#1e293b' : '#e5e7eb' 
            }]}>
              <View style={styles.actionsContainer}>
                <Skeleton width={28} height={28} borderRadius={14} />
                <Skeleton width={28} height={28} borderRadius={14} />
                <Skeleton width={28} height={28} borderRadius={14} />
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
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 16,
  },
  searchAndButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  searchBar: {
    flex: 1,
  },
  tableHeaderContainer: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    position: 'relative',
  },
  headerScroll: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  headerCell: {
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  actionsHeader: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
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
    alignItems: 'center',
  },
  cell: {
    paddingHorizontal: 12,
    paddingVertical: 16,
    justifyContent: 'center',
    minHeight: 56,
  },
  actionsCell: {
    paddingVertical: 16,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    zIndex: 10,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
