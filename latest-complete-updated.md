# Entire Codebase

## backend\package.json

```json
{
  "name": "3w-mini-social-backend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "node --watch src/server.js",
    "start": "node src/server.js",
    "build": "node --check src/app.js && node --check src/server.js",
    "test": "node --test"
  },
  "engines": {
    "node": ">=20"
  },
  "dependencies": {
    "bcryptjs": "^3.0.3",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.6",
    "dotenv": "^17.4.2",
    "express": "^5.2.1",
    "express-rate-limit": "^8.7.0",
    "helmet": "^8.3.0",
    "jsonwebtoken": "^9.0.3",
    "mongoose": "^9.9.4",
    "multer": "^2.3.0"
  }
}
```

## backend\src\app.js

```javascript
import path from "node:path";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { authRouter } from "./routes/authRoutes.js";
import { postRouter } from "./routes/postRoutes.js";
import { userRouter } from "./routes/userRoutes.js";
import { uploadsDirectory } from "./services/imageStorage.js";

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.disable("x-powered-by");

  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin || env.clientOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      const error = new Error("This origin is not allowed.");
      error.status = 403;
      callback(error);
    },
  }));
  app.use(express.json({ limit: "64kb" }));
  app.use(cookieParser());
  app.use("/uploads", express.static(path.resolve(uploadsDirectory), {
    fallthrough: true,
    immutable: true,
    maxAge: "7d",
  }));

  app.get("/api/health", (request, response) => {
    const connected = mongoose.connection.readyState === 1;
    response.status(connected ? 200 : 503).json({
      status: connected ? "ok" : "unavailable",
      database: connected ? "connected" : "disconnected",
    });
  });
  app.use("/api/auth", authRouter);
  app.use("/api/posts", postRouter);
  app.use("/api/users", userRouter);
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
```

## backend\src\config\database.js

```javascript
import dns from "node:dns";
import mongoose from "mongoose";
import { env } from "./env.js";

// Windows local DNS resolvers commonly reject SRV queries; ensure reliable Atlas resolution
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (e) {
  // Ignore fallback failure
}

export async function connectDatabase() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: 8_000,
  });
  return mongoose.connection;
}

export async function disconnectDatabase() {
  await mongoose.disconnect();
}
```

## backend\src\config\env.js

```javascript
import "dotenv/config";

const nodeEnv = process.env.NODE_ENV || "development";
const isProduction = nodeEnv === "production";
const fallbackJwtSecret = "mini-social-development-secret-change-before-production";

if (isProduction && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error("JWT_SECRET must contain at least 32 characters in production.");
}

const configuredSameSite = (process.env.COOKIE_SAME_SITE || "lax").toLowerCase();

export const env = Object.freeze({
  nodeEnv,
  isProduction,
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/mini_social",
  jwtSecret: process.env.JWT_SECRET || fallbackJwtSecret,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "7d",
  clientOrigins: (process.env.CLIENT_ORIGIN || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  apiPublicUrl: (process.env.API_PUBLIC_URL || "").replace(/\/$/, ""),
  cookieSameSite: ["lax", "strict", "none"].includes(configuredSameSite)
    ? configuredSameSite
    : "lax",
  cloudinary: {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    apiSecret: process.env.CLOUDINARY_API_SECRET || "",
  },
});
```

## backend\src\controllers\authController.js

```javascript
import { User } from "../models/User.js";
import {
  hashPassword,
  publicUser,
  sessionCookieOptions,
  signSession,
  verifyPassword,
} from "../utils/auth.js";
import {
  hasErrors,
  normalizeEmail,
  validateLoginInput,
  validateSignupInput,
} from "../utils/validation.js";

function validationError(fieldErrors) {
  const error = new Error("Please correct the highlighted fields.");
  error.status = 422;
  error.fieldErrors = fieldErrors;
  return error;
}

function establishSession(response, user) {
  const token = signSession(user._id);
  response.cookie("mini_social_session", token, sessionCookieOptions);
}

export async function signup(request, response) {
  const fieldErrors = validateSignupInput(request.body);
  if (hasErrors(fieldErrors)) throw validationError(fieldErrors);

  const email = normalizeEmail(request.body.email);
  const existingUser = await User.exists({ email });
  if (existingUser) {
    const error = new Error("An account with this email already exists.");
    error.status = 409;
    error.fieldErrors = { email: "This email is already registered." };
    throw error;
  }

  const user = await User.create({
    username: request.body.username.trim(),
    email,
    passwordHash: await hashPassword(request.body.password),
  });
  establishSession(response, user);
  response.status(201).json({ data: { user: publicUser(user) } });
}

export async function login(request, response) {
  const fieldErrors = validateLoginInput(request.body);
  if (hasErrors(fieldErrors)) throw validationError(fieldErrors);

  const email = normalizeEmail(request.body.email);
  const user = await User.findOne({ email }).select("+passwordHash");
  const valid = user && await verifyPassword(request.body.password, user.passwordHash);
  if (!valid) {
    const error = new Error("Email or password is incorrect.");
    error.status = 401;
    throw error;
  }

  establishSession(response, user);
  response.json({ data: { user: publicUser(user) } });
}

export function logout(request, response) {
  const { maxAge, ...clearOptions } = sessionCookieOptions;
  response.clearCookie("mini_social_session", clearOptions);
  response.json({ data: { success: true } });
}

export function me(request, response) {
  response.json({ data: { user: publicUser(request.user) } });
}
```

## backend\src\controllers\postController.js

```javascript
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
```

## backend\src\controllers\userController.js

```javascript
import { User } from "../models/User.js";

function escapeRegularExpression(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function searchUsers(request, response) {
  const query = String(request.query.query || "").trim().slice(0, 40);
  const limit = Math.min(12, Math.max(1, Number.parseInt(request.query.limit, 10) || 8));
  const filter = {
    _id: { $ne: request.user._id },
    ...(query ? { username: { $regex: escapeRegularExpression(query), $options: "i" } } : {}),
  };
  const users = await User.find(filter)
    .select("username")
    .sort({ username: 1 })
    .limit(limit)
    .lean();

  response.json({
    data: {
      users: users.map((user) => ({ _id: String(user._id), username: user.username })),
    },
  });
}
```

## backend\src\middleware\asyncHandler.js

```javascript
export function asyncHandler(handler) {
  return function handledRoute(request, response, next) {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}
```

## backend\src\middleware\authenticate.js

```javascript
import { User } from "../models/User.js";
import { verifySession } from "../utils/auth.js";

export async function authenticate(request, response, next) {
  try {
    const authorization = request.get("authorization") || "";
    const bearerToken = authorization.startsWith("Bearer ")
      ? authorization.slice(7).trim()
      : "";
    const token = request.cookies?.mini_social_session || bearerToken;

    if (!token) {
      return response.status(401).json({ message: "Authentication required." });
    }

    const payload = verifySession(token);
    const user = await User.findById(payload.sub);
    if (!user) {
      return response.status(401).json({ message: "Your session is no longer valid." });
    }

    request.user = user;
    return next();
  } catch {
    return response.status(401).json({ message: "Your session is invalid or has expired." });
  }
}
```

## backend\src\middleware\errors.js

```javascript
import multer from "multer";

export function notFound(request, response) {
  response.status(404).json({ message: `Route not found: ${request.method} ${request.path}` });
}

export function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);

  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "Keep the image under 5 MB."
      : "The selected image could not be processed.";
    return response.status(422).json({ message });
  }

  if (error?.code === 11000) {
    return response.status(409).json({
      message: "An account with this email already exists.",
      fieldErrors: { email: "This email is already registered." },
    });
  }

  if (error?.name === "ValidationError") {
    const fieldErrors = Object.fromEntries(
      Object.entries(error.errors || {}).map(([field, value]) => [field, value.message]),
    );
    return response.status(422).json({ message: "Please correct the submitted information.", fieldErrors });
  }

  const status = Number(error?.status) || 500;
  const isServerError = status >= 500;
  if (isServerError) console.error(error);

  return response.status(status).json({
    message: isServerError ? "Something went wrong on the server." : error.message,
    ...(error?.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
  });
}
```

## backend\src\middleware\upload.js

```javascript
import multer from "multer";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const acceptedImageTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export const uploadPostImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
  fileFilter(request, file, callback) {
    if (!acceptedImageTypes.has(file.mimetype)) {
      const error = new Error("Choose a JPEG, PNG, or WebP image.");
      error.status = 422;
      callback(error);
      return;
    }
    callback(null, true);
  },
}).single("image");
```

## backend\src\models\Post.js

```javascript
import mongoose from "mongoose";
import { CONTENT_LIMITS } from "../utils/validation.js";

const { ObjectId } = mongoose.Schema.Types;

const identitySchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, required: true },
    username: { type: String, required: true, trim: true },
  },
  { _id: false },
);

const commentSchema = new mongoose.Schema(
  {
    userId: { type: ObjectId, required: true },
    username: { type: String, required: true, trim: true },
    text: { type: String, required: true, trim: true, maxlength: CONTENT_LIMITS.commentMax },
    parentCommentId: { type: ObjectId, default: null },
    replyToUserId: { type: ObjectId, default: null },
    replyToUsername: { type: String, trim: true, default: "" },
    mentions: { type: [identitySchema], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const postSchema = new mongoose.Schema(
  {
    author: { type: identitySchema, required: true },
    text: { type: String, trim: true, maxlength: CONTENT_LIMITS.postMax, default: "" },
    image: {
      url: { type: String, trim: true, default: "" },
      publicId: { type: String, trim: true, default: "" },
      storage: { type: String, enum: ["", "local", "cloudinary"], default: "" },
    },
    likes: { type: [identitySchema], default: [] },
    comments: { type: [commentSchema], default: [] },
  },
  {
    timestamps: true,
    collection: "posts",
  },
);

postSchema.index({ createdAt: -1 });

postSchema.pre("validate", function ensureContent() {
  if (!this.text?.trim() && !this.image?.url) {
    this.invalidate("text", "A post requires text, an image, or both.");
  }
});

export const Post = mongoose.models.Post || mongoose.model("Post", postSchema);
```

## backend\src\models\User.js

```javascript
import mongoose from "mongoose";
import { AUTH_LIMITS } from "../utils/validation.js";

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
      minlength: AUTH_LIMITS.usernameMin,
      maxlength: AUTH_LIMITS.usernameMax,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      maxlength: 254,
      unique: true,
      index: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
  },
  {
    timestamps: true,
    collection: "users",
  },
);

export const User = mongoose.models.User || mongoose.model("User", userSchema);
```

## backend\src\routes\authRoutes.js

```javascript
import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, logout, me, signup } from "../controllers/authController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "Too many authentication attempts. Please try again later." },
});

export const authRouter = Router();

authRouter.post("/signup", authLimiter, asyncHandler(signup));
authRouter.post("/login", authLimiter, asyncHandler(login));
authRouter.post("/logout", logout);
authRouter.get("/me", asyncHandler(authenticate), me);
```

## backend\src\routes\postRoutes.js

```javascript
import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  addComment,
  createPost,
  getPosts,
  toggleLike,
} from "../controllers/postController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import { uploadPostImage } from "../middleware/upload.js";

const mutationLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { message: "You are doing that too quickly. Please wait a moment." },
});

export const postRouter = Router();

postRouter.use(asyncHandler(authenticate));
postRouter.get("/", asyncHandler(getPosts));
postRouter.post("/", mutationLimiter, uploadPostImage, asyncHandler(createPost));
postRouter.post("/:postId/like", mutationLimiter, asyncHandler(toggleLike));
postRouter.post("/:postId/comments", mutationLimiter, asyncHandler(addComment));
```

## backend\src\routes\userRoutes.js

```javascript
import { Router } from "express";
import { searchUsers } from "../controllers/userController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";

export const userRouter = Router();

userRouter.use(asyncHandler(authenticate));
userRouter.get("/", asyncHandler(searchUsers));
```

## backend\src\server.js

```javascript
import { createServer } from "node:http";
import { createApp } from "./app.js";
import { connectDatabase, disconnectDatabase } from "./config/database.js";
import { env } from "./config/env.js";

let server;

async function start() {
  await connectDatabase();
  server = createServer(createApp());
  server.listen(env.port, () => {
    console.log(`Mini Social API listening on http://localhost:${env.port}`);
  });
}

