import { createFileRoute } from '@tanstack/react-router';
import { useState, useMemo } from 'react';
import { Loader2, TrendingDown, Info } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from 'recharts';
import { formatIDR, formatPct, formatMonthLabel } from '@/lib/format';
import { useKprLoan, useSchedule } from '@/hooks';
import type { KprLoan, KprScheduleEntry } from '@/types';

// ============================================================
// Loading State
// ============================================================

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-primary" size={32} />
      <span className="ml-3 text-gray-500">Memuat data inflasi...</span>
    </div>
  );
}

// ============================================================
// Custom Tooltip
// ============================================================

interface TooltipPayloadItem {
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipPayloadItem[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm">
      <p className="font-medium text-gray-700 mb-1">{label}</p>
      {payload.map((item: TooltipPayloadItem) => (
        <p key={item.name} className="text-xs" style={{ color: item.color }}>
          {item.name}: {formatIDR(Math.round(item.value))}
        </p>
      ))}
    </div>
  );
}

// ============================================================
// Helper: group schedule entries by year
// ============================================================

function groupByYear(schedule: KprScheduleEntry[], firstPayment: string) {
  const yearMap = new Map<number, { year: number; label: string; totalInstallment: number; entries: number }>();

  for (const entry of schedule) {
    const date = new Date(firstPayment);
    date.setMonth(date.getMonth() + entry.monthNumber - 1);
    const year = date.getFullYear();
    const existing = yearMap.get(year);
    if (existing) {
      existing.totalInstallment += entry.totalInstallment;
      existing.entries += 1;
    } else {
      yearMap.set(year, { year, label: String(year), totalInstallment: entry.totalInstallment, entries: 1 });
    }
  }

  return Array.from(yearMap.values()).sort((a, b) => a.year - b.year);
}

// ============================================================
// Page Component
// ============================================================

