import { createFileRoute, useNavigate, useSearch } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Loader2, AlertCircle } from 'lucide-react';

function CallbackPage() {
  const { handleLogtoCallback } = useAuth();
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as Record<string, string>;
  const [error, setError] = useState('');

  useEffect(() => {
    const code = search.code;
    const state = search.state;
    const errorParam = search.error;

    if (errorParam) {
      setError(search.error_description || 'Login dibatalkan');
      return;
    }

    if (!code || !state) {
      setError('Missing authorization code');
      return;
    }

    handleLogtoCallback(code, state)
      .then(() => {
        navigate({ to: '/' });
      })
      .catch((err: Error) => {
        setError(err.message || 'Gagal autentikasi');
      });
  }, [search, handleLogtoCallback, navigate]);

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-2xl mb-4">
            <AlertCircle size={28} className="text-red-500" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Login Gagal</h1>
          <p className="text-sm text-gray-500 mb-6">{error}</p>
          <button
            onClick={() => navigate({ to: '/login' })}
            className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-light transition-colors"
          >
            Kembali ke Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center">
        <Loader2 size={32} className="animate-spin text-primary mx-auto mb-4" />
        <p className="text-sm text-gray-500">Memproses autentikasi...</p>
      </div>
    </div>
  );
}

export const Route = createFileRoute('/callback')({
  component: CallbackPage,
});
