// ============================================================
// Formatting Utilities
// ============================================================

const IDR = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const IDRNarrow = new Intl.NumberFormat('id-ID', {
  style: 'currency',
  currency: 'IDR',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
  notation: 'compact',
  compactDisplay: 'short',
});

const PERCENT = new Intl.NumberFormat('id-ID', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 2,
});

const DATE = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

const DATE_SHORT = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

const MONTH_YEAR = new Intl.DateTimeFormat('id-ID', {
  month: 'long',
  year: 'numeric',
});

/** Format number as IDR currency: Rp 415.000.000 */
export function formatIDR(value: number): string {
  return IDR.format(value);
}

/** Format number as compact IDR: Rp 415jt */
export function formatIDRCompact(value: number): string {
  return IDRNarrow.format(value);
}

/** Format decimal as percentage: 4.75% */
export function formatPct(value: number): string {
  return `${value.toFixed(2)}%`;
}

/** Format decimal as ratio percentage: 106.9% */
export function formatPctRatio(value: number): string {
  return PERCENT.format(value / 100);
}

/** Format ISO date string to Indonesian long date */
export function formatDate(iso: string): string {
  return DATE.format(new Date(iso));
}

/** Format ISO date string to short date */
export function formatDateShort(iso: string): string {
  return DATE_SHORT.format(new Date(iso));
}

/** Format ISO date to month-year */
export function formatMonthYear(iso: string): string {
  return MONTH_YEAR.format(new Date(iso));
}

/** Calculate months between two dates */
export function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/** Add months to a date */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
}

/** Indonesian month names */
export const MONTH_NAMES_ID = [
  '', 'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Ags', 'Sep', 'Okt', 'Nov', 'Des',
];

/** Format month number to "Nov 2023" style */
export function formatMonthLabel(monthNumber: number, firstPayment: string): string {
  const first = new Date(firstPayment);
  const target = addMonths(first, monthNumber - 1);
  return `${MONTH_NAMES_ID[target.getMonth() + 1]} ${target.getFullYear()}`;
}
