import { Router } from "express";
import { z } from "zod";
import {
  getNotificationsController,
  markAllNotificationsReadController,
  markNotificationReadController,
  updateNotificationPreferenceController,
} from "../controllers/notification.controller";
import { authenticate } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";

const router = Router();

router.use(authenticate);
router.get("/", getNotificationsController);
router.patch("/read-all", markAllNotificationsReadController);
router.patch(
  "/preference",
  validateBody(z.object({ preference: z.enum(["ALL", "MENTIONS_ONLY", "NONE"]) })),
  updateNotificationPreferenceController
);
router.patch("/:notificationId/read", markNotificationReadController);

export default router;
