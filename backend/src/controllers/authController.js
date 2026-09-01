import { User } from "../models/User.js";
import {
  hashPassword,
  publicUser,
  sessionCookieOptions,
  signSession,
  verifyPassword,
} from "../utils/auth.js";
import {
  hasErrors,
  normalizeEmail,
  validateLoginInput,
  validateSignupInput,
} from "../utils/validation.js";

function validationError(fieldErrors) {
  const error = new Error("Please correct the highlighted fields.");
  error.status = 422;
  error.fieldErrors = fieldErrors;
  return error;
}

function establishSession(response, user) {
  const token = signSession(user._id);
  response.cookie("mini_social_session", token, sessionCookieOptions);
  return token;
}

export async function signup(request, response) {
  const fieldErrors = validateSignupInput(request.body);
  if (hasErrors(fieldErrors)) throw validationError(fieldErrors);

  const email = normalizeEmail(request.body.email);
  const existingUser = await User.exists({ email });
  if (existingUser) {
    const error = new Error("An account with this email already exists.");
    error.status = 409;
    error.fieldErrors = { email: "This email is already registered." };
    throw error;
  }

  const user = await User.create({
    username: request.body.username.trim(),
    email,
    passwordHash: await hashPassword(request.body.password),
  });
  const token = establishSession(response, user);
  response.status(201).json({ data: { user: publicUser(user), token } });
}

export async function login(request, response) {
  const fieldErrors = validateLoginInput(request.body);
  if (hasErrors(fieldErrors)) throw validationError(fieldErrors);

  const email = normalizeEmail(request.body.email);
  const user = await User.findOne({ email }).select("+passwordHash");
  const valid = user && await verifyPassword(request.body.password, user.passwordHash);
  if (!valid) {
    const error = new Error("Email or password is incorrect.");
    error.status = 401;
    throw error;
  }

  const token = establishSession(response, user);
  response.json({ data: { user: publicUser(user), token } });
}

export function logout(request, response) {
  const { maxAge, ...clearOptions } = sessionCookieOptions;
  response.clearCookie("mini_social_session", clearOptions);
  response.json({ data: { success: true } });
}

export function me(request, response) {
  response.json({ data: { user: publicUser(request.user) } });
}
