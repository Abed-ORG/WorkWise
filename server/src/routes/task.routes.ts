import { Router } from "express";
import {
  createTaskAttachmentController,
  createTaskChecklistItemController,
  createTaskController,
  createTaskTimeLogController,
  deleteTaskAttachmentController,
  deleteTaskChecklistItemController,
  deleteTaskController,
  deleteTaskTimeLogController,
  getAssignedTasksController,
  getTaskAttachmentsController,
  getTaskChecklistItemsController,
  getProjectTasksController,
  getTaskByIdController,
  getTaskDocumentsController,
  getTaskTimeLogsController,
  updateTaskChecklistItemController,
  updateTaskDocumentsController,
  updateTaskController,
} from "../controllers/task.controller";
import { createCommentController } from "../controllers/comment.controller";
import { commentSchema } from "../validators/comment.validator";
import { authenticate } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import {
  createChecklistItemSchema,
  createTaskSchema,
  createTimeLogSchema,
  updateChecklistItemSchema,
  updateTaskSchema,
} from "../validators/task.validator";

const router = Router();

router.post(
  "/",
  authenticate,
  validateBody(createTaskSchema),
  createTaskController
);

router.get("/assigned/me", authenticate, getAssignedTasksController);
router.get("/project/:projectId", authenticate, getProjectTasksController);
router.patch("/subtasks/:id", authenticate, validateBody(updateChecklistItemSchema), updateTaskChecklistItemController);
router.delete("/subtasks/:id", authenticate, deleteTaskChecklistItemController);
router.delete("/time-logs/:id", authenticate, deleteTaskTimeLogController);
router.delete("/attachments/:id", authenticate, deleteTaskAttachmentController);
router.get("/:id/subtasks", authenticate, getTaskChecklistItemsController);
router.post("/:id/subtasks", authenticate, validateBody(createChecklistItemSchema), createTaskChecklistItemController);
router.get("/:id/time-logs", authenticate, getTaskTimeLogsController);
router.post("/:id/time-logs", authenticate, validateBody(createTimeLogSchema), createTaskTimeLogController);
router.get("/:id/attachments", authenticate, getTaskAttachmentsController);
router.post("/:id/attachments", authenticate, createTaskAttachmentController);
router.get("/:id/documents", authenticate, getTaskDocumentsController);
router.put("/:id/documents", authenticate, updateTaskDocumentsController);
router.get("/:id", authenticate, getTaskByIdController);

router.patch("/:id", authenticate, validateBody(updateTaskSchema), updateTaskController);
router.delete("/:id", authenticate, deleteTaskController);
router.post(
  "/:id/comments",
  authenticate,
  validateBody(commentSchema),
  createCommentController
);


export default router;
