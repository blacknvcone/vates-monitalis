// ============================================================
// Monetalis - Shared Types
// ============================================================

// Raw Payload CMS response types
export interface PayloadResponse<T> {
  docs: T[];
  totalDocs: number;
  limit: number;
  totalPages: number;
  page: number;
  pagingCounter: number;
  hasPrevPage: boolean;
  hasNextPage: boolean;
  prevPage: number | null;
  nextPage: number | null;
}

export interface PayloadDoc {
  id: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// KPR Domain Types
// ============================================================

export interface KprLoan extends PayloadDoc {
  borrowerName: string;
  coBorrower?: string;
  bankName: string;
  branch?: string;
  loanAmount: number;
  housePrice: number;
  downPayment: number;
  tenorMonths: number;
  firstPayment: string;
  offeringLetterRef?: string;
  propertyAddress?: string;
  certificateNo?: string;
  collateralValue?: number;
  penaltyBeforeMinTenor: number;
  penaltyAfterMinTenor: number;
  minTenorMonths: number;
  minPartialPrepayment: number;
}

export interface KprRateTier extends PayloadDoc {
  loan: string | KprLoan;
  tierOrder: number;
  startMonth: number;
  endMonth: number;
  ratePct: number;
  installment: number;
}

export interface KprScheduleEntry extends PayloadDoc {
  loan: string | KprLoan;
  monthNumber: number;
  calendarDate: string;
  principalPortion: number;
  interestPortion: number;
  totalInstallment: number;
  outstandingBalance: number;
  interestRate: number;
  isPaid: boolean;
  paidDate?: string;
  paidAmount?: number;
  notes?: string;
}

export interface KprExtraPayment extends PayloadDoc {
  loan: string | KprLoan;
  paymentDate: string;
  amount: number;
  note?: string;
}

export interface KprReminder extends PayloadDoc {
  loan: string | KprLoan;
  email: string;
  reminderDay: number;
  isActive: boolean;
  lastSentAt?: string;
}

export interface KprSimulation extends PayloadDoc {
  loan: string | KprLoan;
  name: string;
  scenarioType: 'early_payoff' | 'extra_payment' | 'refinance';
  params: Record<string, unknown>;
  results: Record<string, unknown>;
}

// ============================================================
// Computed / API Types
// ============================================================

export interface KprStatus {
  currentMonth: number;
  currentDate: string;
  currentRate: number;
  currentInstallment: number;
  outstandingBalance: number;
  totalPaid: number;
  totalPrincipalPaid: number;
  totalInterestPaid: number;
  pctPaid: number;
  monthsRemaining: number;
  nextPaymentDate: string;
  nextPaymentAmount: number;
  nextPaymentPrincipal: number;
  nextPaymentInterest: number;
  nextBalanceAfter: number;
  currentPhase: number;
  nextPhaseMonth?: number;
  nextPhaseRate?: number;
  monthsUntilNextPhase?: number;
}

export interface EarlyPayoffResult {
  targetMonth: number;
  calendarDate: string;
  outstandingPrincipal: number;
  penaltyRate: number;
  penaltyAmount: number;
  totalToPayBank: number;
  alreadyPaid: number;
  grandTotal: number;
  savingsVsFull: number;
  savingsPct: number;
  breakEvenMonths: number;
  currentInterestRate: number;
  monthlyInterestSaved: number;
}

export interface ExtraPaymentResult {
  originalTenor: number;
  newTenor: number;
  monthsSaved: number;
  totalInterestOriginal: number;
  totalInterestNew: number;
  interestSaved: number;
}

export interface Milestone {
  type: 'rate_change' | 'payoff_opportunity' | 'percentage_reached' | 'penalty_change';
  date: string;
  title: string;
  description: string;
  urgency: 'info' | 'warning' | 'critical';
}

export interface OpportunityCostRow {
  instrument: string;
  annualReturn: number;
  vsKprRate: number;
  verdict: 'lebih_murah' | 'sebanding' | 'lebih_mahal';
}

export interface FinancialInsights {
  milestones: Milestone[];
  opportunityCost: OpportunityCostRow[];
  recommendation: string;
}

// ============================================================
// Phase Info
// ============================================================

export interface PhaseInfo {
  phase: number;
  startMonth: number;
  endMonth: number;
  rate: number;
  installment: number;
  startDate: string;
  endDate: string;
  label: string;
}
