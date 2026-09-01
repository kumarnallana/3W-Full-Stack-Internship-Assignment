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
