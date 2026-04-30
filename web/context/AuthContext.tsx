"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  authLogout,
  authMe,
  type AuthMember,
  type AuthUser,
} from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  member: AuthMember | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  setSession: (user: AuthUser | null, member?: AuthMember | null) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [member, setMember] = useState<AuthMember | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await authMe();
      if (data.authenticated && data.user) {
        setUser(data.user);
        setMember(data.member ?? null);
      } else {
        setUser(null);
        setMember(null);
      }
    } catch {
      setUser(null);
      setMember(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await authLogout();
    setUser(null);
    setMember(null);
  }, []);

  const setSession = useCallback(
    (nextUser: AuthUser | null, nextMember?: AuthMember | null) => {
      setUser(nextUser);
      setMember(nextMember ?? null);
    },
    [],
  );

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <AuthContext.Provider
      value={{ user, member, loading, refresh, logout, setSession }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within <AuthProvider>");
  return ctx;
}
