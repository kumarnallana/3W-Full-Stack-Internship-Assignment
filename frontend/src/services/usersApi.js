import { apiRequest, unwrapData } from "./apiClient";

export const usersApi = {
  async search(query = "") {
    const params = new URLSearchParams({ query: String(query), limit: "8" });
    const payload = unwrapData(await apiRequest(`/users?${params.toString()}`)) || {};
    const users = Array.isArray(payload) ? payload : payload.users || [];
    return users.map((user) => ({
      id: String(user.id || user._id),
      username: user.username,
    }));
  },
  
  async getNotifications() {
    return unwrapData(await apiRequest("/users/notifications"));
  },
  
  async markNotificationsRead() {
    return unwrapData(await apiRequest("/users/notifications/read", { method: "POST" }));
  }
};
