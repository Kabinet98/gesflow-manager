import React, {
  useState,
  useMemo,
  useRef,
  useCallback,
  useEffect,
} from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  Dimensions,
  Alert,
  ActivityIndicator,
  Animated,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@/config/api";
import { useTheme } from "@/contexts/ThemeContext";
import { useAmountVisibility } from "@/contexts/AmountVisibilityContext";
import { usePermissions } from "@/hooks/usePermissions";
import { authService } from "@/services/auth.service";
import { HugeiconsIcon } from "@hugeicons/react-native";
import {
  Search01Icon,
  FilterIcon,
  PlusSignCircleIcon,
  Edit01Icon,
  Delete01Icon,
  Download01Icon,
  Calendar03Icon,
  AlertDiamondIcon,
  MoneyExchange03Icon,
  EyeIcon,
  CalculatorIcon,
  Copy01Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  Coins01Icon,
  MoneyRemove02Icon,
} from "@hugeicons/core-free-icons";
import { DatSkeleton } from "@/components/skeletons/DatSkeleton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { BlurredAmount } from "@/components/BlurredAmount";
import { TAB_BAR_PADDING_BOTTOM, REFRESH_CONTROL_COLOR } from "@/constants/layout";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CHART_COLOR = "#0ea5e9";

// Helper pour obtenir le répertoire de documents
let FileSystemLegacy: any = null;
try {
  FileSystemLegacy = require("expo-file-system/legacy");
} catch (e) {
  // L'API legacy n'est pas disponible
}

const getDocumentDirectory = (): string | null => {
  try {
    if (FileSystemLegacy) {
      const docDir = FileSystemLegacy.documentDirectory;
      if (docDir && typeof docDir === "string") return docDir;
      const cacheDir = FileSystemLegacy.cacheDirectory;
      if (cacheDir && typeof cacheDir === "string") return cacheDir;
    }
    const paths = (FileSystem as any).Paths;
    if (paths) {
      const docDir = paths.documentDirectory || paths.documentDir || paths.docDir;
      const cacheDir = paths.cacheDirectory || paths.cacheDir;
      if (docDir) return docDir;
      if (cacheDir) return cacheDir;
    }
    let FileSystemModule: any = FileSystem;
    let depth = 0;
    const maxDepth = 5;
    while (
      depth < maxDepth &&
      FileSystemModule &&
      !FileSystemModule.documentDirectory &&
      !FileSystemModule.cacheDirectory
    ) {
      if (FileSystemModule.default) {
        FileSystemModule = FileSystemModule.default;
        depth++;
      } else {
        break;
      }
    }
    const docDir = FileSystemModule?.documentDirectory;
    const cacheDir = FileSystemModule?.cacheDirectory;
    if (docDir || cacheDir) return docDir || cacheDir;
    return null;
  } catch (error: any) {
    return null;
  }
};

interface DatInterestPayment {
  id: string;
  amount: number;
  currency: string;
  paymentDate: string;
  periodStart: string;
  periodEnd: string;
}

interface DatAccountTransfer {
  id: string;
  amount: number;
  currency: string;
  transferDate: string;
  description: string | null;
  createdBy: {
    id: string;
    name: string | null;
    email: string;
  };
}

interface DatAccount {
  id: string;
  totalInterest: number;
  totalTransferred: number;
  currency: string;
  interestPayments: DatInterestPayment[];
  transfers?: DatAccountTransfer[];
}

interface DatTransaction {
  id: string;
  bankName: string;
  amount: number;
  currency: string;
  durationMonths: number;
  interestRate: number;
  interestPaymentFrequency: "MONTHLY" | "QUARTERLY" | "AT_MATURITY";
  startDate: string;
  maturityDate: string;
  accountNumber: string | null;
  maturityInstructions: "RENEW" | "STOP";
  description: string | null;
  isActive: boolean;
  status?: string;
  createdAt: string;
  company: {
    id: string;
    name: string;
  };
  country?: {
    id: string;
    name: string;
  };
  datAccount?: DatAccount | null;
  bankId?: string | null;
  bank?: {
    id: string;
    name: string;
  } | null;
}

interface Company {
  id: string;
  name: string;
  currency?: string;
  country: {
    id: string;
    name: string;
  };
}

interface Bank {
  id: string;
  name: string;
  code: string | null;
  isActive: boolean;
  countryId?: string | null;
  country?: {
    id: string;
    name: string;
  } | null;
}

// Fonction pour vérifier si une transaction DAT peut être annulée (moins de 24h)
const canCancelTransaction = (createdAt: string | undefined | null): boolean => {
  if (!createdAt) return false;
  try {
    const now = new Date();
    const created = new Date(createdAt);
    if (isNaN(created.getTime())) return false;
    const diffInMs = now.getTime() - created.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    return diffInHours < 24;
  } catch (error) {
    return false;
  }
};

// Fonction pour normaliser le texte de confirmation
const normalizeConfirmationText = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/\u00A0/g, " ")
    .replace(/\s+/g, " ");
};

// Fonction pour formater une date
const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
};

