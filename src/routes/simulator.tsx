import { createFileRoute } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import {
  CalendarClock,
  Banknote,
  TrendingDown,
  PiggyBank,
  Clock,
  AlertTriangle,
  Target,
  ArrowRight,
  Wallet,
  TrendingUp,
  CalendarDays,
  CircleDollarSign,
  Loader2,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { formatIDR, formatPct, formatMonthLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useKprLoan, useRateTiers, useSchedule, useKprStatus } from '@/hooks';
import { adaptCmsStatus, adaptRateTiersToPhases } from '@/lib/cms-adapters';
import type {
  KprLoan,
  KprRateTier,
  KprScheduleEntry,
  KprStatus,
  PhaseInfo,
} from '@/types';

// ============================================================
// Helpers
// ============================================================

function getPhase(month: number, phases: PhaseInfo[]) {
  return phases.find((p) => month >= p.startMonth && month <= p.endMonth) ?? phases[phases.length - 1];
}

function getRate(month: number, phases: PhaseInfo[]) {
  return getPhase(month, phases).rate;
}

function getInstallment(month: number, phases: PhaseInfo[]) {
  return getPhase(month, phases).installment;
}

/** Build a monthNumber → entry lookup from the schedule docs */
function scheduleToMap(schedule: KprScheduleEntry[]): Map<number, KprScheduleEntry> {
  return new Map(schedule.map((e) => [e.monthNumber, e]));
}

/** Compute the total cost over the full tenor from schedule data */
function computeTotalCost(schedule: KprScheduleEntry[]): number {
  return schedule
    .filter((e) => e.monthNumber > 0)
    .reduce((sum, e) => sum + e.totalInstallment, 0);
}

/** Derive the current (last paid) month from schedule data */
function computeCurrentMonth(schedule: KprScheduleEntry[]): number {
  const paid = schedule.filter((e) => e.isPaid && e.monthNumber > 0);
  return paid.length > 0 ? Math.max(...paid.map((e) => e.monthNumber)) : 0;
}

// ============================================================
// Simulation: Early Payoff
// ============================================================

function computeEarlyPayoff(
  targetMonth: number,
  scheduleMap: Map<number, KprScheduleEntry>,
  loan: KprLoan,
  phases: PhaseInfo[],
  totalCost20yr: number,
  tenorMonths: number,
) {
  if (targetMonth < 1 || targetMonth > tenorMonths) return null;

  const entry = scheduleMap.get(targetMonth);
  if (!entry) return null;

  const outstandingPrincipal = entry.outstandingBalance;
  const currentRate = getRate(targetMonth, phases);
  const penaltyRate = targetMonth >= loan.minTenorMonths
    ? loan.penaltyAfterMinTenor / 100
    : loan.penaltyBeforeMinTenor / 100;
  const penaltyAmount = outstandingPrincipal * penaltyRate;
  const totalToPayBank = outstandingPrincipal + penaltyAmount;

  // Sum installments already paid from month 1 to targetMonth
  let alreadyPaid = 0;
  for (let i = 1; i <= targetMonth; i++) {
    const e = scheduleMap.get(i);
    if (e) alreadyPaid += e.totalInstallment;
  }

  const grandTotal = alreadyPaid + totalToPayBank;
  const savingsVsFull = totalCost20yr - grandTotal;
  const savingsPct = (savingsVsFull / totalCost20yr) * 100;

  // Break-even: months of interest savings to offset penalty
  const monthlyInterest = outstandingPrincipal * (currentRate / 100 / 12);
  const breakEvenMonths = monthlyInterest > 0 ? Math.ceil(penaltyAmount / monthlyInterest) : 0;

  return {
    targetMonth,
    outstandingPrincipal,
    currentRate,
    penaltyRate: penaltyRate * 100,
    penaltyAmount,
    totalToPayBank,
    alreadyPaid,
    grandTotal,
    savingsVsFull,
    savingsPct,
    breakEvenMonths,
  };
}

// ============================================================
// Simulation: Extra Payment
// ============================================================

function computeExtraPayment(
  monthlyExtra: number,
  startMonth: number,
  schedule: KprScheduleEntry[],
  loan: KprLoan,
  phases: PhaseInfo[],
  totalCost20yr: number,
  tenorMonths: number,
) {
  if (monthlyExtra <= 0 || startMonth < 1 || startMonth > tenorMonths) return null;

  // Simulate original schedule totals
  let totalInterestOriginal = 0;
  for (let i = 1; i <= tenorMonths; i++) {
    const e = schedule.find((s) => s.monthNumber === i);
    if (e) totalInterestOriginal += e.interestPortion;
  }

  // Simulate with extra payment
  let balance = loan.loanAmount;
  let month = 0;
  let totalInterestNew = 0;
  const amortCurve: { month: number; original: number; new: number }[] = [];

  while (balance > 0 && month < tenorMonths) {
    month++;
    const rate = getRate(month, phases);
    const monthlyRate = rate / 100 / 12;
    const interestPortion = balance * monthlyRate;
    totalInterestNew += interestPortion;

    const baseInstallment = getInstallment(month, phases);
    const principalPortion = baseInstallment - interestPortion;
    const extra = month >= startMonth ? monthlyExtra : 0;
    const totalPrincipalPaid = Math.min(principalPortion + extra, balance);
    balance = Math.max(balance - totalPrincipalPaid, 0);

    // Record every 6 months for chart
    if (month % 6 === 0 || balance === 0) {
      const origEntry = schedule.find((s) => s.monthNumber === Math.min(month, tenorMonths));
      amortCurve.push({
        month,
        original: origEntry?.outstandingBalance ?? 0,
        new: balance,
      });
    }
  }

  const newTenor = month;
  const originalTenor = tenorMonths;
  const monthsSaved = originalTenor - newTenor;
  const interestSaved = totalInterestOriginal - totalInterestNew;

  // Build full curve to tenorMonths for display
  const lastPoint = amortCurve[amortCurve.length - 1];
  if (lastPoint && lastPoint.month < tenorMonths) {
    amortCurve.push({ month: tenorMonths, original: 0, new: 0 });
  }

  return {
    originalTenor,
    newTenor,
    monthsSaved,
    totalInterestOriginal,
    totalInterestNew,
    interestSaved,
    amortCurve,
  };
}

// ============================================================
// Simulation: Savings (Menabung)
// ============================================================

function computeSavingsSimulation(
  monthlyIncome: number,
  monthlyExpenses: number,
  currentSavings: number,
  status: KprStatus,
  schedule: KprScheduleEntry[],
  loan: KprLoan,
  _rateTiers: KprRateTier[],
  firstPayment: string,
) {
  const scheduleMap = scheduleToMap(schedule);

  // Phase-aware: current installment depends on which month we're in
  const currentKPR = status.currentInstallment;
  const currentSavingsRate = monthlyIncome - monthlyExpenses - currentKPR;

  if (currentSavingsRate <= 0) {
    return {
      error: 'Pengeluaran + angsuran KPR melebihi atau sama dengan pemasukan. Tidak ada sisa untuk ditabung.',
      currentKPR,
      currentSavingsRate,
    };
  }

  let savings = currentSavings;
  let month = 0;
  let totalKPRPaid = 0;
  let totalInterestPaid = 0;
  let phaseTransitionMonth: number | null = null;
  const savingsHistory: {
    month: number;
    cumulativeSavings: number;
    kprBalance: number;
    needed: number;
    penalty: number;
    kprInstallment: number;
  }[] = [];

  while (month < status.monthsRemaining) {
    month++;

    const targetMonth = status.currentMonth + month;
    const entry = scheduleMap.get(targetMonth);
    if (!entry) break;

    // Phase-aware installment: uses actual schedule data for each month
    const kprInstallment = entry.totalInstallment;
    const interestPortion = entry.interestPortion;
    const monthlySavings = monthlyIncome - monthlyExpenses - kprInstallment;

    // Track first phase transition
    if (!phaseTransitionMonth && kprInstallment !== currentKPR) {
      phaseTransitionMonth = month;
    }

    // If KPR exceeds income at any point, stop — not feasible
    if (monthlySavings <= 0) {
      return {
        error: `Pada bulan ke-${month} (KPR ${formatIDR(kprInstallment)}), pengeluaran + angsuran melebihi pemasukan. Tidak ada sisa untuk ditabung.`,
        currentKPR,
        currentSavingsRate,
        phaseTransitionMonth,
      };
    }

    savings += monthlySavings;
    totalKPRPaid += kprInstallment;
    totalInterestPaid += interestPortion;

    const balance = entry.outstandingBalance;
    const isAfterMinTenor = targetMonth >= loan.minTenorMonths;
    const penaltyRate = isAfterMinTenor
      ? loan.penaltyAfterMinTenor
      : loan.penaltyBeforeMinTenor;
    const penalty = Math.round(balance * penaltyRate / 100);
    const needed = balance + penalty;

    // Sample every 3 months for chart, plus first and last
    if (month <= 3 || month % 3 === 0 || savings >= needed) {
      savingsHistory.push({
        month,
        cumulativeSavings: savings,
        kprBalance: balance,
        needed,
        penalty,
        kprInstallment,
      });
    }

    if (savings >= needed) {
      const payoffDate = entry.calendarDate;

      // Calculate what happens if they invest instead (assume 6% annual return)
      const investRate = 0.06 / 12;
      let investSavings = currentSavings;
      // Need to recompute per-phase savings for invest comparison
      for (let m = 1; m <= month; m++) {
        const e = scheduleMap.get(status.currentMonth + m);
        const kpr = e ? e.totalInstallment : currentKPR;
        const savable = monthlyIncome - monthlyExpenses - kpr;
        investSavings = investSavings * (1 + investRate) + savable;
      }

      // Total interest that would be paid if they keep paying KPR
      let remainingInterest = 0;
      for (let m = status.currentMonth + month + 1; m <= loan.tenorMonths; m++) {
        const e = scheduleMap.get(m);
        if (e) remainingInterest += e.interestPortion;
      }

      return {
        monthlyIncome,
        monthlyExpenses,
        currentKPR,
        currentSavingsRate,
        currentSavings,
        monthsToGoal: month,
        optimalMonth: targetMonth,
        payoffDate,
        totalSaved: savings,
        kprBalance: balance,
        penalty,
        penaltyRate,
        needed,
        savingsHistory,
        totalKPRPaid,
        totalInterestPaid,
        phaseTransitionMonth,
        investComparison: {
          investValue: Math.round(investSavings),
          savingsValue: savings,
          difference: Math.round(savings - investSavings),
          remainingInterest,
        },
        error: null,
      };
    }
  }

  return {
    error: 'Tidak bisa mengumpulkan cukup dana dalam sisa tenor yang tersedia.',
    currentKPR,
    currentSavingsRate,
    phaseTransitionMonth,
  };
}

// ============================================================
// Sub-components
// ============================================================

function SimCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  className,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'amber' | 'red' | 'purple';
  className?: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
  };

  return (
    <div className={cn('bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow', className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-xl font-bold text-gray-900 mt-1 truncate">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={cn('p-2.5 rounded-lg border flex-shrink-0 ml-3', colorClasses[color])}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'px-5 py-2.5 text-sm font-medium rounded-lg transition-all',
        active
          ? 'bg-primary text-white shadow-sm'
          : 'text-gray-600 hover:bg-gray-100',
      )}
    >
      {label}
    </button>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-primary" size={32} />
      <span className="ml-3 text-gray-500">Memuat data simulasi...</span>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
      <p className="text-sm font-semibold text-red-700">Gagal memuat data</p>
      <p className="text-xs text-red-600 mt-1">{message}</p>
    </div>
  );
}

