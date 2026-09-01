import { User } from "../models/User.js";

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function searchUsers(request, response) {
  const query = String(request.query.query || "").trim().slice(0, 40);
  const limit = Math.min(12, Math.max(1, Number.parseInt(request.query.limit, 10) || 8));
  const filter = {
    _id: { $ne: request.user._id },
    ...(query ? { username: { $regex: escapeRegularExpression(query), $options: "i" } } : {}),
  };
  const users = await User.find(filter)
    .select("username")
    .sort({ username: 1 })
    .limit(limit)
    .lean();

  response.json({
    data: {
      users: users.map((user) => ({ _id: String(user._id), username: user.username })),
    },
  });
}

export async function getNotifications(request, response) {
  const user = await User.findById(request.user._id).select("+notifications").lean();
  if (!user) {
    const error = new Error("User not found.");
    error.status = 404;
    throw error;
  }
  
  // Sort notifications by newest first
  const notifications = (user.notifications || []).sort((a, b) => b.createdAt - a.createdAt);
  
  response.json({
    data: {
      notifications: notifications.map((n) => ({
        id: String(n._id),
        type: n.type,
        actorUsername: n.actorUsername,
        postId: String(n.postId),
        commentId: String(n.commentId),
        read: n.read,
        createdAt: n.createdAt,
      })),
      unreadCount: notifications.filter((n) => !n.read).length,
    },
  });
}

export async function markNotificationsRead(request, response) {
  await User.updateOne(
    { _id: request.user._id },
    { $set: { "notifications.$[].read": true } }
  );
  response.json({ data: { success: true } });
}
