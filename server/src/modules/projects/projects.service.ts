import { NotificationType, PrismaClient, Role } from '@prisma/client';
import { sendProjectInvitationEmail } from '../../services/mail.service';
import { createProjectActivity } from '../../services/activity.service';
import { notifyProjectMembers } from '../../services/notification.service';
import { emitProjectEvent } from '../../services/realtime.service';

const prisma = new PrismaClient();

const linkedDocumentSelect = {
  id: true,
  title: true,
  content: true,
  projectId: true,
  authorId: true,
  createdAt: true,
  updatedAt: true,
} as const;

function dateOnlyUtc(value: string) {
  return new Date(`${value.slice(0, 10)}T00:00:00.000Z`);
}

function todayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

export class ProjectsService {

  // ── Create Project ─────────────────────────────────────────
  async createProject(data: {
    name: string;
    key: string;
    description?: string;
    creatorId: string;
  }) {
    const existingProject = await prisma.project.findUnique({
      where: { key: data.key },
    });

    if (existingProject) {
      throw new Error('PROJECT_KEY_EXISTS');
    }

    const project = await prisma.project.create({
      data: {
        name: data.name,
        key: data.key,
        description: data.description,
        members: {
          create: {
            userId: data.creatorId,
            role: Role.ADMIN,
          },
        },
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    return project;
  }

  // ── Get All Projects for User ──────────────────────────────
  async getUserProjects(userId: string) {
    const projects = await prisma.project.findMany({
      where: {
        members: { some: { userId } },
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        sprints: {
          where: { isActive: true },
          select: { id: true, name: true },
        },
        _count: {
          select: {
            tasks: {
              where: {
                status: { not: 'DONE' },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return projects;
  }

  // ── Get Single Project ─────────────────────────────────────
  async getProjectById(projectId: string, userId: string) {
    const project = await prisma.project.findFirst({
      where: {
        id: projectId,
        members: { some: { userId } },
      },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
        },
        sprints: {
          where: { isActive: true },
          select: { id: true, name: true, goal: true, startDate: true, endDate: true },
        },
        _count: {
          select: { tasks: true },
        },
      },
    });

    if (!project) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    return project;
  }

  // ── Update Project ─────────────────────────────────────────
  async updateProject(projectId: string, userId: string, data: {
    name?: string;
    description?: string;
  }) {
    await this.requireAdminRole(projectId, userId);

    const project = await prisma.project.update({
      where: { id: projectId },
      data,
    });

    return project;
  }

  // ── Delete Project ─────────────────────────────────────────
  async deleteProject(projectId: string, userId: string) {
    await this.requireAdminRole(projectId, userId);

    await prisma.project.delete({
      where: { id: projectId },
    });
  }

  // ── Invite Member ──────────────────────────────────────────
  async inviteMember(projectId: string, senderId: string, data: {
    email: string;
    role: Role;
  }) {
    await this.requireAdminRole(projectId, senderId);
    const normalizedEmail = data.email.trim().toLowerCase();

    const existingInvitation = await prisma.invitation.findFirst({
      where: {
        projectId,
        email: normalizedEmail,
        status: 'PENDING',
      },
    });

    if (existingInvitation) {
      throw new Error('INVITATION_ALREADY_PENDING');
    }

    const invitedUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (invitedUser) {
      const existingMember = await prisma.projectMember.findUnique({
        where: {
          userId_projectId: {
            userId: invitedUser.id,
            projectId,
          },
        },
      });

      if (existingMember) {
        throw new Error('USER_ALREADY_MEMBER');
      }
    }

    const invitation = await prisma.invitation.create({
      data: {
        email: normalizedEmail,
        role: data.role,
        projectId,
        senderId,
      },
      include: {
        project: { select: { name: true } },
        sender: { select: { name: true } },
      },
    });

    try {
      await sendProjectInvitationEmail({
        to: normalizedEmail,
        recipientName: invitedUser?.name,
        senderName: invitation.sender.name,
        projectName: invitation.project.name,
        role: invitation.role.toLowerCase(),
      });
    } catch (error) {
      await prisma.invitation.delete({ where: { id: invitation.id } });
      throw error;
    }

    return invitation;
  }

  // ── Get Pending Invitations for Project ────────────────────
  async getProjectInvitations(projectId: string, userId: string) {
    await this.requireAdminRole(projectId, userId);

    const invitations = await prisma.invitation.findMany({
      where: { projectId, status: 'PENDING' },
      include: {
        sender: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations;
  }

  // ── Get Pending Invitations for User ───────────────────────
  async getUserInvitations(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!user) {
      throw new Error('USER_NOT_FOUND');
    }

    const invitations = await prisma.invitation.findMany({
      where: { email: user.email.toLowerCase(), status: 'PENDING' },
      include: {
        project: { select: { id: true, name: true, key: true } },
        sender: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return invitations;
  }

  // ── Accept Invitation ──────────────────────────────────────
  async acceptInvitation(invitationId: string, userId: string) {
    const invitation = await prisma.invitation.findFirst({
      where: { id: invitationId, status: 'PENDING' },
      include: { project: true },
    });

    if (!invitation) {
      throw new Error('INVITATION_NOT_FOUND');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error('INVITATION_NOT_FOR_USER');
    }

    await prisma.$transaction([
      prisma.invitation.update({
        where: { id: invitationId },
        data: { status: 'ACCEPTED' },
      }),
      prisma.projectMember.create({
        data: {
          userId,
          projectId: invitation.projectId,
          role: invitation.role,
        },
      }),
    ]);

    return invitation.project;
  }

  // ── Decline Invitation ─────────────────────────────────────
  async declineInvitation(invitationId: string, userId: string) {
    const invitation = await prisma.invitation.findFirst({
      where: { id: invitationId, status: 'PENDING' },
    });

    if (!invitation) {
      throw new Error('INVITATION_NOT_FOUND');
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
      throw new Error('INVITATION_NOT_FOR_USER');
    }

    await prisma.invitation.update({
      where: { id: invitationId },
      data: { status: 'DECLINED' },
    });
  }

  async startSprint(
    projectId: string,
    userId: string,
    data: { name: string; goal?: string; startDate?: string; endDate?: string },
  ) {
    await this.requireAdminRole(projectId, userId);

    const activeSprint = await prisma.sprint.findFirst({
      where: { projectId, isActive: true },
    });

    if (activeSprint) {
      throw new Error('ACTIVE_SPRINT_EXISTS');
    }

    // Use provided dates when supplied; fall back to today / today+14 only when omitted
    const resolvedStart = data.startDate ? dateOnlyUtc(data.startDate) : todayUtc();
    const resolvedEnd = data.endDate
      ? dateOnlyUtc(data.endDate)
      : (() => { const d = new Date(resolvedStart); d.setDate(d.getDate() + 14); return d; })();

    await this.ensureSprintDatesDoNotOverlap(projectId, resolvedStart, resolvedEnd);

    const sprint = await prisma.sprint.create({
      data: {
        name: data.name.trim(),
        goal: data.goal?.trim() || undefined,
        startDate: resolvedStart,
        endDate: resolvedEnd,
        isActive: true,
        projectId,
      },
    });

    await createProjectActivity({
      projectId,
      userId,
      action: 'SPRINT_STARTED',
      target: sprint.name,
      details: sprint.goal || 'Sprint started',
    });
    await notifyProjectMembers(projectId, userId, NotificationType.SPRINT_STARTED, `Sprint "${sprint.name}" started.`);
    emitProjectEvent(projectId, 'sprint:started', sprint);

    return sprint;
  }

  async getProjectDocuments(projectId: string, userId: string, q?: string) {
    await this.requireProjectMember(projectId, userId);
    const query = q?.trim();

    return prisma.document.findMany({
      where: {
        projectId,
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: 'insensitive' } },
                { content: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async getSprintDocuments(projectId: string, sprintId: string, userId: string) {
    await this.requireSprintInProject(projectId, sprintId, userId);

    const links = await prisma.sprintDocument.findMany({
      where: { sprintId },
      include: { document: { select: linkedDocumentSelect } },
      orderBy: { createdAt: 'desc' },
    });

    return links.map((link) => link.document);
  }

  async updateSprintDocuments(projectId: string, sprintId: string, userId: string, documentIds: string[]) {
    await this.requireSprintInProject(projectId, sprintId, userId);
    const uniqueDocumentIds = Array.from(new Set(documentIds));

    if (uniqueDocumentIds.length > 0) {
      const documents = await prisma.document.findMany({
        where: { id: { in: uniqueDocumentIds }, projectId },
        select: { id: true },
      });

      if (documents.length !== uniqueDocumentIds.length) {
        throw new Error('DOCUMENT_NOT_FOUND');
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.sprintDocument.deleteMany({ where: { sprintId } });

      if (uniqueDocumentIds.length > 0) {
        await tx.sprintDocument.createMany({
          data: uniqueDocumentIds.map((documentId) => ({ sprintId, documentId })),
          skipDuplicates: true,
        });
      }
    });

    return this.getSprintDocuments(projectId, sprintId, userId);
  }

  async getProjectDocumentById(projectId: string, userId: string, documentId: string) {
    await this.requireProjectMember(projectId, userId);

    const document = await prisma.document.findFirst({
      where: { id: documentId, projectId },
    });

    if (!document) {
      throw new Error('DOCUMENT_NOT_FOUND');
    }

    return document;
  }

  async createProjectDocument(projectId: string, userId: string, data: { title: string; content?: string | null }) {
    await this.requireProjectMember(projectId, userId);

    return prisma.document.create({
      data: {
        title: data.title.trim(),
        content: data.content ?? '',
        projectId,
        authorId: userId,
      },
    });
  }

  async updateProjectDocument(projectId: string, userId: string, documentId: string, data: { title: string; content?: string | null }) {
    await this.requireProjectMember(projectId, userId);

    const document = await prisma.document.findFirst({
      where: { id: documentId, projectId },
    });

    if (!document) {
      throw new Error('DOCUMENT_NOT_FOUND');
    }

    return prisma.document.update({
      where: { id: document.id },
      data: {
        title: data.title.trim(),
        content: data.content ?? '',
      },
    });
  }

  async deleteProjectDocument(projectId: string, userId: string, documentId: string) {
    await this.requireProjectMember(projectId, userId);

    const document = await prisma.document.findFirst({
      where: { id: documentId, projectId },
    });

    if (!document) {
      throw new Error('DOCUMENT_NOT_FOUND');
    }

    await prisma.document.delete({
      where: { id: document.id },
    });
  }

  async getProjectDocument(projectId: string, userId: string) {
    await this.requireProjectMember(projectId, userId);

    return prisma.document.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async saveProjectDocument(projectId: string, userId: string, data: { title: string; content?: string | null }) {
    const existingDocument = await this.getProjectDocument(projectId, userId);

    if (existingDocument) {
      return this.updateProjectDocument(projectId, userId, existingDocument.id, data);
    }

    return this.createProjectDocument(projectId, userId, data);
  }

  // ── Update Member Role ─────────────────────────────────────
  async updateMemberRole(projectId: string, requesterId: string, memberId: string, role: Role) {
    await this.requireAdminRole(projectId, requesterId);

    const member = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
    });

    if (!member) {
      throw new Error('MEMBER_NOT_FOUND');
    }

    return await prisma.projectMember.update({
      where: { id: memberId },
      data: { role },
    });
  }

  // ── Remove Member ──────────────────────────────────────────
  async removeMember(projectId: string, requesterId: string, memberId: string) {
    await this.requireAdminRole(projectId, requesterId);

    const member = await prisma.projectMember.findFirst({
      where: { id: memberId, projectId },
    });

    if (!member) {
      throw new Error('MEMBER_NOT_FOUND');
    }

    if (requesterId === member.userId) {
      throw new Error('CANNOT_REMOVE_SELF');
    }

    await prisma.projectMember.delete({
      where: { id: memberId },
    });
  }

  // ── Create Sprint (inactive) ───────────────────────────────
  async createSprint(projectId: string, userId: string, data: {
    name: string;
    startDate?: string;
    endDate?: string;
    goal?: string;
  }) {
    await this.requireAdminRole(projectId, userId);

    const startDate = data.startDate ? dateOnlyUtc(data.startDate) : undefined;
    const endDate = data.endDate ? dateOnlyUtc(data.endDate) : undefined;
    if (startDate && endDate) {
      await this.ensureSprintDatesDoNotOverlap(projectId, startDate, endDate);
    }

    return prisma.sprint.create({
      data: {
        name: data.name.trim(),
        goal: data.goal?.trim() || undefined,
        startDate,
        endDate,
        isActive: false,
        projectId,
      },
    });
  }

  // ── Get All Sprints for Project ────────────────────────────
  async getSprints(projectId: string, userId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, members: { some: { userId } } },
      select: { id: true },
    });

    if (!project) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    return prisma.sprint.findMany({
      where: { projectId },
      orderBy: [{ startDate: 'asc' }, { createdAt: 'asc' }],
    });
  }

  // ── Get Single Sprint ──────────────────────────────────────
  async getSprintById(projectId: string, sprintId: string, userId: string) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, members: { some: { userId } } },
      select: { id: true },
    });

    if (!project) throw new Error('PROJECT_NOT_FOUND');

    const sprint = await prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
      include: { _count: { select: { tasks: true } } },
    });

    if (!sprint) throw new Error('SPRINT_NOT_FOUND');

    return sprint;
  }

  async deleteSprint(projectId: string, sprintId: string, userId: string) {
    await this.requireAdminRole(projectId, userId);

    const activatedSprint = await prisma.$transaction(async (tx) => {
      const sprint = await tx.sprint.findFirst({
        where: { id: sprintId, projectId },
        select: { id: true, isActive: true },
      });
      if (!sprint) throw new Error('SPRINT_NOT_FOUND');

      // Task.sprint uses onDelete: SetNull, so deleting a sprint returns its tasks to the backlog.
      await tx.sprint.delete({ where: { id: sprint.id } });
      if (!sprint.isActive) return null;

      const todayOnly = todayUtc();
      const nextSprint = await tx.sprint.findFirst({
        where: {
          projectId,
          isActive: false,
          startDate: { not: null },
          endDate: { gt: todayOnly },
        },
        orderBy: { startDate: 'asc' },
      });
      return nextSprint
        ? tx.sprint.update({ where: { id: nextSprint.id }, data: { isActive: true } })
        : null;
    });

    if (activatedSprint) emitProjectEvent(projectId, 'sprint:started', activatedSprint);
  }

  // ── Complete Sprint ────────────────────────────────────────
  async completeSprint(
    projectId: string,
    sprintId: string,
    userId: string,
    data: { incompleteTaskDestination: 'backlog' | 'sprint'; targetSprintId?: string },
  ) {
    await this.requireAdminRole(projectId, userId);

    const result = await prisma.$transaction(async (tx) => {
      const todayOnly = todayUtc();
      const sprint = await tx.sprint.findFirst({
        where: { id: sprintId, projectId, isActive: true },
      });
      if (!sprint) throw new Error('SPRINT_NOT_FOUND');

      const tasks = await tx.task.findMany({
        where: { sprintId },
        select: { id: true, status: true },
      });
      const completedCount = tasks.filter((t) => t.status === 'DONE').length;
      const incompleteCount = tasks.length - completedCount;

      if (data.incompleteTaskDestination === 'sprint' && data.targetSprintId) {
        const targetSprint = await tx.sprint.findFirst({ where: { id: data.targetSprintId, projectId } });
        if (!targetSprint) throw new Error('TARGET_SPRINT_NOT_FOUND');
        if (targetSprint.id === sprintId) throw new Error('CANNOT_TARGET_SAME_SPRINT');
      }

      if (incompleteCount > 0) {
        await tx.task.updateMany({
          where: { sprintId, status: { not: 'DONE' } },
          data: { sprintId: data.incompleteTaskDestination === 'backlog' ? null : data.targetSprintId },
        });
      }

      const completedSprint = await tx.sprint.update({
        where: { id: sprintId },
        data: { isActive: false, endDate: todayOnly },
      });

      const nextSprint = await tx.sprint.findFirst({
        where: {
          projectId,
          id: { not: sprintId },
          isActive: false,
          startDate: { not: null },
          endDate: { gt: todayOnly },
        },
        orderBy: { startDate: 'asc' },
      });
      const activatedSprint = nextSprint
        ? await tx.sprint.update({ where: { id: nextSprint.id }, data: { isActive: true } })
        : null;

      return { sprint: completedSprint, nextSprint: activatedSprint, completedCount, incompleteCount };
    });

    if (result.nextSprint) {
      emitProjectEvent(projectId, 'sprint:started', result.nextSprint);
    }
    return result;
  }

  // ── Helper — Require Admin Role ────────────────────────────
  private async requireAdminRole(projectId: string, userId: string) {
    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });

    if (!member) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    if (member.role !== Role.ADMIN) {
      throw new Error('FORBIDDEN');
    }
  }

  private async ensureSprintDatesDoNotOverlap(projectId: string, startDate: Date, endDate: Date) {
    const overlappingSprint = await prisma.sprint.findFirst({
      where: {
        projectId,
        startDate: { lte: endDate },
        endDate: { gte: startDate },
      },
      select: { id: true },
    });
    if (overlappingSprint) throw new Error('SPRINT_DATES_OVERLAP');
  }

  private async requireProjectMember(projectId: string, userId: string) {
    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });

    if (!member) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    return member;
  }

  private async requireSprintInProject(projectId: string, sprintId: string, userId: string) {
    await this.requireProjectMember(projectId, userId);

    const sprint = await prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
      select: { id: true },
    });

    if (!sprint) {
      throw new Error('SPRINT_NOT_FOUND');
    }

    return sprint;
  }
}

export const projectsService = new ProjectsService();
