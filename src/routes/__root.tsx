import { createRootRouteWithContext, Outlet, Link, useMatchRoute, Navigate } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { LayoutDashboard, CalendarDays, Calculator, Lightbulb, Settings, Menu, X, LogOut, User } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';

interface RouterContext {
  queryClient: QueryClient;
  auth: {
    user: { id: string; email: string; name: string; role: string } | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    logout: () => void;
  };
}

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/schedule', label: 'Tabel Angsuran', icon: CalendarDays },
  { to: '/simulator', label: 'Simulator', icon: Calculator },
  { to: '/insights', label: 'Insights', icon: Lightbulb },
  { to: '/settings', label: 'Settings', icon: Settings },
] as const;

function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const matchRoute = useMatchRoute();
  const { user, logout } = useAuth();

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
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
          <button
            onClick={onClose}
            className="lg:hidden p-1 hover:bg-white/10 rounded"
          >
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
                  ${isActive
                    ? 'bg-white/15 text-white'
                    : 'text-white/70 hover:bg-white/10 hover:text-white'
                  }
                `}
              >
                <item.icon size={18} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User info & logout */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
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

function AuthenticatedLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { isAuthenticated, isLoading } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }

  return (
    <div className="flex h-screen bg-surface overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="flex-1 overflow-y-auto">
        {/* Mobile header */}
        <div className="lg:hidden sticky top-0 z-30 bg-white border-b px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1 hover:bg-gray-100 rounded"
          >
            <Menu size={20} />
          </button>
          <h1 className="text-lg font-bold text-primary">Monetalis</h1>
        </div>

        <div className="p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export const Route = createRootRouteWithContext<RouterContext>()({
  component: AuthenticatedLayout,
});
