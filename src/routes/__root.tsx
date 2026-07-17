import { createRootRoute, Outlet, Link, useMatchRoute, useLocation } from '@tanstack/react-router';
import {
  LayoutDashboard, CalendarDays, Calculator, Lightbulb, Settings, Menu, X, LogOut, User,
  Banknote, History, Target, CalendarRange, GitCompareArrows, Building2, Download, TrendingDown, Bell,
  Wallet, Sun, Moon,
} from 'lucide-react';
import { useState, useEffect, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/schedule', label: 'Tabel Angsuran', icon: CalendarDays },
  { to: '/simulator', label: 'Simulator', icon: Calculator },
  { to: '/insights', label: 'Insights', icon: Lightbulb },
  { to: '/extra-payments', label: 'Pembayaran Ekstra', icon: Banknote },
  { to: '/payment-history', label: 'Riwayat Pembayaran', icon: History },
  { to: '/goals', label: 'Target Pelunasan', icon: Target },
  { to: '/budget', label: 'Anggaran', icon: Wallet },
  { to: '/cashflow', label: 'Arus Kas', icon: CalendarRange },
  { to: '/scenario-compare', label: 'Perbandingan Skenario', icon: GitCompareArrows },
  { to: '/refinance', label: 'Kalkulator Refinancing', icon: Building2 },
  { to: '/inflation', label: 'Penyesuaian Inflasi', icon: TrendingDown },
  { to: '/export', label: 'Export Laporan', icon: Download },
  { to: '/notifications', label: 'Notifikasi', icon: Bell },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const matchRoute = useMatchRoute();
  const { user, logout } = useAuth();
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('monetalis_theme') === 'dark';
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('monetalis_theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('monetalis_theme', 'light');
    }
  }, [darkMode]);

  // Apply saved theme on mount
  useEffect(() => {
    const saved = localStorage.getItem('monetalis_theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      setDarkMode(true);
    }
  }, []);

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-64 bg-primary text-white
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h1 className="text-xl font-bold tracking-tight">Monetalis</h1>
            <p className="text-xs text-white/60 mt-0.5">KPR Financial Dashboard</p>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 hover:bg-white/10 rounded">
            <X size={20} />
          </button>
        </div>

        <nav className="p-4 space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = item.to === '/'
              ? matchRoute({ to: '/' })
              : matchRoute({ to: item.to, fuzzy: true });

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium
                  transition-colors duration-150
                  ${isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}
                `}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
          {/* Dark mode toggle */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center gap-3 px-3 py-2.5 mb-2 text-sm text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>

          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center">
              <User size={14} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.name || user?.email}</p>
              <p className="text-[10px] text-white/50 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={logout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <LogOut size={14} />
            Keluar
          </button>
          <p className="text-[10px] text-white/30 text-center mt-2">
            v1.0.0 &middot; BRI KPR
          </p>
        </div>
      </aside>
    </>
  );
}

function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 overflow-y-auto">
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-1 hover:bg-gray-100 rounded">
            <Menu size={20} />
          </button>
          <h1 className="text-lg font-bold text-primary">Monetalis</h1>
        </div>

        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

function RootComponent() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();
  const isLoginPage = location.pathname === '/login';

  // Login page: render without auth guard
  if (isLoginPage) {
    return <Outlet />;
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Not authenticated: redirect to login
  if (!isAuthenticated) {
    window.location.href = '/login';
    return null;
  }

  // Authenticated: render with sidebar layout
  return (
    <AuthenticatedLayout>
      <Outlet />
    </AuthenticatedLayout>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
