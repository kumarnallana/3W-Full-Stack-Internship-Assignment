import test from "node:test";
import assert from "node:assert/strict";
import { Post } from "../src/models/Post.js";
import { User } from "../src/models/User.js";

const userId = "507f1f77bcf86cd799439011";

test("the data model uses only the required users and posts collections", () => {
  assert.equal(User.collection.collectionName, "users");
  assert.equal(Post.collection.collectionName, "posts");
});

test("post schema supports text-only and image-only posts", async () => {
  const textPost = new Post({ author: { userId, username: "Kumar" }, text: "Hello" });
  const imagePost = new Post({
    author: { userId, username: "Kumar" },
    image: { url: "https://example.com/image.jpg", storage: "cloudinary" },
  });
  await textPost.validate();
  await imagePost.validate();
});

test("post schema rejects a post with neither text nor image", async () => {
  const post = new Post({ author: { userId, username: "Kumar" } });
  await assert.rejects(post.validate(), /requires text, an image, or both/i);
});

test("comments store reply context and canonical mention identities inside the post", async () => {
  const mentionedUserId = "507f191e810c19729de860ea";
  const post = new Post({
    author: { userId, username: "Kumar" },
    text: "A post",
    comments: [{
      userId,
      username: "Kumar",
      text: "Hello @Mira_Sen",
      replyToUserId: mentionedUserId,
      replyToUsername: "Mira Sen",
      mentions: [{ userId: mentionedUserId, username: "Mira Sen" }],
    }],
  });
  await post.validate();
  assert.equal(post.comments[0].replyToUsername, "Mira Sen");
  assert.equal(String(post.comments[0].mentions[0].userId), mentionedUserId);
  assert.equal(Post.collection.collectionName, "posts");
});
