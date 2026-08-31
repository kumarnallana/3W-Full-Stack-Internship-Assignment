const DEFAULT_API_BASE_URL = "http://localhost:5000/api";
const TOKEN_KEY = "mini_social_session_token";

export const API_BASE_URL = (
  import.meta.env.VITE_API_BASE_URL || DEFAULT_API_BASE_URL
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(message, status = 0, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function getSessionToken() {
  return window.sessionStorage.getItem(TOKEN_KEY);
}

export function setSessionToken(token) {
  if (token) {
    window.sessionStorage.setItem(TOKEN_KEY, token);
  } else {
    window.sessionStorage.removeItem(TOKEN_KEY);
  }
}

export function unwrapData(payload) {
  return payload?.data ?? payload;
}

function getErrorMessage(payload, fallback) {
  return (
    payload?.message ||
    payload?.error?.message ||
    payload?.error ||
    fallback
  );
}

export async function apiRequest(path, options = {}) {
  const { body, headers = {}, ...requestOptions } = options;
  const token = getSessionToken();
  const isFormData = body instanceof FormData;
  const requestHeaders = {
    Accept: "application/json",
    ...(!isFormData && body ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...headers,
  };

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      ...requestOptions,
      headers: requestHeaders,
      body: isFormData || typeof body === "string" ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    console.warn(`[Mock API] Backend unreachable for ${path}. Falling back to mock data.`);
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(handleMockResponse(path, options));
      }, 800); // simulate network latency
    });
  }

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => null)
    : await response.text().catch(() => "");

  if (!response.ok) {
    throw new ApiError(
      getErrorMessage(payload, "Something went wrong. Please try again."),
      response.status,
      payload,
    );
  }

  return payload;
}

// --- MOCK API LAYER FOR OFFLINE EXPLORATION ---
const mockState = {
  posts: [
    {
      _id: "m1",
      content: "Just designed a new landing page. What do you think?",
      author: { _id: "u2", username: "design_guru", email: "design@example.com" },
      likes: ["u2"],
      comments: [
        { _id: "c1", content: "Looks amazing!", author: { _id: "u3", username: "dev_dude" }, createdAt: new Date().toISOString() }
      ],
      createdAt: new Date(Date.now() - 3600000).toISOString(),
    },
    {
      _id: "m2",
      content: "Does anyone know a good tutorial for advanced CSS animations?",
      author: { _id: "u3", username: "dev_dude", email: "dev@example.com" },
      likes: [],
      comments: [],
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    }
  ],
  currentUser: { _id: "u1", username: "explorer", email: "explorer@example.com" }
};

function handleMockResponse(path, options) {
  if (path === "/auth/signup" || path === "/auth/login") {
    let username = "explorer", email = "explorer@example.com";
    try {
      const body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
      if (body.username) username = body.username;
      if (body.email) email = body.email;
    } catch (e) {}
    mockState.currentUser = { _id: "u1", username, email };
    return { data: { user: mockState.currentUser, token: "mock-token-123" } };
  }
  
  if (path === "/auth/me") {
    if (!getSessionToken()) throw new ApiError("Not authenticated", 401);
    return { data: { user: mockState.currentUser } };
  }

  if (path === "/auth/logout") {
    return { data: { success: true } };
  }

  if (path.startsWith("/posts")) {
    const isLike = path.endsWith("/like");
    const isComment = path.endsWith("/comments");
    
    if (isLike) {
      const postId = path.split("/")[2];
      const post = mockState.posts.find(p => p._id === postId);
      if (post) {
        const uid = mockState.currentUser._id;
        if (post.likes.includes(uid)) post.likes = post.likes.filter(id => id !== uid);
        else post.likes.push(uid);
      }
      return { data: { success: true } };
    }

    if (isComment) {
      const postId = path.split("/")[2];
      const post = mockState.posts.find(p => p._id === postId);
      let content = "Comment";
      try {
        const body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
        content = body.content;
      } catch (e) {}
      
      const newComment = {
        _id: "c" + Date.now(),
        content,
        author: mockState.currentUser,
        createdAt: new Date().toISOString()
      };
      if (post) post.comments.push(newComment);
      return { data: { comment: newComment } };
    }

    if (options.method === "POST" && path === "/posts") {
      let content = "New post!";
      if (options.body instanceof FormData) {
        content = options.body.get("content");
      } else {
        try {
          const body = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
          content = body.content;
        } catch(e) {}
      }
      
      const newPost = {
        _id: "m" + Date.now(),
        content,
        author: mockState.currentUser,
        likes: [],
        comments: [],
        createdAt: new Date().toISOString()
      };
      mockState.posts.unshift(newPost);
      return { data: { post: newPost } };
    }

    // Default GET /posts
    return { data: { posts: mockState.posts, pagination: { page: 1, limit: 10, totalPages: 1, totalPosts: mockState.posts.length } } };
  }

  throw new ApiError("Mock route not found", 404);
}
