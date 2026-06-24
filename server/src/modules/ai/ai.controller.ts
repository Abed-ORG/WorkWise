import { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import { ValidationError } from "../../errors/ValidationError";
import { geminiService } from "./gemini.service";
import prisma from "../../utils/prisma";
import { DAILY_LIMIT, todayUtc, nextMidnightUtc } from "../../middleware/ai-rate-limit.middleware";

class AiController {
  async generateTaskBreakdown(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return next(new ValidationError("Validation failed", errors.array()));
    }

    try {
      const result = await geminiService.generateTaskBreakdown({
        featureDescription: req.body.featureDescription,
        projectContext: req.body.projectContext,
      });

      return res.status(200).json({
        success: true,
        data: result,
        ...(res.locals.aiQuotaWarning ? { quotaWarning: res.locals.aiQuotaWarning } : {}),
      });
    } catch (error) {
      return next(error);
    }
  }

  async generateAcceptanceCriteria(
    req: Request,
    res: Response,
    next: NextFunction
  ) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return next(new ValidationError("Validation failed", errors.array()));
    }

    try {
      const result = await geminiService.generateAcceptanceCriteria({
        title: req.body.title,
        description: req.body.description,
      });

      return res.status(200).json({
        success: true,
        data: result,
        ...(res.locals.aiQuotaWarning ? { quotaWarning: res.locals.aiQuotaWarning } : {}),
      });
    } catch (error) {
      return next(error);
    }
  }

  async getQuotaStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const date = todayUtc();
      const row = await prisma.aiQuotaUsage.findUnique({ where: { date } });
      const count = row?.count ?? 0;
      const remaining = Math.max(0, DAILY_LIMIT - count);

      return res.status(200).json({
        success: true,
        data: {
          count,
          limit: DAILY_LIMIT,
          remaining,
          percentUsed: Math.round((count / DAILY_LIMIT) * 100 * 10) / 10,
          warning: count >= 1200,
          resetAt: nextMidnightUtc(),
        },
      });
    } catch (error) {
      return next(error);
    }
  }
}

export const aiController = new AiController();

