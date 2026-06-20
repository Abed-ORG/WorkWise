import { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import { ValidationError } from "../../errors/ValidationError";
import { geminiService } from "./gemini.service";

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

      return res.status(200).json({ success: true, data: result });
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

      return res.status(200).json({ success: true, data: result });
    } catch (error) {
      return next(error);
    }
  }
}

export const aiController = new AiController();

