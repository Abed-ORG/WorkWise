import { NextFunction, Request, Response } from "express";
import {
  createTask,
  deleteTask,
  getAssignedTasks,
  getProjectTasks,
  getTaskById,
  getTaskDocuments,
  updateTask,
  updateTaskDocuments,
} from "../services/task.service";

export const createTaskController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const task = await createTask({ ...req.body, creatorId: user.userId });
    return res.status(201).json({ success: true, message: "Task created successfully", data: task });
  } catch (error) {
    next(error);
  }
};

export const getProjectTasksController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const tasks = await getProjectTasks(req.params.projectId as string, user.userId);
    return res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
};

export const getAssignedTasksController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const tasks = await getAssignedTasks(user.userId);
    return res.status(200).json({ success: true, data: tasks });
  } catch (error) {
    next(error);
  }
};

export const getTaskByIdController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const task = await getTaskById(req.params.id as string, user.userId);
    return res.status(200).json({ success: true, data: task });
  } catch (error) {
    next(error);
  }
};

export const getTaskDocumentsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const documents = await getTaskDocuments(req.params.id as string, user.userId);
    return res.status(200).json({ success: true, data: documents });
  } catch (error) {
    next(error);
  }
};

export const updateTaskDocumentsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const documentIds = req.body.documentIds;
    if (!Array.isArray(documentIds) || documentIds.some((documentId) => typeof documentId !== "string")) {
      return res.status(400).json({ success: false, message: "documentIds must be an array of strings" });
    }
    const documents = await updateTaskDocuments(req.params.id as string, user.userId, documentIds);
    return res.status(200).json({ success: true, data: documents });
  } catch (error) {
    next(error);
  }
};

export const updateTaskController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const task = await updateTask(req.params.id as string, { ...req.body, userId: user.userId });
    return res.status(200).json({ success: true, message: "Task updated successfully", data: task });
  } catch (error) {
    next(error);
  }
};

export const deleteTaskController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    await deleteTask(req.params.id as string, user.userId);
    return res.status(200).json({ success: true, message: "Task deleted successfully" });
  } catch (error) {
    next(error);
  }
};
