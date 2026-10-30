import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { login as apiLogin, DEMO_ACCOUNTS, getDemoAccounts } from '../api/auth.js';

const AuthContext = createContext(null);

const TOKEN_KEY = 'loomguard_jwt_token';
const USER_KEY = 'loomguard_auth_user';

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || null);
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem(USER_KEY);
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);

  // Sync token and user with localStorage and legacy keys for backward-compatibility
  const persistAuth = useCallback((jwtToken, userData) => {
    if (jwtToken && userData) {
      localStorage.setItem(TOKEN_KEY, jwtToken);
      localStorage.setItem(USER_KEY, JSON.stringify(userData));
      // Legacy keys used by previous endpoints and Studio author field
      localStorage.setItem('loomguard-role', userData.role || 'creator');
      localStorage.setItem('loomguard-user', userData.name || userData.email || userData.role || 'creator');
      setToken(jwtToken);
      setUser(userData);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem('loomguard-role');
      localStorage.removeItem('loomguard-user');
      setToken(null);
      setUser(null);
    }
  }, []);

  const login = useCallback(
    async (email, password) => {
      setLoading(true);
      try {
        const data = await apiLogin(email, password);
        if (!data?.token || !data?.user) {
          throw new Error('Invalid authentication response from server.');
        }
        persistAuth(data.token, data.user);
        return data.user;
      } finally {
        setLoading(false);
      }
    },
    [persistAuth],
  );

  const loginAsDemo = useCallback(
    async (roleName) => {
      try {
        const demoInfo = await getDemoAccounts();
        const account =
          (demoInfo?.accounts || []).find((a) => a.role === roleName) ||
          DEMO_ACCOUNTS.find((a) => a.role === roleName) ||
          DEMO_ACCOUNTS[0];
        const password = demoInfo?.password || account.password || 'loomguard-demo';
        return login(account.email, password);
      } catch {
        const demoAccount = DEMO_ACCOUNTS.find((a) => a.role === roleName) || DEMO_ACCOUNTS[0];
        return login(demoAccount.email, demoAccount.password || 'loomguard-demo');
      }
    },
    [login],
  );

  const logout = useCallback(() => {
    persistAuth(null, null);
    window.location.href = '/login';
  }, [persistAuth]);

  // Listen for storage changes or unauthorized 401 events dispatched from client.js
  useEffect(() => {
    const handleAuthExpired = () => {
      persistAuth(null, null);
      if (window.location.pathname !== '/login') {
        window.location.href = '/login?expired=1';
      }
    };

    window.addEventListener('loomguard:unauthorized', handleAuthExpired);
    return () => {
      window.removeEventListener('loomguard:unauthorized', handleAuthExpired);
    };
  }, [persistAuth]);

  const value = {
    user,
    token,
    role: user?.role || null,
    isAuthenticated: Boolean(token && user),
    loading,
    login,
    loginAsDemo,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
