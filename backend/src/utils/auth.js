import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const PASSWORD_ROUNDS = 12;

export function hashPassword(password) {
  return bcrypt.hash(password, PASSWORD_ROUNDS);
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function signSession(userId) {
  return jwt.sign({ sub: String(userId) }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

export function verifySession(token) {
  return jwt.verify(token, env.jwtSecret);
}

export function publicUser(user) {
  return {
    _id: String(user._id),
    username: user.username,
    email: user.email,
  };
}

export const sessionCookieOptions = Object.freeze({
  httpOnly: true,
  secure: env.isProduction || env.cookieSameSite === "none",
  sameSite: env.cookieSameSite,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
});
