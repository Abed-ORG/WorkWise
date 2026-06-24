import { NextFunction, Request, Response, Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { aiDailyRateLimit } from "../../middleware/ai-rate-limit.middleware";
import { aiController } from "./ai.controller";
import {
  acceptanceCriteriaValidation,
  taskBreakdownValidation,
} from "./ai.validation";

const router = Router();

router.use(authenticate);

// Status endpoint — no rate-limit middleware; must always respond
router.get(
  "/status",
  (req: Request, res: Response, next: NextFunction) =>
    aiController.getQuotaStatus(req, res, next)
);

router.post(
  "/task-breakdown",
  aiDailyRateLimit,
  taskBreakdownValidation,
  (req: Request, res: Response, next: NextFunction) =>
    aiController.generateTaskBreakdown(req, res, next)
);

router.post(
  "/acceptance-criteria",
  aiDailyRateLimit,
  acceptanceCriteriaValidation,
  (req: Request, res: Response, next: NextFunction) =>
    aiController.generateAcceptanceCriteria(req, res, next)
);

export default router;

