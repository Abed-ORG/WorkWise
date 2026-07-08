import { NextFunction, Request, Response } from "express";

const shouldLogRequestTiming = process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test";

export const requestTimingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (!shouldLogRequestTiming) {
    return next();
  }

  const startedAt = process.hrtime.bigint();

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    console.log("[request]", {
      method: req.method,
      path: req.originalUrl || req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs),
    });
  });

  return next();
};
