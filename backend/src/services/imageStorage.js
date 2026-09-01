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
