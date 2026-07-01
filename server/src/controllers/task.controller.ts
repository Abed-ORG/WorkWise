import { NextFunction, Request, Response } from "express";
import {
  createTaskAttachment,
  createTaskChecklistItem,
  createTask,
  createTaskTimeLog,
  deleteTaskAttachment,
  deleteTaskChecklistItem,
  deleteTask,
  deleteTaskTimeLog,
  getAssignedTasks,
  getAttachmentForDownload,
  getTaskAttachments,
  getTaskChecklistItems,
  getProjectTasks,
  getTaskById,
  getTaskDocuments,
  getTaskTimeLogs,
  updateTaskChecklistItem,
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

export const getTaskTimeLogsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const result = await getTaskTimeLogs(req.params.id as string, user.userId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

export const createTaskTimeLogController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const log = await createTaskTimeLog(req.params.id as string, user.userId, req.body);
    return res.status(201).json({ success: true, data: log });
  } catch (error) {
    next(error);
  }
};

export const deleteTaskTimeLogController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    await deleteTaskTimeLog(req.params.id as string, user.userId);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getTaskChecklistItemsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const items = await getTaskChecklistItems(req.params.id as string, user.userId);
    return res.status(200).json({ success: true, data: items });
  } catch (error) {
    next(error);
  }
};

export const createTaskChecklistItemController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const item = await createTaskChecklistItem(req.params.id as string, user.userId, req.body);
    return res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

export const updateTaskChecklistItemController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const item = await updateTaskChecklistItem(req.params.id as string, user.userId, req.body);
    return res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

export const deleteTaskChecklistItemController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    await deleteTaskChecklistItem(req.params.id as string, user.userId);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};

export const getTaskAttachmentsController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const attachments = await getTaskAttachments(req.params.id as string, user.userId);
    return res.status(200).json({ success: true, data: attachments });
  } catch (error) {
    next(error);
  }
};

export const createTaskAttachmentController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const attachment = await createTaskAttachment(req.params.id as string, user.userId, req.body);
    return res.status(201).json({ success: true, data: attachment });
  } catch (error) {
    next(error);
  }
};

export const downloadTaskAttachmentController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    const attachment = await getAttachmentForDownload(req.params.id as string, user.userId);
    const buffer = Buffer.from(attachment.data, "base64");
    const safeName = attachment.fileName.replace(/[^\x20-\x7E]/g, "_").replace(/"/g, "'");
    res.setHeader("Content-Type", attachment.mimeType);
    res.setHeader("Content-Disposition", `inline; filename="${safeName}"`);
    res.setHeader("Content-Length", String(buffer.length));
    res.send(buffer);
  } catch (error) {
    next(error);
  }
};

export const deleteTaskAttachmentController = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = (req as any).user;
    await deleteTaskAttachment(req.params.id as string, user.userId);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
};
