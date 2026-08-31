import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../services/authApi";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let active = true;

    authApi
      .me()
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
        setStatus(currentUser ? "authenticated" : "anonymous");
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setStatus("anonymous");
      });

    return () => {
      active = false;
    };
  }, []);

  async function login(values) {
    const response = await authApi.login(values);
    let nextUser = response.user;

    if (!nextUser) {
      nextUser = await authApi.me();
    }

    setUser(nextUser);
    setStatus("authenticated");
    return nextUser;
  }

  async function signup(values) {
    const response = await authApi.signup(values);
    let nextUser = response.user;

    if (!nextUser) {
      try {
        nextUser = await authApi.me();
      } catch {
        nextUser = null;
      }
    }

    if (nextUser) {
      setUser(nextUser);
      setStatus("authenticated");
    }

    return nextUser;
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setStatus("anonymous");
    }
  }

  const value = useMemo(
    () => ({ user, status, login, signup, logout }),
    [user, status],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
