import { NextFunction, Request, Response, Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { aiController } from "./ai.controller";
import {
  acceptanceCriteriaValidation,
  taskBreakdownValidation,
} from "./ai.validation";

const router = Router();

router.use(authenticate);

router.post(
  "/task-breakdown",
  taskBreakdownValidation,
  (req: Request, res: Response, next: NextFunction) =>
    aiController.generateTaskBreakdown(req, res, next)
);

router.post(
  "/acceptance-criteria",
  acceptanceCriteriaValidation,
  (req: Request, res: Response, next: NextFunction) =>
    aiController.generateAcceptanceCriteria(req, res, next)
);

export default router;

