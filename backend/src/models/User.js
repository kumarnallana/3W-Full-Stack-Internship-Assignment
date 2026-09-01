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
    notifications: {
      type: [
        {
          type: { type: String, enum: ["mention", "reply"], required: true },
          actorUsername: { type: String, required: true },
          postId: { type: mongoose.Schema.Types.ObjectId, required: true },
          commentId: { type: mongoose.Schema.Types.ObjectId, required: true },
          read: { type: Boolean, default: false },
          createdAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
      select: false, // Don't load notifications by default unless requested
    },
  },
  {
    timestamps: true,
    collection: "users",
  },
);

export const User = mongoose.models.User || mongoose.model("User", userSchema);
