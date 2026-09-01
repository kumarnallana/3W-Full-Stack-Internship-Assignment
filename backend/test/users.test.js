import test from "node:test";
import assert from "node:assert/strict";
import { searchUsers } from "../src/controllers/userController.js";
import { User } from "../src/models/User.js";

test("mention search excludes the viewer and returns usernames without emails", async () => {
  const viewerId = "507f1f77bcf86cd799439011";
  const resultId = "507f191e810c19729de860ea";
  const originalFind = User.find;
  let capturedFilter;
  User.find = (filter) => {
    capturedFilter = filter;
    return {
      select() { return this; },
      sort() { return this; },
      limit() { return this; },
      async lean() { return [{ _id: resultId, username: "Mira Sen", email: "private@example.com" }]; },
    };
  };

  let payload;
  try {
    await searchUsers(
      { query: { query: "Mira", limit: "8" }, user: { _id: viewerId } },
      { json(value) { payload = value; } },
    );
  } finally {
    User.find = originalFind;
  }

  assert.equal(String(capturedFilter._id.$ne), viewerId);
  assert.equal(capturedFilter.username.$options, "i");
  assert.deepEqual(payload.data.users, [{ _id: resultId, username: "Mira Sen" }]);
});
