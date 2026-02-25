import React, { useState, useCallback, useMemo, useRef, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Pressable,
  RefreshControl,
  Alert,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Modal,
  Dimensions,
  Clipboard,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/config/api";
import { useTheme } from "@/contexts/ThemeContext";
import { useAmountVisibility } from "@/contexts/AmountVisibilityContext";
import { usePermissions } from "@/hooks/usePermissions";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  PlusSignCircleIcon,
  Edit01Icon,
  Delete01Icon,
  LockerIcon,
  Search01Icon,
  ArrowUpRightIcon,
  ArrowDownRightIcon,
  MoneyIcon,
  Coins01Icon,
  Copy01Icon,
  Calendar03Icon,
} from "@hugeicons/core-free-icons";
import { ScreenHeader } from "@/components/ScreenHeader";
import { BlurredAmount } from "@/components/BlurredAmount";
import { Drawer } from "@/components/ui/Drawer";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import {
  VAULT_CATEGORIES,
  VAULT_CATEGORIES_QUANTITY_ONE,
  VAULT_CATEGORIES_NO_DATE,
  VAULT_CATEGORIES_METAL_WEIGHT_REQUIRED,
  VAULT_CATEGORIES_SERIAL_NUMBER,
  VAULT_CATEGORIES_NOTES,
  VAULT_WATCH_TYPES,
  VAULT_WATCH_BRANDS,
  VAULT_CURRENCIES,
  type VaultCategory,
} from "@/constants/vault";
import { REFRESH_CONTROL_COLOR, TAB_BAR_PADDING_BOTTOM } from "@/constants/layout";
import { formatDecimalInput, formatIntegerInput } from "@/utils/numeric-input";
import { SimpleBarChart } from "@/components/charts/SimpleBarChart";
import { VaultSkeleton } from "@/components/skeletons/VaultSkeleton";

export interface VaultItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  purchasePrice: number;
  currency: string;
  purchaseDate: string | null;
  currentValue: number | null;
  currentValueUpdatedAt: string | null;
  notes?: string | null;
  weightGrams?: number | null;
  weightCarats?: number | null;
  brand?: string | null;
  serialNumber?: string | null;
  watchType?: string | null;
  createdAt: string;
  updatedAt: string;
}

interface MarketPricesResponse {
  exchangeRates: {
    base: string;
    date: string;
    rates: Record<string, number>;
  } | null;
  metalPrices: {
    base: string;
    date?: string;
    rates: { XAU?: number; XAG?: number };
    timestamp?: number;
  } | null;
  metalsConfigured: boolean;
}

function formatPurchaseDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

/** MetalpriceAPI: pour afficher USD/oz on utilise 1/rate si rate < 1. */
function metalRateToUsdPerOz(rate: number): number {
  return rate > 0 && rate < 1 ? 1 / rate : rate;
}

function normalizeConfirmationText(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ");
}

/** Agrège l'historique or en ~12 barres pour un graphique lisible sur mobile */
function GoldBarChart({ data }: { data: { date: string; price: number }[] }) {
  const N_BARS = 12;
  if (!data.length) return null;
  const step = Math.max(1, Math.floor(data.length / N_BARS));
  const aggregated: { label: string; value: number; color?: string }[] = [];
  for (let i = 0; i < data.length; i += step) {
    const chunk = data.slice(i, i + step);
    const last = chunk[chunk.length - 1];
    const d = new Date(last.date);
    aggregated.push({
      label: `${d.getDate()}/${d.getMonth() + 1}`,
      value: Math.round(last.price * 100) / 100,
      color: "#d97706",
    });
    if (aggregated.length >= N_BARS) break;
  }
  return (
    <SimpleBarChart
      data={aggregated}
      height={240}
      currency="USD"
      showValues={true}
    />
  );
}


const HEADER_CONTENT_HEIGHT = 56;
const CONTENT_PADDING_TOP_EXTRA = 24;

