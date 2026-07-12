import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import {
  TrendingDown,
  CalendarClock,
  Percent,
  Wallet,
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
import { MOCK_LOAN, MOCK_PHASES, getCurrentStatus, generateMockSchedule } from '@/lib/mock-data';

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
          {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
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

function PhaseTimeline({ currentPhase }: { currentPhase: number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Timeline Bunga Berjenjang</h3>
      <div className="flex gap-2 items-center">
        {MOCK_PHASES.map((phase) => {
          const isActive = phase.phase === currentPhase;
          const isPast = phase.phase < currentPhase;
          const widthPct = ((phase.endMonth - phase.startMonth + 1) / 240) * 100;

          return (
            <div key={phase.phase} className="flex-1 relative">
              <div
                className={`h-3 rounded-full transition-all ${
                  isPast ? 'bg-emerald-400' : isActive ? 'bg-blue-500 animate-pulse' : 'bg-gray-200'
                }`}
                style={{ minWidth: `${widthPct}%` }}
              />
              <div className="mt-2">
                <p className={`text-xs font-semibold ${isActive ? 'text-blue-600' : 'text-gray-500'}`}>
                  {phase.rate}%
                </p>
                <p className="text-[10px] text-gray-400">{formatIDRCompact(phase.installment)}/bln</p>
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

function BalanceChart() {
  const schedule = useMemo(() => generateMockSchedule(), []);
  const chartData = useMemo(() => {
    const milestones = [0, 6, 12, 18, 24, 30, 33, 36, 48, 60, 72, 120, 180, 240];
    return milestones.map((m) => ({
      month: m,
      balance: schedule[m]?.outstandingBalance ?? 0,
    }));
  }, [schedule]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Outstanding Balance</h3>
      <ResponsiveContainer width="100%" height={250}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis dataKey="month" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => formatIDRCompact(v)} />
          <Tooltip
            formatter={(value: number) => [formatIDR(value), 'Saldo']}
            labelFormatter={(label) => `Bulan ${label}`}
          />
          <Area type="monotone" dataKey="balance" stroke="#1e3a5f" fill="#1e3a5f" fillOpacity={0.1} strokeWidth={2} />
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
            <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
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

function NextPaymentCard({ status }: { status: ReturnType<typeof getCurrentStatus> }) {
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

function MilestoneAlert({ monthsUntil, nextRate }: { monthsUntil: number; nextRate: number }) {
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
  const status = useMemo(() => getCurrentStatus(), []);
  const totalCost20yr = 858_782_131;
  const savingsIfClose = totalCost20yr - (status.totalPaid + status.outstandingBalance * 1.025);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">
          Ringkasan keuangan KPR {MOCK_LOAN.bankName} &middot; {MOCK_LOAN.borrowerName}
        </p>
      </div>

      {status.monthsUntilNextPhase && (
        <MilestoneAlert monthsUntil={status.monthsUntilNextPhase} nextRate={status.nextPhaseRate!} />
      )}

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

      <PhaseTimeline currentPhase={status.currentPhase} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <BalanceChart />
        </div>
        <PaymentBreakdownChart principal={status.totalPrincipalPaid} interest={status.totalInterestPaid} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <NextPaymentCard status={status} />

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Quick Stats</h3>
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Harga Rumah</span>
              <span className="font-medium">{formatIDR(MOCK_LOAN.housePrice)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Uang Muka</span>
              <span className="font-medium">{formatIDR(MOCK_LOAN.downPayment)} (23%)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Pokok Pinjaman</span>
              <span className="font-medium">{formatIDR(MOCK_LOAN.loanAmount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Total Bunga 20 Tahun</span>
              <span className="font-medium text-red-600">{formatIDR(443_782_131)}</span>
            </div>
            <div className="border-t pt-3 flex justify-between text-sm">
              <span className="text-gray-500">Hemat jika lunasi Okt 2026</span>
              <span className="font-bold text-emerald-600">{formatIDR(savingsIfClose)}</span>
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