async function shutdown(signal) {
  console.log(`${signal} received. Closing Mini Social API.`);
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  await disconnectDatabase();
  process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch((error) => {
  console.error("Mini Social API could not start:", error.message);
  process.exit(1);
});
```

## backend\src\services\imageStorage.js

```javascript
import { createHash, createHmac, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
export const uploadsDirectory = path.resolve(currentDirectory, "../../uploads");

const extensions = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

function hasCloudinaryConfiguration() {
  const { cloudName, apiKey, apiSecret } = env.cloudinary;
  return Boolean(cloudName && apiKey && apiSecret);
}

async function uploadToCloudinary(file) {
  const timestamp = Math.floor(Date.now() / 1000);
  const folder = "mini-social/posts";
  const signatureSource = `folder=${folder}&timestamp=${timestamp}${env.cloudinary.apiSecret}`;
  const signature = createHash("sha1").update(signatureSource).digest("hex");
  const form = new FormData();
  form.append("file", new Blob([file.buffer], { type: file.mimetype }), file.originalname);
  form.append("api_key", env.cloudinary.apiKey);
  form.append("timestamp", String(timestamp));
  form.append("folder", folder);
  form.append("signature", signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${env.cloudinary.cloudName}/image/upload`,
    { method: "POST", body: form },
  );
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload?.error?.message || "The image upload failed.");
    error.status = 502;
    throw error;
  }

  return { url: payload.secure_url, publicId: payload.public_id, storage: "cloudinary" };
}

async function storeLocally(file, request) {
  await mkdir(uploadsDirectory, { recursive: true });
  const fingerprint = createHmac("sha256", randomUUID())
    .update(file.buffer)
    .digest("hex")
    .slice(0, 24);
  const fileName = `${Date.now()}-${fingerprint}${extensions[file.mimetype]}`;
  await writeFile(path.join(uploadsDirectory, fileName), file.buffer, { flag: "wx" });
  const origin = env.apiPublicUrl || `${request.protocol}://${request.get("host")}`;
  return { url: `${origin}/uploads/${fileName}`, publicId: fileName, storage: "local" };
}

export async function storePostImage(file, request) {
  if (!file) return { url: "", publicId: "", storage: "" };
  return hasCloudinaryConfiguration()
    ? uploadToCloudinary(file)
    : storeLocally(file, request);
}
```

## backend\src\utils\auth.js

```javascript
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

const PASSWORD_ROUNDS = 12;

export function hashPassword(password) {
  return bcrypt.hash(password, PASSWORD_ROUNDS);
}

export function verifyPassword(password, passwordHash) {
  return bcrypt.compare(password, passwordHash);
}

export function signSession(userId) {
  return jwt.sign({ sub: String(userId) }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
  });
}

export function verifySession(token) {
  return jwt.verify(token, env.jwtSecret);
}

export function publicUser(user) {
  return {
    _id: String(user._id),
    username: user.username,
    email: user.email,
  };
}

export const sessionCookieOptions = Object.freeze({
  httpOnly: true,
  secure: env.isProduction || env.cookieSameSite === "none",
  sameSite: env.cookieSameSite,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: "/",
});
```

## backend\src\utils\validation.js

```javascript
export const AUTH_LIMITS = Object.freeze({
  usernameMin: 2,
  usernameMax: 40,
  passwordMin: 8,
  passwordMax: 64,
});

export const CONTENT_LIMITS = Object.freeze({
  postMax: 600,
  commentMax: 400,
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

export function validateEmail(value) {
  const email = normalizeEmail(value);
  return email.length <= 254 && EMAIL_PATTERN.test(email);
}

export function validateLoginInput(values = {}) {
  const fieldErrors = {};
  if (!validateEmail(values.email)) {
    fieldErrors.email = "Enter a valid email address.";
  }
  if (typeof values.password !== "string" || !values.password) {
    fieldErrors.password = "Enter your password.";
  } else if (values.password.length > AUTH_LIMITS.passwordMax) {
    fieldErrors.password = `Password must contain at most ${AUTH_LIMITS.passwordMax} characters.`;
  }
  return fieldErrors;
}

export function validateSignupInput(values = {}) {
  const fieldErrors = validateLoginInput(values);
  const username = String(values.username || "").trim();
  if (username.length < AUTH_LIMITS.usernameMin) {
    fieldErrors.username = `Username must contain at least ${AUTH_LIMITS.usernameMin} characters.`;
  } else if (username.length > AUTH_LIMITS.usernameMax) {
    fieldErrors.username = `Username must contain at most ${AUTH_LIMITS.usernameMax} characters.`;
  }
  const password = typeof values.password === "string" ? values.password : "";
  if (password && (
    password.length < AUTH_LIMITS.passwordMin ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  )) {
    fieldErrors.password = `Password must contain ${AUTH_LIMITS.passwordMin}–${AUTH_LIMITS.passwordMax} characters, including at least one letter and one number.`;
  }
  return fieldErrors;
}

export function hasErrors(fieldErrors) {
  return Object.keys(fieldErrors).length > 0;
}
```

## backend\test\auth.test.js

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/utils/auth.js";

test("passwords are stored as hashes and verified without plaintext comparison", async () => {
  const password = "correct-horse-battery-staple";
  const passwordHash = await hashPassword(password);
  assert.notEqual(passwordHash, password);
  assert.equal(await verifyPassword(password, passwordHash), true);
  assert.equal(await verifyPassword("wrong-password", passwordHash), false);
});
```

## backend\test\comments.test.js

```javascript
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
```

## backend\test\feed.test.js

```javascript
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
```

## backend\test\models.test.js

```javascript
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
```

## backend\test\users.test.js

```javascript
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
```

## backend\test\validation.test.js

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEmail,
  validateLoginInput,
  validateSignupInput,
} from "../src/utils/validation.js";

test("login accepts a non-empty password for credential verification", () => {
  assert.deepEqual(validateLoginInput({ email: "person@example.com", password: "a" }), {});
  assert.equal(validateLoginInput({ email: "person@example.com", password: "" }).password, "Enter your password.");
});

test("email normalization is stable before persistence and lookup", () => {
  assert.equal(normalizeEmail("  Person@Example.COM "), "person@example.com");
});

test("valid signup data passes server validation", () => {
  assert.deepEqual(validateSignupInput({
    username: "Kumar",
    email: "kumar@example.com",
    password: "secure-passphrase1",
  }), {});
});

test("signup requires a password containing at least one letter and one number", () => {
  assert.match(validateSignupInput({ username: "Kumar", email: "kumar@example.com", password: "abcdefgh" }).password, /one number/);
  assert.match(validateSignupInput({ username: "Kumar", email: "kumar@example.com", password: "12345678" }).password, /one letter/);
});
```

## frontend\index.html

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta
      name="description"
      content="A clean, responsive mini social feed built for the 3W full-stack internship assessment."
    />
    <meta name="theme-color" content="#0d1117" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <title>Mini Social</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

## frontend\package.json

```json
{
  "name": "3w-mini-social-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "node --test"
  },
  "dependencies": {
    "lucide-react": "^1.37.0",
    "react": "^19.2.8",
    "react-dom": "^19.2.8",
    "react-router-dom": "^7.18.3"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^6.1.1",
    "vite": "^8.2.2"
  }
}
```

## frontend\src\App.jsx

```jsx
import { Navigate, Route, Routes } from "react-router-dom";
import LoadingScreen from "./components/feedback/LoadingScreen";
import { useAuth } from "./context/AuthContext";
import FeedPage from "./pages/FeedPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";

function ProtectedRoute({ children }) {
  const { status } = useAuth();

  if (status === "checking") {
    return <LoadingScreen label="Checking your session" />;
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace />;
  }

  return children;
}

function GuestRoute({ children }) {
  const { status } = useAuth();

  if (status === "checking") {
    return <LoadingScreen label="Preparing your account" />;
  }

  if (status === "authenticated") {
    return <Navigate to="/feed" replace />;
  }

  return children;
}

export default function App() {
  const { status } = useAuth();

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate
            to={status === "authenticated" ? "/feed" : "/login"}
            replace
          />
        }
      />
      <Route
        path="/login"
        element={
          <GuestRoute>
            <LoginPage />
          </GuestRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <GuestRoute>
            <SignupPage />
          </GuestRoute>
        }
      />
      <Route
        path="/feed"
        element={
          <ProtectedRoute>
            <FeedPage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

```

## frontend\src\components\auth\AuthLayout.jsx

```jsx
import { CheckCircle2, FlaskConical, MessageCircleHeart, PanelsTopLeft, RotateCw, ServerOff } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import BrandMark from "../ui/BrandMark";

const productPoints = [
  {
    icon: MessageCircleHeart,
    title: "Share without friction",
    text: "Post a thought, a photo, or both in a few clear steps.",
  },
  {
    icon: PanelsTopLeft,
    title: "Designed for every screen",
    text: "A focused feed on mobile and a complete application shell on desktop.",
  },
  {
    icon: CheckCircle2,
    title: "Simple by intention",
    text: "Only the interactions this community needs—nothing ornamental.",
  },
];

export default function AuthLayout({ eyebrow, title, description, children }) {
  const { apiMode, sessionError, retrySession } = useAuth();

  return (
    <main className="auth-layout">
      <section className="auth-story" aria-label="About Mini Social">
        <BrandMark />
        <div className="auth-story__message">
          <p className="eyebrow">A small space for real updates</p>
          <h1>Good conversations start with something worth sharing.</h1>
          <p>
            Mini Social keeps the familiar feed experience while making every
            interaction feel considered, calm, and responsive.
          </p>
        </div>
        <div className="auth-story__points">
          {productPoints.map(({ icon: Icon, title: pointTitle, text }) => (
            <div className="auth-story__point" key={pointTitle}>
              <span aria-hidden="true">
                <Icon size={19} />
              </span>
              <div>
                <strong>{pointTitle}</strong>
                <p>{text}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="auth-story__footer">3W full-stack internship assessment</p>
      </section>

      <section className="auth-panel">
        <div className="auth-panel__mobile-brand">
          <BrandMark />
        </div>
        <div className="auth-card">
          <p className="eyebrow">{eyebrow}</p>
          <h2>{title}</h2>
          <p className="auth-card__description">{description}</p>
          {apiMode === "demo" ? (
            <div className="environment-note" role="status">
              <FlaskConical size={17} aria-hidden="true" />
              <span>
                <strong>Demo environment</strong>
                Demo accounts and posts stay in this browser. This mode never activates automatically.
              </span>
            </div>
          ) : null}
          {sessionError ? (
            <div className="environment-note environment-note--error" role="alert">
              <ServerOff size={17} aria-hidden="true" />
              <span>
                <strong>API connection unavailable</strong>
                {sessionError}
                <button type="button" onClick={retrySession}>
                  <RotateCw size={14} aria-hidden="true" /> Retry connection
                </button>
              </span>
            </div>
          ) : null}
          {children}
        </div>
      </section>
    </main>
  );
}
```

## frontend\src\components\auth\PasswordField.jsx

```jsx
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

export default function PasswordField({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
  placeholder = "Enter your password",
  inputRef,
  minLength = 8,
  maxLength = 64,
  onBlur,
  helper,
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className={`field${error ? " field--error" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <div className="password-field">
        <input
          ref={inputRef}
          id={id}
          name={id}
          type={visible ? "text" : "password"}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          minLength={minLength}
          maxLength={maxLength}
          onBlur={onBlur}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-error` : helper ? `${id}-helper` : undefined}
          required
        />
        <button
          type="button"
          className="password-field__toggle"
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff size={19} /> : <Eye size={19} />}
        </button>
      </div>
      {error ? (
        <p className="field__error" id={`${id}-error`}>
          {error}
        </p>
      ) : helper ? <p className="field__helper" id={`${id}-helper`}>{helper}</p> : null}
    </div>
  );
}
```

## frontend\src\components\comments\CommentComposer.jsx

```jsx
import { useState } from "react";
import { LoaderCircle, Send, X } from "lucide-react";
import { useMentionAutocomplete } from "../../hooks/useMentionAutocomplete";
import { mentionToken } from "../../utils/mentions";
import MentionSuggestions from "./MentionSuggestions";

export default function CommentComposer({ inputId, onSubmit, replyTarget = null, onCancel }) {
  const initialMention = replyTarget
    ? [{ id: replyTarget.userId, username: replyTarget.username }]
    : [];
  const mention = useMentionAutocomplete({
    initialText: replyTarget ? `${mentionToken(replyTarget.username)} ` : "",
    initialMentions: initialMention,
  });
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const suggestionsId = `${inputId}-mentions`;
  const trimmedText = mention.text.trim();
  const hasMessage = Boolean(trimmedText) && (
    !replyTarget || trimmedText !== mentionToken(replyTarget.username)
  );

  async function handleSubmit(event) {
    event.preventDefault();
    const text = trimmedText;
    if (!hasMessage) {
      setError(replyTarget ? "Add a message to your reply." : "Write a comment before sending.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await onSubmit({
        text,
        parentCommentId: replyTarget?.id || null,
        mentionUserIds: mention.selectedMentions.map((user) => user.id),
      });
      mention.reset();
      onCancel?.();
    } catch (requestError) {
      setError(requestError.message || "Your comment could not be added.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`comment-composer${replyTarget ? " comment-composer--reply" : ""}`}>
      {replyTarget ? (
        <div className="comment-composer__context">
          <span>Replying to <strong>@{replyTarget.username}</strong></span>
          <button type="button" onClick={onCancel} aria-label="Cancel reply"><X size={15} /></button>
        </div>
      ) : null}
      <form className="comment-thread__form" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor={inputId}>{replyTarget ? "Write a reply" : "Write a comment"}</label>
        <input
          ref={mention.inputRef}
          id={inputId}
          value={mention.text}
          onChange={(event) => {
            mention.handleChange(event);
            setError("");
          }}
          onFocus={mention.handleFocus}
          onKeyDown={mention.handleKeyDown}
          placeholder={replyTarget ? "Write a reply…" : "Write a comment… Use @ to mention someone"}
          maxLength={400}
          autoComplete="off"
          aria-autocomplete="list"
          aria-expanded={mention.open}
          aria-controls={mention.open ? suggestionsId : undefined}
          aria-activedescendant={mention.open && mention.suggestions[mention.activeIndex]
            ? `${suggestionsId}-${mention.suggestions[mention.activeIndex].id}`
            : undefined}
        />
        <button className="comment-thread__send" type="submit" disabled={submitting || !hasMessage} aria-label={replyTarget ? "Send reply" : "Send comment"}>
          {submitting ? <LoaderCircle className="spin" size={18} /> : <Send size={18} />}
        </button>
        {mention.open ? (
          <MentionSuggestions
            id={suggestionsId}
            suggestions={mention.suggestions}
            activeIndex={mention.activeIndex}
            loading={mention.loading}
            onSelect={mention.selectMention}
          />
        ) : null}
      </form>
      {error ? <p className="comment-thread__error" role="alert">{error}</p> : null}
    </div>
  );
}
```

## frontend\src\components\comments\CommentItem.jsx

```jsx
import { Reply } from "lucide-react";
import { formatPostTime } from "../../utils/formatters";
import Avatar from "../ui/Avatar";
import MentionText from "./MentionText";

export default function CommentItem({ comment, isReply = false, onReply }) {
  return (
    <article className={`comment${isReply ? " comment--reply" : ""}`}>
      <Avatar name={comment.username} src={comment.avatarUrl} size="small" />
      <div className="comment__content">
        <div className="comment__body">
          <div>
            <strong>{comment.username}</strong>
            <time dateTime={comment.createdAt}>{formatPostTime(comment.createdAt)}</time>
          </div>
          {comment.replyToUsername ? (
            <span className="comment__reply-context">Replying to @{comment.replyToUsername}</span>
          ) : null}
          <p><MentionText text={comment.text} mentions={comment.mentions} /></p>
        </div>
        <button className="comment__reply-action" type="button" onClick={() => onReply(comment)}>
          <Reply size={14} aria-hidden="true" /> Reply
        </button>
      </div>
    </article>
  );
}
```

## frontend\src\components\comments\MentionSuggestions.jsx

```jsx
import Avatar from "../ui/Avatar";

export default function MentionSuggestions({ id, suggestions, activeIndex, loading, onSelect }) {
  return (
    <div className="mention-suggestions" id={id} role="listbox" aria-label="People you can mention">
      {loading ? <p className="mention-suggestions__status">Finding people…</p> : null}
      {!loading && !suggestions.length ? (
        <p className="mention-suggestions__status">No matching people.</p>
      ) : null}
      {suggestions.map((user, index) => (
        <button
          className={index === activeIndex ? "is-active" : ""}
          id={`${id}-${user.id}`}
          key={user.id}
          type="button"
          role="option"
          aria-selected={index === activeIndex}
          onPointerDown={(event) => event.preventDefault()}
          onClick={() => onSelect(user)}
        >
          <Avatar name={user.username} size="small" />
          <span>{user.username}</span>
          <small>@{user.username.replace(/\s+/g, "_")}</small>
        </button>
      ))}
    </div>
  );
}
```

## frontend\src\components\comments\MentionText.jsx

```jsx
import { splitMentionText } from "../../utils/mentions";

export default function MentionText({ text, mentions }) {
  return splitMentionText(text, mentions).map((part, index) => (
    part.mention
      ? <span className="mention" key={`${part.mention.id}-${index}`}>{part.text}</span>
      : <span key={`text-${index}`}>{part.text}</span>
  ));
}
```

## frontend\src\components\feedback\EmptyState.jsx

```jsx
import { MessagesSquare } from "lucide-react";

export default function EmptyState({ onCreate }) {
  return (
    <section className="state-panel state-panel--empty">
      <span className="state-panel__icon" aria-hidden="true">
        <MessagesSquare size={24} />
      </span>
      <h2>No posts yet</h2>
      <p>Create the first post and start the conversation.</p>
      {onCreate ? (
        <button className="button button--primary" type="button" onClick={onCreate}>
          Create a post
        </button>
      ) : null}
    </section>
  );
}

```

## frontend\src\components\feedback\ErrorState.jsx

```jsx
import { RefreshCw } from "lucide-react";

export default function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
}) {
  return (
    <section className="state-panel state-panel--error" role="alert">
      <span className="state-panel__icon" aria-hidden="true">
        !
      </span>
      <h2>{title}</h2>
      <p>{message || "We could not complete that request."}</p>
      {onRetry ? (
        <button className="button button--secondary" type="button" onClick={onRetry}>
          <RefreshCw size={17} aria-hidden="true" />
          Try again
        </button>
      ) : null}
    </section>
  );
}

```

## frontend\src\components\feedback\FeedSkeleton.jsx

```jsx
export default function FeedSkeleton({ count = 3 }) {
  return (
    <div className="feed-skeleton" aria-label="Loading posts" aria-busy="true">
      {Array.from({ length: count }, (_, index) => (
        <article className="post-card post-card--skeleton" key={index}>
          <div className="skeleton-row">
            <span className="skeleton skeleton--avatar" />
            <span className="skeleton skeleton--line skeleton--line-short" />
          </div>
          <span className="skeleton skeleton--line" />
          <span className="skeleton skeleton--line skeleton--line-medium" />
          <span className="skeleton skeleton--media" />
        </article>
      ))}
    </div>
  );
}

```

## frontend\src\components\feedback\LoadingScreen.jsx

```jsx
import BrandMark from "../ui/BrandMark";

export default function LoadingScreen({ label = "Loading" }) {
  return (
    <main className="loading-screen" aria-live="polite" aria-busy="true">
      <BrandMark />
      <span className="loading-screen__pulse" aria-hidden="true" />
      <p>{label}</p>
    </main>
  );
}

```

## frontend\src\components\layout\AppShell.jsx

```jsx
import { MessageCircleMore, ShieldCheck } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getUserDisplayName } from "../../utils/formatters";
import Avatar from "../ui/Avatar";
import DesktopNav from "./DesktopNav";
import MobileNav from "./MobileNav";

export default function AppShell({ children, onCompose }) {
  const { user } = useAuth();
  const displayName = getUserDisplayName(user);

  return (
    <div className="app-shell">
      <DesktopNav onCompose={onCompose} />
      <main className="app-shell__main">{children}</main>

      <aside className="context-rail" aria-label="Your community context">
        <section className="context-card context-card--profile">
          <Avatar name={displayName} src={user?.avatarUrl || user?.avatar} size="large" />
          <div>
            <p className="eyebrow">Signed in as</p>
            <h2>{displayName}</h2>
            <p>{user?.email || "Ready to join the conversation"}</p>
          </div>
        </section>

        <section className="context-card">
          <span className="context-card__icon" aria-hidden="true">
            <MessageCircleMore size={20} />
          </span>
          <h2>One shared feed</h2>
          <p>Every post is public to signed-in community members.</p>
        </section>

        <section className="context-card context-card--quiet">
          <ShieldCheck size={19} aria-hidden="true" />
          <p>Share thoughtfully. Your name appears with every interaction.</p>
        </section>
      </aside>

      <MobileNav onCompose={onCompose} />
    </div>
  );
}

```

## frontend\src\components\layout\DesktopNav.jsx

```jsx
import { House, LogOut, SquarePen } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getUserDisplayName } from "../../utils/formatters";
import Avatar from "../ui/Avatar";
import BrandMark from "../ui/BrandMark";

export default function DesktopNav({ onCompose }) {
  const { user, logout } = useAuth();
  const displayName = getUserDisplayName(user);

  return (
    <aside className="desktop-nav">
      <BrandMark />

      <nav className="desktop-nav__links" aria-label="Primary navigation">
        <a className="desktop-nav__link desktop-nav__link--active" href="#feed-start" aria-current="page">
          <House size={20} aria-hidden="true" />
          Feed
        </a>
        <button className="desktop-nav__link" type="button" onClick={onCompose}>
          <SquarePen size={20} aria-hidden="true" />
          New post
        </button>
      </nav>

      <div className="desktop-nav__account">
        <div className="desktop-nav__user">
          <Avatar name={displayName} src={user?.avatarUrl || user?.avatar} />
          <span>
            <strong>{displayName}</strong>
            <small>{user?.email || "Signed in"}</small>
          </span>
        </div>
        <button className="desktop-nav__logout" type="button" onClick={logout}>
          <LogOut size={18} aria-hidden="true" />
          Log out
        </button>
      </div>
    </aside>
  );
}

```

## frontend\src\components\layout\FeedHeader.jsx

```jsx
import { FlaskConical, SquarePen } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import BrandMark from "../ui/BrandMark";

export default function FeedHeader({ onCompose }) {
  const { apiMode } = useAuth();

  return (
    <header className="feed-header" id="feed-start">
      <div className="feed-header__mobile-brand">
        <BrandMark compact />
      </div>
      <div className="feed-header__copy">
        <p className="eyebrow">The community signal</p>
        <h1>Fresh from the feed</h1>
        <p>Small updates, useful ideas, and moments worth sharing.</p>
      </div>
      <div className="feed-header__controls">
        {apiMode === "demo" ? (
          <span className="mode-badge" title="This explicitly configured environment stores demo data in this browser.">
            <FlaskConical size={14} aria-hidden="true" />
            Demo
          </span>
        ) : null}
        <button className="button button--primary feed-header__action" type="button" onClick={onCompose}>
          <SquarePen size={18} aria-hidden="true" />
          <span>New post</span>
        </button>
      </div>
    </header>
  );
}
```

## frontend\src\components\layout\MobileNav.jsx

```jsx
import { House, LogOut, SquarePen } from "lucide-react";
import { useAuth } from "../../context/AuthContext";

export default function MobileNav({ onCompose }) {
  const { logout } = useAuth();

  return (
    <nav className="mobile-nav" aria-label="Mobile navigation">
      <a href="#feed-start" className="mobile-nav__item mobile-nav__item--active" aria-current="page">
        <House size={20} aria-hidden="true" />
        <span>Feed</span>
      </a>
      <button className="mobile-nav__compose" type="button" onClick={onCompose} aria-label="Create a post">
        <SquarePen size={22} aria-hidden="true" />
      </button>
      <button className="mobile-nav__item" type="button" onClick={logout}>
        <LogOut size={20} aria-hidden="true" />
        <span>Log out</span>
      </button>
    </nav>
  );
}

```

## frontend\src\components\posts\CommentThread.jsx

```jsx
import { useMemo, useState } from "react";
import CommentComposer from "../comments/CommentComposer";
import CommentItem from "../comments/CommentItem";

export default function CommentThread({ comments, onAddComment, inputId }) {
  const [replyTarget, setReplyTarget] = useState(null);
  const { roots, repliesByRoot } = useMemo(() => {
    const ids = new Set(comments.map((comment) => comment.id));
    const rootComments = comments.filter((comment) => !comment.parentCommentId || !ids.has(comment.parentCommentId));
    const grouped = new Map();
    comments.forEach((comment) => {
      if (!comment.parentCommentId || !ids.has(comment.parentCommentId)) return;
      const current = grouped.get(comment.parentCommentId) || [];
      current.push(comment);
      grouped.set(comment.parentCommentId, current);
    });
    return { roots: rootComments, repliesByRoot: grouped };
  }, [comments]);

  function renderComment(comment, isReply = false) {
    return (
      <div className="comment-thread__item" key={comment.id}>
        <CommentItem comment={comment} isReply={isReply} onReply={setReplyTarget} />
        {replyTarget?.id === comment.id ? (
          <CommentComposer
            key={`reply-${comment.id}`}
            inputId={`${inputId}-reply-${comment.id}`}
            replyTarget={comment}
            onSubmit={onAddComment}
            onCancel={() => setReplyTarget(null)}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div className="comment-thread">
      <div className="comment-thread__list">
        {comments.length ? (
          roots.map((comment) => (
            <div className="comment-thread__conversation" key={comment.id}>
              {renderComment(comment)}
              {(repliesByRoot.get(comment.id) || []).map((reply) => renderComment(reply, true))}
            </div>
          ))
        ) : (
          <p className="comment-thread__empty">No comments yet. Start the conversation.</p>
        )}
      </div>

      <CommentComposer inputId={inputId} onSubmit={onAddComment} />
    </div>
  );
}
```

## frontend\src\components\posts\ImageLightbox.jsx

```jsx
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

export default function ImageLightbox({ imageUrl, username, onClose }) {
  const titleId = useId();
  const closeButtonRef = useRef(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "Tab") {
        event.preventDefault();
        closeButtonRef.current?.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  return createPortal(
    <div
      className="image-lightbox"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <h2 className="sr-only" id={titleId}>Image shared by {username}</h2>
      <button
        ref={closeButtonRef}
        className="image-lightbox__close"
        type="button"
        onClick={onClose}
        aria-label="Close full-screen image"
      >
        <X size={22} aria-hidden="true" />
      </button>
      <figure className="image-lightbox__content">
        <img src={imageUrl} alt={`Full-size post shared by ${username}`} />
        <figcaption>Shared by {username}</figcaption>
      </figure>
    </div>,
    document.body,
  );
}
```

## frontend\src\components\posts\PostCard.jsx

```jsx
import { useState } from "react";
import { Heart, ImageOff, LoaderCircle, Maximize2, MessageCircle } from "lucide-react";
import { formatPostTime } from "../../utils/formatters";
import Avatar from "../ui/Avatar";
import CommentThread from "./CommentThread";
import ImageLightbox from "./ImageLightbox";

export default function PostCard({ post, onToggleLike, onAddComment }) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [likePending, setLikePending] = useState(false);
  const [actionError, setActionError] = useState("");
  const [mediaFailed, setMediaFailed] = useState(false);
  const [imageOpen, setImageOpen] = useState(false);

  async function handleLike() {
    if (likePending) return;
    setLikePending(true);
    setActionError("");
    try {
      await onToggleLike(post.id);
    } catch (error) {
      setActionError(error.message || "The like could not be updated.");
    } finally {
      setLikePending(false);
    }
  }

  return (
    <article className="post-card">
      <header className="post-card__header">
        <Avatar name={post.username} src={post.avatarUrl} />
        <div>
          <h2>{post.username}</h2>
          <time dateTime={post.createdAt}>{formatPostTime(post.createdAt)}</time>
        </div>
      </header>

      {post.text ? <p className="post-card__text">{post.text}</p> : null}

      {post.imageUrl ? (
        mediaFailed ? (
          <div className="post-card__media-fallback" role="img" aria-label="Image could not be loaded">
            <ImageOff size={24} aria-hidden="true" />
            <span>Image couldn't be loaded.</span>
          </div>
        ) : (
          <div className="post-card__media">
            <button
              className="post-card__media-button"
              type="button"
              onClick={() => setImageOpen(true)}
              aria-label={`View full-size image shared by ${post.username}`}
            >
              <img
                src={post.imageUrl}
                alt={`Post shared by ${post.username}`}
                loading="lazy"
                decoding="async"
                onError={() => setMediaFailed(true)}
              />
              <span className="post-card__media-expand" aria-hidden="true">
                <Maximize2 size={16} />
                View full image
              </span>
            </button>
          </div>
        )
      ) : null}

      {imageOpen ? (
        <ImageLightbox
          imageUrl={post.imageUrl}
          username={post.username}
          onClose={() => setImageOpen(false)}
        />
      ) : null}

      <div className="post-card__summary" aria-label={`${post.likeCount} likes and ${post.commentCount} comments`}>
        <span>{post.likeCount} {post.likeCount === 1 ? "like" : "likes"}</span>
        <button type="button" onClick={() => setCommentsOpen((open) => !open)}>
          {post.commentCount} {post.commentCount === 1 ? "comment" : "comments"}
        </button>
      </div>

      <div className="post-card__actions">
        <button
          type="button"
          className={post.viewerHasLiked ? "is-active" : ""}
          aria-pressed={post.viewerHasLiked}
          onClick={handleLike}
          disabled={likePending}
        >
          {likePending ? <LoaderCircle className="spin" size={19} /> : <Heart size={19} fill={post.viewerHasLiked ? "currentColor" : "none"} />}
          {post.viewerHasLiked ? "Liked" : "Like"}
        </button>
        <button type="button" onClick={() => setCommentsOpen((open) => !open)} aria-expanded={commentsOpen}>
          <MessageCircle size={19} aria-hidden="true" />
          Comment
        </button>
      </div>

      {actionError ? <p className="post-card__action-error" role="alert">{actionError}</p> : null}

      {commentsOpen ? (
        <CommentThread
          comments={post.comments}
          inputId={`comment-${post.id}`}
          onAddComment={(comment) => onAddComment(post.id, comment)}
        />
      ) : null}
    </article>
  );
}
```

## frontend\src\components\posts\PostComposer.jsx

```jsx
import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Send, X } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getUserDisplayName } from "../../utils/formatters";
import Avatar from "../ui/Avatar";

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

const PostComposer = forwardRef(function PostComposer({ onCreate }, ref) {
  const { user } = useAuth();
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const [text, setText] = useState("");
  const [image, setImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useImperativeHandle(ref, () => ({
    focus() {
      textareaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => textareaRef.current?.focus(), 250);
    },
  }));

  useEffect(() => {
    if (!image) {
      setPreviewUrl("");
      return undefined;
    }
    const nextUrl = URL.createObjectURL(image);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [image]);

  function handleImage(event) {
    const file = event.target.files?.[0];
    setError("");
    if (!file) return;
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      event.target.value = "";
      return;
    }
    if (file.size > MAX_IMAGE_SIZE) {
      setError("Keep the image under 5 MB.");
      event.target.value = "";
      return;
    }
    setImage(file);
  }

  function removeImage() {
    setImage(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const trimmedText = text.trim();
    if (!trimmedText && !image) {
      setError("Add some text or choose an image before posting.");
      textareaRef.current?.focus();
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      await onCreate({ text: trimmedText, image });
      setText("");
      removeImage();
    } catch (requestError) {
      setError(requestError.message || "Your post could not be published. Your text is still here.");
    } finally {
      setSubmitting(false);
    }
  }

  const displayName = getUserDisplayName(user);

  return (
    <section className="composer" aria-labelledby="composer-title">
      <div className="composer__identity">
        <Avatar name={displayName} src={user?.avatarUrl || user?.avatar} />
        <div>
          <h2 id="composer-title">Share something</h2>
          <p>Text, an image, or both.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="post-text">What's on your mind?</label>
        <textarea
          ref={textareaRef}
          id="post-text"
          value={text}
          maxLength={600}
          onChange={(event) => {
            setText(event.target.value);
            setError("");
          }}
          placeholder="What's on your mind?"
          rows={3}
        />

        {previewUrl ? (
          <div className="composer__preview">
            <img src={previewUrl} alt="Selected upload preview" />
            <button type="button" onClick={removeImage} aria-label="Remove selected image">
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {error ? <p className="composer__error" role="alert">{error}</p> : null}

        <div className="composer__actions">
          <div>
            <input
              ref={fileInputRef}
              className="sr-only"
              id="post-image"
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              onChange={handleImage}
            />
            <label className="composer__media-button" htmlFor="post-image">
              <ImagePlus size={19} aria-hidden="true" />
              Add image
            </label>
            <span className="composer__counter">{text.length}/600</span>
          </div>
          <button
            className="button button--primary"
            type="submit"
            disabled={submitting || (!text.trim() && !image)}
          >
            {submitting ? <LoaderCircle className="spin" size={18} aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
            {submitting ? "Posting…" : "Post"}
          </button>
        </div>
      </form>
    </section>
  );
});

export default PostComposer;
```

## frontend\src\components\ui\Avatar.jsx

```jsx
import { getInitials } from "../../utils/formatters";

export default function Avatar({ name, src, size = "medium" }) {
  return (
    <span className={`avatar avatar--${size}`} aria-label={`${name || "User"} avatar`}>
      {src ? <img src={src} alt="" /> : <span>{getInitials(name)}</span>}
    </span>
  );
}

```

## frontend\src\components\ui\BrandMark.jsx

```jsx
export default function BrandMark({ compact = false }) {
  return (
    <div className={`brand-mark${compact ? " brand-mark--compact" : ""}`}>
      <span className="brand-mark__symbol" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="brand-mark__name">Mini Social</span>
    </div>
  );
}

```

## frontend\src\config\appMode.js

```javascript
const configuredMode = String(import.meta.env.VITE_APP_MODE || "real").toLowerCase();

export const APP_MODE = configuredMode === "demo" ? "demo" : "real";

export const DEMO_ACCOUNT = Object.freeze({
  username: "Demo Member",
  email: "demo@minisocial.app",
  password: "MiniSocial2026!",
});
```

## frontend\src\context\AuthContext.jsx

```jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { authApi } from "../services/authApi";
import { getApiMode } from "../services/apiClient";

const AuthContext = createContext(null);
let sessionBootstrap;

function loadCurrentSession() {
  if (!sessionBootstrap) {
    sessionBootstrap = authApi.me().finally(() => {
      sessionBootstrap = null;
    });
  }
  return sessionBootstrap;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState("checking");
  const [sessionError, setSessionError] = useState("");
  const apiMode = getApiMode();

  useEffect(() => {
    let active = true;

    loadCurrentSession()
      .then((currentUser) => {
        if (!active) return;
        setUser(currentUser);
        setStatus(currentUser ? "authenticated" : "anonymous");
      })
      .catch((error) => {
        if (!active) return;
        setUser(null);
        setStatus("anonymous");
        if (error.status !== 401) setSessionError(error.message || "The session could not be checked.");
      });

    return () => {
      active = false;
    };
  }, []);

  async function login(values) {
    setSessionError("");
    const response = await authApi.login(values);
    let nextUser = response.user;

    if (!nextUser) {
      nextUser = await authApi.me();
    }

    setUser(nextUser);
    setStatus("authenticated");
    return nextUser;
  }

  async function signup(values) {
    setSessionError("");
    const response = await authApi.signup(values);
    let nextUser = response.user;

    if (!nextUser) {
      try {
        nextUser = await authApi.me();
      } catch {
        nextUser = null;
      }
    }

    if (nextUser) {
      setUser(nextUser);
      setStatus("authenticated");
    }

    return nextUser;
  }

  async function logout() {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setStatus("anonymous");
    }
  }

  async function retrySession() {
    setStatus("checking");
    setSessionError("");
    try {
      const currentUser = await loadCurrentSession();
      setUser(currentUser);
      setStatus(currentUser ? "authenticated" : "anonymous");
    } catch (error) {
      setUser(null);
      setStatus("anonymous");
      if (error.status !== 401) setSessionError(error.message || "The session could not be checked.");
    }
  }

  const value = useMemo(
    () => ({ user, status, apiMode, sessionError, login, signup, logout, retrySession }),
    [user, status, apiMode, sessionError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
```

## frontend\src\hooks\useMentionAutocomplete.js

```javascript
import { useEffect, useRef, useState } from "react";
import { usersApi } from "../services/usersApi";
import { getMentionContext, mentionToken } from "../utils/mentions";

export function useMentionAutocomplete({ initialText = "", initialMentions = [] } = {}) {
  const inputRef = useRef(null);
  const [text, setText] = useState(initialText);
  const [selectedMentions, setSelectedMentions] = useState(initialMentions);
  const [context, setContext] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!context) {
      setSuggestions([]);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    const timeoutId = window.setTimeout(async () => {
      try {
        const users = await usersApi.search(context.query);
        if (active) {
          setSuggestions(users);
          setActiveIndex(0);
        }
      } catch {
        if (active) setSuggestions([]);
      } finally {
        if (active) setLoading(false);
      }
    }, 140);
    return () => {
      active = false;
      window.clearTimeout(timeoutId);
    };
  }, [context?.query]);

  function updateText(nextText, caret) {
    setText(nextText);
    setSelectedMentions((current) => current.filter((mention) => nextText.includes(mentionToken(mention.username))));
    setContext(getMentionContext(nextText, caret));
  }

  function handleChange(event) {
    updateText(event.target.value, event.target.selectionStart ?? event.target.value.length);
  }

  function selectMention(user) {
    if (!context || !user) return;
    const token = mentionToken(user.username);
    const nextText = `${text.slice(0, context.start)}${token} ${text.slice(context.end)}`;
    const nextCaret = context.start + token.length + 1;
    setText(nextText);
    setSelectedMentions((current) => (
      current.some((mention) => mention.id === user.id) ? current : [...current, user].slice(0, 8)
    ));
    setContext(null);
    setSuggestions([]);
    window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(nextCaret, nextCaret);
    });
  }

  function handleKeyDown(event) {
    if (!context) return;
    if (event.key === "Escape") {
      event.preventDefault();
      setContext(null);
      setSuggestions([]);
      return;
    }
    if (!suggestions.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((current) => (current + direction + suggestions.length) % suggestions.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectMention(suggestions[activeIndex]);
    }
  }

  function handleFocus(event) {
    setContext(getMentionContext(text, event.target.selectionStart ?? text.length));
  }

  function reset() {
    setText("");
    setSelectedMentions([]);
    setContext(null);
    setSuggestions([]);
  }

  return {
    inputRef,
    text,
    selectedMentions,
    suggestions,
    activeIndex,
    loading,
    open: Boolean(context),
    handleChange,
    handleFocus,
    handleKeyDown,
    selectMention,
    reset,
  };
}
```

## frontend\src\main.jsx

```jsx
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./context/AuthContext";
import "./styles/tokens.css";
import "./styles/globals.css";
import "./styles/components.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);

```

## frontend\src\pages\FeedPage.jsx

```jsx
import { useCallback, useEffect, useRef, useState } from "react";
import AppShell from "../components/layout/AppShell";
import FeedHeader from "../components/layout/FeedHeader";
import EmptyState from "../components/feedback/EmptyState";
import ErrorState from "../components/feedback/ErrorState";
import FeedSkeleton from "../components/feedback/FeedSkeleton";
import PostCard from "../components/posts/PostCard";
import PostComposer from "../components/posts/PostComposer";
import { useAuth } from "../context/AuthContext";
import { postsApi } from "../services/postsApi";

const PAGE_SIZE = 10;

export default function FeedPage() {
  const { user } = useAuth();
  const composerRef = useRef(null);
  const [posts, setPosts] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadFeed = useCallback(async ({ nextPage = 1, append = false } = {}) => {
    append ? setLoadingMore(true) : setLoading(true);
    setError("");
    try {
      const result = await postsApi.getPosts({ page: nextPage, limit: PAGE_SIZE });
      setPosts((current) => (append ? [...current, ...result.posts] : result.posts));
      setPage(nextPage);
      setHasMore(result.hasMore);
    } catch (requestError) {
      setError(requestError.message || "Couldn't load posts.");
    } finally {
      append ? setLoadingMore(false) : setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeed();
  }, [loadFeed]);

  function focusComposer() {
    composerRef.current?.focus();
  }

  async function handleCreatePost(values) {
    const createdPost = await postsApi.createPost(values);
    setPosts((current) => [createdPost, ...current]);
    setNotice("Your post is now live.");
    window.setTimeout(() => setNotice(""), 3000);
  }

  async function handleToggleLike(postId) {
    const previousPost = posts.find((post) => post.id === postId);
    if (!previousPost) return;

    setPosts((current) =>
      current.map((post) =>
        post.id === postId
          ? {
              ...post,
              viewerHasLiked: !post.viewerHasLiked,
              likeCount: Math.max(0, post.likeCount + (post.viewerHasLiked ? -1 : 1)),
            }
          : post,
      ),
    );

    try {
      const result = await postsApi.toggleLike(postId);
      if (result.post) {
        setPosts((current) => current.map((post) => (post.id === postId ? result.post : post)));
      }
    } catch (error) {
      setPosts((current) => current.map((post) => (post.id === postId ? previousPost : post)));
      throw error;
    }
  }

  async function handleAddComment(postId, comment) {
    const result = await postsApi.addComment(postId, comment);
    setPosts((current) =>
      current.map((post) => {
        if (post.id !== postId) return post;
        if (result.post) return result.post;
        if (result.comment) {
          return {
            ...post,
            comments: [...post.comments, result.comment],
            commentCount: post.commentCount + 1,
          };
        }
        return post;
      }),
    );
  }

  return (
    <AppShell onCompose={focusComposer}>
      <div className="feed-page">
        <FeedHeader onCompose={focusComposer} />
        <PostComposer ref={composerRef} onCreate={handleCreatePost} user={user} />

        {notice ? <div className="feed-notice" role="status">{notice}</div> : null}

        <section className="feed-list" aria-label="Community posts">
          {loading ? <FeedSkeleton /> : null}
          {!loading && error && !posts.length ? (
            <ErrorState title="Couldn't load the feed" message={error} onRetry={() => loadFeed()} />
          ) : null}
          {!loading && !error && !posts.length ? <EmptyState onCreate={focusComposer} /> : null}

          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onToggleLike={handleToggleLike}
              onAddComment={handleAddComment}
            />
          ))}

          {error && posts.length ? <p className="feed-list__inline-error" role="alert">{error}</p> : null}

          {hasMore ? (
            <button
              className="button button--secondary feed-list__load-more"
              type="button"
              disabled={loadingMore}
              onClick={() => loadFeed({ nextPage: page + 1, append: true })}
            >
              {loadingMore ? "Loading more…" : "Load more posts"}
            </button>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
```

## frontend\src\pages\LoginPage.jsx

```jsx
import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import PasswordField from "../components/auth/PasswordField";
import { DEMO_ACCOUNT } from "../config/appMode";
import { useAuth } from "../context/AuthContext";
import { firstInvalidField, validateLogin } from "../validation/authValidation";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, apiMode } = useAuth();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const [values, setValues] = useState({ email: "", password: "" });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: "" }));
    setError("");
  }

  function focusFirstError(nextErrors) {
    const field = firstInvalidField(nextErrors, ["email", "password"]);
    if (field === "email") emailRef.current?.focus();
    if (field === "password") passwordRef.current?.focus();
  }

  function validate() {
    const nextErrors = validateLogin(values);
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length) window.requestAnimationFrame(() => focusFirstError(nextErrors));
    return Object.keys(nextErrors).length === 0;
  }

  function validateField(field) {
    const nextError = validateLogin(values)[field] || "";
    setFieldErrors((current) => ({ ...current, [field]: nextError }));
  }

  function useDemoAccount() {
    setValues({ email: DEMO_ACCOUNT.email, password: DEMO_ACCOUNT.password });
    setFieldErrors({});
    setError("");
    passwordRef.current?.focus();
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    setError("");

    try {
      await login({ email: values.email.trim(), password: values.password });
      navigate("/feed", { replace: true });
    } catch (requestError) {
      const serverErrors = requestError.details?.fieldErrors || {};
      if (Object.keys(serverErrors).length) {
        setFieldErrors(serverErrors);
        window.requestAnimationFrame(() => focusFirstError(serverErrors));
      }
      setError(requestError.message || "Unable to log in. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Welcome back"
      title="Continue the conversation"
      description="Log in with the account you created for Mini Social."
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {error ? <div className="form-alert" role="alert">{error}</div> : null}

        {apiMode === "demo" ? (
          <button className="demo-credentials" type="button" onClick={useDemoAccount}>
            Use the verified demo account
            <span>{DEMO_ACCOUNT.email}</span>
          </button>
        ) : null}

        <div className={`field${fieldErrors.email ? " field--error" : ""}`}>
          <label htmlFor="email">Email address</label>
          <input
            ref={emailRef}
            id="email"
            name="email"
            type="email"
            value={values.email}
            onChange={updateField}
            placeholder="you@example.com"
            autoComplete="email"
            maxLength={254}
            onBlur={() => validateField("email")}
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? "login-email-error" : undefined}
            required
          />
          {fieldErrors.email ? (
            <p className="field__error" id="login-email-error">{fieldErrors.email}</p>
          ) : null}
        </div>

        <PasswordField
          id="password"
          label="Password"
          value={values.password}
          onChange={updateField}
          error={fieldErrors.password}
          autoComplete="current-password"
          inputRef={passwordRef}
          minLength={1}
          onBlur={() => validateField("password")}
        />

        <button className="button button--primary button--wide" type="submit" disabled={submitting}>
          {submitting ? "Logging in…" : "Log in"}
          {!submitting ? <ArrowRight size={18} aria-hidden="true" /> : null}
        </button>
      </form>

      <p className="auth-card__switch">
        New to Mini Social? <Link to="/signup">Create an account</Link>
      </p>
    </AuthLayout>
  );
}
```

## frontend\src\pages\SignupPage.jsx

```jsx
import { useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AuthLayout from "../components/auth/AuthLayout";
import PasswordField from "../components/auth/PasswordField";
import { useAuth } from "../context/AuthContext";
import { AUTH_RULES, firstInvalidField, validateSignup } from "../validation/authValidation";

export default function SignupPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const fieldRefs = {
    username: useRef(null),
    email: useRef(null),
    password: useRef(null),
    confirmPassword: useRef(null),
  };
  const [values, setValues] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [errors, setErrors] = useState({});
  const [requestError, setRequestError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function updateField(event) {
    const { name, value } = event.target;
    setValues((current) => ({ ...current, [name]: value }));
    setErrors((current) => ({ ...current, [name]: "" }));
    setRequestError("");
  }

  function focusFirstError(nextErrors) {
    const field = firstInvalidField(nextErrors, ["username", "email", "password", "confirmPassword"]);
    fieldRefs[field]?.current?.focus();
  }

  function validate() {
    const nextErrors = validateSignup(values);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) window.requestAnimationFrame(() => focusFirstError(nextErrors));
    return Object.keys(nextErrors).length === 0;
  }

  function validateField(field) {
    const nextError = validateSignup(values)[field] || "";
    setErrors((current) => ({ ...current, [field]: nextError }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    setRequestError("");
    try {
      const user = await signup({
        username: values.username.trim(),
        email: values.email.trim(),
        password: values.password,
      });
      navigate(user ? "/feed" : "/login", { replace: true });
    } catch (error) {
      const serverErrors = error.details?.fieldErrors || {};
      if (Object.keys(serverErrors).length) {
        setErrors(serverErrors);
        window.requestAnimationFrame(() => focusFirstError(serverErrors));
      }
      setRequestError(error.message || "Unable to create your account.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      eyebrow="Join Mini Social"
      title="Create your community profile"
      description="A username, email, and password are all you need to begin."
    >
      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        {requestError ? <div className="form-alert" role="alert">{requestError}</div> : null}

        <div className={`field${errors.username ? " field--error" : ""}`}>
          <label htmlFor="username">Username</label>
          <input
            ref={fieldRefs.username}
            id="username"
            name="username"
            value={values.username}
            onChange={updateField}
            placeholder="How others will know you"
            autoComplete="username"
            minLength={AUTH_RULES.usernameMin}
            maxLength={AUTH_RULES.usernameMax}
            onBlur={() => validateField("username")}
            aria-invalid={Boolean(errors.username)}
            aria-describedby={errors.username ? "username-error" : undefined}
            required
          />
          {errors.username ? <p className="field__error" id="username-error">{errors.username}</p> : null}
        </div>

        <div className={`field${errors.email ? " field--error" : ""}`}>
          <label htmlFor="email">Email address</label>
          <input
            ref={fieldRefs.email}
            id="email"
            name="email"
            type="email"
            value={values.email}
            onChange={updateField}
            placeholder="you@example.com"
            autoComplete="email"
            maxLength={254}
            onBlur={() => validateField("email")}
            aria-invalid={Boolean(errors.email)}
            aria-describedby={errors.email ? "email-error" : undefined}
            required
          />
          {errors.email ? <p className="field__error" id="email-error">{errors.email}</p> : null}
        </div>

        <div className="auth-form__password-grid">
          <PasswordField
            id="password"
            label="Password"
            value={values.password}
            onChange={updateField}
            error={errors.password}
            autoComplete="new-password"
            inputRef={fieldRefs.password}
            helper="Use 8–64 characters with at least one letter and one number."
            onBlur={() => validateField("password")}
          />
          <PasswordField
            id="confirmPassword"
            label="Confirm password"
            value={values.confirmPassword}
            onChange={updateField}
            error={errors.confirmPassword}
            autoComplete="new-password"
            inputRef={fieldRefs.confirmPassword}
            onBlur={() => validateField("confirmPassword")}
          />
        </div>

        <button className="button button--primary button--wide" type="submit" disabled={submitting}>
          {submitting ? "Creating account…" : "Create account"}
          {!submitting ? <ArrowRight size={18} aria-hidden="true" /> : null}
        </button>
      </form>

      <p className="auth-card__switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </AuthLayout>
  );
}
```

## frontend\src\services\apiClient.js

```javascript
import { APP_MODE } from "../config/appMode";
import { demoApiRequest, DemoApiError } from "./demoApi";

const DEFAULT_API_BASE_URL = "http://localhost:5000/api";
const REQUEST_TIMEOUT_MS = 8000;

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

export function getApiMode() {
  return APP_MODE;
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
  if (APP_MODE === "demo") {
    return requestFromDemo(path, options);
  }

  const { body, headers = {}, ...requestOptions } = options;
  const isFormData = body instanceof FormData;
  const requestHeaders = {
    Accept: "application/json",
    ...(!isFormData && body ? { "Content-Type": "application/json" } : {}),
    ...headers,
  };

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: "include",
      ...requestOptions,
      signal: controller.signal,
      headers: requestHeaders,
      body: isFormData || typeof body === "string" ? body : body ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    throw new ApiError(
      networkError.name === "AbortError"
        ? "The server took too long to respond. Please try again."
        : "Mini Social cannot reach the server. Start the API and database, then try again.",
      0,
      { cause: networkError.name || "NetworkError" },
    );
  } finally {
    window.clearTimeout(timeoutId);
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

async function requestFromDemo(path, options) {
  try {
    return await demoApiRequest(path, options);
  } catch (error) {
    if (error instanceof DemoApiError) {
      throw new ApiError(error.message, error.status, error.details);
    }
    throw error;
  }
}
```

## frontend\src\services\authApi.js

```javascript
import { apiRequest, unwrapData } from "./apiClient";

function normalizeAuthResponse(payload) {
  const body = unwrapData(payload) || {};
  const user = body.user || body.account || payload?.user || null;
  const token = body.token || body.accessToken || payload?.token || null;

  return { user, token, raw: body };
}

export const authApi = {
  async signup(values) {
    return normalizeAuthResponse(
      await apiRequest("/auth/signup", {
        method: "POST",
        body: values,
      }),
    );
  },

  async login(values) {
    return normalizeAuthResponse(
      await apiRequest("/auth/login", {
        method: "POST",
        body: values,
      }),
    );
  },

  async me() {
    const body = unwrapData(await apiRequest("/auth/me"));
    return body?.user || body?.account || body;
  },

  async logout() {
    await apiRequest("/auth/logout", { method: "POST" });
  },
};
```

## frontend\src\services\demoApi.js

```javascript
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
```

## frontend\src\services\postsApi.js

```javascript
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
```

## frontend\src\services\usersApi.js

```javascript
import { apiRequest, unwrapData } from "./apiClient";

export const usersApi = {
  async search(query = "") {
    const params = new URLSearchParams({ query: String(query), limit: "8" });
    const payload = unwrapData(await apiRequest(`/users?${params.toString()}`)) || {};
    const users = Array.isArray(payload) ? payload : payload.users || [];
    return users.map((user) => ({
      id: String(user.id || user._id),
      username: user.username,
    }));
  },
};
```

## frontend\src\styles\components.css

```css
/* Brand and identity */

.brand-mark {
  display: inline-flex;
  align-items: center;
  gap: 0.72rem;
  color: var(--color-text);
  font-weight: 780;
  letter-spacing: -0.035em;
}

.brand-mark__symbol {
  width: 38px;
  height: 38px;
  display: inline-flex;
  align-items: flex-end;
  justify-content: center;
  gap: 3px;
  padding: 9px 8px;
  color: #211013;
  background: var(--color-accent);
  border-radius: 11px;
}

.brand-mark__symbol span {
  width: 4px;
  background: currentColor;
  border-radius: var(--radius-pill);
}

.brand-mark__symbol span:nth-child(1) { height: 45%; }
.brand-mark__symbol span:nth-child(2) { height: 85%; }
.brand-mark__symbol span:nth-child(3) { height: 62%; }

.brand-mark__name {
  font-size: 1.04rem;
}

.brand-mark--compact .brand-mark__symbol {
  width: 34px;
  height: 34px;
  padding: 8px 7px;
  border-radius: 10px;
}

.brand-mark--compact .brand-mark__name {
  font-size: 0.95rem;
}

.avatar {
  flex: 0 0 auto;
  display: inline-grid;
  place-items: center;
  overflow: hidden;
  color: var(--color-support);
  background: var(--color-support-soft);
  border: 1px solid rgb(119 203 187 / 0.22);
  border-radius: 50%;
  font-size: 0.76rem;
  font-weight: 780;
}

.avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar--small { width: 32px; height: 32px; font-size: 0.65rem; }
.avatar--medium { width: 42px; height: 42px; }
.avatar--large { width: 56px; height: 56px; font-size: 0.9rem; }

/* Authentication */

.auth-layout {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--color-bg);
}

.auth-story {
  display: none;
}

.auth-panel {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: max(1.5rem, env(safe-area-inset-top)) 1.25rem max(2rem, env(safe-area-inset-bottom));
}

.auth-panel__mobile-brand,
.auth-card {
  width: min(100%, 470px);
  margin-inline: auto;
}

.auth-panel__mobile-brand {
  margin-bottom: var(--space-10);
}

.auth-card {
  padding: 0;
}

.auth-card h2 {
  max-width: 14ch;
  margin-bottom: var(--space-3);
  font-size: clamp(1.9rem, 9vw, 2.4rem);
  line-height: 1.05;
  letter-spacing: -0.045em;
}

.auth-card__description {
  max-width: 43ch;
  margin-bottom: var(--space-6);
  color: var(--color-text-secondary);
  font-size: 0.94rem;
}

.environment-note {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  margin: calc(var(--space-2) * -1) 0 var(--space-5);
  padding: var(--space-3);
  color: var(--color-support);
  background: var(--color-support-soft);
  border: 1px solid rgb(119 203 187 / 0.2);
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
}

.environment-note > svg {
  flex: 0 0 auto;
  margin-top: 0.1rem;
}

.environment-note span,
.environment-note strong {
  display: block;
}

.environment-note strong {
  margin-bottom: 0.12rem;
  color: var(--color-text);
}

.environment-note--error {
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border-color: rgb(255 133 139 / 0.18);
}

.environment-note--error button {
  min-height: 32px;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  margin-top: var(--space-2);
  padding: 0.35rem 0.55rem;
  color: var(--color-text);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-xs);
  cursor: pointer;
}

.auth-form {
  display: grid;
  gap: var(--space-5);
}

.demo-credentials {
  width: 100%;
  min-height: 46px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: 0.65rem 0.75rem;
  color: var(--color-text-secondary);
  background: var(--color-surface-muted);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-size: 0.77rem;
  font-weight: 680;
  text-align: left;
  cursor: pointer;
}

.demo-credentials span {
  color: var(--color-support);
  font-size: 0.7rem;
  font-weight: 560;
}

.demo-credentials:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
  border-color: var(--color-border-strong);
}

.auth-form__password-grid {
  display: grid;
  gap: var(--space-5);
}

.field label {
  display: block;
  margin-bottom: 0.45rem;
  color: var(--color-text-secondary);
  font-size: 0.78rem;
  font-weight: 680;
}

.field input,
.comment-thread__form input,
.composer textarea {
  width: 100%;
  color: var(--color-text);
  background: var(--color-surface-raised);
  border: 1px solid var(--color-border);
  outline: 0;
  transition:
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    box-shadow var(--transition-fast);
}

.field input {
  min-height: 48px;
  padding: 0.75rem 0.85rem;
  border-radius: var(--radius-sm);
}

.field input::placeholder,
.comment-thread__form input::placeholder,
.composer textarea::placeholder {
  color: var(--color-text-subtle);
}

.field input:focus,
.comment-thread__form input:focus,
.composer textarea:focus {
  background: var(--color-surface-hover);
  border-color: var(--color-focus);
  box-shadow: 0 0 0 3px rgb(156 188 248 / 0.12);
}

.field--error input {
  border-color: var(--color-danger);
}

.field__error,
.composer__error,
.comment-thread__error,
.post-card__action-error {
  margin: var(--space-2) 0 0;
  color: var(--color-danger);
  font-size: 0.76rem;
}

.field__helper {
  margin: var(--space-2) 0 0;
  color: var(--color-text-subtle);
  font-size: 0.72rem;
  line-height: 1.4;
}

.password-field {
  position: relative;
}

.password-field input {
  padding-right: 3.2rem;
}

.password-field__toggle {
  width: 42px;
  height: 42px;
  position: absolute;
  right: 3px;
  top: 3px;
  display: grid;
  place-items: center;
  padding: 0;
  color: var(--color-text-secondary);
  background: transparent;
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}

.password-field__toggle:hover {
  color: var(--color-text);
  background: var(--color-surface-muted);
}

.form-alert {
  padding: var(--space-3) var(--space-4);
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border: 1px solid rgb(255 133 139 / 0.18);
  border-radius: var(--radius-sm);
  font-size: 0.82rem;
}

.auth-card__switch {
  margin: var(--space-6) 0 0;
  color: var(--color-text-secondary);
  font-size: 0.88rem;
  text-align: center;
}

.auth-card__switch a {
  font-weight: 720;
}

/* Shared loading and state panels */

.loading-screen {
  min-height: 100vh;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--space-4);
  padding: var(--space-6);
  color: var(--color-text-secondary);
  background: var(--color-bg);
}

.loading-screen p {
  margin-bottom: 0;
  font-size: 0.88rem;
}

.loading-screen__pulse {
  width: 68px;
  height: 3px;
  overflow: hidden;
  position: relative;
  background: var(--color-border);
  border-radius: var(--radius-pill);
}

.loading-screen__pulse::after {
  content: "";
  width: 28px;
  height: 100%;
  position: absolute;
  left: -28px;
  background: var(--color-accent);
  animation: loading-slide 900ms ease-in-out infinite;
}

@keyframes loading-slide {
  to { left: 68px; }
}

.state-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-inline: var(--space-3);
  padding: var(--space-12) var(--space-6);
  text-align: center;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.state-panel__icon {
  width: 46px;
  height: 46px;
  display: grid;
  place-items: center;
  margin-bottom: var(--space-4);
  color: var(--color-support);
  background: var(--color-support-soft);
  border-radius: 50%;
  font-size: 1.15rem;
  font-weight: 800;
}

.state-panel--error .state-panel__icon {
  color: var(--color-danger);
  background: var(--color-danger-soft);
}

.state-panel h2 {
  margin-bottom: var(--space-2);
  font-size: 1.1rem;
}

.state-panel p {
  max-width: 40ch;
  margin-bottom: var(--space-5);
  color: var(--color-text-secondary);
  font-size: 0.86rem;
}

/* Application shell and navigation */

.app-shell {
  min-height: 100vh;
  min-height: 100dvh;
}

.app-shell__main {
  width: 100%;
  min-width: 0;
  max-width: 700px;
  margin-inline: auto;
}

.desktop-nav,
.context-rail {
  display: none;
}

.mobile-nav {
  min-height: 66px;
  position: fixed;
  z-index: 30;
  right: 0;
  bottom: 0;
  left: 0;
  display: grid;
  grid-template-columns: 1fr 84px 1fr;
  align-items: center;
  padding: 0 max(1rem, env(safe-area-inset-right)) env(safe-area-inset-bottom) max(1rem, env(safe-area-inset-left));
  background: rgb(13 17 23 / 0.92);
  border-top: 1px solid var(--color-border);
  box-shadow: 0 -10px 32px rgb(0 0 0 / 0.2);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
}

.mobile-nav__item {
  min-width: 64px;
  min-height: 54px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.16rem;
  justify-self: center;
  padding: 0;
  color: var(--color-text-subtle);
  background: transparent;
  border: 0;
  cursor: pointer;
  font-size: 0.62rem;
  font-weight: 700;
  text-decoration: none;
}

.mobile-nav__item--active {
  color: var(--color-text);
}

.mobile-nav__item--active svg {
  color: var(--color-accent);
}

.mobile-nav__compose {
  width: 50px;
  height: 50px;
  display: grid;
  place-items: center;
  justify-self: center;
  transform: translateY(-8px);
  color: #211013;
  background: var(--color-accent);
  border: 4px solid var(--color-bg);
  border-radius: 50%;
  cursor: pointer;
  transition: transform var(--transition-fast), background-color var(--transition-fast);
}

.mobile-nav__compose:active {
  transform: translateY(-8px) scale(0.95);
}

/* Feed */

.feed-page {
  padding-bottom: calc(6rem + env(safe-area-inset-bottom));
}

.feed-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  padding: var(--space-4) var(--space-4) var(--space-6);
}

.feed-header__mobile-brand {
  order: 1;
}

.feed-header__copy {
  width: 100%;
  order: 3;
  padding-top: var(--space-5);
}

.feed-header__copy h1 {
  margin-bottom: var(--space-2);
  font-size: clamp(1.8rem, 9vw, 2.35rem);
  line-height: 1.02;
  letter-spacing: -0.05em;
}

.feed-header__copy > p:last-child {
  max-width: 44ch;
  margin-bottom: 0;
  color: var(--color-text-secondary);
  font-size: 0.9rem;
}

.feed-header__controls {
  order: 2;
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.feed-header__action {
  min-height: 42px;
  padding: 0.6rem 0.72rem;
  font-size: 0.78rem;
}

.mode-badge {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.55rem;
  color: var(--color-support);
  background: var(--color-support-soft);
  border: 1px solid rgb(119 203 187 / 0.18);
  border-radius: var(--radius-pill);
  font-size: 0.65rem;
  font-weight: 720;
}

.composer,
.post-card {
  margin-inline: var(--space-3);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
}

.composer {
  padding: var(--space-4);
}

.composer__identity {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-4);
}

.composer__identity h2 {
  margin-bottom: 0.08rem;
  font-size: 0.94rem;
}

.composer__identity p {
  margin-bottom: 0;
  color: var(--color-text-secondary);
  font-size: 0.75rem;
}

.composer textarea {
  min-height: 104px;
  display: block;
  resize: vertical;
  padding: var(--space-4);
  border-radius: var(--radius-md);
  line-height: 1.5;
}

.composer__preview {
  position: relative;
  overflow: hidden;
  margin-top: var(--space-4);
  background: var(--color-bg-deep);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  animation: content-enter 180ms ease-out both;
}

.composer__preview img {
  width: 100%;
  max-height: 420px;
  object-fit: contain;
}

.composer__preview button {
  width: 42px;
  height: 42px;
  position: absolute;
  right: var(--space-3);
  top: var(--space-3);
  display: grid;
  place-items: center;
  color: var(--color-text);
  background: rgb(9 12 17 / 0.84);
  border: 1px solid rgb(255 255 255 / 0.12);
  border-radius: 50%;
  cursor: pointer;
}

.composer__actions,
.composer__actions > div {
  display: flex;
  align-items: center;
}

.composer__actions {
  justify-content: space-between;
  gap: var(--space-3);
  margin-top: var(--space-4);
}

.composer__actions > div {
  min-width: 0;
  gap: var(--space-2);
}

.composer__media-button {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  padding: 0.55rem 0.7rem;
  color: var(--color-support);
  background: var(--color-support-soft);
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 720;
  white-space: nowrap;
}

.composer__media-button:hover {
  border-color: rgb(119 203 187 / 0.2);
}

.composer__counter {
  color: var(--color-text-subtle);
  font-size: 0.68rem;
  font-variant-numeric: tabular-nums;
}

.feed-notice {
  margin: var(--space-3) var(--space-3) 0;
  padding: var(--space-3) var(--space-4);
  color: var(--color-success);
  background: var(--color-success-soft);
  border: 1px solid rgb(114 211 161 / 0.18);
  border-radius: var(--radius-sm);
  font-size: 0.8rem;
  font-weight: 680;
  animation: content-enter 180ms ease-out both;
}

.feed-list {
  display: grid;
  gap: var(--space-3);
  margin-top: var(--space-3);
}

.post-card {
  overflow: hidden;
  padding: var(--space-4);
  transition: border-color var(--transition-base), background-color var(--transition-base);
}

.post-card:hover {
  border-color: var(--color-border-strong);
}

.post-card__header {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.post-card__header h2 {
  margin-bottom: 0;
  font-size: 0.9rem;
  letter-spacing: -0.01em;
}

.post-card__header time {
  display: block;
  margin-top: 0.08rem;
  color: var(--color-text-subtle);
  font-size: 0.7rem;
}

.post-card__text {
  margin: var(--space-4) 0 0;
  color: #e7ebf1;
  font-size: 0.94rem;
  line-height: 1.58;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.post-card__media,
.post-card__media-fallback {
  margin: var(--space-4) calc(var(--space-4) * -1) 0;
  background: var(--color-bg-deep);
  border-block: 1px solid var(--color-border);
}

.post-card__media-button {
  width: 100%;
  position: relative;
  display: block;
  padding: 0;
  color: var(--color-text);
  background: transparent;
  border: 0;
  cursor: zoom-in;
  overflow: hidden;
}

.post-card__media-button img {
  width: 100%;
  max-height: 620px;
  object-fit: cover;
  transition: transform var(--transition-medium);
}

.post-card__media-expand {
  min-height: 34px;
  position: absolute;
  right: var(--space-3);
  bottom: var(--space-3);
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.4rem 0.58rem;
  color: #fff;
  background: rgb(6 9 13 / 0.78);
  border: 1px solid rgb(255 255 255 / 0.16);
  border-radius: var(--radius-pill);
  box-shadow: var(--shadow-sm);
  font-size: 0.67rem;
  font-weight: 700;
  backdrop-filter: blur(8px);
}

.post-card__media-button:hover img {
  transform: scale(1.01);
}

.post-card__media-button:focus-visible {
  outline: 3px solid var(--color-focus);
  outline-offset: -3px;
}

.post-card__media-fallback {
  min-height: 210px;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: var(--space-3);
  color: var(--color-text-secondary);
  font-size: 0.8rem;
}

.image-lightbox {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: grid;
  place-items: center;
  padding:
    max(var(--space-4), env(safe-area-inset-top))
    max(var(--space-4), env(safe-area-inset-right))
    max(var(--space-4), env(safe-area-inset-bottom))
    max(var(--space-4), env(safe-area-inset-left));
  background: rgb(3 6 10 / 0.94);
  backdrop-filter: blur(10px);
  animation: lightbox-in var(--transition-medium) both;
}

.image-lightbox__content {
  width: min(100%, 1500px);
  height: calc(100dvh - 2 * var(--space-6));
  display: grid;
  grid-template-rows: minmax(0, 1fr) auto;
  justify-items: center;
  gap: var(--space-3);
  margin: 0;
}

.image-lightbox__content img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: var(--radius-sm);
  box-shadow: 0 24px 70px rgb(0 0 0 / 0.52);
}

.image-lightbox__content figcaption {
  color: rgb(231 235 241 / 0.78);
  font-size: 0.76rem;
}

.image-lightbox__close {
  width: 44px;
  height: 44px;
  position: fixed;
  top: max(var(--space-4), env(safe-area-inset-top));
  right: max(var(--space-4), env(safe-area-inset-right));
  z-index: 1;
  display: grid;
  place-items: center;
  padding: 0;
  color: #fff;
  background: rgb(22 28 38 / 0.88);
  border: 1px solid rgb(255 255 255 / 0.18);
  border-radius: 50%;
  cursor: pointer;
}

.image-lightbox__close:hover {
  background: rgb(40 48 61 / 0.94);
}

@keyframes lightbox-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

.post-card__summary {
  display: flex;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-4) 0 var(--space-3);
  color: var(--color-text-subtle);
  border-bottom: 1px solid var(--color-border);
  font-size: 0.74rem;
  font-variant-numeric: tabular-nums;
}

.post-card__summary button {
  padding: 0;
  color: inherit;
  background: transparent;
  border: 0;
  cursor: pointer;
}

.post-card__summary button:hover {
  color: var(--color-text-secondary);
}

.post-card__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2);
  padding-top: var(--space-2);
}

