import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import * as api from '@/lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'viewer';
  loanId: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('monetalis_token');
    const storedUser = localStorage.getItem('monetalis_user');

    if (token && storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem('monetalis_token');
        localStorage.removeItem('monetalis_user');
      }
    }
    setIsLoading(false);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);

    // Fetch full user data to get loanId
    const userData = await api.fetchCurrentUser();

    const userObj: User = {
      id: res.user.id,
      email: res.user.email,
      name: userData?.name || (res.user as any).name || res.user.email,
      role: userData?.role || (res.user as any).role || 'viewer',
      loanId: userData?.loan || (res.user as any).loan || '',
    };

    localStorage.setItem('monetalis_user', JSON.stringify(userObj));
    setUser(userObj);
  }, []);

  const logout = useCallback(() => {
    api.logout();
    localStorage.removeItem('monetalis_user');
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
