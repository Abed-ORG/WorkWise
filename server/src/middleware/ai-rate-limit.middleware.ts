import { NextFunction, Request, Response } from "express";
import prisma from "../utils/prisma";

const DAILY_LIMIT = 1500;
const WARN_THRESHOLD = 1200; // 80%

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
}

export async function aiDailyRateLimit(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const date = todayUtc();

    const usage = await prisma.aiQuotaUsage.upsert({
      where: { date },
      create: { date, count: 1 },
      update: { count: { increment: 1 } },
    });

    if (usage.count > DAILY_LIMIT) {
      res.status(429).json({
        success: false,
        status: 429,
        message: "Daily AI request limit reached. Resets at midnight UTC.",
        details: {
          limit: DAILY_LIMIT,
          count: usage.count,
          resetAt: nextMidnightUtc(),
        },
      });
      return;
    }

    if (usage.count >= WARN_THRESHOLD) {
      const remaining = DAILY_LIMIT - usage.count;
      console.warn(
        `[AI quota] ${usage.count}/${DAILY_LIMIT} requests used today (${remaining} remaining)`
      );
      res.locals.aiQuotaWarning = { warning: true, remaining };
    }

    next();
  } catch (error) {
    next(error);
  }
}

function nextMidnightUtc(): string {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.toISOString();
}

export { DAILY_LIMIT, WARN_THRESHOLD, todayUtc, nextMidnightUtc };
