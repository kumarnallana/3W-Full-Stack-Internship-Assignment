import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../services/authApi";
import { getApiMode, subscribeToApiMode } from "../services/apiClient";

const AuthContext = createContext(null);
let sessionBootstrap;

function loadCurrentSession() {
  if (!sessionBootstrap) {
    sessionBootstrap = authApi.me().finally(() => {
      sessionBootstrap = null;
    });
  }
  return sessionBootstrap;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("checking");
  const [apiMode, setApiMode] = useState(getApiMode());

  useEffect(() => subscribeToApiMode(setApiMode), []);

  useEffect(() => {
    let active = true;

    loadCurrentSession()
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
    () => ({ user, status, apiMode, login, signup, logout }),
    [user, status, apiMode],
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
