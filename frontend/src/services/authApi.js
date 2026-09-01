import { apiRequest, unwrapData } from "./apiClient";

function normalizeAuthResponse(payload) {
  const body = unwrapData(payload) || {};
  const user = body.user || body.account || payload?.user || null;
  const token = body.token || body.accessToken || payload?.token || null;

  return { user, token, raw: body };
}

export const authApi = {
  async signup(values) {
    return normalizeAuthResponse(
      await apiRequest("/auth/signup", {
        method: "POST",
        body: values,
      }),
    );
  },

  async login(values) {
    return normalizeAuthResponse(
      await apiRequest("/auth/login", {
        method: "POST",
        body: values,
      }),
    );
  },

  async me() {
    const body = unwrapData(await apiRequest("/auth/me"));
    return body?.user || body?.account || body;
  },

  async logout() {
    await apiRequest("/auth/logout", { method: "POST" });
  },
};
