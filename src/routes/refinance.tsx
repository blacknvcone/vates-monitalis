import { createFileRoute } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import {
  Landmark,
  ArrowRight,
  TrendingDown,
  Clock,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { formatIDR, formatPct, formatMonthLabel } from '@/lib/format';
import { useKprLoan, useKprStatus, useRateTiers, useSchedule } from '@/hooks';
import { adaptCmsStatus, adaptRateTiersToPhases } from '@/lib/cms-adapters';
import type { KprLoan, KprStatus, KprScheduleEntry, PhaseInfo } from '@/types';

// ============================================================
// Bank Rates Data
// ============================================================

interface BankRate {
  bank: string;
  fixedRate: number;
  fixedPeriod: number; // months
  floatingRate: number;
  maxTenor: number;
  minDownPayment: number;
  processingFee: string;
  notes: string;
}

const BANK_RATES: BankRate[] = [
  {
    bank: 'Bank BTN',
    fixedRate: 5.25,
    fixedPeriod: 36,
    floatingRate: 10.5,
    maxTenor: 300,
    minDownPayment: 15,
    processingFee: '1% dari plafon',
    notes: 'Program FLPP untuk rumah subsidi',
  },
  {
    bank: 'Bank BCA',
    fixedRate: 4.88,
    fixedPeriod: 24,
    floatingRate: 9.75,
    maxTenor: 300,
    minDownPayment: 15,
    processingFee: '1% + administrasi',
    notes: 'Bunga fixed kompetitif',
  },
  {
    bank: 'Bank Mandiri',
    fixedRate: 5.75,
    fixedPeriod: 36,
    floatingRate: 10.25,
    maxTenor: 300,
    minDownPayment: 10,
    processingFee: '0.5% - 1%',
    notes: 'DP rendah, proses cepat',
  },
  {
    bank: 'Bank BNI',
    fixedRate: 5.50,
    fixedPeriod: 36,
    floatingRate: 10.0,
    maxTenor: 300,
    minDownPayment: 15,
    processingFee: '1% dari plafon',
    notes: 'Griya BNI multiguna',
  },
  {
    bank: 'Bank BRI',
    fixedRate: 6.75,
    fixedPeriod: 36,
    floatingRate: 11.0,
    maxTenor: 240,
    minDownPayment: 10,
    processingFee: '0.5% + provisi',
    notes: 'KPR BRI fleksibel',
  },
];

// ============================================================
// Refinance Computation
// ============================================================

interface RefinanceResult {
  // Current loan
  currentBank: string;
  currentRate: number;
  currentInstallment: number;
  currentOutstanding: number;
  currentMonthsRemaining: number;
  currentRemainingCost: number;

  // New loan
  newBank: string;
  newRate: number;
  newTenor: number;
  newInstallment: number;
  processingFee: number;
  totalNewCost: number;

  // Savings
  monthlySavings: number;
  totalSavings: number;
  breakEvenMonths: number;
  breakEvenDate: string;
}

function computeRefinance(
  newRate: number,
  newTenorMonths: number,
  processingFee: number,
  status: KprStatus,
  loan: KprLoan,
  phases: PhaseInfo[],
  schedule: KprScheduleEntry[],
): RefinanceResult | null {
  if (newRate <= 0 || newTenorMonths <= 0) return null;

  const outstanding = status.outstandingBalance;

  // Current remaining cost: sum of remaining installments from schedule
  let currentRemainingCost = 0;
  for (let m = status.currentMonth + 1; m <= loan.tenorMonths; m++) {
    const entry = schedule.find((e) => e.monthNumber === m);
    if (entry) currentRemainingCost += entry.totalInstallment;
  }

  const currentMonthsRemaining = loan.tenorMonths - status.currentMonth;

  // New loan calculation (annuity formula)
  const monthlyRate = newRate / 100 / 12;
  let newInstallment: number;
  if (monthlyRate === 0) {
    newInstallment = outstanding / newTenorMonths;
  } else {
    newInstallment =
      (outstanding * monthlyRate * Math.pow(1 + monthlyRate, newTenorMonths)) /
      (Math.pow(1 + monthlyRate, newTenorMonths) - 1);
  }
  newInstallment = Math.round(newInstallment);

  // Total new cost = processing fee + (installment * months)
  const totalNewCost = processingFee + newInstallment * newTenorMonths;

  // Monthly savings
  const monthlySavings = status.currentInstallment - newInstallment;

  // Total savings
  const totalSavings = currentRemainingCost - totalNewCost;

  // Break-even months: processing fee / monthly savings
  const breakEvenMonths = monthlySavings > 0 ? Math.ceil(processingFee / monthlySavings) : Infinity;

  // Break-even date
  const breakEvenDate =
    breakEvenMonths < Infinity
      ? formatMonthLabel(status.currentMonth + breakEvenMonths, loan.firstPayment)
      : 'Tidak tercapai';

  return {
    currentBank: loan.bankName,
    currentRate: status.currentRate,
    currentInstallment: status.currentInstallment,
    currentOutstanding: outstanding,
    currentMonthsRemaining,
    currentRemainingCost,

    newBank: 'Bank Baru',
    newRate,
    newTenor: newTenorMonths,
    newInstallment,
    processingFee,
    totalNewCost,

    monthlySavings,
    totalSavings,
    breakEvenMonths: breakEvenMonths === Infinity ? -1 : breakEvenMonths,
    breakEvenDate,
  };
}

// ============================================================
// Components
// ============================================================

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  detail?: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'amber' | 'red' | 'gray';
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    red: 'bg-red-50 text-red-600 border-red-200',
    gray: 'bg-gray-50 text-gray-600 border-gray-200',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500">{label}</p>
          <p className="text-xl font-bold text-gray-900 mt-1 truncate">{value}</p>
          {detail && <p className="text-xs text-gray-400 mt-1">{detail}</p>}
        </div>
        <div className={`p-2.5 rounded-lg border flex-shrink-0 ml-3 ${colorClasses[color]}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function ComparisonTable({ result }: { result: RefinanceResult }) {
  const rows = [
    {
      label: 'Bank',
      current: result.currentBank,
      newValue: 'Bank Baru (Refinance)',
    },
    {
      label: 'Suku Bunga',
      current: formatPct(result.currentRate),
      newValue: formatPct(result.newRate),
    },
    {
      label: 'Angsuran/bulan',
      current: formatIDR(result.currentInstallment),
      newValue: formatIDR(result.newInstallment),
    },
    {
      label: 'Sisa Tenor',
      current: `${result.currentMonthsRemaining} bulan`,
      newValue: `${result.newTenor} bulan`,
    },
    {
      label: 'Total Sisa Biaya',
      current: formatIDR(result.currentRemainingCost),
      newValue: formatIDR(result.totalNewCost),
    },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Detail Perbandingan</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Parameter</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">KPR Saat Ini</th>
              <th className="text-center px-4 py-3 font-medium text-gray-600 w-10" />
              <th className="text-right px-4 py-3 font-medium text-emerald-600">Refinance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-gray-100">
                <td className="px-4 py-3 text-gray-600">{row.label}</td>
                <td className="px-4 py-3 text-right font-medium text-gray-900">{row.current}</td>
                <td className="px-4 py-3 text-center">
                  <ArrowRight size={14} className="text-gray-400 mx-auto" />
                </td>
                <td className="px-4 py-3 text-right font-medium text-emerald-700">{row.newValue}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="p-4 border-t border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-gray-600">Biaya Administrasi</span>
          <span className="text-sm font-semibold text-amber-600">{formatIDR(result.processingFee)}</span>
        </div>
      </div>
    </div>
  );
}

function SavingsPanel({ result }: { result: RefinanceResult }) {
  const isGood = result.totalSavings > 0;

  return (
    <div
      className={`rounded-xl border p-6 ${
        isGood
          ? 'bg-gradient-to-br from-emerald-50 to-emerald-100 border-emerald-200'
          : 'bg-gradient-to-br from-red-50 to-red-100 border-red-200'
      }`}
    >
      <h3 className={`text-sm font-bold mb-4 ${isGood ? 'text-emerald-900' : 'text-red-900'}`}>
        {isGood ? '✅ Refinance Menguntungkan' : '⚠️ Refinance Tidak Menguntungkan'}
      </h3>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <p className={`text-xs ${isGood ? 'text-emerald-600' : 'text-red-600'}`}>
            Penghematan/bulan
          </p>
          <p className={`text-xl font-bold mt-1 ${isGood ? 'text-emerald-900' : 'text-red-900'}`}>
            {result.monthlySavings >= 0 ? '+' : ''}{formatIDR(result.monthlySavings)}
          </p>
        </div>
        <div>
          <p className={`text-xs ${isGood ? 'text-emerald-600' : 'text-red-600'}`}>
            Total Penghematan
          </p>
          <p className={`text-xl font-bold mt-1 ${isGood ? 'text-emerald-900' : 'text-red-900'}`}>
            {result.totalSavings >= 0 ? '+' : ''}{formatIDR(result.totalSavings)}
          </p>
        </div>
        <div>
          <p className={`text-xs ${isGood ? 'text-emerald-600' : 'text-red-600'}`}>
            Break-even Point
          </p>
          <p className={`text-xl font-bold mt-1 ${isGood ? 'text-emerald-900' : 'text-red-900'}`}>
            {result.breakEvenMonths > 0 ? `${result.breakEvenMonths} bulan` : 'N/A'}
          </p>
          {result.breakEvenMonths > 0 && (
            <p className={`text-xs mt-0.5 ${isGood ? 'text-emerald-600' : 'text-red-600'}`}>
              ({result.breakEvenDate})
            </p>
          )}
        </div>
      </div>

      {isGood && result.breakEvenMonths > 0 && (
        <p className="text-xs text-emerald-700 mt-4">
          Biaya administrasi {formatIDR(result.processingFee)} akan tertutupi dalam {result.breakEvenMonths} bulan
          dari penghematan angsuran {formatIDR(result.monthlySavings)}/bulan.
        </p>
      )}
    </div>
  );
}

function BankRatesTable() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-700">Tabel Referensi Rate KPR Bank Umum</h3>
        <p className="text-xs text-gray-500 mt-1">
          Rate dapat berubah sewaktu-waktu. Hubungi bank untuk informasi terbaru.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50">
              <th className="text-left px-4 py-3 font-medium text-gray-600">Bank</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Fixed</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Periode</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Floating</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Max Tenor</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Catatan</th>
            </tr>
          </thead>
          <tbody>
            {BANK_RATES.map((bank) => (
              <tr key={bank.bank} className="border-t border-gray-100 hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{bank.bank}</td>
                <td className="px-4 py-3 text-right font-mono text-blue-700">{formatPct(bank.fixedRate)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{bank.fixedPeriod} bln</td>
                <td className="px-4 py-3 text-right font-mono text-amber-700">{formatPct(bank.floatingRate)}</td>
                <td className="px-4 py-3 text-right text-gray-600">{bank.maxTenor / 12} thn</td>
                <td className="px-4 py-3 text-xs text-gray-500">{bank.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-primary" size={32} />
      <span className="ml-3 text-gray-500">Memuat data refinance...</span>
    </div>
  );
}

// ============================================================
// Page Component
// ============================================================

function RefinancePage() {
  const { data: loanData, isLoading: loanLoading } = useKprLoan();
  const { data: cmsStatus, isLoading: statusLoading } = useKprStatus();
  const { data: tiersData, isLoading: tiersLoading } = useRateTiers();
  const { data: scheduleData, isLoading: scheduleLoading } = useSchedule();

  const isLoading = loanLoading || statusLoading || tiersLoading || scheduleLoading;

  // User inputs
  const [newRate, setNewRate] = useState(5.5);
  const [newTenorYears, setNewTenorYears] = useState(15);
  const [processingFeePercent, setProcessingFeePercent] = useState(1);

  const result = useMemo(() => {
    if (!loanData || !cmsStatus || !tiersData || !scheduleData) return null;

    const loan = loanData as KprLoan;
    const status = adaptCmsStatus(cmsStatus);
    const tiers = tiersData.docs;
    const phases = adaptRateTiersToPhases(tiers, loan.firstPayment);
    const schedule: KprScheduleEntry[] = scheduleData.docs;

    const newTenorMonths = newTenorYears * 12;
    const processingFee = Math.round((processingFeePercent / 100) * status.outstandingBalance);

    return computeRefinance(newRate, newTenorMonths, processingFee, status, loan, phases, schedule);
  }, [loanData, cmsStatus, tiersData, scheduleData, newRate, newTenorYears, processingFeePercent]);

  if (isLoading) return <LoadingState />;

  if (!loanData || !cmsStatus) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-sm font-semibold text-red-700">Gagal memuat data</p>
        <p className="text-xs text-red-600 mt-1">Pastikan data pinjaman tersedia.</p>
      </div>
    );
  }

  const loan = loanData as KprLoan;
  const status = adaptCmsStatus(cmsStatus);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kalkulator Refinance</h1>
        <p className="text-sm text-gray-500 mt-1">
          Bandingkan KPR {loan.bankName} Anda dengan opsi refinancing dari bank lain
        </p>
      </div>

      {/* Current Loan Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="Sisa Pokok"
          value={formatIDR(status.outstandingBalance)}
          icon={DollarSign}
          color="blue"
        />
        <MetricCard
          label="Angsuran Saat Ini"
          value={formatIDR(status.currentInstallment)}
          detail={`${formatPct(status.currentRate)} per tahun`}
          icon={Landmark}
          color="amber"
        />
        <MetricCard
          label="Sisa Tenor"
          value={`${status.monthsRemaining} bulan`}
          detail={`${(status.monthsRemaining / 12).toFixed(1)} tahun`}
          icon={Clock}
          color="gray"
        />
        <MetricCard
          label="Bulan Saat Ini"
          value={`${status.currentMonth}`}
          detail={`Fase ${status.currentPhase}`}
          icon={TrendingDown}
          color="green"
        />
      </div>

      {/* Refinance Inputs */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Landmark size={18} className="text-primary" />
          <h3 className="text-sm font-semibold text-gray-700">Parameter Refinance Baru</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Suku Bunga Baru (%/tahun)</label>
            <input
              type="number"
              value={newRate}
              onChange={(e) => setNewRate(Math.max(0, Number(e.target.value)))}
              step={0.1}
              min={0}
              max={30}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Rate fixed periode awal
            </p>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Tenor Baru (tahun)</label>
            <input
              type="range"
              value={newTenorYears}
              onChange={(e) => setNewTenorYears(Number(e.target.value))}
              min={5}
              max={25}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>5 tahun</span>
              <span className="font-medium text-gray-700">{newTenorYears} tahun ({newTenorYears * 12} bulan)</span>
              <span>25 tahun</span>
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Biaya Administrasi (%)</label>
            <input
              type="number"
              value={processingFeePercent}
              onChange={(e) => setProcessingFeePercent(Math.max(0, Number(e.target.value)))}
              step={0.1}
              min={0}
              max={5}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            />
            <p className="text-[10px] text-gray-400 mt-1">
              Dari sisa pokok: {formatIDR(Math.round((processingFeePercent / 100) * status.outstandingBalance))}
            </p>
          </div>
        </div>
      </div>

      {/* Quick Presets */}
      <div className="flex flex-wrap gap-2">
        <span className="text-xs text-gray-500 self-center mr-1">Preset bank:</span>
        {BANK_RATES.map((bank) => (
          <button
            key={bank.bank}
            onClick={() => {
              setNewRate(bank.fixedRate);
              setNewTenorYears(Math.min(newTenorYears, bank.maxTenor / 12));
            }}
            className="px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors"
          >
            {bank.bank} ({formatPct(bank.fixedRate)})
          </button>
        ))}
      </div>

      {/* Results */}
      {result && (
        <>
          <SavingsPanel result={result} />
          <ComparisonTable result={result} />
        </>
      )}

      {/* Bank Rates Reference */}
      <BankRatesTable />

      {/* Info Note */}
      <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500">
        <p className="font-medium text-gray-700 mb-1">Catatan</p>
        <p>
          Perhitungan menggunakan formula anuitas dengan asumsi bunga flat selama tenor baru.
          Break-even point menunjukkan kapan biaya administrasi tertutupi oleh penghematan angsuran.
          Rate KPR bank bersifat indikatif dan dapat berubah sewaktu-waktu.
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/refinance')({
  component: RefinancePage,
});
