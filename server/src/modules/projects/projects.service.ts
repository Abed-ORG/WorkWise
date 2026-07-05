import { NotificationType, Prisma, PrismaClient, Role, StatusCategory, Task } from '@prisma/client';
import { sendProjectInvitationEmail } from '../../services/mail.service';
import { createProjectActivity } from '../../services/activity.service';
import { notifyProjectMembers } from '../../services/notification.service';
import { emitProjectEvent } from '../../services/realtime.service';
import { geminiService } from '../ai/gemini.service';
import { DEFAULT_PROJECT_STATUSES, getBacklogDefaultStatus, getSprintDefaultStatus, isDone } from '../../utils/taskStatus';

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

type DigestTask = Pick<Task, 'id' | 'title' | 'priority' | 'dueDate' | 'updatedAt'> & {
  status: { category: StatusCategory };
  assignee?: { name: string } | null;
};

function bulletList(items: string[]) {
  return items.length ? items.map((item) => `- ${item}`).join('\n') : '- Nothing to report yet.';
}

function fallbackDigestSummary(projectName: string, completed: DigestTask[], inProgress: DigestTask[], blockers: DigestTask[]) {
  return [
    'Completed today:',
    bulletList(completed.map((task) => task.title)),
    '',
    'In progress:',
    bulletList(inProgress.map((task) => `${task.title}${task.assignee?.name ? ` (${task.assignee.name})` : ''}`)),
    '',
    'Blockers and risks:',
    bulletList(blockers.map((task) => `${task.title} needs attention`)),
    '',
    `Next focus: keep ${projectName} moving by clearing the highest-priority open task first.`,
  ].join('\n');
}

function buildDailyDigestPrompt(projectName: string, completed: DigestTask[], inProgress: DigestTask[], blockers: DigestTask[], activities: { action: string; target: string; details?: string | null }[]) {
  return [
    `Create a concise daily project digest for "${projectName}".`,
    'Use short actionable bullet points. Include completed work, in-progress work, blockers, and next focus.',
    'Do not invent tasks. If a section has no items, say "Nothing to report yet."',
    '',
    `Completed tasks: ${completed.map((task) => task.title).join(', ') || 'none'}`,
    `In progress tasks: ${inProgress.map((task) => `${task.title}${task.assignee?.name ? ` assigned to ${task.assignee.name}` : ''}`).join(', ') || 'none'}`,
    `Blockers: ${blockers.map((task) => task.title).join(', ') || 'none'}`,
    `Recent activity: ${activities.map((activity) => `${activity.action} ${activity.target}${activity.details ? ` (${activity.details})` : ''}`).join('; ') || 'none'}`,
  ].join('\n');
}

function fallbackRetroSections(sprintName: string, completedCount: number, totalCount: number, blockerCount: number) {
  const completionRate = totalCount === 0 ? 0 : Math.round((completedCount / totalCount) * 100);
  return {
    whatWentWell: bulletList([
      `${completedCount} of ${totalCount} sprint tasks reached Done (${completionRate}% completion).`,
      completionRate >= 70 ? 'The sprint kept a healthy delivery rhythm.' : 'The sprint created useful visibility into remaining work.',
    ]),
    whatDidnt: bulletList([
      blockerCount > 0 ? `${blockerCount} urgent or overdue task${blockerCount === 1 ? '' : 's'} still need attention.` : 'No major blocker pattern was detected.',
      completionRate < 70 ? 'Completion rate shows the sprint may have been over-scoped.' : 'Keep watching task carry-over so the next sprint stays focused.',
    ]),
    actionItems: bulletList([
      `Review unfinished work from ${sprintName} before planning the next sprint.`,
      'Pull one clear priority into the next sprint goal.',
      'Assign owners to any blocker before the next standup.',
    ]),
  };
}

function parseRetroResponse(text: string, fallback: ReturnType<typeof fallbackRetroSections>) {
  const section = (label: string, nextLabel?: string) => {
    const pattern = nextLabel
      ? new RegExp(`${label}:([\\s\\S]*?)${nextLabel}:`, 'i')
      : new RegExp(`${label}:([\\s\\S]*)`, 'i');
    return text.match(pattern)?.[1]?.trim();
  };

  return {
    whatWentWell: section('WHAT_WENT_WELL', 'WHAT_DIDNT') || fallback.whatWentWell,
    whatDidnt: section('WHAT_DIDNT', 'ACTION_ITEMS') || fallback.whatDidnt,
    actionItems: section('ACTION_ITEMS') || fallback.actionItems,
  };
}

