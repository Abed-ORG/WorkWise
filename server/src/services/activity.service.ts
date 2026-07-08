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

export async function getProjectActivityFeed(projectId: string, userId: string, cursor?: string, limit = 20) {
  const member = await prisma.projectMember.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });

  if (!member) {
    throw new Error("PROJECT_NOT_FOUND");
  }

  const where = { projectId };
  const [rows, totalCount] = await Promise.all([
    prisma.projectActivity.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    }),
    prisma.projectActivity.count({ where }),
  ]);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items,
    totalCount,
    hasMore,
    nextCursor: hasMore && items.length ? items[items.length - 1].id : null,
  };
}
