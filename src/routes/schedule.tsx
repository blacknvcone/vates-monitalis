import { useState, useMemo } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import {
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Columns3,
  Search,
  CheckSquare,
  CalendarDays,
  Loader2,
} from 'lucide-react';
import { formatIDR, formatPct, formatMonthLabel, formatIDRCompact } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useSchedule, useKprLoan, useBulkMarkPaid } from '@/hooks';
import type { KprScheduleEntry } from '@/types';

// ============================================================
// Phase derivation from schedule data
// ============================================================

interface DerivedPhase {
  startMonth: number;
  endMonth: number;
  annualRate: number;
  installment: number;
}

function derivePhases(entries: KprScheduleEntry[]): DerivedPhase[] {
  const phases: DerivedPhase[] = [];
  let current: DerivedPhase | null = null;

  for (const entry of entries) {
    if (!current || current.annualRate !== entry.interestRate) {
      if (current) phases.push(current);
      current = {
        startMonth: entry.monthNumber,
        endMonth: entry.monthNumber,
        annualRate: entry.interestRate,
        installment: entry.totalInstallment,
      };
    } else {
      current.endMonth = entry.monthNumber;
    }
  }
  if (current) phases.push(current);
  return phases;
}

// ============================================================
// Column Sort Icon
// ============================================================

function SortIcon({ sorted }: { sorted: false | 'asc' | 'desc' }) {
  if (sorted === 'asc') return <ChevronUp size={14} className="text-blue-600" />;
  if (sorted === 'desc') return <ChevronDown size={14} className="text-blue-600" />;
  return <ChevronsUpDown size={14} className="text-gray-300" />;
}

// ============================================================
// Column definitions (factory — needs firstPayment & phases)
// ============================================================

function createColumns(
  firstPayment: string,
  phases: DerivedPhase[],
): ColumnDef<KprScheduleEntry>[] {
  return [
    {
      accessorKey: 'monthNumber',
      header: 'Bulan',
      cell: (info) => {
        const month = info.getValue() as number;
        return (
          <span className="font-medium text-gray-900 tabular-nums">
            {month}
          </span>
        );
      },
      size: 60,
    },
    {
      accessorKey: 'calendarDate',
      header: 'Tanggal',
      cell: (info) => {
        const month = info.row.original.monthNumber;
        return (
          <span className="text-gray-600 text-sm">
            {formatMonthLabel(month, firstPayment)}
          </span>
        );
      },
      size: 100,
    },
    {
      accessorKey: 'principalPortion',
      header: 'Angsuran Pokok',
      cell: (info) => (
        <span className="tabular-nums text-emerald-700 font-medium text-sm">
          {formatIDR(info.getValue() as number)}
        </span>
      ),
      size: 140,
    },
    {
      accessorKey: 'interestPortion',
      header: 'Angsuran Bunga',
      cell: (info) => (
        <span className="tabular-nums text-red-600 font-medium text-sm">
          {formatIDR(info.getValue() as number)}
        </span>
      ),
      size: 140,
    },
    {
      accessorKey: 'totalInstallment',
      header: 'Total Angsuran',
      cell: (info) => (
        <span className="tabular-nums text-gray-900 font-semibold text-sm">
          {formatIDR(info.getValue() as number)}
        </span>
      ),
      size: 140,
    },
    {
      accessorKey: 'outstandingBalance',
      header: 'Saldo Pinjaman',
      cell: (info) => (
        <span className="tabular-nums text-gray-700 text-sm">
          {formatIDR(info.getValue() as number)}
        </span>
      ),
      size: 150,
    },
    {
      accessorKey: 'interestRate',
      header: 'Suku Bunga',
      cell: (info) => {
        const rate = info.getValue() as number;
        const phase = phases.find((p) => p.annualRate === rate);
        const phaseNum = phase ? phases.indexOf(phase) + 1 : '?';
        return (
          <span className="tabular-nums text-sm">
            <span className="font-medium text-gray-900">{formatPct(rate)}</span>
            <span className="text-gray-400 ml-1 text-xs">F{phaseNum}</span>
          </span>
        );
      },
      size: 100,
    },
    {
      accessorKey: 'isPaid',
      header: 'Status',
      cell: (info) => {
        const paid = info.getValue() as boolean;
        return paid ? (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            <CheckCircle2 size={12} />
            Lunas
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
            <Circle size={12} />
            Belum
          </span>
        );
      },
      size: 90,
    },
  ];
}

// ============================================================
// Stacked Area Chart Component
// ============================================================

