import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEmail,
  validateLoginInput,
  validateSignupInput,
} from "../src/utils/validation.js";

test("login rejects the one-character password that previously passed", () => {
  const errors = validateLoginInput({ email: "person@example.com", password: "a" });
  assert.match(errors.password, /at least 8/);
});

test("email normalization is stable before persistence and lookup", () => {
  assert.equal(normalizeEmail("  Person@Example.COM "), "person@example.com");
});

test("valid signup data passes server validation", () => {
  assert.deepEqual(validateSignupInput({
    username: "Kumar",
    email: "kumar@example.com",
    password: "secure-passphrase",
  }), {});
});
