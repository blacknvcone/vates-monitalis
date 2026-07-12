import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import {
  TrendingDown,
  CalendarClock,
  Percent,
  Wallet,
  ArrowDown,
  Clock,
  AlertTriangle,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { formatIDR, formatIDRCompact, formatPct, formatMonthLabel } from '@/lib/format';
import type { KprStatus, KprLoan, KprScheduleEntry, KprRateTier, PhaseInfo } from '@/types';

// ============================================================
// Mock data generator (until CMS is connected)
// ============================================================

function generateMockData() {
  const loan: KprLoan = {
    id: 'mock-loan-1',
    borrowerName: 'Fachrul Dani Prasetya',
    coBorrower: 'Nur Winingsih',
    bankName: 'BRI',
    branch: 'Kanca HR Muhammad',
    loanAmount: 415_000_000,
    housePrice: 539_000_000,
    downPayment: 124_000_000,
    tenorMonths: 240,
    firstPayment: '2023-11-01',
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

  const phases: PhaseInfo[] = [
    { phase: 1, startMonth: 1, endMonth: 36, rate: 4.75, installment: 2_681_900, startDate: '2023-11-01', endDate: '2026-10-01', label: 'Fase 1 (4.75%)' },
    { phase: 2, startMonth: 37, endMonth: 72, rate: 8.00, installment: 3_367_400, startDate: '2026-11-01', endDate: '2029-10-01', label: 'Fase 2 (8.00%)' },
    { phase: 3, startMonth: 73, endMonth: 240, rate: 10.25, installment: 3_815_600, startDate: '2029-11-01', endDate: '2043-10-01', label: 'Fase 3 (10.25%)' },
  ];

  // Current status (month 33, July 2026)
  const status: KprStatus = {
    currentMonth: 33,
    currentDate: '2026-07-01',
    currentRate: 4.75,
    currentInstallment: 2_681_900,
    outstandingBalance: 378_443_227,
    totalPaid: 88_502_700,
    totalPrincipalPaid: 36_556_773,
    totalInterestPaid: 51_945_927,
    pctPaid: 8.8,
    monthsRemaining: 207,
    nextPaymentDate: '2026-08-01',
    nextPaymentAmount: 2_681_900,
    nextPaymentPrincipal: 1_183_896,
    nextPaymentInterest: 1_498_004,
    nextBalanceAfter: 377_259_331,
    currentPhase: 1,
    nextPhaseMonth: 37,
    nextPhaseRate: 8.00,
    monthsUntilNextPhase: 4,
  };

  // Schedule (first 36 months summary for chart)
  const scheduleSummary = [
    { month: 0, balance: 415_000_000, principal: 0, interest: 0 },
    { month: 6, balance: 408_702_822, principal: 6_297_178, interest: 9_794_222 },
    { month: 12, balance: 402_254_598, principal: 12_745_402, interest: 19_439_198 },
    { month: 18, balance: 395_651_703, principal: 19_348_297, interest: 28_936_703 },
    { month: 24, balance: 388_890_432, principal: 26_109_568, interest: 38_256_032 },
    { month: 30, balance: 381_966_980, principal: 33_033_020, interest: 47_332_580 },
    { month: 33, balance: 378_443_227, principal: 36_556_773, interest: 51_945_927 },
    { month: 36, balance: 374_877_462, principal: 40_122_538, interest: 56_425_862 },
    { month: 48, balance: 364_068_227, principal: 50_931_773, interest: 76_326_827 },
    { month: 60, balance: 352_361_830, principal: 62_638_170, interest: 96_717_830 },
    { month: 72, balance: 339_683_808, principal: 75_316_192, interest: 142_458_608 },
    { month: 120, balance: 285_724_405, principal: 129_275_595, interest: 278_648_005 },
    { month: 180, balance: 178_539_079, principal: 236_460_921, interest: 405_627_479 },
    { month: 240, balance: 0, principal: 415_000_000, interest: 443_782_131 },
  ];

  return { loan, phases, status, scheduleSummary };
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
  trend,
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  trend?: { value: string; positive: boolean };
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    amber: 'bg-amber-50 text-amber-600 border-amber-200',
    red: 'bg-red-50 text-red-600 border-red-200',
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-400 mt-1">{subtitle}</p>
          )}
          {trend && (
            <p className={`text-xs font-medium mt-2 ${trend.positive ? 'text-emerald-600' : 'text-red-600'}`}>
              {trend.positive ? '↓' : '↑'} {trend.value}
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg border ${colorClasses[color]}`}>
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

function PhaseTimeline({ phases, currentPhase }: { phases: PhaseInfo[]; currentPhase: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Timeline Bunga Berjenjang</h3>
      <div className="flex gap-2 items-center">
        {phases.map((phase, i) => {
          const isActive = phase.phase === currentPhase;
          const isPast = phase.phase < currentPhase;
          const widthPct = ((phase.endMonth - phase.startMonth + 1) / 240) * 100;

          return (
            <div key={phase.phase} className="flex-1 relative">
              <div
                className={`h-3 rounded-full transition-all ${
                  isPast
                    ? 'bg-emerald-400'
                    : isActive
                      ? 'bg-blue-500 animate-pulse'
                      : 'bg-gray-200'
                }`}
                style={{ minWidth: `${widthPct}%` }}
              />
              <div className="mt-2">
                <p className={`text-xs font-semibold ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                  {phase.rate}%
                </p>
                <p className="text-[10px] text-gray-400">
                  {formatIDRCompact(phase.installment)}/bln
                </p>
              </div>
              {isActive && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BalanceChart({ data }: { data: { month: number; balance: number }[] }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Outstanding Balance</h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => formatIDRCompact(v)}
          />
          <Tooltip
            formatter={(value: number) => [formatIDR(value), 'Saldo']}
            labelFormatter={(label) => `Bulan ${label}`}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="#1e3a5f"
            fill="#1e3a5f"
            fillOpacity={0.1}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function PaymentBreakdownChart({ principal, interest }: { principal: number; interest: number }) {
  const data = [
    { name: 'Pokok', value: principal, color: '#22c55e' },
    { name: 'Bunga', value: interest, color: '#ef4444' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Komposisi Pembayaran</h3>
      <div className="flex items-center gap-6">
        <ResponsiveContainer width={160} height={160}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-3">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
              <div>
                <p className="text-xs text-gray-500">{item.name}</p>
                <p className="text-sm font-semibold">{formatIDR(item.value)}</p>
                <p className="text-[10px] text-gray-400">
                  {((item.value / (principal + interest)) * 100).toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NextPaymentCard({ status }: { status: KprStatus }) {
  return (
    <div className="bg-gradient-to-br from-primary to-primary-light text-white rounded-xl p-6">
      <div className="flex items-center gap-2 mb-4">
        <CalendarClock size={18} />
        <h3 className="text-sm font-semibold">Angsuran Berikutnya</h3>
      </div>
      <p className="text-3xl font-bold">{formatIDR(status.nextPaymentAmount)}</p>
      <p className="text-white/70 text-sm mt-1">{formatMonthLabel(status.currentMonth + 1, '2023-11-01')}</p>

      <div className="mt-4 pt-4 border-t border-white/20 grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-white/60 text-xs">Pokok</p>
          <p className="font-medium">{formatIDR(status.nextPaymentPrincipal)}</p>
        </div>
        <div>
          <p className="text-white/60 text-xs">Bunga</p>
          <p className="font-medium">{formatIDR(status.nextPaymentInterest)}</p>
        </div>
        <div>
          <p className="text-white/60 text-xs">Sisa Pokok</p>
          <p className="font-medium">{formatIDR(status.nextBalanceAfter)}</p>
        </div>
        <div>
          <p className="text-white/60 text-xs">Bunga Aktif</p>
          <p className="font-medium">{formatPct(status.currentRate)}</p>
        </div>
      </div>
    </div>
  );
}

function MilestoneAlert({ monthsUntil, currentRate, nextRate }: { monthsUntil: number; currentRate: number; nextRate: number }) {
  if (monthsUntil > 12) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
      <AlertTriangle size={18} className="text-amber-600 mt-0.5 flex-shrink-0" />
      <div>
        <p className="text-sm font-semibold text-amber-800">
          {monthsUntil} bulan lagi bunga naik ke {formatPct(nextRate)}
        </p>
        <p className="text-xs text-amber-600 mt-1">
          Angsuran akan naik dari {formatIDR(2_681_900)} menjadi {formatIDR(3_367_400)}/bulan.
          Pertimbangkan pelunasan sebelum perubahan bunga.
        </p>
      </div>
    </div>
  );
}

// ============================================================
// Page Component
// ============================================================

function DashboardPage() {
  const { loan, phases, status, scheduleSummary } = generateMockData();

  const totalCost20yr = 858_782_131;
  const savingsIfCloseNow = totalCost20yr - (status.totalPaid + status.outstandingBalance * 1.025);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ringkasan keuangan KPR {loan.bankName} &middot; {loan.borrowerName}
        </p>
      </div>

      {/* Milestone Alert */}
      {status.monthsUntilNextPhase && (
        <MilestoneAlert
          monthsUntil={status.monthsUntilNextPhase}
          currentRate={status.currentRate}
          nextRate={status.nextPhaseRate!}
        />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          title="Sisa Pokok"
          value={formatIDR(status.outstandingBalance)}
          subtitle={`${status.monthsRemaining} bulan tersisa`}
          icon={TrendingDown}
          color="blue"
          trend={{ value: `${formatPct(status.pctPaid)} terbayar`, positive: true }}
        />
        <SummaryCard
          title="Total Bunga Dibayar"
          value={formatIDR(status.totalInterestPaid)}
          subtitle={`dari ${formatIDR(totalCost20yr)} total`}
          icon={Percent}
          color="red"
        />
        <SummaryCard
          title="Total Sudah Dibayar"
          value={formatIDR(status.totalPaid)}
          subtitle={`${status.currentMonth} angsuran`}
          icon={Wallet}
          color="green"
        />
        <SummaryCard
          title="Bunga Aktif"
          value={formatPct(status.currentRate)}
          subtitle={`Fase ${status.currentPhase} dari 3`}
          icon={Clock}
          color="amber"
          trend={
            status.monthsUntilNextPhase
              ? { value: `Naik ke ${formatPct(status.nextPhaseRate!)} dalam ${status.monthsUntilNextPhase} bln`, positive: false }
              : undefined
          }
        />
      </div>

      {/* Phase Timeline */}
      <PhaseTimeline phases={phases} currentPhase={status.currentPhase} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <BalanceChart data={scheduleSummary} />
        </div>
        <PaymentBreakdownChart
          principal={status.totalPrincipalPaid}
          interest={status.totalInterestPaid}
        />
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NextPaymentCard status={status} />

        {/* Quick Stats */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Quick Stats</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Harga Rumah</span>
              <span className="font-medium">{formatIDR(loan.housePrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Uang Muka</span>
              <span className="font-medium">{formatIDR(loan.downPayment)} (23%)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Pokok Pinjaman</span>
              <span className="font-medium">{formatIDR(loan.loanAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Bunga 20 Tahun</span>
              <span className="font-medium text-red-600">{formatIDR(443_782_131)}</span>
            </div>
            <div className="border-t pt-3 flex justify-between text-sm">
              <span className="text-gray-500">Hemat jika lunasi Okt 2026</span>
              <span className="font-bold text-emerald-600">{formatIDR(savingsIfCloseNow)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/')({
  component: DashboardPage,
});
