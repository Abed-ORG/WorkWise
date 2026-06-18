import { Router } from "express";
import {
  createTaskController,
  deleteTaskController,
  getAssignedTasksController,
  getProjectTasksController,
  getTaskByIdController,
  getTaskDocumentsController,
  updateTaskDocumentsController,
  updateTaskController,
} from "../controllers/task.controller";
import { createCommentController } from "../controllers/comment.controller";
import { commentSchema } from "../validators/comment.validator";
import { authenticate } from "../middleware/auth.middleware";
import { validateBody } from "../middleware/validate.middleware";
import { createTaskSchema, updateTaskSchema } from "../validators/task.validator";

const router = Router();

router.post(
  "/",
  authenticate,
  validateBody(createTaskSchema),
  createTaskController
);

router.get("/assigned/me", authenticate, getAssignedTasksController);
router.get("/project/:projectId", authenticate, getProjectTasksController);
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
