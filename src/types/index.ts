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







