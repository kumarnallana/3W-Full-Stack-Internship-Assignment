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
