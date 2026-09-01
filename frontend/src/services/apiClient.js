import { APP_MODE } from "../config/appMode";
import { demoApiRequest, DemoApiError } from "./demoApi";

const DEFAULT_API_BASE_URL = "http://localhost:5000/api";
const REQUEST_TIMEOUT_MS = 8000;

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
  return APP_MODE;
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
  if (APP_MODE === "demo") {
    return requestFromDemo(path, options);
  }

  const { body, headers = {}, ...requestOptions } = options;
  const isFormData = body instanceof FormData;
  const requestHeaders = {
    Accept: "application/json",
    ...(!isFormData && body ? { "Content-Type": "application/json" } : {}),
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
    throw new ApiError(
      networkError.name === "AbortError"
        ? "The server took too long to respond. Please try again."
        : "Mini Social cannot reach the server. Start the API and database, then try again.",
      0,
      { cause: networkError.name || "NetworkError" },
    );
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

async function requestFromDemo(path, options) {
  try {
    return await demoApiRequest(path, options);
  } catch (error) {
    if (error instanceof DemoApiError) {
      throw new ApiError(error.message, error.status, error.details);
    }
    throw error;
  }
}
