import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useAuth } from '@/lib/auth';
import { Lock, Shield, AlertCircle } from 'lucide-react';
import { logtoConfig } from '@/lib/logto';

function LoginPage() {
  const { logtoLogin, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const hasLogto = !!logtoConfig.appId;

  // If already authenticated, redirect home
  if (isAuthenticated) {
    navigate({ to: '/' });
    return null;
  }

  // Auto-redirect to Logto SSO on mount if configured
  useEffect(() => {
    if (hasLogto) {
      logtoLogin();
    }
  }, [hasLogto, logtoLogin]);

  // If Logto is configured, show a loading state while redirecting
  if (hasLogto) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
            <Shield size={28} className="text-white" />
          </div>
          <p className="text-sm text-gray-500">Mengarahkan ke SSO...</p>
        </div>
      </div>
    );
  }

  // No Logto configured — show error
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-primary rounded-2xl mb-4">
            <Lock size={28} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Monetalis</h1>
          <p className="text-sm text-gray-500 mt-1">KPR Financial Dashboard</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
            <AlertCircle size={16} className="text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-700">SSO tidak dikonfigurasi</p>
              <p className="text-xs text-red-600 mt-1">
                Aplikasi ini memerlukan autentikasi SSO. Silakan hubungi administrator untuk mengkonfigurasi Logto.
              </p>
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Monetalis v1.0.0 &middot; Data KPR BRI
        </p>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/login')({
  component: LoginPage,
});
