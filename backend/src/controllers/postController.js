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

function serializeComment(comment, viewerId) {
  const viewerKey = viewerId ? String(viewerId) : null;
  const rawLikes = Array.isArray(comment.likes) ? comment.likes : [];
  
  return {
    _id: String(comment._id),
    userId: String(comment.userId),
    username: comment.username,
    text: comment.text,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
    isEdited: Boolean(comment.isEdited),
    parentCommentId: comment.parentCommentId ? String(comment.parentCommentId) : null,
    replyToUserId: comment.replyToUserId ? String(comment.replyToUserId) : null,
    replyToUsername: comment.replyToUsername || "",
    mentions: (comment.mentions || []).map((mention) => ({
      userId: String(mention.userId),
      username: mention.username,
    })),
    likeCount: rawLikes.length,
    viewerHasLiked: viewerKey ? rawLikes.some((like) => String(like.userId) === viewerKey) : false,
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
    comments: raw.comments.map(c => serializeComment(c, viewerId)),
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

  const currentUserId = String(request.user._id);
  const notificationsToCreate = [];

  for (const mention of mentions) {
    if (String(mention.userId) !== currentUserId) {
      notificationsToCreate.push({
        userId: mention.userId,
        notification: {
          type: "mention",
          actorUsername: request.user.username,
          postId: post._id,
          commentId: comment._id,
        },
      });
    }
  }

  if (replyTarget && replyTarget.userId) {
    const replyUserIdStr = String(replyTarget.userId);
    const alreadyNotified = notificationsToCreate.some((n) => String(n.userId) === replyUserIdStr);
    if (replyUserIdStr !== currentUserId && !alreadyNotified) {
      notificationsToCreate.push({
        userId: replyTarget.userId,
        notification: {
          type: "reply",
          actorUsername: request.user.username,
          postId: post._id,
          commentId: comment._id,
        },
      });
    }
  }

  if (notificationsToCreate.length > 0) {
    const bulkOps = notificationsToCreate.map((n) => ({
      updateOne: {
        filter: { _id: n.userId },
        update: {
          $push: {
            notifications: {
              $each: [n.notification],
              $slice: -50,
            },
          },
        },
      },
    }));
    await User.bulkWrite(bulkOps).catch((err) => console.error("Notification error:", err));
  }

  response.status(201).json({
    data: {
      post: serializePost(post, request.user._id),
      comment: serializeComment(comment, request.user._id),
    },
  });
}

export async function editComment(request, response) {
  const { postId, commentId } = request.params;
  const text = String(request.body?.text || "").trim();
  
  if (!text) throw badRequest("Comment text cannot be empty.");
  if (text.length > CONTENT_LIMITS.commentMax) {
    throw badRequest(`Keep your comment within ${CONTENT_LIMITS.commentMax} characters.`);
  }

  const post = await requirePost(postId);
  const comment = post.comments.id(commentId);
  
  if (!comment) {
    throw badRequest("Comment not found.");
  }
  if (String(comment.userId) !== String(request.user._id)) {
    const error = new Error("You can only edit your own comments.");
    error.status = 403;
    throw error;
  }

  // Update mentions
  const rawMentionIds = request.body?.mentionUserIds ?? [];
  const mentionIds = [...new Set(rawMentionIds.map(String))];
  const mentionedUsers = mentionIds.length
    ? await User.find({ _id: { $in: mentionIds } }).select("username").lean()
    : [];
  const mentions = mentionedUsers
    .filter((user) => text.includes(`@${String(user.username).trim().replace(/\s+/g, "_")}`))
    .map((user) => ({ userId: user._id, username: user.username }));

  comment.text = text;
  comment.isEdited = true;
  comment.mentions = mentions;
  comment.updatedAt = new Date();
  
  await post.save();
  
  response.json({
    data: {
      post: serializePost(post, request.user._id),
      comment: serializeComment(comment, request.user._id),
    },
  });
}

export async function deleteComment(request, response) {
  const { postId, commentId } = request.params;
  const post = await requirePost(postId);
  const comment = post.comments.id(commentId);
  
  if (!comment) {
    throw badRequest("Comment not found.");
  }
  if (String(comment.userId) !== String(request.user._id)) {
    const error = new Error("You can only delete your own comments.");
    error.status = 403;
    throw error;
  }

  // Delete the comment and its replies
  post.comments = post.comments.filter(c => 
    String(c._id) !== String(commentId) && String(c.parentCommentId) !== String(commentId)
  );
  
  await post.save();
  
  response.json({
    data: {
      post: serializePost(post, request.user._id),
      deletedCommentId: commentId
    }
  });
}

export async function toggleCommentLike(request, response) {
  const { postId, commentId } = request.params;
  const post = await requirePost(postId);
  const comment = post.comments.id(commentId);
  
  if (!comment) {
    throw badRequest("Comment not found.");
  }
  
  const userId = String(request.user._id);
  const existingIndex = comment.likes.findIndex((like) => String(like.userId) === userId);
  
  if (existingIndex >= 0) {
    comment.likes.splice(existingIndex, 1);
  } else {
    comment.likes.push({ userId: request.user._id, username: request.user.username });
  }
  
  await post.save();
  
  response.json({
    data: {
      post: serializePost(post, request.user._id),
      comment: serializeComment(comment, request.user._id),
    },
  });
}