function InflationPage() {
  const { data: loanData, isLoading: loanLoading } = useKprLoan();
  const { data: scheduleData, isLoading: scheduleLoading } = useSchedule();

  const [inflationRate, setInflationRate] = useState(4);

  const isLoading = loanLoading || scheduleLoading;

  const chartData = useMemo(() => {
    if (!loanData || !scheduleData) return null;
    const loan = loanData as KprLoan;
    const schedule = scheduleData.docs;
    const annualData = groupByYear(schedule, loan.firstPayment);
    const firstPaymentDate = new Date(loan.firstPayment);

    // Chart 1: Nominal vs Real installment per year
    const nominalVsReal = annualData.map((yr) => {
      const yearsFromStart = yr.year - firstPaymentDate.getFullYear();
      const avgMonthly = yr.totalInstallment / yr.entries;
      const realValue = avgMonthly / Math.pow(1 + inflationRate / 100, yearsFromStart);
      return {
        year: yr.label,
        nominal: Math.round(avgMonthly),
        real: Math.round(realValue),
      };
    });

    // Chart 2: Cumulative nominal vs real total cost
    let cumNominal = 0;
    let cumReal = 0;
    const cumulativeCost = annualData.map((yr) => {
      const yearsFromStart = yr.year - firstPaymentDate.getFullYear();
      cumNominal += yr.totalInstallment;
      // Each year's payments discounted to present value
      const realYearCost = yr.totalInstallment / Math.pow(1 + inflationRate / 100, yearsFromStart);
      cumReal += realYearCost;
      return {
        year: yr.label,
        nominal: Math.round(cumNominal),
        real: Math.round(cumReal),
      };
    });

    // Insight: what today's installment is worth in the last year
    const lastYear = annualData[annualData.length - 1];
    const yearsToEnd = lastYear.year - firstPaymentDate.getFullYear();
    const firstEntry = schedule[0];
    const currentInstallment = firstEntry?.totalInstallment ?? 0;
    const futureWorth = currentInstallment / Math.pow(1 + inflationRate / 100, yearsToEnd);

    // Total nominal vs real cost
    const totalNominal = schedule.reduce((sum, e) => sum + e.totalInstallment, 0);
    const totalReal = annualData.reduce((sum, yr) => {
      const yearsFromStart = yr.year - firstPaymentDate.getFullYear();
      return sum + yr.totalInstallment / Math.pow(1 + inflationRate / 100, yearsFromStart);
    }, 0);

    return { nominalVsReal, cumulativeCost, futureWorth, yearsToEnd, totalNominal, totalReal, currentInstallment };
  }, [loanData, scheduleData, inflationRate]);

  if (isLoading) return <LoadingState />;
  if (!chartData) return <div className="text-red-500">Gagal memuat data</div>;

  const savingsPct = ((chartData.totalNominal - chartData.totalReal) / chartData.totalNominal) * 100;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Penyesuaian Inflasi</h1>
        <p className="text-sm text-gray-500 mt-1">
          Nilai riil pembayaran KPR Anda dari waktu ke waktu — uang hari ini lebih berharga dari uang masa depan
        </p>
      </div>

      {/* Inflation rate control */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-gray-700">Asumsi Inflasi Tahunan</label>
            <p className="text-xs text-gray-500 mt-0.5">
              Rata-rata inflasi Indonesia 10 tahun terakhir: ~3.5–4.5%
            </p>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={10}
              step={0.5}
              value={inflationRate}
              onChange={(e) => setInflationRate(parseFloat(e.target.value))}
              className="w-40"
            />
            <span className="text-lg font-bold text-gray-900 w-16 text-right">{formatPct(inflationRate)}</span>
          </div>
        </div>
      </div>

      {/* Key insights */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl border border-blue-200 p-4">
          <p className="text-xs text-blue-600 font-medium">Angsuran Hari Ini</p>
          <p className="text-xl font-bold text-blue-900 mt-1">{formatIDR(chartData.currentInstallment)}</p>
          <p className="text-[10px] text-blue-600 mt-1">Nilai nominal per bulan</p>
        </div>
        <div className="bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl border border-amber-200 p-4">
          <p className="text-xs text-amber-600 font-medium">Nilai Riil di Tahun ke-{chartData.yearsToEnd}</p>
          <p className="text-xl font-bold text-amber-900 mt-1">{formatIDR(Math.round(chartData.futureWorth))}</p>
          <p className="text-[10px] text-amber-600 mt-1">
            {formatIDR(chartData.currentInstallment)} hari ini setara {formatIDR(Math.round(chartData.futureWorth))} dalam {chartData.yearsToEnd} tahun
          </p>
        </div>
        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl border border-emerald-200 p-4">
          <p className="text-xs text-emerald-600 font-medium">Penghematan Riil Akibat Inflasi</p>
          <p className="text-xl font-bold text-emerald-900 mt-1">{savingsPct.toFixed(1)}%</p>
          <p className="text-[10px] text-emerald-600 mt-1">
            Total biaya riil {formatIDR(Math.round(chartData.totalReal))} vs nominal {formatIDR(chartData.totalNominal)}
          </p>
        </div>
      </div>

      {/* Chart 1: Nominal vs Real installment */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Angsuran Tahunan: Nominal vs Riil</h3>
        <p className="text-xs text-gray-500 mb-4">
          Nilai riil menggunakan inflasi {formatPct(inflationRate)}/tahun. Garis riil menunjukkan daya beli aktual.
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData.nominalVsReal}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="nominal" name="Nominal" stroke="#ef4444" fill="#fef2f2" strokeWidth={2} />
            <Area type="monotone" dataKey="real" name="Riil" stroke="#3b82f6" fill="#eff6ff" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Chart 2: Cumulative cost */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Kumulatif Biaya KPR: Nominal vs Riil</h3>
        <p className="text-xs text-gray-500 mb-4">
          Jarak antara garis nominal dan riil menunjukkan &quot;diskon inflasi&quot; yang Anda nikmati.
        </p>
        <ResponsiveContainer width="100%" height={320}>
          <LineChart data={chartData.cumulativeCost}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="year" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${(v / 1_000_000_000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
            <Tooltip content={<CustomTooltip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="nominal" name="Nominal" stroke="#ef4444" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="real" name="Riil" stroke="#3b82f6" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Explanation */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-blue-500 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-blue-800 space-y-2">
            <p className="font-semibold">Apa artinya ini?</p>
            <p>
              <strong>Nilai riil</strong> = nominal ÷ (1 + inflasi)<sup>tahun</sup>. Dengan inflasi {formatPct(inflationRate)},
              angsuran {formatIDR(chartData.currentInstallment)} hari ini setara dengan sekitar{' '}
              <strong>{formatIDR(Math.round(chartData.futureWorth))}</strong> dalam {chartData.yearsToEnd} tahun lagi.
            </p>
            <p>
              Artinya, beban angsuran KPR Anda <strong>terasa semakin ringan</strong> seiring waktu karena erosi inflasi.
              Total biaya KPR {formatIDR(chartData.totalNominal)} secara nominal bernilai{' '}
              <strong>{formatIDR(Math.round(chartData.totalReal))}</strong> dalam nilai hari ini — penghematan riil sekitar{' '}
              <strong>{savingsPct.toFixed(1)}%</strong>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/inflation')({
  component: InflationPage,
});
