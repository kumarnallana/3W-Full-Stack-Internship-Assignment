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
