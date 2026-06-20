import { Request, Response, NextFunction } from "express";
import {
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notification.service";
import prisma from "../utils/prisma";

export const getNotificationsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const notifications = await getUserNotifications(user.userId);
    return res.status(200).json({ success: true, data: notifications });
  } catch (error) {
    next(error);
  }
};

export const markNotificationReadController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    await markNotificationRead(req.params.notificationId as string, user.userId);
    return res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const markAllNotificationsReadController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    await markAllNotificationsRead(user.userId);
    return res.status(200).json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const updateNotificationPreferenceController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const updated = await prisma.user.update({
      where: { id: user.userId },
      data: { notificationPreference: req.body.preference },
      select: { notificationPreference: true },
    });
    return res.status(200).json({ success: true, data: updated });
  } catch (error) {
    next(error);
  }
};
