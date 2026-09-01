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