.post-card__actions button {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  color: var(--color-text-secondary);
  background: transparent;
  border: 0;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-size: 0.79rem;
  font-weight: 680;
  transition: color var(--transition-fast), background-color var(--transition-fast), transform var(--transition-fast);
}

.post-card__actions button:hover:not(:disabled) {
  color: var(--color-text);
  background: var(--color-surface-muted);
}

.post-card__actions button:active:not(:disabled) {
  transform: scale(0.97);
}

.post-card__actions button.is-active {
  color: var(--color-accent);
  background: var(--color-accent-soft);
}

.post-card__actions button.is-active svg:not(.spin) {
  animation: like-pop 180ms ease-out;
}

@keyframes like-pop {
  50% { transform: scale(1.14); }
}

.comment-thread {
  margin-top: var(--space-3);
  padding-top: var(--space-4);
  border-top: 1px solid var(--color-border);
  animation: content-enter 170ms ease-out both;
}

.comment-thread__list {
  display: grid;
  gap: var(--space-4);
}

.comment-thread__conversation,
.comment-thread__item {
  min-width: 0;
  display: grid;
  gap: var(--space-2);
}

.comment {
  min-width: 0;
  display: flex;
  align-items: flex-start;
  gap: var(--space-2);
}

.comment--reply {
  position: relative;
  margin-left: 2rem;
}

