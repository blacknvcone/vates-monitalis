import { useState, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  Loader2,
  Plus,
  Wallet,
  TrendingDown,
  Hash,
  CalendarDays,
} from 'lucide-react';
import { formatIDR, formatDateShort } from '@/lib/format';
import { cn } from '@/lib/utils';
import {
  useExtraPayments,
  useCreateExtraPayment,
  useSchedule,
  useKprLoan,
} from '@/hooks';

// ============================================================
// Page Component
// ============================================================

function ExtraPaymentsPage() {
  // Form state
  const [date, setDate] = useState('');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [formError, setFormError] = useState('');

  // Data hooks
  const { data: extraPaymentsRes, isLoading: epLoading } = useExtraPayments();
  const { data: scheduleRes, isLoading: schLoading } = useSchedule();
  const { data: loan, isLoading: loanLoading } = useKprLoan();
  const createMutation = useCreateExtraPayment();

  const isLoading = epLoading || schLoading || loanLoading;
  const extraPayments = extraPaymentsRes?.docs ?? [];
  const schedule = scheduleRes?.docs ?? [];

  // Summary computations
  const summary = useMemo(() => {
    const totalExtraPaid = extraPayments.reduce((sum, ep) => sum + ep.amount, 0);
    const count = extraPayments.length;
    const avgAmount = count > 0 ? Math.round(totalExtraPaid / count) : 0;

    // Estimate interest saved: compare total interest in schedule vs what it would be
    // without extra payments. Since we don't have a "no-extra" simulation,
    // we approximate by looking at how much principal was reduced early.
    // A simpler heuristic: each extra payment saves roughly
    // (current interest rate / 12) * amount * remaining months
    const currentRate = schedule.length > 0 ? schedule[0].interestRate / 100 : 0.0975;
    const totalMonths = loan?.tenorMonths ?? 240;
    const avgMonthFromStart =
      extraPayments.length > 0
        ? extraPayments.reduce((sum, ep) => {
            const epDate = new Date(ep.paymentDate);
            const firstDate = new Date(loan?.firstPayment ?? '2023-11-01');
            const monthsDiff =
              (epDate.getFullYear() - firstDate.getFullYear()) * 12 +
              (epDate.getMonth() - firstDate.getMonth());
            return sum + monthsDiff;
          }, 0) / extraPayments.length
        : 0;

    const remainingMonthsApprox = totalMonths - avgMonthFromStart;
    const interestSavedEstimate = Math.round(
      totalExtraPaid * (currentRate / 12) * remainingMonthsApprox,
    );

    return { totalExtraPaid, count, avgAmount, interestSavedEstimate };
  }, [extraPayments, schedule, loan]);

  // Form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!date) {
      setFormError('Tanggal wajib diisi');
      return;
    }
    const amountNum = parseFloat(amount.replace(/[^0-9]/g, ''));
    if (!amountNum || amountNum <= 0) {
      setFormError('Jumlah tidak valid');
      return;
    }

    createMutation.mutate(
      { date, amount: amountNum, note: note || undefined },
      {
        onSuccess: () => {
          setDate('');
          setAmount('');
          setNote('');
        },
      },
    );
  };

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
        <h1 className="text-2xl font-bold text-gray-900">Pelunasan Ekstra</h1>
        <p className="text-sm text-gray-500 mt-1">
          Lacak pembayaran ekstra untuk mempercepat pelunasan KPR
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={14} className="text-blue-500" />
            <p className="text-xs text-gray-500">Total Bayar Ekstra</p>
          </div>
          <p className="text-xl font-bold text-blue-600">
            {formatIDR(summary.totalExtraPaid)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <Hash size={14} className="text-emerald-500" />
            <p className="text-xs text-gray-500">Jumlah Transaksi</p>
          </div>
          <p className="text-xl font-bold text-emerald-600">{summary.count}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <CalendarDays size={14} className="text-amber-500" />
            <p className="text-xs text-gray-500">Rata-rata per Transaksi</p>
          </div>
          <p className="text-xl font-bold text-amber-600">
            {formatIDR(summary.avgAmount)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown size={14} className="text-red-500" />
            <p className="text-xs text-gray-500">Estimasi Bunga Hemat</p>
          </div>
          <p className="text-xl font-bold text-red-500">
            {formatIDR(summary.interestSavedEstimate)}
          </p>
        </div>
      </div>

      {/* Add Extra Payment Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <h2 className="text-base font-semibold text-gray-800 mb-4">
          Tambah Pembayaran Ekstra
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="ep-date"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Tanggal
              </label>
              <input
                id="ep-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="ep-amount"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Jumlah (IDR)
              </label>
              <input
                id="ep-amount"
                type="text"
                inputMode="numeric"
                placeholder="50.000.000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
              />
            </div>
            <div>
              <label
                htmlFor="ep-note"
                className="block text-xs font-medium text-gray-600 mb-1"
              >
                Catatan (opsional)
              </label>
              <input
                id="ep-note"
                type="text"
                placeholder="Bonus akhir tahun"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
              />
            </div>
          </div>

          {formError && (
            <p className="text-xs text-red-600">{formError}</p>
          )}
          {createMutation.isError && (
            <p className="text-xs text-red-600">
              Gagal menyimpan: {createMutation.error?.message}
            </p>
          )}

          <button
            type="submit"
            disabled={createMutation.isPending}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm',
              createMutation.isPending
                ? 'bg-blue-400 cursor-not-allowed'
                : 'bg-blue-600 hover:bg-blue-700',
            )}
          >
            {createMutation.isPending ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Plus size={15} />
            )}
            {createMutation.isPending ? 'Menyimpan...' : 'Tambah Pembayaran'}
          </button>
        </form>
      </div>

      {/* Extra Payments Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-800">
            Riwayat Pembayaran Ekstra
          </h2>
          <p className="text-xs text-gray-500 mt-1">
            {summary.count} pembayaran ekstra tercatat
          </p>
        </div>

        {extraPayments.length === 0 ? (
          <div className="p-8 text-center">
            <Wallet size={32} className="text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-500">
              Belum ada pembayaran ekstra
            </p>
            <p className="text-xs text-gray-400 mt-1">
              Tambahkan pembayaran ekstra pertama Anda di atas
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Tanggal
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Jumlah
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Catatan
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...extraPayments]
                  .sort(
                    (a, b) =>
                      new Date(b.paymentDate).getTime() -
                      new Date(a.paymentDate).getTime(),
                  )
                  .map((ep) => (
                    <tr
                      key={ep.id}
                      className="border-t border-gray-100 hover:bg-gray-50"
                    >
                      <td className="px-4 py-3 text-gray-700">
                        {formatDateShort(ep.paymentDate)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-blue-600 tabular-nums">
                        {formatIDR(ep.amount)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {ep.note || '—'}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute('/extra-payments')({
  component: ExtraPaymentsPage,
});
