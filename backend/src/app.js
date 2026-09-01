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
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
