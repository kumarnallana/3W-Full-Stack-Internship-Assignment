const configuredMode = String(import.meta.env.VITE_APP_MODE || "real").toLowerCase();

export const APP_MODE = configuredMode === "demo" ? "demo" : "real";

export const DEMO_ACCOUNT = Object.freeze({
  username: "Demo Member",
  email: "demo@minisocial.app",
  password: "MiniSocial2026!",
});
