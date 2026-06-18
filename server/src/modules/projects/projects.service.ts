import { NotificationType, PrismaClient, Role } from '@prisma/client';
import { sendProjectInvitationEmail } from '../../services/mail.service';
import { createProjectActivity } from '../../services/activity.service';
import { notifyProjectMembers } from '../../services/notification.service';
import { emitProjectEvent } from '../../services/realtime.service';

const prisma = new PrismaClient();

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
          select: { id: true, name: true, startDate: true, endDate: true },
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

  async startSprint(projectId: string, userId: string, data: { name: string; goal?: string }) {
    await this.requireAdminRole(projectId, userId);

    const activeSprint = await prisma.sprint.findFirst({
      where: { projectId, isActive: true },
    });

    if (activeSprint) {
      throw new Error('ACTIVE_SPRINT_EXISTS');
    }

    const startDate = new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 14);

    const sprint = await prisma.sprint.create({
      data: {
        name: data.name.trim(),
        goal: data.goal?.trim() || undefined,
        startDate,
        endDate,
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

  async getProjectDocument(projectId: string, userId: string) {
    await this.requireProjectMember(projectId, userId);

    return prisma.document.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async saveProjectDocument(projectId: string, userId: string, data: { title: string; content?: string | null }) {
    await this.requireProjectMember(projectId, userId);

    const existingDocument = await prisma.document.findFirst({
      where: { projectId },
      orderBy: { createdAt: 'asc' },
    });

    if (existingDocument) {
      return prisma.document.update({
        where: { id: existingDocument.id },
        data: {
          title: data.title.trim(),
          content: data.content ?? '',
        },
      });
    }

    return prisma.document.create({
      data: {
        title: data.title.trim(),
        content: data.content ?? '',
        projectId,
        authorId: userId,
      },
    });
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

  private async requireProjectMember(projectId: string, userId: string) {
    const member = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });

    if (!member) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    return member;
  }
}

export const projectsService = new ProjectsService();
