import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import {
  Bell,
  Mail,
  Calendar,
  Plus,
  Trash2,
  Send,
  CheckCircle,
  ToggleLeft,
  ToggleRight,
  Download,
  Database,
} from 'lucide-react';
import { formatIDR } from '@/lib/format';

// ============================================================
// Mock Data & Types
// ============================================================

interface Reminder {
  id: string;
  email: string;
  reminderDay: number;
  isActive: boolean;
  lastSentAt: string | null;
}

function useMockReminders() {
  const [reminders, setReminders] = useState<Reminder[]>([
    { id: '1', email: 'dani.prasetya@gmail.com', reminderDay: 25, isActive: true, lastSentAt: '2026-06-25' },
  ]);

  const addReminder = (email: string, day: number) => {
    setReminders((prev) => [
      ...prev,
      { id: String(Date.now()), email, reminderDay: day, isActive: true, lastSentAt: null },
    ]);
  };

  const toggleReminder = (id: string) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, isActive: !r.isActive } : r)),
    );
  };

  const removeReminder = (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  };

  return { reminders, addReminder, toggleReminder, removeReminder };
}

// ============================================================
// Components
// ============================================================

function ReminderSection() {
  const { reminders, addReminder, toggleReminder, removeReminder } = useMockReminders();
  const [newEmail, setNewEmail] = useState('');
  const [newDay, setNewDay] = useState(25);
  const [testStatus, setTestStatus] = useState<'idle' | 'sending' | 'sent'>('idle');

  const handleAdd = () => {
    if (newEmail && newDay >= 1 && newDay <= 28) {
      addReminder(newEmail, newDay);
      setNewEmail('');
      setNewDay(25);
    }
  };

  const handleTestSend = () => {
    setTestStatus('sending');
    setTimeout(() => setTestStatus('sent'), 1500);
    setTimeout(() => setTestStatus('idle'), 3000);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Bell size={18} className="text-primary" />
        <h3 className="text-base font-semibold text-gray-900">Email Reminder</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Konfigurasi pengingat angsuran bulanan via email. Reminder dikirim pada tanggal yang dipilih setiap bulan.
      </p>

      {/* Existing reminders */}
      <div className="space-y-3 mb-6">
        {reminders.map((reminder) => (
          <div
            key={reminder.id}
            className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
          >
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
                  {reminder.lastSentAt && ` · Terakhir: ${reminder.lastSentAt}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleTestSend}
                disabled={testStatus === 'sending'}
                className="text-xs text-blue-600 hover:text-blue-800 px-2 py-1 rounded hover:bg-blue-50"
              >
                {testStatus === 'sending' ? 'Mengirim...' : testStatus === 'sent' ? '✓ Terkirim' : 'Test'}
              </button>
              <button
                onClick={() => removeReminder(reminder.id)}
                className="text-gray-400 hover:text-red-500 p-1"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
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
        Data KPR dikelola melalui CMS admin panel. Klik tombol di bawah untuk membuka admin.
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
  const handleExportCSV = () => {
    // TODO: implement CSV export
    alert('CSV export akan tersedia setelah CMS terkoneksi');
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Download size={18} className="text-primary" />
        <h3 className="text-base font-semibold text-gray-900">Export Data</h3>
      </div>
      <p className="text-sm text-gray-500 mb-4">
        Export data KPR untuk analisa di spreadsheet atau sebagai backup.
      </p>
      <div className="flex gap-3">
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
          <Download size={14} />
          Export Tabel Angsuran (CSV)
        </button>
        <button
          onClick={handleExportCSV}
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
        >
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
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Konfigurasi aplikasi dan email reminder</p>
      </div>

      {/* Sections */}
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