// Composant pour une ligne de table DAT
const DatTableRow = React.memo(({
  transaction,
  columnWidths,
  totalTableWidth,
  isDark,
  nearMaturity,
  isMatured,
  canCancel,
  canView,
  canUpdate,
  canDelete,
  canCreate,
  onViewDetails,
  onEdit,
  onDelete,
  onTransfer,
  onRenew,
  onStop,
  onScroll,
  scrollRef,
}: {
  transaction: DatTransaction;
  columnWidths: any;
  totalTableWidth: number;
  isDark: boolean;
  nearMaturity: boolean;
  isMatured: boolean;
  canCancel: boolean;
  canView: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canCreate: boolean;
  onViewDetails: (dat: DatTransaction) => void;
  onEdit: (dat: DatTransaction) => void;
  onDelete: (dat: DatTransaction) => void;
  onTransfer: () => void;
  onRenew: (dat: DatTransaction) => void;
  onStop: (dat: DatTransaction) => void;
  onScroll: (e: any) => void;
  scrollRef: (ref: ScrollView | null) => void;
}) => {
  const scrollViewRef = useRef<ScrollView>(null);
  
  useEffect(() => {
    scrollRef(scrollViewRef.current);
    return () => {
      scrollRef(null);
    };
  }, [scrollRef]);

  // Vérifier si le DAT a produit des gains (intérêt disponible)
  const availableInterest = transaction.datAccount 
    ? (transaction.datAccount.totalInterest || 0) - (transaction.datAccount.totalTransferred || 0)
    : 0;
  const hasGains = availableInterest > 0;

  // Animation pulse pour les DAT avec gains
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (hasGains) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => {
        pulse.stop();
        pulseAnim.setValue(1);
      };
    } else {
      pulseAnim.setValue(1);
    }
  }, [hasGains, pulseAnim]);

  // Style animé - toujours utiliser pulseAnim pour éviter les warnings Reanimated
  const animatedStyle = { opacity: pulseAnim };

  return (
    <Animated.View
      className={`border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}
      style={[
        {
          position: "relative",
          backgroundColor: hasGains
            ? isDark
              ? "#1e3a8a20" // Bleu foncé avec transparence
              : "#dbeafe40" // Bleu clair avec transparence
            : isDark
              ? "#0f172a"
              : "#ffffff",
        },
        animatedStyle,
      ]}
    >
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
      >
        <View style={{ width: totalTableWidth, flexDirection: "row" }}>
          {/* Ligne de séparation verticale pour chaque colonne */}
          {/* Banque */}
          <View
            style={{
              width: columnWidths.bank,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <View className="gap-1">
              <Text
                className={`text-sm ${isDark ? "text-gray-200" : "text-gray-900"}`}
                numberOfLines={2}
              >
                {transaction.bankName}
              </Text>
              {transaction.status === "RENEWED" && (
                <View
                  className={`px-2 py-0.5 rounded-full self-start ${
                    isDark
                      ? "bg-green-900/30 border border-green-700"
                      : "bg-green-100 border border-green-300"
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      isDark ? "text-green-300" : "text-green-800"
                    }`}
                  >
                    Renouvelé
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* Entreprise */}
          <View
            style={{
              width: columnWidths.company,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <Text
              className={`text-sm ${isDark ? "text-gray-200" : "text-gray-900"}`}
              numberOfLines={2}
            >
              {transaction.company.name}
            </Text>
          </View>

          {/* Montant */}
          <View
            style={{
              width: columnWidths.amount,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <BlurredAmount
              amount={transaction.amount}
              currency={transaction.currency}
              className={`text-sm font-medium ${isDark ? "text-gray-200" : "text-gray-900"}`}
            />
          </View>

          {/* Intérêts générés */}
          <View
            style={{
              width: columnWidths.interest,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <View className="gap-1">
              {transaction.datAccount && (() => {
                const availableInterest = (transaction.datAccount.totalInterest || 0) - (transaction.datAccount.totalTransferred || 0);
                return availableInterest > 0;
              })() && (
                  <Text
                    className={`text-xs ${
                      isDark ? "text-green-400" : "text-green-600"
                    } font-medium`}
                  >
                    ✓ Gains disponibles
                  </Text>
                )}
              <View className="gap-0.5">
                <BlurredAmount
                  amount={transaction.datAccount?.totalInterest || 0}
                  currency={transaction.currency}
                  className={`text-sm ${
                    transaction.datAccount && transaction.datAccount.totalInterest > 0
                      ? isDark
                        ? "text-green-400 font-semibold"
                        : "text-green-600 font-semibold"
                      : isDark
                        ? "text-gray-200"
                        : "text-gray-900"
                  }`}
                />
                {transaction.datAccount && (transaction.datAccount.totalTransferred || 0) > 0 && (
                  <Text className={`text-xs ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    Transféré: {(transaction.datAccount.totalTransferred || 0).toLocaleString("fr-FR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} {transaction.currency}
                  </Text>
                )}
              </View>
              {transaction.datAccount && (() => {
                const availableInterest = (transaction.datAccount.totalInterest || 0) - (transaction.datAccount.totalTransferred || 0);
                return availableInterest > 0;
              })() &&
                canUpdate && (
                  <TouchableOpacity
                    onPress={onTransfer}
                    className={`mt-1 px-2 py-1 rounded-lg ${
                      isDark
                        ? "bg-green-900/20 border border-green-800"
                        : "bg-green-50 border border-green-200"
                    }`}
                  >
                    <Text
                      className={`text-xs text-center ${
                        isDark ? "text-green-400" : "text-green-700"
                      }`}
                    >
                      Transférer
                    </Text>
                  </TouchableOpacity>
                )}
            </View>
          </View>

          {/* Durée */}
          <View
            style={{
              width: columnWidths.duration,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <Text
              className={`text-sm ${isDark ? "text-gray-200" : "text-gray-900"}`}
            >
              {transaction.durationMonths} mois
            </Text>
          </View>

          {/* Taux */}
          <View
            style={{
              width: columnWidths.rate,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <Text
              className={`text-sm ${isDark ? "text-gray-200" : "text-gray-900"}`}
            >
              {transaction.interestRate}%
            </Text>
          </View>

          {/* Date de début */}
          <View
            style={{
              width: columnWidths.startDate,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <Text
              className={`text-sm ${isDark ? "text-gray-200" : "text-gray-900"}`}
            >
              {formatDate(transaction.startDate)}
            </Text>
          </View>

          {/* Date d'échéance */}
          <View
            style={{
              width: columnWidths.maturityDate,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <View className="gap-1">
              <Text
                className={`text-sm ${
                  isMatured
                    ? isDark
                      ? "text-red-400 font-semibold"
                      : "text-red-600 font-semibold"
                    : nearMaturity
                      ? isDark
                        ? "text-yellow-400 font-semibold"
                        : "text-yellow-600 font-semibold"
                      : isDark
                        ? "text-gray-200"
                        : "text-gray-900"
                }`}
              >
                {formatDate(transaction.maturityDate)}
              </Text>
              {nearMaturity &&
                transaction.maturityInstructions !== "STOP" &&
                !isMatured &&
                transaction.status !== "RENEWED" && (
                  <View className="gap-1 mt-1">
                    <Text
                      className={`text-xs ${
                        isDark ? "text-yellow-400" : "text-yellow-600"
                      } font-medium`}
                    >
                      ⚠️ Échéance proche
                    </Text>
                    <View className="flex-row gap-1">
                      {canCreate && (
                        <TouchableOpacity
                          onPress={() => onRenew(transaction)}
                          className={`flex-1 px-2 py-1 rounded-lg ${
                            isDark
                              ? "bg-green-900/20 border border-green-800"
                              : "bg-green-50 border border-green-200"
                          }`}
                        >
                          <Text
                            className={`text-xs text-center ${
                              isDark ? "text-green-400" : "text-green-700"
                            }`}
                          >
                            Renouveler
                          </Text>
                        </TouchableOpacity>
                      )}
                      {canUpdate && (
                        <TouchableOpacity
                          onPress={() => onStop(transaction)}
                          className={`flex-1 px-2 py-1 rounded-lg ${
                            isDark
                              ? "bg-red-900/20 border border-red-800"
                              : "bg-red-50 border border-red-200"
                          }`}
                        >
                          <Text
                            className={`text-xs text-center ${
                              isDark ? "text-red-400" : "text-red-700"
                            }`}
                          >
                            Arrêter
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                )}
            </View>
          </View>

        </View>
      </ScrollView>
      
      {/* Actions (sticky à droite - position absolute) */}
      <View
        style={{
          position: "absolute",
          right: 0,
          top: 0,
          bottom: 0,
          width: columnWidths.actions,
          backgroundColor: isDark ? "#0f172a" : "#ffffff",
          borderLeftWidth: 1,
          borderLeftColor: isDark ? "#1e293b" : "#e5e7eb",
        }}
        className="px-3 justify-center items-center gap-2"
        pointerEvents="box-none"
      >
        {/* Badges de statut - comme dans GesFlow */}
        <View className="flex-row flex-wrap gap-1 justify-center items-center">
          {(transaction.status as string) === "CANCELLED" && (
            <View
              className={`px-2 py-0.5 rounded-full ${
                isDark
                  ? "bg-red-900/30 border border-red-700"
                  : "bg-red-100 border border-red-300"
              }`}
            >
              <Text
                className={`text-xs ${
                  isDark ? "text-red-300" : "text-red-800"
                }`}
              >
                Annulé
              </Text>
            </View>
          )}
          {isMatured && (transaction.status as string) !== "CANCELLED" && transaction.status !== "RENEWED" && (
            <View
              className={`px-2 py-0.5 rounded-full ${
                isDark
                  ? "bg-orange-900/30 border border-orange-700"
                  : "bg-orange-100 border border-orange-300"
              }`}
            >
              <Text
                className={`text-xs ${
                  isDark ? "text-orange-300" : "text-orange-800"
                }`}
              >
                Échu
              </Text>
            </View>
          )}
          {!transaction.isActive && (transaction.status as string) !== "CANCELLED" && !isMatured && transaction.status !== "RENEWED" && (
            <View
              className={`px-2 py-0.5 rounded-full ${
                isDark
                  ? "bg-gray-900/30 border border-gray-700"
                  : "bg-gray-100 border border-gray-300"
              }`}
            >
              <Text
                className={`text-xs ${
                  isDark ? "text-gray-300" : "text-gray-800"
                }`}
              >
                Inactif
              </Text>
            </View>
          )}
          {transaction.maturityInstructions === "STOP" && !isMatured && (
            <View
              className={`px-2 py-0.5 rounded-full ${
                isDark
                  ? "bg-orange-900/30 border border-orange-700"
                  : "bg-orange-100 border border-orange-300"
              }`}
            >
              <Text
                className={`text-xs ${
                  isDark ? "text-orange-300" : "text-orange-800"
                }`}
              >
                Arrêt à l'échéance
              </Text>
            </View>
          )}
        </View>

        {/* Boutons d'actions - seulement si pas annulé, pas échu, pas renouvelé et pas STOP */}
        {transaction.maturityInstructions !== "STOP" &&
          transaction.status !== "RENEWED" &&
          !isMatured &&
          (transaction.status as string) !== "CANCELLED" && (
            <View className="flex-row gap-2 justify-center items-center">
              {canUpdate && (
                <TouchableOpacity
                  className="rounded-full"
                  style={{
                    backgroundColor: "#10b98120",
                    padding: 6,
                  }}
                  activeOpacity={0.7}
                  onPress={() => onEdit(transaction)}
                >
                  <HugeiconsIcon icon={Edit01Icon} size={14} color="#10b981" />
                </TouchableOpacity>
              )}
              {canDelete && (
                <TouchableOpacity
                  className="rounded-full"
                  style={{
                    backgroundColor: "#ef444420",
                    padding: 6,
                    opacity:
                      !transaction.createdAt ||
                      !canCancel ||
                      transaction.status === "CANCELLED" ||
                      (transaction.datAccount?.totalTransferred || 0) > 0
                        ? 0.5
                        : 1,
                  }}
                  activeOpacity={0.7}
                  onPress={() => onDelete(transaction)}
                  disabled={
                    !transaction.createdAt ||
                    !canCancel ||
                    transaction.status === "CANCELLED" ||
                    (transaction.datAccount?.totalTransferred || 0) > 0
                  }
                >
                  <HugeiconsIcon icon={Cancel01Icon} size={14} color="#ef4444" />
                </TouchableOpacity>
              )}
            </View>
          )}
        
        {/* Bouton de transfert pour les DAT échus avec gains disponibles */}
        {isMatured &&
          (transaction.status as string) !== "CANCELLED" &&
          transaction.status !== "RENEWED" &&
          hasGains &&
          availableInterest > 0 && (
            <View className="flex-row gap-2 justify-center items-center">
              {canUpdate && (
                <TouchableOpacity
                  className="rounded-full"
                  style={{
                    backgroundColor: "#10b98120",
                    padding: 6,
                  }}
                  activeOpacity={0.7}
                  onPress={onTransfer}
                >
                  <HugeiconsIcon icon={MoneyExchange03Icon} size={14} color="#10b981" />
                </TouchableOpacity>
              )}
            </View>
          )}
      </View>
    </Animated.View>
  );
});

DatTableRow.displayName = "DatTableRow";

// Composant pour une ligne de DAT dans le drawer
const DatDrawerRow = React.memo(({
  dat,
  isMatured,
  hasGains,
  isDark,
  SCREEN_WIDTH,
}: {
  dat: DatTransaction;
  isMatured: boolean;
  hasGains: boolean;
  isDark: boolean;
  SCREEN_WIDTH: number;
}) => {
  // Animation pulse pour les DAT avec gains
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (hasGains) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.7,
            duration: 1500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => {
        pulse.stop();
        pulseAnim.setValue(1);
      };
    } else {
      pulseAnim.setValue(1);
    }
  }, [hasGains, pulseAnim]);

  const availableInterest = dat.datAccount 
    ? (dat.datAccount.totalInterest || 0) - (dat.datAccount.totalTransferred || 0)
    : 0;

  // Style animé - toujours utiliser pulseAnim pour éviter les warnings Reanimated
  const animatedStyle = { opacity: pulseAnim };

  return (
    <Animated.View
      className={`border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}
      style={[
        {
          position: "relative",
          backgroundColor: hasGains
            ? isDark
              ? "#1e3a8a20"
              : "#dbeafe40"
            : isDark
              ? "#0f172a"
              : "#ffffff",
        },
        animatedStyle,
      ]}
    >
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
      >
        <View style={{ flexDirection: "row", minWidth: SCREEN_WIDTH - 100 }}>
          {/* Banque */}
          <View
            style={{
              width: 120,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <View className="gap-1">
              <Text className={`text-sm ${isDark ? "text-gray-200" : "text-gray-900"}`} numberOfLines={2}>
                {dat.bankName}
              </Text>
            </View>
          </View>
          {/* Montant */}
          <View
            style={{
              width: 120,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <BlurredAmount
              amount={dat.amount}
              currency={dat.currency}
              className={`text-sm font-semibold ${isDark ? "text-gray-200" : "text-gray-900"}`}
            />
          </View>
          {/* Intérêts */}
          <View
            style={{
              width: 120,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <View className="gap-0.5">
              {dat.datAccount && dat.datAccount.totalInterest > 0 ? (
                <BlurredAmount
                  amount={dat.datAccount.totalInterest}
                  currency={dat.currency}
                  className={`text-sm font-semibold ${isDark ? "text-green-400" : "text-green-600"}`}
                />
              ) : (
                <Text className={`text-sm ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  -
                </Text>
              )}
            </View>
          </View>
          {/* Durée */}
          <View
            style={{
              width: 80,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <Text className={`text-sm ${isDark ? "text-gray-200" : "text-gray-900"}`}>
              {dat.durationMonths} mois
            </Text>
          </View>
          {/* Taux */}
          <View
            style={{
              width: 80,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <Text className={`text-sm ${isDark ? "text-gray-200" : "text-gray-900"}`}>
              {dat.interestRate}%
            </Text>
          </View>
          {/* Échéance */}
          <View
            style={{
              width: 120,
              paddingVertical: 12,
              paddingHorizontal: 8,
              borderRightWidth: 1,
              borderRightColor: isDark ? "#374151" : "#e5e7eb",
            }}
          >
            <Text
              className={`text-sm ${
                isMatured
                  ? isDark
                    ? "text-red-400 font-semibold"
                    : "text-red-600 font-semibold"
                  : isDark
                    ? "text-gray-200"
                    : "text-gray-900"
              }`}
            >
              {formatDate(dat.maturityDate)}
            </Text>
          </View>
          {/* Statut */}
          <View
            style={{
              width: 100,
              paddingVertical: 12,
              paddingHorizontal: 8,
            }}
          >
            <View className="gap-1">
              {dat.status === "CANCELLED" && (
                <View
                  className={`px-2 py-0.5 rounded-full self-start ${
                    isDark
                      ? "bg-red-900/30 border border-red-700"
                      : "bg-red-100 border border-red-300"
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      isDark ? "text-red-300" : "text-red-800"
                    }`}
                  >
                    Annulé
                  </Text>
                </View>
              )}
              {dat.status === "RENEWED" && (
                <View
                  className={`px-2 py-0.5 rounded-full self-start ${
                    isDark
                      ? "bg-green-900/30 border border-green-700"
                      : "bg-green-100 border border-green-300"
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      isDark ? "text-green-300" : "text-green-800"
                    }`}
                  >
                    Renouvelé
                  </Text>
                </View>
              )}
              {!dat.status || (dat.status !== "CANCELLED" && dat.status !== "RENEWED") && (
                <View
                  className={`px-2 py-0.5 rounded-full self-start ${
                    isDark
                      ? "bg-blue-900/30 border border-blue-700"
                      : "bg-blue-100 border border-blue-300"
                  }`}
                >
                  <Text
                    className={`text-xs ${
                      isDark ? "text-blue-300" : "text-blue-800"
                    }`}
                  >
                    {isMatured ? "Échu" : "Actif"}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </ScrollView>
    </Animated.View>
  );
});

DatDrawerRow.displayName = "DatDrawerRow";

export function DatScreen() {
  const { isDark } = useTheme();
  const { isAmountVisible } = useAmountVisibility();
  const { hasPermission } = usePermissions();
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [minAmount, setMinAmount] = useState("");
  const [maxAmount, setMaxAmount] = useState("");
  const [showDatForm, setShowDatForm] = useState(false);
  const [showDeleteDrawer, setShowDeleteDrawer] = useState(false);
  const [showStopConfirm, setShowStopConfirm] = useState(false);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [showTransferDrawer, setShowTransferDrawer] = useState(false);
  const [showSimulationModal, setShowSimulationModal] = useState(false);
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showGlobalDetailsDrawer, setShowGlobalDetailsDrawer] = useState(false);
  const [editingDat, setEditingDat] = useState<DatTransaction | null>(null);
  const [datToDelete, setDatToDelete] = useState<DatTransaction | null>(null);
  const [datToStop, setDatToStop] = useState<DatTransaction | null>(null);
  const [selectedDat, setSelectedDat] = useState<DatTransaction | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>("");
  const [selectedSectorId, setSelectedSectorId] = useState<string>("");
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [companyDatDetails, setCompanyDatDetails] = useState<any>(null);
  const [loadingCompanyDatDetails, setLoadingCompanyDatDetails] = useState(false);
  const [isRenewing, setIsRenewing] = useState(false);
  const [renewalTransactionId, setRenewalTransactionId] = useState<string | null>(null);
  const [mobilizedBalance, setMobilizedBalance] = useState<{
    amount: number;
    currency: string;
  } | null>(null);
  const [loadingMobilizedBalance, setLoadingMobilizedBalance] = useState(false);
  // Refs pour synchroniser le scroll dans le drawer Détails DAT par entreprise
  const drawerHeaderScrollRef = useRef<ScrollView>(null);
  const drawerContentScrollRef = useRef<ScrollView>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);
  const [userCompanyId, setUserCompanyId] = useState<string | null>(null);

  // États de loading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  // États pour la simulation
  const [simulationData, setSimulationData] = useState({
    amount: "",
    currency: "GNF",
    durationMonths: "3",
    interestRate: "",
    interestPaymentFrequency: "AT_MATURITY" as "MONTHLY" | "QUARTERLY" | "AT_MATURITY",
    dayCountBasis: "ACT_360" as "ACT_360" | "ACT_365",
    startDate: new Date().toISOString().split("T")[0],
  });
  const [simulationResults, setSimulationResults] = useState<{
    totalInterest: number;
    finalAmount: number;
    payments: Array<{
      period: string;
      periodStart: Date;
      periodEnd: Date;
      days: number;
      interest: number;
      cumulativeInterest: number;
    }>;
    maturityDate: Date;
  } | null>(null);

  // Refs pour le scroll synchronisé
  const headerScrollRef = useRef<ScrollView>(null);
  const contentScrollRefs = useRef<Map<string, ScrollView>>(new Map());
  const scrollXRef = useRef(0);
  const isScrollingRef = useRef(false);

  // Largeurs des colonnes
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

  const totalTableWidth = Object.values(columnWidths).reduce(
    (sum, width) => sum + width,
    0
  );

  const canView = hasPermission('dat.view');
  const canCreate = hasPermission('dat.create');
  const canUpdate = hasPermission('dat.update');
  const canDelete = hasPermission('dat.delete');

  // Récupérer l'ID de l'utilisateur actuel et vérifier si c'est un manager
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          setCurrentUserId(user.id);
          const roleName = user?.role?.name?.toLowerCase() || "";
          const isManagerRole =
            roleName.includes("gestionnaire") || roleName.includes("manager");
          setIsManager(isManagerRole);
          if (isManagerRole) {
            try {
              const managerResponse = await api.get(
                `/api/users/${user.id}/company-manager`
              );
              const manager = managerResponse.data;
              if (manager?.companyId) {
                setUserCompanyId(manager.companyId);
              }
            } catch (managerErr: any) {
              // Erreur silencieuse
            }
          }
        }
      } catch (err) {
        // Erreur silencieuse
      }
    };
    fetchUserInfo();
  }, []);

  // Récupérer les entreprises
  const { data: companies } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      try {
        const response = await api.get("/api/companies");
        return response.data;
      } catch (err) {
        return [];
      }
    },
  });

  // Récupérer les banques
  const { data: banks } = useQuery({
    queryKey: ["banks"],
    queryFn: async () => {
      try {
        const response = await api.get("/api/banks?isActive=true");
        return response.data;
      } catch (err) {
        return [];
      }
    },
  });

  // Récupérer les secteurs d'activité
  const { data: activitySectors } = useQuery({
    queryKey: ["activity-sectors"],
    queryFn: async () => {
      try {
        const response = await api.get("/api/activity-sectors?isActive=true");
        return response.data;
      } catch (err) {
        return [];
      }
    },
  });

  // État du formulaire
  const [formData, setFormData] = useState({
    companyId: "",
    countryId: "",
    bankId: "",
    bankName: "",
    amount: "",
    currency: "GNF",
    durationMonths: "",
    interestRate: "",
    interestPaymentFrequency: "AT_MATURITY" as "MONTHLY" | "QUARTERLY" | "AT_MATURITY",
    dayCountBasis: "ACT_360" as "ACT_360" | "ACT_365",
    startDate: "",
    maturityDate: "",
    accountNumber: "",
    maturityInstructions: "RENEW" as "RENEW" | "STOP",
    description: "",
  });

  // Trier les banques : d'abord celles du même pays que l'entreprise, puis les autres
  const sortedBanks = useMemo(() => {
    if (!banks || !formData.companyId) {
      return (banks || []).map((bank: Bank) => ({
        label: bank.name + (bank.country ? ` (${bank.country.name})` : ''),
        value: bank.id,
        bank: bank,
      }));
    }
    const selectedCompany = (companies || []).find((c: Company) => c.id === formData.companyId);
    const companyCountryId = selectedCompany?.country?.id;
    if (!companyCountryId) {
      return (banks || []).map((bank: Bank) => ({
        label: bank.name + (bank.country ? ` (${bank.country.name})` : ''),
        value: bank.id,
        bank: bank,
      }));
    }
    const banksSameCountry: Bank[] = [];
    const banksOtherCountries: Bank[] = [];
    (banks || []).forEach((bank: Bank) => {
      const bankCountryId = bank.country?.id || bank.countryId;
      if (bankCountryId === companyCountryId) {
        banksSameCountry.push(bank);
      } else {
        banksOtherCountries.push(bank);
      }
    });
    const allBanks = [...banksSameCountry, ...banksOtherCountries];
    return allBanks.map((bank: Bank) => ({
      label: bank.name + (bank.country ? ` (${bank.country.name})` : ''),
      value: bank.id,
      bank: bank,
    }));
  }, [banks, formData.companyId, companies]);

  const { data: datList, isLoading, error, refetch } = useQuery({
    queryKey: ['dat'],
    queryFn: async () => {
      try {
        // Traiter automatiquement les intérêts avant de charger
        try {
          await api.get('/api/dat/process-interests');
        } catch (err) {
          // Ignorer les erreurs de traitement automatique
        }
        const response = await api.get('/api/dat');
        // Trier par date de début décroissante
        const sortedData = (response.data || []).sort((a: DatTransaction, b: DatTransaction) => {
          const dateA = new Date(a.startDate).getTime();
          const dateB = new Date(b.startDate).getTime();
          return dateB - dateA;
        });
        return sortedData;
      } catch (err: any) {
        throw err;
      }
    },
    enabled: canView,
  });

  // Filtrer et trier les transactions DAT
  const filteredTransactions = useMemo(() => {
    if (!datList) return [];
    const filtered = datList.filter((transaction: DatTransaction) => {
      const matchesSearch =
        transaction.company.name
          .toLowerCase()
          .includes(searchTerm.toLowerCase()) ||
        transaction.bankName.toLowerCase().includes(searchTerm.toLowerCase());
      const amount = transaction.amount;
      const matchesMinAmount =
        !minAmount ||
        (!isNaN(parseFloat(minAmount)) && amount >= parseFloat(minAmount));
      const matchesMaxAmount =
        !maxAmount ||
        (!isNaN(parseFloat(maxAmount)) && amount <= parseFloat(maxAmount));
      const transactionStartDate = new Date(transaction.startDate);
      const matchesStartDate =
        !startDate || transactionStartDate >= new Date(startDate);
      const matchesEndDate =
        !endDate || transactionStartDate <= new Date(endDate);
      return (
        matchesSearch &&
        matchesMinAmount &&
        matchesMaxAmount &&
        matchesStartDate &&
        matchesEndDate
      );
    });
    
    // Trier : DAT avec gains disponibles en premier, puis par date de début décroissante
    return filtered.sort((a: DatTransaction, b: DatTransaction) => {
      // Calculer l'intérêt disponible pour chaque DAT
      const availableInterestA = a.datAccount 
        ? (a.datAccount.totalInterest || 0) - (a.datAccount.totalTransferred || 0)
        : 0;
      const availableInterestB = b.datAccount 
        ? (b.datAccount.totalInterest || 0) - (b.datAccount.totalTransferred || 0)
        : 0;
      
      const hasGainsA = availableInterestA > 0;
      const hasGainsB = availableInterestB > 0;
      
      // Si un a des gains et l'autre non, celui avec gains vient en premier
      if (hasGainsA && !hasGainsB) return -1;
      if (!hasGainsA && hasGainsB) return 1;
      
      // Si les deux ont des gains, trier par montant d'intérêt disponible décroissant
      if (hasGainsA && hasGainsB) {
        if (availableInterestA !== availableInterestB) {
          return availableInterestB - availableInterestA;
        }
      }
      
      // Sinon, trier par date de début décroissante
      const dateA = new Date(a.startDate).getTime();
      const dateB = new Date(b.startDate).getTime();
      return dateB - dateA;
    });
  }, [datList, searchTerm, minAmount, maxAmount, startDate, endDate]);

  // Synchroniser le scroll entre header et contenu
  const handleContentScroll = useCallback((event: any, datId?: string) => {
    if (isScrollingRef.current) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    scrollXRef.current = offsetX;
    isScrollingRef.current = true;
    if (headerScrollRef.current) {
      headerScrollRef.current.scrollTo({ x: offsetX, animated: false });
    }
    contentScrollRefs.current.forEach((ref, id) => {
      if (id !== datId && ref) {
        ref.scrollTo({ x: offsetX, animated: false });
      }
    });
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 100);
  }, []);

  const handleHeaderScroll = useCallback((event: any) => {
    if (isScrollingRef.current) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    scrollXRef.current = offsetX;
    isScrollingRef.current = true;
    contentScrollRefs.current.forEach((ref) => {
      if (ref) {
        ref.scrollTo({ x: offsetX, animated: false });
      }
    });
    setTimeout(() => {
      isScrollingRef.current = false;
    }, 100);
  }, []);

  // Calculer la date d'échéance
  const calculateMaturityDate = useCallback(
    (startDate: string, durationMonths: number): string => {
      const start = new Date(startDate);
      const maturity = new Date(start);
      maturity.setMonth(maturity.getMonth() + durationMonths);
      return maturity.toISOString().split("T")[0];
    },
    []
  );

  // Fonction de calcul de simulation
  const calculateSimulation = useCallback(() => {
    const amount = parseFloat(simulationData.amount) || 0;
    const interestRate = parseFloat(simulationData.interestRate) || 0;
    const durationMonths = parseInt(simulationData.durationMonths) || 0;
    const startDate = new Date(simulationData.startDate);
    const maturityDate = new Date(startDate);
    maturityDate.setMonth(maturityDate.getMonth() + durationMonths);

    if (!amount || !interestRate || !durationMonths) {
      return {
        totalInterest: 0,
        finalAmount: amount,
        payments: [],
        maturityDate,
      };
    }

    const daysInYear = simulationData.dayCountBasis === "ACT_360" ? 360 : 365;
    const payments: Array<{
      period: string;
      periodStart: Date;
      periodEnd: Date;
      days: number;
      interest: number;
      cumulativeInterest: number;
    }> = [];

    let totalInterest = 0;
    let currentDate = new Date(startDate);
    let paymentNumber = 1;

    if (simulationData.interestPaymentFrequency === "AT_MATURITY") {
      const days = Math.ceil(
        (maturityDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      const interest = ((amount * interestRate) / 100) * (days / daysInYear);
      totalInterest = interest;
      payments.push({
        period: "À l'échéance",
        periodStart: new Date(startDate),
        periodEnd: new Date(maturityDate),
        days,
        interest,
        cumulativeInterest: interest,
      });
    } else if (simulationData.interestPaymentFrequency === "MONTHLY") {
      while (currentDate < maturityDate) {
        const periodStart = new Date(currentDate);
        const periodEnd = new Date(currentDate);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        if (periodEnd > maturityDate) {
          periodEnd.setTime(maturityDate.getTime());
        }
        const days = Math.ceil(
          (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
        );
        const interest = ((amount * interestRate) / 100) * (days / daysInYear);
        totalInterest += interest;
        payments.push({
          period: `Mois ${paymentNumber}`,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          days,
          interest,
          cumulativeInterest: totalInterest,
        });
        currentDate = new Date(periodEnd);
        paymentNumber++;
      }
    } else if (simulationData.interestPaymentFrequency === "QUARTERLY") {
      while (currentDate < maturityDate) {
        const periodStart = new Date(currentDate);
        const periodEnd = new Date(currentDate);
        periodEnd.setMonth(periodEnd.getMonth() + 3);
        if (periodEnd > maturityDate) {
          periodEnd.setTime(maturityDate.getTime());
        }
        const days = Math.ceil(
          (periodEnd.getTime() - periodStart.getTime()) / (1000 * 60 * 60 * 24)
        );
        const interest = ((amount * interestRate) / 100) * (days / daysInYear);
        totalInterest += interest;
        payments.push({
          period: `Trimestre ${paymentNumber}`,
          periodStart: new Date(periodStart),
          periodEnd: new Date(periodEnd),
          days,
          interest,
          cumulativeInterest: totalInterest,
        });
        currentDate = new Date(periodEnd);
        paymentNumber++;
      }
    }

    return {
      totalInterest,
      finalAmount: amount + totalInterest,
      payments,
      maturityDate,
    };
  }, [simulationData]);

  // Réinitialiser les résultats quand le modal se ferme
  useEffect(() => {
    if (!showSimulationModal) {
      setSimulationResults(null);
    }
  }, [showSimulationModal]);

  if (error) {
  }

  // Variable pour le drawer global des détails
  const isGlobalDetailsDrawerOpen = showGlobalDetailsDrawer;

  // Mettre à jour la date d'échéance quand la date de début ou la durée change
  useEffect(() => {
    if (formData.startDate && formData.durationMonths) {
      const duration = parseInt(formData.durationMonths) || 0;
      if (duration > 0) {
        const maturity = calculateMaturityDate(formData.startDate, duration);
        setFormData((prev) => ({ ...prev, maturityDate: maturity }));
      }
    }
  }, [formData.startDate, formData.durationMonths, calculateMaturityDate]);

  // Mettre à jour le nom de la banque quand la banque change
  useEffect(() => {
    if (formData.bankId && sortedBanks.length > 0) {
      const selectedBank = sortedBanks.find((b: { value: string; bank?: Bank }) => b.value === formData.bankId);
      if (selectedBank && selectedBank.bank) {
        setFormData((prev) => ({
          ...prev,
          bankName: selectedBank.bank.name,
        }));
      }
    }
  }, [formData.bankId, sortedBanks]);

  // Mettre à jour le pays quand l'entreprise change
  useEffect(() => {
    if (formData.companyId && companies) {
      const selectedCompany = (companies || []).find(
        (c: Company) => c.id === formData.companyId
      );
      if (selectedCompany && selectedCompany.country) {
        setFormData((prev) => ({
          ...prev,
          countryId: selectedCompany.country.id,
          currency: selectedCompany.currency || "GNF",
        }));
        if (selectedCompany.id && !isRenewing && !editingDat) {
          loadMobilizedBalance(selectedCompany.id, selectedCompany.currency || "GNF");
        }
      }
    }
  }, [formData.companyId, companies, isRenewing, editingDat]);

  // Si l'utilisateur n'a pas la permission de voir, ne pas afficher l'écran
  if (!canView) {
    return (
      <View className={`flex-1 ${isDark ? 'bg-[#0f172a]' : 'bg-white'}`}>
        <View className="p-6">
          <Text className={`text-center ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Vous n'avez pas la permission d'accéder à cette page.
          </Text>
        </View>
      </View>
    );
  }

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } catch (err) {
      // Erreur silencieuse
    } finally {
      setRefreshing(false);
    }
  };

  // Fonction pour charger le solde mobilisé
  const loadMobilizedBalance = async (
    companyId: string,
    currency: string,
    currentDatAmount?: number
  ) => {
    try {
      setLoadingMobilizedBalance(true);
      const response = await api.get(
        `/api/dashboard/company-stats?companyId=${companyId}`,
        {
          skipAuthError: true,
        }
      );
      const balance = {
        amount:
          (response.data?.kpis?.mobilizedBalance || 0) +
          (currentDatAmount || 0),
        currency: response.data?.company?.currency || currency || "GNF",
      };
      setMobilizedBalance(balance);
    } catch (error: any) {
      setMobilizedBalance(null);
    } finally {
      setLoadingMobilizedBalance(false);
    }
  };

  // Fonction pour ouvrir le formulaire de création
  const handleCreate = () => {
    if (!canCreate) {
      return;
    }
    setEditingDat(null);
    setIsRenewing(false);
    setRenewalTransactionId(null);
    const getLocalDateString = (): string => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const today = getLocalDateString();
    setFormData({
      companyId: isManager && userCompanyId ? userCompanyId : "",
      countryId: "",
      bankId: "",
      bankName: "",
      amount: "",
      currency: "GNF",
      durationMonths: "3",
      interestRate: "",
      interestPaymentFrequency: "AT_MATURITY",
      dayCountBasis: "ACT_360",
      startDate: today,
      maturityDate: calculateMaturityDate(today, 3),
      accountNumber: "",
      maturityInstructions: "RENEW",
      description: "",
    });
    setMobilizedBalance(null);
    setLoadingMobilizedBalance(false);
    setShowDatForm(true);
  };

  // Fonction pour éditer un DAT
  const handleEdit = (dat: DatTransaction) => {
    if (!canUpdate) {
      return;
    }
    setEditingDat(dat);
    setIsRenewing(false);
    setRenewalTransactionId(null);
    let startDate = new Date().toISOString().split("T")[0];
    let maturityDate = new Date().toISOString().split("T")[0];
    if (dat.startDate) {
      const startDateObj = new Date(dat.startDate);
      if (!isNaN(startDateObj.getTime())) {
        startDate = startDateObj.toISOString().split("T")[0];
      }
    }
    if (dat.maturityDate) {
      const maturityDateObj = new Date(dat.maturityDate);
      if (!isNaN(maturityDateObj.getTime())) {
        maturityDate = maturityDateObj.toISOString().split("T")[0];
      }
    }
    setFormData({
      companyId: dat.company.id,
      countryId: dat.country?.id || "",
      bankId: (dat as any).bankId || "",
      bankName: dat.bankName || "",
      amount: dat.amount.toString(),
      currency: dat.currency || "GNF",
      durationMonths: dat.durationMonths.toString(),
      interestRate: dat.interestRate.toString(),
      interestPaymentFrequency: dat.interestPaymentFrequency,
      dayCountBasis: (dat as any).dayCountBasis || "ACT_360",
      startDate: startDate,
      maturityDate: maturityDate,
      accountNumber: dat.accountNumber || "",
      maturityInstructions: dat.maturityInstructions,
      description: dat.description || "",
    });
    // Charger le solde mobilisé pour l'édition (ajouter le montant actuel)
    loadMobilizedBalance(dat.company.id, dat.currency || "GNF", dat.amount);
    setShowDatForm(true);
  };

  // Fonction pour renouveler un DAT
  const handleRenew = (dat: DatTransaction) => {
    if (!canCreate) {
      return;
    }
    setEditingDat(null);
    setIsRenewing(true);
    setRenewalTransactionId(dat.id);
    const getLocalDateString = (): string => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    const today = getLocalDateString();
    let originalStartDate = today;
    let originalMaturityDate = calculateMaturityDate(today, parseInt(dat.durationMonths.toString()) || 3);
    if (dat.startDate) {
      const startDateObj = new Date(dat.startDate);
      if (!isNaN(startDateObj.getTime())) {
        originalStartDate = startDateObj.toISOString().split("T")[0];
      }
    }
    if (dat.maturityDate) {
      const maturityDateObj = new Date(dat.maturityDate);
      if (!isNaN(maturityDateObj.getTime())) {
        originalMaturityDate = maturityDateObj.toISOString().split("T")[0];
      }
    }
    setFormData({
      companyId: dat.company.id,
      countryId: dat.country?.id || "",
      bankId: (dat as any).bankId || "",
      bankName: dat.bankName || "",
      amount: dat.amount.toString(),
      currency: dat.currency || "GNF",
      durationMonths: dat.durationMonths.toString(),
      interestRate: dat.interestRate.toString(),
      interestPaymentFrequency: dat.interestPaymentFrequency,
      dayCountBasis: (dat as any).dayCountBasis || "ACT_360",
      startDate: originalStartDate,
      maturityDate: originalMaturityDate,
      accountNumber: dat.accountNumber || "",
      maturityInstructions: dat.maturityInstructions,
      description: dat.description || "",
    });
    // Charger le solde mobilisé pour le renouvellement
    loadMobilizedBalance(dat.company.id, dat.currency || "GNF");
    setShowDatForm(true);
  };

  // Fonction pour soumettre le formulaire
  const handleSubmitDat = async () => {
    if (isSubmitting) return;
    try {
      setIsSubmitting(true);
      if (!formData.amount || !formData.startDate || !formData.companyId || !formData.bankId || !formData.durationMonths || !formData.interestRate) {
        Alert.alert("Erreur", "Veuillez remplir tous les champs obligatoires");
        setIsSubmitting(false);
        return;
      }
      const selectedCompany = (companies || []).find((c: Company) => c.id === formData.companyId);
      const currency = selectedCompany?.currency || "GNF";
      const payload: any = {
        companyId: formData.companyId,
        countryId: formData.countryId,
        bankId: formData.bankId,
        bankName: formData.bankName,
        amount: parseFloat(formData.amount),
        currency: currency,
        durationMonths: parseInt(formData.durationMonths),
        interestRate: parseFloat(formData.interestRate),
        interestPaymentFrequency: formData.interestPaymentFrequency,
        dayCountBasis: formData.dayCountBasis,
        startDate: formData.startDate,
        maturityDate: formData.maturityDate,
        accountNumber: formData.accountNumber || null,
        maturityInstructions: formData.maturityInstructions,
        description: formData.description || null,
      };
      let createdDatId: string | null = null;
      if (editingDat) {
        await api.put(`/api/dat/${editingDat.id}`, payload);
        createdDatId = editingDat.id;
      } else {
        const response = await api.post('/api/dat', payload);
        createdDatId = response.data?.id || null;
      }
      // Si on renouvelle, mettre à jour le statut de l'ancienne transaction
      if (isRenewing && renewalTransactionId) {
        try {
          await api.put(`/api/dat/${renewalTransactionId}`, {
            status: "RENEWED",
          });
        } catch (err) {
          // Ne pas bloquer le processus
        }
      }
      setShowDatForm(false);
      setEditingDat(null);
      setIsRenewing(false);
      setRenewalTransactionId(null);
      setMobilizedBalance(null);
      await refetch();
      // Invalider les queries du dashboard pour qu'elles se mettent à jour
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error: any) {
      Alert.alert("Erreur", error.response?.data?.error || "Une erreur est survenue");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fonction pour supprimer un DAT
  const handleDelete = (dat: DatTransaction) => {
    if (!canDelete) {
      return;
    }
    setDatToDelete(dat);
    setDeleteConfirmation("");
    setShowDeleteDrawer(true);
  };

  const confirmDelete = async () => {
    if (!datToDelete) return;
    const confirmationText = `${datToDelete.bankName} - ${datToDelete.amount.toLocaleString("fr-FR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })} ${datToDelete.currency || "GNF"}`;
    if (normalizeConfirmationText(deleteConfirmation) !== normalizeConfirmationText(confirmationText)) {
      Alert.alert("Erreur", "La confirmation ne correspond pas");
      return;
    }
    try {
      setIsDeleting(true);
      await api.delete(`/api/dat/${datToDelete.id}`);
      setShowDeleteDrawer(false);
      setDatToDelete(null);
      setDeleteConfirmation("");
      await refetch();
      // Invalider les queries du dashboard pour qu'elles se mettent à jour
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error: any) {
      Alert.alert("Erreur", error.response?.data?.error || "Impossible de supprimer le DAT");
    } finally {
      setIsDeleting(false);
    }
  };

  // Fonction pour arrêter un DAT
  const handleStop = (dat: DatTransaction) => {
    if (!canUpdate) {
      return;
    }
    setDatToStop(dat);
    setShowStopConfirm(true);
  };

  const confirmStop = async () => {
    if (!datToStop) return;
    try {
      setIsStopping(true);
      await api.put(`/api/dat/${datToStop.id}`, {
        ...datToStop,
        maturityInstructions: "STOP",
        isActive: false,
      });
      setShowStopConfirm(false);
      setDatToStop(null);
      await refetch();
      // Invalider les queries du dashboard pour qu'elles se mettent à jour
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error: any) {
      Alert.alert("Erreur", error.response?.data?.error || "Impossible d'arrêter le DAT");
    } finally {
      setIsStopping(false);
    }
  };

  // Fonction pour ouvrir les détails
  const handleViewDetails = async (dat: DatTransaction) => {
    setSelectedDat(dat);
    try {
      const response = await api.get(`/api/dat/${dat.id}/account`);
      if (response.data) {
        setSelectedDat({
          ...dat,
          datAccount: response.data,
        });
      }
    } catch (err) {
      // Ignore error
    }
    setShowDetailsDrawer(true);
  };

  // Fonction pour transférer les intérêts
  const handleTransfer = async (datId?: string, amount?: number) => {
    const targetDatId = datId || selectedDat?.id;
    const transferAmountValue =
      amount !== undefined
        ? amount
        : transferAmount
        ? parseFloat(transferAmount)
        : undefined;
    if (!targetDatId) return;
    let datToTransfer: DatTransaction | null = null;
    if (datId) {
      datToTransfer = (datList || []).find((t: DatTransaction) => t.id === datId) || null;
    } else {
      datToTransfer = selectedDat;
    }
    if (!datToTransfer || !datToTransfer.datAccount) {
      Alert.alert("Erreur", "DAT non trouvé");
      return;
    }
    // Calculer l'intérêt disponible (totalInterest - totalTransferred)
    const availableInterest = (datToTransfer.datAccount.totalInterest || 0) - (datToTransfer.datAccount.totalTransferred || 0);
    
    if (availableInterest <= 0) {
      Alert.alert("Erreur", "Aucun intérêt disponible à transférer");
      return;
    }
    const amountToTransfer =
      transferAmountValue !== undefined
        ? transferAmountValue
        : availableInterest;
    if (
      amountToTransfer <= 0 ||
      amountToTransfer > availableInterest
    ) {
      Alert.alert("Erreur", `Le montant ne peut pas dépasser ${availableInterest.toLocaleString("fr-FR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })} ${datToTransfer.currency || "GNF"}`);
      return;
    }
    try {
      setIsTransferring(true);
      const response = await api.post(`/api/dat/${targetDatId}/account`, {
        transferAmount: amountToTransfer,
      });
      if (response.data) {
        Alert.alert(
          "Succès",
          `Transfert de ${amountToTransfer.toLocaleString("fr-FR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} ${datToTransfer.currency || "GNF"} effectué avec succès`
        );
        if (!datId) {
          setShowTransferDrawer(false);
          setTransferAmount("");
        }
        await refetch();
        // Invalider les queries du dashboard pour qu'elles se mettent à jour
        await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
        await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
        // Rafraîchir les détails de l'entreprise si le drawer est ouvert (forcer le rafraîchissement)
        if (showGlobalDetailsDrawer && selectedCompanyId) {
          await fetchCompanyDatDetails(selectedCompanyId, true);
        }
        if (showDetailsDrawer && selectedDat) {
          try {
            const accountResponse = await api.get(
              `/api/dat/${selectedDat.id}/account`
            );
            if (accountResponse.data) {
              const updatedTransaction = (datList || []).find(
                (t: DatTransaction) => t.id === selectedDat.id
              );
              if (updatedTransaction) {
                setSelectedDat({
                  ...updatedTransaction,
                  datAccount: accountResponse.data,
                });
              }
            }
          } catch (err) {
            // Ignore error
          }
        }
      }
    } catch (err: any) {
      Alert.alert("Erreur", err.response?.data?.error || err.message || "Erreur lors du transfert");
    } finally {
      setIsTransferring(false);
    }
  };

  // Fonction pour charger les détails DAT par entreprise
  const fetchCompanyDatDetails = async (companyId: string, forceRefresh = false) => {
    if (!companyId) {
      setCompanyDatDetails(null);
      return;
    }
    try {
      setLoadingCompanyDatDetails(true);
      // Ajouter un timestamp pour forcer le rafraîchissement si nécessaire
      const url = forceRefresh 
        ? `/api/dat?companyId=${companyId}&_t=${Date.now()}`
        : `/api/dat?companyId=${companyId}`;
      const response = await api.get(url);
      const data = response.data || [];
      const now = new Date();
      const totalAmount = data.reduce(
        (sum: number, dat: DatTransaction) => sum + (dat.amount || 0),
        0
      );
      const totalInterest = data.reduce(
        (sum: number, dat: DatTransaction) => {
          const isMatured = new Date(dat.maturityDate) < now;
          return sum + (isMatured ? dat.datAccount?.totalInterest || 0 : 0);
        },
        0
      );
      const totalTransferred = data.reduce(
        (sum: number, dat: DatTransaction) => {
          return sum + (dat.datAccount?.totalTransferred || 0);
        },
        0
      );
      const activeCount = data.filter((dat: DatTransaction) => {
        return new Date(dat.maturityDate) >= now;
      }).length;
      const maturedCount = data.filter((dat: DatTransaction) => {
        return new Date(dat.maturityDate) < now;
      }).length;
      setCompanyDatDetails({
        transactions: data,
        totalAmount,
        totalInterest,
        totalTransferred,
        activeCount,
        maturedCount,
        currency: data[0]?.currency || "GNF",
      });
    } catch (err: any) {
      Alert.alert("Erreur", "Impossible de charger les détails DAT");
    } finally {
      setLoadingCompanyDatDetails(false);
    }
  };

  const handleSectorChange = (sectorId: string) => {
    setSelectedSectorId(sectorId);
    setSelectedCompanyId("");
    setCompanyDatDetails(null);
    if (sectorId) {
      const filtered = (companies || []).filter(
        (company: Company) => (company as any).activitySectorId === sectorId
      );
      setFilteredCompanies(filtered);
    } else {
      setFilteredCompanies([]);
    }
  };

  const handleCompanyChange = (companyId: string) => {
    setSelectedCompanyId(companyId);
    fetchCompanyDatDetails(companyId);
  };

  // Fonction pour exporter en CSV/Excel
  const handleExport = async () => {
    if (isExporting) return;
    try {
      setIsExporting(true);
      if (!filteredTransactions || filteredTransactions.length === 0) {
        Alert.alert(
          "Aucune donnée",
          "Il n'y a aucun DAT à exporter avec les filtres actuels."
        );
        return;
      }
      const exportData = filteredTransactions.map((transaction: DatTransaction) => {
        const frequencyMap: { [key: string]: string } = {
          MONTHLY: "Mensuel",
          QUARTERLY: "Trimestriel",
          AT_MATURITY: "À l'échéance",
        };
        return {
          Entreprise: transaction.company.name,
          Banque: transaction.bankName,
          Montant: `${transaction.amount.toLocaleString("fr-FR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} ${transaction.currency}`,
          Devise: transaction.currency,
          "Taux d'intérêt (%)": transaction.interestRate,
          "Durée (mois)": transaction.durationMonths,
          Versement: frequencyMap[transaction.interestPaymentFrequency] || transaction.interestPaymentFrequency,
          "Date de début": formatDate(transaction.startDate),
          "Date d'échéance": formatDate(transaction.maturityDate),
          "Numéro de compte": transaction.accountNumber || "",
          Description: transaction.description || "",
          "Intérêts générés": transaction.datAccount?.totalInterest
            ? `${transaction.datAccount.totalInterest.toLocaleString("fr-FR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} ${transaction.currency}`
            : "0",
          "Total transféré": transaction.datAccount?.totalTransferred
            ? `${transaction.datAccount.totalTransferred.toLocaleString("fr-FR", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} ${transaction.currency}`
            : "0",
        };
      });
      let XLSX: any;
      let useXLSX = false;
      try {
        XLSX = require("xlsx");
        if (XLSX && XLSX.utils) {
          useXLSX = true;
        }
      } catch (e) {
      }
      let fileContent: string;
      let filename: string;
      let mimeType: string;
      if (useXLSX) {
        const worksheet = XLSX.utils.json_to_sheet(exportData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "DAT");
        fileContent = XLSX.write(workbook, {
          type: "base64",
          bookType: "xlsx",
        });
        filename = `dat_${new Date().toISOString().split("T")[0]}.xlsx`;
        mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      } else {
        const headers = Object.keys(exportData[0]);
        const csvRows = [
          headers.join(","),
          ...exportData.map((row: any) =>
            headers
              .map((header) => {
                const value = row[header as keyof typeof row];
                if (
                  typeof value === "string" &&
                  (value.includes(",") || value.includes('"') || value.includes("\n"))
                ) {
                  return `"${value.replace(/"/g, '""')}"`;
                }
                return value ?? "";
              })
              .join(",")
          ),
        ];
        fileContent = csvRows.join("\n");
        filename = `dat_${new Date().toISOString().split("T")[0]}.csv`;
        mimeType = "text/csv";
      }
      const directory = getDocumentDirectory();
      const writeFn = FileSystemLegacy?.writeAsStringAsync || FileSystem.writeAsStringAsync;
      if (!writeFn) {
        throw new Error("writeAsStringAsync not found in expo-file-system");
      }
      const fileUri = directory ? `${directory}${filename}` : filename;
      if (useXLSX) {
        await writeFn(fileUri, fileContent, { encoding: "base64" });
      } else {
        await writeFn(fileUri, fileContent, { encoding: "utf8" });
      }
      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: mimeType,
          dialogTitle: useXLSX ? "Partager le fichier Excel" : "Partager le fichier CSV",
        });
      } else {
        Alert.alert("Export réussi", `Le fichier ${useXLSX ? "Excel" : "CSV"} a été sauvegardé : ${filename}`);
      }
    } catch (error: any) {
      Alert.alert("Erreur", "Impossible d'exporter le fichier");
    } finally {
      setIsExporting(false);
    }
  };

  // Vérifier si un DAT est proche de l'échéance (1 semaine)
  const isNearMaturity = (maturityDate: string): boolean => {
    const maturity = new Date(maturityDate);
    const today = new Date();
    const diffTime = maturity.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays <= 7 && diffDays >= 0;
  };

  return (
    <SafeAreaView
      className={`flex-1 ${isDark ? "bg-[#0f172a]" : "bg-white"}`}
      edges={["top", "bottom"]}
    >
      <ScreenHeader />
          <View className="flex-1">
        {!(isLoading || !datList) && (
          <View className="px-4 pt-20 pb-4">
            {/* Barre de recherche, filtre et boutons sur la même ligne */}
            <View className="flex-row items-center gap-2 mb-4">
            {/* Barre de recherche */}
            <View
              className={`flex-1 flex-row items-center gap-2 px-4 py-2.5 rounded-full ${
                isDark ? "bg-[#1e293b]" : "bg-gray-100"
              }`}
            >
              <HugeiconsIcon
                icon={Search01Icon}
                size={18}
                color={isDark ? "#9ca3af" : "#6b7280"}
              />
              <TextInput
                value={searchTerm}
                onChangeText={setSearchTerm}
                placeholder="Rechercher..."
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                className={`flex-1 text-sm ${
                  isDark ? "text-gray-100" : "text-gray-900"
                }`}
                style={{
                  textAlignVertical: "center",
                  includeFontPadding: false,
                  paddingVertical: 0,
                }}
              />
            </View>

            {/* Bouton filtre */}
            <TouchableOpacity
              onPress={() => setShowFiltersModal(true)}
              className={`px-3 py-2.5 rounded-full flex-row items-center gap-1.5 ${
                minAmount || maxAmount || startDate || endDate
                  ? "bg-blue-600"
                  : isDark
                    ? "bg-[#1e293b]"
                    : "bg-gray-100"
              }`}
              activeOpacity={0.7}
            >
              <HugeiconsIcon
                icon={FilterIcon}
                size={18}
                color={
                  minAmount || maxAmount || startDate || endDate
                    ? "#ffffff"
                    : isDark
                      ? "#9ca3af"
                      : "#6b7280"
                }
              />
              {(minAmount ? 1 : 0) +
                (maxAmount ? 1 : 0) +
                (startDate ? 1 : 0) +
                (endDate ? 1 : 0) >
                0 && (
                <View
                  className="px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(255, 255, 255, 0.2)" }}
                >
                  <Text className="text-white text-xs font-semibold">
                    {(minAmount ? 1 : 0) +
                      (maxAmount ? 1 : 0) +
                      (startDate ? 1 : 0) +
                      (endDate ? 1 : 0)}
                  </Text>
        </View>
              )}
      </TouchableOpacity>

            {/* Bouton export Excel */}
            <TouchableOpacity
              onPress={handleExport}
              disabled={isExporting}
              className="px-3 py-2.5 rounded-full flex-row items-center gap-1.5"
              style={{
                backgroundColor: isDark ? "#1e293b" : "#f3f4f6",
                opacity: isExporting ? 0.6 : 1,
              }}
              activeOpacity={0.7}
            >
              {isExporting ? (
                <ActivityIndicator
                  size="small"
                  color={isDark ? "#9ca3af" : "#6b7280"}
                />
              ) : (
                <HugeiconsIcon
                  icon={Download01Icon}
                  size={18}
                  color={isDark ? "#9ca3af" : "#6b7280"}
                />
              )}
            </TouchableOpacity>

            {/* Bouton créer */}
            {canCreate && (
              <TouchableOpacity
                onPress={handleCreate}
                className="px-4 py-2.5 rounded-full flex-row items-center gap-2"
                style={{ backgroundColor: CHART_COLOR }}
                activeOpacity={0.7}
              >
                <HugeiconsIcon
                  icon={PlusSignCircleIcon}
                  size={18}
                  color="#ffffff"
                />
                <Text className="text-white text-sm font-semibold">
                  Nouveau
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Boutons secondaires */}
          <View className="flex-row items-center gap-2 mb-4 flex-wrap">
            {/* Bouton Détails DAT par entreprise */}
            <TouchableOpacity
              onPress={() => {
                setShowGlobalDetailsDrawer(true);
                setSelectedSectorId("");
                setSelectedCompanyId("");
                setFilteredCompanies([]);
                setCompanyDatDetails(null);
              }}
              className={`flex-1 min-w-[140px] flex-row items-center justify-center gap-2 px-4 py-2.5 rounded-full border ${
                isDark
                  ? "bg-[#0f172a] border-gray-700"
                  : "bg-white border-gray-300"
              }`}
            >
              <HugeiconsIcon
                icon={Coins01Icon}
                size={18}
                color={isDark ? "#9ca3af" : "#6b7280"}
              />
              <Text
                className={`text-sm font-medium ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Détails par entreprise
              </Text>
            </TouchableOpacity>
            {/* Bouton Simuler un DAT */}
            <TouchableOpacity
              onPress={() => {
                setSimulationData({
                  amount: "",
                  currency: "GNF",
                  durationMonths: "3",
                  interestRate: "",
                  interestPaymentFrequency: "AT_MATURITY",
                  dayCountBasis: "ACT_360",
                  startDate: new Date().toISOString().split("T")[0],
                });
                setSimulationResults(null);
                setShowSimulationModal(true);
              }}
              className={`flex-1 min-w-[140px] flex-row items-center justify-center gap-2 px-4 py-2.5 rounded-full border ${
                isDark
                  ? "bg-blue-900/20 border-blue-600"
                  : "bg-blue-50 border-blue-300"
              }`}
            >
              <HugeiconsIcon
                icon={CalculatorIcon}
                size={18}
                color={isDark ? "#60a5fa" : "#2563eb"}
              />
              <Text
                className={`text-sm font-medium ${
                  isDark ? "text-blue-300" : "text-blue-700"
                }`}
              >
                Simuler un DAT
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        )}

        {/* Table virtuelle */}
      {isLoading || !datList ? (
        <DatSkeleton />
      ) : filteredTransactions.length === 0 ? (
        <View className="flex-1 items-center justify-center py-12">
          <Text className={`${isDark ? "text-gray-400" : "text-gray-600"}`}>
            {searchTerm || minAmount || maxAmount || startDate || endDate
              ? "Aucun DAT trouvé avec les filtres actuels"
              : "Aucun DAT disponible"}
          </Text>
        </View>
      ) : (
        <>
          <ScrollView
            className="flex-1"
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={isDark ? "#38bdf8" : REFRESH_CONTROL_COLOR}
              colors={isDark ? ["#38bdf8"] : [REFRESH_CONTROL_COLOR]}
            />
          }
          >
          {/* En-tête de la table */}
          <View
            className={`border-b ${isDark ? "border-gray-700" : "border-gray-200"}`}
            style={{ position: "relative" }}
          >
            <ScrollView
              ref={headerScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              onScroll={handleHeaderScroll}
              scrollEventThrottle={16}
            >
              <View style={{ width: totalTableWidth, flexDirection: "row" }}>
                <View
                  style={{
                    width: columnWidths.bank,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                    borderRightWidth: 1,
                    borderRightColor: isDark ? "#374151" : "#e5e7eb",
                  }}
                >
              <Text
                    className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
              >
                    Banque
              </Text>
            </View>
                <View
                  style={{
                    width: columnWidths.company,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                    borderRightWidth: 1,
                    borderRightColor: isDark ? "#374151" : "#e5e7eb",
                  }}
                >
                  <Text
                    className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
                  >
                    Entreprise
                  </Text>
                </View>
                <View
                  style={{
                    width: columnWidths.amount,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                    borderRightWidth: 1,
                    borderRightColor: isDark ? "#374151" : "#e5e7eb",
                  }}
                >
                  <Text
                    className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
                  >
                    Montant
                  </Text>
                </View>
                <View
                  style={{
                    width: columnWidths.interest,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                    borderRightWidth: 1,
                    borderRightColor: isDark ? "#374151" : "#e5e7eb",
                  }}
                >
                  <Text
                    className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
                  >
                    Intérêts
                  </Text>
                </View>
                <View
                  style={{
                    width: columnWidths.duration,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                    borderRightWidth: 1,
                    borderRightColor: isDark ? "#374151" : "#e5e7eb",
                  }}
                >
                  <Text
                    className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
                  >
                    Durée
                  </Text>
                </View>
                <View
                  style={{
                    width: columnWidths.rate,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                    borderRightWidth: 1,
                    borderRightColor: isDark ? "#374151" : "#e5e7eb",
                  }}
                >
                  <Text
                    className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
                  >
                    Taux
                  </Text>
                </View>
                <View
                  style={{
                    width: columnWidths.startDate,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                    borderRightWidth: 1,
                    borderRightColor: isDark ? "#374151" : "#e5e7eb",
                  }}
                >
                  <Text
                    className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
                  >
                    Début
                  </Text>
                </View>
                <View
                  style={{
                    width: columnWidths.maturityDate,
                    paddingVertical: 12,
                    paddingHorizontal: 8,
                    backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                    borderRightWidth: 1,
                    borderRightColor: isDark ? "#374151" : "#e5e7eb",
                  }}
                >
                  <Text
                    className={`text-xs font-semibold ${isDark ? "text-gray-300" : "text-gray-700"}`}
                  >
                    Échéance
                  </Text>
                </View>
              </View>
            </ScrollView>
            {/* Actions (sticky à droite - position absolute) */}
            <View
              style={{
                position: "absolute",
                right: 0,
                top: 0,
                bottom: 0,
                width: columnWidths.actions,
                backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                borderLeftWidth: 1,
                borderLeftColor: isDark ? "#334155" : "#e5e7eb",
              }}
              className="px-3 py-3 justify-center items-center"
            >
              <Text
                className={`text-xs font-semibold uppercase ${
                  isDark ? "text-gray-400" : "text-gray-500"
                }`}
              >
                Actions
              </Text>
            </View>
          </View>

          {/* Lignes de données */}
          {filteredTransactions.map((transaction: DatTransaction) => {
            const nearMaturity = isNearMaturity(transaction.maturityDate);
            const isMatured = new Date(transaction.maturityDate) < new Date();
            const canCancel = canCancelTransaction(transaction.createdAt);

            return (
              <DatTableRow
                key={transaction.id}
                transaction={transaction}
                columnWidths={columnWidths}
                totalTableWidth={totalTableWidth}
                isDark={isDark}
                nearMaturity={nearMaturity}
                isMatured={isMatured}
                canCancel={canCancel}
                canView={canView}
                canUpdate={canUpdate}
                canDelete={canDelete}
                canCreate={canCreate}
                onViewDetails={handleViewDetails}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onTransfer={async () => {
                  setSelectedDat(transaction);
                  setTransferAmount("");
                  // Rafraîchir les données du compte DAT pour avoir les valeurs à jour
                  try {
                    const accountResponse = await api.get(`/api/dat/${transaction.id}/account`);
                    if (accountResponse.data) {
                      setSelectedDat({
                        ...transaction,
                        datAccount: accountResponse.data,
                      });
                    }
                  } catch (err) {
                    // Ignore error, on utilise les données existantes
                  }
                  setShowTransferDrawer(true);
                }}
                onRenew={handleRenew}
                onStop={handleStop}
                onScroll={(e) => handleContentScroll(e, transaction.id)}
                scrollRef={(ref) => {
                  if (ref) {
                    contentScrollRefs.current.set(transaction.id, ref);
                  } else {
                    contentScrollRefs.current.delete(transaction.id);
                  }
                }}
              />
            );
          })}
          </ScrollView>
        </>
      )}

      {/* Drawer Filtres */}
      <Drawer
        open={showFiltersModal}
        onOpenChange={setShowFiltersModal}
        title="Filtres"
      >
        {/* Header avec Reset */}
        <View className="flex-row items-center justify-between mb-6">
          <TouchableOpacity
            onPress={() => {
              setMinAmount("");
              setMaxAmount("");
              setStartDate("");
              setEndDate("");
            }}
            activeOpacity={0.7}
          >
            <Text
              className={`text-sm font-medium ${
                isDark ? "text-gray-400" : "text-gray-600"
              }`}
            >
              Reset
            </Text>
          </TouchableOpacity>
        </View>

        {/* Filtre Montant */}
        <View className="mb-6">
          <Text
            className={`text-sm font-semibold mb-3 ${
              isDark ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Montant
          </Text>
          <View className="flex-row items-center gap-2">
            <View
              className={`flex-1 flex-row items-center gap-2 px-3 py-2.5 rounded-lg border ${
                isDark
                  ? "bg-[#0f172a] border-gray-700"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <TextInput
                value={minAmount}
                onChangeText={setMinAmount}
                placeholder="Min"
                keyboardType="numeric"
                className={`flex-1 text-sm ${
                  isDark ? "text-gray-100" : "text-gray-900"
                }`}
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                style={{
                  textAlignVertical: "center",
                  includeFontPadding: false,
                  paddingVertical: 0,
                }}
              />
            </View>
            <Text
              className={`text-sm ${isDark ? "text-gray-400" : "text-gray-600"}`}
            >
              -
            </Text>
            <View
              className={`flex-1 flex-row items-center gap-2 px-3 py-2.5 rounded-lg border ${
                isDark
                  ? "bg-[#0f172a] border-gray-700"
                  : "bg-gray-50 border-gray-200"
              }`}
            >
              <TextInput
                value={maxAmount}
                onChangeText={setMaxAmount}
                placeholder="Max"
                keyboardType="numeric"
                className={`flex-1 text-sm ${
                  isDark ? "text-gray-100" : "text-gray-900"
                }`}
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                style={{
                  textAlignVertical: "center",
                  includeFontPadding: false,
                  paddingVertical: 0,
                }}
              />
            </View>
          </View>
        </View>

        {/* Filtre Dates */}
        <View className="mb-6">
          <Text
            className={`text-sm font-semibold mb-3 ${
              isDark ? "text-gray-300" : "text-gray-700"
            }`}
          >
            Date
          </Text>
          <View className="gap-3">
            <TextInput
              value={startDate}
              onChangeText={setStartDate}
              placeholder="Date de début (YYYY-MM-DD)"
              className={`px-3 py-2.5 rounded-lg border text-sm ${
                isDark
                  ? "bg-[#0f172a] border-gray-700 text-gray-100"
                  : "bg-gray-50 border-gray-200 text-gray-900"
              }`}
              placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              style={{
                textAlignVertical: "center",
                includeFontPadding: false,
                paddingVertical: 0,
              }}
            />
            <TextInput
              value={endDate}
              onChangeText={setEndDate}
              placeholder="Date de fin (YYYY-MM-DD)"
              className={`px-3 py-2.5 rounded-lg border text-sm ${
                isDark
                  ? "bg-[#0f172a] border-gray-700 text-gray-100"
                  : "bg-gray-50 border-gray-200 text-gray-900"
              }`}
              placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              style={{
                textAlignVertical: "center",
                includeFontPadding: false,
                paddingVertical: 0,
              }}
            />
          </View>
        </View>
      </Drawer>

      {/* Drawer Détails DAT par entreprise */}
      <Drawer
        open={showGlobalDetailsDrawer}
        onOpenChange={(open) => {
          setShowGlobalDetailsDrawer(open);
          if (!open) {
            setSelectedSectorId("");
            setSelectedCompanyId("");
            setFilteredCompanies([]);
            setCompanyDatDetails(null);
          }
        }}
        title="Détails DAT par entreprise"
      >
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-4 pb-4">
            {/* Sélection du secteur d'activité */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Secteur d'activité
              </Text>
              <Select
                value={selectedSectorId}
                onValueChange={handleSectorChange}
                options={(activitySectors || []).map((sector: any) => ({
                  label: sector.name,
                  value: sector.id,
                }))}
                placeholder="Sélectionnez un secteur d'activité"
              />
              {(!activitySectors || activitySectors.length === 0) && (
                <Text className={`text-xs mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                  Créez des secteurs d'activité depuis la page "Secteurs d'activité"
                </Text>
              )}
            </View>

            {/* Sélection de l'entreprise */}
            {selectedSectorId && (
              <View>
                <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Entreprise
                </Text>
                <Select
                  value={selectedCompanyId}
                  onValueChange={handleCompanyChange}
                  options={filteredCompanies.map((company: Company) => ({
                    label: company.name,
                    value: company.id,
                  }))}
                  placeholder="Sélectionnez une entreprise"
                />
              </View>
            )}

            {/* Détails des DAT de l'entreprise */}
            {loadingCompanyDatDetails ? (
              <View className="items-center justify-center py-8">
                <ActivityIndicator size="large" color={isDark ? "#60a5fa" : "#0ea5e9"} />
              </View>
            ) : companyDatDetails ? (
              <>
                {/* Statistiques globales */}
                <View className="gap-4 mb-4">
                  <Text className={`text-lg font-bold mb-2 ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                    Statistiques globales
                  </Text>
                  
                  {/* Grille de cartes statistiques */}
                  <View className="gap-3">
                    {/* Première ligne - Montant total investi (carte principale) */}
                    <View
                      className={`p-4 rounded-xl border ${
                        isDark
                          ? "bg-blue-900/20 border-blue-700/50"
                          : "bg-blue-50 border-blue-200"
                      }`}
                    >
                      <Text className={`text-xs font-medium mb-2 uppercase tracking-wide ${isDark ? "text-blue-300" : "text-blue-700"}`}>
                        Montant total investi
                      </Text>
                      <BlurredAmount
                        amount={companyDatDetails.totalAmount}
                        currency={companyDatDetails.currency}
                        className={`text-2xl font-bold ${isDark ? "text-blue-200" : "text-blue-900"}`}
                      />
                    </View>

                    {/* Deuxième ligne - Gains globaux et Total transféré */}
                    <View className="flex-row gap-3">
                      <View
                        className={`flex-1 p-4 rounded-xl border ${
                          isDark
                            ? "bg-green-900/20 border-green-700/50"
                            : "bg-green-50 border-green-200"
                        }`}
                      >
                        <Text className={`text-xs font-medium mb-2 ${isDark ? "text-green-300" : "text-green-700"}`}>
                          Gains globaux
                        </Text>
                        <BlurredAmount
                          amount={
                            companyDatDetails.totalGains ||
                            companyDatDetails.totalInterest +
                              (companyDatDetails.totalTransferred || 0)
                          }
                          currency={companyDatDetails.currency}
                          className={`text-xl font-bold ${isDark ? "text-green-200" : "text-green-900"}`}
                        />
                      </View>

                      <View
                        className={`flex-1 p-4 rounded-xl border ${
                          isDark
                            ? "bg-orange-900/20 border-orange-700/50"
                            : "bg-orange-50 border-orange-200"
                        }`}
                      >
                        <Text className={`text-xs font-medium mb-2 ${isDark ? "text-orange-300" : "text-orange-700"}`}>
                          Total transféré
                        </Text>
                        <BlurredAmount
                          amount={companyDatDetails.totalTransferred || 0}
                          currency={companyDatDetails.currency}
                          className={`text-xl font-bold ${isDark ? "text-orange-200" : "text-orange-900"}`}
                        />
                      </View>
                    </View>

                    {/* Troisième ligne - DAT actifs et DAT arrivés à échéance */}
                    <View className="flex-row gap-3">
                      <View
                        className={`flex-1 p-4 rounded-xl border ${
                          isDark
                            ? "bg-purple-900/20 border-purple-700/50"
                            : "bg-purple-50 border-purple-200"
                        }`}
                      >
                        <Text className={`text-xs font-medium mb-2 ${isDark ? "text-purple-300" : "text-purple-700"}`}>
                          DAT actifs
                        </Text>
                        <Text className={`text-2xl font-bold ${isDark ? "text-purple-200" : "text-purple-900"}`}>
                          {companyDatDetails.activeCount || 0}
                        </Text>
                      </View>

                      <View
                        className={`flex-1 p-4 rounded-xl border ${
                          isDark
                            ? "bg-cyan-900/20 border-cyan-700/50"
                            : "bg-cyan-50 border-cyan-200"
                        }`}
                      >
                        <Text className={`text-xs font-medium mb-2 ${isDark ? "text-cyan-300" : "text-cyan-700"}`}>
                          DAT arrivés à échéance
                        </Text>
                        <Text className={`text-2xl font-bold ${isDark ? "text-cyan-200" : "text-cyan-900"}`}>
                          {companyDatDetails.maturedCount || 0}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>
      </Drawer>

      {/* Drawer de formulaire DAT (Créer/Éditer) */}
      <Drawer
        open={showDatForm}
        onOpenChange={(open) => {
          setShowDatForm(open);
          if (!open) {
            setEditingDat(null);
            setIsRenewing(false);
            setRenewalTransactionId(null);
            setMobilizedBalance(null);
          }
        }}
        title={isRenewing ? "Renouveler le DAT" : editingDat ? "Modifier le DAT" : "Créer un DAT"}
      >
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
          <View className="gap-4 pb-4">
            {/* Entreprise */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Entreprise *
              </Text>
              <Select
                value={formData.companyId}
                onValueChange={(value) => {
                  setFormData((prev) => ({ ...prev, companyId: value }));
                }}
                options={(companies || []).map((c: Company) => ({
                  label: c.name,
                  value: c.id,
                }))}
                placeholder="Sélectionner une entreprise"
                disabled={(isManager && !!userCompanyId) || !!editingDat}
              />
            </View>

            {/* Banque */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Banque *
              </Text>
              <Select
                value={formData.bankId}
                onValueChange={(value) => {
                  setFormData((prev) => ({ ...prev, bankId: value }));
                }}
                options={sortedBanks}
                placeholder="Sélectionner une banque"
                disabled={!!editingDat}
              />
            </View>

            {/* Montant */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Montant du dépôt *
              </Text>
              <TextInput
                value={formData.amount}
                onChangeText={(text) => {
                  setFormData((prev) => ({ ...prev, amount: text }));
                }}
                placeholder="0.00"
                keyboardType="numeric"
                className={`px-3 py-2 rounded-lg border ${isDark ? "bg-[#1e293b] border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
              />
              {/* Affichage du solde mobilisé */}
              {formData.companyId && (
                <View
                  className={`mt-2 p-3 rounded-lg border ${
                    isDark
                      ? "bg-blue-900/20 border-blue-800"
                      : "bg-blue-50 border-blue-200"
                  }`}
                >
                  <Text
                    className={`text-xs mb-1 ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Solde mobilisé disponible
                  </Text>
                  {loadingMobilizedBalance ? (
                    <Text
                      className={`text-sm ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Chargement...
                    </Text>
                  ) : mobilizedBalance !== null ? (
                    <View className="flex-row items-center gap-2">
                      <BlurredAmount
                        amount={mobilizedBalance.amount}
                        currency={mobilizedBalance.currency}
                        className={`text-base font-bold ${
                          isDark ? "text-blue-400" : "text-blue-600"
                        }`}
                      />
                      {parseFloat(formData.amount || "0") >
                        mobilizedBalance.amount && (
                        <Text
                          className={`text-xs font-medium ${
                            isDark ? "text-red-400" : "text-red-600"
                          }`}
                        >
                          ⚠️ Montant supérieur au solde disponible
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text
                      className={`text-sm ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Chargement du solde...
                    </Text>
                  )}
                </View>
              )}
            </View>

            {/* Durée */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Durée (en mois) *
              </Text>
              <TextInput
                value={formData.durationMonths}
                onChangeText={(text) => {
                  setFormData((prev) => ({ ...prev, durationMonths: text }));
                }}
                placeholder="3"
                keyboardType="numeric"
                className={`px-3 py-2 rounded-lg border ${isDark ? "bg-[#1e293b] border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
              />
            </View>

            {/* Taux d'intérêt */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Taux d'intérêt (%) *
              </Text>
              <TextInput
                value={formData.interestRate}
                onChangeText={(text) => {
                  setFormData((prev) => ({ ...prev, interestRate: text }));
                }}
                placeholder="0.00"
                keyboardType="numeric"
                className={`px-3 py-2 rounded-lg border ${isDark ? "bg-[#1e293b] border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
              />
            </View>

            {/* Versement des intérêts */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Versement des intérêts *
              </Text>
              <Select
                value={formData.interestPaymentFrequency}
                onValueChange={(value: string) => {
                  setFormData((prev) => ({ ...prev, interestPaymentFrequency: value as "MONTHLY" | "QUARTERLY" | "AT_MATURITY" }));
                }}
                options={[
                  { label: "À l'échéance", value: "AT_MATURITY" },
                  { label: "Mensuel", value: "MONTHLY" },
                  { label: "Trimestriel", value: "QUARTERLY" },
                ]}
              />
            </View>

            {/* Base de calcul */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Base de calcul *
              </Text>
              <Select
                value={formData.dayCountBasis}
                onValueChange={(value: string) => {
                  setFormData((prev) => ({ ...prev, dayCountBasis: value as "ACT_360" | "ACT_365" }));
                }}
                options={[
                  { label: "ACT/360", value: "ACT_360" },
                  { label: "ACT/365", value: "ACT_365" },
                ]}
                disabled={!!isRenewing || !!editingDat}
              />
            </View>

            {/* Date de début */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Date de début *
              </Text>
              <TextInput
                value={formData.startDate}
                onChangeText={(text) => {
                  setFormData((prev) => ({ ...prev, startDate: text }));
                }}
                placeholder="YYYY-MM-DD"
                className={`px-3 py-2 rounded-lg border ${isDark ? "bg-[#1e293b] border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
              />
            </View>

            {/* Date d'échéance */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Date d'échéance *
              </Text>
              <TextInput
                value={formData.maturityDate}
                onChangeText={(text) => {
                  setFormData((prev) => ({ ...prev, maturityDate: text }));
                }}
                placeholder="YYYY-MM-DD"
                editable={false}
                className={`px-3 py-2 rounded-lg border ${isDark ? "bg-[#1e293b] border-gray-700 text-gray-400" : "bg-gray-100 border-gray-300 text-gray-500"}`}
              />
            </View>

            {/* Numéro de compte */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Numéro de compte
              </Text>
              <TextInput
                value={formData.accountNumber}
                onChangeText={(text) => {
                  setFormData((prev) => ({ ...prev, accountNumber: text }));
                }}
                placeholder="Optionnel"
                className={`px-3 py-2 rounded-lg border ${isDark ? "bg-[#1e293b] border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
              />
            </View>

            {/* Description */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Description
              </Text>
              <TextInput
                value={formData.description}
                onChangeText={(text) => {
                  setFormData((prev) => ({ ...prev, description: text }));
                }}
                placeholder="Optionnel"
                multiline
                numberOfLines={3}
                className={`px-3 py-2 rounded-lg border ${isDark ? "bg-[#1e293b] border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
              />
            </View>

            {/* Boutons d'action */}
            <View className="flex-row gap-2 mt-4">
              <Button
                onPress={() => {
                  setShowDatForm(false);
                  setEditingDat(null);
                  setIsRenewing(false);
                  setRenewalTransactionId(null);
                  setMobilizedBalance(null);
                }}
                variant="outline"
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onPress={handleSubmitDat}
                disabled={isSubmitting}
                className="flex-1"
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : isRenewing ? (
                  "Renouveler"
                ) : editingDat ? (
                  "Modifier"
                ) : (
                  "Créer"
                )}
              </Button>
            </View>
          </View>
        </ScrollView>
      </Drawer>

      {/* Drawer de détails DAT */}
      <Drawer
        open={showDetailsDrawer}
        onOpenChange={(open) => {
          setShowDetailsDrawer(open);
          if (!open) {
            setSelectedDat(null);
          }
        }}
        title="Détails du DAT"
      >
        {selectedDat && (
          <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
            <View className="gap-4 pb-4">
              <View className="gap-2">
                <Text className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Entreprise
                </Text>
                <Text className={`text-base ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                  {selectedDat.company.name}
                </Text>
              </View>
              <View className="gap-2">
                <Text className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Banque
                </Text>
                <Text className={`text-base ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                  {selectedDat.bankName}
                </Text>
              </View>
              <View className="gap-2">
                <Text className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Montant
                </Text>
                <BlurredAmount
                  amount={selectedDat.amount}
                  currency={selectedDat.currency}
                  className={`text-base font-semibold ${isDark ? "text-gray-100" : "text-gray-900"}`}
                />
              </View>
              <View className="gap-2">
                <Text className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Taux d'intérêt
                </Text>
                <Text className={`text-base ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                  {selectedDat.interestRate}%
                </Text>
              </View>
              <View className="gap-2">
                <Text className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Durée
                </Text>
                <Text className={`text-base ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                  {selectedDat.durationMonths} mois
                </Text>
              </View>
              <View className="gap-2">
                <Text className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Date de début
                </Text>
                <Text className={`text-base ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                  {formatDate(selectedDat.startDate)}
                </Text>
              </View>
              <View className="gap-2">
                <Text className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Date d'échéance
                </Text>
                <Text className={`text-base ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                  {formatDate(selectedDat.maturityDate)}
                </Text>
              </View>
              {selectedDat.accountNumber && (
                <View className="gap-2">
                  <Text className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    Numéro de compte
                  </Text>
                  <Text className={`text-base ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                    {selectedDat.accountNumber}
                  </Text>
                </View>
              )}
              {selectedDat.description && (
                <View className="gap-2">
                  <Text className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                    Description
                  </Text>
                  <Text className={`text-base ${isDark ? "text-gray-100" : "text-gray-900"}`}>
                    {selectedDat.description}
                  </Text>
                </View>
              )}
              {selectedDat.datAccount && (
                <>
                  <View className="gap-2">
                    <Text className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                      Intérêts générés
                    </Text>
                    <BlurredAmount
                      amount={selectedDat.datAccount.totalInterest}
                      currency={selectedDat.currency}
                      className={`text-base font-semibold ${isDark ? "text-gray-100" : "text-gray-900"}`}
                    />
                  </View>
                  <View className="gap-2">
                    <Text className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                      Total transféré
                    </Text>
                    <BlurredAmount
                      amount={selectedDat.datAccount.totalTransferred}
                      currency={selectedDat.currency}
                      className={`text-base font-semibold ${isDark ? "text-gray-100" : "text-gray-900"}`}
                    />
                  </View>
                  {selectedDat.datAccount.totalInterest > 0 && canUpdate && (
                    <Button
                      onPress={async () => {
                        // Rafraîchir les données du compte DAT pour avoir les valeurs à jour
                        try {
                          const accountResponse = await api.get(`/api/dat/${selectedDat.id}/account`);
                          if (accountResponse.data) {
                            setSelectedDat({
                              ...selectedDat,
                              datAccount: accountResponse.data,
                            });
                          }
                        } catch (err) {
                          // Ignore error, on utilise les données existantes
                        }
                        setShowTransferDrawer(true);
                      }}
                      className="mt-2"
                    >
                      Transférer les intérêts
                    </Button>
                  )}
                </>
              )}
            </View>
          </ScrollView>
        )}
      </Drawer>

      {/* Drawer de transfert d'intérêts */}
      <Drawer
        open={showTransferDrawer}
        onOpenChange={(open) => {
          setShowTransferDrawer(open);
          if (!open) {
            setTransferAmount("");
          }
        }}
        title="Transférer les intérêts"
      >
        {selectedDat && selectedDat.datAccount && (() => {
          // Calculer l'intérêt disponible (totalInterest - totalTransferred)
          const availableInterest = (selectedDat.datAccount!.totalInterest || 0) - (selectedDat.datAccount!.totalTransferred || 0);
          
          return (
            <View className="gap-4">
              <View className="gap-2">
                <Text className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Intérêts disponibles
                </Text>
                <BlurredAmount
                  amount={availableInterest}
                  currency={selectedDat.currency}
                  className={`text-2xl font-bold ${isDark ? "text-gray-100" : "text-gray-900"}`}
                />
                {selectedDat.datAccount!.totalTransferred > 0 && (
                  <Text className={`text-xs mt-1 ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    Total généré: {(selectedDat.datAccount!.totalInterest || 0).toLocaleString("fr-FR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} {selectedDat.currency} - Déjà transféré: {(selectedDat.datAccount!.totalTransferred || 0).toLocaleString("fr-FR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} {selectedDat.currency}
                  </Text>
                )}
              </View>
              <View>
                <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                  Montant à transférer (laisser vide pour tout transférer)
                </Text>
                <TextInput
                  value={transferAmount}
                  onChangeText={(text) => {
                    // Permettre la saisie libre, la validation se fera lors de la soumission
                    // Accepter les nombres, les points et les virgules pour la saisie (format français et anglais)
                    if (text === "" || /^[0-9]*[,.]?[0-9]*$/.test(text)) {
                      // Remplacer la virgule par un point pour le traitement
                      const normalizedText = text.replace(",", ".");
                      setTransferAmount(normalizedText);
                    }
                  }}
                  placeholder={availableInterest > 0 ? availableInterest.toString() : "0"}
                  keyboardType="decimal-pad"
                  className={`px-3 py-2 rounded-lg border ${isDark ? "bg-[#1e293b] border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
                />
                {transferAmount && parseFloat(transferAmount) > availableInterest && (
                  <Text className={`text-xs mt-1 ${isDark ? "text-red-400" : "text-red-600"}`}>
                    Le montant ne peut pas dépasser {availableInterest.toLocaleString("fr-FR", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })} {selectedDat.currency}
                  </Text>
                )}
              </View>
              <View className="flex-row gap-2 mt-4">
                <Button
                  onPress={() => {
                    setShowTransferDrawer(false);
                    setTransferAmount("");
                  }}
                  variant="outline"
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onPress={() => handleTransfer()}
                  disabled={isTransferring}
                  className="flex-1"
                >
                  {isTransferring ? (
                    <ActivityIndicator size="small" color="#ffffff" />
                  ) : (
                    "Transférer"
                  )}
                </Button>
              </View>
            </View>
          );
        })()}
      </Drawer>

      {/* Drawer de confirmation de suppression */}
      <Drawer
        open={showDeleteDrawer}
        onOpenChange={(open) => {
          setShowDeleteDrawer(open);
          if (!open) {
            setDatToDelete(null);
            setDeleteConfirmation("");
          }
        }}
        title="Supprimer le DAT"
      >
        {datToDelete && (
          <View className="gap-4">
            <Text className={`text-base ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Êtes-vous sûr de vouloir supprimer ce DAT ? Cette action est irréversible.
            </Text>
            <View className="gap-2">
              <Text className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Banque: {datToDelete.bankName}
              </Text>
              <Text className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Entreprise: {datToDelete.company.name}
              </Text>
              <BlurredAmount
                amount={datToDelete.amount}
                currency={datToDelete.currency}
                className={`text-base font-semibold ${isDark ? "text-gray-100" : "text-gray-900"}`}
              />
            </View>
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Tapez "{datToDelete.bankName} - {datToDelete.amount.toLocaleString("fr-FR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} {datToDelete.currency || "GNF"}" pour confirmer
              </Text>
              <TextInput
                value={deleteConfirmation}
                onChangeText={setDeleteConfirmation}
                placeholder="Confirmation"
                className={`px-3 py-2 rounded-lg border ${isDark ? "bg-[#1e293b] border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
              />
            </View>
            <View className="flex-row gap-2 mt-4">
              <Button
                onPress={() => {
                  setShowDeleteDrawer(false);
                  setDatToDelete(null);
                  setDeleteConfirmation("");
                }}
                variant="outline"
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onPress={confirmDelete}
                disabled={isDeleting}
                variant="destructive"
                className="flex-1"
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

      {/* Drawer de confirmation d'arrêt */}
      <Drawer
        open={showStopConfirm}
        onOpenChange={(open) => {
          setShowStopConfirm(open);
          if (!open) {
            setDatToStop(null);
          }
        }}
        title="Arrêter le DAT"
      >
        {datToStop && (
          <View className="gap-4">
            <Text className={`text-base ${isDark ? "text-gray-300" : "text-gray-700"}`}>
              Êtes-vous sûr de vouloir arrêter ce DAT à l'échéance ? Il ne sera pas renouvelé automatiquement.
            </Text>
            <View className="gap-2">
              <Text className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Banque: {datToStop.bankName}
              </Text>
              <Text className={`text-sm font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Entreprise: {datToStop.company.name}
              </Text>
              <BlurredAmount
                amount={datToStop.amount}
                currency={datToStop.currency}
                className={`text-base font-semibold ${isDark ? "text-gray-100" : "text-gray-900"}`}
              />
            </View>
            <View className="flex-row gap-2 mt-4">
              <Button
                onPress={() => {
                  setShowStopConfirm(false);
                  setDatToStop(null);
                }}
                variant="outline"
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onPress={confirmStop}
                disabled={isStopping}
                className="flex-1"
              >
                {isStopping ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  "Confirmer"
                )}
              </Button>
            </View>
          </View>
        )}
      </Drawer>

      {/* Modal de simulation */}
      <Drawer
        open={showSimulationModal}
        onOpenChange={(open) => {
          setShowSimulationModal(open);
          if (!open) {
            setSimulationResults(null);
          }
        }}
        title="Simulation DAT"
      >
        <View className="gap-4 pb-4">
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Montant
              </Text>
              <TextInput
                value={simulationData.amount}
                onChangeText={(text) => {
                  setSimulationData((prev) => ({ ...prev, amount: text }));
                }}
                placeholder="0.00"
                keyboardType="numeric"
                className={`px-3 py-2 rounded-lg border ${isDark ? "bg-[#1e293b] border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
              />
            </View>
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Taux d'intérêt (%)
              </Text>
              <TextInput
                value={simulationData.interestRate}
                onChangeText={(text) => {
                  setSimulationData((prev) => ({ ...prev, interestRate: text }));
                }}
                placeholder="0.00"
                keyboardType="numeric"
                className={`px-3 py-2 rounded-lg border ${isDark ? "bg-[#1e293b] border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
              />
            </View>
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Durée (mois)
              </Text>
              <TextInput
                value={simulationData.durationMonths}
                onChangeText={(text) => {
                  setSimulationData((prev) => ({ ...prev, durationMonths: text }));
                }}
                placeholder="3"
                keyboardType="numeric"
                className={`px-3 py-2 rounded-lg border ${isDark ? "bg-[#1e293b] border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
              />
            </View>
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Fréquence de versement
              </Text>
              <Select
                value={simulationData.interestPaymentFrequency}
                onValueChange={(value: string) => {
                  setSimulationData((prev) => ({ ...prev, interestPaymentFrequency: value as "MONTHLY" | "QUARTERLY" | "AT_MATURITY" }));
                }}
                options={[
                  { label: "À l'échéance", value: "AT_MATURITY" },
                  { label: "Mensuel", value: "MONTHLY" },
                  { label: "Trimestriel", value: "QUARTERLY" },
                ]}
              />
            </View>
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Base de calcul
              </Text>
              <Select
                value={simulationData.dayCountBasis}
                onValueChange={(value: string) => {
                  setSimulationData((prev) => ({ ...prev, dayCountBasis: value as "ACT_360" | "ACT_365" }));
                }}
                options={[
                  { label: "ACT/360", value: "ACT_360" },
                  { label: "ACT/365", value: "ACT_365" },
                ]}
              />
            </View>
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                Date de début
              </Text>
              <TextInput
                value={simulationData.startDate}
                onChangeText={(text) => {
                  setSimulationData((prev) => ({ ...prev, startDate: text }));
                }}
                placeholder="YYYY-MM-DD"
                className={`px-3 py-2 rounded-lg border ${isDark ? "bg-[#1e293b] border-gray-700 text-gray-100" : "bg-white border-gray-300 text-gray-900"}`}
              />
            </View>

            <Button
              onPress={() => {
                if (simulationData.amount && simulationData.interestRate && simulationData.durationMonths) {
                  const results = calculateSimulation();
                  setSimulationResults(results);
                } else {
                  Alert.alert("Erreur", "Veuillez remplir tous les champs obligatoires (Montant, Taux d'intérêt, Durée)");
                }
              }}
              className="mt-4"
              disabled={!simulationData.amount || !simulationData.interestRate || !simulationData.durationMonths}
            >
              Calculer
            </Button>

            {simulationResults && (
              <View className="mt-4 gap-4">
                {/* Résumé principal en cartes */}
                <View className="gap-3">
                  {/* Montant final - Carte principale */}
                  <View
                    className={`p-5 rounded-xl border-2 ${
                      isDark
                        ? "bg-gradient-to-br from-blue-900/30 to-blue-800/20 border-blue-700/50"
                        : "bg-gradient-to-br from-blue-50 to-blue-100/50 border-blue-200"
                    }`}
                    style={{
                      backgroundColor: isDark ? "#1e3a8a30" : "#dbeafe",
                      borderColor: isDark ? "#1e40af80" : "#bfdbfe",
                    }}
                  >
                    <Text className={`text-xs font-medium mb-2 uppercase tracking-wide ${isDark ? "text-blue-300" : "text-blue-700"}`}>
                      Montant final
                    </Text>
                    <BlurredAmount
                      amount={simulationResults.finalAmount}
                      currency={simulationData.currency}
                      className={`text-3xl font-bold ${isDark ? "text-blue-200" : "text-blue-900"}`}
                    />
                    <View className="flex-row items-center gap-2 mt-2">
                      <View className={`px-2 py-1 rounded-full ${isDark ? "bg-blue-900/40" : "bg-blue-200/60"}`}>
                        <Text className={`text-xs font-medium ${isDark ? "text-blue-200" : "text-blue-800"}`}>
                          Capital: {parseFloat(simulationData.amount || "0").toLocaleString("fr-FR", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })} {simulationData.currency}
                        </Text>
                      </View>
                    </View>
                  </View>

                  {/* Grille de statistiques */}
                  <View className="flex-row gap-3">
                    {/* Intérêts totaux */}
                    <View
                      className={`flex-1 p-4 rounded-xl border ${
                        isDark
                          ? "bg-green-900/20 border-green-700/50"
                          : "bg-green-50 border-green-200"
                      }`}
                    >
                      <Text className={`text-xs font-medium mb-2 ${isDark ? "text-green-300" : "text-green-700"}`}>
                        Intérêts totaux
                      </Text>
                      <BlurredAmount
                        amount={simulationResults.totalInterest}
                        currency={simulationData.currency}
                        className={`text-xl font-bold ${isDark ? "text-green-200" : "text-green-900"}`}
                      />
                    </View>

                    {/* Date d'échéance */}
                    <View
                      className={`flex-1 p-4 rounded-xl border ${
                        isDark
                          ? "bg-purple-900/20 border-purple-700/50"
                          : "bg-purple-50 border-purple-200"
                      }`}
                    >
                      <Text className={`text-xs font-medium mb-2 ${isDark ? "text-purple-300" : "text-purple-700"}`}>
                        Date d'échéance
                      </Text>
                      <Text className={`text-lg font-bold ${isDark ? "text-purple-200" : "text-purple-900"}`}>
                        {formatDate(simulationResults.maturityDate.toISOString().split("T")[0])}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Calendrier de versement */}
                {simulationResults.payments.length > 0 && (
                  <View className="gap-3 mt-2">
                    <Text className={`text-base font-semibold mb-2 ${isDark ? "text-gray-200" : "text-gray-800"}`}>
                      Calendrier de versement
                    </Text>
                    <View className="gap-2">
                      {simulationResults.payments.map((payment, index) => (
                        <View
                          key={index}
                          className={`p-4 rounded-lg border ${
                            isDark
                              ? "bg-[#1e293b] border-gray-700"
                              : "bg-white border-gray-200"
                          }`}
                        >
                          <View className="flex-row items-center justify-between mb-2">
                            <View className="flex-row items-center gap-2">
                              <View className={`w-2 h-2 rounded-full ${isDark ? "bg-blue-400" : "bg-blue-600"}`} />
                              <Text className={`text-sm font-semibold ${isDark ? "text-gray-200" : "text-gray-900"}`}>
                                {payment.period}
                              </Text>
                            </View>
                            <BlurredAmount
                              amount={payment.interest}
                              currency={simulationData.currency}
                              className={`text-base font-bold ${isDark ? "text-blue-300" : "text-blue-700"}`}
                            />
                          </View>
                          <View className="flex-row items-center gap-2">
                            <Text className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                              {formatDate(payment.periodStart.toISOString().split("T")[0])}
                            </Text>
                            <Text className={`text-xs ${isDark ? "text-gray-500" : "text-gray-500"}`}>→</Text>
                            <Text className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                              {formatDate(payment.periodEnd.toISOString().split("T")[0])}
                            </Text>
                            <View className={`px-2 py-0.5 rounded-full ${isDark ? "bg-gray-700" : "bg-gray-200"}`}>
                              <Text className={`text-xs font-medium ${isDark ? "text-gray-300" : "text-gray-700"}`}>
                                {payment.days} jours
                              </Text>
                            </View>
                          </View>
                        </View>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}
          </View>
      </Drawer>
        </View>
    </SafeAreaView>
  );
}
