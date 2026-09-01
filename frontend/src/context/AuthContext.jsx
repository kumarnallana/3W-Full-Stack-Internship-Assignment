import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../services/authApi";
import { getApiMode } from "../services/apiClient";

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
  const [sessionError, setSessionError] = useState("");
  const apiMode = getApiMode();

  useEffect(() => {
    let active = true;

    loadCurrentSession()
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
        setStatus(currentUser ? "authenticated" : "anonymous");
      })
      .catch((error) => {
        if (!active) return;
        setUser(null);
        setStatus("anonymous");
        if (error.status !== 401) setSessionError(error.message || "The session could not be checked.");
      });

    return () => {
      active = false;
    };
  }, []);

  async function login(values) {
    setSessionError("");
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
    setSessionError("");
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

  async function retrySession() {
    setStatus("checking");
    setSessionError("");
    try {
      const currentUser = await loadCurrentSession();
      setUser(currentUser);
      setStatus(currentUser ? "authenticated" : "anonymous");
    } catch (error) {
      setUser(null);
      setStatus("anonymous");
      if (error.status !== 401) setSessionError(error.message || "The session could not be checked.");
    }
  }

  const value = useMemo(
    () => ({ user, status, apiMode, sessionError, login, signup, logout, retrySession }),
    [user, status, apiMode, sessionError],
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
