import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Skeleton } from '@/components/ui/Skeleton';
import { useTheme } from '@/contexts/ThemeContext';

export function LoansSkeleton() {
  const { isDark } = useTheme();

  // Largeurs des colonnes (doivent correspondre à LoansScreen) - Conformes à GesFlow
  const columnWidths = {
    company: 150,
    initialAmount: 140,
    totalAmortized: 140,
    remainingBalance: 140,
    investedAmount: 140,
    availableToInvest: 160,
    interestRate: 100,
    startDate: 120,
    endDate: 120,
    status: 120,
    actions: 120,
  };

  const totalTableWidth = Object.values(columnWidths).reduce(
    (sum, width) => sum + width,
    0
  );

  return (
    <View style={styles.container}>
      {/* En-têtes de colonnes */}
      <View
        style={[
          styles.headerContainer,
          {
            backgroundColor: isDark ? '#1e293b' : '#f9fafb',
            borderBottomColor: isDark ? '#374151' : '#e5e7eb',
          },
        ]}
      >
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', minWidth: totalTableWidth - columnWidths.actions }}>
            <View style={{ width: columnWidths.company, paddingHorizontal: 12, paddingVertical: 12 }}>
              <Skeleton width={70} height={12} borderRadius={4} />
            </View>
            <View style={{ width: columnWidths.initialAmount, paddingHorizontal: 12, paddingVertical: 12 }}>
              <Skeleton width={80} height={12} borderRadius={4} />
            </View>
            <View style={{ width: columnWidths.totalAmortized, paddingHorizontal: 12, paddingVertical: 12 }}>
              <Skeleton width={80} height={12} borderRadius={4} />
            </View>
            <View style={{ width: columnWidths.remainingBalance, paddingHorizontal: 12, paddingVertical: 12 }}>
              <Skeleton width={80} height={12} borderRadius={4} />
            </View>
            <View style={{ width: columnWidths.investedAmount, paddingHorizontal: 12, paddingVertical: 12 }}>
              <Skeleton width={80} height={12} borderRadius={4} />
            </View>
            <View style={{ width: columnWidths.availableToInvest, paddingHorizontal: 12, paddingVertical: 12 }}>
              <Skeleton width={100} height={12} borderRadius={4} />
            </View>
            <View style={{ width: columnWidths.interestRate, paddingHorizontal: 12, paddingVertical: 12 }}>
              <Skeleton width={50} height={12} borderRadius={4} />
            </View>
            <View style={{ width: columnWidths.startDate, paddingHorizontal: 12, paddingVertical: 12 }}>
              <Skeleton width={70} height={12} borderRadius={4} />
            </View>
            <View style={{ width: columnWidths.endDate, paddingHorizontal: 12, paddingVertical: 12 }}>
              <Skeleton width={70} height={12} borderRadius={4} />
            </View>
            <View style={{ width: columnWidths.status, paddingHorizontal: 12, paddingVertical: 12 }}>
              <Skeleton width={60} height={12} borderRadius={4} />
            </View>
          </View>
        </ScrollView>
        {/* Actions column (sticky) */}
        <View
          style={[
            styles.actionsHeader,
            {
              width: columnWidths.actions,
              backgroundColor: isDark ? '#1e293b' : '#f9fafb',
              borderLeftColor: isDark ? '#475569' : '#e5e7eb',
            },
          ]}
        >
          <Skeleton width={60} height={12} borderRadius={4} />
        </View>
      </View>

      {/* Lignes de données */}
      <View style={styles.listContainer}>
        {[...Array(8)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.listItem,
              {
                backgroundColor: isDark ? '#0f172a' : '#ffffff',
                borderBottomColor: isDark ? '#1e293b' : '#f3f4f6',
              },
            ]}
          >
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', minWidth: totalTableWidth - columnWidths.actions }}>
                {/* Entreprise */}
                <View style={{ width: columnWidths.company, paddingHorizontal: 12, paddingVertical: 16 }}>
                  <Skeleton width="80%" height={14} borderRadius={4} />
                </View>
                {/* Montant initial */}
                <View style={{ width: columnWidths.initialAmount, paddingHorizontal: 12, paddingVertical: 16 }}>
                  <Skeleton width={90} height={16} borderRadius={4} />
                </View>
                {/* Total amorti */}
                <View style={{ width: columnWidths.totalAmortized, paddingHorizontal: 12, paddingVertical: 16 }}>
                  <Skeleton width={90} height={16} borderRadius={4} />
                </View>
                {/* Solde restant */}
                <View style={{ width: columnWidths.remainingBalance, paddingHorizontal: 12, paddingVertical: 16 }}>
                  <Skeleton width={90} height={16} borderRadius={4} />
                </View>
                {/* Emprunt investi */}
                <View style={{ width: columnWidths.investedAmount, paddingHorizontal: 12, paddingVertical: 16 }}>
                  <Skeleton width={90} height={16} borderRadius={4} />
                </View>
                {/* Emprunt disponible à investir */}
                <View style={{ width: columnWidths.availableToInvest, paddingHorizontal: 12, paddingVertical: 16 }}>
                  <Skeleton width={100} height={16} borderRadius={4} />
                </View>
                {/* Taux d'intérêt */}
                <View style={{ width: columnWidths.interestRate, paddingHorizontal: 12, paddingVertical: 16 }}>
                  <Skeleton width={50} height={14} borderRadius={4} />
                </View>
                {/* Date de début */}
                <View style={{ width: columnWidths.startDate, paddingHorizontal: 12, paddingVertical: 16 }}>
                  <Skeleton width={70} height={14} borderRadius={4} />
                </View>
                {/* Date de fin */}
                <View style={{ width: columnWidths.endDate, paddingHorizontal: 12, paddingVertical: 16 }}>
                  <Skeleton width={70} height={14} borderRadius={4} />
                </View>
                {/* Statut */}
                <View style={{ width: columnWidths.status, paddingHorizontal: 12, paddingVertical: 16 }}>
                  <Skeleton width={60} height={24} borderRadius={12} />
                </View>
              </View>
            </ScrollView>
            {/* Actions (sticky) */}
            <View
              style={[
                styles.actionsColumn,
                {
                  width: columnWidths.actions,
                  backgroundColor: isDark ? '#0f172a' : '#ffffff',
                  borderLeftColor: isDark ? '#1e293b' : '#e5e7eb',
                },
              ]}
            >
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Skeleton width={32} height={32} borderRadius={8} />
                <Skeleton width={32} height={32} borderRadius={8} />
              </View>
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
  headerContainer: {
    position: 'relative',
    borderBottomWidth: 1,
  },
  actionsHeader: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    borderLeftWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  listContainer: {
    flex: 1,
  },
  listItem: {
    position: 'relative',
    borderBottomWidth: 1,
  },
  actionsColumn: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    borderLeftWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
});




