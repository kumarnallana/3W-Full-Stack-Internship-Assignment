import { User } from "../models/User.js";
import { verifySession } from "../utils/auth.js";

export async function authenticate(request, response, next) {
  try {
    const authorization = request.get("authorization") || "";
    const bearerToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";
    const token = request.cookies?.mini_social_session || bearerToken;

    if (!token) {
      return response.status(401).json({ message: "Authentication required." });
    }

    const payload = verifySession(token);
    const user = await User.findById(payload.sub);
    if (!user) {
      return response.status(401).json({ message: "Your session is no longer valid." });
    }

    request.user = user;
    return next();
  } catch {
    return response.status(401).json({ message: "Your session is invalid or has expired." });
  }
}
