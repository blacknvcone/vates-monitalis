import { createFileRoute } from '@tanstack/react-router';
import { useState, useEffect, useCallback } from 'react';
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
  AlertCircle,
} from 'lucide-react';
import { formatIDR } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { getLoanId } from '@/lib/api';

const CMS_URL = import.meta.env.VITE_CMS_URL || 'http://localhost:3001';

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

// ============================================================
// Hooks
// ============================================================

function useReminders() {
  const { user } = useAuth();
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const token = localStorage.getItem('monetalis_token');
  const loanId = getLoanId();

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  };

  // Fetch reminders from CMS
  const fetchReminders = useCallback(async () => {
    if (!token || !loanId) return;
    try {
      const res = await fetch(`${CMS_URL}/api/kpr-reminders?where[loan][equals]=${loanId}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setReminders(data.docs.map((d: any) => ({
          id: d.id,
          email: d.email,
          reminderDay: d.reminderDay,
          isActive: d.isActive,
          sendPaymentReminder: d.sendPaymentReminder ?? true,
          sendMonthlyInsight: d.sendMonthlyInsight ?? true,
          lastPaymentReminderSent: d.lastPaymentReminderSent || null,
          lastMonthlyInsightSent: d.lastMonthlyInsightSent || null,
        })));
      }
    } catch (err) {
      console.error('Failed to fetch reminders:', err);
    } finally {
      setIsLoading(false);
    }
  }, [token, loanId]);

  // Create reminder
  const createReminder = async (email: string, day: number) => {
    try {
      const res = await fetch(`${CMS_URL}/api/kpr-reminders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          loan: loanId,
          email,
          reminderDay: day,
          isActive: true,
          sendPaymentReminder: true,
          sendMonthlyInsight: true,
        }),
      });
      if (res.ok) {
        await fetchReminders();
      } else {
        const err = await res.json();
        setError(err.errors?.[0]?.message || 'Gagal membuat reminder');
      }
    } catch (err) {
      setError('Gagal membuat reminder');
    }
  };

  // Update reminder
  const updateReminder = async (id: string, data: Partial<Reminder>) => {
    try {
      await fetch(`${CMS_URL}/api/kpr-reminders/${id}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(data),
      });
      await fetchReminders();
    } catch (err) {
      console.error('Failed to update reminder:', err);
    }
  };

  // Delete reminder
  const deleteReminder = async (id: string) => {
    try {
      await fetch(`${CMS_URL}/api/kpr-reminders/${id}`, {
        method: 'DELETE',
        headers,
      });
      await fetchReminders();
    } catch (err) {
      console.error('Failed to delete reminder:', err);
    }
  };

  useEffect(() => {
    fetchReminders();
  }, [fetchReminders]);

  return {
    reminders,
    isLoading,
    error,
    createReminder,
    updateReminder,
    deleteReminder,
    refetch: fetchReminders,
  };
}

// ============================================================
// Components
// ============================================================

function ReminderSection() {
  const { user } = useAuth();
  const { reminders, isLoading, error, createReminder, updateReminder, deleteReminder } = useReminders();
  const [newEmail, setNewEmail] = useState('');
  const [newDay, setNewDay] = useState(1);
  const [testStatus, setTestStatus] = useState<Record<string, string>>({});

  const handleAdd = async () => {
    if (newEmail && newDay >= 1 && newDay <= 28) {
      await createReminder(newEmail, newDay);
      setNewEmail('');
      setNewDay(1);
    }
  };

  const handleTestEmail = async (reminderId: string, type: 'payment' | 'insight') => {
    const key = `${reminderId}-${type}`;
    setTestStatus((prev) => ({ ...prev, [key]: 'sending' }));

    try {
      const token = localStorage.getItem('monetalis_token');
      const loanId = getLoanId();
      const endpoint = type === 'payment'
        ? '/api/kpr/send-payment-reminder'
        : '/api/kpr/send-monthly-insight';

      const res = await fetch(`${CMS_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ reminderId, loanId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.errors?.[0]?.message || `HTTP ${res.status}`);
      }

      setTestStatus((prev) => ({ ...prev, [key]: 'sent' }));
      setTimeout(() => setTestStatus((prev) => ({ ...prev, [key]: '' })), 3000);
    } catch (err: any) {
      console.error('Test email failed:', err);
      setTestStatus((prev) => ({ ...prev, [key]: 'error' }));
      setTimeout(() => setTestStatus((prev) => ({ ...prev, [key]: '' })), 5000);
    }
  };

  const handleToggle = async (id: string, field: string, value: boolean) => {
    await updateReminder(id, { [field]: value } as any);
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2">
          <Loader2 size={18} className="animate-spin text-primary" />
          <p className="text-sm text-gray-500">Memuat reminder...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Bell size={18} className="text-primary" />
        <h3 className="text-base font-semibold text-gray-900">Email Reminder</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Konfigurasi pengingat angsuran dan laporan bulanan via email.
      </p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

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
        {reminders.length === 0 && (
          <p className="text-sm text-gray-400 text-center py-4">
            Belum ada reminder. Tambahkan di bawah.
          </p>
        )}
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
                  <button onClick={() => handleToggle(reminder.id, 'isActive', !reminder.isActive)}>
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
                  onClick={() => deleteReminder(reminder.id)}
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
                    onChange={() => handleToggle(reminder.id, 'sendPaymentReminder', !reminder.sendPaymentReminder)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-xs text-gray-600">Pengingat Pembayaran</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reminder.sendMonthlyInsight}
                    onChange={() => handleToggle(reminder.id, 'sendMonthlyInsight', !reminder.sendMonthlyInsight)}
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
                  ) : paymentStatus === 'error' ? (
                    <AlertCircle size={12} />
                  ) : (
                    <Send size={12} />
                  )}
                  {paymentStatus === 'sending' ? 'Mengirim...' : paymentStatus === 'sent' ? 'Terkirim!' : paymentStatus === 'error' ? 'Gagal' : 'Test Pengingat'}
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
                  ) : insightStatus === 'error' ? (
                    <AlertCircle size={12} />
                  ) : (
                    <Send size={12} />
                  )}
                  {insightStatus === 'sending' ? 'Mengirim...' : insightStatus === 'sent' ? 'Terkirim!' : insightStatus === 'error' ? 'Gagal' : 'Test Laporan'}
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
                placeholder={user?.email || 'email@example.com'}
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
              disabled={!newEmail && !user?.email}
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