.comment--reply::before {
  content: "";
  width: 1.05rem;
  height: 1.15rem;
  position: absolute;
  top: 0;
  left: -1.45rem;
  border-bottom: 1px solid var(--color-border-strong);
  border-left: 1px solid var(--color-border-strong);
  border-bottom-left-radius: 0.55rem;
}

.comment__content {
  min-width: 0;
  flex: 1;
}

.comment__body {
  min-width: 0;
  padding: 0.72rem 0.8rem;
  background: var(--color-surface-raised);
  border: 1px solid rgb(255 255 255 / 0.025);
  border-radius: 0 var(--radius-sm) var(--radius-sm) var(--radius-sm);
}

.comment__body > div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
}

.comment__body strong {
  font-size: 0.75rem;
}

.comment__body time {
  flex: 0 0 auto;
  color: var(--color-text-subtle);
  font-size: 0.62rem;
}

.comment__body p {
  margin: 0.2rem 0 0;
  color: #dfe4eb;
  font-size: 0.8rem;
  line-height: 1.46;
  overflow-wrap: anywhere;
}

.comment__reply-context {
  display: block;
  margin-top: 0.24rem;
  color: var(--color-text-subtle);
  font-size: 0.66rem;
}

.mention {
  color: var(--color-support);
  font-weight: 680;
}

