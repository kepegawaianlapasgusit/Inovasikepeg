import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, apiError } from "@/lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null });

  const loadMe = useCallback(async () => {
    const token = localStorage.getItem("lagusit_token");
    if (!token) {
      setState({ loading: false, user: null });
      return;
    }
    try {
      const { data } = await api.get("/auth/me");
      setState({
        loading: false,
        user: data.user,
        employee: data.employee,
        permissions: data.permissions || [],
        isSuper: data.is_super,
        menu: data.menu || [],
        permissionCatalog: data.permission_catalog || [],
      });
    } catch {
      localStorage.removeItem("lagusit_token");
      setState({ loading: false, user: null });
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  const login = async (email, password) => {
    try {
      const { data } = await api.post("/auth/login", { email, password });
      localStorage.setItem("lagusit_token", data.access_token);
      await loadMe();
      return { ok: true };
    } catch (e) {
      return { ok: false, error: apiError(e) };
    }
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      /* ignore */
    }
    localStorage.removeItem("lagusit_token");
    setState({ loading: false, user: null });
    window.location.href = "/login";
  };

  const has = (...perms) => {
    if (state.isSuper || (state.permissions || []).includes("*")) return true;
    return perms.some((p) => (state.permissions || []).includes(p));
  };

  return (
    <AuthContext.Provider value={{ ...state, login, logout, has, reload: loadMe }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
