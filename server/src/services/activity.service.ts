import prisma from "../utils/prisma";

export interface CreateProjectActivityInput {
  projectId: string;
  userId: string;
  action: string;
  target: string;
  details?: string;
}

export async function createProjectActivity(input: CreateProjectActivityInput) {
  return prisma.projectActivity.create({
    data: input,
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      project: { select: { id: true, name: true, key: true } },
    },
  });
}

export async function getProjectActivityFeed(projectId: string, userId: string, cursor?: string) {
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });

  if (!member) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  return prisma.projectActivity.findMany({
    where: { projectId },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
    ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
  });
}
