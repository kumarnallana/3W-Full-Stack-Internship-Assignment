const MOCK_STATE_KEY = "mini_social_explorer_state";
const MOCK_USER_KEY = "mini_social_explorer_user";

export class MockApiError extends Error {
  constructor(message, status = 400, details = null) {
    super(message);
    this.name = "MockApiError";
    this.status = status;
    this.details = details;
  }
}

const wait = (duration) =>
  new Promise((resolve) => window.setTimeout(resolve, duration));

function createIllustration() {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 760" role="img" aria-label="Abstract sunset landscape">
      <rect width="1200" height="760" fill="#171c26"/>
      <circle cx="830" cy="220" r="112" fill="#ff6b6b"/>
      <path d="M0 610 260 360l155 155 170-205 250 300 160-170 205 205v115H0Z" fill="#303948"/>
      <path d="M0 665 300 470l150 130 160-100 225 150 180-115 185 125v100H0Z" fill="#222a36"/>
      <path d="M0 682h1200v78H0z" fill="#11151c"/>
    </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function createSeedState() {
  const now = Date.now();

  return {
    posts: [
      {
        _id: "explorer-post-1",
        content:
          "A quiet sunset, a half-finished idea, and a little time to make it better. That feels like a good evening.",
        imageUrl: createIllustration(),
        author: {
          _id: "community-aanya",
          username: "Aanya Rao",
          email: "aanya@example.com",
        },
        likes: ["community-noah", "community-mira"],
        comments: [
          {
            _id: "explorer-comment-1",
            content: "The color study feels so calm. Keep going with it.",
            author: { _id: "community-mira", username: "Mira Sen" },
            createdAt: new Date(now - 23 * 60 * 1000).toISOString(),
          },
        ],
        createdAt: new Date(now - 48 * 60 * 1000).toISOString(),
      },
      {
        _id: "explorer-post-2",
        content:
          "What is one tiny interaction that made a product feel unusually thoughtful to you? I am collecting examples for a design review.",
        author: {
          _id: "community-noah",
          username: "Noah Kim",
          email: "noah@example.com",
        },
        likes: ["community-aanya"],
        comments: [],
        createdAt: new Date(now - 2.4 * 60 * 60 * 1000).toISOString(),
      },
      {
        _id: "explorer-post-3",
        content:
          "Small shipping note: the best responsive layouts are not smaller desktop screens. They make different decisions at different widths.",
        author: {
          _id: "community-mira",
          username: "Mira Sen",
          email: "mira@example.com",
        },
        likes: [],
        comments: [],
        createdAt: new Date(now - 6.5 * 60 * 60 * 1000).toISOString(),
      },
    ],
  };
}

function loadState() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(MOCK_STATE_KEY));
    if (stored && Array.isArray(stored.posts)) return stored;
  } catch {
    // A corrupt or unavailable local store should not block explorer mode.
  }
  return createSeedState();
}

let state = loadState();

function persistState() {
  try {
    window.localStorage.setItem(MOCK_STATE_KEY, JSON.stringify(state));
  } catch {
    // Large local image previews can exceed storage quotas. The in-memory state
    // remains usable for the current explorer session.
  }
}

function readCurrentUser() {
  try {
    return JSON.parse(window.sessionStorage.getItem(MOCK_USER_KEY));
  } catch {
    return null;
  }
}

function saveCurrentUser(user) {
  if (user) {
    window.sessionStorage.setItem(MOCK_USER_KEY, JSON.stringify(user));
  } else {
    window.sessionStorage.removeItem(MOCK_USER_KEY);
  }
}

function readJsonBody(body) {
  if (!body) return {};
  if (typeof body === "string") {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new MockApiError("The selected image could not be read."));
    reader.readAsDataURL(file);
  });
}

function getAuthenticatedUser() {
  const user = readCurrentUser();
  if (!user) throw new MockApiError("Not authenticated", 401);
  return user;
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
  if (!post) throw new MockApiError("That post is no longer available.", 404);
  return post;
}

async function handleAuth(path, options) {
  if (path === "/auth/me") {
    return { data: { user: getAuthenticatedUser() } };
  }

  if (path === "/auth/logout") {
    saveCurrentUser(null);
    return { data: { success: true } };
  }

  if (path === "/auth/login" || path === "/auth/signup") {
    const values = readJsonBody(options.body);
    const email = values.email?.trim() || "explorer@example.com";
    const username =
      values.username?.trim() || email.split("@")[0] || "Explorer";
    const user = {
      _id: `explorer-${email.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      username,
      email,
    };
    saveCurrentUser(user);
    return { data: { user, token: "explorer-session" } };
  }

  throw new MockApiError("Explorer authentication route not found.", 404);
}

async function handlePosts(path, options) {
  const user = getAuthenticatedUser();
  const url = new URL(path, "https://explorer.local");
  const segments = url.pathname.split("/").filter(Boolean);

  if (url.pathname === "/posts" && (options.method || "GET") === "GET") {
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const limit = Math.max(1, Number(url.searchParams.get("limit")) || 10);
    const start = (page - 1) * limit;
    const posts = state.posts.slice(start, start + limit).map((post) => decoratePost(post, user));
    return {
      data: {
        posts,
        pagination: {
          page,
          limit,
          totalPages: Math.max(1, Math.ceil(state.posts.length / limit)),
          totalPosts: state.posts.length,
        },
      },
    };
  }

  if (url.pathname === "/posts" && options.method === "POST") {
    const isForm = options.body instanceof FormData;
    const values = isForm ? options.body : readJsonBody(options.body);
    const content = String(isForm ? values.get("text") || "" : values.text || values.content || "").trim();
    const image = isForm ? values.get("image") : null;
    const imageUrl = image instanceof File && image.size ? await fileToDataUrl(image) : "";

    if (!content && !imageUrl) {
      throw new MockApiError("Add text or an image before posting.", 422);
    }

    const post = {
      _id: crypto.randomUUID(),
      content,
      imageUrl,
      author: user,
      likes: [],
      comments: [],
      createdAt: new Date().toISOString(),
    };
    state.posts.unshift(post);
    persistState();
    return { data: { post: decoratePost(post, user) } };
  }

  if (segments[0] === "posts" && segments[1] && segments[2] === "like") {
    const post = findPost(segments[1]);
    const hasLiked = post.likes.includes(user._id);
    post.likes = hasLiked
      ? post.likes.filter((userId) => userId !== user._id)
      : [...post.likes, user._id];
    persistState();
    return { data: { post: decoratePost(post, user) } };
  }

  if (segments[0] === "posts" && segments[1] && segments[2] === "comments") {
    const post = findPost(segments[1]);
    const values = readJsonBody(options.body);
    const content = String(values.text || values.content || "").trim();
    if (!content) throw new MockApiError("Write a comment before sending.", 422);

    const comment = {
      _id: crypto.randomUUID(),
      content,
      author: user,
      createdAt: new Date().toISOString(),
    };
    post.comments.push(comment);
    persistState();
    return { data: { post: decoratePost(post, user), comment } };
  }

  throw new MockApiError("Explorer post route not found.", 404);
}

export async function mockApiRequest(path, options = {}) {
  await wait(180 + Math.round(Math.random() * 180));

  if (path.startsWith("/auth/")) return handleAuth(path, options);
  if (path.startsWith("/posts")) return handlePosts(path, options);

  throw new MockApiError("Explorer route not found.", 404);
}