.comment__reply-action {
  min-height: 36px;
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  margin-top: 0.08rem;
  padding: 0.3rem 0.5rem;
  color: var(--color-text-subtle);
  background: transparent;
  border: 0;
  border-radius: var(--radius-xs);
  cursor: pointer;
  font-size: 0.68rem;
  font-weight: 700;
}

.comment__reply-action:hover {
  color: var(--color-support);
  background: var(--color-support-soft);
}

.comment-thread__empty {
  margin-bottom: var(--space-3);
  color: var(--color-text-secondary);
  font-size: 0.79rem;
  text-align: center;
}

.comment-thread__form {
  position: relative;
  margin-top: var(--space-4);
}

.comment-composer--reply {
  margin-left: 2rem;
}

.comment-composer--reply .comment-thread__form {
  margin-top: var(--space-2);
}

.comment-composer__context {
  min-height: 32px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2);
  padding: 0.25rem 0.3rem 0.25rem 0.7rem;
  color: var(--color-text-subtle);
  background: var(--color-surface-raised);
  border-left: 2px solid var(--color-support);
  border-radius: var(--radius-xs);
  font-size: 0.68rem;
}

.comment-composer__context strong {
  color: var(--color-support);
}

.comment-composer__context button {
  width: 30px;
  height: 30px;
  display: grid;
  place-items: center;
  padding: 0;
  color: var(--color-text-subtle);
  background: transparent;
  border: 0;
  border-radius: var(--radius-xs);
  cursor: pointer;
}

