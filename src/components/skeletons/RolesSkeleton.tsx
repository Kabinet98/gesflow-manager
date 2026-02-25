import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTheme } from "@/contexts/ThemeContext";
import { TAB_BAR_PADDING_BOTTOM } from "@/constants/layout";

const columnWidths = {
  name: 200,
  description: 250,
  permissions: 150,
  users: 120,
  actions: 120,
};

const totalTableWidth =
  columnWidths.name +
  columnWidths.description +
  columnWidths.permissions +
  columnWidths.users +
  columnWidths.actions;

export function RolesSkeleton() {
  const { isDark } = useTheme();

  const borderColor = isDark ? "#334155" : "#e5e7eb";
  const headerBg = isDark ? "#1e293b" : "#f9fafb";
  const rowBg = isDark ? "#0f172a" : "#ffffff";

  return (
    <View style={styles.container}>
      {/* Bloc header : titre + recherche + bouton */}
      <View
        style={[
          styles.headerBlock,
          {
            borderBottomColor: isDark ? "#374151" : "#e5e7eb",
          },
        ]}
      >
        <View style={styles.titleRow}>
          <Skeleton width={220} height={28} borderRadius={6} />
        </View>
        <View style={styles.searchRow}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: isDark ? "#1e293b" : "#f3f4f6" },
            ]}
          >
            <Skeleton width="100%" height={24} borderRadius={9999} />
          </View>
          <Skeleton width={88} height={40} borderRadius={9999} />
        </View>
      </View>

      {/* Tableau : en-têtes */}
      <View
        style={[
          styles.tableHeaderContainer,
          { backgroundColor: headerBg, borderBottomColor: borderColor },
        ]}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.headerScroll}
        >
          <View style={[styles.tableHeader, { width: totalTableWidth - columnWidths.actions }]}>
            <View style={[styles.headerCell, { width: columnWidths.name, borderRightColor: borderColor }]}>
              <Skeleton width={40} height={12} borderRadius={4} />
            </View>
            <View style={[styles.headerCell, { width: columnWidths.description, borderRightColor: borderColor }]}>
              <Skeleton width={70} height={12} borderRadius={4} />
            </View>
            <View style={[styles.headerCell, { width: columnWidths.permissions, borderRightColor: borderColor }]}>
              <Skeleton width={75} height={12} borderRadius={4} />
            </View>
            <View style={[styles.headerCell, { width: columnWidths.users, borderRightColor: borderColor }]}>
              <Skeleton width={65} height={12} borderRadius={4} />
            </View>
          </View>
        </ScrollView>
        <View
          style={[
            styles.actionsHeader,
            {
              width: columnWidths.actions,
              backgroundColor: headerBg,
              borderLeftColor: borderColor,
            },
          ]}
        >
          <Skeleton width={50} height={12} borderRadius={4} />
        </View>
      </View>

      {/* Corps du tableau : lignes */}
      <ScrollView
        style={styles.tableBodyScroll}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: TAB_BAR_PADDING_BOTTOM + 20 }}
      >
        {[...Array(8)].map((_, i) => (
          <View
            key={i}
            style={[
              styles.tableRowContainer,
              {
                backgroundColor: rowBg,
                borderBottomColor: borderColor,
              },
            ]}
          >
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              scrollEnabled={false}
              style={styles.rowScroll}
            >
              <View style={[styles.tableRow, { width: totalTableWidth - columnWidths.actions }]}>
                <View style={[styles.cell, { width: columnWidths.name, borderRightColor: borderColor }]}>
                  <Skeleton width="80%" height={14} borderRadius={4} />
                </View>
                <View style={[styles.cell, { width: columnWidths.description, borderRightColor: borderColor }]}>
                  <Skeleton width="70%" height={14} borderRadius={4} />
                </View>
                <View style={[styles.cell, { width: columnWidths.permissions, borderRightColor: borderColor }]}>
                  <Skeleton width={36} height={14} borderRadius={4} />
                </View>
                <View style={[styles.cell, { width: columnWidths.users, borderRightColor: borderColor }]}>
                  <Skeleton width={24} height={14} borderRadius={4} />
                </View>
              </View>
            </ScrollView>
            <View
              style={[
                styles.actionsCell,
                {
                  width: columnWidths.actions,
                  backgroundColor: rowBg,
                  borderLeftColor: borderColor,
                },
              ]}
            >
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
  headerBlock: {
    paddingHorizontal: 24,
    paddingTop: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  titleRow: {
    marginBottom: 16,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  tableHeaderContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    position: "relative",
  },
  headerScroll: {
    flex: 1,
  },
  tableHeader: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  headerCell: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRightWidth: 1,
    justifyContent: "center",
  },
  actionsHeader: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
  },
  tableBodyScroll: {
    flex: 1,
  },
  tableRowContainer: {
    flexDirection: "row",
    borderBottomWidth: 1,
    position: "relative",
  },
  rowScroll: {
    flex: 1,
  },
  tableRow: {
    flexDirection: "row",
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
  },
  cell: {
    justifyContent: "center",
    minHeight: 44,
    paddingHorizontal: 12,
    borderRightWidth: 1,
  },
  actionsCell: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
    borderLeftWidth: 1,
  },
  actionsContainer: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
  },
});
