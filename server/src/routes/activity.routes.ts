import { Router } from "express";
import { getProjectActivityFeedController } from "../controllers/activity.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.get("/projects/:projectId", authenticate, getProjectActivityFeedController);

export default router;
