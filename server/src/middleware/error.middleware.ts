import { NextFunction, Request, Response } from "express";
import { AppError } from "../errors/AppError";

export const errorHandler = (
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      success: false,
      status: err.statusCode,
      message: err.message,
      details: err.details ?? null,
    });
  }

  console.error(err);
  return res.status(500).json({
    success: false,
    status: 500,
    message: "Internal server error",
    details: null,
  });
};