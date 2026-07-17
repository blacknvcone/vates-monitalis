import { useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Loader2,
  CheckCircle2,
  DollarSign,
  TrendingUp,
  Calendar,
} from 'lucide-react';
import { formatIDR, formatMonthLabel } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSchedule, useKprLoan, useKprStatus } from '@/hooks';
import { adaptCmsStatus } from '@/lib/cms-adapters';

// ============================================================
// Page Component
// ============================================================

function PaymentHistoryPage() {
  const { data: scheduleRes, isLoading: schLoading } = useSchedule();
  const { data: loan, isLoading: loanLoading } = useKprLoan();
  const { data: cmsStatus, isLoading: statusLoading } = useKprStatus();

  const isLoading = schLoading || loanLoading || statusLoading;
  const schedule = scheduleRes?.docs ?? [];
  const firstPayment = loan?.firstPayment ?? '';
  const loanAmount = loan?.loanAmount ?? 0;

  // Paid entries sorted by month
  const paidEntries = useMemo(
    () => schedule.filter((e) => e.isPaid).sort((a, b) => a.monthNumber - b.monthNumber),
    [schedule],
  );

  // Summary stats
  const summary = useMemo(() => {
    const totalPaid = paidEntries.reduce(
      (sum, e) => sum + (e.paidAmount ?? e.totalInstallment),
      0,
    );
    const totalPrincipal = paidEntries.reduce(
      (sum, e) => sum + e.principalPortion,
      0,
    );
    const totalInterest = paidEntries.reduce(
      (sum, e) => sum + e.interestPortion,
      0,
    );
    const monthsPaid = paidEntries.length;
    const principalPct = loanAmount > 0 ? (totalPrincipal / loanAmount) * 100 : 0;

    return { totalPaid, totalPrincipal, totalInterest, monthsPaid, principalPct };
  }, [paidEntries, loanAmount]);

  // Loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-primary" size={32} />
        <span className="ml-3 text-gray-500">Memuat data...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Riwayat Pembayaran
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Timeline visual pembayaran angsuran KPR yang sudah dibayar
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign size={14} className="text-blue-500" />
            <p className="text-xs text-gray-500">Total Dibayar</p>
          </div>
          <p className="text-lg font-bold text-blue-600">
            {formatIDR(summary.totalPaid)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-emerald-500" />
            <p className="text-xs text-gray-500">Total Pokok</p>
          </div>
          <p className="text-lg font-bold text-emerald-600">
            {formatIDR(summary.totalPrincipal)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp size={14} className="text-red-500" />
            <p className="text-xs text-gray-500">Total Bunga</p>
          </div>
          <p className="text-lg font-bold text-red-500">
            {formatIDR(summary.totalInterest)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Calendar size={14} className="text-amber-500" />
            <p className="text-xs text-gray-500">Bulan Terbayar</p>
          </div>
          <p className="text-lg font-bold text-amber-600">
            {summary.monthsPaid}
          </p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-700">
            Progres Pembayaran Pokok
          </h3>
          <span className="text-sm font-bold text-blue-600">
            {summary.principalPct.toFixed(1)}%
          </span>
        </div>
        <div className="w-full bg-gray-100 rounded-full h-3">
          <div
            className="bg-gradient-to-r from-blue-500 to-emerald-500 h-3 rounded-full transition-all duration-500"
            style={{ width: `${Math.min(summary.principalPct, 100)}%` }}
          />
        </div>
        <p className="text-xs text-gray-400 mt-2">
          {formatIDR(summary.totalPrincipal)} dari {formatIDR(loanAmount)} pokok
          terbayar
        </p>
      </div>

      {/* Timeline */}
      <div>
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          Timeline Pembayaran
        </h2>

        {paidEntries.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <CheckCircle2 size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">Belum ada pembayaran tercatat</p>
          </div>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200" />

            <div className="space-y-4">
              {paidEntries.map((entry) => {
                const isPrincipalHeavy =
                  entry.principalPortion >= entry.interestPortion;
                const principalPctEntry =
                  entry.totalInstallment > 0
                    ? (entry.principalPortion / entry.totalInstallment) * 100
                    : 0;

                return (
                  <div
                    key={entry.id}
                    className="relative pl-12"
                  >
                    {/* Dot on timeline */}
                    <div
                      className={cn(
                        'absolute left-2.5 top-4 w-3 h-3 rounded-full border-2 border-white shadow-sm',
                        isPrincipalHeavy ? 'bg-emerald-500' : 'bg-red-500',
                      )}
                    />

                    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                              Bulan {entry.monthNumber}
                            </span>
                            <span
                              className={cn(
                                'text-xs font-semibold px-2 py-0.5 rounded-full',
                                isPrincipalHeavy
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-red-50 text-red-700',
                              )}
                            >
                              {isPrincipalHeavy
                                ? 'Pokok Dominan'
                                : 'Bunga Dominan'}
                            </span>
                          </div>
                          <p className="text-sm font-medium text-gray-900 mt-1">
                            {formatMonthLabel(
                              entry.monthNumber,
                              firstPayment,
                            )}
                          </p>
                          {entry.paidDate && (
                            <p className="text-xs text-gray-400 mt-0.5">
                              Dibayar:{' '}
                              {new Date(entry.paidDate).toLocaleDateString(
                                'id-ID',
                                {
                                  day: 'numeric',
                                  month: 'long',
                                  year: 'numeric',
                                },
                              )}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold text-gray-900 tabular-nums">
                            {formatIDR(
                              entry.paidAmount ?? entry.totalInstallment,
                            )}
                          </p>
                          <p className="text-xs text-gray-400">
                            Sisa: {formatIDR(entry.outstandingBalance)}
                          </p>
                        </div>
                      </div>

                      {/* Principal vs Interest bar */}
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-emerald-600 font-medium">
                            Pokok {formatIDR(entry.principalPortion)}
                          </span>
                          <span className="text-red-500 font-medium">
                            Bunga {formatIDR(entry.interestPortion)}
                          </span>
                        </div>
                        <div className="w-full bg-red-100 rounded-full h-1.5 flex overflow-hidden">
                          <div
                            className="bg-emerald-500 h-1.5"
                            style={{
                              width: `${principalPctEntry}%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute('/payment-history')({
  component: PaymentHistoryPage,
});
