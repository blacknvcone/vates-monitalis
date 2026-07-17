import { useState, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Loader2,
  Target,
  Calendar,
  TrendingDown,
  PiggyBank,
  AlertCircle,
} from 'lucide-react';
import { formatIDR, formatPct } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useKprStatus, useSchedule, useKprLoan } from '@/hooks';
import { adaptCmsStatus } from '@/lib/cms-adapters';

// ============================================================
// Goal computation
// ============================================================

interface GoalAnalysis {
  targetDate: string;
  targetMonth: number;
  monthsRemaining: number;
  outstandingAtTarget: number;
  penaltyRate: number;
  penaltyAmount: number;
  totalNeeded: number;
  monthlySavingsRequired: number;
  currentMonthlySavings: number;
  gap: number;
  isFeasible: boolean;
  currentInstallment: number;
  outstandingBalance: number;
  progressPct: number;
  totalInterestIfMin: number;
  totalInterestWithGoal: number;
  interestSaved: number;
  totalPaidIfMin: number;
  totalPaidWithGoal: number;
}

function computeGoalAnalysis(
  targetDate: string,
  status: ReturnType<typeof adaptCmsStatus>,
  schedule: { monthNumber: number; outstandingBalance: number; interestPortion: number }[],
  loan: { firstPayment: string; tenorMonths: number; minTenorMonths: number; penaltyAfterMinTenor: number },
): GoalAnalysis {
  const firstPayment = new Date(loan.firstPayment);
  const target = new Date(targetDate);

  // Calculate target month number
  const targetMonth =
    (target.getFullYear() - firstPayment.getFullYear()) * 12 +
    (target.getMonth() - firstPayment.getMonth()) + 1;

  const monthsRemaining = Math.max(targetMonth - status.currentMonth, 0);

  // Find schedule entry at target month (or last available)
  const targetEntry =
    schedule.find((e) => e.monthNumber === targetMonth) ??
    schedule[schedule.length - 1];

  const outstandingAtTarget = targetEntry?.outstandingBalance ?? status.outstandingBalance;

  // Penalty
  const isAfterMinTenor = targetMonth >= loan.minTenorMonths;
  const penaltyRate = isAfterMinTenor ? loan.penaltyAfterMinTenor : 3;
  const penaltyAmount = Math.round(outstandingAtTarget * (penaltyRate / 100));
  const totalNeeded = outstandingAtTarget + penaltyAmount;

  // Monthly savings required
  const monthlySavingsRequired =
    monthsRemaining > 0 ? Math.ceil(totalNeeded / monthsRemaining) : totalNeeded;

  // Current capacity: user's current installment as proxy
  const currentMonthlySavings = status.currentInstallment;
  const gap = monthlySavingsRequired - currentMonthlySavings;
  const isFeasible = gap <= 0;

  // Interest comparison: minimum payments vs early payoff at target
  const totalInterestIfMin = schedule.reduce((sum, e) => sum + e.interestPortion, 0);

  // Interest paid up to target month
  const interestPaidToTarget = schedule
    .filter((e) => e.monthNumber <= targetMonth)
    .reduce((sum, e) => sum + e.interestPortion, 0);

  // With goal: pay off at target, so no interest after target
  const totalInterestWithGoal = interestPaidToTarget;
  const interestSaved = totalInterestIfMin - totalInterestWithGoal;

  const totalPaidIfMin = loan.tenorMonths * status.currentInstallment;
  const totalPaidWithGoal = status.totalPaid + totalNeeded;

  // Progress: how much of the total needed has been "covered"
  // based on how close current savings capacity gets them
  const progressPct =
    totalNeeded > 0
      ? Math.min(((status.totalPaid / (status.totalPaid + totalNeeded)) * 100), 100)
      : 100;

  return {
    targetDate,
    targetMonth,
    monthsRemaining,
    outstandingAtTarget,
    penaltyRate,
    penaltyAmount,
    totalNeeded,
    monthlySavingsRequired,
    currentMonthlySavings,
    gap,
    isFeasible,
    currentInstallment: status.currentInstallment,
    outstandingBalance: status.outstandingBalance,
    progressPct,
    totalInterestIfMin,
    totalInterestWithGoal,
    interestSaved,
    totalPaidIfMin,
    totalPaidWithGoal,
  };
}

