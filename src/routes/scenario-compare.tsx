import { createFileRoute } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import {
  GitCompareArrows,
  Target,
  Wallet,
  TrendingDown,
  Clock,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
} from 'recharts';
import { formatIDR, formatPct, formatMonthLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSchedule, useKprLoan, useRateTiers, useKprStatus } from '@/hooks';
import { adaptCmsStatus, adaptRateTiersToPhases } from '@/lib/cms-adapters';
import type {
  KprLoan,
  KprScheduleEntry,
  KprStatus,
  PhaseInfo,
} from '@/types';

// ============================================================
// Helpers
// ============================================================

function getRate(month: number, phases: PhaseInfo[]): number {
  const phase = phases.find((p) => month >= p.startMonth && month <= p.endMonth);
  return phase ? phase.rate : phases[phases.length - 1]?.rate ?? 0;
}

function getInstallment(month: number, phases: PhaseInfo[]): number {
  const phase = phases.find((p) => month >= p.startMonth && month <= p.endMonth);
  return phase ? phase.installment : phases[phases.length - 1]?.installment ?? 0;
}

// ============================================================
// Scenario Computations
// ============================================================

interface ScenarioResult {
  name: string;
  totalCost: number;
  totalInterest: number;
  payoffMonth: number;
  payoffDate: string;
  monthlySavingsNeeded: number;
  color: string;
}

function computeBaselineScenario(
  schedule: KprScheduleEntry[],
  loan: KprLoan,
): ScenarioResult {
  const totalCost = schedule.reduce((s, e) => s + e.totalInstallment, 0);
  const totalInterest = schedule.reduce((s, e) => s + e.interestPortion, 0);

  return {
    name: 'Baseline',
    totalCost,
    totalInterest,
    payoffMonth: loan.tenorMonths,
    payoffDate: formatMonthLabel(loan.tenorMonths, loan.firstPayment),
    monthlySavingsNeeded: 0,
    color: '#6b7280', // gray
  };
}

function computeExtraPaymentScenario(
  monthlyExtra: number,
  loan: KprLoan,
  phases: PhaseInfo[],
): ScenarioResult | null {
  if (monthlyExtra <= 0) return null;

  let balance = loan.loanAmount;
  let month = 0;
  let totalInterest = 0;
  const tenorMonths = loan.tenorMonths;

  while (balance > 0 && month < tenorMonths) {
    month++;
    const rate = getRate(month, phases);
    const monthlyRate = rate / 100 / 12;
    const interestPortion = balance * monthlyRate;
    totalInterest += interestPortion;

    const baseInstallment = getInstallment(month, phases);
    const principalPortion = baseInstallment - interestPortion;
    const totalPrincipalPaid = Math.min(principalPortion + monthlyExtra, balance);
    balance = Math.max(balance - totalPrincipalPaid, 0);
  }

  const payoffMonth = month;
  const totalCost = loan.loanAmount + totalInterest;

  return {
    name: `Ekstra ${formatIDR(monthlyExtra)}/bln`,
    totalCost,
    totalInterest,
    payoffMonth,
    payoffDate: formatMonthLabel(payoffMonth, loan.firstPayment),
    monthlySavingsNeeded: monthlyExtra,
    color: '#10b981', // emerald
  };
}

function computeEarlyPayoffScenario(
  targetMonth: number,
  schedule: KprScheduleEntry[],
  loan: KprLoan,
  phases: PhaseInfo[],
): ScenarioResult | null {
  if (targetMonth < 1 || targetMonth > loan.tenorMonths) return null;

  const entry = schedule.find((e) => e.monthNumber === targetMonth);
  if (!entry) return null;

  const outstandingPrincipal = entry.outstandingBalance;
  const isAfterMinTenor = targetMonth >= loan.minTenorMonths;
  const penaltyRate = isAfterMinTenor
    ? loan.penaltyAfterMinTenor / 100
    : loan.penaltyBeforeMinTenor / 100;
  const penaltyAmount = outstandingPrincipal * penaltyRate;
  const totalToPayBank = outstandingPrincipal + penaltyAmount;

  // Sum installments already paid
  let alreadyPaid = 0;
  for (let i = 1; i <= targetMonth; i++) {
    const e = schedule.find((s) => s.monthNumber === i);
    if (e) alreadyPaid += e.totalInstallment;
  }

  const totalCost = alreadyPaid + totalToPayBank;
  const totalInterest = totalCost - loan.loanAmount;

  // Estimate monthly savings needed: remaining installments / targetMonth
  const monthlySavingsNeeded = Math.round(totalToPayBank / targetMonth);

  return {
    name: `Lunasi bulan ${targetMonth}`,
    totalCost,
    totalInterest,
    payoffMonth: targetMonth,
    payoffDate: formatMonthLabel(targetMonth, loan.firstPayment),
    monthlySavingsNeeded,
    color: '#f59e0b', // amber
  };
}

