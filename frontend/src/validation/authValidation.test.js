import test from "node:test";
import assert from "node:assert/strict";
import { validateLogin, validateSignup } from "./authValidation.js";

test("login rejects a one-character password", () => {
  assert.equal(
    validateLogin({ email: "person@example.com", password: "a" }).password,
    "Use at least 8 characters.",
  );
});

test("login accepts an eight-character password", () => {
  assert.deepEqual(validateLogin({ email: "person@example.com", password: "12345678" }), {});
});

test("signup validates username, normalized email, and matching passwords", () => {
  const errors = validateSignup({
    username: "x",
    email: "invalid",
    password: "12345678",
    confirmPassword: "different",
  });
  assert.ok(errors.username);
  assert.ok(errors.email);
  assert.ok(errors.confirmPassword);
});
