import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEmail,
  validateLoginInput,
  validateSignupInput,
} from "../src/utils/validation.js";

test("login accepts a non-empty password for credential verification", () => {
  assert.deepEqual(validateLoginInput({ email: "person@example.com", password: "a" }), {});
  assert.equal(validateLoginInput({ email: "person@example.com", password: "" }).password, "Enter your password.");
});

test("email normalization is stable before persistence and lookup", () => {
  assert.equal(normalizeEmail("  Person@Example.COM "), "person@example.com");
});

test("valid signup data passes server validation", () => {
  assert.deepEqual(validateSignupInput({
    username: "Kumar",
    email: "kumar@example.com",
    password: "secure-passphrase1",
  }), {});
});

test("signup requires a password containing at least one letter and one number", () => {
  assert.match(validateSignupInput({ username: "Kumar", email: "kumar@example.com", password: "abcdefgh" }).password, /one number/);
  assert.match(validateSignupInput({ username: "Kumar", email: "kumar@example.com", password: "12345678" }).password, /one letter/);
});
