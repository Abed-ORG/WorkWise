import { Router } from "express";
import {
  createSubtaskTaskController,
  createTaskAttachmentController,
  createTaskChecklistItemController,
  createTaskController,
  deleteTaskAttachmentController,
  deleteTaskChecklistItemController,
  deleteTaskController,
  downloadTaskAttachmentController,
  getAssignedFocusTasksController,
  getAssignedTasksController,
  getTaskAttachmentsController,
  getTaskChecklistItemsController,
  getTaskChildrenController,
  getProjectTasksController,
  getTaskByIdController,
  getTaskDocumentsController,
  updateTaskChecklistItemController,
  updateTaskDocumentsController,
  updateTaskController,
} from "../controllers/task.controller";
import { createCommentController } from "../controllers/comment.controller";
import { commentSchema } from "../validators/comment.validator";
import { authenticate } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import {
  createAttachmentSchema,
  createChecklistItemSchema,
  createSubtaskTaskSchema,
  createTaskSchema,
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

router.get("/assigned/me/focus", authenticate, getAssignedFocusTasksController);
router.get("/assigned/me", authenticate, getAssignedTasksController);
router.get("/project/:projectId", authenticate, getProjectTasksController);
router.patch("/subtasks/:id", authenticate, validateBody(updateChecklistItemSchema), updateTaskChecklistItemController);
router.delete("/subtasks/:id", authenticate, deleteTaskChecklistItemController);
router.get("/attachments/:id/download", authenticate, downloadTaskAttachmentController);
router.delete("/attachments/:id", authenticate, deleteTaskAttachmentController);
router.get("/:id/subtasks", authenticate, getTaskChecklistItemsController);
router.post("/:id/subtasks", authenticate, validateBody(createChecklistItemSchema), createTaskChecklistItemController);
router.get("/:id/children", authenticate, getTaskChildrenController);
router.post("/:id/children", authenticate, validateBody(createSubtaskTaskSchema), createSubtaskTaskController);
router.get("/:id/attachments", authenticate, getTaskAttachmentsController);
router.post("/:id/attachments", authenticate, validateBody(createAttachmentSchema), createTaskAttachmentController);
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