// ============================================================
// Page Component
// ============================================================

function GoalsPage() {
  // Default target: Oct 2026 (when penalty drops)
  const [targetDate, setTargetDate] = useState('2026-10-01');

  const { data: cmsStatus, isLoading: statusLoading } = useKprStatus();
  const { data: scheduleRes, isLoading: schLoading } = useSchedule();
  const { data: loan, isLoading: loanLoading } = useKprLoan();

  const isLoading = statusLoading || schLoading || loanLoading;
  const schedule = scheduleRes?.docs ?? [];

  const goal = useMemo(() => {
    if (!cmsStatus || !loan) return null;
    const status = adaptCmsStatus(cmsStatus);
    return computeGoalAnalysis(
      targetDate,
      status,
      schedule.map((e) => ({
        monthNumber: e.monthNumber,
        outstandingBalance: e.outstandingBalance,
        interestPortion: e.interestPortion,
      })),
      loan,
    );
  }, [targetDate, cmsStatus, schedule, loan]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
        <span className="ml-3 text-gray-500">Memuat data...</span>
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="flex items-center justify-center h-64">
        <AlertCircle className="text-red-500" size={32} />
        <span className="ml-3 text-gray-500">Gagal memuat data</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Target Pelunasan</h1>
        <p className="text-sm text-gray-500 mt-1">
          Rencanakan dan pantau progres menuju pelunasan KPR
        </p>
      </div>

      {/* Target Date Picker */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <Target size={20} className="text-blue-600" />
          <h2 className="text-base font-semibold text-gray-800">
            Atur Target Pelunasan
          </h2>
        </div>
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label
              htmlFor="goal-date"
              className="block text-xs font-medium text-gray-600 mb-1"
            >
              Tanggal Target
            </label>
            <input
              id="goal-date"
              type="date"
              value={targetDate}
              onChange={(e) => setTargetDate(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
            />
          </div>
          <div className="text-sm text-gray-500">
            <p>
              {goal.monthsRemaining > 0
                ? `${goal.monthsRemaining} bulan lagi menuju target`
                : 'Target sudah terlewat'}
            </p>
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Default: Oktober 2026 — saat penalti pelunasan turun ke{' '}
          {formatPct(loan?.penaltyAfterMinTenor ?? 1)}
        </p>
      </div>

      {/* Goal Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={14} className="text-blue-500" />
            <p className="text-xs text-gray-500">Bulan Tersisa</p>
          </div>
          <p className="text-xl font-bold text-blue-600">
            {goal.monthsRemaining}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Target size={14} className="text-red-500" />
            <p className="text-xs text-gray-500">Total Dibutuhkan</p>
          </div>
          <p className="text-lg font-bold text-red-600">
            {formatIDR(goal.totalNeeded)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <PiggyBank size={14} className="text-amber-500" />
            <p className="text-xs text-gray-500">Tabungan / Bulan</p>
          </div>
          <p className="text-lg font-bold text-amber-600">
            {formatIDR(goal.monthlySavingsRequired)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={14} className="text-emerald-500" />
            <p className="text-xs text-gray-500">Bunga Dihemat</p>
          </div>
          <p className="text-lg font-bold text-emerald-600">
            {formatIDR(goal.interestSaved)}
          </p>
        </div>
      </div>

      {/* Goal Breakdown */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-base font-semibold text-gray-800 mb-4">
          Rincian Target
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">Sisa Pokok Saat Ini</span>
            <span className="text-sm font-semibold text-gray-900 tabular-nums">
              {formatIDR(goal.outstandingBalance)}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">
              Estimasi Pokok di Bulan Target
            </span>
            <span className="text-sm font-semibold text-gray-900 tabular-nums">
              {formatIDR(goal.outstandingAtTarget)}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 border-b border-gray-100">
            <span className="text-sm text-gray-600">
              Penalti Pelunasan ({formatPct(goal.penaltyRate)})
            </span>
            <span className="text-sm font-semibold text-red-600 tabular-nums">
              + {formatIDR(goal.penaltyAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between py-2 bg-gray-50 px-3 rounded-lg">
            <span className="text-sm font-semibold text-gray-800">
              Total Dana Dibutuhkan
            </span>
            <span className="text-base font-bold text-gray-900 tabular-nums">
              {formatIDR(goal.totalNeeded)}
            </span>
          </div>
        </div>
      </div>

      {/* Progress Visualization */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-gray-800">
            Progres Menuju Target
          </h3>
          <span className="text-sm font-bold text-blue-600">
            {goal.progressPct.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-4">
          <div
            className="bg-gradient-to-r from-blue-500 to-emerald-500 h-4 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(goal.progressPct, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {formatIDR(goal.outstandingBalance)} sisa dari total pinjaman
        </p>
      </div>

      {/* Feasibility Check */}
      <div
        className={cn(
          'rounded-xl border p-6',
          goal.isFeasible
            ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200'
            : 'bg-gradient-to-br from-amber-50 to-amber-100 border-amber-200',
        )}
      >
        <div className="flex items-start gap-3">
          {goal.isFeasible ? (
            <Target
              size={24}
              className="text-emerald-600 flex-shrink-0 mt-0.5"
            />
          ) : (
            <AlertCircle
              size={24}
              className="text-amber-600 flex-shrink-0 mt-0.5"
            />
          )}
          <div>
            <h3
              className={cn(
                'text-base font-bold',
                goal.isFeasible ? 'text-emerald-900' : 'text-amber-900',
              )}
            >
              {goal.isFeasible
                ? 'Target Tercapai!'
                : 'Perlu Tabungan Tambahan'}
            </h3>
            <p
              className={cn(
                'text-sm mt-2',
                goal.isFeasible ? 'text-emerald-800' : 'text-amber-800',
              )}
            >
              {goal.isFeasible
                ? `Dengan angsuran saat ini (${formatIDR(goal.currentInstallment)}/bulan), Anda sudah mampu menabung cukup untuk melunasi di ${new Date(goal.targetDate).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}.`
                : `Anda perlu menabung ${formatIDR(goal.monthlySavingsRequired)}/bulan, sedangkan kapasitas saat ini sekitar ${formatIDR(goal.currentMonthlySavings)}/bulan. Selisih ${formatIDR(goal.gap)} per bulan.`}
            </p>
          </div>
        </div>
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-base font-semibold text-gray-800">
            Perbandingan: Bayar Minimum vs Target Pelunasan
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Perbandingan total biaya jika membayar minimum sampai lunas vs
            melunasi sesuai target
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Metode
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Total Dibayar
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Total Bunga
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  Hemat
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-100">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">
                    Bayar Minimum (20 tahun)
                  </p>
                  <p className="text-xs text-gray-400">
                    Angsuran rutin tanpa pelunasan dipercepat
                  </p>
                </td>
                <td className="text-right px-4 py-3 font-semibold tabular-nums text-gray-900">
                  {formatIDR(goal.totalPaidIfMin)}
                </td>
                <td className="text-right px-4 py-3 font-semibold tabular-nums text-red-600">
                  {formatIDR(goal.totalInterestIfMin)}
                </td>
                <td className="text-center px-4 py-3">
                  <span className="text-xs text-gray-400">—</span>
                </td>
              </tr>
              <tr className="border-t border-gray-100 bg-emerald-50/50">
                <td className="px-4 py-3">
                  <p className="font-medium text-emerald-800">
                    Lunasi {new Date(goal.targetDate).toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}
                  </p>
                  <p className="text-xs text-emerald-600">
                    Termasuk penalti {formatPct(goal.penaltyRate)}
                  </p>
                </td>
                <td className="text-right px-4 py-3 font-semibold tabular-nums text-emerald-700">
                  {formatIDR(goal.totalPaidWithGoal)}
                </td>
                <td className="text-right px-4 py-3 font-semibold tabular-nums text-emerald-700">
                  {formatIDR(goal.totalInterestWithGoal)}
                </td>
                <td className="text-center px-4 py-3">
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-1 rounded-full">
                    {formatIDR(goal.interestSaved)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/goals')({
  component: GoalsPage,
});
