import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import * as api from '@/lib/api';
import { logtoConfig } from '@/lib/logto';

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
  logtoLogin: () => void;
  handleLogtoCallback: (code: string, state: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// PKCE helpers
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function generateState(): string {
  const array = new Uint8Array(16);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

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

  // Password login (existing flow)
  const login = useCallback(async (email: string, password: string) => {
    const res = await api.login(email, password);
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

  // Logto SSO login — redirect to Logto
  const logtoLogin = useCallback(async () => {
    const verifier = generateCodeVerifier();
    const challenge = await generateCodeChallenge(verifier);
    const state = generateState();

    // Store PKCE params for callback
    sessionStorage.setItem('logto_code_verifier', verifier);
    sessionStorage.setItem('logto_state', state);

    const params = new URLSearchParams({
      client_id: logtoConfig.appId,
      redirect_uri: logtoConfig.redirectUri,
      response_type: 'code',
      scope: 'openid profile email',
      state,
      code_challenge: challenge,
      code_challenge_method: 'S256',
    });

    window.location.href = `${logtoConfig.endpoint}/oidc/auth?${params}`;
  }, []);

  // Handle Logto callback — exchange code for Payload JWT
  const handleLogtoCallback = useCallback(async (code: string, state: string) => {
    const verifier = sessionStorage.getItem('logto_code_verifier');
    const savedState = sessionStorage.getItem('logto_state');

    // Cleanup PKCE params
    sessionStorage.removeItem('logto_code_verifier');
    sessionStorage.removeItem('logto_state');

    if (state !== savedState) {
      throw new Error('State mismatch — possible CSRF attack');
    }

    if (!verifier) {
      throw new Error('Missing code verifier — please try logging in again');
    }

    // 1. Exchange authorization code for Logto tokens
    const tokenRes = await fetch(`${logtoConfig.endpoint}/oidc/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: logtoConfig.appId,
        code,
        redirect_uri: logtoConfig.redirectUri,
        code_verifier: verifier,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.json().catch(() => ({}));
      throw new Error(err.error_description || 'Failed to exchange code for tokens');
    }

    const tokenData = await tokenRes.json();
    const idToken = tokenData.id_token;

    if (!idToken) {
      throw new Error('No id_token in Logto response');
    }

    // 2. Exchange Logto id_token for Payload JWT
    const cmsUrl = import.meta.env.VITE_CMS_URL || '';
    const payloadRes = await fetch(`${cmsUrl}/api/auth/logto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idToken }),
    });

    if (!payloadRes.ok) {
      const err = await payloadRes.json().catch(() => ({}));
      throw new Error(err.error || 'Gagal autentikasi dengan CMS');
    }

    const payloadData = await payloadRes.json();

    // 3. Store Payload JWT + user
    localStorage.setItem('monetalis_token', payloadData.token);
    const userObj: User = {
      id: payloadData.user.id,
      email: payloadData.user.email,
      name: payloadData.user.name,
      role: payloadData.user.role,
      loanId: payloadData.user.loan || '',
    };
    localStorage.setItem('monetalis_user', JSON.stringify(userObj));
    setUser(userObj);
  }, []);

  const logout = useCallback(() => {
    api.logout();
    localStorage.removeItem('monetalis_user');
    setUser(null);

    // Also log out from Logto if configured
    if (logtoConfig.appId) {
      const params = new URLSearchParams({
        post_logout_redirect_uri: logtoConfig.postLogoutRedirectUri,
      });
      window.location.href = `${logtoConfig.endpoint}/oidc/session/end?${params}`;
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        logtoLogin,
        handleLogtoCallback,
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
