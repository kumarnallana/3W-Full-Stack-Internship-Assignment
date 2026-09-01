import { DEMO_ACCOUNT } from "../config/appMode";
import { validateLogin, validateSignup } from "../validation/authValidation";

const DEMO_STATE_KEY = "mini_social_demo_state_v1";
const DEMO_SESSION_KEY = "mini_social_demo_session_v1";

export class DemoApiError extends Error {
  constructor(message, status = 400, details = null) {
    super(message);
    this.name = "DemoApiError";
    this.status = status;
    this.details = details;
  }
}

const wait = (duration) => new Promise((resolve) => window.setTimeout(resolve, duration));

function createIllustration() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760" role="img" aria-label="Abstract sunset landscape"><rect width="1200" height="760" fill="#171c26"/><circle cx="830" cy="220" r="112" fill="#ff6b6b"/><path d="M0 610 260 360l155 155 170-205 250 300 160-170 205 205v115H0Z" fill="#303948"/><path d="M0 665 300 470l150 130 160-100 225 150 180-115 185 125v100H0Z" fill="#222a36"/><path d="M0 682h1200v78H0z" fill="#11151c"/></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createSeedPosts() {
  const now = Date.now();
  return [
    {
      _id: "demo-post-1",
      content: "A quiet sunset, a half-finished idea, and a little time to make it better. That feels like a good evening.",
      imageUrl: createIllustration(),
      author: { _id: "community-aanya", username: "Aanya Rao" },
      likes: ["community-noah", "community-mira"],
      comments: [{
        _id: "demo-comment-1",
        content: "The color study feels so calm. Keep going with it.",
        author: { _id: "community-mira", username: "Mira Sen" },
        createdAt: new Date(now - 23 * 60 * 1000).toISOString(),
      }],
      createdAt: new Date(now - 48 * 60 * 1000).toISOString(),
    },
    {
      _id: "demo-post-2",
      content: "What is one tiny interaction that made a product feel unusually thoughtful to you? I am collecting examples for a design review.",
      author: { _id: "community-noah", username: "Noah Kim" },
      likes: ["community-aanya"],
      comments: [],
      createdAt: new Date(now - 2.4 * 60 * 60 * 1000).toISOString(),
    },
    {
      _id: "demo-post-3",
      content: "Small shipping note: the best responsive layouts are not smaller desktop screens. They make different decisions at different widths.",
      author: { _id: "community-mira", username: "Mira Sen" },
      likes: [],
      comments: [],
      createdAt: new Date(now - 6.5 * 60 * 60 * 1000).toISOString(),
    },
  ];
}

function loadState() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(DEMO_STATE_KEY));
    if (stored && Array.isArray(stored.accounts) && Array.isArray(stored.posts)) return stored;
  } catch {
    // A corrupt local demo store is replaced with the stable seed below.
  }
  return { accounts: [], posts: createSeedPosts() };
}

let state = loadState();

function persistState() {
  try {
    window.localStorage.setItem(DEMO_STATE_KEY, JSON.stringify(state));
  } catch {
    // The in-memory demo remains usable when a large data URL exceeds the quota.
  }
}

async function passwordDigest(password) {
  const bytes = new TextEncoder().encode(password);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function ensureDemoAccount() {
  const email = DEMO_ACCOUNT.email.toLowerCase();
  if (state.accounts.some((account) => account.email === email)) return;
  state.accounts.push({
    _id: "demo-member",
    username: DEMO_ACCOUNT.username,
    email,
    passwordDigest: await passwordDigest(DEMO_ACCOUNT.password),
  });
  persistState();
}

function publicAccount(account) {
  return { _id: account._id, username: account.username, email: account.email };
}

function readCurrentUser() {
  try {
    return JSON.parse(window.sessionStorage.getItem(DEMO_SESSION_KEY));
  } catch {
    return null;
  }
}

function saveCurrentUser(user) {
  if (user) window.sessionStorage.setItem(DEMO_SESSION_KEY, JSON.stringify(user));
  else window.sessionStorage.removeItem(DEMO_SESSION_KEY);
}

function getAuthenticatedUser() {
  const user = readCurrentUser();
  if (!user) throw new DemoApiError("Authentication required.", 401);
  return user;
}

function readJsonBody(body) {
  if (!body) return {};
  if (typeof body !== "string") return body;
  try { return JSON.parse(body); } catch { return {}; }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new DemoApiError("The selected image could not be read."));
    reader.readAsDataURL(file);
  });
}

