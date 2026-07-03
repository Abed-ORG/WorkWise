import { ProjectStatus, StatusCategory } from "@prisma/client";
import prisma from "./prisma";
import { AppError } from "../errors/AppError";
import { NotFoundError } from "../errors/NotFoundError";

type TaskWithStatus = { status: Pick<ProjectStatus, "category"> };

// The 5 default statuses every project must have — created for existing projects by the
// custom-statuses migration, and must also be created for every new project (see createProject
// in projects.service.ts). Keep in sync with server/prisma/seed.js's STATUS_DEFAULTS.
export const DEFAULT_PROJECT_STATUSES: Array<
  Pick<ProjectStatus, "name" | "category" | "order" | "isBacklogDefault" | "isSprintDefault">
> = [
  { name: "Backlog", category: StatusCategory.TODO, order: 0, isBacklogDefault: true, isSprintDefault: false },
  { name: "To Do", category: StatusCategory.TODO, order: 1, isBacklogDefault: false, isSprintDefault: true },
  { name: "In Progress", category: StatusCategory.IN_PROGRESS, order: 2, isBacklogDefault: false, isSprintDefault: false },
  { name: "In Review", category: StatusCategory.IN_PROGRESS, order: 3, isBacklogDefault: false, isSprintDefault: false },
  { name: "Done", category: StatusCategory.DONE, order: 4, isBacklogDefault: false, isSprintDefault: false },
];

export const isDone = (task: TaskWithStatus) => task.status.category === StatusCategory.DONE;
export const isInProgress = (task: TaskWithStatus) => task.status.category === StatusCategory.IN_PROGRESS;
export const isTodo = (task: TaskWithStatus) => task.status.category === StatusCategory.TODO;

export const getBacklogDefaultStatus = async (projectId: string): Promise<ProjectStatus> => {
  const status = await prisma.projectStatus.findFirst({
    where: { projectId, isBacklogDefault: true },
  });

  if (!status) {
    throw new AppError("Project has no backlog-default status configured", 500);
  }

  return status;
};

export const getSprintDefaultStatus = async (projectId: string): Promise<ProjectStatus> => {
  const status = await prisma.projectStatus.findFirst({
    where: { projectId, isSprintDefault: true },
  });

  if (!status) {
    throw new AppError("Project has no sprint-default status configured", 500);
  }

  return status;
};

export const requireProjectStatus = async (statusId: string, projectId: string): Promise<ProjectStatus> => {
  const status = await prisma.projectStatus.findUnique({ where: { id: statusId } });

  if (!status || status.projectId !== projectId) {
    throw new NotFoundError("Status not found in this project");
  }

  return status;
};
