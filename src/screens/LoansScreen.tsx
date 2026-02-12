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
  FlatList,
  Modal,
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
  ReverseWithdrawal02Icon,
  MoneySend01Icon,
  MoneyExchange03Icon,
  EyeIcon,
  CalculatorIcon,
  Copy01Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
  AttachmentIcon,
} from "@hugeicons/core-free-icons";
import { LoansSkeleton } from "@/components/skeletons/LoansSkeleton";
import { ScreenHeader } from "@/components/ScreenHeader";
import { BlurredAmount } from "@/components/BlurredAmount";
import { TAB_BAR_PADDING_BOTTOM, REFRESH_CONTROL_COLOR } from "@/constants/layout";
import { Drawer } from "@/components/ui/Drawer";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { formatIntegerInput, formatDecimalInput } from "@/utils/numeric-input";
import { readExcelFromBase64, parseCSVToJson } from "@/utils/excel-secure";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import { getErrorMessage } from "@/utils/get-error-message";

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

interface Loan {
  id: string;
  amount: number;
  currency: string;
  interestRate: number | null;
  startDate: string;
  endDate: string | null;
  status: string;
  bankId?: string | null;
  bankName?: string | null;
  bank?: {
    id: string;
    name: string;
  } | null;
  description?: string | null;
  createdAt: string;
  durationMonths?: number | null;
  repaymentFrequency?: "MONTHLY" | "QUARTERLY" | null;
  rateType?: "FIXED" | "VARIABLE" | null;
  dayCountBasis?: "ACT_360" | "ACT_365" | null;
  repaymentType?: "AMORTIZABLE" | "IN_FINE" | null;
  amortizationMethod?: "CONSTANT_PAYMENT" | "CONSTANT_CAPITAL" | null;
  roundingRule?: "ROUND_EACH" | "ROUND_END" | "ADJUST_LAST" | null;
  dateRule?: "EXCLUDE_START" | "INCLUDE_START" | null;
  scheduleSource?: "CALCULATED" | "PROVIDED_BY_BANK" | null;
  initialBankFees?: number | null;
  initialBankFeesType?: "AMOUNT" | "PERCENTAGE" | null;
  initialBankFeesAddedToCapital?: boolean | null;
  earlyRepaymentPenalty?: number | null;
  gracePeriodMonths?: number | null;
  rateIndex?: string | null;
  company: {
    id: string;
    name: string;
  };
  companyId?: string;
  country?: {
    id: string;
    name: string;
  };
  countryId?: string;
  amortizationStats?: {
    totalAmortized: number;
    remainingBalance: number;
    totalInterestPaid?: number;
    totalPaid?: number;
  };
  investedAmount?: number;
  createdBy?: {
    id: string;
    name: string;
    email: string;
    role?: {
      id: string;
      name: string;
    };
  };
}

