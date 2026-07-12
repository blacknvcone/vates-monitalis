// ============================================================
// Mock Data Provider
// Generates consistent KPR data for all pages until CMS is connected
// ============================================================

import type { KprLoan, KprScheduleEntry, KprRateTier, PhaseInfo } from '@/types';

const FIRST_PAYMENT = '2023-11-01';

// ============================================================
// Loan Metadata
// ============================================================

export const MOCK_LOAN: KprLoan = {
  id: 'mock-loan-1',
  borrowerName: 'Fachrul Dani Prasetya',
  coBorrower: 'Nur Winingsih',
  bankName: 'BRI',
  branch: 'Kanca HR Muhammad',
  loanAmount: 415_000_000,
  housePrice: 539_000_000,
  downPayment: 124_000_000,
  tenorMonths: 240,
  firstPayment: FIRST_PAYMENT,
  offeringLetterRef: 'B.2069-KC-SBY-10-2023',
  propertyAddress: 'Perumahan Citra Mandiri Regency, Blok G2 No. 24, Kebonagung, Sukodono, Sidoarjo',
  certificateNo: 'SHGB No. 2077',
  collateralValue: 518_750_000,
  penaltyBeforeMinTenor: 10,
  penaltyAfterMinTenor: 2.5,
  minTenorMonths: 36,
  minPartialPrepayment: 6,
  createdAt: '2023-10-23',
  updatedAt: '2023-10-23',
};

// ============================================================
// Rate Tiers
// ============================================================

export const MOCK_RATE_TIERS: KprRateTier[] = [
  { id: 'tier-1', loan: 'mock-loan-1', tierOrder: 1, startMonth: 1, endMonth: 36, ratePct: 4.75, installment: 2_681_900, createdAt: '', updatedAt: '' },
  { id: 'tier-2', loan: 'mock-loan-1', tierOrder: 2, startMonth: 37, endMonth: 72, ratePct: 8.00, installment: 3_367_400, createdAt: '', updatedAt: '' },
  { id: 'tier-3', loan: 'mock-loan-1', tierOrder: 3, startMonth: 73, endMonth: 240, ratePct: 10.25, installment: 3_815_600, createdAt: '', updatedAt: '' },
];

export const MOCK_PHASES: PhaseInfo[] = [
  { phase: 1, startMonth: 1, endMonth: 36, rate: 4.75, installment: 2_681_900, startDate: '2023-11-01', endDate: '2026-10-01', label: 'Fase 1 (4.75%)' },
  { phase: 2, startMonth: 37, endMonth: 72, rate: 8.00, installment: 3_367_400, startDate: '2026-11-01', endDate: '2029-10-01', label: 'Fase 2 (8.00%)' },
  { phase: 3, startMonth: 73, endMonth: 240, rate: 10.25, installment: 3_815_600, startDate: '2029-11-01', endDate: '2043-10-01', label: 'Fase 3 (10.25%)' },
];

// ============================================================
// Schedule Generator
// ============================================================

function getPhaseForMonth(month: number): KprRateTier {
  if (month <= 36) return MOCK_RATE_TIERS[0];
  if (month <= 72) return MOCK_RATE_TIERS[1];
  return MOCK_RATE_TIERS[2];
}