export function VaultScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const contentTopPadding = insets.top + HEADER_CONTENT_HEIGHT + CONTENT_PADDING_TOP_EXTRA;

  const [metalHistoryOpen, setMetalHistoryOpen] = useState(false);
  const [metalHistory, setMetalHistory] = useState<{ date: string; price: number }[]>([]);
  const [metalHistoryLoading, setMetalHistoryLoading] = useState(false);

  const canCreate = hasPermission("vault.create");
  const canUpdate = hasPermission("vault.update");
  const canDelete = hasPermission("vault.delete");

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<VaultItem | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deleteDrawerOpen, setDeleteDrawerOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<VaultItem | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "Or" as VaultCategory,
    quantity: "1",
    purchasePrice: "",
    currency: "GNF",
    purchaseDate: "",
    notes: "",
    weightGrams: "",
    weightCarats: "",
    brand: "",
    serialNumber: "",
    watchType: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const {
    data: items = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ["vault-items"],
    queryFn: async () => {
      const res = await api.get<VaultItem[]>("/api/vault/items");
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  const { data: marketPrices } = useQuery({
    queryKey: ["market-prices"],
    queryFn: async () => {
      const res = await api.get<MarketPricesResponse>("/api/market-prices");
      return res.data;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!metalHistoryOpen) return;
    setMetalHistoryLoading(true);
    api
      .get<{ gold: { date: string; price: number }[] }>("/api/market-prices/metals-history?days=90")
      .then((res) => {
        const gold = res.data?.gold;
        if (Array.isArray(gold) && gold.length) setMetalHistory(gold);
        else setMetalHistory([]);
      })
      .catch(() => setMetalHistory([]))
      .finally(() => setMetalHistoryLoading(false));
  }, [metalHistoryOpen]);

  const filteredItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(term) ||
        i.category.toLowerCase().includes(term),
    );
  }, [items, searchTerm]);

  const totalPurchase = useMemo(
    () =>
      filteredItems.reduce(
        (s, i) => s + (i.purchasePrice ?? 0) * (i.quantity ?? 1),
        0,
      ),
    [filteredItems],
  );
  const totalCurrent = useMemo(
    () =>
      filteredItems.reduce(
        (s, i) =>
          s +
          (i.currentValue != null
            ? i.currentValue
            : (i.purchasePrice ?? 0) * (i.quantity ?? 1)),
        0,
      ),
    [filteredItems],
  );
  const mainCurrency = filteredItems[0]?.currency ?? "GNF";
  const gainLoss = totalCurrent - totalPurchase;

  const rates = marketPrices?.exchangeRates?.rates;
  const toGNF = useCallback(
    (amount: number, currency: string): number | null => {
      if (!rates?.GNF || !rates[currency] || currency === "GNF") return null;
      return amount * (rates.GNF / rates[currency]);
    },
    [rates],
  );

  const resetForm = useCallback(() => {
    setEditingItem(null);
    setForm({
      name: "",
      category: "Or",
      quantity: "1",
      purchasePrice: "",
      currency: "GNF",
      purchaseDate: "",
      notes: "",
      weightGrams: "",
      weightCarats: "",
      brand: "",
      serialNumber: "",
      watchType: "",
    });
    setFormErrors({});
  }, []);

  const openAdd = useCallback(() => {
    resetForm();
    setDrawerOpen(true);
  }, [resetForm]);

  const openEdit = useCallback((item: VaultItem) => {
    setEditingItem(item);
    setForm({
      name: item.name,
      category: item.category as VaultCategory,
      quantity: String(item.quantity),
      purchasePrice: String(item.purchasePrice),
      currency: item.currency,
      purchaseDate: item.purchaseDate ? item.purchaseDate.slice(0, 10) : "",
      notes: item.notes ?? "",
      weightGrams: item.weightGrams != null ? String(item.weightGrams) : "",
      weightCarats: item.weightCarats != null ? String(item.weightCarats) : "",
      brand: item.brand ?? "",
      serialNumber: item.serialNumber ?? "",
      watchType: item.watchType ?? "",
    });
    setFormErrors({});
    setDrawerOpen(true);
  }, []);

  const openDeleteDrawer = useCallback((item: VaultItem) => {
    setItemToDelete(item);
    setDeleteConfirmation("");
    setDeleteDrawerOpen(true);
  }, []);

  const confirmDelete = useCallback(async () => {
    if (!itemToDelete) return;
    const expected = normalizeConfirmationText(itemToDelete.name);
    if (normalizeConfirmationText(deleteConfirmation) !== expected) {
      Alert.alert("Erreur", "Recopiez exactement le nom pour confirmer.");
      return;
    }
    setIsDeleting(true);
    try {
      await api.delete(`/api/vault/items/${itemToDelete.id}`);
      queryClient.invalidateQueries({ queryKey: ["vault-items"] });
      setDeleteDrawerOpen(false);
      setItemToDelete(null);
      setDeleteConfirmation("");
    } catch (err: any) {
      Alert.alert(
        "Erreur",
        err.response?.data?.error ?? "Erreur lors de la suppression",
      );
    } finally {
      setIsDeleting(false);
    }
  }, [itemToDelete, deleteConfirmation, queryClient]);

  const validateForm = (): boolean => {
    const err: Record<string, string> = {};
    if (!form.name.trim()) err.name = "Le nom est requis";
    const qty = parseInt(form.quantity, 10);
    if (isNaN(qty) || qty < 1)
      err.quantity = "La quantité doit être au moins 1";
    const price = parseFloat(form.purchasePrice.replace(",", "."));
    if (isNaN(price) || price < 0) err.purchasePrice = "Prix d'achat invalide";
    const cat = form.category;
    if (VAULT_CATEGORIES_METAL_WEIGHT_REQUIRED.includes(cat as any)) {
      const w = parseFloat(form.weightGrams.replace(",", "."));
      if (isNaN(w) || w <= 0)
        err.weightGrams = "Le poids (grammes) est requis pour les métaux";
    }
    setFormErrors(err);
    return Object.keys(err).length === 0;
  };

  const submitForm = async () => {
    if (!validateForm()) return;
    setSubmitting(true);
    try {
      const quantity = VAULT_CATEGORIES_QUANTITY_ONE.includes(
        form.category as any,
      )
        ? 1
        : parseInt(form.quantity, 10) || 1;
      const purchasePrice =
        parseFloat(form.purchasePrice.replace(",", ".")) || 0;
      const body = {
        name: form.name.trim(),
        category: form.category,
        quantity,
        purchasePrice,
        currency: form.currency,
        purchaseDate: form.purchaseDate.trim() || null,
        notes: form.notes.trim() || null,
        weightGrams: form.weightGrams
          ? parseFloat(form.weightGrams.replace(",", "."))
          : null,
        weightCarats: form.weightCarats
          ? parseFloat(form.weightCarats.replace(",", "."))
          : null,
        brand: form.brand.trim() || null,
        serialNumber: form.serialNumber.trim() || null,
        watchType: form.watchType.trim() || null,
      };
      if (editingItem) {
        await api.put(`/api/vault/items/${editingItem.id}`, body);
      } else {
        await api.post("/api/vault/items", body);
      }
      setDrawerOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["vault-items"] });
    } catch (e: any) {
      const msg = e.response?.data?.error ?? e.message ?? "Erreur";
      Alert.alert("Erreur", msg);
    } finally {
      setSubmitting(false);
    }
  };

  const isMetal = VAULT_CATEGORIES_METAL_WEIGHT_REQUIRED.includes(
    form.category as any,
  );
  const isWatch = form.category === "Montre";
  const quantityOne = VAULT_CATEGORIES_QUANTITY_ONE.includes(
    form.category as any,
  );
  const noDate = VAULT_CATEGORIES_NO_DATE.includes(form.category as any);

  const deleteMatch =
    itemToDelete &&
    normalizeConfirmationText(deleteConfirmation) ===
      normalizeConfirmationText(itemToDelete.name);

  const listBorderColor = isDark ? "#334155" : "#e2e8f0";
  const listBgColor = isDark ? "#1e293b" : "#fff";

  const columnWidths = {
    name: 140,
    category: 90,
    qty: 44,
    purchasePrice: 120,
    currentValue: 120,
    date: 80,
    actions: 88,
  };
  const totalTableWidth = Object.values(columnWidths).reduce((s, w) => s + w, 0);

  const headerScrollRef = useRef<ScrollView>(null);
  const contentScrollRefs = useRef<Map<string, ScrollView>>(new Map());
  const scrollXRef = useRef(0);
  const isScrollingRef = useRef(false);

  const handleHeaderScroll = useCallback((event: any) => {
    if (isScrollingRef.current) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    scrollXRef.current = offsetX;
    isScrollingRef.current = true;
    contentScrollRefs.current.forEach((sv) => {
      if (sv) sv.scrollTo({ x: offsetX, animated: false });
    });
    setTimeout(() => { isScrollingRef.current = false; }, 100);
  }, []);

  const handleContentScroll = useCallback((itemId: string) => (event: any) => {
    if (isScrollingRef.current) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    scrollXRef.current = offsetX;
    isScrollingRef.current = true;
    if (headerScrollRef.current) headerScrollRef.current.scrollTo({ x: offsetX, animated: false });
    contentScrollRefs.current.forEach((sv, id) => {
      if (id !== itemId && sv) sv.scrollTo({ x: offsetX, animated: false });
    });
    setTimeout(() => { isScrollingRef.current = false; }, 100);
  }, []);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  const renderStatsHeader = () => (
    <View style={styles.headerBlock}>
      <Text style={[styles.subtitle, { color: isDark ? "#94a3b8" : "#64748b" }]}>
        Gérez vos actifs physiques : or, argent, diamants, montres et objets de valeur
      </Text>
      {/* Stats cards — 2x2 grid */}
      <View style={styles.statsGrid}>
        <Card
          className={
            isDark
              ? "bg-amber-900/20 border-amber-500/20"
              : "bg-amber-50 border-amber-200"
          }
          style={styles.statCard}
        >
          <View style={styles.statCardHeader}>
            <Text
              style={[
                styles.statCardTitle,
                { color: isDark ? "#fcd34d" : "#b45309" },
              ]}
            >
              Valeur totale
            </Text>
            <View
              style={[
                styles.statIconWrap,
                {
                  backgroundColor: isDark
                    ? "rgba(245,158,11,0.2)"
                    : "rgba(245,158,11,0.2)",
                },
              ]}
            >
              <HugeiconsIcon
                icon={Coins01Icon}
                size={22}
                color={isDark ? "#fbbf24" : "#d97706"}
              />
            </View>
          </View>
          <BlurredAmount
            amount={totalCurrent}
            currency={mainCurrency}
            className={isDark ? "text-amber-200" : "text-amber-800"}
            textClassName="text-lg font-bold"
          />
          {toGNF(totalCurrent, mainCurrency) != null && (
            <Text
              style={[
                styles.statSub,
                { color: isDark ? "#fcd34d" : "#b45309" },
              ]}
            >
              ≈{" "}
              {Number(toGNF(totalCurrent, mainCurrency)).toLocaleString(
                "fr-FR",
                { maximumFractionDigits: 0 },
              )}{" "}
              GNF
            </Text>
          )}
        </Card>

        <Card
          className={
            isDark
              ? "bg-blue-900/20 border-blue-500/20"
              : "bg-blue-50 border-blue-200"
          }
          style={styles.statCard}
        >
          <View style={styles.statCardHeader}>
            <Text
              style={[
                styles.statCardTitle,
                { color: isDark ? "#93c5fd" : "#1d4ed8" },
              ]}
            >
              Valeur d'achat
            </Text>
            <View
              style={[
                styles.statIconWrap,
                {
                  backgroundColor: isDark
                    ? "rgba(59,130,246,0.2)"
                    : "rgba(59,130,246,0.2)",
                },
              ]}
            >
              <HugeiconsIcon
                icon={MoneyIcon}
                size={22}
                color={isDark ? "#60a5fa" : "#2563eb"}
              />
            </View>
          </View>
          <BlurredAmount
            amount={totalPurchase}
            currency={mainCurrency}
            className={isDark ? "text-blue-200" : "text-blue-800"}
            textClassName="text-lg font-bold"
          />
          {toGNF(totalPurchase, mainCurrency) != null && (
            <Text
              style={[
                styles.statSub,
                { color: isDark ? "#93c5fd" : "#1d4ed8" },
              ]}
            >
              ≈{" "}
              {Number(toGNF(totalPurchase, mainCurrency)).toLocaleString(
                "fr-FR",
                { maximumFractionDigits: 0 },
              )}{" "}
              GNF
            </Text>
          )}
        </Card>

        <Card
          className={
            isDark
              ? "bg-purple-900/20 border-purple-500/20"
              : "bg-purple-50 border-purple-200"
          }
          style={styles.statCard}
        >
          <View style={styles.statCardHeader}>
            <Text
              style={[
                styles.statCardTitle,
                { color: isDark ? "#c4b5fd" : "#6b21a8" },
              ]}
            >
              Nombre d'objets
            </Text>
            <View
              style={[
                styles.statIconWrap,
                {
                  backgroundColor: isDark
                    ? "rgba(139,92,246,0.2)"
                    : "rgba(139,92,246,0.2)",
                },
              ]}
            >
              <HugeiconsIcon
                icon={LockerIcon}
                size={22}
                color={isDark ? "#a78bfa" : "#7c3aed"}
              />
            </View>
          </View>
          <Text
            style={[
              styles.statNumber,
              { color: isDark ? "#c4b5fd" : "#6b21a8" },
            ]}
          >
            {filteredItems.length}
          </Text>
          <Text
            style={[styles.statSub, { color: isDark ? "#a78bfa" : "#7c3aed" }]}
          >
            Biens enregistrés
          </Text>
        </Card>

        <Card
          style={[
            styles.statCard,
            gainLoss >= 0
              ? isDark
                ? {
                    backgroundColor: "rgba(34,197,94,0.15)",
                    borderColor: "rgba(34,197,94,0.3)",
                  }
                : { backgroundColor: "#dcfce7", borderColor: "#bbf7d0" }
              : isDark
                ? {
                    backgroundColor: "rgba(239,68,68,0.15)",
                    borderColor: "rgba(239,68,68,0.3)",
                  }
                : { backgroundColor: "#fee2e2", borderColor: "#fecaca" },
          ]}
        >
          <View style={styles.statCardHeader}>
            <Text
              style={[
                styles.statCardTitle,
                {
                  color:
                    gainLoss >= 0
                      ? isDark
                        ? "#86efac"
                        : "#166534"
                      : isDark
                        ? "#fca5a5"
                        : "#991b1b",
                },
              ]}
            >
              Gain / Perte
            </Text>
            <View
              style={[
                styles.statIconWrap,
                {
                  backgroundColor:
                    gainLoss >= 0
                      ? "rgba(34,197,94,0.2)"
                      : "rgba(239,68,68,0.2)",
                },
              ]}
            >
              <HugeiconsIcon
                icon={gainLoss >= 0 ? ArrowUpRightIcon : ArrowDownRightIcon}
                size={22}
                color={gainLoss >= 0 ? "#22c55e" : "#ef4444"}
              />
            </View>
          </View>
          <BlurredAmount
            amount={gainLoss}
            currency={mainCurrency}
            className={
              gainLoss >= 0
                ? isDark
                  ? "text-green-200"
                  : "text-green-800"
                : isDark
                  ? "text-red-200"
                  : "text-red-800"
            }
            textClassName="text-lg font-bold"
          />
          {toGNF(gainLoss, mainCurrency) != null && (
            <Text
              style={[
                styles.statSub,
                {
                  color:
                    gainLoss >= 0
                      ? isDark
                        ? "#86efac"
                        : "#166534"
                      : isDark
                        ? "#fca5a5"
                        : "#991b1b",
                },
              ]}
            >
              ≈{" "}
              {Number(toGNF(gainLoss, mainCurrency)).toLocaleString("fr-FR", {
                maximumFractionDigits: 0,
              })}{" "}
              GNF
            </Text>
          )}
          <Text
            style={[
              styles.statSub,
              {
                color:
                  gainLoss >= 0
                    ? isDark
                      ? "#86efac"
                      : "#166534"
                    : isDark
                      ? "#fca5a5"
                      : "#991b1b",
              },
            ]}
          >
            {gainLoss >= 0 ? "Plus-value" : "Moins-value"}
          </Text>
        </Card>
      </View>

      {/* Bouton ouvrir modal fluctuation des métaux */}
      <Button
        variant="outline"
        onPress={() => setMetalHistoryOpen(true)}
        style={styles.metalHistoryButton}
      >
        Voir la fluctuation des métaux
      </Button>

      {/* Liste — titre puis recherche + bouton alignés */}
      <Text
        style={[
          styles.sectionTitle,
          { color: isDark ? "#f1f5f9" : "#0f172a", marginBottom: 4 },
        ]}
      >
        Mes objets
      </Text>
      <Text
        style={[
          styles.sectionDesc,
          { color: isDark ? "#94a3b8" : "#64748b", marginBottom: 12 },
        ]}
      >
        Liste de vos biens avec valeur d'achat et valeur actuelle
      </Text>
      <View style={styles.searchAndAddRow}>
        <View
          style={[
            styles.searchBar,
            { flex: 1, marginBottom: 0, backgroundColor: isDark ? "#1e293b" : "#f3f4f6" },
          ]}
        >
          <HugeiconsIcon
            icon={Search01Icon}
            size={18}
            color={isDark ? "#9ca3af" : "#6b7280"}
          />
          <TextInput
            value={searchTerm}
            onChangeText={setSearchTerm}
            placeholder="Rechercher par nom ou catégorie..."
            placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
            style={[
              styles.searchInputInner,
              { color: isDark ? "#f1f5f9" : "#111827" },
            ]}
          />
        </View>
        {canCreate && (
          <Button onPress={openAdd} style={styles.addButton}>
            <HugeiconsIcon
              icon={PlusSignCircleIcon}
              size={20}
              color="#fff"
              style={{ marginRight: 12 }}
            />
            <Text style={styles.addButtonText}>Ajouter un objet</Text>
          </Button>
        )}
      </View>
    </View>
  );

  const rowBorderColor = isDark ? "#1e293b" : "#e5e7eb";
  const renderVaultRow = (item: VaultItem) => (
    <View
      key={item.id}
      className={`border-b ${isDark ? "border-gray-800 bg-[#0f172a]" : "border-gray-100 bg-white"}`}
    >
      <ScrollView
        ref={(ref) => {
          if (ref) {
            contentScrollRefs.current.set(item.id, ref);
            if (scrollXRef.current > 0) {
              requestAnimationFrame(() => ref.scrollTo({ x: scrollXRef.current, animated: false }));
            }
          } else contentScrollRefs.current.delete(item.id);
        }}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={handleContentScroll(item.id)}
        scrollEventThrottle={16}
        contentContainerStyle={{
          minWidth: totalTableWidth - columnWidths.actions,
          paddingRight: columnWidths.actions,
        }}
      >
        <View style={{ flexDirection: "row", minWidth: totalTableWidth - columnWidths.actions }}>
          <View style={{ width: columnWidths.name, borderRightWidth: 1, borderRightColor: rowBorderColor }} className="px-3 py-3">
            <Text className={`text-sm font-medium ${isDark ? "text-gray-200" : "text-gray-900"}`} numberOfLines={1}>{item.name}</Text>
          </View>
          <View style={{ width: columnWidths.category, borderRightWidth: 1, borderRightColor: rowBorderColor }} className="px-3 py-3">
            <Text className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`} numberOfLines={1}>{item.category}</Text>
          </View>
          <View style={{ width: columnWidths.qty, borderRightWidth: 1, borderRightColor: rowBorderColor }} className="px-3 py-3">
            <Text className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`}>{item.quantity}</Text>
          </View>
          <View style={{ width: columnWidths.purchasePrice, borderRightWidth: 1, borderRightColor: rowBorderColor }} className="px-3 py-3">
            <BlurredAmount amount={item.purchasePrice * item.quantity} currency={item.currency} className={isDark ? "text-cyan-200" : "text-cyan-800"} textClassName="text-sm" />
          </View>
          <View style={{ width: columnWidths.currentValue, borderRightWidth: 1, borderRightColor: rowBorderColor }} className="px-3 py-3">
            {item.currentValue != null ? (
              <BlurredAmount amount={item.currentValue} currency={item.currency} className={isDark ? "text-gray-300" : "text-gray-700"} textClassName="text-sm" />
            ) : (
              <Text className={`text-sm ${isDark ? "text-gray-500" : "text-gray-500"}`}>—</Text>
            )}
          </View>
          <View style={{ width: columnWidths.date, borderRightWidth: 1, borderRightColor: rowBorderColor }} className="px-3 py-3">
            <Text className={`text-sm ${isDark ? "text-gray-300" : "text-gray-700"}`} numberOfLines={1}>{formatPurchaseDate(item.purchaseDate)}</Text>
          </View>
        </View>
      </ScrollView>
      {(canUpdate || canDelete) && (
        <View
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            width: columnWidths.actions,
            backgroundColor: isDark ? "#0f172a" : "#ffffff",
            borderLeftWidth: 1,
            borderLeftColor: rowBorderColor,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 4,
            paddingHorizontal: 8,
          }}
        >
          {canUpdate && (
            <TouchableOpacity
              onPress={() => openEdit(item)}
              className="p-2 rounded-full"
              style={{ backgroundColor: isDark ? "rgba(14, 165, 233, 0.1)" : "#e0f2fe" }}
              activeOpacity={0.7}
            >
              <HugeiconsIcon icon={Edit01Icon} size={18} color="#0ea5e9" />
            </TouchableOpacity>
          )}
          {canDelete && (
            <TouchableOpacity
              onPress={() => openDeleteDrawer(item)}
              className="p-2 rounded-full"
              style={{ backgroundColor: isDark ? "rgba(239, 68, 68, 0.1)" : "#fee2e2" }}
              activeOpacity={0.7}
            >
              <HugeiconsIcon icon={Delete01Icon} size={18} color="#ef4444" />
            </TouchableOpacity>
          )}
        </View>
      )}
    </View>
  );

  const tableHeaderBorderColor = isDark ? "#334155" : "#e5e7eb";
  const tableHeaderBg = isDark ? "#1e293b" : "#f9fafb";

  return (
    <SafeAreaView
      style={{
        flex: 1,
        backgroundColor: isDark ? "#0f172a" : "#f8fafc",
      }}
      edges={["top", "bottom"]}
    >
      <ScreenHeader title="Coffre-fort" />
      {isLoading ? (
        <VaultSkeleton />
      ) : (
        <View style={{ flex: 1 }}>
          <View style={[styles.topBlock, { paddingTop: contentTopPadding }]}>
            {renderStatsHeader()}
          </View>
          <View style={styles.tableWrapper}>
            <View
              className={`border-b ${isDark ? "border-gray-700 bg-[#1e293b]" : "border-gray-200 bg-gray-50"}`}
              style={{ position: "relative" }}
            >
              <ScrollView
                ref={headerScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                onScroll={handleHeaderScroll}
                scrollEventThrottle={16}
                contentContainerStyle={{
                  minWidth: totalTableWidth - columnWidths.actions,
                  paddingRight: columnWidths.actions,
                }}
              >
                <View style={{ flexDirection: "row", minWidth: totalTableWidth - columnWidths.actions }}>
                  <View style={{ width: columnWidths.name, borderRightWidth: 1, borderRightColor: tableHeaderBorderColor }} className="px-3 py-3">
                    <Text className={`text-xs font-semibold uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>Objet</Text>
                  </View>
                  <View style={{ width: columnWidths.category, borderRightWidth: 1, borderRightColor: tableHeaderBorderColor }} className="px-3 py-3">
                    <Text className={`text-xs font-semibold uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>Catégorie</Text>
                  </View>
                  <View style={{ width: columnWidths.qty, borderRightWidth: 1, borderRightColor: tableHeaderBorderColor }} className="px-3 py-3">
                    <Text className={`text-xs font-semibold uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>Qté</Text>
                  </View>
                  <View style={{ width: columnWidths.purchasePrice, borderRightWidth: 1, borderRightColor: tableHeaderBorderColor }} className="px-3 py-3">
                    <Text className={`text-xs font-semibold uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>Prix d'achat</Text>
                  </View>
                  <View style={{ width: columnWidths.currentValue, borderRightWidth: 1, borderRightColor: tableHeaderBorderColor }} className="px-3 py-3">
                    <Text className={`text-xs font-semibold uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>Valeur act.</Text>
                  </View>
                  <View style={{ width: columnWidths.date, borderRightWidth: 1, borderRightColor: tableHeaderBorderColor }} className="px-3 py-3">
                    <Text className={`text-xs font-semibold uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>Date</Text>
                  </View>
                </View>
              </ScrollView>
              {(canUpdate || canDelete) && (
                <View
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: columnWidths.actions,
                    backgroundColor: tableHeaderBg,
                    borderLeftWidth: 1,
                    borderLeftColor: tableHeaderBorderColor,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    paddingHorizontal: 8,
                  }}
                >
                  <Text className={`text-xs font-semibold uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>Actions</Text>
                </View>
              )}
            </View>
            <ScrollView
              style={styles.tableBodyScroll}
              contentContainerStyle={{ paddingBottom: TAB_BAR_PADDING_BOTTOM + 20 }}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={REFRESH_CONTROL_COLOR} />
              }
            >
              {filteredItems.length === 0 ? (
                <View style={[styles.emptyInTable, { borderColor: listBorderColor }]}>
                  <HugeiconsIcon icon={LockerIcon} size={48} color={isDark ? "#64748b" : "#94a3b8"} />
                  <Text style={[styles.emptyTitle, { color: isDark ? "#e2e8f0" : "#334155" }]}>Aucun objet dans le coffre-fort</Text>
                  <Text style={[styles.emptyDesc, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                    Ajoutez or, argent, diamants, montres ou autres biens pour suivre leur valeur.
                  </Text>
                  {canCreate && (
                    <Button onPress={openAdd} style={styles.emptyButton}>
                      <Text style={styles.addButtonText}>Ajouter un premier objet</Text>
                    </Button>
                  )}
                </View>
              ) : (
                filteredItems.map(renderVaultRow)
              )}
            </ScrollView>
          </View>
        </View>
      )}

      <Drawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        title={editingItem ? "Modifier l'objet" : "Ajouter un objet"}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            style={{ maxHeight: "100%" }}
            showsVerticalScrollIndicator={false}
          >
            <View className="gap-4 pb-4" style={{ alignSelf: "stretch" }}>
              <View className="gap-2">
                <Text className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Nom <Text className="text-red-500">*</Text>
                </Text>
                <Input
                  value={form.name}
                  onChangeText={(t) => setForm((f) => ({ ...f, name: t }))}
                  placeholder={
                    form.category === "Or"
                      ? "Ex : Lingot 100g"
                      : form.category === "Argent" || form.category === "Platine" || form.category === "Palladium"
                        ? "Ex : Pièces ou lingot"
                        : form.category === "Diamant"
                          ? "Ex : Solitaire 1,5 ct"
                          : form.category === "Montre"
                            ? "Ex : Submariner Date"
                            : form.category === "Billets et devises" || form.category === "Cash"
                              ? "Ex : Espèces EUR"
                              : form.category === "Titres et documents" || form.category === "Document"
                                ? "Ex : Titre de propriété"
                                : form.category === "Œuvres d'art"
                                  ? "Ex : Tableau, sculpture"
                                  : form.category === "Numismatique"
                                    ? "Ex : Pièce rare"
                                    : form.category === "Bijoux"
                                      ? "Ex : Collier, bague"
                                      : "Ex : Désignation"
                  }
                  error={formErrors.name}
                />
              </View>

              <View className="gap-2">
                <Text className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Catégorie <Text className="text-red-500">*</Text>
                </Text>
                <Select
                  value={form.category}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, category: v as VaultCategory }))
                  }
                  items={VAULT_CATEGORIES.map((c) => ({ label: c, value: c }))}
                  placeholder="Choisir"
                />
              </View>

              {isWatch && (
                <>
                  <View className="gap-2">
                    <Text className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                      Marque
                    </Text>
                    <Select
                      value={form.brand || ""}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, brand: v }))
                      }
                      items={[
                        { label: "(Aucune)", value: "" },
                        ...VAULT_WATCH_BRANDS.map((b) => ({
                          label: b,
                          value: b,
                        })),
                      ]}
                    />
                  </View>
                  <View className="gap-2">
                    <Text className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                      Type de montre
                    </Text>
                    <Select
                      value={form.watchType || ""}
                      onValueChange={(v) =>
                        setForm((f) => ({ ...f, watchType: v }))
                      }
                      items={[
                        { label: "(Aucun)", value: "" },
                        ...VAULT_WATCH_TYPES.map((t) => ({
                          label: t,
                          value: t,
                        })),
                      ]}
                    />
                  </View>
                </>
              )}

              {quantityOne ? (
                <View className="gap-2">
                  <Text className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    Devise de la valeur <Text className="text-red-500">*</Text>
                  </Text>
                  <Select
                    value={form.currency}
                    onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                    items={VAULT_CURRENCIES.map((c) => ({ label: `${c.code} - ${c.name}`, value: c.code }))}
                    placeholder="Sélectionner une devise"
                  />
                </View>
              ) : (
                <>
                  <View className="gap-2">
                    <Text className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                      {form.category === "Billets et devises" ? "Nombre d'unités" : "Quantité"} <Text className="text-red-500">*</Text>
                    </Text>
                    <Input
                      value={form.quantity}
                      onChangeText={(t) =>
                        setForm((f) => ({
                          ...f,
                          quantity: formatIntegerInput(t) || "1",
                        }))
                      }
                      placeholder="1"
                      error={formErrors.quantity}
                      numericOnly
                    />
                  </View>
                  <View className="gap-2">
                    <Text className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                      Devise <Text className="text-red-500">*</Text>
                    </Text>
                    <Select
                      value={form.currency}
                      onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
                      items={VAULT_CURRENCIES.map((c) => ({ label: `${c.code} - ${c.name}`, value: c.code }))}
                      placeholder="Sélectionner une devise"
                    />
                  </View>
                </>
              )}

              <View className="gap-2">
                <Text className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  {form.category === "Titres et documents" || form.category === "Document"
                    ? "Valeur estimée"
                    : form.category === "Billets et devises" || form.category === "Cash"
                      ? "Montant"
                      : "Prix d'achat"}{" "}
                  <Text className="text-red-500">*</Text>
                </Text>
                <Input
                  value={form.purchasePrice}
                  onChangeText={(t) =>
                    setForm((f) => ({
                      ...f,
                      purchasePrice: formatDecimalInput(t, {
                        maxDecimals: 2,
                      }),
                    }))
                  }
                  placeholder="0"
                  error={formErrors.purchasePrice}
                  decimalOnly
                />
              </View>

              {!noDate && (
                <View className="gap-2">
                  <Text className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    Date d'achat
                  </Text>
                  <Input
                    placeholder="YYYY-MM-DD"
                    value={form.purchaseDate}
                    onChangeText={(t) =>
                      setForm((f) => ({ ...f, purchaseDate: t }))
                    }
                    leftIcon={
                      <HugeiconsIcon
                        icon={Calendar03Icon}
                        size={18}
                        color={isDark ? "#9ca3af" : "#6b7280"}
                      />
                    }
                  />
                </View>
              )}

              {isMetal && (
                <View className="gap-2">
                  <Text className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    Poids (grammes) <Text className="text-red-500">*</Text>
                  </Text>
                  <Input
                    value={form.weightGrams}
                    onChangeText={(t) =>
                      setForm((f) => ({
                        ...f,
                        weightGrams: formatDecimalInput(t, {
                          maxDecimals: 2,
                        }),
                      }))
                    }
                    placeholder="0"
                    error={formErrors.weightGrams}
                    decimalOnly
                  />
                </View>
              )}

              {form.category === "Diamant" && (
                <View className="gap-2">
                  <Text className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    Poids (carats)
                  </Text>
                  <Input
                    value={form.weightCarats}
                    onChangeText={(t) =>
                      setForm((f) => ({
                        ...f,
                        weightCarats: formatDecimalInput(t, {
                          maxDecimals: 2,
                        }),
                      }))
                    }
                    placeholder="0"
                    decimalOnly
                  />
                </View>
              )}

              {VAULT_CATEGORIES_SERIAL_NUMBER.includes(form.category as any) && (
                <View className="gap-2">
                  <Text className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    Numéro de série
                  </Text>
                  <Input
                    value={form.serialNumber}
                    onChangeText={(t) =>
                      setForm((f) => ({ ...f, serialNumber: t }))
                    }
                    placeholder="Optionnel"
                  />
                </View>
              )}

              {VAULT_CATEGORIES_NOTES.includes(form.category as any) && (
                <View className="gap-2">
                  <Text className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    Notes (optionnel)
                  </Text>
                  <Input
                    value={form.notes}
                    onChangeText={(t) => setForm((f) => ({ ...f, notes: t }))}
                    placeholder={
                      form.category === "Montre"
                        ? "Certificat, fournisseur..."
                        : form.category === "Diamant"
                          ? "Certificat GIA, fournisseur..."
                          : "Fournisseur, référence..."
                    }
                    multiline
                    numberOfLines={2}
                  />
                </View>
              )}

              <View style={styles.formButtonsRow}>
                <Button
                  variant="outline"
                  onPress={() => {
                    setDrawerOpen(false);
                    resetForm();
                  }}
                  style={styles.formButtonCancel}
                >
                  Annuler
                </Button>
                <Button
                  onPress={submitForm}
                  disabled={submitting}
                  style={styles.formButtonSubmit}
                >
                  <Text style={styles.submitButtonText}>
                    {submitting
                      ? "Enregistrement..."
                      : editingItem
                        ? "Modifier"
                        : "Ajouter"}
                  </Text>
                </Button>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Drawer>

      {/* Drawer de confirmation de suppression */}
      <Drawer
        open={deleteDrawerOpen}
        onOpenChange={setDeleteDrawerOpen}
        title="Supprimer l'objet"
      >
        {itemToDelete && (
          <View className="gap-4">
            <Text
              className={`text-base leading-6 ${isDark ? "text-gray-200" : "text-gray-800"}`}
            >
              Êtes-vous sûr de vouloir supprimer l'objet{" "}
              <Text className="font-bold">{itemToDelete.name}</Text> ?
              {"\n\n"}
              Cette action est irréversible.
            </Text>
            <View>
              <View className="flex-row items-center justify-between mb-3">
                <Text
                  className={`text-sm font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
                >
                  Tapez le nom de l'objet pour confirmer :
                </Text>
                <TouchableOpacity
                  onPress={() => {
                    Clipboard.setString(itemToDelete.name);
                    setDeleteConfirmation(itemToDelete.name);
                  }}
                  className={`p-2.5 rounded-lg ${isDark ? "bg-[#1e293b]" : "bg-gray-100"}`}
                  activeOpacity={0.7}
                >
                  <HugeiconsIcon
                    icon={Copy01Icon}
                    size={18}
                    color={isDark ? "#9ca3af" : "#6b7280"}
                  />
                </TouchableOpacity>
              </View>
              <TextInput
                value={deleteConfirmation}
                onChangeText={setDeleteConfirmation}
                placeholder={itemToDelete.name}
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                className={`px-4 py-3 rounded-xl border text-sm ${
                  isDark
                    ? "bg-[#1e293b] border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                style={{
                  textAlignVertical: "center",
                  includeFontPadding: false,
                  paddingVertical: 0,
                  minHeight: 48,
                }}
              />
            </View>
            <View className="flex-row gap-3 mt-4">
              <Button
                variant="outline"
                onPress={() => {
                  setDeleteDrawerOpen(false);
                  setItemToDelete(null);
                  setDeleteConfirmation("");
                }}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onPress={confirmDelete}
                disabled={isDeleting || !deleteMatch}
                className="flex-1"
                style={{ backgroundColor: "#ef4444" }}
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  "Supprimer"
                )}
              </Button>
            </View>
          </View>
        )}
      </Drawer>

      {/* Modal Fluctuation des métaux — clic dehors pour fermer */}
      <Modal
        visible={metalHistoryOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setMetalHistoryOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setMetalHistoryOpen(false)}
          />
          <View
            style={[styles.modalContent, { backgroundColor: isDark ? "#1e293b" : "#fff" }]}
            onStartShouldSetResponder={() => true}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: isDark ? "#f1f5f9" : "#0f172a" }]}>
                Fluctuation des prix des métaux
              </Text>
              <Text style={[styles.modalSubtitle, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                Or : évolution sur 90 jours (freegoldapi.com). Argent : cours actuel (MetalpriceAPI).
              </Text>
            </View>
            <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
              <Text style={[styles.modalChartTitle, { color: isDark ? "#fcd34d" : "#b45309" }]}>
                Or (XAU) — Historique 90 jours (USD/oz)
              </Text>
              {metalHistoryLoading ? (
                <View style={styles.modalChartPlaceholder}>
                  <ActivityIndicator size="large" color="#f59e0b" />
                </View>
              ) : metalHistory.length === 0 ? (
                <View style={styles.modalChartPlaceholder}>
                  <Text style={{ color: isDark ? "#94a3b8" : "#64748b" }}>Données or indisponibles</Text>
                </View>
              ) : (
                <View style={styles.modalChartWrap}>
                  <GoldBarChart data={metalHistory} />
                </View>
              )}
              <View style={[styles.modalSilverBlock, { backgroundColor: isDark ? "rgba(148,163,184,0.15)" : "#f1f5f9", borderColor: listBorderColor }]}>
                <Text style={[styles.modalSilverTitle, { color: isDark ? "#cbd5e1" : "#475569" }]}>
                  Argent (XAG) — Cours actuel (USD/oz)
                </Text>
                {marketPrices?.metalPrices?.rates?.XAG != null ? (
                  <Text style={[styles.modalSilverValue, { color: isDark ? "#e2e8f0" : "#334155" }]}>
                    {Number(metalRateToUsdPerOz(marketPrices.metalPrices.rates.XAG)).toLocaleString("fr-FR", { maximumFractionDigits: 4 })} USD/oz
                  </Text>
                ) : (
                  <Text style={{ color: isDark ? "#94a3b8" : "#64748b", fontSize: 13 }}>Cours non disponible.</Text>
                )}
                <Text style={[styles.modalSilverNote, { color: isDark ? "#94a3b8" : "#64748b" }]}>
                  Historique argent non disponible avec l'API gratuite utilisée.
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  headerBlock: {
    paddingTop: 8,
    paddingBottom: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: Dimensions.get("window").height * 0.85,
  },
  modalHeader: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.08)",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 12,
    marginBottom: 0,
  },
  modalBody: {
    padding: 20,
  },
  modalChartTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 12,
  },
  modalChartPlaceholder: {
    height: 220,
    justifyContent: "center",
    alignItems: "center",
  },
  modalChartWrap: {
    marginBottom: 20,
  },
  modalSilverBlock: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalSilverTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  modalSilverValue: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  modalSilverNote: {
    fontSize: 11,
    marginTop: 4,
  },
  subtitle: {
    fontSize: 13,
    marginBottom: 16,
    paddingHorizontal: 0,
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
  statCardTitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  statIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statNumber: {
    fontSize: 20,
    fontWeight: "700",
  },
  statSub: {
    fontSize: 11,
    marginTop: 2,
  },
  metalHistoryButton: {
    marginBottom: 16,
  },
  topBlock: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  tableWrapper: {
    flex: 1,
    minHeight: 200,
  },
  tableBodyScroll: {
    flex: 1,
  },
  emptyInTable: {
    paddingVertical: 48,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  searchAndAddRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  sectionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
  },
  addButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 9999,
    marginBottom: 12,
  },
  searchInputInner: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
    textAlignVertical: "center",
    includeFontPadding: false,
    minHeight: 24,
  },
  listActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  actionBtn: {
    padding: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: 12,
  },
  emptyDesc: {
    fontSize: 13,
    textAlign: "center",
    marginTop: 8,
    maxWidth: 280,
  },
  emptyButton: {
    marginTop: 16,
  },
  loadingWrap: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  submitButtonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  formButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
  formButtonCancel: {
    flex: 1,
  },
  formButtonSubmit: {
    flex: 1,
  },
});
