const DEFAULT_API_BASE_URL = "http://localhost:5000/api";
const TOKEN_KEY = "mini_social_session_token";

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
  const { body, headers = {}, ...requestOptions } = options;
  const token = getSessionToken();
  const isFormData = body instanceof FormData;
  const requestHeaders = {
    Accept: "application/json",
    ...(!isFormData && body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      ...requestOptions,
      headers: requestHeaders,
      body: isFormData || typeof body === "string" ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    throw new ApiError(
      "We could not reach the server. Check your connection and try again.",
      0,
      error,
    );
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

