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
import { AppError } from "../errors/AppError";

const readRequestBuffer = (req: Request) => new Promise<Buffer>((resolve, reject) => {
  const chunks: Buffer[] = [];
  req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
  req.on("end", () => resolve(Buffer.concat(chunks)));
  req.on("error", reject);
});

const getMultipartHeaderValue = (headers: string, name: string) => {
  const match = headers.match(new RegExp(`${name}="([^"]+)"`, "i"));
  return match?.[1];
};

const parseMultipartFile = async (req: Request) => {
  const contentType = req.headers["content-type"] ?? "";
  const boundary = String(contentType).match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[1]
    ?? String(contentType).match(/boundary=(?:"([^"]+)"|([^;]+))/i)?.[2];

  if (!boundary) throw new AppError("Multipart boundary is required", 400);

  const body = await readRequestBuffer(req);
  const marker = Buffer.from(`--${boundary}`);
  let cursor = body.indexOf(marker);

  while (cursor !== -1) {
    const partStart = cursor + marker.length;
    if (body.slice(partStart, partStart + 2).toString() === "--") break;

    const contentStart = body.slice(partStart, partStart + 2).toString() === "\r\n" ? partStart + 2 : partStart;
    const nextMarker = body.indexOf(marker, contentStart);
    if (nextMarker === -1) break;

    const rawPart = body.slice(contentStart, Math.max(contentStart, nextMarker - 2));
    const headerEnd = rawPart.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd !== -1) {
      const headers = rawPart.slice(0, headerEnd).toString("utf8");
      const fileName = getMultipartHeaderValue(headers, "filename");
      if (fileName) {
        const mimeType = headers.match(/content-type:\s*([^\r\n]+)/i)?.[1]?.trim() || "application/octet-stream";
        return {
          fileName,
          mimeType,
          buffer: rawPart.slice(headerEnd + 4),
        };
      }
    }

    cursor = nextMarker;
  }

  throw new AppError("Attachment file is required", 400);
};

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
    const file = await parseMultipartFile(req);
    const attachment = await createTaskAttachment(req.params.id as string, user.userId, file);
    return res.status(201).json({ success: true, data: attachment });
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