.comment-composer__context button:hover {
  color: var(--color-text);
  background: var(--color-surface-hover);
}

.comment-thread__form input {
  min-height: 46px;
  padding: 0.7rem 3.2rem 0.7rem 0.82rem;
  border-radius: var(--radius-sm);
}

.comment-thread__send {
  width: 40px;
  height: 40px;
  position: absolute;
  right: 3px;
  top: 3px;
  display: grid;
  place-items: center;
  color: #211013;
  background: var(--color-accent);
  border: 0;
  border-radius: 10px;
  cursor: pointer;
}

.comment-thread__send:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.mention-suggestions {
  width: min(100%, 330px);
  max-height: 236px;
  position: absolute;
  bottom: calc(100% + 0.4rem);
  left: 0;
  z-index: 20;
  overflow-y: auto;
  padding: var(--space-2);
  background: #19212c;
  border: 1px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  box-shadow: var(--shadow-md);
  animation: content-enter var(--transition-fast) both;
}

.mention-suggestions button {
  width: 100%;
  min-height: 48px;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  grid-template-rows: auto auto;
  align-items: center;
  column-gap: var(--space-2);
  padding: 0.45rem 0.55rem;
  color: var(--color-text);
  background: transparent;
  border: 0;
  border-radius: var(--radius-xs);
  cursor: pointer;
  text-align: left;
}

