import React from "react";
import { View, StyleSheet, ScrollView } from "react-native";
import { Skeleton } from "@/components/ui/Skeleton";
import { useTheme } from "@/contexts/ThemeContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TAB_BAR_PADDING_BOTTOM } from "@/constants/layout";

const HEADER_CONTENT_HEIGHT = 56;
const CONTENT_PADDING_TOP_EXTRA = 24;

const columnWidths = {
  name: 140,
  category: 90,
  qty: 44,
  purchasePrice: 120,
  currentValue: 120,
  date: 80,
  actions: 88,
};
const totalTableWidth =
  columnWidths.name +
  columnWidths.category +
  columnWidths.qty +
  columnWidths.purchasePrice +
  columnWidths.currentValue +
  columnWidths.date;

export function VaultSkeleton() {
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const contentTopPadding =
    insets.top + HEADER_CONTENT_HEIGHT + CONTENT_PADDING_TOP_EXTRA;

  const borderColor = isDark ? "#334155" : "#e5e7eb";
  const headerBg = isDark ? "#1e293b" : "#f9fafb";
  const rowBg = isDark ? "#0f172a" : "#ffffff";

  return (
    <View style={styles.container}>
      <View
        style={[
          styles.topBlock,
          { paddingTop: contentTopPadding },
        ]}
      >
        <View style={styles.headerBlock}>
          <Skeleton width="95%" height={14} borderRadius={4} />
        </View>
        <View style={styles.statsGrid}>
          {[...Array(4)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.statCard,
                {
                  backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                  borderColor,
                },
              ]}
            >
              <View style={styles.statCardHeader}>
                <Skeleton width={80} height={12} borderRadius={4} />
                <Skeleton width={36} height={36} borderRadius={10} />
              </View>
              <Skeleton width="60%" height={20} borderRadius={4} />
              <View style={{ height: 4, marginTop: 4 }} />
              <Skeleton width="40%" height={11} borderRadius={4} />
            </View>
          ))}
        </View>
        <View style={styles.metalHistoryButton}>
          <Skeleton width="100%" height={44} borderRadius={8} />
        </View>
        <Skeleton
          width={140}
          height={18}
          borderRadius={4}
          style={{ marginBottom: 4 }}
        />
        <Skeleton
          width="85%"
          height={12}
          borderRadius={4}
          style={{ marginBottom: 12 }}
        />
        <View style={styles.searchAndAddRow}>
          <View
            style={[
              styles.searchBar,
              { backgroundColor: isDark ? "#1e293b" : "#f3f4f6" },
            ]}
          >
            <Skeleton width="100%" height={24} borderRadius={9999} />
          </View>
          <Skeleton width={140} height={40} borderRadius={8} />
        </View>
      </View>

      <View style={styles.tableWrapper}>
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
            <View style={[styles.tableHeader, { width: totalTableWidth }]}>
              <View style={[styles.headerCell, { width: columnWidths.name, borderRightColor: borderColor }]}>
                <Skeleton width={50} height={12} borderRadius={4} />
              </View>
              <View style={[styles.headerCell, { width: columnWidths.category, borderRightColor: borderColor }]}>
                <Skeleton width={55} height={12} borderRadius={4} />
              </View>
              <View style={[styles.headerCell, { width: columnWidths.qty, borderRightColor: borderColor }]}>
                <Skeleton width={28} height={12} borderRadius={4} />
              </View>
              <View
                style={[styles.headerCell, { width: columnWidths.purchasePrice, borderRightColor: borderColor }]}
              >
                <Skeleton width={70} height={12} borderRadius={4} />
              </View>
              <View
                style={[styles.headerCell, { width: columnWidths.currentValue, borderRightColor: borderColor }]}
              >
                <Skeleton width={60} height={12} borderRadius={4} />
              </View>
              <View style={[styles.headerCell, { width: columnWidths.date, borderRightColor: borderColor }]}>
                <Skeleton width={35} height={12} borderRadius={4} />
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
                <View style={[styles.tableRow, { width: totalTableWidth }]}>
                  <View style={[styles.cell, { width: columnWidths.name, borderRightColor: borderColor }]}>
                    <Skeleton width="85%" height={14} borderRadius={4} />
                  </View>
                  <View style={[styles.cell, { width: columnWidths.category, borderRightColor: borderColor }]}>
                    <Skeleton width={60} height={14} borderRadius={4} />
                  </View>
                  <View style={[styles.cell, { width: columnWidths.qty, borderRightColor: borderColor }]}>
                    <Skeleton width={20} height={14} borderRadius={4} />
                  </View>
                  <View
                    style={[styles.cell, { width: columnWidths.purchasePrice, borderRightColor: borderColor }]}
                  >
                    <Skeleton width={55} height={14} borderRadius={4} />
                  </View>
                  <View
                    style={[styles.cell, { width: columnWidths.currentValue, borderRightColor: borderColor }]}
                  >
                    <Skeleton width={55} height={14} borderRadius={4} />
                  </View>
                  <View style={[styles.cell, { width: columnWidths.date, borderRightColor: borderColor }]}>
                    <Skeleton width={45} height={14} borderRadius={4} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBlock: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerBlock: {
    paddingTop: 8,
    paddingBottom: 8,
    marginBottom: 8,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  statCard: {
    width: "48%",
    minWidth: "48%",
    flexGrow: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  statCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  metalHistoryButton: {
    marginBottom: 16,
  },
  searchAndAddRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  searchBar: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
  },
  tableWrapper: {
    flex: 1,
    minHeight: 200,
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
