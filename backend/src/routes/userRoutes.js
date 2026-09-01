import { Router } from "express";
import { searchUsers } from "../controllers/userController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";

export const userRouter = Router();

userRouter.use(asyncHandler(authenticate));
userRouter.get("/", asyncHandler(searchUsers));
