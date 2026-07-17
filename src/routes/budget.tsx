import { useState, useMemo, useEffect, useCallback } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Loader2,
  Wallet,
  TrendingDown,
  PiggyBank,
  AlertCircle,
  Plus,
  Trash2,
  Lightbulb,
  ShieldCheck,
  ShieldAlert,
  ShieldX,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { formatIDR } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useKprStatus, useGoal } from '@/hooks';

// ============================================================
// Types
// ============================================================

interface ExpenseItem {
  id: string;
  label: string;
  amount: number;
}

interface PieSlice {
  name: string;
  value: number;
  color: string;
}

// ============================================================
// Constants
// ============================================================

const DEFAULT_EXPENSES: ExpenseItem[] = [
  { id: 'transport', label: 'Transportasi', amount: 500_000 },
  { id: 'utilities', label: 'Utilitas (Listrik/Air/Gas)', amount: 400_000 },
  { id: 'internet', label: 'Internet & Telepon', amount: 350_000 },
  { id: 'insurance', label: 'Asuransi', amount: 300_000 },
];

const PIE_COLORS = ['#3b82f6', '#ef4444', '#f59e0b', '#22c55e'];

// ============================================================
// Helpers
// ============================================================

let _nextId = 100;
function makeId(): string {
  return `exp-${_nextId++}`;
}

function computeSavingsTarget(
  outstandingBalance: number,
  targetDate: string | undefined,
): number {
  if (!targetDate) return 0;
  const now = new Date();
  const target = new Date(targetDate);
  const monthsLeft =
    (target.getFullYear() - now.getFullYear()) * 12 +
    (target.getMonth() - now.getMonth());
  if (monthsLeft <= 0) return outstandingBalance;
  return Math.ceil(outstandingBalance / monthsLeft);
}

// ============================================================
// Sub-components
// ============================================================

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-primary" size={32} />
      <span className="ml-3 text-gray-500">Memuat data anggaran...</span>
    </div>
  );
}

