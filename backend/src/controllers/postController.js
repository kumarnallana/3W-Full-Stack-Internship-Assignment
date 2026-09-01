import mongoose from "mongoose";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { storePostImage } from "../services/imageStorage.js";
import { CONTENT_LIMITS } from "../utils/validation.js";

function badRequest(message) {
  const error = new Error(message);
  error.status = 422;
  return error;
}

function validatePostId(postId) {
  if (!mongoose.isValidObjectId(postId)) {
    const error = new Error("That post is no longer available.");
    error.status = 404;
    throw error;
  }
}

function serializeComment(comment) {
  return {
    _id: String(comment._id),
    userId: String(comment.userId),
    username: comment.username,
    text: comment.text,
    createdAt: comment.createdAt,
    parentCommentId: comment.parentCommentId ? String(comment.parentCommentId) : null,
    replyToUserId: comment.replyToUserId ? String(comment.replyToUserId) : null,
    replyToUsername: comment.replyToUsername || "",
    mentions: (comment.mentions || []).map((mention) => ({
      userId: String(mention.userId),
      username: mention.username,
    })),
  };
}

export function serializePost(post, viewerId) {
  const raw = post.toObject ? post.toObject() : post;
  const viewerKey = String(viewerId);
  return {
    _id: String(raw._id),
    author: {
      _id: String(raw.author.userId),
      username: raw.author.username,
    },
    text: raw.text,
    imageUrl: raw.image?.url || "",
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    likeCount: raw.likes.length,
    commentCount: raw.comments.length,
    viewerHasLiked: raw.likes.some((like) => String(like.userId) === viewerKey),
    comments: raw.comments.map(serializeComment),
  };
}

async function requirePost(postId) {
  validatePostId(postId);
  const post = await Post.findById(postId);
  if (!post) {
    const error = new Error("That post is no longer available.");
    error.status = 404;
    throw error;
  }
  return post;
}

export async function getPosts(request, response) {
  const page = Math.max(1, Number.parseInt(request.query.page, 10) || 1);
  const limit = Math.min(25, Math.max(1, Number.parseInt(request.query.limit, 10) || 10));
  const [posts, totalPosts] = await Promise.all([
    Post.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Post.countDocuments(),
  ]);
  const totalPages = Math.ceil(totalPosts / limit);
  response.json({
    data: {
      posts: posts.map((post) => serializePost(post, request.user._id)),
      pagination: { page, limit, totalPosts, totalPages, hasMore: page < totalPages },
    },
  });
}

export async function createPost(request, response) {
  const text = String(request.body?.text || "").trim();
  if (text.length > CONTENT_LIMITS.postMax) {
    throw badRequest(`Keep your post within ${CONTENT_LIMITS.postMax} characters.`);
  }
  if (!text && !request.file) {
    throw badRequest("Add text or an image before posting.");
  }

  const image = await storePostImage(request.file, request);
  const post = await Post.create({
    author: { userId: request.user._id, username: request.user.username },
    text,
    image,
  });
  response.status(201).json({ data: { post: serializePost(post, request.user._id) } });
}

export async function toggleLike(request, response) {
  const post = await requirePost(request.params.postId);
  const userId = String(request.user._id);
  const existingIndex = post.likes.findIndex((like) => String(like.userId) === userId);
  if (existingIndex >= 0) {
    post.likes.splice(existingIndex, 1);
  } else {
    post.likes.push({ userId: request.user._id, username: request.user.username });
  }
  await post.save();
  response.json({ data: { post: serializePost(post, request.user._id) } });
}

export async function addComment(request, response) {
  const text = String(request.body?.text || "").trim();
  if (!text) throw badRequest("Write a comment before sending.");
  if (text.length > CONTENT_LIMITS.commentMax) {
    throw badRequest(`Keep your comment within ${CONTENT_LIMITS.commentMax} characters.`);
  }

  const post = await requirePost(request.params.postId);
  const requestedParentId = request.body?.parentCommentId
    ? String(request.body.parentCommentId)
    : "";
  let replyTarget = null;
  let rootParentId = null;
  if (requestedParentId) {
    if (!mongoose.isValidObjectId(requestedParentId)) {
      throw badRequest("The comment you are replying to is invalid.");
    }
    replyTarget = post.comments.id(requestedParentId);
    if (!replyTarget) {
      const error = new Error("The comment you are replying to is no longer available.");
      error.status = 404;
      throw error;
    }
    rootParentId = replyTarget.parentCommentId || replyTarget._id;
  }

  const rawMentionIds = request.body?.mentionUserIds ?? [];
  if (!Array.isArray(rawMentionIds) || rawMentionIds.length > 8) {
    throw badRequest("Choose no more than 8 people to mention.");
  }
  const mentionIds = [...new Set(rawMentionIds.map(String))];
  if (mentionIds.some((userId) => !mongoose.isValidObjectId(userId))) {
    throw badRequest("One or more mentioned users are invalid.");
  }
  const mentionedUsers = mentionIds.length
    ? await User.find({ _id: { $in: mentionIds } }).select("username").lean()
    : [];
  if (mentionedUsers.length !== mentionIds.length) {
    throw badRequest("One or more mentioned users are no longer available.");
  }
  const mentions = mentionedUsers
    .filter((user) => text.includes(`@${String(user.username).trim().replace(/\s+/g, "_")}`))
    .map((user) => ({ userId: user._id, username: user.username }));

  post.comments.push({
    userId: request.user._id,
    username: request.user.username,
    text,
    parentCommentId: rootParentId,
    replyToUserId: replyTarget?.userId || null,
    replyToUsername: replyTarget?.username || "",
    mentions,
  });
  await post.save();
  const comment = post.comments.at(-1);
  response.status(201).json({
    data: {
      post: serializePost(post, request.user._id),
      comment: serializeComment(comment),
    },
  });
}
