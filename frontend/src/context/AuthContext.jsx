import React, { createContext, useContext, useState, useEffect } from "react";
import { api, authStorage } from "../api/client";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => authStorage.getUser());
  const [token, setToken] = useState(() => authStorage.getToken());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    async function loadCurrentUser() {
      const storedToken = authStorage.getToken();
      if (!storedToken) {
        if (isMounted) setLoading(false);
        return;
      }
      try {
        const currentUser = await api.getMe();
        if (isMounted && currentUser) {
          setUser(currentUser);
          authStorage.setUser(currentUser);
        }
      } catch (err) {
        console.warn("Session restore failed:", err.message);
        authStorage.clear();
        if (isMounted) {
          setUser(null);
          setToken(null);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadCurrentUser();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email, password) => {
    const data = await api.login(email, password);
    setUser(data.user);
    setToken(data.token);
    return data;
  };

  const register = async (userData) => {
    const data = await api.register(userData);
    setUser(data.user);
    setToken(data.token);
    return data;
  };

  const logout = () => {
    authStorage.clear();
    setUser(null);
    setToken(null);
  };

  const refreshUser = async () => {
    try {
      const refreshed = await api.getMe();
      setUser(refreshed);
      authStorage.setUser(refreshed);
      return refreshed;
    } catch {
      return null;
    }
  };

  const updateUser = (updated) => {
    setUser(updated);
    authStorage.setUser(updated);
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: Boolean(user && token),
    isCounselor: user?.role === "counselor" || user?.role === "admin",
    isAdmin: user?.role === "admin",
    login,
    register,
    logout,
    refreshUser,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
