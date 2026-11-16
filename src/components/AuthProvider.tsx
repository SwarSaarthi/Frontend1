"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ApiError, AUTH_CHANGED_EVENT, AUTH_STORAGE_KEY, authApi, getAuthToken, removeAuthToken, setAuthToken, type User } from "@/lib/api";

interface AuthContextValue {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  error: string | null;
  login: (token: string, user?: User) => Promise<boolean>;
  logout: () => void;
  checkAuth: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<{ token: string; generation: number; promise: Promise<boolean> } | null>(null);
  const generation = useRef(0);
  const localMutation = useRef(false);
  const mounted = useRef(true);

  const checkAuth = useCallback(async (): Promise<boolean> => {
    const token = getAuthToken();
    if (!token) {
      generation.current++;
      pending.current = null;
      if (mounted.current) { setUser(null); setIsLoading(false); setError(null); }
      return false;
    }
    if (pending.current?.token === token) return pending.current.promise;
    const requestGeneration = ++generation.current;
    setUser(null);
    setIsLoading(true);
    const promise = (async () => {
      try {
        const account = await authApi.getMe();
        if (!mounted.current || generation.current !== requestGeneration || getAuthToken() !== token) return false;
        setUser(account);
        setError(null);
        return true;
      } catch (failure) {
        if (!mounted.current || generation.current !== requestGeneration || getAuthToken() !== token) return false;
        setUser(null);
        // Keep a valid stored token through temporary network/server outages.
        if (!(failure instanceof ApiError && failure.status === 401)) {
          setError(failure instanceof Error ? failure.message : "We couldn’t restore your session. Please try again.");
        }
        return false;
      } finally {
        if (pending.current?.generation === requestGeneration) {
          pending.current = null;
          if (mounted.current && generation.current === requestGeneration) setIsLoading(false);
        }
      }
    })();
    pending.current = { token, generation: requestGeneration, promise };
    return promise;
  }, []);

  const login = useCallback(async (token: string, account?: User) => {
    generation.current++;
    pending.current = null;
    setUser(null);
    localMutation.current = true;
    setAuthToken(token);
    localMutation.current = false;
    setError(null);
    if (account) { setUser(account); setIsLoading(false); return true; }
    return checkAuth();
  }, [checkAuth]);

  const logout = useCallback(() => {
    generation.current++;
    pending.current = null;
    removeAuthToken();
    setUser(null);
    setError(null);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    mounted.current = true;
    void checkAuth();
    const onChange = () => { if (!localMutation.current) void checkAuth(); };
    const onStorage = (event: StorageEvent) => {
      if (event.key === AUTH_STORAGE_KEY || event.key === null) {
        // Clear the in-memory copy as well when another tab signs out.
        if (!event.newValue) removeAuthToken();
        else void checkAuth();
      }
    };
    window.addEventListener(AUTH_CHANGED_EVENT, onChange);
    window.addEventListener("storage", onStorage);
    return () => {
      mounted.current = false;
      // This is a request counter, not a DOM ref: invalidate the latest in-flight request.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++;
      pending.current = null;
      window.removeEventListener(AUTH_CHANGED_EVENT, onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, [checkAuth]);

  const value = useMemo(() => ({ user, isLoggedIn: Boolean(user), isLoading, error, login, logout, checkAuth }), [user, isLoading, error, login, logout, checkAuth]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
