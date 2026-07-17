// ============================================================
// CMS Response Adapters
// Transforms CMS API responses into UI-expected shapes
// ============================================================

import type {
  KprStatus,
  KprScheduleEntry,
  KprRateTier,
  PhaseInfo,
  PayloadResponse,
} from '@/types';
import type { CmsStatusResponse } from '@/lib/api';

// Default loan ID (from CMS seed data)
export const DEFAULT_LOAN_ID = '6a534312df4c6f6adce3c64e';

// ============================================================
// Status Adapter
// ============================================================

/**
 * Parse "Bulan 1-36" → 1
 */
function parsePhaseNumber(phaseStr: string): number {
  const match = phaseStr.match(/Bulan\s+(\d+)-/);
  if (!match) return 1;
  const startMonth = parseInt(match[1], 10);
  if (startMonth <= 36) return 1;
  if (startMonth <= 72) return 2;
  return 3;
}

export function adaptCmsStatus(cmsStatus: CmsStatusResponse): KprStatus {
  const cms: CmsStatusResponse = cmsStatus;
  const currentPhase = parsePhaseNumber(cms.currentPhase);
  const monthsRemaining = cms.tenorMonths - cms.currentMonth;

  // Calculate nextBalanceAfter from nextPayment
  // outstandingBalance - nextPayment.principal
  const nextBalanceAfter = cms.nextPayment
    ? cms.outstandingBalance - cms.nextPayment.principal
    : 0;

  // Derive nextPhaseMonth from monthsUntilNextPhase
  const nextPhaseMonth = cms.monthsUntilNextPhase
    ? cms.currentMonth + cms.monthsUntilNextPhase
    : undefined;

  return {
    currentMonth: cms.currentMonth,
    currentDate: new Date().toISOString().split('T')[0],
    currentRate: cms.currentRate,
    currentInstallment: cms.currentInstallment,
    outstandingBalance: cms.outstandingBalance,
    totalPaid: cms.totalPaid,
    totalPrincipalPaid: cms.totalPrincipalPaid,
    totalInterestPaid: cms.totalInterestPaid,
    pctPaid: cms.progressPct,
    monthsRemaining,
    nextPaymentDate: cms.nextPayment?.date ?? '',
    nextPaymentAmount: cms.nextPayment?.total ?? 0,
    nextPaymentPrincipal: cms.nextPayment?.principal ?? 0,
    nextPaymentInterest: cms.nextPayment?.interest ?? 0,
    nextBalanceAfter,
    currentPhase,
    nextPhaseMonth,
    nextPhaseRate: cms.nextPhaseRate ?? undefined,
    monthsUntilNextPhase: cms.monthsUntilNextPhase ?? undefined,
  };
}

// ============================================================
// Schedule Adapter
// ============================================================

export function adaptCmsSchedule(res: PayloadResponse<KprScheduleEntry>): KprScheduleEntry[] {
  return res.docs;
}

// ============================================================
// Rate Tiers → PhaseInfo Adapter
// ============================================================

function addMonthsToDate(dateStr: string, months: number): string {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().split('T')[0];
}

export function adaptRateTiersToPhases(
  tiers: KprRateTier[],
  firstPayment: string,
): PhaseInfo[] {
  return tiers
    .sort((a, b) => a.tierOrder - b.tierOrder)
    .map((tier) => ({
      phase: tier.tierOrder,
      startMonth: tier.startMonth,
      endMonth: tier.endMonth,
      rate: tier.ratePct,
      installment: tier.installment,
      startDate: addMonthsToDate(firstPayment, tier.startMonth - 1),
      endDate: addMonthsToDate(firstPayment, tier.endMonth - 1),
      label: `Fase ${tier.tierOrder} (${tier.ratePct}%)`,
    }));
}