function isAiReportStorageError(error: unknown) {
  const dbError = error as { code?: string; message?: string };
  const message = dbError.message ?? '';

  return (
    dbError.code === 'P2021' ||
    dbError.code === 'P2022' ||
    message.includes('dailyDigest') ||
    message.includes('sprintRetrospective') ||
    message.includes('daily_digests') ||
    message.includes('sprint_retrospectives')
  );
}

function rethrowAiReportStorageError(error: unknown): never {
  if (isAiReportStorageError(error)) {
    throw new Error('AI_REPORT_STORAGE_NOT_READY');
  }

  throw error;
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

    const project = await prisma.$transaction(async (tx) => {
      const createdProject = await tx.project.create({
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

      // A project can never exist without its default statuses — task creation and sprint
      // entry both depend on a backlog-default and sprint-default status being present.
      await tx.projectStatus.createMany({
        data: DEFAULT_PROJECT_STATUSES.map((status) => ({ ...status, projectId: createdProject.id })),
      });

      return createdProject;
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
                status: { category: { not: StatusCategory.DONE } },
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

    const sprint = await prisma.$transaction(async (tx) => {
      const createdSprint = await tx.sprint.create({
        data: {
          name: data.name.trim(),
          goal: data.goal?.trim() || undefined,
          startDate: resolvedStart,
          endDate: resolvedEnd,
          isActive: true,
          projectId,
        },
      });
      await this.promoteSprintBacklogTasksToSprintDefault(tx, projectId, createdSprint.id);
      return createdSprint;
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

  async getProjectDigests(projectId: string, userId: string) {
    await this.requireProjectMember(projectId, userId);

    try {
      return await prisma.dailyDigest.findMany({
        where: { projectId },
        include: { generatedBy: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        take: 12,
      });
    } catch (error) {
      rethrowAiReportStorageError(error);
    }
  }

  async generateDailyDigest(projectId: string, userId: string, source: 'manual' | 'scheduled' = 'manual') {
    await this.requireProjectMember(projectId, userId);

    const since = todayUtc();
    const now = new Date();
    const project = await prisma.project.findFirst({
      where: { id: projectId, members: { some: { userId } } },
      include: {
        tasks: {
          include: { status: true, assignee: { select: { name: true } } },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        },
        activities: {
          where: { createdAt: { gte: since } },
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
      },
    });

    if (!project) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    const completed = project.tasks.filter((task) => isDone(task) && task.updatedAt >= since);
    const inProgress = project.tasks.filter((task) => !isDone(task)).slice(0, 8);
    const blockers = project.tasks.filter((task) => !isDone(task) && (task.priority === 'URGENT' || Boolean(task.dueDate && task.dueDate < now))).slice(0, 8);
    const fallbackSummary = fallbackDigestSummary(project.name, completed, inProgress, blockers);

    let summary = fallbackSummary;
    let summarySource: string = source;

    try {
      summary = await geminiService.generateText(buildDailyDigestPrompt(project.name, completed, inProgress, blockers, project.activities));
      summarySource = 'ai';
    } catch {
      summary = fallbackSummary;
    }

    let digest;

    try {
      digest = await prisma.dailyDigest.create({
        data: {
          title: `${project.name} daily digest`,
          summary,
          completedCount: completed.length,
          inProgressCount: inProgress.length,
          blockerCount: blockers.length,
          source: summarySource,
          projectId,
          generatedById: userId,
        },
        include: { generatedBy: { select: { id: true, name: true, email: true } } },
      });
    } catch (error) {
      rethrowAiReportStorageError(error);
    }

    createProjectActivity({
      projectId,
      userId,
      action: 'DAILY_DIGEST_GENERATED',
      target: digest.title,
      details: `${digest.completedCount} completed, ${digest.inProgressCount} in progress, ${digest.blockerCount} blockers`,
    }).catch(() => undefined);

    return digest;
  }

  async getSprintRetrospective(projectId: string, sprintId: string, userId: string) {
    await this.requireSprintInProject(projectId, sprintId, userId);

    try {
      return await prisma.sprintRetrospective.findUnique({
        where: { sprintId },
        include: { generatedBy: { select: { id: true, name: true, email: true } } },
      });
    } catch (error) {
      rethrowAiReportStorageError(error);
    }
  }

  async generateSprintRetrospective(projectId: string, sprintId: string, userId: string) {
    await this.requireSprintInProject(projectId, sprintId, userId);

    const sprint = await prisma.sprint.findFirst({
      where: { id: sprintId, projectId },
      include: {
        tasks: {
          include: { status: true, assignee: { select: { name: true } } },
          orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        },
      },
    });

    if (!sprint) {
      throw new Error('SPRINT_NOT_FOUND');
    }

    const completed = sprint.tasks.filter((task) => isDone(task));
    const unfinished = sprint.tasks.filter((task) => !isDone(task));
    const blockers = unfinished.filter((task) => task.priority === 'URGENT' || Boolean(task.dueDate && task.dueDate < new Date()));
    const fallback = fallbackRetroSections(sprint.name, completed.length, sprint.tasks.length, blockers.length);

    let sections = fallback;

    try {
      const response = await geminiService.generateText([
        `Create a sprint retrospective for "${sprint.name}".`,
        'Return exactly these headings: WHAT_WENT_WELL:, WHAT_DIDNT:, ACTION_ITEMS:.',
        'Use short bullet points and do not invent work.',
        `Completed tasks: ${completed.map((task) => task.title).join(', ') || 'none'}`,
        `Unfinished tasks: ${unfinished.map((task) => task.title).join(', ') || 'none'}`,
        `Urgent/overdue blockers: ${blockers.map((task) => task.title).join(', ') || 'none'}`,
      ].join('\n'));
      sections = parseRetroResponse(response, fallback);
    } catch {
      sections = fallback;
    }

    let retrospective;

    try {
      retrospective = await prisma.sprintRetrospective.upsert({
        where: { sprintId },
        update: {
          whatWentWell: sections.whatWentWell,
          whatDidnt: sections.whatDidnt,
          actionItems: sections.actionItems,
          generatedById: userId,
        },
        create: {
          projectId,
          sprintId,
          generatedById: userId,
          whatWentWell: sections.whatWentWell,
          whatDidnt: sections.whatDidnt,
          actionItems: sections.actionItems,
        },
        include: { generatedBy: { select: { id: true, name: true, email: true } } },
      });
    } catch (error) {
      rethrowAiReportStorageError(error);
    }

    createProjectActivity({
      projectId,
      userId,
      action: 'SPRINT_RETRO_GENERATED',
      target: sprint.name,
      details: 'AI retrospective report generated',
    }).catch(() => undefined);

    return retrospective;
  }

  async updateSprintRetrospectiveNotes(projectId: string, sprintId: string, userId: string, manualNotes: string) {
    await this.requireSprintInProject(projectId, sprintId, userId);

    let retrospective;

    try {
      retrospective = await prisma.sprintRetrospective.findUnique({
        where: { sprintId },
      });
    } catch (error) {
      rethrowAiReportStorageError(error);
    }

    if (!retrospective) {
      throw new Error('RETROSPECTIVE_NOT_FOUND');
    }

    try {
      return await prisma.sprintRetrospective.update({
        where: { sprintId },
        data: { manualNotes },
        include: { generatedBy: { select: { id: true, name: true, email: true } } },
      });
    } catch (error) {
      rethrowAiReportStorageError(error);
    }
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

  // ── Notification Preferences ───────────────────────────────
  async getNotificationPreferences(projectId: string, userId: string) {
    await this.requireProjectMember(projectId, userId);

    const preference = await prisma.projectNotificationPreference.findUnique({
      where: { userId_projectId: { userId, projectId } },
    });

    // Absence of a saved row means every toggle defaults to "on" — matches current behavior.
    return {
      taskAssigned: preference?.taskAssigned ?? true,
      taskMoved: preference?.taskMoved ?? true,
      commentAdded: preference?.commentAdded ?? true,
      mention: preference?.mention ?? true,
      sprintStarted: preference?.sprintStarted ?? true,
      sprintCompleted: preference?.sprintCompleted ?? true,
    };
  }

  async updateNotificationPreferences(
    projectId: string,
    userId: string,
    updates: Partial<{
      taskAssigned: boolean;
      taskMoved: boolean;
      commentAdded: boolean;
      mention: boolean;
      sprintStarted: boolean;
      sprintCompleted: boolean;
    }>
  ) {
    await this.requireProjectMember(projectId, userId);

    const preference = await prisma.projectNotificationPreference.upsert({
      where: { userId_projectId: { userId, projectId } },
      create: { userId, projectId, ...updates },
      update: { ...updates },
    });

    return {
      taskAssigned: preference.taskAssigned,
      taskMoved: preference.taskMoved,
      commentAdded: preference.commentAdded,
      mention: preference.mention,
      sprintStarted: preference.sprintStarted,
      sprintCompleted: preference.sprintCompleted,
    };
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
      if (!nextSprint) return null;
      const activated = await tx.sprint.update({ where: { id: nextSprint.id }, data: { isActive: true } });
      await this.promoteSprintBacklogTasksToSprintDefault(tx, projectId, activated.id);
      return activated;
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
        select: { id: true, status: { select: { category: true } } },
      });
      const completedCount = tasks.filter((t) => isDone(t)).length;
      const incompleteCount = tasks.length - completedCount;

      if (data.incompleteTaskDestination === 'sprint' && data.targetSprintId) {
        const targetSprint = await tx.sprint.findFirst({ where: { id: data.targetSprintId, projectId } });
        if (!targetSprint) throw new Error('TARGET_SPRINT_NOT_FOUND');
        if (targetSprint.id === sprintId) throw new Error('CANNOT_TARGET_SAME_SPRINT');
      }

      if (incompleteCount > 0) {
        await tx.task.updateMany({
          where: { sprintId, status: { category: { not: StatusCategory.DONE } } },
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
      if (activatedSprint) await this.promoteSprintBacklogTasksToSprintDefault(tx, projectId, activatedSprint.id);

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

  // ── Get Project Statuses ───────────────────────────────────
  async getProjectStatuses(projectId: string, userId: string) {
    await this.requireProjectMember(projectId, userId);

    return prisma.projectStatus.findMany({
      where: { projectId },
      orderBy: { order: 'asc' },
    });
  }

  // ── Create Project Status ──────────────────────────────────
  async createProjectStatus(projectId: string, userId: string, data: { name: string; category: StatusCategory; color?: string | null }) {
    await this.requireAdminRole(projectId, userId);

    const name = data.name.trim();
    const existing = await prisma.projectStatus.findUnique({ where: { projectId_name: { projectId, name } } });
    if (existing) {
      throw new Error('STATUS_NAME_EXISTS');
    }

    const maxOrder = await prisma.projectStatus.aggregate({
      where: { projectId },
      _max: { order: true },
    });

    return prisma.projectStatus.create({
      data: {
        name,
        category: data.category,
        color: data.color?.trim() || null,
        order: (maxOrder._max.order ?? -1) + 1,
        projectId,
      },
    });
  }

  // ── Update Project Status ──────────────────────────────────
  async updateProjectStatus(
    projectId: string,
    userId: string,
    statusId: string,
    data: { name?: string; category?: StatusCategory; color?: string | null; isBacklogDefault?: true; isSprintDefault?: true },
  ) {
    await this.requireAdminRole(projectId, userId);

    const status = await prisma.projectStatus.findFirst({ where: { id: statusId, projectId } });
    if (!status) {
      throw new Error('STATUS_NOT_FOUND');
    }

    if (data.name !== undefined) {
      const name = data.name.trim();
      const existing = await prisma.projectStatus.findUnique({ where: { projectId_name: { projectId, name } } });
      if (existing && existing.id !== statusId) {
        throw new Error('STATUS_NAME_EXISTS');
      }
    }

    if (data.category !== undefined && data.category !== status.category) {
      const remainingInOldCategory = await prisma.projectStatus.count({
        where: { projectId, category: status.category, id: { not: statusId } },
      });
      if (remainingInOldCategory === 0) {
        throw new Error('CANNOT_LEAVE_CATEGORY_EMPTY');
      }
    }

    return prisma.$transaction(async (tx) => {
      // Setting a default flag transfers it — it never creates a second holder or leaves zero.
      if (data.isBacklogDefault) {
        await tx.projectStatus.updateMany({ where: { projectId, isBacklogDefault: true }, data: { isBacklogDefault: false } });
      }
      if (data.isSprintDefault) {
        await tx.projectStatus.updateMany({ where: { projectId, isSprintDefault: true }, data: { isSprintDefault: false } });
      }

      if (data.isBacklogDefault) {
        // The backlog-default status is where new tasks land when no status is chosen. Keep it
        // first in column order so it's unambiguously "the backlog" wherever statuses are listed,
        // matching the original (pre-custom-statuses) behavior where Backlog was always first.
        const siblings = await tx.projectStatus.findMany({
          where: { projectId, id: { not: statusId } },
          orderBy: { order: 'asc' },
          select: { id: true },
        });
        const orderedIds = [statusId, ...siblings.map((row) => row.id)];
        await Promise.all(
          orderedIds.map((id, index) => tx.projectStatus.update({ where: { id }, data: { order: index } })),
        );
      }

      return tx.projectStatus.update({
        where: { id: statusId },
        data: {
          ...(data.name !== undefined && { name: data.name.trim() }),
          ...(data.category !== undefined && { category: data.category }),
          ...(data.color !== undefined && { color: data.color?.trim() || null }),
          ...(data.isBacklogDefault && { isBacklogDefault: true as const }),
          ...(data.isSprintDefault && { isSprintDefault: true as const }),
        },
      });
    });
  }

  // ── Reorder Project Statuses ───────────────────────────────
  async reorderProjectStatuses(projectId: string, userId: string, orderedIds: string[]) {
    await this.requireAdminRole(projectId, userId);

    const existing = await prisma.projectStatus.findMany({ where: { projectId }, select: { id: true } });
    const existingIds = new Set(existing.map((row) => row.id));
    const isExactMatch = orderedIds.length === existingIds.size && orderedIds.every((id) => existingIds.has(id));
    if (!isExactMatch) {
      throw new Error('REORDER_MISMATCH');
    }

    await prisma.$transaction(
      orderedIds.map((id, index) => prisma.projectStatus.update({ where: { id }, data: { order: index } })),
    );

    return prisma.projectStatus.findMany({ where: { projectId }, orderBy: { order: 'asc' } });
  }

  // ── Delete Project Status ──────────────────────────────────
  async deleteProjectStatus(projectId: string, userId: string, statusId: string, reassignToStatusId?: string) {
    await this.requireAdminRole(projectId, userId);

    const status = await prisma.projectStatus.findFirst({ where: { id: statusId, projectId } });
    if (!status) {
      throw new Error('STATUS_NOT_FOUND');
    }

    if (status.isBacklogDefault || status.isSprintDefault) {
      throw new Error('CANNOT_DELETE_DEFAULT_STATUS');
    }

    const remainingInCategory = await prisma.projectStatus.count({
      where: { projectId, category: status.category, id: { not: statusId } },
    });
    if (remainingInCategory === 0) {
      throw new Error('CANNOT_DELETE_ONLY_STATUS_IN_CATEGORY');
    }

    const taskCount = await prisma.task.count({ where: { statusId } });

    if (taskCount > 0) {
      if (!reassignToStatusId) {
        throw new Error('STATUS_HAS_TASKS');
      }
      if (reassignToStatusId === statusId) {
        throw new Error('REASSIGN_STATUS_SAME_AS_DELETED');
      }

      const target = await prisma.projectStatus.findFirst({ where: { id: reassignToStatusId, projectId } });
      if (!target) {
        throw new Error('REASSIGN_STATUS_NOT_FOUND');
      }

      await prisma.$transaction([
        prisma.task.updateMany({ where: { statusId }, data: { statusId: reassignToStatusId } }),
        prisma.projectStatus.delete({ where: { id: statusId } }),
      ]);
      return;
    }

    await prisma.projectStatus.delete({ where: { id: statusId } });
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

  private async promoteSprintBacklogTasksToSprintDefault(tx: Prisma.TransactionClient, projectId: string, sprintId: string) {
    const [backlogStatus, sprintStatus] = await Promise.all([
      getBacklogDefaultStatus(projectId),
      getSprintDefaultStatus(projectId),
    ]);

    await tx.task.updateMany({
      where: { sprintId, statusId: backlogStatus.id },
      data: { statusId: sprintStatus.id },
    });
  }
}

export const projectsService = new ProjectsService();