function PrincipalVsInterestChart({
  data,
  firstPayment,
  currentMonth,
  phaseBoundaries,
}: {
  data: KprScheduleEntry[];
  firstPayment: string;
  currentMonth: number;
  phaseBoundaries: Set<number>;
}) {
  // Sample every 12 months for chart readability, plus include month 1, last month, phase boundaries, and current month
  const chartData = useMemo(() => {
    const lastMonth = data.length > 0 ? data[data.length - 1].monthNumber : 0;
    const sampled: { month: number; label: string; principal: number; interest: number }[] = [];
    for (let i = 0; i < data.length; i++) {
      const entry = data[i];
      if (
        entry.monthNumber === 1 ||
        entry.monthNumber % 12 === 0 ||
        entry.monthNumber === lastMonth ||
        phaseBoundaries.has(entry.monthNumber) ||
        entry.monthNumber === currentMonth
      ) {
        sampled.push({
          month: entry.monthNumber,
          label: formatMonthLabel(entry.monthNumber, firstPayment),
          principal: entry.principalPortion,
          interest: entry.interestPortion,
        });
      }
    }
    return sampled;
  }, [data, firstPayment, currentMonth, phaseBoundaries]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-sm font-semibold text-gray-700 mb-1">
        Komposisi Angsuran: Pokok vs Bunga
      </h3>
      <p className="text-xs text-gray-400 mb-4">
        Stacked area chart menunjukkan porsi pokok dan bunga per bulan selama masa pinjaman
      </p>
      <ResponsiveContainer width="100%" height={320}>
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => `B${v}`}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10 }}
            tickFormatter={(v) => formatIDRCompact(v)}
          />
          <Tooltip
            formatter={(value: number, name: string) => [
              formatIDR(value),
              name === 'principal' ? 'Pokok' : 'Bunga',
            ]}
            labelFormatter={(label) => {
              const entry = chartData.find((d) => d.month === label);
              return entry ? `Bulan ${label} — ${entry.label}` : `Bulan ${label}`;
            }}
            contentStyle={{
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              fontSize: 12,
            }}
          />
          <Legend
            formatter={(value) => (value === 'principal' ? 'Angsuran Pokok' : 'Angsuran Bunga')}
            wrapperStyle={{ fontSize: 12 }}
          />
          <Area
            type="monotone"
            dataKey="principal"
            stackId="1"
            stroke="#22c55e"
            fill="#22c55e"
            fillOpacity={0.6}
            strokeWidth={1.5}
          />
          <Area
            type="monotone"
            dataKey="interest"
            stackId="1"
            stroke="#ef4444"
            fill="#ef4444"
            fillOpacity={0.4}
            strokeWidth={1.5}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================
// Column Visibility Dropdown
// ============================================================

