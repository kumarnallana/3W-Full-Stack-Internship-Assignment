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
