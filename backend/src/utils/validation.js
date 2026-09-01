export const AUTH_LIMITS = Object.freeze({
  usernameMin: 2,
  usernameMax: 40,
  passwordMin: 8,
  passwordMax: 64,
});

export const CONTENT_LIMITS = Object.freeze({
  postMax: 600,
  commentMax: 400,
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

export function validateEmail(value) {
  const email = normalizeEmail(value);
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

export function validateLoginInput(values = {}) {
  const fieldErrors = {};
  if (!validateEmail(values.email)) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (typeof values.password !== "string" || !values.password) {
    fieldErrors.password = "Enter your password.";
  } else if (values.password.length > AUTH_LIMITS.passwordMax) {
    fieldErrors.password = `Password must contain at most ${AUTH_LIMITS.passwordMax} characters.`;
  }
  return fieldErrors;
}

export function validateSignupInput(values = {}) {
  const fieldErrors = validateLoginInput(values);
  const username = String(values.username || "").trim();
  if (username.length < AUTH_LIMITS.usernameMin) {
    fieldErrors.username = `Username must contain at least ${AUTH_LIMITS.usernameMin} characters.`;
  } else if (username.length > AUTH_LIMITS.usernameMax) {
    fieldErrors.username = `Username must contain at most ${AUTH_LIMITS.usernameMax} characters.`;
  }
  const password = typeof values.password === "string" ? values.password : "";
  if (password && (
    password.length < AUTH_LIMITS.passwordMin ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  )) {
    fieldErrors.password = `Password must contain ${AUTH_LIMITS.passwordMin}–${AUTH_LIMITS.passwordMax} characters, including at least one letter and one number.`;
  }
  return fieldErrors;
}

export function hasErrors(fieldErrors) {
  return Object.keys(fieldErrors).length > 0;
}