function ColumnVisibilityDropdown({
  table,
}: {
  table: ReturnType<typeof useReactTable<KprScheduleEntry>>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Columns3 size={15} />
        Kolom
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-20 w-56 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
            <div className="px-3 py-2 border-b border-gray-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Tampilkan Kolom
              </p>
            </div>
            {table.getAllLeafColumns()
              .filter((col) => col.id !== 'monthNumber' && col.id !== 'isPaid') // always show these
              .map((column) => (
                <label
                  key={column.id}
                  className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm"
                >
                  <input
                    type="checkbox"
                    checked={column.getIsVisible()}
                    onChange={column.getToggleVisibilityHandler()}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-700">
                    {typeof column.columnDef.header === 'string'
                      ? column.columnDef.header
                      : column.id}
                  </span>
                </label>
              ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================
// Page Component
// ============================================================

function SchedulePage() {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const { data: scheduleResponse, isLoading, error } = useSchedule();
  const { data: loan } = useKprLoan();
  const bulkMarkPaid = useBulkMarkPaid();

  const scheduleData = scheduleResponse?.docs ?? [];
  const firstPayment = loan?.firstPayment ?? '';

  // Derive phases and current month from schedule data
  const phases = useMemo(() => derivePhases(scheduleData), [scheduleData]);
  const phaseBoundaries = useMemo(
    () => new Set(phases.map((p) => p.startMonth)),
    [phases],
  );
  const currentMonth = useMemo(() => {
    const lastPaid = [...scheduleData]
      .reverse()
      .find((e) => e.isPaid);
    return lastPaid?.monthNumber ?? 0;
  }, [scheduleData]);

  // Columns depend on firstPayment and phases (both derived from CMS data)
  const columns = useMemo(
    () => createColumns(firstPayment, phases),
    [firstPayment, phases],
  );

  const table = useReactTable({
    data: scheduleData,
    columns,
    state: {
      sorting,
      globalFilter,
      columnVisibility,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: {
        pageSize: 30,
      },
    },
    globalFilterFn: (row, _columnId, filterValue) => {
      const month = row.original.monthNumber;
      const search = filterValue.toString();
      return month.toString().includes(search);
    },
  });

  const paidCount = scheduleData.filter((e) => e.isPaid).length;
  const totalMonths = scheduleData.length || 240;
  const unpaidCount = totalMonths - paidCount;

  // ---- Loading state ----
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="animate-spin text-blue-600" size={32} />
          <p className="text-sm text-gray-500">Memuat jadwal angsuran...</p>
        </div>
      </div>
    );
  }

  // ---- Error state ----
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 max-w-md text-center">
          <p className="text-sm font-medium text-red-700">Gagal memuat jadwal angsuran</p>
          <p className="text-xs text-red-500 mt-1">{error.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tabel Angsuran</h1>
        <p className="text-sm text-gray-500 mt-1">
          Jadwal lengkap {totalMonths} bulan angsuran KPR BRI &middot; Fachrul Dani Prasetya
        </p>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">Total Bulan</p>
          <p className="text-xl font-bold text-gray-900">{totalMonths}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">Sudah Dibayar</p>
          <p className="text-xl font-bold text-emerald-600">{paidCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">Belum Dibayar</p>
          <p className="text-xl font-bold text-amber-600">{unpaidCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-xs text-gray-500">Bulan Aktif</p>
          <p className="text-xl font-bold text-blue-600">{currentMonth}</p>
        </div>
      </div>

      {/* Controls Row */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search / Filter */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Cari nomor bulan..."
            value={globalFilter}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors"
          />
        </div>

        {/* Bulk Mark Paid */}
        <button
          className={cn(
            'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors shadow-sm',
            bulkMarkPaid.isPending
              ? 'bg-blue-400 cursor-not-allowed'
              : 'bg-blue-600 hover:bg-blue-700',
          )}
          disabled={bulkMarkPaid.isPending || currentMonth === 0}
          onClick={() => bulkMarkPaid.mutate({ upToMonth: currentMonth })}
        >
          {bulkMarkPaid.isPending ? (
            <Loader2 size={15} className="animate-spin" />
          ) : (
            <CheckSquare size={15} />
          )}
          Tandai Lunas s/d Bulan {currentMonth}
        </button>

        {/* Column Visibility */}
        <ColumnVisibilityDropdown table={table} />

        {/* Pagination Info */}
        <div className="ml-auto text-sm text-gray-500">
          {table.getFilteredRowModel().rows.length} dari {scheduleData.length} baris
        </div>
      </div>

      {/* Phase Legend */}
      <div className="flex flex-wrap gap-4 text-xs">
        {phases.map((phase, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <div
              className={cn(
                'w-3 h-3 rounded-full',
                i === 0 ? 'bg-blue-500' : i === 1 ? 'bg-amber-500' : 'bg-red-500',
              )}
            />
            <span className="text-gray-600">
              Fase {i + 1}: {formatPct(phase.annualRate)} &middot; {formatIDR(phase.installment)}/bln
              ({phase.startMonth}–{phase.endMonth})
            </span>
          </div>
        ))}
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded border-2 border-blue-400 bg-blue-50" />
          <span className="text-gray-600">Bulan aktif (biru)</span>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-surface-dark rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id} className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="px-3 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : (
                        <button
                          className={cn(
                            'inline-flex items-center gap-1',
                            header.column.getCanSort() && 'cursor-pointer select-none hover:text-gray-900 dark:hover:text-white',
                          )}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {header.column.getCanSort() && (
                            <SortIcon sorted={header.column.getIsSorted()} />
                          )}
                        </button>
                      )}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map((row) => {
                const month = row.original.monthNumber;
                const isCurrent = month === currentMonth;
                const isBoundary = phaseBoundaries.has(month);
                const isFuture = month > currentMonth;

                return (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-b border-gray-100 dark:border-gray-700 transition-colors',
                      isCurrent && 'bg-blue-50 dark:bg-blue-900/20 border-l-2 border-l-blue-500',
                      isBoundary && !isCurrent && 'border-t-2 border-t-amber-300',
                      isFuture && !isCurrent && 'opacity-70',
                      !isCurrent && 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
                    )}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className="px-3 py-2.5 whitespace-nowrap"
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30">
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              {'<<'}
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              {'<'}
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              {'>'}
            </button>
            <button
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="px-2 py-1 text-sm border border-gray-200 dark:border-gray-600 rounded bg-white dark:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
            >
              {'>>'}
            </button>
          </div>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>
              Halaman{' '}
              <strong>
                {table.getState().pagination.pageIndex + 1} dari {table.getPageCount()}
              </strong>
            </span>
            <span className="text-gray-400">|</span>
            <span>
              Ke halaman:{' '}
              <input
                type="number"
                min={1}
                max={table.getPageCount()}
                value={table.getState().pagination.pageIndex + 1}
                onChange={(e) => {
                  const page = e.target.value ? Number(e.target.value) - 1 : 0;
                  table.setPageIndex(page);
                }}
                className="w-14 px-2 py-0.5 border border-gray-200 rounded text-center text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </span>
            <span className="text-gray-400">|</span>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="px-2 py-0.5 border border-gray-200 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {[10, 20, 30, 50, 100, 240].map((size) => (
                <option key={size} value={size}>
                  {size === 240 ? 'Semua (240)' : `${size} baris`}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => {
                const idx = scheduleData.findIndex((e) => e.monthNumber === currentMonth);
                if (idx >= 0) {
                  const pageSize = table.getState().pagination.pageSize;
                  table.setPageIndex(Math.floor(idx / pageSize));
                }
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
            >
              <CalendarDays size={12} />
              Ke Bulan Aktif
            </button>
          </div>
        </div>
      </div>

      {/* Stacked Area Chart */}
      <PrincipalVsInterestChart
        data={scheduleData}
        firstPayment={firstPayment}
        currentMonth={currentMonth}
        phaseBoundaries={phaseBoundaries}
      />
    </div>
  );
}

export const Route = createFileRoute('/schedule')({
  component: SchedulePage,
});
