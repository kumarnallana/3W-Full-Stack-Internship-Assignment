import test from "node:test";
import assert from "node:assert/strict";
import { getPosts } from "../src/controllers/postController.js";
import { Post } from "../src/models/Post.js";

test("a post created by account A is returned when account B loads the public feed", async () => {
  const accountAId = "507f1f77bcf86cd799439011";
  const accountBId = "507f191e810c19729de860ea";
  const originalFind = Post.find;
  const originalCountDocuments = Post.countDocuments;
  let findArguments;

  const accountAPost = {
    _id: "64b64c4f9f1b2c0012345678",
    author: { userId: accountAId, username: "Account A" },
    text: "This post must be visible to every signed-in account.",
    image: { url: "" },
    likes: [],
    comments: [],
    createdAt: new Date("2026-09-01T10:00:00.000Z"),
    updatedAt: new Date("2026-09-01T10:00:00.000Z"),
  };

  Post.find = (...args) => {
    findArguments = args;
    return {
      sort() { return this; },
      skip() { return this; },
      limit() { return Promise.resolve([accountAPost]); },
    };
  };
  Post.countDocuments = async () => 1;

  let payload;
  const request = { query: { page: "1", limit: "10" }, user: { _id: accountBId } };
  const response = { json(value) { payload = value; } };

  try {
    await getPosts(request, response);
  } finally {
    Post.find = originalFind;
    Post.countDocuments = originalCountDocuments;
  }

  assert.deepEqual(findArguments, [], "the feed query must not filter by the current user");
  assert.equal(payload.data.posts.length, 1);
  assert.equal(payload.data.posts[0].author.username, "Account A");
  assert.equal(payload.data.posts[0].text, accountAPost.text);
  assert.equal(payload.data.posts[0].viewerHasLiked, false);
});
