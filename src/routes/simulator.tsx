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
  Receipt,
  TrendingUp,
  CalendarDays,
  CircleDollarSign,
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
import {
  generateMockSchedule,
  getCurrentStatus,
  MOCK_LOAN,
} from '@/lib/mock-data';

// ============================================================
// Mock Loan Data (mirrors dashboard)
// ============================================================

const LOAN = {
  loanAmount: 415_000_000,
  tenorMonths: 240,
  firstPayment: '2023-11-01',
  penaltyBeforeMinTenor: 10,
  penaltyAfterMinTenor: 2.5,
  minTenorMonths: 36,
};

const PHASES = [
  { startMonth: 1, endMonth: 36, rate: 4.75, installment: 2_681_900 },
  { startMonth: 37, endMonth: 72, rate: 8.00, installment: 3_367_400 },
  { startMonth: 73, endMonth: 240, rate: 10.25, installment: 3_815_600 },
];

const TOTAL_COST_20YR = 858_782_131;
const CURRENT_MONTH = 33;

// ============================================================
// Helpers
// ============================================================

function getPhase(month: number) {
  return PHASES.find((p) => month >= p.startMonth && month <= p.endMonth) ?? PHASES[PHASES.length - 1];
}

function getRate(month: number) {
  return getPhase(month).rate;
}

function getInstallment(month: number) {
  return getPhase(month).installment;
}

/**
 * Generate a full 240-month amortization schedule using the tiered rates.
 * Returns array of { month, rate, installment, interestPortion, principalPortion, balance }
 */
function generateSchedule() {
  const schedule: {
    month: number;
    rate: number;
    installment: number;
    interestPortion: number;
    principalPortion: number;
    balance: number;
  }[] = [];

  let balance = LOAN.loanAmount;
  for (let m = 1; m <= 240; m++) {
    const rate = getRate(m);
    const monthlyRate = rate / 100 / 12;
    const installment = getInstallment(m);
    const interestPortion = balance * monthlyRate;
    const principalPortion = Math.min(installment - interestPortion, balance);
    balance = Math.max(balance - principalPortion, 0);
    schedule.push({
      month: m,
      rate,
      installment,
      interestPortion,
      principalPortion,
      balance,
    });
  }
  return schedule;
}

const SCHEDULE = generateSchedule();

// ============================================================
// Simulation: Early Payoff
// ============================================================

