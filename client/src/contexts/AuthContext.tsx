import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ApiError } from "@/lib/api";
import {
  clearAuthToken,
  getAuthToken,
  getMe,
  login as loginApi,
  setAuthToken,
  type AdminUser,
  type LoginResult,
} from "@/lib/auth";

interface AuthContextValue {
  admin: AdminUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<LoginResult>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => getAuthToken());

  const {
    data: admin,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["auth", "me", token],
    queryFn: getMe,
    enabled: !!token,
    retry: (failureCount, err) => {
      if (err instanceof ApiError && err.status === 401) return false;
      return failureCount < 2;
    },
  });

  useEffect(() => {
    if (!token) return;
    if (error instanceof ApiError && error.status === 401) {
      clearAuthToken();
      setToken(null);
      queryClient.removeQueries({ queryKey: ["auth"] });
    }
  }, [error, token, queryClient]);

  const login = useCallback(
    async (username: string, password: string) => {
      const result = await loginApi(username, password);
      setAuthToken(result.token);
      setToken(result.token);
      queryClient.setQueryData(["auth", "me", result.token], result.admin);
      return result;
    },
    [queryClient],
  );

  const logout = useCallback(() => {
    clearAuthToken();
    setToken(null);
    queryClient.removeQueries({ queryKey: ["auth"] });
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      admin: admin ?? null,
      isLoading: !!token && isLoading,
      isAuthenticated: !!token && !!admin,
      login,
      logout,
    }),
    [admin, token, isLoading, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
