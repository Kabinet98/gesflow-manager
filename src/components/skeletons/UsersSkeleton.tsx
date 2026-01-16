import React from 'react';
import { View, StyleSheet, ScrollView, Dimensions } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/contexts/ThemeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export function UsersSkeleton() {
  const { isDark } = useTheme();

  // Dimensions des colonnes comme dans UsersScreen
  const columnWidths = {
    name: 180,
    email: 200,
    role: 150,
    company: 180,
    status: 100,
    actions: 100,
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
        </View>
      </View>

      {/* En-têtes de colonnes avec scroll horizontal */}
      <View style={[styles.tableHeaderContainer, { backgroundColor: isDark ? '#1e293b' : '#f9fafb' }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.headerScroll}>
          <View style={[styles.tableHeader, { width: totalTableWidth }]}>
            {/* Nom */}
            <View style={[styles.headerCell, { width: columnWidths.name }]}>
              <Skeleton width={50} height={14} borderRadius={4} />
            </View>
            {/* Email */}
            <View style={[styles.headerCell, { width: columnWidths.email }]}>
              <Skeleton width={60} height={14} borderRadius={4} />
            </View>
            {/* Rôle */}
            <View style={[styles.headerCell, { width: columnWidths.role }]}>
              <Skeleton width={50} height={14} borderRadius={4} />
            </View>
            {/* Entreprise */}
            <View style={[styles.headerCell, { width: columnWidths.company }]}>
              <Skeleton width={80} height={14} borderRadius={4} />
            </View>
            {/* Statut */}
            <View style={[styles.headerCell, { width: columnWidths.status }]}>
              <Skeleton width={50} height={14} borderRadius={4} />
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
                {/* Nom */}
                <View style={[styles.cell, { width: columnWidths.name }]}>
                  <Skeleton width="85%" height={14} borderRadius={4} />
                </View>
                {/* Email */}
                <View style={[styles.cell, { width: columnWidths.email }]}>
                  <Skeleton width="90%" height={14} borderRadius={4} />
                </View>
                {/* Rôle */}
                <View style={[styles.cell, { width: columnWidths.role }]}>
                  <Skeleton width="70%" height={14} borderRadius={4} />
                </View>
                {/* Entreprise */}
                <View style={[styles.cell, { width: columnWidths.company }]}>
                  <Skeleton width="80%" height={14} borderRadius={4} />
                  <View style={styles.spacing} />
                  <Skeleton width="60%" height={12} borderRadius={4} />
                </View>
                {/* Statut */}
                <View style={[styles.cell, { width: columnWidths.status }]}>
                  <Skeleton width={60} height={24} borderRadius={12} />
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
