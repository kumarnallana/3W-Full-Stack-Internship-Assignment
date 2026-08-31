import { mockApiRequest, MockApiError } from "./mockApi";

const DEFAULT_API_BASE_URL = "http://localhost:5000/api";
const TOKEN_KEY = "mini_social_session_token";
const REQUEST_TIMEOUT_MS = 3000;
const EXPLORER_ENABLED = import.meta.env.VITE_ENABLE_EXPLORER_MODE !== "false";

let apiMode = "live";
const modeSubscribers = new Set();

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function getApiMode() {
  return apiMode;
}

export function subscribeToApiMode(subscriber) {
  modeSubscribers.add(subscriber);
  return () => modeSubscribers.delete(subscriber);
}

function setApiMode(nextMode) {
  if (apiMode === nextMode) return;
  apiMode = nextMode;
  modeSubscribers.forEach((subscriber) => subscriber(nextMode));
}

export function getSessionToken() {
  return window.sessionStorage.getItem(TOKEN_KEY);
}

export function setSessionToken(token) {
  if (token) {
    window.sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    window.sessionStorage.removeItem(TOKEN_KEY);
  }
}

export function unwrapData(payload) {
  return payload?.data ?? payload;
}

function getErrorMessage(payload, fallback) {
  return (
    payload?.message ||
    payload?.error?.message ||
    payload?.error ||
    fallback
  );
}

export async function apiRequest(path, options = {}) {
  if (apiMode === "explorer") {
    return requestFromExplorer(path, options);
  }

  const { body, headers = {}, ...requestOptions } = options;
  const token = getSessionToken();
  const isFormData = body instanceof FormData;
  const requestHeaders = {
    Accept: "application/json",
    ...(!isFormData && body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      ...requestOptions,
      signal: controller.signal,
      headers: requestHeaders,
      body: isFormData || typeof body === "string" ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    if (!EXPLORER_ENABLED) {
      throw new ApiError(
        networkError.name === "AbortError"
          ? "The server took too long to respond."
          : "The server is unavailable. Check your connection and try again.",
      );
    }
    setApiMode("explorer");
    return requestFromExplorer(path, options);
  } finally {
    window.clearTimeout(timeoutId);
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(payload, "Something went wrong. Please try again."),
      response.status,
      payload,
    );
  }

  return payload;
}

async function requestFromExplorer(path, options) {
  try {
    return await mockApiRequest(path, options);
  } catch (error) {
    if (error instanceof MockApiError) {
      throw new ApiError(error.message, error.status, error.details);
    }
    throw error;
  }
}
