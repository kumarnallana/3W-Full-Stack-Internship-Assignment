import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/utils/auth.js";

test("passwords are stored as hashes and verified without plaintext comparison", async () => {
  const password = "correct-horse-battery-staple";
  const passwordHash = await hashPassword(password);
  assert.notEqual(passwordHash, password);
  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword("wrong-password", passwordHash), false);
});
