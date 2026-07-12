import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import {
  Bell,
  Mail,
  Calendar,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Download,
  Database,
  FileText,
  BarChart3,
  Send,
  CheckCircle,
  Loader2,
} from 'lucide-react';
import { formatIDR } from '@/lib/format';
import { useAuth } from '@/lib/auth';

// ============================================================
// Types
// ============================================================

interface Reminder {
  id: string;
  email: string;
  reminderDay: number;
  isActive: boolean;
  sendPaymentReminder: boolean;
  sendMonthlyInsight: boolean;
  lastPaymentReminderSent: string | null;
  lastMonthlyInsightSent: string | null;
}

function useMockReminders(userEmail?: string) {
  const [reminders, setReminders] = useState<Reminder[]>([
    {
      id: '1',
      email: userEmail || '',
      reminderDay: 1,
      isActive: true,
      sendPaymentReminder: true,
      sendMonthlyInsight: true,
      lastPaymentReminderSent: '2026-07-01',
      lastMonthlyInsightSent: '2026-07-01',
    },
  ]);

  const addReminder = (email: string, day: number) => {
    setReminders((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        email,
        reminderDay: day,
        isActive: true,
        sendPaymentReminder: true,
        sendMonthlyInsight: true,
        lastPaymentReminderSent: null,
        lastMonthlyInsightSent: null,
      },
    ]);
  };

  const toggleReminder = (id: string) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r)),
    );
  };

  const toggleType = (id: string, type: 'sendPaymentReminder' | 'sendMonthlyInsight') => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [type]: !r[type] } : r)),
    );
  };

  const removeReminder = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  const updateLastSent = (id: string, type: 'lastPaymentReminderSent' | 'lastMonthlyInsightSent') => {
    const today = new Date().toISOString().split('T')[0];
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [type]: today } : r)),
    );
  };

  return { reminders, addReminder, toggleReminder, toggleType, removeReminder, updateLastSent };
}

// ============================================================
// Components
// ============================================================

