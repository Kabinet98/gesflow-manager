export interface User {
  id: string;
  email: string;
  name: string;
  active: boolean;
  theme?: 'light' | 'dark';
  colorScheme?: 'light' | 'dark';
  twoFactorEnabled: boolean;
  securityQuestionsEnabled: boolean;
  role: {
    id: string;
    name: string;
    permissions: Array<{
      permission: {
        id: string;
        name: string;
        resource: string;
        action: string;
      };
    }>;
  };
  createdAt: string;
  lastLogin?: string;
  /** Workspace de l'utilisateur (retourné par /api/users/me) */
  workspace?: {
    id: string;
    name: string;
  };
}

export interface Permission {
  id: string;
  name: string;
  resource: string;
  action: string;
}

export interface Company {
  id: string;
  name: string;
  currency: string;
  country: string | { id: string; name: string };
  activitySectorId: string;
  activitySector?: {
    id: string;
    name: string;
  };
}

export interface Expense {
  id: string;
  amount: number;
  currency: string;
  description: string;
  type: 'INCOME' | 'OUTCOME';
  status: 'ACTIVE' | 'INACTIVE' | 'CANCELLED';
  validationStatus?: 'PENDING' | 'APPROVED' | 'REJECTED';
  companyId: string;
  company?: Company;
  createdAt: string;
  updatedAt: string;
  isDatTransfer?: boolean;
  loanId?: string | null;
  isLoanInvestment?: boolean;
  installmentPaymentReversed?: boolean; // Indique si le paiement d'échéance a été annulé
  category?: 'Business' | 'Famille' | null;
}

export interface Investment {
  id: string;
  amount: number;
  currency: string;
  description: string;
  categoryId: string;
  companyId: string;
  createdAt: string;
}

export interface Loan {
  id: string;
  amount: number;
  currency: string;
  interestRate: number;
  startDate: string;
  endDate: string;
  status: 'ACTIVE' | 'PAID' | 'DEFAULTED';
  companyId: string;
}

export interface ApiResponse<T> {
  data?: T;
  error?: string;
}

export interface LandTitleDocument {
  id: string;
  landTitleId: string;
  workspaceId: string | null;
  title: string;
  filename: string;
  url: string;
  objectName: string | null;
  fileType: string | null;
  fileSize: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LandTitle {
  id: string;
  userId: string;
  workspaceId: string | null;
  name: string;
  titleNumber: string | null;
  description: string | null;
  area: number | null;
  areaUnit: string;
  purchasePrice: number | null;
  currency: string;
  purchaseDate: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  boundaries: Array<{ lat: number; lng: number }> | null;
  centerLat: number | null;
  centerLng: number | null;
  status: 'ACTIVE' | 'ARCHIVED';
  documents: LandTitleDocument[];
  createdAt: string;
  updatedAt: string;
}