function decoratePost(post, user) {
  return {
    ...post,
    viewerHasLiked: Boolean(user && post.likes?.includes(user._id)),
    likeCount: post.likes?.length || 0,
    commentCount: post.comments?.length || 0,
  };
}

function findPost(postId) {
  const post = state.posts.find((candidate) => candidate._id === postId);
  if (!post) throw new DemoApiError("That post is no longer available.", 404);
  return post;
}

function mentionToken(username) {
  return `@${String(username || "").trim().replace(/\s+/g, "_")}`;
}

function collectDemoUsers() {
  const users = new Map();
  const addUser = (candidate) => {
    const userId = candidate?._id || candidate?.userId;
    const username = candidate?.username;
    if (userId && username && !users.has(String(userId))) {
      users.set(String(userId), { _id: String(userId), username: String(username) });
    }
  };

  state.accounts.forEach(addUser);
  state.posts.forEach((post) => {
    addUser(post.author);
    (post.comments || []).forEach((comment) => addUser(comment.author || comment));
  });
  return [...users.values()];
}

async function handleAuth(path, options) {
  await ensureDemoAccount();
  if (path === "/auth/me") return { data: { user: getAuthenticatedUser() } };
  if (path === "/auth/logout") {
    saveCurrentUser(null);
    return { data: { success: true } };
  }

  const values = readJsonBody(options.body);
  if (path === "/auth/login") {
    const fieldErrors = validateLogin(values);
    if (Object.keys(fieldErrors).length) {
      throw new DemoApiError("Please correct the highlighted fields.", 422, { fieldErrors });
    }
    const email = values.email.trim().toLowerCase();
    const account = state.accounts.find((candidate) => candidate.email === email);
    const digest = await passwordDigest(values.password);
    if (!account || account.passwordDigest !== digest) {
      throw new DemoApiError("Email or password is incorrect.", 401);
    }
    const user = publicAccount(account);
    saveCurrentUser(user);
    return { data: { user, token: "explicit-demo-session" } };
  }

  if (path === "/auth/signup") {
    const fieldErrors = validateSignup({ ...values, confirmPassword: values.password });
    if (Object.keys(fieldErrors).length) {
      throw new DemoApiError("Please correct the highlighted fields.", 422, { fieldErrors });
    }
    const email = values.email.trim().toLowerCase();
    if (state.accounts.some((candidate) => candidate.email === email)) {
      throw new DemoApiError("An account with this email already exists.", 409, {
        fieldErrors: { email: "This email is already registered." },
      });
    }
    const account = {
      _id: crypto.randomUUID(),
      username: values.username.trim(),
      email,
      passwordDigest: await passwordDigest(values.password),
    };
    state.accounts.push(account);
    persistState();
    const user = publicAccount(account);
    saveCurrentUser(user);
    return { data: { user, token: "explicit-demo-session" } };
  }

  throw new DemoApiError("Demo authentication route not found.", 404);
}