// ============================================================
// Components
// ============================================================

function ScenarioCard({
  scenario,
  isBest,
}: {
  scenario: ScenarioResult;
  isBest: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-5 transition-all',
        isBest
          ? 'border-emerald-300 bg-emerald-50 ring-2 ring-emerald-200'
          : 'border-gray-200 bg-white',
      )}
    >
      {isBest && (
        <div className="flex items-center gap-1 mb-3">
          <CheckCircle size={14} className="text-emerald-600" />
          <span className="text-xs font-bold text-emerald-700 uppercase tracking-wide">
            Rekomendasi Terbaik
          </span>
        </div>
      )}

      <h3 className="text-sm font-bold text-gray-900 mb-4">{scenario.name}</h3>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Total Biaya</span>
          <span className="text-sm font-bold text-gray-900">{formatIDR(scenario.totalCost)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Total Bunga</span>
          <span className="text-sm font-semibold text-red-600">{formatIDR(scenario.totalInterest)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-500">Lunas</span>
          <span className="text-sm font-medium text-gray-700">
            {scenario.payoffDate} (bln {scenario.payoffMonth})
          </span>
        </div>
        {scenario.monthlySavingsNeeded > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500">Tabungan/bln diperlukan</span>
            <span className="text-sm font-medium text-blue-600">
              {formatIDR(scenario.monthlySavingsNeeded)}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function ComparisonChart({ scenarios }: { scenarios: ScenarioResult[] }) {
  const data = scenarios.map((s) => ({
    name: s.name.length > 20 ? s.name.slice(0, 18) + '...' : s.name,
    totalCost: s.totalCost,
    totalInterest: s.totalInterest,
    principal: s.totalCost - s.totalInterest,
    color: s.color,
  }));

  const formatTooltipValue = (value: number) => formatIDR(value);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Perbandingan Total Biaya</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30, top: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis type="number" tickFormatter={(v) => formatIDR(v)} fontSize={11} />
          <YAxis type="category" dataKey="name" width={150} fontSize={11} />
          <Tooltip formatter={formatTooltipValue} />
          <Legend />
          <Bar dataKey="principal" stackId="a" name="Pokok" fill="#3b82f6" radius={[0, 0, 0, 0]} />
          <Bar dataKey="totalInterest" stackId="a" name="Bunga" fill="#ef4444" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function RecommendationPanel({
  scenarios,
  bestIndex,
}: {
  scenarios: ScenarioResult[];
  bestIndex: number;
}) {
  const best = scenarios[bestIndex];
  const baseline = scenarios[0];
  const savings = baseline.totalCost - best.totalCost;
  const savingsPct = baseline.totalCost > 0 ? (savings / baseline.totalCost) * 100 : 0;

  if (bestIndex === 0) {
    return (
      <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
        <div className="flex items-start gap-3">
          <Target size={20} className="text-gray-500 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold text-gray-700">Rekomendasi</h3>
            <p className="text-sm text-gray-600 mt-2">
              Tidak ada skenario yang lebih baik dari baseline. Coba masukkan nominal ekstra atau
              target pelunasan yang lebih awal.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 border border-emerald-200 rounded-xl p-6">
      <div className="flex items-start gap-3">
        <Target size={20} className="text-emerald-600 mt-0.5" />
        <div>
          <h3 className="text-sm font-bold text-emerald-900">Rekomendasi: {best.name}</h3>
          <p className="text-sm text-emerald-800 mt-2">
            Skenario ini menghemat <strong>{formatIDR(savings)}</strong> ({savingsPct.toFixed(1)}%)
            dari total biaya baseline. Total bunga berkurang dari {formatIDR(baseline.totalInterest)} menjadi{' '}
            {formatIDR(best.totalInterest)}.
          </p>
          <p className="text-xs text-emerald-700 mt-2">
            Lunas {baseline.payoffMonth - best.payoffMonth} bulan lebih awal ({best.payoffDate}).
          </p>
        </div>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-primary" size={32} />
      <span className="ml-3 text-gray-500">Memuat data perbandingan...</span>
    </div>
  );
}

// ============================================================
// Page Component
// ============================================================

function ScenarioComparePage() {
  const { data: scheduleData, isLoading: scheduleLoading } = useSchedule();
  const { data: loanData, isLoading: loanLoading } = useKprLoan();
  const { data: tiersData, isLoading: tiersLoading } = useRateTiers();
  const { data: cmsStatus, isLoading: statusLoading } = useKprStatus();

  const isLoading = scheduleLoading || loanLoading || tiersLoading || statusLoading;

  // User inputs
  const [extraPerMonth, setExtraPerMonth] = useState(1000000);
  const [targetPayoffMonth, setTargetPayoffMonth] = useState(0);

  const {
    scenarios,
    bestIndex,
    currentMonth,
  } = useMemo(() => {
    if (!scheduleData || !loanData || !tiersData || !cmsStatus) {
      return { scenarios: [], bestIndex: 0, currentMonth: 0 };
    }

    const schedule: KprScheduleEntry[] = scheduleData.docs;
    const loan = loanData as KprLoan;
    const tiers = tiersData.docs;
    const status = adaptCmsStatus(cmsStatus);
    const phases = adaptRateTiersToPhases(tiers, loan.firstPayment);
    const currentMonth = status.currentMonth;

    const baseline = computeBaselineScenario(schedule, loan);
    const extraScenario = computeExtraPaymentScenario(extraPerMonth, loan, phases);
    const earlyScenario = computeEarlyPayoffScenario(
      targetPayoffMonth > 0 ? targetPayoffMonth : currentMonth + 24,
      schedule,
      loan,
      phases,
    );

    const scenarios: ScenarioResult[] = [baseline];
    if (extraScenario) scenarios.push(extraScenario);
    if (earlyScenario) scenarios.push(earlyScenario);

    // Find best (lowest total cost)
    let bestIndex = 0;
    let bestCost = scenarios[0].totalCost;
    for (let i = 1; i < scenarios.length; i++) {
      if (scenarios[i].totalCost < bestCost) {
        bestCost = scenarios[i].totalCost;
        bestIndex = i;
      }
    }

    return { scenarios, bestIndex, currentMonth };
  }, [scheduleData, loanData, tiersData, cmsStatus, extraPerMonth, targetPayoffMonth]);

  if (isLoading) return <LoadingState />;

  if (!scheduleData || !loanData || !tiersData || !cmsStatus) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-sm font-semibold text-red-700">Gagal memuat data</p>
        <p className="text-xs text-red-600 mt-1">Pastikan data pinjaman tersedia.</p>
      </div>
    );
  }

  const loan = loanData as KprLoan;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Perbandingan Skenario</h1>
        <p className="text-sm text-gray-500 mt-1">
          Bandingkan strategi pembayaran KPR — bulan ke-{currentMonth}, sisa {loan.tenorMonths - currentMonth} bulan
        </p>
      </div>

      {/* Input Controls */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Wallet size={16} className="text-emerald-600" />
            <h3 className="text-sm font-semibold text-gray-700">Skenario 2: Bayar Ekstra per Bulan</h3>
          </div>
          <label className="block text-xs text-gray-500 mb-1">Nominal ekstra per bulan (Rp)</label>
          <input
            type="number"
            value={extraPerMonth}
            onChange={(e) => setExtraPerMonth(Math.max(0, Number(e.target.value)))}
            step={100000}
            min={0}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Contoh: 500.000, 1.000.000, 2.000.000
          </p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Clock size={16} className="text-amber-600" />
            <h3 className="text-sm font-semibold text-gray-700">Skenario 3: Lunasi di Bulan</h3>
          </div>
          <label className="block text-xs text-gray-500 mb-1">Target bulan pelunasan</label>
          <input
            type="range"
            value={targetPayoffMonth || currentMonth + 24}
            onChange={(e) => setTargetPayoffMonth(Number(e.target.value))}
            min={currentMonth + 1}
            max={loan.tenorMonths}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Bulan {currentMonth + 1}</span>
            <span className="font-medium text-gray-700">
              Bulan {targetPayoffMonth || currentMonth + 24} (
              {formatMonthLabel(targetPayoffMonth || currentMonth + 24, loan.firstPayment)})
            </span>
            <span>Bulan {loan.tenorMonths}</span>
          </div>
        </div>
      </div>

      {/* Scenario Cards */}
      {scenarios.length > 0 && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {scenarios.map((scenario, i) => (
              <ScenarioCard key={scenario.name} scenario={scenario} isBest={i === bestIndex} />
            ))}
          </div>

          {/* Chart */}
          <ComparisonChart scenarios={scenarios} />

          {/* Recommendation */}
          <RecommendationPanel scenarios={scenarios} bestIndex={bestIndex} />
        </>
      )}

      {/* Info Note */}
      <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500">
        <p className="font-medium text-gray-700 mb-1">Catatan</p>
        <p>
          Skenario baseline menggunakan jadwal angsuran aktual tanpa pembayaran ekstra.
          Skenario ekstra mengasumsikan penambahan pembayaran pokok setiap bulan.
          Skenario pelunasan dini menghitung penalti berdasarkan aturan bank ({formatPct(loan.penaltyBeforeMinTenor)} sebelum bulan ke-{loan.minTenorMonths}, {formatPct(loan.penaltyAfterMinTenor)} setelahnya).
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/scenario-compare')({
  component: ScenarioComparePage,
});
