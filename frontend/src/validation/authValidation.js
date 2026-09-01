export const AUTH_RULES = Object.freeze({
  usernameMin: 2,
  usernameMax: 40,
  passwordMin: 8,
  passwordMax: 64,
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

export function validateLogin(values = {}) {
  const errors = {};
  const email = normalizeEmail(values.email);
  const password = typeof values.password === "string" ? values.password : "";

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    errors.email = "Enter a valid email address.";
  }
  if (!password) {
    errors.password = "Enter your password.";
  } else if (password.length > AUTH_RULES.passwordMax) {
    errors.password = `Use no more than ${AUTH_RULES.passwordMax} characters.`;
  }
  return errors;
}

export function validateSignup(values = {}) {
  const errors = validateLogin(values);
  const username = String(values.username || "").trim();

  if (username.length < AUTH_RULES.usernameMin) {
    errors.username = `Use at least ${AUTH_RULES.usernameMin} characters.`;
  } else if (username.length > AUTH_RULES.usernameMax) {
    errors.username = `Use no more than ${AUTH_RULES.usernameMax} characters.`;
  }
  const password = typeof values.password === "string" ? values.password : "";
  if (password && (
    password.length < AUTH_RULES.passwordMin ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  )) {
    errors.password = `Use ${AUTH_RULES.passwordMin}–${AUTH_RULES.passwordMax} characters with at least one letter and one number.`;
  }
  if (!values.confirmPassword) {
    errors.confirmPassword = "Confirm your password.";
  } else if (password !== values.confirmPassword) {
    errors.confirmPassword = "The passwords do not match.";
  }
  return errors;
}

export function firstInvalidField(errors, order) {
  return order.find((field) => Boolean(errors[field])) || null;
}