.mention-suggestions button:hover,
.mention-suggestions button.is-active {
  background: var(--color-surface-hover);
}

.mention-suggestions .avatar {
  grid-row: 1 / 3;
}

.mention-suggestions button span:not(.avatar) {
  min-width: 0;
  overflow: hidden;
  font-size: 0.75rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mention-suggestions button small {
  min-width: 0;
  overflow: hidden;
  color: var(--color-text-subtle);
  font-size: 0.65rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.mention-suggestions__status {
  margin: 0;
  padding: 0.65rem;
  color: var(--color-text-secondary);
  font-size: 0.72rem;
  text-align: center;
}

.comment-thread__error {
  margin: var(--space-2) 0 0;
  color: var(--color-danger);
  font-size: 0.7rem;
}

@media (max-width: 420px) {
  .comment--reply,
  .comment-composer--reply {
    margin-left: 1.45rem;
  }

  .comment--reply::before {
    left: -1.1rem;
    width: 0.75rem;
  }

  .mention-suggestions {
    width: 100%;
  }
}

.feed-list__inline-error {
  margin: 0 var(--space-3);
  padding: var(--space-3) var(--space-4);
  color: var(--color-danger);
  background: var(--color-danger-soft);
  border: 1px solid rgb(255 133 139 / 0.16);
  border-radius: var(--radius-sm);
  font-size: 0.78rem;
  text-align: center;
}

.feed-list__load-more {
  justify-self: center;
}

@keyframes content-enter {
  from {
    opacity: 0;
    transform: translateY(5px);
  }
}

/* Skeletons */

.feed-skeleton {
  display: grid;
  gap: var(--space-3);
}

.post-card--skeleton {
  display: grid;
  gap: var(--space-3);
}

.skeleton-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  margin-bottom: var(--space-2);
}

.skeleton {
  display: block;
  overflow: hidden;
  position: relative;
  background: var(--color-surface-muted);
}

.skeleton::after {
  content: "";
  width: 45%;
  height: 100%;
  position: absolute;
  inset-block: 0;
  left: -50%;
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.055), transparent);
  animation: skeleton-shimmer 1.2s ease-in-out infinite;
}

.skeleton--avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
}

.skeleton--line {
  width: 100%;
  height: 11px;
  border-radius: var(--radius-pill);
}

.skeleton--line-short { width: 28%; }
.skeleton--line-medium { width: 68%; }

.skeleton--media {
  height: 250px;
  margin: var(--space-2) calc(var(--space-4) * -1) calc(var(--space-4) * -1);
}

@keyframes skeleton-shimmer {
  to { left: 110%; }
}

/* Progressive enhancement */

@media (min-width: 560px) {
  .auth-panel {
    padding-inline: var(--space-8);
  }

  .auth-form__password-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-4);
  }

  .feed-header,
  .composer,
  .post-card,
  .feed-notice,
  .state-panel,
  .feed-list__inline-error {
    margin-inline: var(--space-5);
  }

  .feed-header {
    padding-inline: var(--space-5);
  }
}

@media (min-width: 768px) {
  .app-shell {
    padding: var(--space-6);
  }

  .feed-page {
    padding-bottom: 5.5rem;
  }

  .feed-header,
  .composer,
  .post-card,
  .feed-notice,
  .state-panel,
  .feed-list__inline-error {
    margin-inline: 0;
  }

  .feed-header {
    padding: var(--space-3) 0 var(--space-6);
  }

  .composer,
  .post-card {
    padding: var(--space-5);
  }

  .post-card__media,
  .post-card__media-fallback,
  .skeleton--media {
    margin-inline: calc(var(--space-5) * -1);
  }

  .skeleton--media {
    margin-bottom: calc(var(--space-5) * -1);
  }
}

@media (min-width: 861px) {
  .auth-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(400px, 1fr);
  }

  .auth-story {
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    padding: clamp(2rem, 5vw, 5rem);
    background:
      linear-gradient(rgb(255 255 255 / 0.025) 1px, transparent 1px),
      linear-gradient(90deg, rgb(255 255 255 / 0.025) 1px, transparent 1px),
      #111720;
    background-size: 40px 40px;
    border-right: 1px solid var(--color-border);
  }

  .auth-story__message {
    max-width: 680px;
    margin-block: auto;
  }

  .auth-story__message h1 {
    max-width: 13ch;
    margin-bottom: var(--space-6);
    font-size: clamp(2.7rem, 5vw, 4.8rem);
    line-height: 0.98;
    letter-spacing: -0.06em;
  }

  .auth-story__message > p:last-child {
    max-width: 54ch;
    margin-bottom: 0;
    color: var(--color-text-secondary);
    font-size: clamp(0.95rem, 1.2vw, 1.08rem);
  }

  .auth-story__points {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: var(--space-5);
    margin-top: var(--space-10);
  }

  .auth-story__point {
    padding-top: var(--space-4);
    border-top: 1px solid var(--color-border);
  }

  .auth-story__point > span {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    margin-bottom: var(--space-3);
    color: var(--color-support);
    background: var(--color-support-soft);
    border-radius: var(--radius-sm);
  }

  .auth-story__point strong {
    display: block;
    margin-bottom: 0.3rem;
    font-size: 0.8rem;
  }

  .auth-story__point p {
    margin-bottom: 0;
    color: var(--color-text-subtle);
    font-size: 0.72rem;
  }

  .auth-story__footer {
    margin: var(--space-10) 0 0;
    color: var(--color-text-subtle);
    font-size: 0.7rem;
  }

  .auth-panel {
    padding: var(--space-12);
  }

  .auth-panel__mobile-brand {
    display: none;
  }

  .auth-card {
    padding: clamp(1.8rem, 4vw, 2.5rem);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-xl);
    box-shadow: var(--shadow-md);
  }
}

