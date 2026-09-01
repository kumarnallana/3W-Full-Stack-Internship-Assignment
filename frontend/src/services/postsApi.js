import { apiRequest, unwrapData } from "./apiClient";

function firstDefined(...values) {
  return values.find((value) => value !== undefined && value !== null);
}

export function normalizeComment(comment = {}) {
  const author = comment.author || comment.user || {};
  const rawMentions = Array.isArray(comment.mentions) ? comment.mentions : [];
  return {
    id: String(firstDefined(comment.id, comment._id, crypto.randomUUID())),
    userId: String(firstDefined(comment.userId, author.id, author._id, "")),
    username: firstDefined(
      comment.username,
      author.username,
      author.name,
      "Community member",
    ),
    avatarUrl: firstDefined(comment.avatarUrl, author.avatarUrl, author.avatar),
    text: firstDefined(comment.text, comment.content, ""),
    createdAt: firstDefined(comment.createdAt, comment.date),
    parentCommentId: firstDefined(comment.parentCommentId, null)
      ? String(comment.parentCommentId)
      : null,
    replyToUserId: firstDefined(comment.replyToUserId, null)
      ? String(comment.replyToUserId)
      : null,
    replyToUsername: firstDefined(comment.replyToUsername, ""),
    mentions: rawMentions.map((mention) => ({
      id: String(firstDefined(mention.id, mention._id, mention.userId, "")),
      username: mention.username,
    })).filter((mention) => mention.id && mention.username),
  };
}

export function normalizePost(post = {}) {
  const author = post.author || post.user || post.postedBy || {};
  const rawComments = Array.isArray(post.comments) ? post.comments : [];
  const rawLikes = Array.isArray(post.likes) ? post.likes : [];
  const image = post.image || {};

  return {
    id: String(firstDefined(post.id, post._id, crypto.randomUUID())),
    username: firstDefined(
      post.username,
      author.username,
      author.name,
      "Community member",
    ),
    authorId: String(firstDefined(author.id, author._id, post.userId, "")),
    avatarUrl: firstDefined(post.avatarUrl, author.avatarUrl, author.avatar),
    text: firstDefined(post.text, post.content, post.caption, ""),
    imageUrl: firstDefined(
      post.imageUrl,
      typeof post.image === "string" ? post.image : undefined,
      image.url,
      image.secureUrl,
    ),
    createdAt: firstDefined(post.createdAt, post.date, post.timestamp),
    likeCount: Number(firstDefined(post.likeCount, post.likesCount, rawLikes.length, 0)),
    commentCount: Number(
      firstDefined(post.commentCount, post.commentsCount, rawComments.length, 0),
    ),
    viewerHasLiked: Boolean(
      firstDefined(post.viewerHasLiked, post.isLiked, post.likedByCurrentUser, false),
    ),
    comments: rawComments.map(normalizeComment),
    raw: post,
  };
}

function normalizePostMutation(payload) {
  const body = unwrapData(payload) || {};
  const post = body.post || body.updatedPost || (body._id || body.id ? body : null);
  const comment = body.comment || body.newComment || null;
  return {
    post: post ? normalizePost(post) : null,
    comment: comment ? normalizeComment(comment) : null,
  };
}

export const postsApi = {
  async getPosts({ page = 1, limit = 10 } = {}) {
    const payload = unwrapData(
      await apiRequest(`/posts?page=${page}&limit=${limit}`),
    );
    const rawPosts = Array.isArray(payload)
      ? payload
      : payload?.posts || payload?.items || [];
    const pagination = payload?.pagination || payload?.meta || {};

    return {
      posts: rawPosts.map(normalizePost),
      hasMore: Boolean(
        firstDefined(
          payload?.hasMore,
          pagination.hasMore,
          pagination.page < pagination.totalPages,
          rawPosts.length === limit,
        ),
      ),
    };
  },

  async createPost({ text, image }) {
    const formData = new FormData();
    if (text?.trim()) formData.append("text", text.trim());
    if (image) formData.append("image", image);

    const body = unwrapData(
      await apiRequest("/posts", {
        method: "POST",
        body: formData,
      }),
    );
    return normalizePost(body?.post || body);
  },

  async toggleLike(postId) {
    return normalizePostMutation(
      await apiRequest(`/posts/${postId}/like`, { method: "POST" }),
    );
  },

  async addComment(postId, { text, parentCommentId = null, mentionUserIds = [] }) {
    return normalizePostMutation(
      await apiRequest(`/posts/${postId}/comments`, {
        method: "POST",
        body: { text: text.trim(), parentCommentId, mentionUserIds },
      }),
    );
  },
};
