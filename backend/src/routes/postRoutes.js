import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  addComment,
  createPost,
  getPosts,
  toggleLike,
  editComment,
  deleteComment,
  toggleCommentLike,
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
postRouter.put("/:postId/comments/:commentId", mutationLimiter, asyncHandler(editComment));
postRouter.delete("/:postId/comments/:commentId", mutationLimiter, asyncHandler(deleteComment));
postRouter.post("/:postId/comments/:commentId/like", mutationLimiter, asyncHandler(toggleCommentLike));