function UsersSection() {
  const [users, setUsers] = useState<Array<{ id: string; email: string; name: string; role: string; isActive: boolean }>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const loanId = getLoanId();

  useEffect(() => {
    const fetchUsers = async () => {
      const token = localStorage.getItem('monetalis_token');
      if (!token || !loanId) return;
      try {
        const res = await fetch(`${CMS_URL}/api/monetalis-users?where[loan][equals]=${loanId}&limit=50`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          setUsers(data.docs.map((u: any) => ({
            id: u.id,
            email: u.email,
            name: u.name,
            role: u.role,
            isActive: u.isActive,
          })));
        }
      } catch (err) {
        console.error('Failed to fetch users:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, [loanId]);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <User size={18} className="text-primary" />
        <h3 className="text-base font-semibold text-gray-900">Users dengan Akses</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Semua user yang memiliki akses ke data KPR ini.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 py-4">
          <Loader2 size={16} className="animate-spin text-gray-400" />
          <p className="text-sm text-gray-400">Memuat users...</p>
        </div>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-4">Tidak ada user ditemukan.</p>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold ${u.isActive ? 'bg-emerald-500' : 'bg-gray-400'}`}>
                  {u.name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">{u.name}</p>
                  <p className="text-xs text-gray-500">{u.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full ${u.role === 'admin' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                  {u.role}
                </span>
                {!u.isActive && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-600">
                    Nonaktif
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
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
      <UsersSection />
      <LoanInfoSection />
      <ExportSection />
      <SystemInfoSection />
    </div>
  );
}

export const Route = createFileRoute('/settings')({
  component: SettingsPage,
});