interface Company {
  id: string;
  name: string;
  currency?: string;
  country: {
    id: string;
    name: string;
  };
  activitySectorId?: string;
  activitySector?: {
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

interface LoanInstallment {
  id: string;
  installmentNumber: number;
  dueDate: string;
  principalAmount: number;
  interestAmount: number;
  totalPayment: number;
  remainingPrincipal: number;
  status: "PENDING" | "PAID" | "OVERDUE";
  paidAt?: string | null;
  paidBy?: {
    id: string;
    name: string;
    email: string;
  } | null;
  expenseId?: string | null;
}

// Fonction pour vérifier si une transaction peut être annulée (moins de 24h)
const canCancelTransaction = (createdAt: string): boolean => {
  const now = new Date();
  const created = new Date(createdAt);
  const diffInMs = now.getTime() - created.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);
  return diffInHours < 24;
};

// Fonction pour vérifier si un paiement d'échéance peut être annulé (plus de 24h après)
const canReverseInstallmentPayment = (paidAt: string | null | undefined): boolean => {
  if (!paidAt) return false;
  const now = new Date();
  const paid = new Date(paidAt);
  const diffInMs = now.getTime() - paid.getTime();
  const diffInHours = diffInMs / (1000 * 60 * 60);
  return diffInHours >= 24;
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

export function LoansScreen() {
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
  // Pas de filtres par statut, entreprise, banque ou devise dans GesFlow
  const [showFiltersModal, setShowFiltersModal] = useState(false);
  const [showLoanForm, setShowLoanForm] = useState(false);
  const [showDeleteDrawer, setShowDeleteDrawer] = useState(false);
  const [showCancelDrawer, setShowCancelDrawer] = useState(false);
  const [showInstallmentsDrawer, setShowInstallmentsDrawer] = useState(false);
  const [showPaymentDrawer, setShowPaymentDrawer] = useState(false);
  const [editingLoan, setEditingLoan] = useState<Loan | null>(null);
  const [loanToDelete, setLoanToDelete] = useState<Loan | null>(null);
  const [loanToCancel, setLoanToCancel] = useState<Loan | null>(null);
  const [loanForInstallments, setLoanForInstallments] = useState<Loan | null>(null);
  const [installmentToPay, setInstallmentToPay] = useState<LoanInstallment | null>(null);
  const [installmentToReverse, setInstallmentToReverse] = useState<LoanInstallment | null>(null);
  const [showReverseDrawer, setShowReverseDrawer] = useState(false);
  const [isReversing, setIsReversing] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [cancelConfirmation, setCancelConfirmation] = useState("");
  const [installments, setInstallments] = useState<LoanInstallment[]>([]);
  const [loadingInstallments, setLoadingInstallments] = useState(false);
  const [generatingSchedule, setGeneratingSchedule] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isManager, setIsManager] = useState(false);
  
  // États pour la simulation d'emprunt
  const [showSimulationModal, setShowSimulationModal] = useState(false);
  const [simulationData, setSimulationData] = useState({
    amount: "",
    currency: "GNF",
    interestRate: "",
    durationMonths: "",
    repaymentFrequency: "MONTHLY" as "MONTHLY" | "QUARTERLY",
    repaymentType: "AMORTIZABLE" as "AMORTIZABLE" | "IN_FINE",
    amortizationMethod: "CONSTANT_PAYMENT" as "CONSTANT_PAYMENT" | "CONSTANT_CAPITAL",
    dayCountBasis: "ACT_360" as "ACT_360" | "ACT_365",
    roundingRule: "ADJUST_LAST" as "ROUND_EACH" | "ROUND_END" | "ADJUST_LAST",
    dateRule: "EXCLUDE_START" as "EXCLUDE_START" | "INCLUDE_START",
    startDate: new Date().toISOString().split("T")[0],
    initialBankFees: "",
    initialBankFeesType: "AMOUNT" as "AMOUNT" | "PERCENTAGE",
    initialBankFeesAddedToCapital: false,
    gracePeriodMonths: "",
  });
  const [simulationResults, setSimulationResults] = useState<{
    totalInterest: number;
    totalToRepay: number;
    schedule: Array<{
      period: string;
      date: Date;
      principal: number;
      interest: number;
      total: number;
      remainingBalance: number;
    }>;
    endDate: Date | null;
    initialBankFees: number;
  } | null>(null);
  
  // États pour le modal de détails
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [selectedSectorId, setSelectedSectorId] = useState<string | null>(null);
  const [companyLoans, setCompanyLoans] = useState<Loan[]>([]);
  const [activitySectors, setActivitySectors] = useState<any[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<Company[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // États pour l'investissement d'emprunt
  const [showInvestLoanDrawer, setShowInvestLoanDrawer] = useState(false);
  const [loanToInvest, setLoanToInvest] = useState<Loan | null>(null);
  const [investmentAmount, setInvestmentAmount] = useState("");
  const [isInvestingLoan, setIsInvestingLoan] = useState(false);

  // Refs pour le scroll synchronisé du tableau des échéanciers
  const installmentHeaderScrollRef = useRef<ScrollView>(null);
  const installmentContentScrollRefs = useRef<Map<string, ScrollView>>(new Map());
  const installmentScrollXRef = useRef(0);
  const installmentIsScrollingRef = useRef(false);

  // Largeurs des colonnes pour le tableau des échéanciers
  const installmentColumnWidths = useMemo(() => ({
    number: 80,
    date: 120,
    principal: 120,
    interest: 120,
    total: 120,
    status: 100,
    actions: 100,
  }), []);

  const totalInstallmentTableWidth = useMemo(() => {
    return Object.values(installmentColumnWidths).reduce((a, b) => a + b, 0);
  }, [installmentColumnWidths]);

  // État du formulaire
  const [formData, setFormData] = useState({
    companyId: "",
    countryId: "",
    bankId: "",
    amount: "",
    scheduleSource: "CALCULATED" as "CALCULATED" | "PROVIDED_BY_BANK",
    interestRate: "",
    durationMonths: "",
    repaymentFrequency: "MONTHLY" as "MONTHLY" | "QUARTERLY",
    rateType: "FIXED" as "FIXED" | "VARIABLE",
    dayCountBasis: "ACT_360" as "ACT_360" | "ACT_365",
    repaymentType: "AMORTIZABLE" as "AMORTIZABLE" | "IN_FINE",
    amortizationMethod: "CONSTANT_PAYMENT" as "CONSTANT_PAYMENT" | "CONSTANT_CAPITAL",
    repaymentBankId: "",
    startDate: "",
    initialBankFeesType: "" as "" | "AMOUNT" | "PERCENTAGE",
    initialBankFees: "",
    initialBankFeesAddedToCapital: false,
    roundingRule: "ADJUST_LAST" as "ROUND_EACH" | "ROUND_END" | "ADJUST_LAST",
    dateRule: "EXCLUDE_START" as "EXCLUDE_START" | "INCLUDE_START",
    status: "DRAFT" as "DRAFT" | "ACTIVE" | "PAID" | "CANCELLED",
    description: "",
  });

  // États de loading
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isPaying, setIsPaying] = useState(false);
  const [isImportingSchedule, setIsImportingSchedule] = useState(false);
  const [importedInstallments, setImportedInstallments] = useState<any[]>([]);

  // Refs pour synchroniser le scroll (DOIT être avant tout return conditionnel)
  const headerScrollRef = useRef<ScrollView>(null);
  const contentScrollRefs = useRef<Map<string, ScrollView>>(new Map());
  const scrollXRef = useRef(0);
  const isScrollingRef = useRef(false);

  // Largeurs des colonnes (DOIT être avant tout return conditionnel) - Conformes à GesFlow
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

  const canView = hasPermission('loans.view');
  const canCreate = hasPermission('loans.create');
  const canUpdate = hasPermission('loans.update');
  const canDelete = hasPermission('loans.delete');

  // Récupérer l'ID de l'utilisateur actuel et vérifier si c'est un manager
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        const user = await authService.getCurrentUser();
        if (user) {
          setCurrentUserId(user.id);
          
          // Vérifier si l'utilisateur est un gestionnaire
          const roleName = user?.role?.name?.toLowerCase() || "";
          const isManagerRole =
            roleName.includes("gestionnaire") || roleName.includes("manager");
          setIsManager(isManagerRole);
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
        const response = await api.get("/api/banks");
        return response.data;
      } catch (err) {
        return [];
      }
    },
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

    // Séparer les banques du même pays et les autres
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

    // Combiner : d'abord celles du même pays, puis les autres
    const allBanks = [...banksSameCountry, ...banksOtherCountries];

    return allBanks.map((bank: Bank) => ({
      label: bank.name + (bank.country ? ` (${bank.country.name})` : ''),
      value: bank.id,
      bank: bank,
    }));
  }, [banks, formData.companyId, companies]);

  const { data: loans, isLoading, error, refetch } = useQuery({
    queryKey: ['loans'],
    queryFn: async () => {
      try {
        const response = await api.get('/api/loans');
        return response.data;
      } catch (err: any) {
        throw err;
      }
    },
    enabled: canView,
  });

  // Filtrer les emprunts
  const filteredLoans = useMemo(() => {
    if (!loans) return [];

    return loans.filter((loan: Loan) => {
      // Filtre par recherche textuelle (par nom d'entreprise uniquement, comme dans GesFlow)
      const matchesSearch = loan.company?.name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) || false;

      // Filtre par montant
      const amount = loan.amount;
      const matchesMinAmount = !minAmount || (!isNaN(parseFloat(minAmount)) && amount >= parseFloat(minAmount));
      const matchesMaxAmount = !maxAmount || (!isNaN(parseFloat(maxAmount)) && amount <= parseFloat(maxAmount));

      // Filtre par dates (date de début de l'emprunt)
      const loanStartDate = new Date(loan.startDate);
      const matchesStartDate = !startDate || loanStartDate >= new Date(startDate);
      const matchesEndDate = !endDate || loanStartDate <= new Date(endDate);

      return (
        matchesSearch &&
        matchesMinAmount &&
        matchesMaxAmount &&
        matchesStartDate &&
        matchesEndDate
      );
    });
  }, [
    loans,
    searchTerm,
    startDate,
    endDate,
    minAmount,
    maxAmount,
  ]);

  // Synchroniser le scroll entre header et contenu (DOIT être avant tout return conditionnel)
  const handleContentScroll = useCallback((event: any, loanId?: string) => {
    if (isScrollingRef.current) return;

    const offsetX = event.nativeEvent.contentOffset.x;
    scrollXRef.current = offsetX;
    isScrollingRef.current = true;

    if (headerScrollRef.current) {
      headerScrollRef.current.scrollTo({ x: offsetX, animated: false });
    }

    contentScrollRefs.current.forEach((ref, id) => {
      if (id !== loanId && ref) {
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

  // Handlers pour le scroll synchronisé du tableau des échéanciers (DOIT être avant tout return conditionnel)
  const handleInstallmentHeaderScroll = useCallback((event: any) => {
    if (installmentIsScrollingRef.current) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    installmentScrollXRef.current = offsetX;
    installmentIsScrollingRef.current = true;
    installmentContentScrollRefs.current.forEach((ref) => {
      if (ref) {
        ref.scrollTo({ x: offsetX, animated: false });
      }
    });
    setTimeout(() => {
      installmentIsScrollingRef.current = false;
    }, 100);
  }, []);

  const handleInstallmentContentScroll = useCallback((event: any, installmentId?: string) => {
    if (installmentIsScrollingRef.current) return;
    const offsetX = event.nativeEvent.contentOffset.x;
    installmentScrollXRef.current = offsetX;
    installmentIsScrollingRef.current = true;
    if (installmentHeaderScrollRef.current) {
      installmentHeaderScrollRef.current.scrollTo({ x: offsetX, animated: false });
    }
    installmentContentScrollRefs.current.forEach((ref, id) => {
      if (id !== installmentId && ref) {
        ref.scrollTo({ x: offsetX, animated: false });
      }
    });
    setTimeout(() => {
      installmentIsScrollingRef.current = false;
    }, 100);
  }, []);

  // Fonction de calcul de simulation d'emprunt
  const calculateLoanSimulation = useCallback(() => {
    const amount = parseFloat(simulationData.amount) || 0;
    const interestRate = parseFloat(simulationData.interestRate) || 0;
    const durationMonths = parseInt(simulationData.durationMonths) || 0;
    const startDate = new Date(simulationData.startDate);
    const endDate = new Date(startDate);
    endDate.setMonth(endDate.getMonth() + durationMonths);
    
    // Calculer les frais initiaux selon le type (montant ou pourcentage)
    let initialBankFees = 0;
    if (simulationData.initialBankFees) {
      if (simulationData.initialBankFeesType === "PERCENTAGE") {
        initialBankFees = (amount * parseFloat(simulationData.initialBankFees)) / 100;
      } else {
        initialBankFees = parseFloat(simulationData.initialBankFees) || 0;
      }
    }
    
    const gracePeriodMonths = parseInt(simulationData.gracePeriodMonths) || 0;

    if (!amount || !interestRate || !durationMonths) {
      return {
        totalInterest: 0,
        totalToRepay: amount,
        schedule: [],
        endDate: null,
        initialBankFees: 0,
      };
    }

    // Calculer le capital effectif (avec frais intégrés si applicable)
    const effectiveAmount = simulationData.initialBankFeesAddedToCapital && initialBankFees > 0
      ? amount + initialBankFees
      : amount;

    // Calculer le nombre de périodes selon la fréquence
    const periodsPerYear = simulationData.repaymentFrequency === "MONTHLY" ? 12 : 4;
    const totalPeriods = Math.ceil((durationMonths / 12) * periodsPerYear);
    const effectivePeriods = totalPeriods - Math.ceil((gracePeriodMonths / 12) * periodsPerYear);
    
    // Taux par période (convertir le taux annuel en taux par période)
    const periodRate = (interestRate / 100) / periodsPerYear;
    
    const schedule: Array<{
      period: string;
      date: Date;
      principal: number;
      interest: number;
      total: number;
      remainingBalance: number;
    }> = [];
    
    let remainingPrincipal = effectiveAmount;
    const daysInYear = simulationData.dayCountBasis === "ACT_365" ? 365 : 360;
    
    // Calculer la mensualité constante (formule standard)
    let paymentAmount = 0;
    if (simulationData.repaymentType === "AMORTIZABLE" && simulationData.amortizationMethod === "CONSTANT_PAYMENT") {
      if (periodRate > 0) {
        paymentAmount = effectiveAmount * (periodRate * Math.pow(1 + periodRate, effectivePeriods)) / (Math.pow(1 + periodRate, effectivePeriods) - 1);
      } else {
        paymentAmount = effectiveAmount / effectivePeriods;
      }
    } else if (simulationData.repaymentType === "AMORTIZABLE" && simulationData.amortizationMethod === "CONSTANT_CAPITAL") {
      paymentAmount = effectiveAmount / effectivePeriods;
    } else {
      // IN_FINE: on ne rembourse que les intérêts, le capital à la fin
      paymentAmount = effectiveAmount * periodRate;
    }
    
    // Générer l'échéancier
    let currentDate = new Date(startDate);
    for (let i = 1; i <= totalPeriods; i++) {
      // Période de grâce: on ne paie que les intérêts
      const isGracePeriod = i <= Math.ceil((gracePeriodMonths / 12) * periodsPerYear);
      
      let interestAmount = 0;
      let principalAmount = 0;
      
      if (simulationData.repaymentType === "IN_FINE") {
        // In fine: on paie seulement les intérêts, le capital à la fin
        interestAmount = effectiveAmount * periodRate;
        principalAmount = i === totalPeriods ? effectiveAmount : 0;
      } else if (isGracePeriod) {
        // Période de grâce: seulement les intérêts
        interestAmount = remainingPrincipal * periodRate;
        principalAmount = 0;
      } else if (simulationData.amortizationMethod === "CONSTANT_CAPITAL") {
        // Capital constant
        principalAmount = effectiveAmount / effectivePeriods;
        interestAmount = remainingPrincipal * periodRate;
      } else {
        // Mensualité constante
        interestAmount = remainingPrincipal * periodRate;
        principalAmount = paymentAmount - interestAmount;
        if (i === totalPeriods) {
          // Ajuster la dernière échéance pour le solde restant
          principalAmount = remainingPrincipal;
        }
      }
      
      // Arrondir selon la règle
      if (simulationData.roundingRule === "ROUND_EACH" || simulationData.roundingRule === "ADJUST_LAST") {
        interestAmount = Math.round(interestAmount * 100) / 100;
        principalAmount = Math.round(principalAmount * 100) / 100;
      }
      
      const totalPayment = principalAmount + interestAmount;
      remainingPrincipal -= principalAmount;
      
      if (i === totalPeriods && simulationData.roundingRule === "ADJUST_LAST") {
        // Ajuster la dernière échéance pour que le solde soit exactement 0
        const adjustment = remainingPrincipal;
        principalAmount += adjustment;
        remainingPrincipal = 0;
      }
      
      // Calculer la date de l'échéance
      const installmentDate = new Date(currentDate);
      if (simulationData.repaymentFrequency === "MONTHLY") {
        installmentDate.setMonth(installmentDate.getMonth() + i);
      } else {
        installmentDate.setMonth(installmentDate.getMonth() + (i * 3));
      }
      
      schedule.push({
        period: simulationData.repaymentFrequency === "MONTHLY" 
          ? `Mois ${i}` 
          : `Trimestre ${Math.ceil(i / 3)}`,
        date: installmentDate,
        principal: principalAmount,
        interest: interestAmount,
        total: totalPayment,
        remainingBalance: Math.max(0, remainingPrincipal),
      });
    }

    // Calculer le total des intérêts
    const totalInterest = schedule.reduce((sum, inst) => sum + inst.interest, 0);

    return {
      totalInterest,
      totalToRepay: effectiveAmount + totalInterest + (simulationData.initialBankFeesAddedToCapital ? 0 : initialBankFees),
      schedule,
      endDate,
      initialBankFees,
    };
  }, [simulationData]);

  // Fonction pour charger les détails des emprunts
  const loadDetailsLoans = useCallback(async (companyId?: string | null, sectorId?: string | null) => {
    try {
      setLoadingDetails(true);
      let url = "/api/loans?status=ACTIVE";
      if (companyId) {
        url += `&companyId=${companyId}`;
      }
      
      const response = await api.get(url);
      let loansData = response.data || [];
      
      // Filtrer par secteur si nécessaire
      if (sectorId) {
        const sectorCompanies = (companies || []).filter((c: Company) => c.activitySector?.id === sectorId);
        const sectorCompanyIds = sectorCompanies.map((c: Company) => c.id);
        loansData = loansData.filter((loan: Loan) => sectorCompanyIds.includes(loan.company.id));
        
        // Si une entreprise spécifique est sélectionnée, filtrer aussi
        if (companyId) {
          loansData = loansData.filter((loan: Loan) => loan.company.id === companyId);
        }
      } else if (companyId) {
        loansData = loansData.filter((loan: Loan) => loan.company.id === companyId);
      }
      
      setCompanyLoans(loansData);
    } catch (error: any) {
      Alert.alert("Erreur", "Impossible de charger les emprunts");
    } finally {
      setLoadingDetails(false);
    }
  }, [companies]);

  // Fonction pour ouvrir le modal de détails
  const openDetailsModal = useCallback(async (companyId?: string | null, sectorId?: string | null) => {
    setSelectedCompanyId(companyId || null);
    setSelectedSectorId(sectorId || null);
    
    // Filtrer les entreprises par secteur
    if (sectorId) {
      const sectorCompanies = (companies || []).filter((c: Company) => c.activitySector?.id === sectorId);
      setFilteredCompanies(sectorCompanies);
    } else {
      setFilteredCompanies(companies || []);
    }
    
    await loadDetailsLoans(companyId, sectorId);
    setShowDetailsModal(true);
  }, [companies, loadDetailsLoans]);

  // Charger les secteurs d'activité
  useEffect(() => {
    const loadSectors = async () => {
      try {
        const response = await api.get("/api/activity-sectors?isActive=true");
        setActivitySectors(response.data || []);
      } catch (error) {
        // Erreur silencieuse
      }
    };
    loadSectors();
  }, []);

  // Calculer la simulation quand les données changent
  useEffect(() => {
    if (showSimulationModal && simulationData.amount && simulationData.interestRate && simulationData.durationMonths) {
      const results = calculateLoanSimulation();
      setSimulationResults(results);
    } else {
      setSimulationResults(null);
    }
  }, [showSimulationModal, simulationData, calculateLoanSimulation]);

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

  // Vérifier si un emprunt peut être modifié (conditions selon gesflow)
  const canEditLoan = (loan: Loan): boolean => {
    if (!canUpdate) {
      return false;
    }

    // Pas d'action si payé (soldé) ou annulé
    if (loan.status === "PAID" || loan.status === "CANCELLED") {
      return false;
    }

    // Règle des 24h : l'édition n'est possible que dans les 24h après création
    return canCancelTransaction(loan.createdAt);
  };

  // Vérifier si un emprunt peut être annulé (conditions selon gesflow)
  // Note: L'affichage du bouton est géré directement dans le JSX avec canDelete && canCancelTransaction
  const canCancelLoan = (loan: Loan): boolean => {
    // Pas d'action si déjà annulé ou payé (soldé)
    if (loan.status === "CANCELLED" || loan.status === "PAID") {
      return false;
    }

    // Règle des 24h : l'annulation n'est possible que dans les 24h après création
    return canCancelTransaction(loan.createdAt);
  };

  // Fonction pour annuler un emprunt
  const handleCancelLoan = (loan: Loan) => {
    // Vérifier si on peut annuler
    if (!canCancelLoan(loan)) {
      Alert.alert(
        "Impossible d'annuler",
        "Cet emprunt ne peut pas être annulé. Il a peut-être déjà été annulé ou plus de 24h se sont écoulées depuis sa création."
      );
      return;
    }

    setLoanToCancel(loan);
    setCancelConfirmation("");
    setShowCancelDrawer(true);
  };

  const confirmCancel = async () => {
    if (!loanToCancel) return;

    try {
      setIsCancelling(true);
      const id = loanToCancel.id;
      await api.delete(`/api/loans/${id}`, {
        skipAuthError: true,
      });
      setShowCancelDrawer(false);
      setLoanToCancel(null);
      setCancelConfirmation("");
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error: any) {
      Alert.alert("Erreur", getErrorMessage(error, "Impossible d'annuler l'emprunt"));
    } finally {
      setIsCancelling(false);
    }
  };

  // Fonction pour ouvrir le formulaire de création
  const handleCreate = () => {
    if (!canCreate) {
      return;
    }
    setEditingLoan(null);
    const getLocalDateString = (): string => {
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      return `${year}-${month}-${day}`;
    };
    setFormData({
      companyId: "",
      countryId: "",
      bankId: "",
      amount: "",
      scheduleSource: "CALCULATED",
      interestRate: "",
      durationMonths: "",
      repaymentFrequency: "MONTHLY",
      rateType: "FIXED",
      dayCountBasis: "ACT_360",
      repaymentType: "AMORTIZABLE",
      amortizationMethod: "CONSTANT_PAYMENT",
      repaymentBankId: "",
      startDate: getLocalDateString(),
      initialBankFeesType: "",
      initialBankFees: "",
      initialBankFeesAddedToCapital: false,
      roundingRule: "ADJUST_LAST",
      dateRule: "EXCLUDE_START",
      status: "DRAFT",
      description: "",
    });
    setShowLoanForm(true);
  };

  // Fonction pour éditer un emprunt
  const handleEdit = (loan: Loan) => {
    if (!canUpdate) {
      return;
    }
    
    // Vérifier si l'emprunt peut être édité (comme dans GesFlow)
    if (loan.status === "PAID" || loan.status === "CANCELLED") {
      Alert.alert(
        "Impossible d'éditer",
        "Cet emprunt ne peut pas être édité. Il est soldé ou annulé."
      );
      return;
    }
    
    const startDateFormatted = loan.startDate
      ? formatDate(loan.startDate).split('/').reverse().join('-')
      : "";
    const endDateFormatted = loan.endDate
      ? formatDate(loan.endDate).split('/').reverse().join('-')
      : "";

    setFormData({
      companyId: loan.companyId || loan.company?.id || "",
      countryId: loan.countryId || loan.country?.id || "",
      bankId: loan.bankId || loan.bank?.id || "",
      amount: loan.amount.toString(),
      scheduleSource: (loan as any).scheduleSource || "CALCULATED",
      interestRate: loan.interestRate?.toString() || "",
      durationMonths: loan.durationMonths?.toString() || "",
      repaymentFrequency: loan.repaymentFrequency || "MONTHLY",
      rateType: loan.rateType || "FIXED",
      dayCountBasis: loan.dayCountBasis || "ACT_360",
      repaymentType: loan.repaymentType || "AMORTIZABLE",
      amortizationMethod: loan.amortizationMethod || "CONSTANT_PAYMENT",
      repaymentBankId: (loan as any).repaymentBankId || "",
      startDate: startDateFormatted,
      initialBankFeesType: (loan as any).initialBankFeesType || "",
      initialBankFees: (loan as any).initialBankFees?.toString() || "",
      initialBankFeesAddedToCapital: (loan as any).initialBankFeesAddedToCapital || false,
      roundingRule: (loan as any).roundingRule || "ADJUST_LAST",
      dateRule: (loan as any).dateRule || "EXCLUDE_START",
      status: (loan.status || "DRAFT") as "DRAFT" | "ACTIVE" | "PAID" | "CANCELLED",
      description: loan.description || "",
    });
    setEditingLoan(loan);
    setShowLoanForm(true);
  };

  // Fonction pour soumettre le formulaire
  // Fonction pour importer un échéancier depuis un fichier Excel/CSV
  const handleImportSchedule = async () => {
    if (isImportingSchedule) return;

    try {
      setIsImportingSchedule(true);

      // Sélectionner le fichier
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv", "application/vnd.ms-excel"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];

      // Lire le fichier selon son type (exceljs + CSV natif)
      let data: any[];
      if (file.name?.endsWith('.csv') || file.mimeType === 'text/csv') {
        const csvContent = await FileSystem.readAsStringAsync(file.uri);
        data = parseCSVToJson(csvContent);
      } else {
        const fileContent = await FileSystem.readAsStringAsync(file.uri, {
          encoding: 'base64',
        });
        data = await readExcelFromBase64(fileContent);
      }

      if (!data || data.length === 0) {
        Alert.alert("Erreur", "Le fichier est vide ou ne contient pas de données.");
        return;
      }

      // Valider et mapper les colonnes
      const installments: any[] = [];
      const columnMapping: { [key: string]: string } = {
        'numero': 'installmentNumber',
        'numéro': 'installmentNumber',
        'installmentnumber': 'installmentNumber',
        'installment_number': 'installmentNumber',
        'n°': 'installmentNumber',
        'date': 'dueDate',
        'datedue': 'dueDate',
        'due_date': 'dueDate',
        'date_echeance': 'dueDate',
        'date échéance': 'dueDate',
        'principal': 'principalAmount',
        'principalamount': 'principalAmount',
        'principal_amount': 'principalAmount',
        'montant_principal': 'principalAmount',
        'montant principal': 'principalAmount',
        'capital': 'principalAmount',
        'interet': 'interestAmount',
        'interest': 'interestAmount',
        'interestamount': 'interestAmount',
        'interest_amount': 'interestAmount',
        'montant_interet': 'interestAmount',
        'montant intérêt': 'interestAmount',
        'intérêts': 'interestAmount',
        'total': 'totalPayment',
        'totalpayment': 'totalPayment',
        'total_payment': 'totalPayment',
        'montant_total': 'totalPayment',
        'montant total': 'totalPayment',
        'reste': 'remainingPrincipal',
        'remaining': 'remainingPrincipal',
        'remainingprincipal': 'remainingPrincipal',
        'remaining_principal': 'remainingPrincipal',
        'capital_restant': 'remainingPrincipal',
        'capital restant': 'remainingPrincipal',
        'solde': 'remainingPrincipal',
      };

      // Trouver les colonnes dans la première ligne
      const firstRow = data[0];
      const headers = Object.keys(firstRow);
      const mappedHeaders: { [key: string]: string } = {};

      headers.forEach((header) => {
        const normalizedHeader = header.toLowerCase().trim();
        for (const [key, value] of Object.entries(columnMapping)) {
          if (normalizedHeader.includes(key)) {
            mappedHeaders[header] = value;
            break;
          }
        }
      });

      // Valider que les colonnes requises sont présentes
      const requiredFields = ['installmentNumber', 'dueDate', 'principalAmount', 'interestAmount', 'totalPayment', 'remainingPrincipal'];
      const missingFields = requiredFields.filter(field => !Object.values(mappedHeaders).includes(field));

      if (missingFields.length > 0) {
        Alert.alert(
          "Erreur de format",
          `Colonnes manquantes ou non reconnues : ${missingFields.join(', ')}\n\n` +
          "Colonnes attendues :\n" +
          "- Numéro d'échéance (installmentNumber)\n" +
          "- Date d'échéance (dueDate)\n" +
          "- Montant principal (principalAmount)\n" +
          "- Montant intérêts (interestAmount)\n" +
          "- Montant total (totalPayment)\n" +
          "- Capital restant (remainingPrincipal)"
        );
        return;
      }

      // Parser les données
      for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const installment: any = {};

        for (const [originalHeader, mappedField] of Object.entries(mappedHeaders)) {
          const value = row[originalHeader];
          
          if (mappedField === 'installmentNumber') {
            installment.installmentNumber = parseInt(value) || i + 1;
          } else if (mappedField === 'dueDate') {
            // Parser la date (supporter plusieurs formats)
            let dateValue: Date;
            if (typeof value === 'string') {
              // Essayer différents formats de date
              dateValue = new Date(value);
              if (isNaN(dateValue.getTime())) {
                // Essayer format Excel (nombre de jours depuis 1900)
                const excelDate = parseFloat(value);
                if (!isNaN(excelDate)) {
                  const excelEpoch = new Date(1900, 0, 1);
                  dateValue = new Date(excelEpoch.getTime() + (excelDate - 2) * 24 * 60 * 60 * 1000);
                } else {
                  Alert.alert("Erreur", `Date invalide à la ligne ${i + 2}: ${value}`);
                  return;
                }
              }
            } else if (typeof value === 'number') {
              // Format Excel (nombre de jours)
              const excelEpoch = new Date(1900, 0, 1);
              dateValue = new Date(excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000);
            } else {
              Alert.alert("Erreur", `Date invalide à la ligne ${i + 2}`);
              return;
            }
            installment.dueDate = dateValue.toISOString().split('T')[0];
          } else if (['principalAmount', 'interestAmount', 'totalPayment', 'remainingPrincipal'].includes(mappedField)) {
            const numValue = typeof value === 'string' 
              ? parseFloat(value.replace(/[^\d.-]/g, '')) 
              : parseFloat(value);
            installment[mappedField] = isNaN(numValue) ? 0 : numValue;
          }
        }

        if (installment.installmentNumber && installment.dueDate) {
          installments.push(installment);
        }
      }

      if (installments.length === 0) {
        Alert.alert("Erreur", "Aucune échéance valide trouvée dans le fichier.");
        return;
      }

      // Trier par numéro d'échéance
      installments.sort((a, b) => a.installmentNumber - b.installmentNumber);

      // Calculer les informations à partir des échéances
      const firstInstallment = installments[0];
      const lastInstallment = installments[installments.length - 1];
      
      // Montant initial = capital restant de la première échéance + principal de la première échéance
      const calculatedAmount = (firstInstallment.remainingPrincipal || 0) + (firstInstallment.principalAmount || 0);
      
      // Durée en mois (approximative)
      const startDate = new Date(firstInstallment.dueDate);
      const endDate = new Date(lastInstallment.dueDate);
      const monthsDiff = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
      
      // Taux d'intérêt approximatif (calculé à partir de la première échéance)
      const principal = firstInstallment.principalAmount || 0;
      const interest = firstInstallment.interestAmount || 0;
      const remaining = firstInstallment.remainingPrincipal || calculatedAmount;
      const approximateRate = remaining > 0 ? (interest / remaining) * 12 * 100 : 0;

      // Mettre à jour le formulaire avec les données calculées
      setFormData(prev => ({
        ...prev,
        amount: calculatedAmount > 0 ? calculatedAmount.toString() : prev.amount,
        durationMonths: monthsDiff > 0 ? monthsDiff.toString() : prev.durationMonths,
        interestRate: approximateRate > 0 ? approximateRate.toFixed(2) : prev.interestRate,
        startDate: firstInstallment.dueDate || prev.startDate,
      }));

      // Stocker les échéances pour les créer après la création de l'emprunt
      setImportedInstallments(installments);

      Alert.alert(
        "Import réussi",
        `${installments.length} échéances importées avec succès.\n\n` +
        `Montant calculé : ${calculatedAmount.toLocaleString()}\n` +
        `Durée : ${monthsDiff} mois\n` +
        `Taux approximatif : ${approximateRate.toFixed(2)}%\n\n` +
        "Les échéances seront créées automatiquement après la création de l'emprunt.",
        [{ text: "OK" }]
      );

    } catch (error: any) {
      Alert.alert("Erreur", getErrorMessage(error, "Une erreur est survenue lors de l'import du fichier."));
    } finally {
      setIsImportingSchedule(false);
    }
  };

  const handleSubmitLoan = async () => {
    if (isSubmitting) return;

    try {
      setIsSubmitting(true);

      // Validation
      if (
        !formData.amount ||
        !formData.startDate ||
        !formData.companyId ||
        !formData.bankId ||
        !formData.scheduleSource
      ) {
        Alert.alert("Erreur", "Veuillez remplir tous les champs obligatoires");
        setIsSubmitting(false);
        return;
      }

      // Validation conditionnelle pour CALCULATED
      if (formData.scheduleSource === "CALCULATED") {
        if (!formData.interestRate || !formData.durationMonths || !formData.repaymentFrequency || !formData.rateType || !formData.dayCountBasis || !formData.repaymentType) {
          Alert.alert("Erreur", "Veuillez remplir tous les champs obligatoires pour un échéancier calculé");
          setIsSubmitting(false);
          return;
        }
        if (formData.repaymentType === "AMORTIZABLE" && !formData.amortizationMethod) {
          Alert.alert("Erreur", "Veuillez sélectionner une méthode d'amortissement");
          setIsSubmitting(false);
          return;
        }
      }

      // Récupérer la devise de l'entreprise sélectionnée
      const selectedCompany = (companies || []).find((c: Company) => c.id === formData.companyId);
      const currency = selectedCompany?.currency || "GNF";

      const payload: any = {
        companyId: formData.companyId,
        bankId: formData.bankId,
        amount: parseFloat(formData.amount),
        currency: currency,
        scheduleSource: formData.scheduleSource,
        startDate: formData.startDate,
        status: formData.status,
      };

      if (formData.countryId) payload.countryId = formData.countryId;
      if (formData.scheduleSource === "CALCULATED" && formData.interestRate) {
        payload.interestRate = parseFloat(formData.interestRate);
      }
      if (formData.scheduleSource === "CALCULATED" && formData.durationMonths) {
        payload.durationMonths = parseInt(formData.durationMonths);
      }
      if (formData.scheduleSource === "CALCULATED" && formData.repaymentFrequency) {
        payload.repaymentFrequency = formData.repaymentFrequency;
      }
      if (formData.scheduleSource === "CALCULATED" && formData.rateType) {
        payload.rateType = formData.rateType;
      }
      if (formData.scheduleSource === "CALCULATED" && formData.dayCountBasis) {
        payload.dayCountBasis = formData.dayCountBasis;
      }
      if (formData.scheduleSource === "CALCULATED" && formData.repaymentType) {
        payload.repaymentType = formData.repaymentType;
      }
      if (formData.scheduleSource === "CALCULATED" && formData.repaymentType === "AMORTIZABLE" && formData.amortizationMethod) {
        payload.amortizationMethod = formData.amortizationMethod;
      }
      if (formData.repaymentBankId) payload.repaymentBankId = formData.repaymentBankId;
      if (formData.initialBankFeesType && formData.initialBankFees) {
        payload.initialBankFeesType = formData.initialBankFeesType;
        payload.initialBankFees = parseFloat(formData.initialBankFees);
      }
      if (formData.initialBankFeesAddedToCapital !== undefined) {
        payload.initialBankFeesAddedToCapital = formData.initialBankFeesAddedToCapital;
      }
      if (formData.scheduleSource === "CALCULATED" && formData.roundingRule) {
        payload.roundingRule = formData.roundingRule;
      }
      if (formData.scheduleSource === "CALCULATED" && formData.dateRule) {
        payload.dateRule = formData.dateRule;
      }
      if (formData.description) payload.description = formData.description;

      let createdLoanId: string | null = null;

      if (editingLoan) {
        await api.put(`/api/loans/${editingLoan.id}`, payload);
        createdLoanId = editingLoan.id;
      } else {
        const response = await api.post('/api/loans', payload);
        createdLoanId = response.data?.id || response.data?.data?.id || null;
      }

      // Si on a des échéances importées et que l'emprunt a été créé/modifié avec succès
      if (importedInstallments.length > 0 && createdLoanId && formData.scheduleSource === "PROVIDED_BY_BANK") {
        try {
          // Créer toutes les échéances en une seule requête
          await api.post(`/api/loans/${createdLoanId}/installments`, importedInstallments, {
            skipAuthError: true,
          });

          Alert.alert(
            "Succès",
            `L'emprunt et ${importedInstallments.length} échéances ont été créés avec succès.`
          );
          setImportedInstallments([]);
        } catch (installmentError: any) {
          Alert.alert(
            "Attention",
            `L'emprunt a été créé mais les échéances n'ont pas pu être importées : ${getErrorMessage(installmentError, "erreur inconnue")}. Vous pouvez les ajouter manuellement depuis la page de détails de l'emprunt.`
          );
        }
      }

      setShowLoanForm(false);
      setEditingLoan(null);
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error: any) {
      Alert.alert("Erreur", getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Fonction pour supprimer un emprunt
  const handleDelete = (loan: Loan) => {
    if (!canDelete) {
      return;
    }
    setLoanToDelete(loan);
    setDeleteConfirmation("");
    setShowDeleteDrawer(true);
  };

  const confirmDelete = async () => {
    if (!loanToDelete) return;
    
    const normalized = normalizeConfirmationText(deleteConfirmation);
    if (normalized !== "supprimer") {
      Alert.alert("Erreur", 'Veuillez taper "supprimer" pour confirmer');
      return;
    }

    try {
      setIsDeleting(true);
      const id = loanToDelete.id;
      await api.delete(`/api/loans/${id}`);
      setShowDeleteDrawer(false);
      setLoanToDelete(null);
      setDeleteConfirmation("");
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (error: any) {
      Alert.alert("Erreur", getErrorMessage(error, "Impossible de supprimer l'emprunt"));
    } finally {
      setIsDeleting(false);
    }
  };

  // Fonction pour charger les échéanciers
  const loadInstallments = async (loanId: string) => {
    try {
      setLoadingInstallments(true);
      
      // Vérifier que le token est présent avant d'appeler l'endpoint
      const token = await authService.getToken();
      if (!token) {
        setInstallments([]);
        return;
      }
      
      // Vérifier si le token est expiré
      const isExpired = authService.isTokenExpired(token);
      if (isExpired) {
        const newToken = await authService.refreshToken();
        if (!newToken) {
          setInstallments([]);
          return;
        }
      }
      
      // Utiliser l'endpoint installments comme dans GesFlow (ligne 582)
      // GesFlow utilise fetch qui utilise automatiquement les cookies de session (NextAuth)
      // Dans l'app mobile, nous utilisons axios avec un token Bearer
      // IMPORTANT: Utiliser skipAuthError dès le premier appel pour éviter que le token soit supprimé
      // si l'endpoint retourne 401 (certains endpoints peuvent retourner 401 même avec un token valide
      // si l'utilisateur n'a pas les permissions spécifiques requises)
      try {
        const response = await api.get(`/api/loans/${loanId}/installments`, {
          skipAuthError: true,
        });
        
        // La réponse de GesFlow contient installments et stats (ligne 587)
        // response.data peut être directement un objet avec { installments: [...], stats: {...} }
        let installmentsData: any[] = [];
        
        if (Array.isArray(response.data)) {
          // Si c'est directement un tableau
          installmentsData = response.data;
        } else if (response.data && typeof response.data === 'object') {
          // Si c'est un objet, chercher installments
          installmentsData = response.data.installments || response.data.data || [];
        }
        
        if (Array.isArray(installmentsData) && installmentsData.length > 0) {
          setInstallments(installmentsData);
          return;
        } else if (Array.isArray(installmentsData)) {
          // Tableau vide mais endpoint valide
          setInstallments([]);
          return;
        }
        
        // Si on arrive ici, la réponse n'est pas au format attendu
        setInstallments([]);
      } catch (installmentsError: any) {
        const errorStatus = installmentsError.response?.status;
        
        // Si c'est une 401, essayer avec skipAuthError (l'endpoint peut nécessiter des permissions spéciales)
        // mais cela ne devrait pas affecter les permissions de l'utilisateur
        if (errorStatus === 401) {
          try {
            const retryResponse = await api.get(`/api/loans/${loanId}/installments`, {
              skipAuthError: true,
            });
            
            let retryData: any[] = [];
            if (Array.isArray(retryResponse.data)) {
              retryData = retryResponse.data;
            } else if (retryResponse.data && typeof retryResponse.data === 'object') {
              retryData = retryResponse.data.installments || retryResponse.data.data || [];
            }
            
            if (Array.isArray(retryData) && retryData.length > 0) {
              setInstallments(retryData);
              return;
            } else if (Array.isArray(retryData)) {
              setInstallments([]);
              return;
            }
          } catch (retryError: any) {
            // Si le retry échoue aussi, essayer avec amortizations
            try {
              const amortizationsResponse = await api.get(`/api/loans/${loanId}/amortizations`, {
                skipAuthError: true,
              });
              
              let amortizationsData: any[] = [];
              if (Array.isArray(amortizationsResponse.data)) {
                amortizationsData = amortizationsResponse.data;
              } else if (amortizationsResponse.data && typeof amortizationsResponse.data === 'object') {
                amortizationsData = amortizationsResponse.data.amortizations || amortizationsResponse.data.data || [];
              }
              
              if (Array.isArray(amortizationsData) && amortizationsData.length > 0) {
                setInstallments(amortizationsData);
                return;
              } else if (Array.isArray(amortizationsData)) {
                setInstallments([]);
                return;
              }
            } catch (amortizationsError: any) {
              // Si les deux endpoints échouent
              setInstallments([]);
              return;
            }
          }
        }
        
        // Si c'est une 404, essayer avec amortizations comme fallback
        if (errorStatus === 404) {
          try {
            const amortizationsResponse = await api.get(`/api/loans/${loanId}/amortizations`, {
              skipAuthError: true,
            });
            
            let amortizationsData: any[] = [];
            if (Array.isArray(amortizationsResponse.data)) {
              amortizationsData = amortizationsResponse.data;
            } else if (amortizationsResponse.data && typeof amortizationsResponse.data === 'object') {
              amortizationsData = amortizationsResponse.data.amortizations || amortizationsResponse.data.data || [];
            }
            
            if (Array.isArray(amortizationsData) && amortizationsData.length > 0) {
              setInstallments(amortizationsData);
              return;
            } else if (Array.isArray(amortizationsData)) {
              setInstallments([]);
              return;
            }
          } catch (amortizationsError: any) {
            setInstallments([]);
            return;
          }
        }
        
        // Pour les autres erreurs
        setInstallments([]);
      }
    } catch (error: any) {
      // Ne pas afficher d'erreur pour 401/404, c'est normal si l'échéancier n'existe pas
      if (error.response?.status === 401 || error.response?.status === 404) {
        setInstallments([]);
        return;
      }
      
      // Pour les autres erreurs, afficher un message
      Alert.alert("Erreur", getErrorMessage(error, "Impossible de charger les échéanciers"));
      setInstallments([]);
    } finally {
      setLoadingInstallments(false);
    }
  };

  // Fonction pour générer l'échéancier
  const handleGenerateSchedule = async () => {
    if (!loanForInstallments) return;

    try {
      setGeneratingSchedule(true);
      
      // Utiliser uniquement l'endpoint de GesFlow (comme ligne 645)
      try {
        const response = await api.post(`/api/loans/${loanForInstallments.id}/generate-installments`, {}, {
          skipAuthError: true,
        });
        // Attendre un peu avant de recharger pour laisser le serveur traiter
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadInstallments(loanForInstallments.id);
        Alert.alert("Succès", response.data?.message || "Échéancier généré avec succès");
      } catch (endpointError: any) {
        // Si c'est une 401, l'endpoint nécessite peut-être des permissions spéciales
        if (endpointError.response?.status === 401) {
          Alert.alert(
            "Information", 
            "La génération d'échéancier nécessite peut-être des permissions spéciales. Veuillez contacter l'administrateur."
          );
          return;
        }
        
        // Si c'est une 404, l'endpoint n'existe pas
        if (endpointError.response?.status === 404) {
          Alert.alert(
            "Information", 
            "L'endpoint de génération d'échéancier n'est pas disponible. L'échéancier peut être généré automatiquement."
          );
          return;
        }
        
        // Si c'est une 405, la méthode HTTP n'est pas autorisée
        if (endpointError.response?.status === 405) {
          Alert.alert(
            "Information", 
            "L'endpoint de génération d'échéancier n'accepte pas cette méthode. Veuillez contacter l'administrateur."
          );
          return;
        }
        
        // Pour les autres erreurs, afficher le message d'erreur
        Alert.alert("Erreur", getErrorMessage(endpointError, "Impossible de générer l'échéancier"));
      }
    } catch (error: any) {
      // Ne pas afficher d'erreur pour 401/404, déjà géré ci-dessus
      if (error.response?.status !== 401 && error.response?.status !== 404) {
        Alert.alert("Erreur", getErrorMessage(error, "Impossible de générer l'échéancier"));
      }
    } finally {
      setGeneratingSchedule(false);
    }
  };

  // Fonction pour ouvrir le drawer des échéanciers
  const handleViewInstallments = async (loan: Loan) => {
    setLoanForInstallments(loan);
    setShowInstallmentsDrawer(true);
    await loadInstallments(loan.id);
  };

  // Fonction pour payer un échéancier
  const handlePayInstallment = (installment: LoanInstallment) => {
    // Fermer d'abord le drawer des échéanciers
    setShowInstallmentsDrawer(false);
    // Puis ouvrir le drawer de confirmation de paiement après un court délai
    setTimeout(() => {
      setInstallmentToPay(installment);
      setShowPaymentDrawer(true);
    }, 300);
  };

  const confirmPayment = async () => {
    if (!installmentToPay || !loanForInstallments) return;

    try {
      setIsPaying(true);
      await api.post(`/api/loans/${loanForInstallments.id}/installments/${installmentToPay.id}/pay`, {}, {
        skipAuthError: true,
      });
      setShowPaymentDrawer(false);
      const paidLoan = loanForInstallments; // Sauvegarder la référence avant de réinitialiser
      setInstallmentToPay(null);
      
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      
      // Afficher un message de succès
      Alert.alert("Succès", "L'échéance a été payée avec succès", [
        {
          text: "OK",
          onPress: () => {
            // Rouvrir le drawer des échéanciers pour voir la mise à jour
            if (paidLoan) {
              setLoanForInstallments(paidLoan);
              setShowInstallmentsDrawer(true);
              // Recharger les échéanciers après avoir rouvert le drawer
              setTimeout(() => {
                loadInstallments(paidLoan.id);
              }, 300);
            }
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert("Erreur", getErrorMessage(error, "Impossible de payer l'échéance"));
    } finally {
      setIsPaying(false);
    }
  };

  // Fonction pour annuler le paiement d'une échéance (reverse)
  const handleReverseInstallmentPayment = (installment: LoanInstallment) => {
    if (!canReverseInstallmentPayment(installment.paidAt)) {
      Alert.alert(
        "Impossible d'annuler",
        "Le paiement ne peut être annulé que 24h après avoir été effectué."
      );
      return;
    }
    
    // Fermer le drawer des échéanciers avant d'ouvrir le drawer de confirmation
    setShowInstallmentsDrawer(false);
    
    // Attendre un peu pour que l'animation de fermeture se termine
    setTimeout(() => {
      setInstallmentToReverse(installment);
      setShowReverseDrawer(true);
    }, 300);
  };

  const confirmReversePayment = async () => {
    if (!installmentToReverse || !loanForInstallments) return;

    try {
      setIsReversing(true);
      await api.post(`/api/loans/${loanForInstallments.id}/installments/${installmentToReverse.id}/reverse`, {}, {
        skipAuthError: true,
      });
      setShowReverseDrawer(false);
      const reversedLoan = loanForInstallments;
      setInstallmentToReverse(null);
      
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      
      Alert.alert("Succès", "Le paiement de l'échéance a été annulé avec succès", [
        {
          text: "OK",
          onPress: () => {
            // Rouvrir le drawer des échéanciers pour voir la mise à jour
            if (reversedLoan) {
              setLoanForInstallments(reversedLoan);
              setTimeout(() => {
                setShowInstallmentsDrawer(true);
                loadInstallments(reversedLoan.id);
              }, 300);
            }
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert("Erreur", getErrorMessage(error, "Impossible d'annuler le paiement"));
    } finally {
      setIsReversing(false);
    }
  };

  // Fonction pour investir l'emprunt
  const handleInvestLoan = async () => {
    if (!loanToInvest || !investmentAmount) {
      Alert.alert("Erreur", "Veuillez saisir un montant");
      return;
    }

    const amount = parseFloat(investmentAmount);
    const investedAmount = (loanToInvest as any).investedAmount || 0;
    const availableAmount = loanToInvest.amount - investedAmount;

    if (amount <= 0 || amount > availableAmount) {
      Alert.alert(
        "Erreur",
        `Le montant doit être entre 0 et ${new Intl.NumberFormat("fr-FR", {
          style: "currency",
          currency: loanToInvest.currency,
        }).format(availableAmount)}`
      );
      return;
    }

    setIsInvestingLoan(true);
    try {
      await api.post(
        `/api/loans/${loanToInvest.id}/invest`,
        { amount },
        { skipAuthError: true }
      );
      
      Alert.alert("Succès", "Emprunt investi avec succès", [
        {
          text: "OK",
          onPress: () => {
            setShowInvestLoanDrawer(false);
            setLoanToInvest(null);
            setInvestmentAmount("");
            // Recharger les données
            refetch();
            queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard"] });
            // Rouvrir le drawer des détails si nécessaire
            if (selectedCompanyId || selectedSectorId) {
              setTimeout(() => {
                openDetailsModal(selectedCompanyId, selectedSectorId);
              }, 300);
            }
          },
        },
      ]);
    } catch (error: any) {
      Alert.alert("Erreur", getErrorMessage(error, "Impossible d'investir l'emprunt"));
    } finally {
      setIsInvestingLoan(false);
    }
  };

  // Fonction pour exporter en CSV
  const handleExportCSV = async () => {
    if (isExporting) return;

    try {
      setIsExporting(true);

      if (!filteredLoans || filteredLoans.length === 0) {
        Alert.alert(
          "Aucune donnée",
          "Il n'y a aucun emprunt à exporter avec les filtres actuels."
        );
        return;
      }

      const exportData = filteredLoans.map((loan: Loan) => {
        const statusMap: { [key: string]: string } = {
          DRAFT: "Brouillon",
          ACTIVE: "Actif",
          PAID: "Soldé",
          CANCELLED: "Annulé",
        };

        return {
          Entreprise: loan.company?.name || "N/A",
          Banque: loan.bankName || loan.bank?.name || "N/A",
          Montant: `${loan.amount.toLocaleString("fr-FR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })} ${loan.currency}`,
          "Taux d'intérêt": loan.interestRate ? `${loan.interestRate}%` : "N/A",
          "Date de début": formatDate(loan.startDate),
          "Date de fin": loan.endDate ? formatDate(loan.endDate) : "N/A",
          Statut: statusMap[loan.status] || loan.status,
          Description: loan.description || "",
        };
      });

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
      const fileContent = csvRows.join("\n");
      const filename = `emprunts_${new Date().toISOString().split("T")[0]}.csv`;

      const directory = getDocumentDirectory();
      const writeFn = FileSystemLegacy?.writeAsStringAsync || FileSystem.writeAsStringAsync;

      if (!writeFn) {
        throw new Error("writeAsStringAsync not found in expo-file-system");
      }

      const fileUri = directory ? `${directory}${filename}` : filename;

      await writeFn(fileUri, fileContent, {
        encoding: "utf8",
      });

      const isAvailable = await Sharing.isAvailableAsync();
      if (isAvailable) {
        await Sharing.shareAsync(fileUri, {
          mimeType: "text/csv",
          dialogTitle: "Partager le fichier CSV",
        });
      } else {
        Alert.alert("Export réussi", `Le fichier CSV a été sauvegardé : ${filename}`);
      }
    } catch (error: any) {
      Alert.alert("Erreur", "Impossible d'exporter le fichier CSV");
    } finally {
      setIsExporting(false);
    }
  };


  return (
    <SafeAreaView 
      className={`flex-1 ${isDark ? 'bg-[#0f172a]' : 'bg-white'}`}
      edges={['top', 'bottom']}
    >
      <ScreenHeader title="Emprunts" />
      <View className="flex-1">
        <View className="px-6 pt-20 pb-4">
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
                  minHeight: 20,
                }}
              />
            </View>

            {/* Bouton filtre */}
    <TouchableOpacity
              onPress={() => setShowFiltersModal(true)}
              className={`px-3 py-2.5 rounded-full flex-row items-center gap-1.5 ${
                startDate ||
                endDate ||
                minAmount ||
                maxAmount
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
                  startDate ||
                  endDate ||
                  minAmount ||
                  maxAmount
                    ? "#ffffff"
                    : isDark
                      ? "#9ca3af"
                      : "#6b7280"
                }
              />
            </TouchableOpacity>

            {/* Bouton export */}
            <TouchableOpacity
              onPress={handleExportCSV}
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
                className="px-3 py-2.5 rounded-full bg-[#0ea5e9]"
                activeOpacity={0.7}
              >
                <HugeiconsIcon icon={PlusSignCircleIcon} size={18} color="#ffffff" />
              </TouchableOpacity>
            )}
          </View>
          
          {/* Boutons Simuler et Détails */}
          <View className="flex-row items-center gap-2 mb-4">
            <TouchableOpacity
              onPress={() => setShowSimulationModal(true)}
              className={`flex-1 px-4 py-2.5 rounded-full flex-row items-center justify-center gap-2 ${
                isDark ? "bg-blue-900/20 border border-blue-600" : "bg-blue-50 border border-blue-300"
              }`}
              activeOpacity={0.7}
            >
              <HugeiconsIcon
                icon={CalculatorIcon}
                size={18}
                color={isDark ? "#60a5fa" : "#0ea5e9"}
              />
              <Text
                className={`text-sm font-medium ${
                  isDark ? "text-blue-300" : "text-blue-700"
                }`}
              >
                Simuler un emprunt
              </Text>
            </TouchableOpacity>
            
            <TouchableOpacity
              onPress={() => openDetailsModal(null, null)}
              className={`flex-1 px-4 py-2.5 rounded-full flex-row items-center justify-center gap-2 ${
                isDark ? "bg-gray-800 border border-gray-600" : "bg-white border border-gray-300"
              }`}
              activeOpacity={0.7}
            >
              <HugeiconsIcon
                icon={MoneyExchange03Icon}
                size={18}
                color={isDark ? "#9ca3af" : "#6b7280"}
              />
              <Text
                className={`text-sm font-medium ${
                  isDark ? "text-gray-200" : "text-gray-900"
                }`}
              >
                Investir emprunts
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Table avec scroll horizontal synchronisé */}
        {isLoading || !loans ? (
          <LoansSkeleton />
        ) : (
          <View className="flex-1">
            {/* En-têtes de colonnes avec scroll synchronisé */}
            <View
              className={`border-b ${
                isDark
                  ? "border-gray-700 bg-[#1e293b]"
                  : "border-gray-200 bg-gray-50"
              }`}
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
                <View
                  className="flex-row"
                  style={{ minWidth: totalTableWidth - columnWidths.actions }}
                >
                  {/* Entreprise */}
                  <View style={{ width: columnWidths.company }} className="px-3 py-3">
            <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
                      Entreprise
            </Text>
                  </View>

                  {/* Montant initial */}
                  <View style={{ width: columnWidths.initialAmount }} className="px-3 py-3">
            <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
              }`}
            >
                      Montant initial
            </Text>
          </View>

                  {/* Total amorti */}
                  <View style={{ width: columnWidths.totalAmortized }} className="px-3 py-3">
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Total amorti
                    </Text>
        </View>

                  {/* Solde restant */}
                  <View style={{ width: columnWidths.remainingBalance }} className="px-3 py-3">
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Solde restant
                    </Text>
                  </View>

                  {/* Emprunt investi */}
                  <View style={{ width: columnWidths.investedAmount }} className="px-3 py-3">
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Emprunt investi
                    </Text>
                  </View>

                  {/* Emprunt disponible à investir */}
                  <View style={{ width: columnWidths.availableToInvest }} className="px-3 py-3">
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Disponible à investir
                    </Text>
                  </View>

                  {/* Taux d'intérêt */}
                  <View style={{ width: columnWidths.interestRate }} className="px-3 py-3">
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Taux d'intérêt
                    </Text>
                  </View>

                  {/* Date de début */}
                  <View style={{ width: columnWidths.startDate }} className="px-3 py-3">
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Date de début
                    </Text>
                  </View>

                  {/* Date de fin */}
                  <View style={{ width: columnWidths.endDate }} className="px-3 py-3">
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Date de fin
                    </Text>
                  </View>

                  {/* Statut */}
                  <View style={{ width: columnWidths.status }} className="px-3 py-3">
                    <Text
                      className={`text-xs font-semibold uppercase ${
                        isDark ? "text-gray-400" : "text-gray-500"
                      }`}
                    >
                      Statut
                    </Text>
                  </View>
                </View>
              </ScrollView>

              {/* Actions (sticky à droite) */}
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

            {/* Liste des emprunts avec scroll synchronisé */}
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
              contentContainerStyle={{ paddingBottom: TAB_BAR_PADDING_BOTTOM }}
            >
              {filteredLoans.length === 0 ? (
                <View className="items-center justify-center py-12 px-6">
                  <Text
                    className={`text-center text-sm ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    {searchTerm ||
                    startDate ||
                    endDate ||
                    minAmount ||
                    maxAmount
                      ? "Aucun emprunt trouvé"
                      : "Aucun emprunt disponible"}
                  </Text>
                </View>
              ) : (
                filteredLoans.map((loan: Loan) => {
                  const hasEditPermission = canEditLoan(loan);
                  const hasCancelPermission = canCancelLoan(loan);
                  // Le delete est disponible pour les admins avec permission delete et dans les 24h
                  const hasDeletePermission = canDelete && canCancelTransaction(loan.createdAt) && (loan.status !== "PAID" && loan.status !== "CANCELLED");

                  return (
                    <View
                      key={loan.id}
                      className={`border-b ${
                        isDark
                          ? "border-gray-800 bg-[#0f172a]"
                          : "border-gray-100 bg-white"
                      }`}
                      style={{ position: "relative" }}
                    >
                      {/* Contenu scrollable */}
                      <ScrollView
                        nestedScrollEnabled={true}
                        ref={(ref) => {
                          if (ref) {
                            contentScrollRefs.current.set(loan.id, ref);
                            if (scrollXRef.current > 0) {
                              requestAnimationFrame(() => {
                                ref.scrollTo({
                                  x: scrollXRef.current,
                                  animated: false,
                                });
                              });
                            }
                          } else {
                            contentScrollRefs.current.delete(loan.id);
                          }
                        }}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        onScroll={(e) => handleContentScroll(e, loan.id)}
                        scrollEventThrottle={16}
                        contentContainerStyle={{
                          minWidth: totalTableWidth - columnWidths.actions,
                          paddingRight: columnWidths.actions,
                        }}
                      >
                        <View
                          className="flex-row"
                          style={{
                            minWidth: totalTableWidth - columnWidths.actions,
                          }}
                        >
                          {/* Entreprise */}
                          <View
                            style={{ width: columnWidths.company }}
                            className="px-3 py-4 justify-center"
                          >
                            <Text
                              className={`text-sm font-medium ${
                                isDark ? "text-gray-100" : "text-gray-900"
                              }`}
                              numberOfLines={1}
                            >
                              {loan.company?.name || "N/A"}
                            </Text>
                          </View>

                          {/* Montant initial */}
                          <View
                            style={{ width: columnWidths.initialAmount }}
                            className="px-3 py-4 justify-center"
                          >
        <BlurredAmount
                              amount={loan.amount}
                              currency={loan.currency}
                              className="text-xs font-semibold"
                            />
                          </View>

                          {/* Total amorti */}
                          <View
                            style={{ width: columnWidths.totalAmortized }}
                            className="px-3 py-4 justify-center"
                          >
                            <BlurredAmount
                              amount={(loan as any).amortizationStats?.totalAmortized || 0}
                              currency={loan.currency}
                              className="text-xs"
                            />
                          </View>

                          {/* Solde restant */}
                          <View
                            style={{ width: columnWidths.remainingBalance }}
                            className="px-3 py-4 justify-center"
                          >
                            <BlurredAmount
                              amount={(loan as any).amortizationStats?.remainingBalance || loan.amount}
                              currency={loan.currency}
                              className={`text-xs font-semibold ${
                                ((loan as any).amortizationStats?.remainingBalance || loan.amount) <= 0
                                  ? isDark ? "text-green-400" : "text-green-600"
                                  : ""
          }`}
        />
      </View>

                          {/* Emprunt investi */}
                          <View
                            style={{ width: columnWidths.investedAmount }}
                            className="px-3 py-4 justify-center"
                          >
                            <BlurredAmount
                              amount={(loan as any).investedAmount || 0}
                              currency={loan.currency}
                              className="text-xs text-blue-600 dark:text-blue-400"
                            />
                          </View>

                          {/* Emprunt disponible à investir */}
                          <View
                            style={{ width: columnWidths.availableToInvest }}
                            className="px-3 py-4 justify-center"
                          >
                            {(() => {
                              const availableToInvest = loan.amount - ((loan as any).investedAmount || 0);
  return (
                                <BlurredAmount
                                  amount={Math.max(0, availableToInvest)}
                                  currency={loan.currency}
                                  className={`text-xs font-semibold ${
                                    availableToInvest > 0
                                      ? isDark ? "text-green-400" : "text-green-600"
                                      : isDark ? "text-gray-500" : "text-gray-400"
                                  }`}
                                />
                              );
                            })()}
                          </View>

                          {/* Taux d'intérêt */}
                          <View
                            style={{ width: columnWidths.interestRate }}
                            className="px-3 py-4 justify-center"
                          >
                            <Text
                              className={`text-xs ${
                                isDark ? "text-gray-400" : "text-gray-600"
                              }`}
                            >
                              {loan.interestRate ? `${loan.interestRate}%` : "-"}
                            </Text>
                          </View>

                          {/* Date de début */}
                          <View
                            style={{ width: columnWidths.startDate }}
                            className="px-3 py-4 justify-center"
                          >
                            <Text
                              className={`text-xs ${
                                isDark ? "text-gray-400" : "text-gray-600"
                              }`}
                            >
                              {formatDate(loan.startDate)}
                            </Text>
                          </View>

                          {/* Date de fin */}
                          <View
                            style={{ width: columnWidths.endDate }}
                            className="px-3 py-4 justify-center"
                          >
                            <Text
                              className={`text-xs ${
                                isDark ? "text-gray-400" : "text-gray-600"
                              }`}
                            >
                              {loan.endDate ? formatDate(loan.endDate) : "-"}
                            </Text>
                          </View>

                          {/* Statut */}
                          <View
                            style={{ width: columnWidths.status }}
                            className="px-3 py-4 justify-center"
                          >
                            <View
                              className="px-2 py-1 rounded-full self-start"
                              style={{
                                backgroundColor:
                                  loan.status === "ACTIVE"
                                    ? "#10b98120"
                                    : loan.status === "PAID"
                                    ? "#3b82f620"
                                    : loan.status === "DRAFT"
                                    ? "#fbbf2420"
                                    : loan.status === "CANCELLED"
                                    ? "#6b728020"
                                    : "#6b728020",
                              }}
                            >
                              <Text
                                className="text-xs font-medium"
                                style={{
                                  color:
                                    loan.status === "ACTIVE"
                                      ? "#10b981"
                                      : loan.status === "PAID"
                                      ? "#3b82f6"
                                      : loan.status === "DRAFT"
                                      ? "#fbbf24"
                                      : loan.status === "CANCELLED"
                                      ? "#6b7280"
                                      : "#6b7280",
                                }}
                              >
                                {loan.status === "DRAFT"
                                  ? "Brouillon"
                                  : loan.status === "ACTIVE"
                                  ? "Actif"
                                  : loan.status === "PAID"
                                  ? "Soldé"
                                  : loan.status === "CANCELLED"
                                  ? "Annulé"
                                  : loan.status}
                              </Text>
                            </View>
                          </View>
                        </View>
                      </ScrollView>

                      {/* Actions (sticky à droite) - Toujours afficher pour maintenir la bordure, mais masquer les boutons pour les emprunts soldés ou annulés */}
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
                        className="px-3 justify-center items-center flex-row gap-2"
                        pointerEvents="box-none"
                      >
                        {(loan.status !== "PAID" && loan.status !== "CANCELLED") && (
                          <>
              <TouchableOpacity
                              onPress={() => handleViewInstallments(loan)}
                              className="p-2 rounded-full"
                              style={{ 
                                backgroundColor: "#3b82f6",
                              }}
                              activeOpacity={0.7}
                            >
                              <HugeiconsIcon
                                icon={CalculatorIcon}
                                size={16}
                                color="#ffffff"
                              />
                            </TouchableOpacity>
                            {canUpdate && (
                              <TouchableOpacity
                                onPress={() => handleEdit(loan)}
                                className="p-2 rounded-full"
                                style={{
                                  backgroundColor: isDark ? "#334155" : "#e5e7eb",
                                }}
                                activeOpacity={0.7}
                              >
                                <HugeiconsIcon
                                  icon={Edit01Icon}
                                  size={16}
                                  color={isDark ? "#9ca3af" : "#6b7280"}
                                />
              </TouchableOpacity>
                            )}
                            {canDelete && (
                              <TouchableOpacity
                                onPress={() => handleCancelLoan(loan)}
                                disabled={!canCancelTransaction(loan.createdAt)}
                                className="p-2 rounded-full"
                                style={{
                                  backgroundColor: isDark ? "#334155" : "#e5e7eb",
                                  opacity: !canCancelTransaction(loan.createdAt) ? 0.5 : 1,
                                }}
                                activeOpacity={0.7}
                              >
                                <HugeiconsIcon
                                  icon={Cancel01Icon}
                                  size={16}
                                  color="#f59e0b"
                                />
                              </TouchableOpacity>
                            )}
                            {hasDeletePermission && (
                              <TouchableOpacity
                                onPress={() => handleDelete(loan)}
                                className="p-2 rounded-full"
                                style={{
                                  backgroundColor: isDark ? "#334155" : "#e5e7eb",
                                }}
                                activeOpacity={0.7}
                              >
                                <HugeiconsIcon
                                  icon={Delete01Icon}
                                  size={16}
                                  color="#ef4444"
                                />
                              </TouchableOpacity>
                            )}
                          </>
                        )}
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
            )}
          </View>

      {/* Modal de filtres */}
      <Drawer
        open={showFiltersModal}
        onOpenChange={setShowFiltersModal}
        title="Filtres"
      >
        <ScrollView className="flex-1">
          <View className="gap-4">
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Date de début
              </Text>
              <TextInput
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                className={`px-4 py-3 rounded-lg border ${
                  isDark ? 'bg-[#1e293b] border-gray-700 text-gray-100' : 'bg-gray-100 border-gray-300 text-gray-900'
                }`}
                style={{
                  textAlignVertical: "center",
                  includeFontPadding: false,
                  paddingVertical: 0,
                  minHeight: 48,
                }}
              />
            </View>

            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Date de fin
              </Text>
              <TextInput
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                className={`px-4 py-3 rounded-lg border ${
                  isDark ? 'bg-[#1e293b] border-gray-700 text-gray-100' : 'bg-gray-100 border-gray-300 text-gray-900'
                }`}
                style={{
                  textAlignVertical: "center",
                  includeFontPadding: false,
                  paddingVertical: 0,
                  minHeight: 48,
                }}
              />
          </View>

            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Montant minimum
              </Text>
              <TextInput
                value={minAmount}
                onChangeText={(text) => setMinAmount(formatDecimalInput(text))}
                placeholder="0"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                keyboardType="numeric"
                className={`px-4 py-3 rounded-lg border ${
                  isDark ? 'bg-[#1e293b] border-gray-700 text-gray-100' : 'bg-gray-100 border-gray-300 text-gray-900'
                }`}
                style={{
                  textAlignVertical: "center",
                  includeFontPadding: false,
                  paddingVertical: 0,
                  minHeight: 48,
                }}
              />
            </View>

            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Montant maximum
              </Text>
              <TextInput
                value={maxAmount}
                onChangeText={(text) => setMaxAmount(formatDecimalInput(text))}
                placeholder="0"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                keyboardType="numeric"
                className={`px-4 py-3 rounded-lg border ${
                  isDark ? 'bg-[#1e293b] border-gray-700 text-gray-100' : 'bg-gray-100 border-gray-300 text-gray-900'
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
                  setStartDate("");
                  setEndDate("");
                  setMinAmount("");
                  setMaxAmount("");
                }}
                className="flex-1"
                style={{
                  borderColor: isDark ? "#475569" : "#d1d5db",
                  backgroundColor: isDark ? "#1e293b" : "transparent",
                }}
              >
                <Text
                  className={`font-semibold ${
                    isDark ? "text-gray-200" : "text-gray-700"
                  }`}
                >
                  Réinitialiser
                </Text>
              </Button>
              <Button
                onPress={() => setShowFiltersModal(false)}
                className="flex-1"
              >
                Appliquer
              </Button>
            </View>
          </View>
        </ScrollView>
      </Drawer>

      {/* Formulaire de création/édition */}
      <Drawer
        open={showLoanForm}
        onOpenChange={(open) => {
          if (!open) {
            setShowLoanForm(false);
            setEditingLoan(null);
            // Réinitialiser le formulaire
            const getLocalDateString = (): string => {
              const now = new Date();
              const year = now.getFullYear();
              const month = String(now.getMonth() + 1).padStart(2, "0");
              const day = String(now.getDate()).padStart(2, "0");
              return `${year}-${month}-${day}`;
            };
            setFormData({
              companyId: "",
              countryId: "",
              bankId: "",
              amount: "",
              scheduleSource: "CALCULATED",
              interestRate: "",
              durationMonths: "",
              repaymentFrequency: "MONTHLY",
              rateType: "FIXED",
              dayCountBasis: "ACT_360",
              repaymentType: "AMORTIZABLE",
              amortizationMethod: "CONSTANT_PAYMENT",
              repaymentBankId: "",
              startDate: getLocalDateString(),
              initialBankFeesType: "",
              initialBankFees: "",
              initialBankFeesAddedToCapital: false,
              roundingRule: "ADJUST_LAST",
              dateRule: "EXCLUDE_START",
              status: "DRAFT",
              description: "",
            });
          }
        }}
        title={editingLoan ? "Modifier l'emprunt" : "Nouvel emprunt"}
      >
        <ScrollView className="flex-1">
          <View className="gap-4">
            {/* 1. Entreprise */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Entreprise <Text className="text-red-500">*</Text>
              </Text>
              <Select
                value={formData.companyId}
                onValueChange={(value) => {
                  const selectedCompany = (companies || []).find((c: Company) => c.id === value);
                  setFormData({
                    ...formData,
                    companyId: value,
                    countryId: selectedCompany?.country?.id || "",
                  });
                }}
                options={(companies || []).map((company: Company) => ({
                  label: company.name,
                  value: company.id,
                }))}
                placeholder="Sélectionner une entreprise"
              />
            </View>

            {/* 2. Compte de décaissement (banque) */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Compte de décaissement (banque) <Text className="text-red-500">*</Text>
              </Text>
              <Select
                value={formData.bankId}
                onValueChange={(value) => setFormData({ ...formData, bankId: value })}
                options={sortedBanks}
                placeholder="Sélectionner une banque"
              />
            </View>

            {/* 3. Montant */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Montant <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                value={formData.amount}
                onChangeText={(text) =>
                  setFormData({ ...formData, amount: formatDecimalInput(text) })
                }
                placeholder="0.00"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                keyboardType="numeric"
                className={`px-4 py-3 rounded-lg border ${
                  isDark ? 'bg-[#1e293b] border-gray-700 text-gray-100' : 'bg-gray-100 border-gray-300 text-gray-900'
                }`}
                style={{
                  textAlignVertical: "center",
                  includeFontPadding: false,
                  paddingVertical: 0,
                  minHeight: 48,
                }}
                editable={!editingLoan || (editingLoan.status !== "ACTIVE" && editingLoan.status !== "PAID")}
              />
            </View>

            {/* 4. Source de l'échéancier */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Source de l'échéancier <Text className="text-red-500">*</Text>
              </Text>
              <Select
                value={formData.scheduleSource}
                onValueChange={(value) => setFormData({ ...formData, scheduleSource: value as any })}
                options={[
                  { label: "🧮 Calculé par la plateforme (simulation)", value: "CALCULATED" },
                  { label: "🏦 Fourni par la banque (référence réelle)", value: "PROVIDED_BY_BANK" },
                ]}
                disabled={!!(editingLoan && (editingLoan.status === "ACTIVE" || editingLoan.status === "PAID"))}
              />
              {formData.scheduleSource === "CALCULATED" && (
                <Text className={`text-xs mt-2 p-2 rounded-lg ${
                  isDark ? 'bg-yellow-900/20 text-yellow-400' : 'bg-yellow-50 text-yellow-600'
                }`}>
                  ⚠️ Simulation indicative — les montants réels peuvent différer selon la banque
                </Text>
              )}
              {formData.scheduleSource === "PROVIDED_BY_BANK" && (
                <Text className={`text-xs mt-2 p-2 rounded-lg ${
                  isDark ? 'bg-blue-900/20 text-blue-400' : 'bg-blue-50 text-blue-600'
                }`}>
                  🏦 Mode bancaire réel — aucun recalcul, exécution stricte des échéances
                </Text>
              )}
            </View>

            {/* Section Import/Saisie d'échéancier - Affichée uniquement si PROVIDED_BY_BANK */}
            {formData.scheduleSource === "PROVIDED_BY_BANK" && (
              <View className="pt-4 border-t" style={{ borderTopColor: isDark ? '#374151' : '#e5e7eb' }}>
                <View className="flex-row items-center justify-between mb-3">
                  <Text className={`text-sm font-semibold ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Échéancier bancaire
                  </Text>
                  <View className="flex-row gap-2">
                    <Button
                      onPress={() => {
                        Alert.alert(
                          "Format d'import",
                          "Format attendu pour l'import d'échéancier (Excel/CSV):\n\n" +
                          "Colonnes requises:\n" +
                          "- Numéro d'échéance (installmentNumber)\n" +
                          "- Date d'échéance (dueDate) - Format: YYYY-MM-DD\n" +
                          "- Montant principal (principalAmount)\n" +
                          "- Montant intérêts (interestAmount)\n" +
                          "- Montant total (totalPayment)\n" +
                          "- Capital restant (remainingPrincipal)\n\n" +
                          "L'import pourra être effectué après la création de l'emprunt.",
                          [{ text: "OK" }]
                        );
                      }}
                      variant="outline"
                      className="rounded-full px-3 py-1"
                      style={{
                        borderColor: isDark ? '#4b5563' : '#d1d5db',
                        backgroundColor: isDark ? '#1e293b' : 'transparent',
                      }}
                    >
                      <View className="flex-row items-center gap-1">
                        <HugeiconsIcon icon={EyeIcon} size={12} color={isDark ? "#9ca3af" : "#6b7280"} />
                        <Text className={`text-xs ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          Format
                        </Text>
                      </View>
                    </Button>
                    <Button
                      onPress={handleImportSchedule}
                      loading={isImportingSchedule}
                      disabled={isImportingSchedule}
                      variant="outline"
                      className="rounded-full px-3 py-1"
                      style={{
                        borderColor: isDark ? '#4b5563' : '#d1d5db',
                        backgroundColor: isDark ? '#1e293b' : 'transparent',
                      }}
                    >
                      <View className="flex-row items-center gap-1">
                        <HugeiconsIcon icon={Download01Icon} size={12} color={isDark ? "#9ca3af" : "#6b7280"} />
                        <Text className={`text-xs ${isImportingSchedule ? 'opacity-50' : ''} ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                          {isImportingSchedule ? "Import..." : "Importer"}
                        </Text>
                      </View>
                    </Button>
                  </View>
                </View>
                <View className={`p-3 rounded-lg ${
                  isDark ? 'bg-blue-900/20' : 'bg-blue-50'
                }`}>
                  <Text className={`text-xs ${
                    isDark ? 'text-blue-300' : 'text-blue-700'
                  }`}>
                    <Text className="font-semibold">Mode bancaire réel :</Text> L'échéancier sera importé ou saisi manuellement après la création de l'emprunt. Les échéances deviendront la source de vérité et ne pourront pas être recalculées automatiquement.
                  </Text>
                </View>
              </View>
            )}

            {/* 5. Taux annuel (%) - Désactivé si PROVIDED_BY_BANK */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Taux annuel (%) {formData.scheduleSource === "CALCULATED" && <Text className="text-red-500">*</Text>}
                {formData.scheduleSource === "PROVIDED_BY_BANK" && (
                  <Text className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}> (informatif)</Text>
                )}
              </Text>
              <TextInput
                value={formData.interestRate}
                onChangeText={(text) =>
                  setFormData({ ...formData, interestRate: formatDecimalInput(text) })
                }
                placeholder="0.00"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                keyboardType="numeric"
                className={`px-4 py-3 rounded-lg border ${
                  isDark ? 'bg-[#1e293b] border-gray-700 text-gray-100' : 'bg-gray-100 border-gray-300 text-gray-900'
                }`}
                style={{
                  textAlignVertical: "center",
                  includeFontPadding: false,
                  paddingVertical: 0,
                  minHeight: 48,
                }}
                editable={formData.scheduleSource === "CALCULATED"}
              />
            </View>

            {/* 6. Durée (mois) - Désactivé si PROVIDED_BY_BANK */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Durée (mois) {formData.scheduleSource === "CALCULATED" && <Text className="text-red-500">*</Text>}
                {formData.scheduleSource === "PROVIDED_BY_BANK" && (
                  <Text className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}> (informatif)</Text>
                )}
              </Text>
              <TextInput
                value={formData.durationMonths}
                onChangeText={(text) => {
                  const numericValue = formatIntegerInput(text);
                  setFormData({ ...formData, durationMonths: numericValue });
                  // Calculer automatiquement la date de fin
                  if (numericValue && formData.startDate) {
                    const months = parseInt(numericValue) || 0;
                    if (months > 0) {
                      const startDate = new Date(formData.startDate);
                      const endDate = new Date(startDate);
                      endDate.setMonth(endDate.getMonth() + months);
                      const year = endDate.getFullYear();
                      const month = String(endDate.getMonth() + 1).padStart(2, "0");
                      const day = String(endDate.getDate()).padStart(2, "0");
                      // Ne pas mettre à jour endDate automatiquement, laisser l'utilisateur le faire manuellement si besoin
                    }
                  }
                }}
                placeholder="0"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                keyboardType="numeric"
                className={`px-4 py-3 rounded-lg border ${
                  isDark ? 'bg-[#1e293b] border-gray-700 text-gray-100' : 'bg-gray-100 border-gray-300 text-gray-900'
                }`}
                style={{
                  textAlignVertical: "center",
                  includeFontPadding: false,
                  paddingVertical: 0,
                  minHeight: 48,
                }}
                editable={formData.scheduleSource === "CALCULATED"}
              />
          </View>

            {/* 7. Fréquence de remboursement - Désactivé si PROVIDED_BY_BANK */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Fréquence de remboursement {formData.scheduleSource === "CALCULATED" && <Text className="text-red-500">*</Text>}
                {formData.scheduleSource === "PROVIDED_BY_BANK" && (
                  <Text className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}> (informatif)</Text>
                )}
              </Text>
              <Select
                value={formData.repaymentFrequency}
                onValueChange={(value) => setFormData({ ...formData, repaymentFrequency: value as any })}
                options={[
                  { label: "Mensuelle", value: "MONTHLY" },
                  { label: "Trimestrielle", value: "QUARTERLY" },
                ]}
                disabled={formData.scheduleSource === "PROVIDED_BY_BANK" || !!(editingLoan && (editingLoan.status === "ACTIVE" || editingLoan.status === "PAID"))}
              />
        </View>

            {/* 8. Type de taux - Désactivé si PROVIDED_BY_BANK */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Type de taux {formData.scheduleSource === "CALCULATED" && <Text className="text-red-500">*</Text>}
                {formData.scheduleSource === "PROVIDED_BY_BANK" && (
                  <Text className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}> (informatif)</Text>
                )}
              </Text>
              <Select
                value={formData.rateType}
                onValueChange={(value) => setFormData({ ...formData, rateType: value as any })}
                options={[
                  { label: "Fixe", value: "FIXED" },
                  { label: "Variable", value: "VARIABLE" },
                ]}
                disabled={formData.scheduleSource === "PROVIDED_BY_BANK" || !!(editingLoan && (editingLoan.status === "ACTIVE" || editingLoan.status === "PAID"))}
              />
            </View>

            {/* 9. Convention de calcul - Désactivé si PROVIDED_BY_BANK */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Convention de calcul {formData.scheduleSource === "CALCULATED" && <Text className="text-red-500">*</Text>}
                {formData.scheduleSource === "PROVIDED_BY_BANK" && (
                  <Text className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}> (informatif)</Text>
                )}
              </Text>
              <Select
                value={formData.dayCountBasis}
                onValueChange={(value) => setFormData({ ...formData, dayCountBasis: value as any })}
                options={[
                  { label: "ACT/360", value: "ACT_360" },
                  { label: "ACT/365", value: "ACT_365" },
                ]}
                disabled={formData.scheduleSource === "PROVIDED_BY_BANK" || !!(editingLoan && (editingLoan.status === "ACTIVE" || editingLoan.status === "PAID"))}
              />
              <Text className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                {formData.dayCountBasis === "ACT_360"
                  ? "ACT/360 : intérêts calculés sur le nombre réel de jours, base 360."
                  : "ACT/365 : intérêts calculés sur le nombre réel de jours, base 365."}
              </Text>
            </View>

            {/* 10. Type de remboursement - Désactivé si PROVIDED_BY_BANK */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Type de remboursement {formData.scheduleSource === "CALCULATED" && <Text className="text-red-500">*</Text>}
                {formData.scheduleSource === "PROVIDED_BY_BANK" && (
                  <Text className={`text-xs ${isDark ? 'text-gray-500' : 'text-gray-500'}`}> (informatif)</Text>
                )}
              </Text>
              <Select
                value={formData.repaymentType}
                onValueChange={(value) => setFormData({ ...formData, repaymentType: value as any })}
                options={[
                  { label: "Amortissable", value: "AMORTIZABLE" },
                  { label: "In fine", value: "IN_FINE" },
                ]}
                disabled={formData.scheduleSource === "PROVIDED_BY_BANK" || !!(editingLoan && (editingLoan.status === "ACTIVE" || editingLoan.status === "PAID"))}
              />
            </View>

            {/* 11. Méthode d'amortissement - Affiché uniquement si AMORTIZABLE et CALCULATED */}
            {formData.repaymentType === "AMORTIZABLE" && formData.scheduleSource === "CALCULATED" && (
              <View>
                <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Méthode d'amortissement <Text className="text-red-500">*</Text>
                </Text>
                <Select
                  value={formData.amortizationMethod}
                  onValueChange={(value) => setFormData({ ...formData, amortizationMethod: value as any })}
                  options={[
                    { label: "Mensualité constante", value: "CONSTANT_PAYMENT" },
                    { label: "Capital constant", value: "CONSTANT_CAPITAL" },
                  ]}
                  disabled={!!(editingLoan && (editingLoan.status === "ACTIVE" || editingLoan.status === "PAID"))}
                />
              </View>
            )}

            {/* 12. Compte de remboursement (si différent) */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Compte de remboursement (si différent)
              </Text>
              <Select
                value={formData.repaymentBankId}
                onValueChange={(value) => setFormData({ ...formData, repaymentBankId: value })}
                options={[
                  { label: "Même que le compte de décaissement", value: "" },
                  ...((banks || []).map((bank: Bank) => ({
                    label: bank.name,
                    value: bank.id,
                  }))),
                ]}
                placeholder="Même que le compte de décaissement"
              />
            </View>

            {/* 13. Date de début */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Date de début <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                value={formData.startDate}
                onChangeText={(text) => {
                  setFormData({ ...formData, startDate: text });
                  // Recalculer la date de fin si la durée est définie
                  if (formData.durationMonths && text) {
                    const months = parseInt(formData.durationMonths) || 0;
                    if (months > 0) {
                      const startDate = new Date(text);
                      const endDate = new Date(startDate);
                      endDate.setMonth(endDate.getMonth() + months);
                      // Ne pas mettre à jour automatiquement, laisser l'utilisateur le faire si besoin
                    }
                  }
                }}
                placeholder="YYYY-MM-DD"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                className={`px-4 py-3 rounded-lg border ${
                  isDark ? 'bg-[#1e293b] border-gray-700 text-gray-100' : 'bg-gray-100 border-gray-300 text-gray-900'
                }`}
                style={{
                  textAlignVertical: "center",
                  includeFontPadding: false,
                  paddingVertical: 0,
                  minHeight: 48,
                }}
              />
            </View>

            {/* 14. Type de frais initiaux */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Type de frais initiaux
              </Text>
              <Select
                value={formData.initialBankFeesType || ""}
                onValueChange={(value) => {
                  setFormData({
                    ...formData,
                    initialBankFeesType: value as any,
                    initialBankFees: "", // Réinitialiser le montant quand on change le type
                  });
                }}
                options={[
                  { label: "Aucun", value: "" },
                  { label: "Montant fixe", value: "AMOUNT" },
                  { label: "Pourcentage", value: "PERCENTAGE" },
                ]}
                disabled={!!(editingLoan && (editingLoan.status === "ACTIVE" || editingLoan.status === "PAID"))}
              />
            </View>

            {/* 15. Frais bancaires initiaux */}
            {formData.initialBankFeesType && (
              <View>
                <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Frais bancaires initiaux (optionnel)
                </Text>
                <TextInput
                  value={formData.initialBankFees}
                  onChangeText={(text) =>
                    setFormData({ ...formData, initialBankFees: formatDecimalInput(text) })
                  }
                  placeholder={formData.initialBankFeesType === "PERCENTAGE" ? "Ex: 2.5" : "Ex: 100000"}
                  placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                  keyboardType="numeric"
                  className={`px-4 py-3 rounded-lg border ${
                    isDark ? 'bg-[#1e293b] border-gray-700 text-gray-100' : 'bg-gray-100 border-gray-300 text-gray-900'
                  }`}
                  style={{
                    textAlignVertical: "center",
                    includeFontPadding: false,
                    paddingVertical: 0,
                    minHeight: 48,
                  }}
                  editable={!editingLoan || (editingLoan.status !== "ACTIVE" && editingLoan.status !== "PAID")}
                />
                {formData.initialBankFeesType === "PERCENTAGE" && (
                  <Text className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                    Pourcentage du capital emprunté
                  </Text>
                )}
              </View>
            )}

            {/* 16. Intégration des frais au capital */}
            {formData.initialBankFeesType && (
              <View>
                <TouchableOpacity
                  onPress={() => setFormData({ ...formData, initialBankFeesAddedToCapital: !formData.initialBankFeesAddedToCapital })}
                  className="flex-row items-center gap-2"
                  disabled={!!(editingLoan && (editingLoan.status === "ACTIVE" || editingLoan.status === "PAID"))}
                >
                  <View
                    className={`w-5 h-5 rounded border-2 items-center justify-center ${
                      formData.initialBankFeesAddedToCapital
                        ? isDark ? 'bg-blue-600 border-blue-600' : 'bg-blue-600 border-blue-600'
                        : isDark ? 'border-gray-600' : 'border-gray-300'
                    }`}
                  >
                    {formData.initialBankFeesAddedToCapital && (
                      <Text className="text-white text-xs">✓</Text>
                    )}
                  </View>
                  <Text className={`text-sm ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                    Intégrer les frais au capital
                  </Text>
                </TouchableOpacity>
                <Text className={`text-xs mt-2 ${isDark ? 'text-gray-500' : 'text-gray-500'}`}>
                  {formData.initialBankFeesAddedToCapital
                    ? "Les frais seront ajoutés au capital initial. Les intérêts seront calculés sur ce nouveau capital."
                    : "Si coché, les frais seront ajoutés au capital initial. Sinon, les frais seront débités immédiatement de la trésorerie."}
                </Text>
              </View>
            )}

            {/* 17. Règle d'arrondi (avancé) - Masqué si PROVIDED_BY_BANK */}
            {formData.scheduleSource === "CALCULATED" && (
              <View>
                <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Règle d'arrondi (avancé)
                </Text>
                <Select
                  value={formData.roundingRule}
                  onValueChange={(value) => setFormData({ ...formData, roundingRule: value as any })}
                  options={[
                    { label: "Ajustement sur la dernière échéance (par défaut)", value: "ADJUST_LAST" },
                    { label: "Arrondi à chaque échéance", value: "ROUND_EACH" },
                    { label: "Arrondi en fin de période", value: "ROUND_END" },
                  ]}
                  disabled={!!(editingLoan && (editingLoan.status === "ACTIVE" || editingLoan.status === "PAID"))}
                />
              </View>
            )}

            {/* 18. Règle de date (avancé) - Masqué si PROVIDED_BY_BANK */}
            {formData.scheduleSource === "CALCULATED" && (
              <View>
                <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Règle de date (avancé)
                </Text>
                <Select
                  value={formData.dateRule}
                  onValueChange={(value) => setFormData({ ...formData, dateRule: value as any })}
                  options={[
                    { label: "Exclure le jour de départ (par défaut)", value: "EXCLUDE_START" },
                    { label: "Inclure le jour de départ", value: "INCLUDE_START" },
                  ]}
                  disabled={!!(editingLoan && (editingLoan.status === "ACTIVE" || editingLoan.status === "PAID"))}
                />
              </View>
            )}

            {/* 19. Statut */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Statut
              </Text>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as any })}
                options={[
                  { label: "Brouillon", value: "DRAFT" },
                  { label: "Actif", value: "ACTIVE" },
                  { label: "Soldé", value: "PAID" },
                  { label: "Annulé", value: "CANCELLED" },
                ]}
              />
            </View>

            {/* 20. Description */}
            <View>
              <Text className={`text-sm font-medium mb-2 ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Description
              </Text>
              <TextInput
                value={formData.description}
                onChangeText={(text) => setFormData({ ...formData, description: text })}
                placeholder="Description de l'emprunt"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                className={`px-4 py-3 rounded-lg border ${
                  isDark ? 'bg-[#1e293b] border-gray-700 text-gray-100' : 'bg-gray-100 border-gray-300 text-gray-900'
                }`}
                style={{
                  textAlignVertical: "center",
                  includeFontPadding: false,
                  paddingVertical: 0,
                  minHeight: 48,
                }}
              />
            </View>

            <Button
              onPress={handleSubmitLoan}
              loading={isSubmitting}
              className="mt-4"
            >
              {editingLoan ? "Mettre à jour" : "Créer l'emprunt"}
            </Button>
          </View>
        </ScrollView>
      </Drawer>

      {/* Drawer de confirmation de suppression */}
      <Drawer
        open={showDeleteDrawer}
        onOpenChange={(open) => {
          if (!open) {
            setShowDeleteDrawer(false);
            setLoanToDelete(null);
            setDeleteConfirmation("");
          }
        }}
        title="Supprimer l'emprunt"
      >
        <View className="gap-4">
          <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
            Êtes-vous sûr de vouloir supprimer cet emprunt ? Cette action est irréversible.
          </Text>
          <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
            Pour confirmer, tapez "supprimer" ci-dessous :
          </Text>
          <TextInput
            value={deleteConfirmation}
            onChangeText={setDeleteConfirmation}
            placeholder="supprimer"
            placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
            className={`px-4 py-3 rounded-lg ${
              isDark ? 'bg-[#1e293b] text-gray-100' : 'bg-gray-100 text-gray-900'
            }`}
            style={{
              textAlignVertical: "center",
              includeFontPadding: false,
              paddingVertical: 0,
            }}
          />
          <View className="flex-row gap-3 mt-4">
            <Button
              variant="outline"
              onPress={() => {
                setShowDeleteDrawer(false);
                setLoanToDelete(null);
                setDeleteConfirmation("");
              }}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              onPress={confirmDelete}
              loading={isDeleting}
              className="flex-1"
              style={{ backgroundColor: "#ef4444" }}
            >
              Supprimer
            </Button>
          </View>
        </View>
      </Drawer>

      {/* Drawer de confirmation d'annulation */}
      <Drawer
        open={showCancelDrawer}
        onOpenChange={(open) => {
          if (!open) {
            setShowCancelDrawer(false);
            setLoanToCancel(null);
            setCancelConfirmation("");
          }
        }}
        title="Annuler l'emprunt"
      >
        <View className="gap-4">
          {loanToCancel && (
            <>
              <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Êtes-vous sûr de vouloir annuler cet emprunt de {loanToCancel.amount.toLocaleString("fr-FR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} {loanToCancel.currency} ?
              </Text>
              <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Cette action est irréversible et remboursera le solde si nécessaire.
              </Text>
            </>
          )}
          <View className="flex-row gap-3 mt-4">
            <Button
              variant="outline"
              onPress={() => {
                setShowCancelDrawer(false);
                setLoanToCancel(null);
                setCancelConfirmation("");
              }}
              className="flex-1"
              style={{
                borderColor: isDark ? "#475569" : "#d1d5db",
                backgroundColor: isDark ? "#1e293b" : "transparent",
              }}
            >
              <Text
                className={`font-semibold ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Non
              </Text>
            </Button>
            <Button
              onPress={confirmCancel}
              loading={isCancelling}
              className="flex-1"
              style={{ backgroundColor: "#f59e0b" }}
            >
              Oui, annuler
            </Button>
          </View>
        </View>
      </Drawer>

      {/* Drawer des échéanciers */}
      <Drawer
        open={showInstallmentsDrawer}
        onOpenChange={(open) => {
          if (!open && !showPaymentDrawer) {
            // Ne fermer complètement que si le drawer de paiement n'est pas ouvert
            setShowInstallmentsDrawer(false);
            setLoanForInstallments(null);
            setInstallments([]);
          }
        }}
        title="Échéancier"
      >
        <View className="flex-1">
          {loanForInstallments && (
            <View className="gap-4 mb-4 px-4 pt-2">
              <View className="flex-row items-center justify-between">
                <Text className={`text-sm font-medium ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                  Emprunt: {loanForInstallments.description || loanForInstallments.bankName || "N/A"}
                </Text>
                {/* Afficher le bouton uniquement si :
                    - Le statut est ACTIVE
                    - Il n'y a vraiment pas d'échéancier (installments.length === 0 ET loadingInstallments === false)
                    - Le scheduleSource n'est pas PROVIDED_BY_BANK
                    - On a vraiment essayé de charger (pas en cours de chargement) */}
                {loanForInstallments.status === "ACTIVE" && 
                 !loadingInstallments &&
                 installments.length === 0 && 
                 (loanForInstallments as any).scheduleSource !== "PROVIDED_BY_BANK" && (
                  <Button
                    variant="outline"
                    onPress={handleGenerateSchedule}
                    loading={generatingSchedule}
                    className="px-3 py-1.5"
                    style={{
                      borderColor: isDark ? "#475569" : "#d1d5db",
                    }}
                  >
                    <Text
                      className={`font-semibold ${
                        isDark ? "text-gray-200" : "text-gray-700"
                      }`}
                    >
                      {generatingSchedule ? "Génération..." : "Générer l'échéancier"}
                    </Text>
                  </Button>
                )}
                {loanForInstallments && 
                 (loanForInstallments as any).scheduleSource === "PROVIDED_BY_BANK" && 
                 installments.length === 0 && (
                  <View className="bg-blue-500/10 dark:bg-blue-500/20 p-3 rounded-lg">
                    <Text className="text-xs text-blue-700 dark:text-blue-300">
                      <Text className="font-semibold">Échéancier bancaire :</Text> L'échéancier doit être importé ou saisi manuellement. Il ne peut pas être généré automatiquement.
                    </Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {loadingInstallments ? (
            <View className="items-center justify-center py-8">
              <ActivityIndicator size="large" color={CHART_COLOR} />
            </View>
          ) : installments.length === 0 ? (
            <View className="items-center justify-center py-8">
              <Text className={`${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                Aucun échéancier disponible
              </Text>
            </View>
          ) : (
            <View className="flex-1">
              {/* En-têtes de colonnes */}
              <View
                className={`border-b ${
                  isDark
                    ? "border-gray-700 bg-[#1e293b]"
                    : "border-gray-200 bg-gray-50"
                }`}
                style={{ position: "relative" }}
              >
                <ScrollView
                  ref={installmentHeaderScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  onScroll={handleInstallmentHeaderScroll}
                  scrollEventThrottle={16}
            contentContainerStyle={{
                    minWidth: totalInstallmentTableWidth - installmentColumnWidths.actions,
                    paddingRight: installmentColumnWidths.actions,
                  }}
                >
                  <View
                    className="flex-row"
                    style={{ minWidth: totalInstallmentTableWidth - installmentColumnWidths.actions }}
                  >
                    {/* Numéro */}
                    <View style={{ width: installmentColumnWidths.number }} className="px-3 py-3">
                      <Text className={`text-xs font-semibold uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                        N°
                      </Text>
                    </View>
                    {/* Date */}
                    <View style={{ width: installmentColumnWidths.date }} className="px-3 py-3">
                      <Text className={`text-xs font-semibold uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                        Date
                      </Text>
                    </View>
                    {/* Capital */}
                    <View style={{ width: installmentColumnWidths.principal }} className="px-3 py-3">
                      <Text className={`text-xs font-semibold uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                        Capital
                      </Text>
                    </View>
                    {/* Intérêts */}
                    <View style={{ width: installmentColumnWidths.interest }} className="px-3 py-3">
                      <Text className={`text-xs font-semibold uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                        Intérêts
                      </Text>
                    </View>
                    {/* Total */}
                    <View style={{ width: installmentColumnWidths.total }} className="px-3 py-3">
                      <Text className={`text-xs font-semibold uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                        Total
                      </Text>
                    </View>
                    {/* Statut */}
                    <View style={{ width: installmentColumnWidths.status }} className="px-3 py-3">
                      <Text className={`text-xs font-semibold uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                        Statut
                      </Text>
                    </View>
                  </View>
                </ScrollView>
                {/* Actions (sticky à droite) */}
                <View
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: installmentColumnWidths.actions,
                    backgroundColor: isDark ? "#1e293b" : "#f9fafb",
                    borderLeftWidth: 1,
                    borderLeftColor: isDark ? "#334155" : "#e5e7eb",
                  }}
                  className="px-3 py-3 justify-center"
                >
                  <Text className={`text-xs font-semibold uppercase ${isDark ? "text-gray-400" : "text-gray-500"}`}>
                    Actions
                  </Text>
                </View>
              </View>

              {/* Liste des échéanciers */}
              <ScrollView className="flex-1">
                {installments.map((installment) => (
                  <View
                    key={installment.id}
                    className={`border-b ${
                      isDark
                        ? "border-gray-800 bg-[#0f172a]"
                        : "border-gray-100 bg-white"
                    }`}
                    style={{ position: "relative" }}
                  >
                    {/* Contenu scrollable */}
                    <ScrollView
                      nestedScrollEnabled={true}
                      ref={(ref) => {
                        if (ref) {
                          installmentContentScrollRefs.current.set(installment.id, ref);
                          if (installmentScrollXRef.current > 0) {
                            requestAnimationFrame(() => {
                              ref.scrollTo({
                                x: installmentScrollXRef.current,
                                animated: false,
                              });
                            });
                          }
                        } else {
                          installmentContentScrollRefs.current.delete(installment.id);
                        }
                      }}
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      onScroll={(e) => handleInstallmentContentScroll(e, installment.id)}
                      scrollEventThrottle={16}
                      contentContainerStyle={{
                        minWidth: totalInstallmentTableWidth - installmentColumnWidths.actions,
                        paddingRight: installmentColumnWidths.actions,
                      }}
                    >
                      <View
                        className="flex-row"
                        style={{ minWidth: totalInstallmentTableWidth - installmentColumnWidths.actions }}
                      >
                        {/* Numéro */}
                        <View style={{ width: installmentColumnWidths.number }} className="px-3 py-4 justify-center">
                          <Text className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                            #{installment.installmentNumber}
                          </Text>
                        </View>
                        {/* Date */}
                        <View style={{ width: installmentColumnWidths.date }} className="px-3 py-4 justify-center">
                          <Text className={`text-xs ${isDark ? "text-gray-400" : "text-gray-600"}`}>
                            {formatDate(installment.dueDate)}
                          </Text>
                          {installment.status === "PAID" && installment.paidAt && (
                            <Text className={`text-xs mt-1 ${isDark ? "text-green-400" : "text-green-600"}`}>
                              Payé: {formatDate(installment.paidAt)}
                            </Text>
                          )}
                        </View>
                        {/* Capital */}
                        <View style={{ width: installmentColumnWidths.principal }} className="px-3 py-4 justify-center">
                          <BlurredAmount
                            amount={installment.principalAmount}
                            currency={loanForInstallments?.currency ?? ""}
                            className="text-xs"
                          />
                        </View>
                        {/* Intérêts */}
                        <View style={{ width: installmentColumnWidths.interest }} className="px-3 py-4 justify-center">
                          <BlurredAmount
                            amount={installment.interestAmount}
                            currency={loanForInstallments?.currency ?? ""}
                            className="text-xs"
                          />
                        </View>
                        {/* Total */}
                        <View style={{ width: installmentColumnWidths.total }} className="px-3 py-4 justify-center">
                          <BlurredAmount
                            amount={installment.totalPayment}
                            currency={loanForInstallments?.currency ?? ""}
                            className={`text-xs font-semibold ${
                              installment.status === "PAID"
                                ? isDark ? "text-green-400" : "text-green-600"
                                : isDark ? "text-gray-100" : "text-gray-900"
                            }`}
                          />
                        </View>
                        {/* Statut */}
                        <View style={{ width: installmentColumnWidths.status }} className="px-3 py-4 justify-center">
                          <View
                            className="px-2 py-1 rounded-full self-start"
                            style={{
                              backgroundColor:
                                installment.status === "PAID"
                                  ? "#10b98120"
                                  : installment.status === "OVERDUE"
                                  ? "#ef444420"
                                  : "#fbbf2420",
                            }}
                          >
                            <Text
                              className="text-xs font-medium"
                              style={{
                                color:
                                  installment.status === "PAID"
                                    ? "#10b981"
                                    : installment.status === "OVERDUE"
                                    ? "#ef4444"
                                    : "#fbbf24",
                              }}
                            >
                              {installment.status === "PAID"
                                ? "Payé"
                                : installment.status === "OVERDUE"
                                ? "En retard"
                                : "En attente"}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </ScrollView>

                    {/* Actions (sticky à droite) */}
                    <View
                      style={{
                        position: "absolute",
                        right: 0,
                        top: 0,
                        bottom: 0,
                        width: installmentColumnWidths.actions,
                        backgroundColor: isDark ? "#0f172a" : "#ffffff",
                        borderLeftWidth: 1,
                        borderLeftColor: isDark ? "#1e293b" : "#e5e7eb",
                      }}
                      className="px-3 justify-center items-center"
                    >
                      {installment.status === "PENDING" && (
                        <Button
                          onPress={() => handlePayInstallment(installment)}
                          className="px-3 py-1.5"
                        >
                          <Text className="text-xs font-semibold text-white">Payer</Text>
                        </Button>
                      )}
                      {installment.status === "PAID" && (
                        <View className="flex-row items-center gap-2">
                          {canReverseInstallmentPayment(installment.paidAt) ? (
                            <TouchableOpacity
                              onPress={() => {
                                handleReverseInstallmentPayment(installment);
                              }}
                              className="px-2 py-1 rounded-lg"
                              style={{
                                backgroundColor: isDark ? "rgba(239, 68, 68, 0.2)" : "#fee2e2",
                                borderWidth: 1,
                                borderColor: isDark ? "#dc2626" : "#fca5a5",
                              }}
                              activeOpacity={0.7}
                            >
                              <HugeiconsIcon
                                icon={ReverseWithdrawal02Icon}
                                size={16}
                                color={isDark ? "#fca5a5" : "#dc2626"}
                              />
                            </TouchableOpacity>
                          ) : (
                            <TouchableOpacity
                              onPress={() => {
                                Alert.alert(
                                  "Impossible d'annuler",
                                  "Le paiement ne peut être annulé que 24h après avoir été effectué."
                                );
                              }}
                              className="px-2 py-1 rounded-lg opacity-50"
                              style={{
                                backgroundColor: isDark ? "rgba(107, 114, 128, 0.2)" : "#f3f4f6",
                                borderWidth: 1,
                                borderColor: isDark ? "#6b7280" : "#d1d5db",
                              }}
                              activeOpacity={0.7}
                            >
                              <HugeiconsIcon
                                icon={ReverseWithdrawal02Icon}
                                size={16}
                                color={isDark ? "#9ca3af" : "#6b7280"}
                              />
                            </TouchableOpacity>
                          )}
                          <HugeiconsIcon
                            icon={CheckmarkCircle02Icon}
                            size={20}
                            color={isDark ? "#10b981" : "#059669"}
                          />
                        </View>
                      )}
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          )}
        </View>
      </Drawer>

      {/* Drawer de confirmation de paiement */}
      <Drawer
        open={showPaymentDrawer}
        onOpenChange={(open) => {
          if (!open) {
            setShowPaymentDrawer(false);
            setInstallmentToPay(null);
          }
        }}
        title="Payer l'échéance"
      >
        <View className="gap-4">
          {installmentToPay && (
            <>
              <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Êtes-vous sûr de vouloir payer cette échéance ?
              </Text>
              <View className={`p-4 rounded-lg ${isDark ? 'bg-[#1e293b]' : 'bg-gray-50'}`}>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Échéance #{installmentToPay.installmentNumber}
                </Text>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Date: {formatDate(installmentToPay.dueDate)}
                </Text>
                <Text className={`text-lg font-semibold mt-2 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                  Montant: {installmentToPay.totalPayment.toLocaleString("fr-FR")} {loanForInstallments?.currency}
                </Text>
              </View>
            </>
          )}
          <View className="flex-row gap-3 mt-4">
            <Button
              variant="outline"
              onPress={() => {
                setShowPaymentDrawer(false);
                setInstallmentToPay(null);
                // Rouvrir le drawer des échéanciers si l'emprunt est toujours défini
                if (loanForInstallments) {
                  setTimeout(() => {
                    setShowInstallmentsDrawer(true);
                  }, 300);
                }
              }}
              className="flex-1"
              style={{
                borderColor: isDark ? "#475569" : "#d1d5db",
                backgroundColor: isDark ? "#1e293b" : "transparent",
              }}
            >
                <Text
                className={`text-sm font-medium ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
                >
                Annuler
                </Text>
            </Button>
            <Button
              onPress={confirmPayment}
              loading={isPaying}
              className="flex-1"
            >
              Confirmer le paiement
            </Button>
              </View>
        </View>
      </Drawer>

      {/* Drawer de confirmation d'annulation de paiement */}
      <Drawer
        open={showReverseDrawer}
        onOpenChange={(open) => {
          if (!open) {
            setShowReverseDrawer(false);
            setInstallmentToReverse(null);
          }
        }}
        title="Annuler le paiement"
      >
        <View className="gap-4">
          {installmentToReverse && (
            <>
              <Text className={`${isDark ? 'text-gray-300' : 'text-gray-700'}`}>
                Êtes-vous sûr de vouloir annuler le paiement de cette échéance ?
              </Text>
              <View className={`p-4 rounded-lg ${isDark ? 'bg-[#1e293b]' : 'bg-gray-50'}`}>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Échéance #{installmentToReverse.installmentNumber}
                </Text>
                <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                  Date: {formatDate(installmentToReverse.dueDate)}
                </Text>
                {installmentToReverse.paidAt && (
                  <Text className={`text-sm ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>
                    Payé le: {formatDate(installmentToReverse.paidAt)}
                  </Text>
                )}
                <Text className={`text-lg font-semibold mt-2 ${isDark ? 'text-gray-100' : 'text-gray-900'}`}>
                  Montant: {installmentToReverse.totalPayment.toLocaleString("fr-FR")} {loanForInstallments?.currency}
                </Text>
              </View>
              <View className={`p-4 rounded-lg ${isDark ? 'bg-orange-900/20 border border-orange-800' : 'bg-orange-50 border border-orange-200'}`}>
                <View className="flex-row gap-3">
                  <HugeiconsIcon
                    icon={AlertDiamondIcon}
                    size={20}
                    color={isDark ? "#fb923c" : "#ea580c"}
                  />
                  <View className="flex-1">
                    <Text className={`text-sm font-medium ${isDark ? 'text-orange-200' : 'text-orange-800'}`}>
                      Attention
                    </Text>
                    <Text className={`text-xs mt-1 ${isDark ? 'text-orange-300' : 'text-orange-700'}`}>
                      Cette action annulera le paiement et créera une dépense avec le statut "Paiement annulé" dans les dépenses.
                    </Text>
                  </View>
                </View>
              </View>
            </>
          )}
          <View className="flex-row gap-3 mt-4">
            <Button
              variant="outline"
              onPress={() => {
                setShowReverseDrawer(false);
                setInstallmentToReverse(null);
              }}
              className="flex-1"
            >
              Annuler
            </Button>
            <Button
              onPress={confirmReversePayment}
              disabled={isReversing}
              className="flex-1"
              style={{ backgroundColor: "#ef4444" }}
            >
              {isReversing ? (
                <ActivityIndicator size="small" color="#ffffff" />
              ) : (
                "Confirmer l'annulation"
              )}
            </Button>
          </View>
        </View>
      </Drawer>

      {/* Drawer de simulation d'emprunt */}
      <Drawer
        open={showSimulationModal}
        onOpenChange={(open) => {
          if (!open) {
            setShowSimulationModal(false);
            setSimulationResults(null);
          }
        }}
        title="Simulateur d'Emprunt"
      >
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          <Text
            className={`text-sm mb-6 ${
              isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Simulez vos remboursements potentiels sans affecter vos comptes réels
          </Text>

          <View className="gap-4 mb-6">
            {/* Montant */}
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Montant de l'emprunt
              </Text>
              <TextInput
                value={simulationData.amount}
                onChangeText={(text) =>
                  setSimulationData({ ...simulationData, amount: text })
                }
                placeholder="Ex: 10000000"
                keyboardType="numeric"
                className={`h-12 px-4 rounded-lg border ${
                  isDark
                    ? "bg-[#1e293b] border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              />
            </View>

            {/* Devise */}
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Devise
              </Text>
              <Select
                value={simulationData.currency}
                onValueChange={(value) =>
                  setSimulationData({ ...simulationData, currency: value })
                }
                items={[
                  { label: "GNF", value: "GNF" },
                  { label: "USD", value: "USD" },
                  { label: "EUR", value: "EUR" },
                  { label: "CAD", value: "CAD" },
                  { label: "XOF", value: "XOF" },
                ]}
              />
            </View>

            {/* Taux d'intérêt */}
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Taux d'intérêt annuel (%) <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                value={simulationData.interestRate}
                onChangeText={(text) =>
                  setSimulationData({ ...simulationData, interestRate: text })
                }
                placeholder="Ex: 5.5"
                keyboardType="decimal-pad"
                className={`h-12 px-4 rounded-lg border ${
                  isDark
                    ? "bg-[#1e293b] border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              />
            </View>

            {/* Durée */}
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Durée (en mois) <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                value={simulationData.durationMonths}
                onChangeText={(text) =>
                  setSimulationData({ ...simulationData, durationMonths: text })
                }
                placeholder="Ex: 12, 24, 36"
                keyboardType="numeric"
                className={`h-12 px-4 rounded-lg border ${
                  isDark
                    ? "bg-[#1e293b] border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              />
            </View>

            {/* Fréquence de remboursement */}
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Fréquence de remboursement
              </Text>
              <Select
                value={simulationData.repaymentFrequency}
                onValueChange={(value) =>
                  setSimulationData({ ...simulationData, repaymentFrequency: value as "MONTHLY" | "QUARTERLY" })
                }
                items={[
                  { label: "Mensuelle", value: "MONTHLY" },
                  { label: "Trimestrielle", value: "QUARTERLY" },
                ]}
              />
            </View>

            {/* Type de remboursement */}
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Type de remboursement
              </Text>
              <Select
                value={simulationData.repaymentType}
                onValueChange={(value) =>
                  setSimulationData({ ...simulationData, repaymentType: value as "AMORTIZABLE" | "IN_FINE" })
                }
                items={[
                  { label: "Amortissable", value: "AMORTIZABLE" },
                  { label: "In fine", value: "IN_FINE" },
                ]}
              />
            </View>

            {/* Méthode d'amortissement - Affiché uniquement si AMORTIZABLE */}
            {simulationData.repaymentType === "AMORTIZABLE" && (
              <View>
                <Text
                  className={`text-sm font-medium mb-2 ${
                    isDark ? "text-gray-300" : "text-gray-700"
                  }`}
                >
                  Méthode d'amortissement
                </Text>
                <Select
                  value={simulationData.amortizationMethod}
                  onValueChange={(value) =>
                    setSimulationData({ ...simulationData, amortizationMethod: value as "CONSTANT_PAYMENT" | "CONSTANT_CAPITAL" })
                  }
                  items={[
                    { label: "Mensualité constante", value: "CONSTANT_PAYMENT" },
                    { label: "Capital constant", value: "CONSTANT_CAPITAL" },
                  ]}
                />
              </View>
            )}

            {/* Convention de calcul */}
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Convention de calcul
              </Text>
              <Select
                value={simulationData.dayCountBasis}
                onValueChange={(value) =>
                  setSimulationData({ ...simulationData, dayCountBasis: value as "ACT_360" | "ACT_365" })
                }
                items={[
                  { label: "ACT/360", value: "ACT_360" },
                  { label: "ACT/365", value: "ACT_365" },
                ]}
              />
              <Text
                className={`text-xs mt-1 ${
                  isDark ? "text-gray-500" : "text-gray-400"
                }`}
              >
                {simulationData.dayCountBasis === "ACT_360"
                  ? "ACT/360 : intérêts calculés sur le nombre réel de jours, base 360."
                  : "ACT/365 : intérêts calculés sur le nombre réel de jours, base 365."}
              </Text>
      </View>

            {/* Date de début */}
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Date de début <Text className="text-red-500">*</Text>
              </Text>
              <TextInput
                value={simulationData.startDate}
                onChangeText={(text) =>
                  setSimulationData({ ...simulationData, startDate: text })
                }
                placeholder="YYYY-MM-DD"
                className={`h-12 px-4 rounded-lg border ${
                  isDark
                    ? "bg-[#1e293b] border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              />
            </View>

            {/* Frais bancaires initiaux */}
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Type de frais initiaux
              </Text>
              <Select
                value={simulationData.initialBankFeesType}
                onValueChange={(value) =>
                  setSimulationData({
                    ...simulationData,
                    initialBankFeesType: value as "AMOUNT" | "PERCENTAGE",
                    initialBankFees: "",
                  })
                }
                items={[
                  { label: "Montant fixe", value: "AMOUNT" },
                  { label: "% du capital emprunté", value: "PERCENTAGE" },
                ]}
              />
            </View>

            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Frais bancaires initiaux (optionnel)
              </Text>
              <TextInput
                value={simulationData.initialBankFees}
                onChangeText={(text) =>
                  setSimulationData({ ...simulationData, initialBankFees: text })
                }
                placeholder={
                  simulationData.initialBankFeesType === "PERCENTAGE"
                    ? "Ex: 2.5"
                    : "Ex: 100000"
                }
                keyboardType="decimal-pad"
                className={`h-12 px-4 rounded-lg border ${
                  isDark
                    ? "bg-[#1e293b] border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              />
            </View>

            {/* Intégration des frais au capital */}
            <TouchableOpacity
              onPress={() =>
                setSimulationData({
                  ...simulationData,
                  initialBankFeesAddedToCapital:
                    !simulationData.initialBankFeesAddedToCapital,
                })
              }
              className="flex-row items-center gap-2 mb-2"
            >
              <View
                className={`w-5 h-5 rounded border-2 items-center justify-center ${
                  simulationData.initialBankFeesAddedToCapital
                    ? "bg-blue-600 border-blue-600"
                    : isDark
                    ? "border-gray-600"
                    : "border-gray-300"
                }`}
              >
                {simulationData.initialBankFeesAddedToCapital && (
                  <HugeiconsIcon icon={CheckmarkCircle02Icon} size={16} color="#ffffff" />
                )}
              </View>
              <Text
                className={`text-sm ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Intégrer les frais au capital
              </Text>
            </TouchableOpacity>

            {/* Période de grâce */}
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Période de grâce (mois, optionnel)
              </Text>
              <TextInput
                value={simulationData.gracePeriodMonths}
                onChangeText={(text) =>
                  setSimulationData({ ...simulationData, gracePeriodMonths: text })
                }
                placeholder="Ex: 3"
                keyboardType="numeric"
                className={`h-12 px-4 rounded-lg border ${
                  isDark
                    ? "bg-[#1e293b] border-gray-600 text-gray-100"
                    : "bg-white border-gray-300 text-gray-900"
                }`}
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
              />
            </View>
          </View>

          {/* Résultats de simulation */}
          {simulationResults && simulationResults.schedule.length > 0 && (
            <View className="gap-4 mb-6">
              <Text
                className={`text-lg font-semibold ${
                  isDark ? "text-gray-100" : "text-gray-900"
                }`}
              >
                Échéancier de remboursement
              </Text>

              {/* Résumé */}
              <View className="gap-3">
                <View
                  className={`p-4 rounded-lg border ${
                    isDark ? "bg-blue-900/20 border-blue-800" : "bg-blue-50 border-blue-200"
                  }`}
                >
                  <Text
                    className={`text-sm mb-1 ${
                      isDark ? "text-blue-400" : "text-blue-600"
                    }`}
                  >
                    Montant emprunté
                  </Text>
                  <BlurredAmount
                    amount={parseFloat(simulationData.amount) || 0}
                    currency={simulationData.currency}
                    className="text-lg font-bold"
                  />
                </View>

                <View
                  className={`p-4 rounded-lg border ${
                    isDark ? "bg-orange-900/20 border-orange-800" : "bg-orange-50 border-orange-200"
                  }`}
                >
                  <Text
                    className={`text-sm mb-1 ${
                      isDark ? "text-orange-400" : "text-orange-600"
                    }`}
                  >
                    Intérêts totaux de la banque
                  </Text>
                  <BlurredAmount
                    amount={simulationResults.totalInterest}
                    currency={simulationData.currency}
                    className="text-lg font-bold"
                  />
                </View>

                <View
                  className={`p-4 rounded-lg border ${
                    isDark ? "bg-red-900/20 border-red-800" : "bg-red-50 border-red-200"
                  }`}
                >
                  <Text
                    className={`text-sm mb-1 ${
                      isDark ? "text-red-400" : "text-red-600"
                    }`}
                  >
                    Total à rembourser
                  </Text>
                  <BlurredAmount
                    amount={simulationResults.totalToRepay}
                    currency={simulationData.currency}
                    className="text-lg font-bold"
                  />
                </View>
              </View>

              {/* Tableau d'échéancier */}
              <View className="mt-4">
                <Text
                  className={`text-md font-semibold mb-3 ${
                    isDark ? "text-gray-100" : "text-gray-900"
                  }`}
                >
                  Détail des échéances
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View
                    className={`rounded-lg border ${
                      isDark ? "border-gray-700" : "border-gray-200"
                    }`}
                  >
                    {/* En-têtes */}
                    <View
                      className={`flex-row border-b ${
                        isDark ? "border-gray-700 bg-[#1e293b]" : "border-gray-200 bg-gray-50"
                      }`}
                    >
                      <View className="w-20 px-3 py-3">
                        <Text
                          className={`text-xs font-semibold ${
                            isDark ? "text-gray-400" : "text-gray-500"
                          }`}
                        >
                          Période
                        </Text>
                      </View>
                      <View className="w-28 px-3 py-3">
                        <Text
                          className={`text-xs font-semibold ${
                            isDark ? "text-gray-400" : "text-gray-500"
                          }`}
                        >
                          Date
                        </Text>
                      </View>
                      <View className="w-28 px-3 py-3">
                        <Text
                          className={`text-xs font-semibold ${
                            isDark ? "text-gray-400" : "text-gray-500"
                          }`}
                        >
                          Capital
                        </Text>
                      </View>
                      <View className="w-28 px-3 py-3">
                        <Text
                          className={`text-xs font-semibold ${
                            isDark ? "text-gray-400" : "text-gray-500"
                          }`}
                        >
                          Intérêts
                        </Text>
                      </View>
                      <View className="w-28 px-3 py-3">
                        <Text
                          className={`text-xs font-semibold ${
                            isDark ? "text-gray-400" : "text-gray-500"
                          }`}
                        >
                          Total
                        </Text>
                      </View>
                      <View className="w-28 px-3 py-3">
                        <Text
                          className={`text-xs font-semibold ${
                            isDark ? "text-gray-400" : "text-gray-500"
                          }`}
                        >
                          Solde restant
                        </Text>
                      </View>
                    </View>

                    {/* Lignes */}
                    {simulationResults.schedule.map((payment, index) => (
                      <View
                        key={index}
                        className={`flex-row border-b ${
                          isDark ? "border-gray-800" : "border-gray-100"
                        }`}
                      >
                        <View className="w-20 px-3 py-3">
                          <Text
                            className={`text-xs ${
                              isDark ? "text-gray-400" : "text-gray-600"
                            }`}
                          >
                            {payment.period}
                          </Text>
                        </View>
                        <View className="w-28 px-3 py-3">
                          <Text
                            className={`text-xs ${
                              isDark ? "text-gray-400" : "text-gray-600"
                            }`}
                          >
                            {formatDate(payment.date.toISOString())}
                          </Text>
                        </View>
                        <View className="w-28 px-3 py-3">
                          <BlurredAmount
                            amount={payment.principal}
                            currency={simulationData.currency}
                            className="text-xs"
                          />
                        </View>
                        <View className="w-28 px-3 py-3">
                          <BlurredAmount
                            amount={payment.interest}
                            currency={simulationData.currency}
                            className={`text-xs ${
                              isDark ? "text-orange-400" : "text-orange-600"
                            }`}
                          />
                        </View>
                        <View className="w-28 px-3 py-3">
                          <BlurredAmount
                            amount={payment.total}
                            currency={simulationData.currency}
                            className="text-xs font-semibold"
                          />
                        </View>
                        <View className="w-28 px-3 py-3">
                          <BlurredAmount
                            amount={payment.remainingBalance}
                            currency={simulationData.currency}
                            className="text-xs"
                          />
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
          )}

          <View className="flex-row gap-3 mt-6">
            <TouchableOpacity
              onPress={() => {
                setShowSimulationModal(false);
                setSimulationResults(null);
              }}
              className="flex-1 py-3 rounded-full items-center border"
              style={{
                borderColor: isDark ? "#374151" : "#e5e7eb",
                backgroundColor: isDark ? "transparent" : "transparent",
              }}
              activeOpacity={0.7}
            >
              <Text
                className={`font-semibold ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Fermer
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </Drawer>

      {/* Drawer de détails des emprunts */}
      <Drawer
        open={showDetailsModal}
        onOpenChange={(open) => {
          if (open && !selectedCompanyId && !selectedSectorId && companyLoans.length === 0) {
            // Si le drawer s'ouvre sans filtres et sans données, charger tous les emprunts
            openDetailsModal(null, null);
          } else if (!open) {
            setShowDetailsModal(false);
            setSelectedCompanyId(null);
            setSelectedSectorId(null);
            setCompanyLoans([]);
          }
        }}
        title="Investir des Emprunts"
      >
        <ScrollView showsVerticalScrollIndicator={false} className="flex-1">
          <Text
            className={`text-sm mb-6 ${
              isDark ? "text-gray-400" : "text-gray-600"
            }`}
          >
            Emprunts actifs par entreprise et secteur d'activité
          </Text>

          {/* Filtres */}
          <View className="gap-4 mb-6">
            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Filtrer par secteur d'activité
              </Text>
              <Select
                value={selectedSectorId || "all"}
                onValueChange={(value) => {
                  const finalSectorId = value === "all" ? null : value;
                  // Si "Tous les secteurs" est sélectionné, réinitialiser aussi le filtre entreprise
                  const finalCompanyId = value === "all" ? null : selectedCompanyId;
                  openDetailsModal(finalCompanyId, finalSectorId);
                }}
                items={[
                  { label: "Tous les secteurs", value: "all" },
                  ...(activitySectors.map((sector) => ({
                    label: sector.name,
                    value: sector.id,
                  }))),
                ]}
              />
            </View>

            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Filtrer par entreprise
              </Text>
              <Select
                value={selectedCompanyId || "all"}
                onValueChange={(value) => {
                  const finalCompanyId = value === "all" ? null : value;
                  openDetailsModal(finalCompanyId, selectedSectorId);
                }}
                items={[
                  { label: "Toutes les entreprises", value: "all" },
                  ...((selectedSectorId ? filteredCompanies : companies || []).map((company: Company) => ({
                    label: company.name,
                    value: company.id,
                  }))),
                ]}
                disabled={!selectedSectorId && (filteredCompanies.length === 0 || (companies || []).length === 0)}
              />
            </View>
          </View>

          {/* Liste des emprunts */}
          {loadingDetails ? (
            <View className="items-center justify-center py-12">
              <ActivityIndicator
                size="large"
                color={isDark ? "#60a5fa" : "#0ea5e9"}
              />
            </View>
          ) : companyLoans.length > 0 ? (
            <View className="gap-4">
              {companyLoans.map((loan) => {
                const stats = (loan as any).amortizationStats || {
                  totalAmortized: 0,
                  remainingBalance: loan.amount,
                };
                const investedAmount = (loan as any).investedAmount || 0;
                const availableToInvest = loan.amount - investedAmount;

                return (
                  <View
                    key={loan.id}
                    className={`p-4 rounded-lg border ${
                      isDark ? "border-gray-700 bg-[#1e293b]" : "border-gray-200 bg-white"
                    }`}
                  >
                    <View className="flex-row items-start justify-between mb-4">
                      <View className="flex-1">
                        <Text
                          className={`text-lg font-semibold ${
                            isDark ? "text-gray-100" : "text-gray-900"
                          }`}
                        >
                          {loan.company.name}
                        </Text>
                        <Text
                          className={`text-sm mt-1 ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                        >
                          {loan.bankName || loan.bank?.name || "N/A"} • {formatDate(loan.startDate)}
                        </Text>
                      </View>
                      <View
                        className="px-2 py-1 rounded-full"
                        style={{
                          backgroundColor:
                            loan.status === "ACTIVE"
                              ? "#10b98120"
                              : "#6b728020",
                        }}
                      >
                        <Text
                          className="text-xs font-medium"
                          style={{
                            color:
                              loan.status === "ACTIVE"
                                ? "#10b981"
                                : "#6b7280",
                          }}
                        >
                          {loan.status === "ACTIVE" ? "Actif" : loan.status}
                        </Text>
                      </View>
                    </View>

                    <View className="gap-3">
                      <View className="flex-row justify-between items-center gap-2">
                        <Text
                          className={`text-xs flex-shrink ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                          numberOfLines={1}
                        >
                          Montant initial
                        </Text>
                        <View style={{ flexShrink: 0 }}>
                          <BlurredAmount
                            amount={loan.amount}
                            currency={loan.currency}
                            className="text-xs font-semibold"
                          />
                        </View>
                      </View>

                      <View className="flex-row justify-between items-center gap-2">
                        <Text
                          className={`text-xs flex-shrink ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                          numberOfLines={1}
                        >
                          Total amorti
                        </Text>
                        <View style={{ flexShrink: 0 }}>
                          <BlurredAmount
                            amount={stats.totalAmortized}
                            currency={loan.currency}
                            className={`text-xs font-semibold ${
                              isDark ? "text-blue-400" : "text-blue-600"
                            }`}
                          />
                        </View>
                      </View>

                      <View className="flex-row justify-between items-center gap-2">
                        <Text
                          className={`text-xs flex-shrink ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                          numberOfLines={1}
                        >
                          Solde restant
                        </Text>
                        <View style={{ flexShrink: 0 }}>
                          <BlurredAmount
                            amount={stats.remainingBalance}
                            currency={loan.currency}
                            className={`text-xs font-semibold ${
                              isDark ? "text-orange-400" : "text-orange-600"
                            }`}
                          />
                        </View>
                      </View>

                      <View className="flex-row justify-between items-center gap-2">
                        <Text
                          className={`text-xs flex-shrink ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                          numberOfLines={1}
                        >
                          Emprunt investi
                        </Text>
                        <View style={{ flexShrink: 0 }}>
                          <BlurredAmount
                            amount={investedAmount}
                            currency={loan.currency}
                            className={`text-xs font-semibold ${
                              isDark ? "text-purple-400" : "text-purple-600"
                            }`}
                          />
                        </View>
                      </View>

                      <View className="flex-row justify-between items-center gap-2">
                        <Text
                          className={`text-xs flex-shrink ${
                            isDark ? "text-gray-400" : "text-gray-600"
                          }`}
                          numberOfLines={1}
                        >
                          Disponible à investir
                        </Text>
                        <View style={{ flexShrink: 0 }}>
                          <BlurredAmount
                            amount={availableToInvest}
                            currency={loan.currency}
                            className={`text-xs font-semibold ${
                              availableToInvest > 0
                                ? isDark
                                  ? "text-green-400"
                                  : "text-green-600"
                                : isDark
                                ? "text-gray-500"
                                : "text-gray-400"
                            }`}
                          />
                        </View>
                      </View>
                    </View>

                    {/* Bouton Investir emprunt dans nos actifs */}
                    {availableToInvest > 0 && loan.status === "ACTIVE" && (
                      <Button
                        onPress={() => {
                          setShowDetailsModal(false);
                          setTimeout(() => {
                            setLoanToInvest(loan);
                            setInvestmentAmount(availableToInvest.toString());
                            setShowInvestLoanDrawer(true);
                          }, 300);
                        }}
                        variant="outline"
                        className="mt-4 w-full"
                      >
                        <View className="flex-row items-center justify-center gap-2">
                          <HugeiconsIcon
                            icon={MoneySend01Icon}
                            size={18}
                            color={isDark ? "#60a5fa" : "#0ea5e9"}
                          />
                          <Text
                            className={`text-sm font-medium ${
                              isDark ? "text-blue-400" : "text-blue-600"
                            }`}
                          >
                            Investir emprunt dans nos actifs
                          </Text>
                        </View>
                      </Button>
                    )}
                  </View>
                );
              })}
            </View>
          ) : (
            <View className="items-center justify-center py-12">
              <Text
                className={`text-center ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Aucun emprunt actif trouvé
              </Text>
            </View>
          )}

          <View className="flex-row gap-3 mt-6">
            <Button
              onPress={() => {
                setShowDetailsModal(false);
                setSelectedCompanyId(null);
                setSelectedSectorId(null);
                setCompanyLoans([]);
              }}
              variant="outline"
              className="flex-1"
              style={{
                borderColor: isDark ? "#475569" : "#d1d5db",
                backgroundColor: isDark ? "#1e293b" : "transparent",
              }}
            >
              <Text
                className={`text-sm font-medium ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Fermer
              </Text>
            </Button>
          </View>
        </ScrollView>
      </Drawer>

      {/* Drawer Investir emprunt */}
      <Drawer
        open={showInvestLoanDrawer}
        onOpenChange={(open) => {
          setShowInvestLoanDrawer(open);
          if (!open) {
            setLoanToInvest(null);
            setInvestmentAmount("");
          }
        }}
        title="Investir l'emprunt"
        footer={
          <View className="flex-row gap-3">
            <Button
              onPress={() => {
                setShowInvestLoanDrawer(false);
                setLoanToInvest(null);
                setInvestmentAmount("");
              }}
              variant="outline"
              className="flex-1"
              disabled={isInvestingLoan}
              style={{
                borderColor: isDark ? "#475569" : "#d1d5db",
                backgroundColor: isDark ? "#1e293b" : "transparent",
              }}
            >
              <Text
                className={`text-sm font-medium ${
                  isDark ? "text-gray-200" : "text-gray-700"
                }`}
              >
                Annuler
              </Text>
            </Button>
            <Button
              onPress={handleInvestLoan}
              loading={isInvestingLoan}
              disabled={isInvestingLoan}
              className="flex-1"
            >
              {isInvestingLoan ? "Investissement..." : "Investir"}
            </Button>
          </View>
        }
      >
        {loanToInvest && (
          <View className="gap-4">
            <View
              className={`p-4 rounded-lg ${
                isDark ? "bg-blue-900/20" : "bg-blue-50"
              }`}
            >
              <Text
                className={`text-xs mb-2 ${
                  isDark ? "text-gray-400" : "text-gray-600"
                }`}
              >
                Emprunt
              </Text>
              <Text
                className={`text-base font-semibold mb-3 ${
                  isDark ? "text-gray-100" : "text-gray-900"
                }`}
              >
                {loanToInvest.company.name}
              </Text>
              <View className="gap-2">
                <View className="flex-row justify-between items-center">
                  <Text
                    className={`text-xs ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Montant initial
                  </Text>
                  <BlurredAmount
                    amount={loanToInvest.amount}
                    currency={loanToInvest.currency}
                    className={`text-xs font-semibold ${
                      isDark ? "text-gray-200" : "text-gray-800"
                    }`}
                  />
                </View>
                <View className="flex-row justify-between items-center">
                  <Text
                    className={`text-xs ${
                      isDark ? "text-gray-400" : "text-gray-600"
                    }`}
                  >
                    Disponible
                  </Text>
                  <BlurredAmount
                    amount={(() => {
                      const investedAmount = (loanToInvest as any).investedAmount || 0;
                      return loanToInvest.amount - investedAmount;
                    })()}
                    currency={loanToInvest.currency}
                    className={`text-xs font-semibold ${
                      isDark ? "text-green-400" : "text-green-600"
                    }`}
                  />
                </View>
              </View>
            </View>

            <View>
              <Text
                className={`text-sm font-medium mb-2 ${
                  isDark ? "text-gray-300" : "text-gray-700"
                }`}
              >
                Montant à investir
              </Text>
              <TextInput
                value={investmentAmount}
                onChangeText={(text) => setInvestmentAmount(formatDecimalInput(text))}
                placeholder="Montant"
                placeholderTextColor={isDark ? "#6b7280" : "#9ca3af"}
                keyboardType="numeric"
                className={`px-4 py-3 rounded-lg ${
                  isDark
                    ? "bg-[#1e293b] text-gray-100 border border-gray-700"
                    : "bg-gray-100 text-gray-900 border border-gray-300"
                }`}
                style={{
                  textAlignVertical: "center",
                  includeFontPadding: false,
                  paddingVertical: 0,
                }}
              />
              <Text
                className={`text-xs mt-2 ${
                  isDark ? "text-gray-500" : "text-gray-500"
                }`}
              >
                Note: Le montant initial à rembourser sera toujours tracé, même après investissement.
              </Text>
            </View>
          </View>
        )}
      </Drawer>
    </SafeAreaView>
  );
}
