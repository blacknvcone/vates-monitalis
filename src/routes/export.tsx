import { createFileRoute } from '@tanstack/react-router';
import { useState, useMemo, useCallback } from 'react';
import { Loader2, Download, Printer, FileText, Table } from 'lucide-react';
import { formatIDR, formatPct, formatDate, formatMonthLabel } from '@/lib/format';
import { useKprStatus, useKprLoan, useSchedule } from '@/hooks';
import { adaptCmsStatus } from '@/lib/cms-adapters';
import type { KprLoan, KprScheduleEntry, KprStatus } from '@/types';

// ============================================================
// Loading State
// ============================================================

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-primary" size={32} />
      <span className="ml-3 text-gray-500">Memuat data untuk export...</span>
    </div>
  );
}

// ============================================================
// CSV Export
// ============================================================

function generateCsv(schedule: KprScheduleEntry[], loan: KprLoan, status: KprStatus): string {
  const header = [
    'Bulan',
    'Tanggal',
    'Angsuran Pokok',
    'Angsuran Bunga',
    'Total Angsuran',
    'Sisa Pinjaman',
    'Suku Bunga',
    'Status Bayar',
    'Tanggal Bayar',
  ].join(',');

  const rows = schedule.map((entry) =>
    [
      entry.monthNumber,
      entry.calendarDate,
      entry.principalPortion,
      entry.interestPortion,
      entry.totalInstallment,
      entry.outstandingBalance,
      entry.interestRate,
      entry.isPaid ? 'Lunas' : 'Belum',
      entry.paidDate ? `"${entry.paidDate}"` : '',
    ].join(','),
  );

  // Summary rows
  const totalInterest = schedule.reduce((sum, e) => sum + e.interestPortion, 0);
  const totalPrincipal = schedule.reduce((sum, e) => sum + e.principalPortion, 0);
  const totalPayments = schedule.reduce((sum, e) => sum + e.totalInstallment, 0);

  const summary = [
    '',
    `Ringkasan Pinjaman`,
    `"Peminjam","${loan.borrowerName}"`,
    `"Bank","${loan.bankName}"`,
    `"Pokok Pinjaman",${loan.loanAmount}`,
    `"Harga Rumah",${loan.housePrice}`,
    `"Uang Muka",${loan.downPayment}`,
    `"Tenor","${loan.tenorMonths} bulan"`,
    `"Angsuran Pertama","${loan.firstPayment}"`,
    '',
    `"Total Pokok Dibayar",${totalPrincipal}`,
    `"Total Bunga Dibayar",${totalInterest}`,
    `"Total Pembayaran",${totalPayments}`,
    `"Sisa Pinjaman",${status.outstandingBalance}`,
    `"Bulan Saat Ini",${status.currentMonth}`,
    `"Bunga Aktif",${status.currentRate}%`,
  ];

  return [header, ...rows, '', ...summary].join('\n');
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// ============================================================
// HTML Print Report
// ============================================================

function generatePrintHtml(
  schedule: KprScheduleEntry[],
  loan: KprLoan,
  status: KprStatus,
  firstPayment: string,
): string {
  const totalInterest = schedule.reduce((sum, e) => sum + e.interestPortion, 0);
  const totalPayments = loan.loanAmount + totalInterest;

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <title>Laporan KPR - ${loan.borrowerName}</title>
  <style>
    body { font-family: 'Segoe UI', sans-serif; max-width: 900px; margin: 0 auto; padding: 24px; color: #1f2937; }
    h1 { font-size: 1.5rem; border-bottom: 2px solid #1f2937; padding-bottom: 8px; }
    h2 { font-size: 1.1rem; margin-top: 24px; color: #374151; }
    .summary { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin: 16px 0; }
    .summary-item { padding: 10px 14px; background: #f3f4f6; border-radius: 8px; }
    .summary-item .label { font-size: 0.75rem; color: #6b7280; }
    .summary-item .value { font-size: 1.05rem; font-weight: 600; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-top: 12px; }
    th { background: #f9fafb; text-align: left; padding: 8px 6px; border-bottom: 1px solid #e5e7eb; font-weight: 600; }
    td { padding: 6px; border-bottom: 1px solid #f3f4f6; }
    tr:last-child td { border-bottom: none; }
    .paid { color: #059669; }
    .unpaid { color: #6b7280; }
    .right { text-align: right; }
    .footer { margin-top: 32px; font-size: 0.7rem; color: #9ca3af; text-align: center; }
    @media print { body { padding: 12px; } }
  </style>
</head>
<body>
  <h1>Laporan KPR - ${loan.borrowerName}</h1>
  <p style="font-size:0.85rem;color:#6b7280;">${loan.bankName} &bull; ${loan.propertyAddress || 'Alamat tidak tersedia'} &bull; Dicetak ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>

  <h2>Ringkasan Pinjaman</h2>
  <div class="summary">
    <div class="summary-item"><div class="label">Pokok Pinjaman</div><div class="value">${formatIDR(loan.loanAmount)}</div></div>
    <div class="summary-item"><div class="label">Harga Rumah</div><div class="value">${formatIDR(loan.housePrice)}</div></div>
    <div class="summary-item"><div class="label">Uang Muka</div><div class="value">${formatIDR(loan.downPayment)}</div></div>
    <div class="summary-item"><div class="label">Tenor</div><div class="value">${loan.tenorMonths} bulan</div></div>
    <div class="summary-item"><div class="label">Bunga Aktif</div><div class="value">${formatPct(status.currentRate)}</div></div>
    <div class="summary-item"><div class="label">Angsuran Saat Ini</div><div class="value">${formatIDR(status.currentInstallment)}/bulan</div></div>
    <div class="summary-item"><div class="label">Total Bunga 20 Tahun</div><div class="value">${formatIDR(totalInterest)}</div></div>
    <div class="summary-item"><div class="label">Total Biaya KPR</div><div class="value">${formatIDR(totalPayments)}</div></div>
    <div class="summary-item"><div class="label">Sudah Dibayar</div><div class="value">${formatIDR(status.totalPaid)}</div></div>
    <div class="summary-item"><div class="label">Sisa Pinjaman</div><div class="value">${formatIDR(status.outstandingBalance)}</div></div>
  </div>

  <h2>Tabel Angsuran</h2>
  <table>
    <thead>
      <tr>
        <th>Bulan</th>
        <th>Tanggal</th>
        <th class="right">Pokok</th>
        <th class="right">Bunga</th>
        <th class="right">Total</th>
        <th class="right">Sisa</th>
        <th class="right">Bunga</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      ${schedule
        .map(
          (e) => `<tr>
            <td>${e.monthNumber}</td>
            <td>${formatMonthLabel(e.monthNumber, firstPayment)}</td>
            <td class="right">${formatIDR(e.principalPortion)}</td>
            <td class="right">${formatIDR(e.interestPortion)}</td>
            <td class="right">${formatIDR(e.totalInstallment)}</td>
            <td class="right">${formatIDR(e.outstandingBalance)}</td>
            <td class="right">${formatPct(e.interestRate)}</td>
            <td class="${e.isPaid ? 'paid' : 'unpaid'}">${e.isPaid ? 'Lunas' : 'Belum'}</td>
          </tr>`,
        )
        .join('\n      ')}
    </tbody>
  </table>

  <div class="footer">
    Monetalis &mdash; KPR Financial Dashboard &bull; Data per ${new Date().toLocaleDateString('id-ID')}
  </div>
</body>
</html>`;
}

// ============================================================
// Page Component
// ============================================================

function ExportPage() {
  const { data: cmsStatus, isLoading: statusLoading } = useKprStatus();
  const { data: loanData, isLoading: loanLoading } = useKprLoan();
  const { data: scheduleData, isLoading: scheduleLoading } = useSchedule();

  const isLoading = statusLoading || loanLoading || scheduleLoading;

  const [exporting, setExporting] = useState<'csv' | 'print' | null>(null);

  const computed = useMemo(() => {
    if (!cmsStatus || !loanData || !scheduleData) return null;
    const status = adaptCmsStatus(cmsStatus);
    const loan = loanData as KprLoan;
    const schedule = scheduleData.docs;
    const totalInterest = schedule.reduce((sum, e) => sum + e.interestPortion, 0);
    const totalPaid = schedule.filter((e) => e.isPaid).reduce((sum, e) => sum + e.totalInstallment, 0);
    const paidCount = schedule.filter((e) => e.isPaid).length;
    return { status, loan, schedule, totalInterest, totalPaid, paidCount };
  }, [cmsStatus, loanData, scheduleData]);

  const handleCsvExport = useCallback(() => {
    if (!computed) return;
    setExporting('csv');
    const csv = generateCsv(computed.schedule, computed.loan, computed.status);
    const date = new Date().toISOString().split('T')[0];
    downloadCsv(csv, `laporan-kpr-${date}.csv`);
    setTimeout(() => setExporting(null), 1500);
  }, [computed]);

  const handlePrintExport = useCallback(() => {
    if (!computed) return;
    setExporting('print');
    const html = generatePrintHtml(
      computed.schedule,
      computed.loan,
      computed.status,
      computed.loan.firstPayment,
    );
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      win.onload = () => win.print();
    }
    setTimeout(() => setExporting(null), 1500);
  }, [computed]);

  if (isLoading) return <LoadingState />;
  if (!computed) return <div className="text-red-500">Gagal memuat data</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Export Laporan</h1>
        <p className="text-sm text-gray-500 mt-1">
          Export data KPR Anda ke format CSV atau cetak laporan lengkap
        </p>
      </div>

      {/* Summary preview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Pokok Pinjaman</p>
          <p className="text-lg font-bold mt-1">{formatIDR(computed.loan.loanAmount)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Total Bunga</p>
          <p className="text-lg font-bold text-red-600 mt-1">{formatIDR(computed.totalInterest)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Sudah Dibayar</p>
          <p className="text-lg font-bold text-emerald-600 mt-1">{formatIDR(computed.totalPaid)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500">Angsuran Terbayar</p>
          <p className="text-lg font-bold mt-1">
            {computed.paidCount} / {computed.schedule.length}
          </p>
        </div>
      </div>

      {/* Export options */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* CSV Export */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Table size={20} className="text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Export CSV</h3>
              <p className="text-xs text-gray-500">Tabel angsuran lengkap untuk analisis</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            File CSV berisi seluruh {computed.schedule.length} baris angsuran beserta ringkasan pinjaman.
            Dapat dibuka di Excel, Google Sheets, atau aplikasi spreadsheet lainnya.
          </p>
          <button
            onClick={handleCsvExport}
            disabled={exporting === 'csv'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {exporting === 'csv' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Mengunduh...
              </>
            ) : (
              <>
                <Download size={16} />
                Download CSV
              </>
            )}
          </button>
        </div>

        {/* Print Report */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Printer size={20} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Cetak Laporan</h3>
              <p className="text-xs text-gray-500">Laporan format untuk dicetak atau PDF</p>
            </div>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Membuka jendela baru dengan laporan terformat lengkap — ringkasan pinjaman,
            tabel angsuran, dan metrik utama. Gunakan Ctrl+P untuk cetak atau simpan sebagai PDF.
          </p>
          <button
            onClick={handlePrintExport}
            disabled={exporting === 'print'}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            {exporting === 'print' ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Membuka...
              </>
            ) : (
              <>
                <Printer size={16} />
                Cetak / Simpan PDF
              </>
            )}
          </button>
        </div>
      </div>

      {/* Data preview */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <FileText size={16} />
            Preview Data ({computed.schedule.length} baris)
          </h3>
        </div>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Bulan</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-600 text-xs">Tanggal</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600 text-xs">Pokok</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600 text-xs">Bunga</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600 text-xs">Total</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600 text-xs">Sisa</th>
                <th className="text-center px-4 py-2.5 font-medium text-gray-600 text-xs">Status</th>
              </tr>
            </thead>
            <tbody>
              {computed.schedule.slice(0, 20).map((entry) => (
                <tr key={entry.id} className="border-t border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2 text-gray-900">{entry.monthNumber}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {formatMonthLabel(entry.monthNumber, computed.loan.firstPayment)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs">
                    {formatIDR(entry.principalPortion)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs">
                    {formatIDR(entry.interestPortion)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs font-medium">
                    {formatIDR(entry.totalInstallment)}
                  </td>
                  <td className="px-4 py-2 text-right font-mono text-xs">
                    {formatIDR(entry.outstandingBalance)}
                  </td>
                  <td className="px-4 py-2 text-center">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        entry.isPaid
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-gray-100 text-gray-500'
                      }`}
                    >
                      {entry.isPaid ? 'Lunas' : 'Belum'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {computed.schedule.length > 20 && (
          <div className="p-3 text-center text-xs text-gray-400 border-t border-gray-100">
            Menampilkan 20 dari {computed.schedule.length} baris. Export CSV untuk data lengkap.
          </div>
        )}
      </div>
    </div>
  );
}

export const Route = createFileRoute('/export')({
  component: ExportPage,
});
