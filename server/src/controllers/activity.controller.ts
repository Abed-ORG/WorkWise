import { NextFunction, Request, Response } from "express";
import { getProjectActivityFeed } from "../services/activity.service";

export const getProjectActivityFeedController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const activities = await getProjectActivityFeed(
      req.params.projectId as string,
      user.userId,
      typeof req.query.cursor === "string" ? req.query.cursor : undefined,
      typeof req.query.limit === "string" ? Math.min(Math.max(Number(req.query.limit) || 20, 1), 100) : 20
    );
    return res.status(200).json({ success: true, data: activities });
  } catch (error) {
    next(error);
  }
};
