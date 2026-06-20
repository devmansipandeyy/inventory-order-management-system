import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { authApi } from "../api/endpoints";
import { UNAUTHORIZED_EVENT } from "../api/client";
import { clearTokens, getToken, setTokens } from "../lib/auth";
import type { User } from "../api/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const me = await authApi.me();
      setUser(me);
    } catch {
      clearTokens();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMe();
  }, [loadMe]);

  const logout = useCallback(() => {
    clearTokens();
    setUser(null);
    navigate("/login", { replace: true });
  }, [navigate]);

  useEffect(() => {
    const handler = () => {
      setUser(null);
      navigate("/login", { replace: true });
    };
    window.addEventListener(UNAUTHORIZED_EVENT, handler);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, handler);
  }, [navigate]);

  const login = useCallback(async (email: string, password: string) => {
    const tokens = await authApi.login(email, password);
    setTokens(tokens.access_token, tokens.refresh_token);
    const me = await authApi.me();
    setUser(me);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, logout }),
    [user, loading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
