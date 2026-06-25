import { NextFunction, Request, Response } from "express";
import { validationResult } from "express-validator";
import { ValidationError } from "../../errors/ValidationError";
import { NotFoundError } from "../../errors/NotFoundError";
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

  async analyzeSprintRisk(req: Request, res: Response, next: NextFunction) {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return next(new ValidationError("Validation failed", errors.array()));
    }

    try {
      const userId = (req as any).user?.userId as string;
      const { sprintId, projectId } = req.body as { sprintId: string; projectId: string };

      const member = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId, projectId } },
      });
      if (!member) return next(new NotFoundError("Project not found"));

      const sprint = await prisma.sprint.findUnique({ where: { id: sprintId } });
      if (!sprint || sprint.projectId !== projectId) {
        return next(new NotFoundError("Sprint not found"));
      }

      const tasks = await prisma.task.findMany({
        where: { sprintId },
        include: { assignee: { select: { id: true, name: true } } },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const byStatus = { BACKLOG: 0, TODO: 0, IN_PROGRESS: 0, IN_REVIEW: 0, DONE: 0 };
      const byPriority = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 };
      const workloadMap = new Map<string, { name: string; taskCount: number }>();
      let overdueTasks = 0;
      let unassignedCount = 0;

      for (const task of tasks) {
        byStatus[task.status]++;
        byPriority[task.priority]++;

        if (task.dueDate && task.status !== "DONE" && task.dueDate < today) {
          overdueTasks++;
        }

        if (task.assigneeId && task.assignee) {
          const existing = workloadMap.get(task.assigneeId);
          if (existing) {
            existing.taskCount++;
          } else {
            workloadMap.set(task.assigneeId, { name: task.assignee.name, taskCount: 1 });
          }
        } else {
          unassignedCount++;
        }
      }

      const daysRemaining = sprint.endDate
        ? Math.max(0, Math.round((sprint.endDate.getTime() - today.getTime()) / 86400000))
        : null;

      const result = await geminiService.analyzeSprintRisk({
        sprintName: sprint.name,
        startDate: sprint.startDate ? sprint.startDate.toISOString().slice(0, 10) : null,
        endDate: sprint.endDate ? sprint.endDate.toISOString().slice(0, 10) : null,
        daysRemaining,
        totalTasks: tasks.length,
        byStatus,
        byPriority,
        overdueTasks,
        workload: Array.from(workloadMap.values()),
        unassignedCount,
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

  async parseTaskQuery(req: Request, res: Response, next: NextFunction) {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return next(new ValidationError("Validation failed", errors.array()));
    }

    try {
      const userId = (req as any).user?.userId as string;
      const { query, projectId } = req.body as { query: string; projectId: string };

      const member = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: userId!, projectId } },
      });

      if (!member) {
        return next(new NotFoundError("Project not found"));
      }

      const [members, tasks] = await Promise.all([
        prisma.projectMember.findMany({
          where: { projectId },
          include: { user: { select: { name: true } } },
        }),
        prisma.task.findMany({
          where: { projectId },
          select: { labels: true },
        }),
      ]);

      const memberNames = members.map((m) => m.user.name).filter(Boolean);
      const labels = Array.from(new Set(tasks.flatMap((t) => t.labels)));
      const today = new Date().toISOString().slice(0, 10);

      const filters = await geminiService.parseTaskQuery({ query, memberNames, labels, today });

      return res.status(200).json({
        success: true,
        data: { filters },
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