function SummaryCard({
  title,
  value,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  color: 'blue' | 'red' | 'amber' | 'green';
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-xl font-bold text-gray-900 mt-1 truncate">
            {value}
          </p>
        </div>
        <div
          className={`p-2.5 rounded-lg border flex-shrink-0 ml-3 ${colorClasses[color]}`}
        >
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function HealthBadge({ level }: { level: 'green' | 'yellow' | 'red' }) {
  const config = {
    green: {
      icon: ShieldCheck,
      text: 'Sehat — Dana fleksibel > 20%',
      bg: 'bg-emerald-50 border-emerald-200',
      textColor: 'text-emerald-800',
      iconColor: 'text-emerald-600',
    },
    yellow: {
      icon: ShieldAlert,
      text: 'Cukup — Dana fleksibel 10–20%',
      bg: 'bg-amber-50 border-amber-200',
      textColor: 'text-amber-800',
      iconColor: 'text-amber-600',
    },
    red: {
      icon: ShieldX,
      text: 'Ketat — Dana fleksibel < 10%',
      bg: 'bg-red-50 border-red-200',
      textColor: 'text-red-800',
      iconColor: 'text-red-600',
    },
  } as const;

  const c = config[level];
  const Icon = c.icon;

  return (
    <div className={cn('inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border', c.bg)}>
      <Icon size={18} className={c.iconColor} />
      <span className={cn('text-sm font-semibold', c.textColor)}>{c.text}</span>
    </div>
  );
}

function BudgetPieChart({ data }: { data: PieSlice[] }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total <= 0) return null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-800 mb-4">
        Alokasi Pendapatan
      </h3>
      <div className="flex flex-col sm:flex-row items-center gap-6">
        <ResponsiveContainer width={200} height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={85}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number) => formatIDR(value)}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: item.color }}
              />
              <div>
                <p className="text-xs text-gray-500">{item.name}</p>
                <p className="text-sm font-semibold">{formatIDR(item.value)}</p>
                <p className="text-[10px] text-gray-400">
                  {((item.value / total) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function TipsSection({ tips }: { tips: string[] }) {
  if (tips.length === 0) return null;

  return (
    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-200 p-6">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb size={18} className="text-blue-600" />
        <h3 className="text-base font-semibold text-blue-900">Tips Anggaran</h3>
      </div>
      <ul className="space-y-2">
        {tips.map((tip, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-blue-800">
            <span className="text-blue-400 mt-0.5">•</span>
            <span>{tip}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ============================================================
// Page Component
// ============================================================

function BudgetPage() {
  const { data: cmsStatus, isLoading: statusLoading } = useKprStatus();
  const { data: savedGoal, isLoading: goalLoading } = useGoal();

  // Income state — initialized from saved goal once loaded
  const [income, setIncome] = useState<number>(0);
  const [isIncomeInitialized, setIsIncomeInitialized] = useState(false);

  // Fixed expenses — user-editable list
  const [expenses, setExpenses] = useState<ExpenseItem[]>(DEFAULT_EXPENSES);

  // New expense form state
  const [newLabel, setNewLabel] = useState('');
  const [newAmount, setNewAmount] = useState('');

  // Auto-fill income from saved goal
  useEffect(() => {
    if (savedGoal && !isIncomeInitialized && savedGoal.monthlyIncome) {
      setIncome(savedGoal.monthlyIncome);
      setIsIncomeInitialized(true);
    }
  }, [savedGoal, isIncomeInitialized]);

  const isLoading = statusLoading || goalLoading;

  // KPR installment from status
  const kprInstallment = cmsStatus?.currentInstallment ?? 0;
  const outstandingBalance = cmsStatus?.outstandingBalance ?? 0;

  // Derived values
  const totalOtherExpenses = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amount, 0),
    [expenses],
  );

  const totalFixedExpenses = kprInstallment + totalOtherExpenses;

  const savingsTarget = useMemo(
    () => computeSavingsTarget(outstandingBalance, savedGoal?.targetDate),
    [outstandingBalance, savedGoal?.targetDate],
  );

  const discretionary = income - totalFixedExpenses - savingsTarget;

  // Health level
  const healthLevel: 'green' | 'yellow' | 'red' = useMemo(() => {
    if (income <= 0) return 'red';
    const pct = discretionary / income;
    if (pct > 0.2) return 'green';
    if (pct >= 0.1) return 'yellow';
    return 'red';
  }, [discretionary, income]);

  // Pie chart data
  const pieData: PieSlice[] = useMemo(() => {
    const slices: PieSlice[] = [
      { name: 'Angsuran KPR', value: kprInstallment, color: PIE_COLORS[0] },
      { name: 'Pengeluaran Lain', value: totalOtherExpenses, color: PIE_COLORS[1] },
      { name: 'Target Tabungan', value: savingsTarget, color: PIE_COLORS[2] },
      { name: 'Dana Fleksibel', value: Math.max(discretionary, 0), color: PIE_COLORS[3] },
    ];
    return slices.filter((s) => s.value > 0);
  }, [kprInstallment, totalOtherExpenses, savingsTarget, discretionary]);

  // Dynamic tips
  const tips: string[] = useMemo(() => {
    const result: string[] = [];
    if (income <= 0) {
      result.push('Masukkan penghasilan bulanan Anda untuk melihat analisis anggaran.');
      return result;
    }
    if (discretionary < 0) {
      result.push(
        `Pengeluaran melebihi pendapatan sebesar ${formatIDR(Math.abs(discretionary))}. Pertimbangkan untuk mengurangi pengeluaran non-esensial.`,
      );
    }
    if (healthLevel === 'red') {
      result.push('Aturan 50/30/20: alokasikan maks. 50% untuk kebutuhan, 30% keinginan, 20% tabungan.');
      result.push('Cek apakah ada pengeluaran langganan yang bisa dipangkas.');
    }
    if (healthLevel === 'yellow') {
      result.push('Anggaran cukup ketat. Coba kurangi pengeluaran variabel untuk menambah dana darurat.');
    }
    if (healthLevel === 'green') {
      result.push('Bagus! Pertimbangkan untuk menambah pembayaran ekstra KPR agar lunas lebih cepat.');
      result.push('Alokasikan sebagian dana fleksibel ke dana darurat (3–6× pengeluaran bulanan).');
    }
    if (savingsTarget > 0 && savedGoal?.targetDate) {
      const targetLabel = new Date(savedGoal.targetDate).toLocaleDateString('id-ID', {
        month: 'long',
        year: 'numeric',
      });
      result.push(
        `Untuk melunasi KPR di ${targetLabel}, Anda perlu menabung ${formatIDR(savingsTarget)}/bulan.`,
      );
    }
    return result;
  }, [income, discretionary, healthLevel, savingsTarget, savedGoal?.targetDate]);

  // Handlers
  const handleAddExpense = useCallback(() => {
    const amount = parseFloat(newAmount);
    if (!newLabel.trim() || isNaN(amount) || amount <= 0) return;
    setExpenses((prev) => [
      ...prev,
      { id: makeId(), label: newLabel.trim(), amount },
    ]);
    setNewLabel('');
    setNewAmount('');
  }, [newLabel, newAmount]);

  const handleRemoveExpense = useCallback((id: string) => {
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const handleUpdateExpense = useCallback(
    (id: string, field: 'label' | 'amount', value: string) => {
      setExpenses((prev) =>
        prev.map((e) => {
          if (e.id !== id) return e;
          if (field === 'label') return { ...e, label: value };
          const num = parseFloat(value);
          return { ...e, amount: isNaN(num) ? 0 : num };
        }),
      );
    },
    [],
  );

  // Loading
  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Perencana Anggaran</h1>
        <p className="text-sm text-gray-500 mt-1">
          Kelola alokasi pendapatan bulanan untuk KPR dan pengeluaran lainnya
        </p>
      </div>

      {/* Health Badge */}
      <HealthBadge level={healthLevel} />

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <SummaryCard
          title="Total Pendapatan"
          value={income > 0 ? formatIDR(income) : '—'}
          icon={Wallet}
          color="blue"
        />
        <SummaryCard
          title="Total Pengeluaran Tetap"
          value={formatIDR(totalFixedExpenses)}
          icon={TrendingDown}
          color="red"
        />
        <SummaryCard
          title="Target Tabungan"
          value={savingsTarget > 0 ? formatIDR(savingsTarget) : '—'}
          icon={PiggyBank}
          color="amber"
        />
        <SummaryCard
          title="Dana Fleksibel"
          value={income > 0 ? formatIDR(discretionary) : '—'}
          icon={discretionary >= 0 ? Wallet : AlertCircle}
          color={income > 0 && discretionary >= 0 ? 'green' : 'red'}
        />
      </div>

      {/* Income & Expenses Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <Wallet size={20} className="text-blue-600" />
            <h2 className="text-base font-semibold text-gray-800">
              Pendapatan Bulanan
            </h2>
          </div>
          <label
            htmlFor="budget-income"
            className="block text-xs font-medium text-gray-600 mb-1"
          >
            Penghasilan per bulan
          </label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
              Rp
            </span>
            <input
              id="budget-income"
              type="number"
              value={income || ''}
              onChange={(e) => {
                setIncome(parseFloat(e.target.value) || 0);
                setIsIncomeInitialized(true);
              }}
              placeholder="0"
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors tabular-nums"
            />
          </div>
          {savedGoal?.monthlyIncome && (
            <p className="text-xs text-gray-400 mt-2">
              Terisi otomatis dari Target Pelunasan ({formatIDR(savedGoal.monthlyIncome)})
            </p>
          )}
        </div>

        {/* Savings Target Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <PiggyBank size={20} className="text-amber-600" />
            <h2 className="text-base font-semibold text-gray-800">
              Target Tabungan Pelunasan
            </h2>
          </div>
          {savedGoal?.targetDate ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Sisa Pokok</span>
                <span className="text-sm font-semibold tabular-nums">
                  {formatIDR(outstandingBalance)}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-gray-100">
                <span className="text-sm text-gray-600">Target Pelunasan</span>
                <span className="text-sm font-semibold tabular-nums">
                  {new Date(savedGoal.targetDate).toLocaleDateString('id-ID', {
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 bg-amber-50 px-3 rounded-lg">
                <span className="text-sm font-semibold text-amber-800">
                  Perlu per bulan
                </span>
                <span className="text-base font-bold text-amber-700 tabular-nums">
                  {formatIDR(savingsTarget)}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              Atur target pelunasan di halaman{' '}
              <span className="font-medium text-blue-600">Target Pelunasan</span>{' '}
              untuk melihat target tabungan.
            </p>
          )}
        </div>
      </div>

      {/* Fixed Expenses Section */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-4">
          <TrendingDown size={20} className="text-red-600" />
          <h2 className="text-base font-semibold text-gray-800">
            Pengeluaran Tetap
          </h2>
        </div>

        {/* KPR Installment (read-only) */}
        <div className="flex items-center justify-between py-3 px-3 bg-blue-50 rounded-lg mb-3">
          <div>
            <p className="text-sm font-medium text-blue-800">Angsuran KPR</p>
            <p className="text-xs text-blue-600">Otomatis dari data pinjaman</p>
          </div>
          <span className="text-base font-bold text-blue-700 tabular-nums">
            {formatIDR(kprInstallment)}
          </span>
        </div>

        {/* Editable expense list */}
        <div className="space-y-2 mb-4">
          {expenses.map((exp) => (
            <div
              key={exp.id}
              className="flex items-center gap-2 group"
            >
              <input
                type="text"
                value={exp.label}
                onChange={(e) => handleUpdateExpense(exp.id, 'label', e.target.value)}
                className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
              />
              <div className="relative w-40">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                  Rp
                </span>
                <input
                  type="number"
                  value={exp.amount || ''}
                  onChange={(e) => handleUpdateExpense(exp.id, 'amount', e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors tabular-nums"
                />
              </div>
              <button
                type="button"
                onClick={() => handleRemoveExpense(exp.id)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                aria-label={`Hapus ${exp.label}`}
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Add new expense */}
        <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Nama pengeluaran"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
          />
          <div className="relative w-40">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">
              Rp
            </span>
            <input
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="0"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors tabular-nums"
            />
          </div>
          <button
            type="button"
            onClick={handleAddExpense}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors"
          >
            <Plus size={14} />
            Tambah
          </button>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-200">
          <span className="text-sm font-semibold text-gray-700">
            Total Pengeluaran Tetap
          </span>
          <span className="text-base font-bold text-red-600 tabular-nums">
            {formatIDR(totalFixedExpenses)}
          </span>
        </div>
      </div>

      {/* Pie Chart */}
      <BudgetPieChart data={pieData} />

      {/* Tips */}
      <TipsSection tips={tips} />

      {/* Info note */}
      <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500">
        <p className="font-medium text-gray-700 mb-1">Catatan</p>
        <p>
          Anggaran ini bersifat lokal dan tidak disimpan ke server. Data
          pendapatan diisi otomatis dari Target Pelunasan jika tersedia. Angsuran
          KPR diambil dari data pinjaman aktif Anda.
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/budget')({
  component: BudgetPage,
});
