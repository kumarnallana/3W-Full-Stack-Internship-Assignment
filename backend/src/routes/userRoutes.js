import { Router } from "express";
import { searchUsers, getNotifications, markNotificationsRead } from "../controllers/userController.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";

export const userRouter = Router();

userRouter.use(asyncHandler(authenticate));
userRouter.get("/", asyncHandler(searchUsers));
userRouter.get("/notifications", asyncHandler(getNotifications));
userRouter.post("/notifications/read", asyncHandler(markNotificationsRead));
