import { apiRequest, setSessionToken, unwrapData } from "./apiClient";

function normalizeAuthResponse(payload) {
  const body = unwrapData(payload) || {};
  const user = body.user || body.account || payload?.user || null;
  const token = body.token || body.accessToken || payload?.token || null;

  return { user, token, raw: body };
}

export const authApi = {
  async signup(values) {
    const response = normalizeAuthResponse(
      await apiRequest("/auth/signup", {
        method: "POST",
        body: values,
      }),
    );
    setSessionToken(response.token);
    return response;
  },

  async login(values) {
    const response = normalizeAuthResponse(
      await apiRequest("/auth/login", {
        method: "POST",
        body: values,
      }),
    );
    setSessionToken(response.token);
    return response;
  },

  async me() {
    const body = unwrapData(await apiRequest("/auth/me"));
    return body?.user || body?.account || body;
  },

  async logout() {
    try {
      await apiRequest("/auth/logout", { method: "POST" });
    } finally {
      setSessionToken(null);
    }
  },
};

