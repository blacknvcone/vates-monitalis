import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import {
  CalendarDays,
  TrendingUp,
  AlertTriangle,
  DollarSign,
  Loader2,
} from 'lucide-react';
import { formatIDR, formatMonthLabel } from '@/lib/format';
import { useSchedule, useExtraPayments, useKprLoan } from '@/hooks';
import type { KprScheduleEntry, KprExtraPayment, KprLoan } from '@/types';

// ============================================================
// Types
// ============================================================

interface MonthCashflow {
  monthNumber: number;
  calendarDate: string;
  label: string;
  installment: number;
  extraPayment: number;
  totalOutflow: number;
}

interface CashflowSummary {
  avgMonthlyOutflow: number;
  peakMonth: MonthCashflow | null;
  totalAnnualOutflow: number;
  minOutflow: number;
  maxOutflow: number;
}

// ============================================================
// Helpers
// ============================================================

function buildCashflowData(
  schedule: KprScheduleEntry[],
  extraPayments: KprExtraPayment[],
  loan: KprLoan,
  currentMonth: number,
): { months: MonthCashflow[]; summary: CashflowSummary } {
  // Build a map of extra payments by calendar month (YYYY-MM)
  const extraByMonth = new Map<string, number>();
  for (const ep of extraPayments) {
    const key = ep.paymentDate.slice(0, 7); // "2024-03"
    extraByMonth.set(key, (extraByMonth.get(key) ?? 0) + ep.amount);
  }

  // Get 12 months forward from current month
  const startMonth = Math.max(currentMonth, 1);
  const endMonth = Math.min(startMonth + 11, loan.tenorMonths);

  const months: MonthCashflow[] = [];
  for (let m = startMonth; m <= endMonth; m++) {
    const entry = schedule.find((e) => e.monthNumber === m);
    if (!entry) continue;

    const monthKey = entry.calendarDate.slice(0, 7);
    const extraPayment = extraByMonth.get(monthKey) ?? 0;

    months.push({
      monthNumber: m,
      calendarDate: entry.calendarDate,
      label: formatMonthLabel(m, loan.firstPayment),
      installment: entry.totalInstallment,
      extraPayment,
      totalOutflow: entry.totalInstallment + extraPayment,
    });
  }

  const totalAnnualOutflow = months.reduce((s, m) => s + m.totalOutflow, 0);
  const avgMonthlyOutflow = months.length > 0 ? Math.round(totalAnnualOutflow / months.length) : 0;
  const peakMonth = months.reduce<MonthCashflow | null>(
    (peak, m) => (peak === null || m.totalOutflow > peak.totalOutflow ? m : peak),
    null,
  );
  const minOutflow = months.length > 0 ? Math.min(...months.map((m) => m.totalOutflow)) : 0;
  const maxOutflow = months.length > 0 ? Math.max(...months.map((m) => m.totalOutflow)) : 0;

  return {
    months,
    summary: { avgMonthlyOutflow, peakMonth, totalAnnualOutflow, minOutflow, maxOutflow },
  };
}

/** Returns a Tailwind bg class based on how high the outflow is relative to the range */
function getIntensityClass(value: number, min: number, max: number): string {
  if (max === min) return 'bg-blue-50';
  const ratio = (value - min) / (max - min);
  if (ratio < 0.25) return 'bg-blue-50';
  if (ratio < 0.5) return 'bg-blue-100';
  if (ratio < 0.75) return 'bg-blue-200';
  return 'bg-blue-300';
}

function getIntensityTextClass(value: number, min: number, max: number): string {
  if (max === min) return 'text-blue-700';
  const ratio = (value - min) / (max - min);
  if (ratio < 0.5) return 'text-blue-700';
  return 'text-blue-900';
}

// ============================================================
// Components
// ============================================================

function SummaryCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  color: 'blue' | 'green' | 'amber' | 'red';
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    red: 'bg-red-50 text-red-600 border-red-200',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-xl font-bold text-gray-900 mt-1 truncate">{value}</p>
          {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-2.5 rounded-lg border flex-shrink-0 ml-3 ${colorClasses[color]}`}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  );
}

function MonthCell({
  data,
  minOutflow,
  maxOutflow,
}: {
  data: MonthCashflow;
  minOutflow: number;
  maxOutflow: number;
}) {
  const bgClass = getIntensityClass(data.totalOutflow, minOutflow, maxOutflow);
  const textClass = getIntensityTextClass(data.totalOutflow, minOutflow, maxOutflow);

  return (
    <div className={`rounded-xl border border-gray-200 p-4 ${bgClass} transition-all hover:shadow-md`}>
      <p className="text-xs font-semibold text-gray-500 mb-2">{data.label}</p>
      <p className={`text-lg font-bold ${textClass}`}>{formatIDR(data.totalOutflow)}</p>
      <div className="mt-2 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-500">Angsuran</span>
          <span className="font-medium text-gray-700">{formatIDR(data.installment)}</span>
        </div>
        {data.extraPayment > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-emerald-600">Ekstra</span>
            <span className="font-medium text-emerald-700">+{formatIDR(data.extraPayment)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function CashflowCalendarGrid({
  months,
  summary,
}: {
  months: MonthCashflow[];
  summary: CashflowSummary;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {months.map((m) => (
        <MonthCell
          key={m.monthNumber}
          data={m}
          minOutflow={summary.minOutflow}
          maxOutflow={summary.maxOutflow}
        />
      ))}
    </div>
  );
}

function Legend() {
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <span>Intensitas warna:</span>
      <span className="inline-block w-6 h-4 rounded bg-blue-50 border border-gray-200" />
      <span>Rendah</span>
      <span className="inline-block w-6 h-4 rounded bg-blue-100 border border-gray-200" />
      <span className="inline-block w-6 h-4 rounded bg-blue-200 border border-gray-200" />
      <span className="inline-block w-6 h-4 rounded bg-blue-300 border border-gray-200" />
      <span>Tinggi</span>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-primary" size={32} />
      <span className="ml-3 text-gray-500">Memuat data cashflow...</span>
    </div>
  );
}

// ============================================================
// Page Component
// ============================================================

function CashflowPage() {
  const { data: scheduleData, isLoading: scheduleLoading } = useSchedule();
  const { data: extraPaymentsData, isLoading: extraLoading } = useExtraPayments();
  const { data: loanData, isLoading: loanLoading } = useKprLoan();

  const isLoading = scheduleLoading || extraLoading || loanLoading;

  const { months, summary, currentMonth } = useMemo(() => {
    if (!scheduleData || !loanData) return { months: [], summary: null, currentMonth: 0 };

    const schedule: KprScheduleEntry[] = scheduleData.docs;
    const extraPayments: KprExtraPayment[] = extraPaymentsData?.docs ?? [];
    const loan = loanData as KprLoan;

    // Derive current month from last paid entry
    const paid = schedule.filter((e) => e.isPaid && e.monthNumber > 0);
    const currentMonth = paid.length > 0 ? Math.max(...paid.map((e) => e.monthNumber)) : 1;

    const { months, summary } = buildCashflowData(schedule, extraPayments, loan, currentMonth);

    return { months, summary, currentMonth };
  }, [scheduleData, extraPaymentsData, loanData]);

  if (isLoading) return <LoadingState />;

  if (!scheduleData || !loanData) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
        <p className="text-sm font-semibold text-red-700">Gagal memuat data</p>
        <p className="text-xs text-red-600 mt-1">Pastikan data pinjaman tersedia.</p>
      </div>
    );
  }

  if (!summary || months.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-center">
        <p className="text-sm font-semibold text-amber-700">Tidak ada data jadwal tersedia</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Kalender Cashflow</h1>
        <p className="text-sm text-gray-500 mt-1">
          Proyeksi arus kas keluar 12 bulan ke depan — mulai dari bulan ke-{currentMonth}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Rata-rata per Bulan"
          value={formatIDR(summary.avgMonthlyOutflow)}
          subtitle="Total keluar per bulan"
          icon={DollarSign}
          color="blue"
        />
        <SummaryCard
          title="Total 12 Bulan"
          value={formatIDR(summary.totalAnnualOutflow)}
          subtitle="Proyeksi 1 tahun ke depan"
          icon={TrendingUp}
          color="green"
        />
        <SummaryCard
          title="Bulan Tertinggi"
          value={summary.peakMonth ? formatIDR(summary.peakMonth.totalOutflow) : '-'}
          subtitle={summary.peakMonth?.label ?? '-'}
          icon={AlertTriangle}
          color="amber"
        />
        <SummaryCard
          title="Rentang Outflow"
          value={`${formatIDR(summary.minOutflow)} — ${formatIDR(summary.maxOutflow)}`}
          subtitle="Minimum — maksimum per bulan"
          icon={CalendarDays}
          color="red"
        />
      </div>

      {/* Calendar Grid */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-800">Kalender Bulanan</h2>
          <Legend />
        </div>
        <CashflowCalendarGrid months={months} summary={summary} />
      </div>

      {/* Info Note */}
      <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500">
        <p className="font-medium text-gray-700 mb-1">Catatan</p>
        <p>
          Warna biru menunjukkan intensitas total pengeluaran bulanan (angsuran + pembayaran ekstra).
          Semakin gelap, semakin tinggi pengeluaran. Data pembayaran ekstra ditampilkan jika ada.
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/cashflow')({
  component: CashflowPage,
});