async function handlePosts(path, options) {
  const user = getAuthenticatedUser();
  const url = new URL(path, "https://demo.local");
  const segments = url.pathname.split("/").filter(Boolean);
  const method = options.method || "GET";

  if (url.pathname === "/posts" && method === "GET") {
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.max(1, Number(url.searchParams.get("limit")) || 10);
    const start = (page - 1) * limit;
    const posts = state.posts.slice(start, start + limit).map((post) => decoratePost(post, user));
    return { data: { posts, pagination: {
      page,
      limit,
      totalPages: Math.ceil(state.posts.length / limit),
      totalPosts: state.posts.length,
      hasMore: start + posts.length < state.posts.length,
    } } };
  }

  if (url.pathname === "/posts" && method === "POST") {
    const isForm = options.body instanceof FormData;
    const values = isForm ? options.body : readJsonBody(options.body);
    const content = String(isForm ? values.get("text") || "" : values.text || values.content || "").trim();
    const image = isForm ? values.get("image") : null;
    const imageUrl = image instanceof File && image.size ? await fileToDataUrl(image) : "";
    if (!content && !imageUrl) throw new DemoApiError("Add text or an image before posting.", 422);
    const post = {
      _id: crypto.randomUUID(), content, imageUrl, author: user, likes: [], comments: [],
      createdAt: new Date().toISOString(),
    };
    state.posts.unshift(post);
    persistState();
    return { data: { post: decoratePost(post, user) } };
  }

  if (segments[0] === "posts" && segments[1] && segments[2] === "like") {
    const post = findPost(segments[1]);
    post.likes = post.likes.includes(user._id)
      ? post.likes.filter((userId) => userId !== user._id)
      : [...post.likes, user._id];
    persistState();
    return { data: { post: decoratePost(post, user) } };
  }

  if (segments[0] === "posts" && segments[1] && segments[2] === "comments") {
    const post = findPost(segments[1]);
    const values = readJsonBody(options.body);
    const content = String(values.text || values.content || "").trim();
    if (!content) throw new DemoApiError("Write a comment before sending.", 422);
    if (content.length > 400) throw new DemoApiError("Keep your comment within 400 characters.", 422);

    const parentCommentId = values.parentCommentId ? String(values.parentCommentId) : "";
    const replyTarget = parentCommentId
      ? post.comments.find((comment) => String(comment._id) === parentCommentId)
      : null;
    if (parentCommentId && !replyTarget) {
      throw new DemoApiError("The comment you are replying to is no longer available.", 404);
    }

    const rawMentionIds = values.mentionUserIds ?? [];
    if (!Array.isArray(rawMentionIds) || rawMentionIds.length > 8) {
      throw new DemoApiError("Choose no more than 8 people to mention.", 422);
    }
    const mentionIds = [...new Set(rawMentionIds.map(String))];
    const knownUsers = new Map(collectDemoUsers().map((candidate) => [candidate._id, candidate]));
    const mentionedUsers = mentionIds.map((userId) => knownUsers.get(userId));
    if (mentionedUsers.some((candidate) => !candidate)) {
      throw new DemoApiError("One or more mentioned users are no longer available.", 422);
    }
    const mentions = mentionedUsers
      .filter((candidate) => content.includes(mentionToken(candidate.username)))
      .map((candidate) => ({ userId: candidate._id, username: candidate.username }));

    const comment = {
      _id: crypto.randomUUID(),
      content,
      author: user,
      parentCommentId: replyTarget?.parentCommentId || replyTarget?._id || null,
      replyToUserId: replyTarget?.author?._id || replyTarget?.userId || null,
      replyToUsername: replyTarget?.author?.username || replyTarget?.username || "",
      mentions,
      createdAt: new Date().toISOString(),
    };
    post.comments.push(comment);
    persistState();
    return { data: { post: decoratePost(post, user), comment } };
  }

  throw new DemoApiError("Demo post route not found.", 404);
}

function handleUsers(path) {
  const currentUser = getAuthenticatedUser();
  const url = new URL(path, "https://demo.local");
  const query = String(url.searchParams.get("query") || "").trim().toLowerCase().slice(0, 40);
  const limit = Math.min(12, Math.max(1, Number(url.searchParams.get("limit")) || 8));
  const users = collectDemoUsers()
    .filter((candidate) => candidate._id !== currentUser._id)
    .filter((candidate) => !query || candidate.username.toLowerCase().includes(query))
    .sort((left, right) => left.username.localeCompare(right.username))
    .slice(0, limit);
  return { data: { users } };
}

export async function demoApiRequest(path, options = {}) {
  await wait(180 + Math.round(Math.random() * 180));
  if (path.startsWith("/auth/")) return handleAuth(path, options);
  if (path.startsWith("/posts")) return handlePosts(path, options);
  if (path.startsWith("/users")) return handleUsers(path);
  throw new DemoApiError("Demo route not found.", 404);
}