@media (min-width: 1024px) {
  .app-shell {
    width: min(100%, 1060px);
    display: grid;
    grid-template-columns: 216px minmax(0, 680px);
    align-items: start;
    justify-content: center;
    gap: var(--space-8);
    margin-inline: auto;
    padding: var(--space-6);
  }

  .app-shell__main {
    max-width: none;
    margin: 0;
  }

  .desktop-nav {
    min-height: calc(100vh - 3rem);
    min-height: calc(100dvh - 3rem);
    position: sticky;
    top: var(--space-6);
    display: flex;
    flex-direction: column;
    padding: var(--space-3) var(--space-6) var(--space-3) 0;
    border-right: 1px solid var(--color-border);
  }

  .desktop-nav__links {
    display: grid;
    gap: var(--space-2);
    margin-top: var(--space-10);
  }

  .desktop-nav__link {
    width: 100%;
    min-height: 46px;
    display: flex;
    align-items: center;
    gap: var(--space-3);
    padding: 0.65rem 0.75rem;
    color: var(--color-text-secondary);
    background: transparent;
    border: 0;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-weight: 680;
    text-align: left;
    text-decoration: none;
  }

  .desktop-nav__link:hover {
    color: var(--color-text);
    background: var(--color-surface-muted);
  }

  .desktop-nav__link--active {
    color: var(--color-text);
    background: var(--color-accent-soft);
  }

  .desktop-nav__link--active svg {
    color: var(--color-accent);
  }

  .desktop-nav__account {
    margin-top: auto;
    padding-top: var(--space-5);
    border-top: 1px solid var(--color-border);
  }

  .desktop-nav__user {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .desktop-nav__user span:last-child {
    min-width: 0;
  }

  .desktop-nav__user strong,
  .desktop-nav__user small {
    display: block;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .desktop-nav__user strong { font-size: 0.82rem; }
  .desktop-nav__user small { color: var(--color-text-subtle); font-size: 0.68rem; }

  .desktop-nav__logout {
    width: 100%;
    min-height: 44px;
    display: flex;
    align-items: center;
    gap: var(--space-2);
    margin-top: var(--space-4);
    padding: 0.55rem 0.65rem;
    color: var(--color-text-secondary);
    background: transparent;
    border: 0;
    border-radius: var(--radius-sm);
    cursor: pointer;
    font-size: 0.76rem;
    font-weight: 680;
  }

  .desktop-nav__logout:hover {
    color: var(--color-danger);
    background: var(--color-danger-soft);
  }

  .mobile-nav,
  .feed-header__mobile-brand {
    display: none;
  }

  .feed-page {
    padding-bottom: var(--space-12);
  }

  .feed-header {
    flex-wrap: nowrap;
    padding-top: 0;
  }

  .feed-header__copy {
    width: auto;
    order: initial;
    padding-top: 0;
  }

  .feed-header__copy h1 {
    font-size: 2.1rem;
  }

  .feed-header__controls {
    order: initial;
  }
}

@media (min-width: 1280px) {
  .app-shell {
    width: min(100%, 1320px);
    grid-template-columns: 220px minmax(0, 680px) 260px;
    gap: var(--space-8);
  }

  .context-rail {
    height: max-content;
    position: sticky;
    top: var(--space-6);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .context-card {
    padding: var(--space-5);
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-md);
  }

  .context-card__icon {
    width: 38px;
    height: 38px;
    display: grid;
    place-items: center;
    margin-bottom: var(--space-4);
    color: var(--color-support);
    background: var(--color-support-soft);
    border-radius: var(--radius-sm);
  }

  .context-card h2 {
    margin-bottom: var(--space-2);
    font-size: 0.94rem;
  }

  .context-card p {
    margin-bottom: 0;
    color: var(--color-text-secondary);
    font-size: 0.78rem;
  }

  .context-card--profile {
    display: flex;
    align-items: center;
    gap: var(--space-3);
  }

  .context-card--profile > div {
    min-width: 0;
  }

  .context-card--profile .eyebrow {
    margin-bottom: 0.08rem;
    font-size: 0.58rem;
  }

  .context-card--profile h2,
  .context-card--profile p {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .context-card--profile h2 {
    margin-bottom: 0.08rem;
  }

  .context-card--quiet {
    display: flex;
    align-items: flex-start;
    gap: var(--space-3);
    color: var(--color-support);
    background: var(--color-support-soft);
    border-color: rgb(119 203 187 / 0.14);
  }

  .context-card--quiet svg {
    flex: 0 0 auto;
  }
}

@media (max-width: 380px) {
  .feed-header,
  .composer,
  .post-card,
  .feed-notice,
  .state-panel,
  .feed-list__inline-error {
    margin-inline: var(--space-2);
  }

  .feed-header {
    padding-inline: var(--space-2);
  }

  .mode-badge {
    width: 30px;
    justify-content: center;
    padding-inline: 0;
    font-size: 0;
  }

  .composer__counter {
    display: none;
  }
}
```

## frontend\src\styles\globals.css

```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  min-width: 320px;
  min-height: 100%;
  scroll-behavior: smooth;
  background: var(--color-bg);
}

body {
  min-width: 320px;
  min-height: 100vh;
  min-height: 100dvh;
  margin: 0;
  color: var(--color-text);
  background:
    linear-gradient(180deg, #111720 0, var(--color-bg) 28rem),
    var(--color-bg);
  font-family: var(--font-sans);
  font-size: 1rem;
  line-height: 1.5;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

button,
input,
textarea {
  font: inherit;
}

button,
a,
label[for] {
  -webkit-tap-highlight-color: transparent;
}

button {
  color: inherit;
}

a {
  color: var(--color-accent);
  text-decoration-thickness: 1px;
  text-underline-offset: 0.22em;
}

img {
  display: block;
  max-width: 100%;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1,
h2,
h3,
strong {
  text-wrap: balance;
}

:focus-visible {
  outline: 2px solid var(--color-focus);
  outline-offset: 3px;
}

::selection {
  color: #14171d;
  background: var(--color-support);
}

::-webkit-scrollbar {
  width: 10px;
}

::-webkit-scrollbar-track {
  background: var(--color-bg-deep);
}

::-webkit-scrollbar-thumb {
  background: var(--color-border-strong);
  border: 2px solid var(--color-bg-deep);
  border-radius: var(--radius-pill);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.eyebrow {
  margin-bottom: var(--space-2);
  color: var(--color-support);
  font-size: 0.7rem;
  font-weight: 750;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.button {
  min-height: 46px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0.72rem 1rem;
  border: 1px solid transparent;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-weight: 700;
  line-height: 1;
  text-decoration: none;
  transition:
    color var(--transition-fast),
    background-color var(--transition-fast),
    border-color var(--transition-fast),
    opacity var(--transition-fast),
    transform var(--transition-fast);
}

.button:active:not(:disabled) {
  transform: scale(0.98);
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.48;
}

.button--primary {
  color: #211013;
  background: var(--color-accent);
  border-color: var(--color-accent);
}

.button--primary:hover:not(:disabled) {
  background: #ff8585;
  border-color: #ff8585;
}

.button--secondary {
  color: var(--color-text);
  background: var(--color-surface-raised);
  border-color: var(--color-border);
}

.button--secondary:hover:not(:disabled) {
  background: var(--color-surface-hover);
  border-color: var(--color-border-strong);
}

.button--wide {
  width: 100%;
}

.spin {
  animation: spin 800ms linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    scroll-behavior: auto !important;
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

## frontend\src\styles\tokens.css

```css
:root {
  color-scheme: dark;

  --font-sans: "Segoe UI Variable Text", "Segoe UI", Inter, Aptos, Roboto, Helvetica, Arial, sans-serif;

  --color-bg: #0d1117;
  --color-bg-deep: #090c11;
  --color-surface: #151b24;
  --color-surface-raised: #1b2330;
  --color-surface-muted: #202936;
  --color-surface-hover: #252f3e;
  --color-text: #f3f5f8;
  --color-text-secondary: #a9b2c0;
  --color-text-subtle: #778294;
  --color-border: #273140;
  --color-border-strong: #3a4658;

  --color-accent: #ff7474;
  --color-accent-strong: #eb5f63;
  --color-accent-soft: rgb(255 116 116 / 0.12);
  --color-support: #77cbbb;
  --color-support-strong: #52ac9d;
  --color-support-soft: rgb(119 203 187 / 0.12);
  --color-danger: #ff858b;
  --color-danger-soft: rgb(255 133 139 / 0.11);
  --color-success: #72d3a1;
  --color-success-soft: rgb(114 211 161 / 0.11);
  --color-warning: #eecb76;
  --color-focus: #9cbcf8;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-5: 1.25rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;

  --radius-xs: 0.5rem;
  --radius-sm: 0.75rem;
  --radius-md: 1rem;
  --radius-lg: 1.25rem;
  --radius-xl: 1.5rem;
  --radius-pill: 999px;

  --shadow-sm: 0 10px 28px rgb(0 0 0 / 0.18);
  --shadow-md: 0 24px 70px rgb(0 0 0 / 0.28);

  --transition-fast: 130ms ease;
  --transition-base: 190ms ease;
}
```

## frontend\src\utils\formatters.js

```javascript
export function getInitials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "MS";
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function formatPostTime(value) {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently";

  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const relativeTime = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  const ranges = [
    [60, "second"],
    [60, "minute"],
    [24, "hour"],
    [7, "day"],
  ];

  let duration = seconds;
  for (const [amount, unit] of ranges) {
    if (Math.abs(duration) < amount) {
      return relativeTime.format(Math.round(duration), unit);
    }
    duration /= amount;
  }

  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: date.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  }).format(date);
}

export function getUserDisplayName(user) {
  return user?.username || user?.name || user?.displayName || "Community member";
}

```

## frontend\src\utils\mentions.js

```javascript
export function mentionToken(username = "") {
  return `@${String(username).trim().replace(/\s+/g, "_")}`;
}

export function getMentionContext(text = "", caret = text.length) {
  const beforeCaret = text.slice(0, caret);
  const match = beforeCaret.match(/(^|\s)@([\p{L}\p{N}_.-]*)$/u);
  if (!match) return null;
  const start = beforeCaret.length - match[2].length - 1;
  return {
    start,
    end: caret,
    query: match[2].replace(/_/g, " "),
  };
}

export function splitMentionText(text = "", mentions = []) {
  const known = mentions
    .filter((mention) => mention?.username)
    .map((mention) => ({ ...mention, token: mentionToken(mention.username) }))
    .sort((left, right) => right.token.length - left.token.length);
  if (!known.length) return [{ text, mention: null }];

  const parts = [];
  let cursor = 0;
  while (cursor < text.length) {
    let next = null;
    for (const mention of known) {
      const index = text.indexOf(mention.token, cursor);
      if (index >= 0 && (!next || index < next.index)) next = { index, mention };
    }
    if (!next) {
      parts.push({ text: text.slice(cursor), mention: null });
      break;
    }
    if (next.index > cursor) parts.push({ text: text.slice(cursor, next.index), mention: null });
    parts.push({ text: next.mention.token, mention: next.mention });
    cursor = next.index + next.mention.token.length;
  }
  return parts;
}
```

## frontend\src\utils\mentions.test.js

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { getMentionContext, mentionToken, splitMentionText } from "./mentions.js";

test("mention context works after whitespace and converts underscores for search", () => {
  assert.deepEqual(getMentionContext("Thanks @Mira_S", 14), {
    start: 7,
    end: 14,
    query: "Mira S",
  });
  assert.equal(getMentionContext("email@test", 10), null);
});

test("mention tokens are stable for usernames with spaces", () => {
  assert.equal(mentionToken("Mira Sen"), "@Mira_Sen");
});

test("known stored mentions are split from ordinary comment text", () => {
  const parts = splitMentionText("Hello @Mira_Sen!", [{ id: "mira", username: "Mira Sen" }]);
  assert.equal(parts[1].text, "@Mira_Sen");
  assert.equal(parts[1].mention.id, "mira");
});
```

## frontend\src\validation\authValidation.js

```javascript
export const AUTH_RULES = Object.freeze({
  usernameMin: 2,
  usernameMax: 40,
  passwordMin: 8,
  passwordMax: 64,
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value = "") {
  return String(value).trim().toLowerCase();
}

export function validateLogin(values = {}) {
  const errors = {};
  const email = normalizeEmail(values.email);
  const password = typeof values.password === "string" ? values.password : "";

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    errors.email = "Enter a valid email address.";
  }
  if (!password) {
    errors.password = "Enter your password.";
  } else if (password.length > AUTH_RULES.passwordMax) {
    errors.password = `Use no more than ${AUTH_RULES.passwordMax} characters.`;
  }
  return errors;
}

export function validateSignup(values = {}) {
  const errors = validateLogin(values);
  const username = String(values.username || "").trim();

  if (username.length < AUTH_RULES.usernameMin) {
    errors.username = `Use at least ${AUTH_RULES.usernameMin} characters.`;
  } else if (username.length > AUTH_RULES.usernameMax) {
    errors.username = `Use no more than ${AUTH_RULES.usernameMax} characters.`;
  }
  const password = typeof values.password === "string" ? values.password : "";
  if (password && (
    password.length < AUTH_RULES.passwordMin ||
    !/[A-Za-z]/.test(password) ||
    !/\d/.test(password)
  )) {
    errors.password = `Use ${AUTH_RULES.passwordMin}–${AUTH_RULES.passwordMax} characters with at least one letter and one number.`;
  }
  if (!values.confirmPassword) {
    errors.confirmPassword = "Confirm your password.";
  } else if (password !== values.confirmPassword) {
    errors.confirmPassword = "The passwords do not match.";
  }
  return errors;
}

export function firstInvalidField(errors, order) {
  return order.find((field) => Boolean(errors[field])) || null;
}
```

## frontend\src\validation\authValidation.test.js

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import { validateLogin, validateSignup } from "./authValidation.js";

test("login validates presence but leaves password strength to credential verification", () => {
  assert.deepEqual(validateLogin({ email: "person@example.com", password: "a" }), {});
  assert.equal(validateLogin({ email: "person@example.com", password: "" }).password, "Enter your password.");
});

test("login accepts an eight-character password", () => {
  assert.deepEqual(validateLogin({ email: "person@example.com", password: "12345678" }), {});
});

test("signup validates username, normalized email, and matching passwords", () => {
  const errors = validateSignup({
    username: "x",
    email: "invalid",
    password: "password1",
    confirmPassword: "different",
  });
  assert.ok(errors.username);
  assert.ok(errors.email);
  assert.ok(errors.confirmPassword);
});

test("signup requires both a letter and a number in an eight-character password", () => {
  assert.ok(validateSignup({ username: "Kumar", email: "kumar@example.com", password: "abcdefgh", confirmPassword: "abcdefgh" }).password);
  assert.ok(validateSignup({ username: "Kumar", email: "kumar@example.com", password: "12345678", confirmPassword: "12345678" }).password);
  assert.deepEqual(validateSignup({ username: "Kumar", email: "kumar@example.com", password: "secure123", confirmPassword: "secure123" }), {});
});
```

## frontend\vite.config.js

```javascript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});

```

## package.json

```json
{
  "name": "3w-mini-social",
  "private": true,
  "version": "1.0.0",
  "packageManager": "pnpm@11.19.0",
  "scripts": {
    "dev": "pnpm --parallel --filter ./backend --filter ./frontend dev",
    "build": "pnpm --filter ./backend build && pnpm --filter ./frontend build",
    "test": "pnpm --filter ./backend test && pnpm --filter ./frontend test",
    "check": "pnpm build && pnpm test"
  },
  "dependencies": {
    "mongodb": "^7.6.0"
  }
}
```