// ============================================================
// Tab 1: Early Payoff
// ============================================================

function EarlyPayoffTab({
  loan,
  phases,
  scheduleMap,
  currentMonth,
  totalCost20yr,
  tenorMonths,
}: {
  loan: KprLoan;
  phases: PhaseInfo[];
  scheduleMap: Map<number, KprScheduleEntry>;
  currentMonth: number;
  totalCost20yr: number;
  tenorMonths: number;
}) {
  const [targetMonth, setTargetMonth] = useState(currentMonth + 1);

  const result = useMemo(
    () => computeEarlyPayoff(targetMonth, scheduleMap, loan, phases, totalCost20yr, tenorMonths),
    [targetMonth, scheduleMap, loan, phases, totalCost20yr, tenorMonths],
  );

  // Comparison table for specific months
  const comparisonMonths = useMemo(
    () => [36, 48, 60, 72, 120].filter((m) => m > currentMonth && m <= tenorMonths),
    [currentMonth, tenorMonths],
  );
  const comparisons = useMemo(
    () => comparisonMonths.map((m) => computeEarlyPayoff(m, scheduleMap, loan, phases, totalCost20yr, tenorMonths)!).filter(Boolean),
    [comparisonMonths, scheduleMap, loan, phases, totalCost20yr, tenorMonths],
  );

  const barData = useMemo(
    () =>
      comparisons.map((c) => ({
        name: `Bulan ${c.targetMonth}`,
        grandTotal: c.grandTotal,
        savings: c.savingsVsFull,
      })),
    [comparisons],
  );

  if (!result) return null;

  return (
    <div className="space-y-6">
      {/* Slider Input */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target size={18} className="text-primary" />
          <h3 className="text-sm font-semibold text-gray-700">Target Pelunasan</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <input
              type="range"
              min={currentMonth + 1}
              max={tenorMonths}
              value={targetMonth}
              onChange={(e) => setTargetMonth(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={currentMonth + 1}
                max={tenorMonths}
                value={targetMonth}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v >= currentMonth + 1 && v <= tenorMonths) setTargetMonth(v);
                }}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center font-semibold focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <span className="text-xs text-gray-500">bulan</span>
            </div>
          </div>

          <div className="flex justify-between text-xs text-gray-400">
            <span>Bulan {currentMonth + 1} (sekarang)</span>
            <span>Bulan {tenorMonths} (akhir tenor)</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Pelunasan di bulan {targetMonth} ={' '}
              <strong>{targetMonth < loan.minTenorMonths ? `${loan.penaltyBeforeMinTenor}% penalti` : `${loan.penaltyAfterMinTenor}% penalti`}</strong>
              {targetMonth < loan.minTenorMonths
                ? ' (sebelum tenor minimum 36 bulan)'
                : ' (setelah tenor minimum)'}
            </p>
          </div>
        </div>
      </div>

      {/* Result Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SimCard
          title="Sisa Pokok"
          value={formatIDR(result.outstandingPrincipal)}
          subtitle={`Bulan ${targetMonth} · Bunga ${formatPct(result.currentRate)}`}
          icon={Banknote}
          color="blue"
        />
        <SimCard
          title="Penalti"
          value={formatIDR(result.penaltyAmount)}
          subtitle={`Rate ${formatPct(result.penaltyRate)}`}
          icon={AlertTriangle}
          color="amber"
        />
        <SimCard
          title="Total ke Bank"
          value={formatIDR(result.totalToPayBank)}
          subtitle="Sisa pokok + penalti"
          icon={ArrowRight}
          color="red"
        />
        <SimCard
          title="Sudah Dibayar"
          value={formatIDR(result.alreadyPaid)}
          subtitle={`${targetMonth} angsuran`}
          icon={Clock}
          color="purple"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SimCard
          title="Grand Total Cost"
          value={formatIDR(result.grandTotal)}
          subtitle="Sudah dibayar + total ke bank"
          icon={Banknote}
          color="red"
        />
        <SimCard
          title="Hemat vs 20 Tahun"
          value={formatIDR(result.savingsVsFull)}
          subtitle={`${result.savingsPct.toFixed(1)}% dari total biaya`}
          icon={PiggyBank}
          color="green"
        />
        <SimCard
          title="Break-even Penalti"
          value={`${result.breakEvenMonths} bulan`}
          subtitle="Waktu pulih dari penalti bunga"
          icon={CalendarClock}
          color="blue"
        />
      </div>

      {/* Comparison Table */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Perbandingan Skenario</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left py-2 px-3 text-gray-500 font-medium">Bulan</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Sisa Pokok</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Penalti</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Grand Total</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">Hemat</th>
                <th className="text-right py-2 px-3 text-gray-500 font-medium">%</th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((c) => (
                <tr
                  key={c.targetMonth}
                  className={cn(
                    'border-b border-gray-50 hover:bg-gray-50 transition-colors',
                    c.targetMonth === targetMonth && 'bg-blue-50/50',
                  )}
                >
                  <td className="py-2.5 px-3 font-medium">
                    Bulan {c.targetMonth}
                    {c.targetMonth === targetMonth && (
                      <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                        dipilih
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right text-gray-600">{formatIDR(c.outstandingPrincipal)}</td>
                  <td className="py-2.5 px-3 text-right text-amber-600">{formatIDR(c.penaltyAmount)}</td>
                  <td className="py-2.5 px-3 text-right font-semibold">{formatIDR(c.grandTotal)}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-600 font-medium">{formatIDR(c.savingsVsFull)}</td>
                  <td className="py-2.5 px-3 text-right text-emerald-600">{c.savingsPct.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Perbandingan Grand Total</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`} />
            <Tooltip formatter={(value: number) => [formatIDR(value), '']} />
            <Legend />
            <Bar dataKey="grandTotal" name="Grand Total" fill="#1e3a5f" radius={[4, 4, 0, 0]} />
            <Bar dataKey="savings" name="Hemat" fill="#22c55e" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================================
// Tab 2: Extra Payment
// ============================================================

function ExtraPaymentTab({
  loan,
  phases,
  schedule,
  totalCost20yr,
  tenorMonths,
}: {
  loan: KprLoan;
  phases: PhaseInfo[];
  schedule: KprScheduleEntry[];
  totalCost20yr: number;
  tenorMonths: number;
}) {
  const [monthlyExtra, setMonthlyExtra] = useState(1); // in millions
  const [startMonth, setStartMonth] = useState(34);

  const result = useMemo(
    () => computeExtraPayment(monthlyExtra * 1_000_000, startMonth, schedule, loan, phases, totalCost20yr, tenorMonths),
    [monthlyExtra, startMonth, schedule, loan, phases, totalCost20yr, tenorMonths],
  );

  if (!result) return null;

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <PiggyBank size={18} className="text-primary" />
          <h3 className="text-sm font-semibold text-gray-700">Parameter Pembayaran Ekstra</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Pembayaran Ekstra per Bulan
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Rp</span>
              <input
                type="number"
                min={0.5}
                max={20}
                step={0.5}
                value={monthlyExtra}
                onChange={(e) => setMonthlyExtra(Number(e.target.value))}
                className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <span className="text-sm text-gray-500">juta</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">= {formatIDR(monthlyExtra * 1_000_000)} / bulan</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Mulai dari Bulan
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={tenorMonths}
                value={startMonth}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v >= 1 && v <= tenorMonths) setStartMonth(v);
                }}
                className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <span className="text-sm text-gray-500">bulan</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Angsuran ke-{startMonth} dan seterusnya</p>
          </div>
        </div>
      </div>

      {/* Result Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SimCard
          title="Tenor Baru"
          value={`${result.newTenor} bulan`}
          subtitle={`${(result.newTenor / 12).toFixed(1)} tahun`}
          icon={Clock}
          color="blue"
        />
        <SimCard
          title="Bulan Dihemat"
          value={`${result.monthsSaved} bulan`}
          subtitle={`${(result.monthsSaved / 12).toFixed(1)} tahun lebih cepat`}
          icon={TrendingDown}
          color="green"
        />
        <SimCard
          title="Bunga Dihemat"
          value={formatIDR(result.interestSaved)}
          subtitle={`${((result.interestSaved / result.totalInterestOriginal) * 100).toFixed(1)}% dari total bunga`}
          icon={PiggyBank}
          color="amber"
        />
        <SimCard
          title="Total Pembayaran"
          value={formatIDR(loan.loanAmount + result.totalInterestNew)}
          subtitle={`vs ${formatIDR(totalCost20yr)} asli`}
          icon={Banknote}
          color="red"
        />
      </div>

      {/* Summary comparison */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Ringkasan Perbandingan</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Total Bunga Asli (20 thn)</p>
            <p className="text-lg font-bold text-red-600">{formatIDR(result.totalInterestOriginal)}</p>
          </div>
          <div className="flex items-center justify-center">
            <ArrowRight size={24} className="text-gray-300" />
          </div>
          <div className="text-center p-4 bg-emerald-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Total Bunga Baru ({result.newTenor} bln)</p>
            <p className="text-lg font-bold text-emerald-600">{formatIDR(result.totalInterestNew)}</p>
          </div>
        </div>
      </div>

      {/* Amortization Curve */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-4">Kurva Amortisasi</h3>
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={result.amortCurve}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 11 }}
              label={{ value: 'Bulan', position: 'insideBottom', offset: -5, fontSize: 11 }}
            />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`} />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatIDR(value),
                name === 'original' ? 'Tanpa Ekstra' : 'Dengan Ekstra',
              ]}
              labelFormatter={(label) => `Bulan ${label}`}
            />
            <Legend
              formatter={(value) => (value === 'original' ? 'Tanpa Ekstra' : 'Dengan Ekstra')}
            />
            <Line
              type="monotone"
              dataKey="original"
              stroke="#94a3b8"
              strokeWidth={2}
              dot={false}
              strokeDasharray="6 3"
            />
            <Line
              type="monotone"
              dataKey="new"
              stroke="#1e3a5f"
              strokeWidth={2.5}
              dot={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================================
// Tab 3: Savings Simulation (Simulasi Menabung)
// ============================================================

function SavingsTab({
  status,
  schedule,
  loan,
  rateTiers,
  firstPayment,
}: {
  status: KprStatus;
  schedule: KprScheduleEntry[];
  loan: KprLoan;
  rateTiers: KprRateTier[];
  firstPayment: string;
}) {
  const [monthlyIncome, setMonthlyIncome] = useState(10);
  const [monthlyExpenses, setMonthlyExpenses] = useState(4);
  const [currentSavings, setCurrentSavings] = useState(50);

  const result = useMemo(
    () =>
      computeSavingsSimulation(
        monthlyIncome * 1_000_000,
        monthlyExpenses * 1_000_000,
        currentSavings * 1_000_000,
        status,
        schedule,
        loan,
        rateTiers,
        firstPayment,
      ),
    [monthlyIncome, monthlyExpenses, currentSavings, status, schedule, loan, rateTiers, firstPayment],
  );

  const hasError = 'error' in result && result.error !== null;

  // Format payoff date
  const payoffDateFormatted = !hasError && 'payoffDate' in result && result.payoffDate
    ? formatMonthLabel(result.optimalMonth, firstPayment)
    : null;

  return (
    <div className="space-y-6">
      {/* Input Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <PiggyBank size={18} className="text-primary" />
          <h3 className="text-sm font-semibold text-gray-700">Parameter Simulasi Menabung</h3>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Gaji Pokok per Bulan
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Rp</span>
              <input
                type="number"
                min={1}
                max={100}
                step={0.5}
                value={monthlyIncome}
                onChange={(e) => setMonthlyIncome(Number(e.target.value))}
                className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <span className="text-sm text-gray-500">juta</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">= {formatIDR(monthlyIncome * 1_000_000)} / bulan</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Pengeluaran Tetap per Bulan
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Rp</span>
              <input
                type="number"
                min={0.5}
                max={50}
                step={0.5}
                value={monthlyExpenses}
                onChange={(e) => setMonthlyExpenses(Number(e.target.value))}
                className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <span className="text-sm text-gray-500">juta</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">= {formatIDR(monthlyExpenses * 1_000_000)} / bulan (tanpa KPR)</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-600 mb-2">
              Tabungan Saat Ini
            </label>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Rp</span>
              <input
                type="number"
                min={0}
                max={1000}
                step={10}
                value={currentSavings}
                onChange={(e) => setCurrentSavings(Number(e.target.value))}
                className="w-28 px-3 py-2 border border-gray-300 rounded-lg text-sm font-semibold focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <span className="text-sm text-gray-500">juta</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">= {formatIDR(currentSavings * 1_000_000)}</p>
          </div>
        </div>

        {/* Info box */}
        {(() => {
          const nextPhase = rateTiers.find(
            (t) => t.startMonth > status.currentMonth,
          );
          return (
            <div className="mt-4 space-y-2">
              <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                <CircleDollarSign
                  size={14}
                  className="text-blue-600 flex-shrink-0"
                />
                <p className="text-xs text-blue-700">
                  Angsuran KPR saat ini:{' '}
                  <strong>{formatIDR(status.currentInstallment)}</strong> / bulan
                  (Fase {status.currentPhase}, bunga{' '}
                  {formatPct(status.currentRate)})
                </p>
              </div>
              {nextPhase && (
                <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                  <AlertTriangle
                    size={14}
                    className="text-amber-600 flex-shrink-0"
                  />
                  <p className="text-xs text-amber-700">
                    Mulai bulan <strong>{nextPhase.startMonth}</strong>{' '}
                    ({formatMonthLabel(nextPhase.startMonth, firstPayment)}),
                    angsuran naik jadi{' '}
                    <strong>{formatIDR(nextPhase.installment)}</strong>
                    /bulan (Fase {rateTiers.indexOf(nextPhase) + 1}, bunga{' '}
                    {formatPct(nextPhase.ratePct)}) — tabungan per bulan akan
                    berkurang
                  </p>
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* Error State */}
      {hasError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Simulasi Tidak Memungkinkan</p>
            <p className="text-sm text-red-600 mt-1">{result.error}</p>
            {'currentSavingsRate' in result && result.currentSavingsRate !== undefined && (
              <p className="text-xs text-red-500 mt-2">
                Sisa setelah KPR: {formatIDR(result.currentSavingsRate)} / bulan —{' '}
                {result.currentSavingsRate <= 0
                  ? 'defisit, kurangi pengeluaran atau tambah pemasukan'
                  : 'terlalu kecil untuk mencapai target'}
              </p>
            )}
            {'phaseTransitionMonth' in result && result.phaseTransitionMonth && (
              <p className="text-xs text-amber-600 mt-1">
                ⚠️ Angsuran naik di bulan ke-{result.phaseTransitionMonth} (perubahan fase bunga)
              </p>
            )}
          </div>
        </div>
      )}

      {/* Result Cards */}
      {!hasError && 'monthsToGoal' in result && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <SimCard
              title="Tabungan per Bulan (Sekarang)"
              value={formatIDR(result.currentSavingsRate)}
              subtitle={`Sisa dari ${formatIDR(monthlyIncome * 1_000_000)} - ${formatIDR(monthlyExpenses * 1_000_000)} - KPR`}
              icon={Wallet}
              color="blue"
            />
            <SimCard
              title="Bulan ke Tujuan"
              value={`${result.monthsToGoal} bulan`}
              subtitle={`${(result.monthsToGoal / 12).toFixed(1)} tahun menabung`}
              icon={Clock}
              color="green"
            />
            <SimCard
              title="Tanggal Pelunasan Optimal"
              value={payoffDateFormatted || '-'}
              subtitle={`Bulan ke-${result.optimalMonth} dari awal KPR`}
              icon={CalendarDays}
              color="purple"
            />
            <SimCard
              title="Total Terkumpul"
              value={formatIDR(result.totalSaved)}
              subtitle={`Modal ${formatIDR(currentSavings * 1_000_000)} + akumulasi ${result.monthsToGoal} bulan`}
              icon={PiggyBank}
              color="amber"
            />
          </div>

          {/* Insight Banner */}
          <div className="bg-gradient-to-r from-emerald-50 to-blue-50 border border-emerald-200 rounded-xl p-6">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Target size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-800">Insight</p>
                <p className="text-sm text-gray-700 mt-1">
                  Dengan tabungan awal <strong>{formatIDR(result.currentSavingsRate)}</strong>/bulan
                  {result.phaseTransitionMonth && (
                    <>
                      {' '}(berkurang jadi{' '}
                      <strong>
                        {formatIDR(
                          monthlyIncome * 1_000_000 -
                            monthlyExpenses * 1_000_000 -
                            (result.savingsHistory.find(
                              (h) => h.month === result.phaseTransitionMonth,
                            )?.kprInstallment ?? 0),
                        )}
                      </strong>
                      /bulan setelah perubahan fase)
                    </>
                  )}
                  , Anda bisa lunasi KPR dalam <strong>{result.monthsToGoal} bulan</strong> (sekitar{' '}
                  <strong>{(result.monthsToGoal / 12).toFixed(1)} tahun</strong>) pada{' '}
                  <strong>{payoffDateFormatted}</strong>.
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Target dana: {formatIDR(result.needed)} (sisa pokok {formatIDR(result.kprBalance)} + penalti{' '}
                  {formatPct(result.penaltyRate)} = {formatIDR(result.penalty)})
                </p>
              </div>
            </div>
          </div>

          {/* KPR Cost During Savings Period */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Biaya KPR Selama Periode Menabung ({result.monthsToGoal} bulan)
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Total Angsuran KPR</p>
                <p className="text-lg font-bold text-gray-900 mt-1">
                  {formatIDR(result.totalKPRPaid)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {result.monthsToGoal} bulan × bervariasi per fase
                </p>
              </div>
              <div className="p-4 bg-red-50 rounded-lg">
                <p className="text-xs text-gray-500">Total Bunga Dibayar</p>
                <p className="text-lg font-bold text-red-600 mt-1">
                  {formatIDR(result.totalInterestPaid)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {((result.totalInterestPaid / result.totalKPRPaid) * 100).toFixed(0)}% dari total angsuran
                </p>
              </div>
              <div className="p-4 bg-emerald-50 rounded-lg">
                <p className="text-xs text-gray-500">Total Pokok Dibayar</p>
                <p className="text-lg font-bold text-emerald-600 mt-1">
                  {formatIDR(result.totalKPRPaid - result.totalInterestPaid)}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {(((result.totalKPRPaid - result.totalInterestPaid) / result.totalKPRPaid) * 100).toFixed(0)}% dari total angsuran
                </p>
              </div>
            </div>
            {result.phaseTransitionMonth && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-xs text-amber-700">
                  ⚠️ Terjadi perubahan fase bunga di bulan ke-{result.phaseTransitionMonth}. Angsuran KPR naik, sehingga tabungan per bulan berkurang. 
                  Total bunga yang dibayar selama periode menabung: <strong>{formatIDR(result.totalInterestPaid)}</strong>.
                </p>
              </div>
            )}
          </div>

          {/* Installment Phase Chart — shows KPR bill changes */}
          {result.savingsHistory.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Angsuran KPR per Bulan Selama Periode Menabung
              </h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={result.savingsHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11 }}
                    label={{
                      value: 'Bulan ke-',
                      position: 'insideBottom',
                      offset: -5,
                      fontSize: 11,
                    }}
                  />
                  <YAxis
                    tick={{ fontSize: 11 }}
                    tickFormatter={(v) =>
                      `${(v / 1_000_000).toFixed(1)}jt`
                    }
                  />
                  <Tooltip
                    formatter={(value: number) => [
                      formatIDR(value),
                      'Angsuran KPR',
                    ]}
                    labelFormatter={(label) => `Bulan ke-${label}`}
                  />
                  <Bar
                    dataKey="kprInstallment"
                    fill="#3b82f6"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
              <p className="text-xs text-gray-400 mt-2">
                Angsuran berubah saat fase bunga berubah. Tabungan per bulan = Pemasukan - Pengeluaran - Angsuran KPR.
              </p>
            </div>
          )}

          {/* Breakdown Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <SimCard
              title="Sisa Pokok KPR"
              value={formatIDR(result.kprBalance)}
              subtitle={`Saat bulan ${result.optimalMonth}`}
              icon={Banknote}
              color="blue"
            />
            <SimCard
              title="Penalti Pelunasan"
              value={formatIDR(result.penalty)}
              subtitle={`Rate ${formatPct(result.penaltyRate)}`}
              icon={AlertTriangle}
              color="amber"
            />
            <SimCard
              title="Total Dibutuhkan"
              value={formatIDR(result.needed)}
              subtitle="Sisa pokok + penalti"
              icon={CircleDollarSign}
              color="red"
            />
          </div>

          {/* Savings vs KPR Balance Chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Akumulasi Tabungan vs Saldo KPR
            </h3>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart data={result.savingsHistory}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="month"
                  tick={{ fontSize: 11 }}
                  label={{ value: 'Bulan', position: 'insideBottom', offset: -5, fontSize: 11 }}
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    formatIDR(value),
                    name === 'cumulativeSavings'
                      ? 'Total Tabungan'
                      : name === 'kprBalance'
                        ? 'Saldo KPR'
                        : 'Dana Dibutuhkan',
                  ]}
                  labelFormatter={(label) => `Bulan ke-${label}`}
                />
                <Legend
                  formatter={(value) =>
                    value === 'cumulativeSavings'
                      ? 'Total Tabungan'
                      : value === 'kprBalance'
                        ? 'Saldo KPR'
                        : 'Dana Dibutuhkan (Pokok + Penalti)'
                  }
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeSavings"
                  stroke="#22c55e"
                  strokeWidth={2.5}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="kprBalance"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={false}
                  strokeDasharray="6 3"
                />
                <Line
                  type="monotone"
                  dataKey="needed"
                  stroke="#ef4444"
                  strokeWidth={1.5}
                  dot={false}
                  strokeDasharray="3 3"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Comparison: Save vs Invest */}
          {result.investComparison && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">
                Perbandingan: Menabung vs Investasi (6%/tahun)
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="p-4 bg-emerald-50 rounded-lg border border-emerald-200">
                  <div className="flex items-center gap-2 mb-2">
                    <PiggyBank size={16} className="text-emerald-600" />
                    <p className="text-sm font-semibold text-emerald-700">Tabungan (untuk Lunas KPR)</p>
                  </div>
                  <p className="text-xl font-bold text-emerald-800">
                    {formatIDR(result.investComparison.savingsValue)}
                  </p>
                  <p className="text-xs text-emerald-600 mt-1">
                    Dana tersedia untuk pelunasan
                  </p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp size={16} className="text-blue-600" />
                    <p className="text-sm font-semibold text-blue-700">Investasi (6%/tahun)</p>
                  </div>
                  <p className="text-xl font-bold text-blue-800">
                    {formatIDR(result.investComparison.investValue)}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    Nilai investasi setelah {result.monthsToGoal} bulan
                  </p>
                </div>
              </div>
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-600">
                  <strong>Catatan:</strong> Dengan menabung, Anda mengumpulkan{' '}
                  <span className="text-emerald-600 font-medium">
                    {formatIDR(result.investComparison.savingsValue)}
                  </span>{' '}
                  dalam {result.monthsToGoal} bulan. Jika diinvestasikan (reksadana/deposito 6%/tahun),
                  nilainya menjadi{' '}
                  <span className="text-blue-600 font-medium">
                    {formatIDR(result.investComparison.investValue)}
                  </span>
                  . Selisih:{' '}
                  <span className={result.investComparison.difference >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {result.investComparison.difference >= 0 ? '+' : ''}
                    {formatIDR(result.investComparison.difference)}
                  </span>
                  . Namun, melunasi KPR lebih awal menghemat bunga sisa tenor sebesar{' '}
                  <span className="text-emerald-600 font-medium">
                    {formatIDR(result.investComparison.remainingInterest)}
                  </span>
                  .
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ============================================================
// Main Page
// ============================================================

function SimulatorPage() {
  const [activeTab, setActiveTab] = useState<'early' | 'extra' | 'savings'>('early');

  const { data: cmsStatus, isLoading: statusLoading, error: statusError } = useKprStatus();
  const { data: loanData, isLoading: loanLoading } = useKprLoan();
  const { data: tiersData, isLoading: tiersLoading } = useRateTiers();
  const { data: scheduleData, isLoading: scheduleLoading } = useSchedule();

  const isLoading = statusLoading || loanLoading || tiersLoading || scheduleLoading;

  if (isLoading) return <LoadingState />;
  if (statusError) return <ErrorState message={String(statusError)} />;
  if (!cmsStatus || !loanData || !scheduleData) return <ErrorState message="Data KPR tidak ditemukan" />;

  const status = adaptCmsStatus(cmsStatus);
  const loan = loanData as KprLoan;
  const tiers = tiersData?.docs ?? [];
  const phases = adaptRateTiersToPhases(tiers, loan.firstPayment);
  const schedule = scheduleData.docs;
  const scheduleMap = scheduleToMap(schedule);
  const currentMonth = computeCurrentMonth(schedule);
  const totalCost20yr = computeTotalCost(schedule);
  const tenorMonths = loan.tenorMonths;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Simulator</h1>
        <p className="text-sm text-gray-500 mt-1">
          Simulasi skenario pembayaran dan pelunasan dipercepat
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-gray-100 p-1 rounded-lg w-fit flex-wrap">
        <TabButton
          label="Pelunasan Dipercepat"
          active={activeTab === 'early'}
          onClick={() => setActiveTab('early')}
        />
        <TabButton
          label="Pembayaran Ekstra"
          active={activeTab === 'extra'}
          onClick={() => setActiveTab('extra')}
        />
        <TabButton
          label="Simulasi Menabung"
          active={activeTab === 'savings'}
          onClick={() => setActiveTab('savings')}
        />
      </div>

      {/* Tab Content */}
      {activeTab === 'early' && (
        <EarlyPayoffTab
          loan={loan}
          phases={phases}
          scheduleMap={scheduleMap}
          currentMonth={currentMonth}
          totalCost20yr={totalCost20yr}
          tenorMonths={tenorMonths}
        />
      )}
      {activeTab === 'extra' && (
        <ExtraPaymentTab
          loan={loan}
          phases={phases}
          schedule={schedule}
          totalCost20yr={totalCost20yr}
          tenorMonths={tenorMonths}
        />
      )}
      {activeTab === 'savings' && (
        <SavingsTab
          status={status}
          schedule={schedule}
          loan={loan}
          rateTiers={tiers}
          firstPayment={loan.firstPayment}
        />
      )}
    </div>
  );
}

export const Route = createFileRoute('/simulator')({
  component: SimulatorPage,
});