function ReminderSection() {
  const { user } = useAuth();
  const { reminders, addReminder, toggleReminder, toggleType, removeReminder, updateLastSent } = useMockReminders(user?.email);
  const [newEmail, setNewEmail] = useState('');
  const [newDay, setNewDay] = useState(1);
  const [testStatus, setTestStatus] = useState<Record<string, string>>({});

  const handleAdd = () => {
    if (newEmail && newDay >= 1 && newDay <= 28) {
      addReminder(newEmail, newDay);
      setNewEmail('');
      setNewDay(1);
    }
  };

  const handleTestEmail = async (reminderId: string, type: 'payment' | 'insight') => {
    const key = `${reminderId}-${type}`;
    setTestStatus((prev) => ({ ...prev, [key]: 'sending' }));

    try {
      // Simulate API call (replace with real API when CMS is connected)
      await new Promise((resolve) => setTimeout(resolve, 2000));
      setTestStatus((prev) => ({ ...prev, [key]: 'sent' }));

      if (type === 'payment') {
        updateLastSent(reminderId, 'lastPaymentReminderSent');
      } else {
        updateLastSent(reminderId, 'lastMonthlyInsightSent');
      }

      setTimeout(() => setTestStatus((prev) => ({ ...prev, [key]: "" })), 3000);
    } catch {
      setTestStatus((prev) => ({ ...prev, [key]: 'error' }));
      setTimeout(() => setTestStatus((prev) => ({ ...prev, [key]: "" })), 3000);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Bell size={18} className="text-primary" />
        <h3 className="text-base font-semibold text-gray-900">Email Reminder</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Konfigurasi pengingat angsuran dan laporan bulanan via email.
        Dua jenis email dikirim setiap tanggal yang dipilih:
      </p>

      {/* Email types info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <FileText size={14} className="text-blue-600" />
            <p className="text-sm font-medium text-blue-900">Pengingat Pembayaran</p>
          </div>
          <p className="text-xs text-blue-700">
            Detail angsuran berikutnya: nominal, jatuh tempo, breakdown pokok/bunga
          </p>
        </div>
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={14} className="text-emerald-600" />
            <p className="text-sm font-medium text-emerald-900">Laporan Bulanan</p>
          </div>
          <p className="text-xs text-emerald-700">
            Summary analisa: progress, akumulasi, milestone, rekomendasi strategi
          </p>
        </div>
      </div>

      {/* Existing reminders */}
      <div className="space-y-3 mb-6">
        {reminders.map((reminder) => {
          const paymentKey = `${reminder.id}-payment`;
          const insightKey = `${reminder.id}-insight`;
          const paymentStatus = testStatus[paymentKey];
          const insightStatus = testStatus[insightKey];

          return (
            <div
              key={reminder.id}
              className="p-4 bg-gray-50 rounded-lg border border-gray-200"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => toggleReminder(reminder.id)}>
                    {reminder.isActive ? (
                      <ToggleRight size={24} className="text-emerald-500" />
                    ) : (
                      <ToggleLeft size={24} className="text-gray-400" />
                    )}
                  </button>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{reminder.email}</p>
                    <p className="text-xs text-gray-500">
                      Tanggal {reminder.reminderDay} setiap bulan
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => removeReminder(reminder.id)}
                  className="text-gray-400 hover:text-red-500 p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>

              {/* Email type toggles */}
              <div className="flex gap-4 pl-9 mb-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reminder.sendPaymentReminder}
                    onChange={() => toggleType(reminder.id, 'sendPaymentReminder')}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-600">Pengingat Pembayaran</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reminder.sendMonthlyInsight}
                    onChange={() => toggleType(reminder.id, 'sendMonthlyInsight')}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="text-xs text-gray-600">Laporan Bulanan</span>
                </label>
              </div>

              {/* Test email buttons */}
              <div className="flex gap-2 pl-9 mb-2">
                <button
                  onClick={() => handleTestEmail(reminder.id, 'payment')}
                  disabled={paymentStatus === 'sending' || !reminder.sendPaymentReminder}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100"
                >
                  {paymentStatus === 'sending' ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : paymentStatus === 'sent' ? (
                    <CheckCircle size={12} />
                  ) : (
                    <Send size={12} />
                  )}
                  {paymentStatus === 'sending' ? 'Mengirim...' : paymentStatus === 'sent' ? 'Terkirim!' : 'Test Pengingat'}
                </button>
                <button
                  onClick={() => handleTestEmail(reminder.id, 'insight')}
                  disabled={insightStatus === 'sending' || !reminder.sendMonthlyInsight}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors disabled:opacity-50 disabled:cursor-not-allowed border-emerald-200 text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                >
                  {insightStatus === 'sending' ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : insightStatus === 'sent' ? (
                    <CheckCircle size={12} />
                  ) : (
                    <Send size={12} />
                  )}
                  {insightStatus === 'sending' ? 'Mengirim...' : insightStatus === 'sent' ? 'Terkirim!' : 'Test Laporan'}
                </button>
              </div>

              {/* Last sent info */}
              <div className="flex gap-4 pl-9">
                {reminder.lastPaymentReminderSent && (
                  <p className="text-[10px] text-gray-400">
                    Pengingat terakhir: {reminder.lastPaymentReminderSent}
                  </p>
                )}
                {reminder.lastMonthlyInsightSent && (
                  <p className="text-[10px] text-gray-400">
                    Laporan terakhir: {reminder.lastMonthlyInsightSent}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Add new reminder */}
      <div className="border-t pt-4">
        <h4 className="text-sm font-medium text-gray-700 mb-3">Tambah Reminder Baru</h4>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-xs text-gray-500 mb-1 block">Email</label>
            <div className="relative">
              <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
          </div>
          <div className="w-32">
            <label className="text-xs text-gray-500 mb-1 block">Tanggal</label>
            <div className="relative">
              <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="number"
                min={1}
                max={28}
                value={newDay}
                onChange={(e) => setNewDay(Number(e.target.value))}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none"
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              onClick={handleAdd}
              disabled={!newEmail}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-light disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <Plus size={14} />
              Tambah
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoanInfoSection() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Database size={18} className="text-primary" />
        <h3 className="text-base font-semibold text-gray-900">Data KPR</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Data KPR dikelola melalui CMS admin panel.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Bank</p>
          <p className="text-sm font-semibold">BRI - Kanca HR Muhammad</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Pokok Pinjaman</p>
          <p className="text-sm font-semibold">{formatIDR(415_000_000)}</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Tenor</p>
          <p className="text-sm font-semibold">240 bulan (20 tahun)</p>
        </div>
        <div className="p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-500">Peminjam</p>
          <p className="text-sm font-semibold">Fachrul Dani Prasetya</p>
        </div>
      </div>

      <a
        href="https://cms.danipras.dev/admin"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
      >
        Buka CMS Admin Panel
      </a>
    </div>
  );
}

function ExportSection() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Download size={18} className="text-primary" />
        <h3 className="text-base font-semibold text-gray-900">Export Data</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Export data KPR untuk analisa di spreadsheet.
      </p>
      <div className="flex gap-3">
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">
          <Download size={14} />
          Export Tabel Angsuran (CSV)
        </button>
        <button className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors">
          <Download size={14} />
          Export Laporan Lengkap (CSV)
        </button>
      </div>
    </div>
  );
}

function SystemInfoSection() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <h3 className="text-base font-semibold text-gray-900 mb-4">System Info</h3>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Versi Aplikasi</span>
          <span className="font-mono">1.0.0</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">CMS Backend</span>
          <span className="font-mono">Payload CMS 3.x</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Database</span>
          <span className="font-mono">MongoDB Atlas</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Frontend</span>
          <span className="font-mono">Vite + React + TanStack</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">Domain</span>
          <span className="font-mono">monetalis.danipras.dev</span>
        </div>
        <div className="flex justify-between">
          <span className="text-gray-500">SMTP</span>
          <span className="font-mono">Google SMTP (Gmail)</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Page Component
// ============================================================

function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Konfigurasi aplikasi dan email reminder</p>
      </div>

      <ReminderSection />
      <LoanInfoSection />
      <ExportSection />
      <SystemInfoSection />
    </div>
  );
}

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});
