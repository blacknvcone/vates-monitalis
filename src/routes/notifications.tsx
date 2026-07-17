import { createFileRoute } from '@tanstack/react-router';
import { useMemo } from 'react';
import { Loader2, Bell, Mail, Calendar, CheckCircle, XCircle, Clock } from 'lucide-react';
import { formatDate } from '@/lib/format';
import { useReminders } from '@/hooks';
import type { KprReminder } from '@/types';

// ============================================================
// Loading State
// ============================================================

function LoadingState() {
  return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="animate-spin text-primary" size={32} />
      <span className="ml-3 text-gray-500">Memuat data notifikasi...</span>
    </div>
  );
}

// ============================================================
// Helper
// ============================================================

function getNextSendDate(reminderDay: number): string {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), reminderDay);
  if (next <= now) {
    next.setMonth(next.getMonth() + 1);
  }
  return next.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

// ============================================================
// Sub-components
// ============================================================

function SummaryCards({ reminders }: { reminders: KprReminder[] }) {
  const activeCount = reminders.filter((r) => r.isActive).length;
  const inactiveCount = reminders.length - activeCount;
  const nextSend = useMemo(() => {
    const activeReminders = reminders.filter((r) => r.isActive);
    if (activeReminders.length === 0) return null;
    // Find the nearest reminder day
    const now = new Date();
    const currentDay = now.getDate();
    const upcomingDays = activeReminders
      .map((r) => r.reminderDay)
      .sort((a, b) => {
        const aNext = a >= currentDay ? a : a + 31;
        const bNext = b >= currentDay ? b : b + 31;
        return aNext - bNext;
      });
    return upcomingDays[0] ? getNextSendDate(upcomingDays[0]) : null;
  }, [reminders]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
            <Bell size={18} className="text-blue-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Reminder</p>
            <p className="text-2xl font-bold text-gray-900">{reminders.length}</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
            <CheckCircle size={18} className="text-emerald-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Aktif</p>
            <p className="text-2xl font-bold text-emerald-600">{activeCount}</p>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
            <Clock size={18} className="text-amber-600" />
          </div>
          <div>
            <p className="text-xs text-gray-500">Pengiriman Berikutnya</p>
            <p className="text-sm font-semibold text-gray-900 mt-0.5">
              {nextSend || 'Tidak ada'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReminderCard({ reminder }: { reminder: KprReminder }) {
  return (
    <div
      className={`bg-white rounded-xl border p-5 transition-colors ${
        reminder.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'
      }`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              reminder.isActive ? 'bg-emerald-100' : 'bg-gray-100'
            }`}
          >
            <Mail size={18} className={reminder.isActive ? 'text-emerald-600' : 'text-gray-400'} />
          </div>
          <div>
            <p className="font-medium text-gray-900">{reminder.email}</p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                <Calendar size={12} />
                Hari ke-{reminder.reminderDay} setiap bulan
              </span>
            </div>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${
            reminder.isActive
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-gray-100 text-gray-500'
          }`}
        >
          {reminder.isActive ? (
            <>
              <CheckCircle size={12} />
              Aktif
            </>
          ) : (
            <>
              <XCircle size={12} />
              Nonaktif
            </>
          )}
        </span>
      </div>

      {reminder.lastSentAt && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-500">
            Terakhir dikirim: <span className="text-gray-700">{formatDate(reminder.lastSentAt)}</span>
          </p>
        </div>
      )}

      {reminder.isActive && (
        <div className="mt-2">
          <p className="text-xs text-gray-500">
            Pengiriman berikutnya: <span className="text-gray-700">{getNextSendDate(reminder.reminderDay)}</span>
          </p>
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
      <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Bell size={24} className="text-gray-400" />
      </div>
      <h3 className="text-base font-semibold text-gray-700">Belum Ada Reminder</h3>
      <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
        Anda belum mengkonfigurasi reminder email. Atur reminder di halaman Settings untuk mendapat notifikasi angsuran.
      </p>
    </div>
  );
}

// ============================================================
// Page Component
// ============================================================

function NotificationsPage() {
  const { data: remindersData, isLoading } = useReminders();

  if (isLoading) return <LoadingState />;

  const reminders = remindersData?.docs ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Riwayat Notifikasi</h1>
        <p className="text-sm text-gray-500 mt-1">
          Kelola reminder email dan lihat status pengiriman terakhir
        </p>
      </div>

      <SummaryCards reminders={reminders} />

      {reminders.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-700">Daftar Reminder</h2>
          {reminders.map((reminder) => (
            <ReminderCard key={reminder.id} reminder={reminder} />
          ))}
        </div>
      )}

      {/* Info note */}
      <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500">
        <p>
          <strong>Catatan:</strong> Reminder dikirim otomatis pada hari yang ditentukan setiap bulan.
          Anda dapat mengubah pengaturan reminder di halaman{' '}
          <span className="font-medium text-gray-700">Settings</span>.
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/notifications')({
  component: NotificationsPage,
});