function addMonthsToDate(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

export function generateMockSchedule(): KprScheduleEntry[] {
  const entries: KprScheduleEntry[] = [];
  let balance = 415_000_000;

  // Entry for month 0 (starting balance)
  entries.push({
    id: 'sched-0',
    loan: 'mock-loan-1',
    monthNumber: 0,
    calendarDate: FIRST_PAYMENT,
    principalPortion: 0,
    interestPortion: 0,
    totalInstallment: 0,
    outstandingBalance: balance,
    interestRate: 0,
    isPaid: false,
    createdAt: '',
    updatedAt: '',
  });

  for (let month = 1; month <= 240; month++) {
    const phase = getPhaseForMonth(month);
    const monthlyRate = phase.ratePct / 100 / 12;
    const installment = phase.installment;

    // Last month: adjust installment to clear balance
    let interest = Math.round(balance * monthlyRate);
    let principal = installment - interest;

    if (month === 240) {
      principal = balance;
      interest = Math.round(balance * monthlyRate);
    }

    balance = balance - principal;
    if (balance < 0) balance = 0;

    const calendarDate = addMonthsToDate(FIRST_PAYMENT, month - 1);
    const isPaid = month <= 33; // Current month is 33

    entries.push({
      id: `sched-${month}`,
      loan: 'mock-loan-1',
      monthNumber: month,
      calendarDate,
      principalPortion: principal,
      interestPortion: interest,
      totalInstallment: month === 240 ? principal + interest : installment,
      outstandingBalance: balance,
      interestRate: phase.ratePct,
      isPaid,
      paidDate: isPaid ? calendarDate : undefined,
      paidAmount: isPaid ? (month === 240 ? principal + interest : installment) : undefined,
      createdAt: '',
      updatedAt: '',
    });
  }

  return entries;
}

// ============================================================
// Current Status (computed from schedule)
// ============================================================

export function getCurrentStatus() {
  const schedule = generateMockSchedule();
  const currentMonth = 33;
  const currentEntry = schedule[currentMonth];
  const nextEntry = schedule[currentMonth + 1];

  const totalPaid = schedule
    .filter((e) => e.isPaid && e.monthNumber > 0)
    .reduce((sum, e) => sum + e.totalInstallment, 0);

  const totalPrincipalPaid = schedule
    .filter((e) => e.isPaid && e.monthNumber > 0)
    .reduce((sum, e) => sum + e.principalPortion, 0);

  const totalInterestPaid = schedule
    .filter((e) => e.isPaid && e.monthNumber > 0)
    .reduce((sum, e) => sum + e.interestPortion, 0);

  const phase = getPhaseForMonth(currentMonth + 1);
  const nextPhase = currentMonth < 36 ? MOCK_RATE_TIERS[1] : currentMonth < 72 ? MOCK_RATE_TIERS[2] : null;

  return {
    currentMonth,
    currentDate: '2026-07-01',
    currentRate: phase.ratePct,
    currentInstallment: phase.installment,
    outstandingBalance: currentEntry.outstandingBalance,
    totalPaid,
    totalPrincipalPaid,
    totalInterestPaid,
    pctPaid: ((415_000_000 - currentEntry.outstandingBalance) / 415_000_000) * 100,
    monthsRemaining: 240 - currentMonth,
    nextPaymentDate: nextEntry.calendarDate,
    nextPaymentAmount: nextEntry.totalInstallment,
    nextPaymentPrincipal: nextEntry.principalPortion,
    nextPaymentInterest: nextEntry.interestPortion,
    nextBalanceAfter: nextEntry.outstandingBalance,
    currentPhase: currentMonth <= 36 ? 1 : currentMonth <= 72 ? 2 : 3,
    nextPhaseMonth: nextPhase?.startMonth,
    nextPhaseRate: nextPhase?.ratePct,
    monthsUntilNextPhase: nextPhase ? nextPhase.startMonth - currentMonth : undefined,
  };
}

// ============================================================
// Simulation Helpers
// ============================================================

export function simulateEarlyPayoff(targetMonth: number) {
  const schedule = generateMockSchedule();
  const entry = schedule[targetMonth];
  if (!entry) return null;

  const loan = MOCK_LOAN;
  const isAfterMinTenor = targetMonth >= loan.minTenorMonths;
  const penaltyRate = isAfterMinTenor ? loan.penaltyAfterMinTenor : loan.penaltyBeforeMinTenor;
  const penaltyAmount = Math.round(entry.outstandingBalance * penaltyRate / 100);
  const totalToPayBank = entry.outstandingBalance + penaltyAmount;

  const alreadyPaid = schedule
    .filter((e) => e.monthNumber > 0 && e.monthNumber <= targetMonth)
    .reduce((sum, e) => sum + e.totalInstallment, 0);

  const grandTotal = alreadyPaid + totalToPayBank;
  const totalFull = 858_782_131;
  const savingsVsFull = totalFull - grandTotal;
  const monthlyInterest = Math.round(entry.outstandingBalance * entry.interestRate / 100 / 12);
  const breakEvenMonths = Math.ceil(penaltyAmount / monthlyInterest);

  return {
    targetMonth,
    calendarDate: entry.calendarDate,
    outstandingPrincipal: entry.outstandingBalance,
    penaltyRate,
    penaltyAmount,
    totalToPayBank,
    alreadyPaid,
    grandTotal,
    savingsVsFull,
    savingsPct: (savingsVsFull / totalFull) * 100,
    breakEvenMonths,
    currentInterestRate: entry.interestRate,
    monthlyInterestSaved: monthlyInterest,
  };
}

export function simulateExtraPayment(monthlyExtra: number, startMonth: number) {
  let balance = 415_000_000;
  let totalInterestOriginal = 0;
  let totalInterestNew = 0;
  let month = 0;

  // Calculate original total interest
  for (let m = 1; m <= 240; m++) {
    const phase = getPhaseForMonth(m);
    const monthlyRate = phase.ratePct / 100 / 12;
    const interest = Math.round(balance * monthlyRate);
    totalInterestOriginal += interest;
    const principal = phase.installment - interest;
    balance -= principal;
  }

  // Reset and calculate with extra payment
  balance = 415_000_000;
  for (let m = 1; m <= 300; m++) { // max 300 months safety
    const phase = getPhaseForMonth(m > 240 ? 240 : m);
    const monthlyRate = phase.ratePct / 100 / 12;
    const interest = Math.round(balance * monthlyRate);
    totalInterestNew += interest;

    let principal = phase.installment - interest;
    if (m >= startMonth) {
      principal += monthlyExtra;
    }

    if (principal >= balance) {
      balance = 0;
      month = m;
      break;
    }

    balance -= principal;
    month = m;
  }

  return {
    originalTenor: 240,
    newTenor: month,
    monthsSaved: 240 - month,
    totalInterestOriginal,
    totalInterestNew,
    interestSaved: totalInterestOriginal - totalInterestNew,
  };
}
