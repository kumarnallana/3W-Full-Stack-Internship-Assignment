import test from "node:test";
import assert from "node:assert/strict";
import { validateLogin, validateSignup } from "./authValidation.js";

test("login validates presence but leaves password strength to credential verification", () => {
  assert.deepEqual(validateLogin({ email: "person@example.com", password: "a" }), {});
  assert.equal(validateLogin({ email: "person@example.com", password: "" }).password, "Enter your password.");
});

test("login accepts an eight-character password", () => {
  assert.deepEqual(validateLogin({ email: "person@example.com", password: "12345678" }), {});
});

test("signup validates username, normalized email, and matching passwords", () => {
  const errors = validateSignup({
    username: "x",
    email: "invalid",
    password: "password1",
    confirmPassword: "different",
  });
  assert.ok(errors.username);
  assert.ok(errors.email);
  assert.ok(errors.confirmPassword);
});

test("signup requires both a letter and a number in an eight-character password", () => {
  assert.ok(validateSignup({ username: "Kumar", email: "kumar@example.com", password: "abcdefgh", confirmPassword: "abcdefgh" }).password);
  assert.ok(validateSignup({ username: "Kumar", email: "kumar@example.com", password: "12345678", confirmPassword: "12345678" }).password);
  assert.deepEqual(validateSignup({ username: "Kumar", email: "kumar@example.com", password: "secure123", confirmPassword: "secure123" }), {});
});
