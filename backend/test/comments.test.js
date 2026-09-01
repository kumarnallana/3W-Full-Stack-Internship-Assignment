import test from "node:test";
import assert from "node:assert/strict";
import { addComment } from "../src/controllers/postController.js";
import { Post } from "../src/models/Post.js";
import { User } from "../src/models/User.js";

test("a reply to a reply is flattened to one level and mention names come from users", async () => {
  const authorId = "507f1f77bcf86cd799439011";
  const rootAuthorId = "507f191e810c19729de860ea";
  const replyAuthorId = "507f1f77bcf86cd799439012";
  const mentionId = "507f1f77bcf86cd799439013";
  const post = new Post({
    _id: "64b64c4f9f1b2c0012345678",
    author: { userId: authorId, username: "Author" },
    text: "Conversation",
    comments: [
      { userId: rootAuthorId, username: "Root User", text: "Root" },
    ],
  });
  const root = post.comments[0];
  post.comments.push({
    userId: replyAuthorId,
    username: "Reply User",
    text: "First reply",
    parentCommentId: root._id,
    replyToUserId: root.userId,
    replyToUsername: root.username,
  });
  const reply = post.comments[1];
  post.save = async () => post;

  const originalFindById = Post.findById;
  const originalUserFind = User.find;
  Post.findById = async () => post;
  User.find = () => ({
    select() { return this; },
    async lean() { return [{ _id: mentionId, username: "Mira Sen" }]; },
  });

  let payload;
  const request = {
    params: { postId: String(post._id) },
    body: {
      text: "@Mira_Sen thanks",
      parentCommentId: String(reply._id),
      mentionUserIds: [mentionId],
    },
    user: { _id: authorId, username: "Author" },
  };
  const response = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { payload = value; },
  };

  try {
    await addComment(request, response);
  } finally {
    Post.findById = originalFindById;
    User.find = originalUserFind;
  }

  const created = post.comments.at(-1);
  assert.equal(response.statusCode, 201);
  assert.equal(String(created.parentCommentId), String(root._id));
  assert.equal(String(created.replyToUserId), replyAuthorId);
  assert.equal(created.replyToUsername, "Reply User");
  assert.equal(created.mentions[0].username, "Mira Sen");
  assert.equal(payload.data.comment.parentCommentId, String(root._id));
});