function computeEarlyPayoff(targetMonth: number) {
  if (targetMonth < 1 || targetMonth > 240) return null;

  const entry = SCHEDULE[targetMonth - 1];
  const outstandingPrincipal = entry.balance;
  const currentRate = getRate(targetMonth);
  const penaltyRate = targetMonth >= LOAN.minTenorMonths
    ? LOAN.penaltyAfterMinTenor / 100
    : LOAN.penaltyBeforeMinTenor / 100;
  const penaltyAmount = outstandingPrincipal * penaltyRate;
  const totalToPayBank = outstandingPrincipal + penaltyAmount;

  // Sum installments already paid from month 1 to targetMonth
  let alreadyPaid = 0;
  for (let i = 0; i < targetMonth; i++) {
    alreadyPaid += SCHEDULE[i].installment;
  }

  const grandTotal = alreadyPaid + totalToPayBank;
  const savingsVsFull = TOTAL_COST_20YR - grandTotal;
  const savingsPct = (savingsVsFull / TOTAL_COST_20YR) * 100;

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

function computeExtraPayment(monthlyExtra: number, startMonth: number) {
  if (monthlyExtra <= 0 || startMonth < 1 || startMonth > 240) return null;

  // Simulate original schedule totals
  let totalInterestOriginal = 0;
  for (let i = 0; i < 240; i++) {
    totalInterestOriginal += SCHEDULE[i].interestPortion;
  }

  // Simulate with extra payment
  let balance = LOAN.loanAmount;
  let month = 0;
  let totalInterestNew = 0;
  const amortCurve: { month: number; original: number; new: number }[] = [];

  while (balance > 0 && month < 240) {
    month++;
    const rate = getRate(month);
    const monthlyRate = rate / 100 / 12;
    const interestPortion = balance * monthlyRate;
    totalInterestNew += interestPortion;

    const baseInstallment = getInstallment(month);
    const principalPortion = baseInstallment - interestPortion;
    const extra = month >= startMonth ? monthlyExtra : 0;
    const totalPrincipalPaid = Math.min(principalPortion + extra, balance);
    balance = Math.max(balance - totalPrincipalPaid, 0);

    // Record every 6 months for chart
    if (month % 6 === 0 || balance === 0) {
      const origEntry = SCHEDULE[Math.min(month - 1, 239)];
      amortCurve.push({
        month,
        original: origEntry.balance,
        new: balance,
      });
    }
  }

  const newTenor = month;
  const originalTenor = 240;
  const monthsSaved = originalTenor - newTenor;
  const interestSaved = totalInterestOriginal - totalInterestNew;

  // Build full curve to 240 for display
  const lastPoint = amortCurve[amortCurve.length - 1];
  if (lastPoint && lastPoint.month < 240) {
    amortCurve.push({ month: 240, original: 0, new: 0 });
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
) {
  const status = getCurrentStatus();
  const schedule = generateMockSchedule();
  const loan = MOCK_LOAN;

  const monthlyKPR = status.currentInstallment;
  const monthlySavings = monthlyIncome - monthlyExpenses - monthlyKPR;

  if (monthlySavings <= 0) {
    return {
      error: 'Pengeluaran + angsuran KPR melebihi atau sama dengan pemasukan. Tidak ada sisa untuk ditabung.',
      monthlyKPR,
      monthlySavings,
    };
  }

  let savings = currentSavings;
  let month = 0;
  const savingsHistory: {
    month: number;
    cumulativeSavings: number;
    kprBalance: number;
    needed: number;
    penalty: number;
  }[] = [];

  while (month < status.monthsRemaining) {
    month++;
    savings += monthlySavings;

    const targetMonth = status.currentMonth + month;
    const entry = schedule[targetMonth];
    if (!entry) break;

    const balance = entry.outstandingBalance;
    const isAfterMinTenor = targetMonth >= loan.minTenorMonths;
    const penaltyRate = isAfterMinTenor
      ? loan.penaltyAfterMinTenor
      : loan.penaltyBeforeMinTenor;
    const penalty = Math.round(balance * penaltyRate / 100);
    const needed = balance + penalty;

    // Sample every 3 months for chart, plus first and last
    if (month <= 3 || month % 3 === 0 || savings >= needed) {
      savingsHistory.push({ month, cumulativeSavings: savings, kprBalance: balance, needed, penalty });
    }

    if (savings >= needed) {
      // Calculate optimal payoff date
      const payoffDate = entry.calendarDate;

      // Calculate what happens if they invest instead (assume 6% annual return)
      const investRate = 0.06 / 12;
      let investSavings = currentSavings;
      for (let m = 1; m <= month; m++) {
        investSavings = investSavings * (1 + investRate) + monthlySavings;
      }

      // Total interest that would be paid if they keep paying KPR
      let remainingInterest = 0;
      for (let m = status.currentMonth + month + 1; m <= 240; m++) {
        const e = schedule[m];
        if (e) remainingInterest += e.interestPortion;
      }

      return {
        monthlyIncome,
        monthlyExpenses,
        monthlyKPR,
        monthlySavings,
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
    monthlyKPR,
    monthlySavings,
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

// ============================================================
// Tab 1: Early Payoff
// ============================================================

function EarlyPayoffTab() {
  const [targetMonth, setTargetMonth] = useState(36);

  const result = useMemo(() => computeEarlyPayoff(targetMonth), [targetMonth]);

  // Comparison table for specific months
  const comparisonMonths = [36, 48, 60, 72, 120];
  const comparisons = useMemo(
    () => comparisonMonths.map((m) => computeEarlyPayoff(m)!).filter(Boolean),
    [],
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
              min={CURRENT_MONTH + 1}
              max={240}
              value={targetMonth}
              onChange={(e) => setTargetMonth(Number(e.target.value))}
              className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={CURRENT_MONTH + 1}
                max={240}
                value={targetMonth}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v >= CURRENT_MONTH + 1 && v <= 240) setTargetMonth(v);
                }}
                className="w-20 px-3 py-2 border border-gray-300 rounded-lg text-sm text-center font-semibold focus:ring-2 focus:ring-primary focus:border-primary"
              />
              <span className="text-xs text-gray-500">bulan</span>
            </div>
          </div>

          <div className="flex justify-between text-xs text-gray-400">
            <span>Bulan {CURRENT_MONTH + 1} (sekarang)</span>
            <span>Bulan 240 (akhir tenor)</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700">
              Pelunasan di bulan {targetMonth} ={' '}
              <strong>{targetMonth < LOAN.minTenorMonths ? `${LOAN.penaltyBeforeMinTenor}% penalti` : `${LOAN.penaltyAfterMinTenor}% penalti`}</strong>
              {targetMonth < LOAN.minTenorMonths
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

function ExtraPaymentTab() {
  const [monthlyExtra, setMonthlyExtra] = useState(1); // in millions
  const [startMonth, setStartMonth] = useState(34);

  const result = useMemo(
    () => computeExtraPayment(monthlyExtra * 1_000_000, startMonth),
    [monthlyExtra, startMonth],
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
                max={240}
                value={startMonth}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  if (v >= 1 && v <= 240) setStartMonth(v);
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
          value={formatIDR(LOAN.loanAmount + result.totalInterestNew)}
          subtitle={`vs ${formatIDR(TOTAL_COST_20YR)} asli`}
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

function SavingsTab() {
  const status = getCurrentStatus();
  const [monthlyIncome, setMonthlyIncome] = useState(10);
  const [monthlyExpenses, setMonthlyExpenses] = useState(4);
  const [currentSavings, setCurrentSavings] = useState(50);

  const result = useMemo(
    () =>
      computeSavingsSimulation(
        monthlyIncome * 1_000_000,
        monthlyExpenses * 1_000_000,
        currentSavings * 1_000_000,
      ),
    [monthlyIncome, monthlyExpenses, currentSavings],
  );

  const hasError = 'error' in result && result.error !== null;

  // Format payoff date
  const payoffDateFormatted = !hasError && 'payoffDate' in result && result.payoffDate
    ? formatMonthLabel(result.optimalMonth, MOCK_LOAN.firstPayment)
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
        <div className="mt-4 flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
          <CircleDollarSign size={14} className="text-blue-600 flex-shrink-0" />
          <p className="text-xs text-blue-700">
            Angsuran KPR saat ini: <strong>{formatIDR(status.currentInstallment)}</strong> / bulan
            (Fase {status.currentPhase}, bunga {formatPct(status.currentRate)})
          </p>
        </div>
      </div>

      {/* Error State */}
      {hasError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 flex items-start gap-3">
          <AlertTriangle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-red-700">Simulasi Tidak Memungkinkan</p>
            <p className="text-sm text-red-600 mt-1">{result.error}</p>
            {'monthlySavings' in result && result.monthlySavings !== undefined && (
              <p className="text-xs text-red-500 mt-2">
                Sisa setelah KPR: {formatIDR(result.monthlySavings)} / bulan —{' '}
                {result.monthlySavings <= 0
                  ? 'defisit, kurangi pengeluaran atau tambah pemasukan'
                  : 'terlalu kecil untuk mencapai target'}
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
              title="Tabungan per Bulan"
              value={formatIDR(result.monthlySavings)}
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
              subtitle={`Tabungan ${formatIDR(currentSavings * 1_000_000)} + ${result.monthsToGoal} × ${formatIDR(result.monthlySavings)}`}
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
                  Dengan tabungan <strong>{formatIDR(result.monthlySavings)}</strong>/bulan, Anda bisa
                  lunasi KPR dalam <strong>{result.monthsToGoal} bulan</strong> (sekitar{' '}
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
      {activeTab === 'early' && <EarlyPayoffTab />}
      {activeTab === 'extra' && <ExtraPaymentTab />}
      {activeTab === 'savings' && <SavingsTab />}
    </div>
  );
}

export const Route = createFileRoute('/simulator')({
  component: SimulatorPage,
});
