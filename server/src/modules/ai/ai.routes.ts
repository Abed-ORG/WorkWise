import { NextFunction, Request, Response, Router } from "express";
import { authenticate } from "../../middleware/auth.middleware";
import { aiDailyRateLimit } from "../../middleware/ai-rate-limit.middleware";
import { aiController } from "./ai.controller";
import {
  acceptanceCriteriaValidation,
  sprintRiskValidation,
  sprintSuggestionValidation,
  taskBreakdownValidation,
  taskSearchValidation,
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

router.post(
  "/task-search",
  aiDailyRateLimit,
  taskSearchValidation,
  (req: Request, res: Response, next: NextFunction) =>
    aiController.parseTaskQuery(req, res, next)
);

router.post(
  "/sprint-suggestion",
  aiDailyRateLimit,
  sprintSuggestionValidation,
  (req: Request, res: Response, next: NextFunction) =>
    aiController.suggestSprintTasks(req, res, next)
);

router.post(
  "/sprint-risk",
  aiDailyRateLimit,
  sprintRiskValidation,
  (req: Request, res: Response, next: NextFunction) =>
    aiController.analyzeSprintRisk(req, res, next)
);

export default router;

