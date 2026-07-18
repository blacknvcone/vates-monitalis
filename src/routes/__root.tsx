import { createRootRoute, Outlet, Link, useMatchRoute, useLocation } from '@tanstack/react-router';
import {
  LayoutDashboard, CalendarDays, Calculator, Lightbulb, Settings, Menu, X, LogOut, User,
  Banknote, History, Target, CalendarRange, GitCompareArrows, Building2, Download, TrendingDown, Bell,
  Wallet, Sun, Moon, ChevronDown, ChevronRight,
} from 'lucide-react';
import { useState, useEffect, type ReactNode, type ElementType } from 'react';
import { useAuth } from '@/lib/auth';

// ============================================================
// Navigation Groups
// ============================================================

interface NavItem {
  to: string;
  label: string;
  icon: ElementType;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Utama',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard },
      { to: '/schedule', label: 'Tabel Angsuran', icon: CalendarDays },
      { to: '/simulator', label: 'Simulator', icon: Calculator },
      { to: '/insights', label: 'Insights', icon: Lightbulb },
    ],
  },
  {
    label: 'Perencanaan',
    items: [
      { to: '/budget', label: 'Anggaran', icon: Wallet },
      { to: '/goals', label: 'Target Pelunasan', icon: Target },
      { to: '/cashflow', label: 'Arus Kas', icon: CalendarRange },
      { to: '/scenario-compare', label: 'Skenario', icon: GitCompareArrows },
    ],
  },
  {
    label: 'Pembayaran',
    items: [
      { to: '/extra-payments', label: 'Bayar Ekstra', icon: Banknote },
      { to: '/payment-history', label: 'Riwayat', icon: History },
      { to: '/refinance', label: 'Refinancing', icon: Building2 },
    ],
  },
  {
    label: 'Laporan',
    items: [
      { to: '/inflation', label: 'Inflasi', icon: TrendingDown },
      { to: '/export', label: 'Export', icon: Download },
      { to: '/notifications', label: 'Notifikasi', icon: Bell },
    ],
  },
];

// ============================================================
// Nav Group Component
// ============================================================

function NavGroupSection({
  group,
  isOpen,
  onToggle,
  hasActiveChild,
  onClose,
}: {
  group: NavGroup;
  isOpen: boolean;
  onToggle: () => void;
  hasActiveChild: boolean;
  onClose: () => void;
}) {
  const matchRoute = useMatchRoute();

  return (
    <div className="mb-1">
      <button
        onClick={onToggle}
        className={`
          w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wider
          transition-colors duration-150 rounded-lg
          ${hasActiveChild ? 'text-white/90' : 'text-white/40 hover:text-white/60'}
        `}
      >
        {group.label}
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {isOpen && (
        <div className="mt-0.5 space-y-0.5">
          {group.items.map((item) => {
            const isActive = item.to === '/'
              ? matchRoute({ to: '/' })
              : matchRoute({ to: item.to, fuzzy: true });

            return (
              <Link
                key={item.to}
                to={item.to}
                onClick={onClose}
                className={`
                  flex items-center gap-3 px-3 py-2 pl-5 rounded-lg text-sm font-medium
                  transition-colors duration-150
                  ${isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}
                `}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Sidebar
// ============================================================

function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const matchRoute = useMatchRoute();

  // Track which groups are open — auto-expand the group with active route
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    NAV_GROUPS.forEach((g) => {
      initial[g.label] = g.items.some((item) =>
        item.to === '/' ? matchRoute({ to: '/' }) : matchRoute({ to: item.to, fuzzy: true })
      );
    });
    return initial;
  });

  // Dark mode
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

  useEffect(() => {
    const saved = localStorage.getItem('monetalis_theme');
    if (saved === 'dark') {
      document.documentElement.classList.add('dark');
      setDarkMode(true);
    }
  }, []);

  const toggleGroup = (label: string) => {
    setOpenGroups((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  const hasActiveChild = (group: NavGroup) =>
    group.items.some((item) =>
      item.to === '/' ? matchRoute({ to: '/' }) : matchRoute({ to: item.to, fuzzy: true })
    );

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={onClose} />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-full w-60 bg-primary text-white
          transform transition-transform duration-200 ease-in-out
          lg:translate-x-0 lg:static lg:z-auto
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h1 className="text-lg font-bold tracking-tight">Monetalis</h1>
            <p className="text-[10px] text-white/50 mt-0.5">KPR Dashboard</p>
          </div>
          <button onClick={onClose} className="lg:hidden p-1 hover:bg-white/10 rounded">
            <X size={18} />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 overflow-y-auto" style={{ height: 'calc(100vh - 180px)' }}>
          {NAV_GROUPS.map((group) => (
            <NavGroupSection
              key={group.label}
              group={group}
              isOpen={openGroups[group.label] ?? false}
              onToggle={() => toggleGroup(group.label)}
              hasActiveChild={hasActiveChild(group)}
              onClose={onClose}
            />
          ))}
        </nav>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 p-3 border-t border-white/10">
          <button
            onClick={() => setDarkMode(!darkMode)}
            className="w-full flex items-center gap-3 px-3 py-2 mb-2 text-xs text-white/60 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            {darkMode ? <Sun size={14} /> : <Moon size={14} />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>

          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 bg-white/20 rounded-full flex items-center justify-center">
              <User size={12} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-white truncate">{user?.name || user?.email}</p>
              <p className="text-[9px] text-white/40 capitalize">{user?.role}</p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] text-white/50 hover:text-white hover:bg-white/10 rounded transition-colors"
            >
              <LogOut size={12} />
              Keluar
            </button>
            <p className="text-[9px] text-white/20">v2.1.0</p>
          </div>
        </div>
      </aside>
    </>
  );
}

// ============================================================
// Layout
// ============================================================

function AuthenticatedLayout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 overflow-y-auto">
        <div className="lg:hidden sticky top-0 z-30 bg-white dark:bg-surface-dark border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
            <Menu size={20} className="text-gray-900 dark:text-white" />
          </button>
          <h1 className="text-lg font-bold text-primary dark:text-white">Monetalis</h1>
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
  const isCallbackPage = location.pathname === '/callback';

  // Skip auth guard for login and OIDC callback routes
  if (isLoginPage || isCallbackPage) {
    return <Outlet />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isAuthenticated) {
    window.location.href = '/login';
    return null;
  }

  return (
    <AuthenticatedLayout>
      <Outlet />
    </AuthenticatedLayout>
  );
}

export const Route = createRootRoute({
  component: RootComponent,
});
