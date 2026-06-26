const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();
const demoPassword = 'Password123';

function daysFromNow(days) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
}

function fixedDate(value) {
  const date = new Date(value);
  date.setHours(12, 0, 0, 0);
  return date;
}

async function findOrCreate(model, where, data) {
  const existing = await prisma[model].findFirst({ where });
  if (existing) {
    return existing;
  }

  return prisma[model].create({ data });
}

async function ensureUser(user, hashedPassword) {
  return prisma.user.upsert({
    where: { email: user.email },
    update: {},
    create: {
      name: user.name,
      email: user.email,
      password: hashedPassword,
      onboardingCompleted: true,
    },
  });
}

async function ensureProject(project) {
  return prisma.project.upsert({
    where: { key: project.key },
    update: {},
    create: project,
  });
}

async function ensureProjectMembers(project, users, memberData) {
  for (const [userKey, role] of memberData) {
    await prisma.projectMember.upsert({
      where: {
        userId_projectId: {
          userId: users[userKey].id,
          projectId: project.id,
        },
      },
      update: {},
      create: {
        userId: users[userKey].id,
        projectId: project.id,
        role,
      },
    });
  }
}

async function ensureSprints(project, sprintData) {
  const sprints = {};

  for (const [key, name, goal, startDate, endDate, isActive] of sprintData) {
    sprints[key] = await findOrCreate(
      'sprint',
      { projectId: project.id, name },
      { name, goal, startDate, endDate, isActive, projectId: project.id },
    );
  }

  return sprints;
}

async function ensureTasks(project, users, sprints, taskData) {
  const tasks = {};

  for (const task of taskData) {
    const [key, title, description, status, priority, sprintKey, assigneeKey, creatorKey, labels, dueDate] = task;
    tasks[key] = await findOrCreate(
      'task',
      { projectId: project.id, title },
      {
        title,
        description,
        acceptanceCriteria: `- ${title} is visible in the demo dataset\n- Status, priority, assignee, labels, and due date support filtering\n- Presenter can explain the project value`,
        status,
        priority,
        labels,
        dueDate,
        order: (Object.keys(tasks).length + 1) * 100,
        projectId: project.id,
        sprintId: sprintKey ? sprints[sprintKey].id : null,
        assigneeId: assigneeKey ? users[assigneeKey].id : null,
        creatorId: users[creatorKey].id,
      },
    );
  }

  return tasks;
}

async function ensureDocuments(project, users, documentData) {
  const documents = {};

  for (const [key, title, authorKey, content] of documentData) {
    documents[key] = await findOrCreate(
      'document',
      { projectId: project.id, title },
      { title, content, projectId: project.id, authorId: users[authorKey].id },
    );
  }

  return documents;
}

async function ensureSprintDocuments(sprints, documents, links) {
  for (const [sprintKey, documentKey] of links) {
    await prisma.sprintDocument.upsert({
      where: {
        sprintId_documentId: {
          sprintId: sprints[sprintKey].id,
          documentId: documents[documentKey].id,
        },
      },
      update: {},
      create: {
        sprintId: sprints[sprintKey].id,
        documentId: documents[documentKey].id,
      },
    });
  }
}

async function ensureTaskDocuments(tasks, documents, links) {
  for (const [taskKey, documentKey] of links) {
    await prisma.taskDocument.upsert({
      where: {
        taskId_documentId: {
          taskId: tasks[taskKey].id,
          documentId: documents[documentKey].id,
        },
      },
      update: {},
      create: {
        taskId: tasks[taskKey].id,
        documentId: documents[documentKey].id,
      },
    });
  }
}

async function ensureComments(users, tasks, commentData) {
  for (const [taskKey, authorKey, content, createdAt] of commentData) {
    await findOrCreate(
      'comment',
      { taskId: tasks[taskKey].id, authorId: users[authorKey].id, content },
      { content, taskId: tasks[taskKey].id, authorId: users[authorKey].id, createdAt },
    );
  }
}

async function ensureNotifications(users, notificationData) {
  for (const [userKey, type, message, isRead, createdAt] of notificationData) {
    await findOrCreate(
      'notification',
      { userId: users[userKey].id, type, message },
      { userId: users[userKey].id, type, message, isRead, createdAt },
    );
  }
}

async function ensureProjectActivities(project, users, activityData) {
  for (const [action, target, details, userKey, createdAt] of activityData) {
    await findOrCreate(
      'projectActivity',
      { projectId: project.id, action, target, details },
      { action, target, details, projectId: project.id, userId: users[userKey].id, createdAt },
    );
  }
}

async function ensureTaskActivities(users, tasks, activityData) {
  for (const [taskKey, action, details, userKey, createdAt] of activityData) {
    await findOrCreate(
      'taskActivity',
      { taskId: tasks[taskKey].id, action, details },
      { action, details, taskId: tasks[taskKey].id, userId: users[userKey].id, createdAt },
    );
  }
}

async function ensureDailyDigests(project, users, digestData) {
  for (const digest of digestData) {
    const generatedById = digest.generatedByKey ? users[digest.generatedByKey].id : null;
    await findOrCreate(
      'dailyDigest',
      { projectId: project.id, title: digest.title, summary: digest.summary },
      {
        title: digest.title,
        summary: digest.summary,
        completedCount: digest.completedCount,
        inProgressCount: digest.inProgressCount,
        blockerCount: digest.blockerCount,
        source: digest.source,
        projectId: project.id,
        generatedById,
        createdAt: digest.createdAt,
      },
    );
  }
}

async function ensureSprintRetrospectives(project, users, sprints, retrospectiveData) {
  for (const retro of retrospectiveData) {
    await prisma.sprintRetrospective.upsert({
      where: { sprintId: sprints[retro.sprintKey].id },
      update: {},
      create: {
        whatWentWell: retro.whatWentWell,
        whatDidnt: retro.whatDidnt,
        actionItems: retro.actionItems,
        manualNotes: retro.manualNotes,
        projectId: project.id,
        sprintId: sprints[retro.sprintKey].id,
        generatedById: retro.generatedByKey ? users[retro.generatedByKey].id : null,
        createdAt: retro.createdAt,
      },
    });
  }
}

async function seedAiProjectManagementHub(users) {
  const project = await ensureProject({
    name: 'AI Project Management Hub',
    description: 'WorkWise - Aspire GDC Team 1',
    key: 'AIWW',
  });

  await ensureProjectMembers(project, users, [
    ['abed', 'ADMIN'],
    ['yehia', 'DEVELOPER'],
    ['taimour', 'DEVELOPER'],
    ['hadi', 'DEVELOPER'],
  ]);

  const sprints = await ensureSprints(project, [
    ['sprint1', 'Sprint 1', 'Foundation - auth, kanban, core backend', fixedDate('2025-06-09'), fixedDate('2025-06-20'), true],
    ['sprint2', 'Sprint 2 - AI Workflow Polish', 'AI planning, dashboards, notifications, and demo readiness', fixedDate('2025-06-23'), fixedDate('2025-07-04'), false],
  ]);

  const tasks = await ensureTasks(project, users, sprints, [
    ['auth', 'Set up authentication system', 'JWT-based register, login, logout, token refresh, and protected API routes.', 'IN_PROGRESS', 'HIGH', 'sprint1', 'yehia', 'yehia', ['auth', 'backend', 'security'], fixedDate('2025-06-13')],
    ['kanban', 'Build Kanban board UI', 'Drag and drop board with backlog, todo, in progress, review, and done columns.', 'TODO', 'HIGH', 'sprint1', 'taimour', 'yehia', ['frontend', 'kanban'], fixedDate('2025-06-16')],
    ['schema', 'Design database schema', 'Prisma schema with users, projects, members, sprints, tasks, comments, documents, and notifications.', 'DONE', 'URGENT', 'sprint1', 'yehia', 'yehia', ['database', 'prisma'], fixedDate('2025-06-10')],
    ['documents', 'Create project document workspace', 'Add searchable rich-text documents that can be linked to tasks and sprint planning.', 'IN_REVIEW', 'MEDIUM', 'sprint1', 'abed', 'hadi', ['documents', 'collaboration'], fixedDate('2025-06-18')],
    ['ai-breakdown', 'Set up AI task breakdown feature', 'Gemini integration for splitting large feature ideas into actionable backlog tasks.', 'BACKLOG', 'MEDIUM', null, 'hadi', 'yehia', ['ai', 'planning'], fixedDate('2025-06-24')],
    ['dashboard', 'Build sprint dashboard', 'Velocity cards, burndown trend, completion metrics, and team workload summary.', 'BACKLOG', 'MEDIUM', null, 'taimour', 'yehia', ['analytics', 'dashboard'], fixedDate('2025-06-27')],
    ['notifications', 'Add task notification feed', 'Notify project members when assignments, comments, and sprint events happen.', 'TODO', 'HIGH', 'sprint2', 'abed', 'hadi', ['notifications', 'collaboration'], fixedDate('2025-06-26')],
    ['risk', 'Prototype AI sprint risk analysis', 'Summarize active sprint risks from urgent work, stale review items, and assignment load.', 'BACKLOG', 'HIGH', null, 'hadi', 'yehia', ['ai', 'risk', 'sprint'], fixedDate('2025-07-01')],
  ]);

  const documents = await ensureDocuments(project, users, [
    ['architecture', 'Project Architecture', 'yehia', '<h1>Architecture</h1><p>React + Vite frontend, Node.js + Express backend, PostgreSQL on Supabase, Prisma, Socket.io, and Gemini AI.</p><ul><li>JWT authentication protects project APIs.</li><li>Prisma models project collaboration data.</li><li>AI features help with planning, risk analysis, and daily summaries.</li></ul>'],
    ['demo-plan', 'Demo Walkthrough', 'hadi', '<h1>Demo Walkthrough</h1><p>Show login, project dashboard, backlog filtering, sprint board movement, linked documents, notifications, and AI planning support.</p>'],
  ]);

  await ensureSprintDocuments(sprints, documents, [
    ['sprint1', 'architecture'],
    ['sprint2', 'demo-plan'],
  ]);

  await ensureTaskDocuments(tasks, documents, [
    ['schema', 'architecture'],
    ['auth', 'architecture'],
    ['ai-breakdown', 'demo-plan'],
    ['risk', 'demo-plan'],
  ]);

  await ensureComments(users, tasks, [
    ['schema', 'yehia', 'Schema foundation is ready and matches the current Prisma models.', fixedDate('2025-06-10')],
    ['kanban', 'taimour', 'Board columns are wired up. I am polishing drag states before review.', fixedDate('2025-06-14')],
    ['ai-breakdown', 'hadi', 'Keep this in the backlog so the AI planning flow has a clear feature example.', fixedDate('2025-06-17')],
    ['documents', 'abed', 'Linked docs make the task detail page feel much closer to the final product.', fixedDate('2025-06-18')],
  ]);

  await ensureNotifications(users, [
    ['yehia', 'TASK_ASSIGNED', 'You were assigned "Set up authentication system".', false, fixedDate('2025-06-09')],
    ['taimour', 'TASK_ASSIGNED', 'You were assigned "Build Kanban board UI".', false, fixedDate('2025-06-09')],
    ['hadi', 'COMMENT_ADDED', 'Abed commented on "Create project document workspace".', true, fixedDate('2025-06-18')],
  ]);

  await ensureProjectActivities(project, users, [
    ['PROJECT_CREATED', project.name, 'Created the original WorkWise demo project.', 'yehia', fixedDate('2025-06-09')],
    ['SPRINT_STARTED', sprints.sprint1.name, 'Started foundation sprint for authentication, kanban, and core backend work.', 'yehia', fixedDate('2025-06-09')],
    ['DOCUMENT_CREATED', 'Project Architecture', 'Captured the technical architecture for the team demo.', 'yehia', fixedDate('2025-06-11')],
  ]);

  await ensureTaskActivities(users, tasks, [
    ['schema', 'STATUS_CHANGED', 'Moved database schema to Done.', 'yehia', fixedDate('2025-06-10')],
    ['auth', 'STATUS_CHANGED', 'Moved authentication system to In Progress.', 'yehia', fixedDate('2025-06-12')],
    ['documents', 'STATUS_CHANGED', 'Moved document workspace into review.', 'abed', fixedDate('2025-06-18')],
  ]);

  await ensureDailyDigests(project, users, [
    {
      title: 'Daily Digest - Foundation Sprint',
      summary: 'Authentication, schema design, kanban UI, and project documents are moving through the first WorkWise sprint.',
      completedCount: 1,
      inProgressCount: 2,
      blockerCount: 0,
      source: 'manual',
      generatedByKey: 'yehia',
      createdAt: fixedDate('2025-06-18'),
    },
  ]);

  await ensureSprintRetrospectives(project, users, sprints, [
    {
      sprintKey: 'sprint1',
      whatWentWell: 'The team established the WorkWise foundation and kept the database, auth, and board work aligned.',
      whatDidnt: 'AI planning examples were still thin at the end of the sprint.',
      actionItems: 'Add more realistic backlog tasks before the AI demo and link architecture notes to implementation work.',
      manualNotes: 'Use this project to demonstrate the original AI Project Management Hub story.',
      generatedByKey: 'yehia',
      createdAt: fixedDate('2025-06-20'),
    },
  ]);

  return project;
}

async function seedSmartCampusOperationsPlatform(users) {
  const project = await ensureProject({
    name: 'Smart Campus Operations Platform',
    key: 'SCOP',
    description: 'A platform for managing campus maintenance requests, room reservations, student support tickets, and operational analytics.',
  });

  await ensureProjectMembers(project, users, [
    ['hadi', 'ADMIN'],
    ['yehia', 'ADMIN'],
    ['taimour', 'DEVELOPER'],
    ['abed', 'DEVELOPER'],
    ['maya', 'DEVELOPER'],
    ['karim', 'DEVELOPER'],
    ['sara', 'DEVELOPER'],
    ['omar', 'VIEWER'],
  ]);

  const sprints = await ensureSprints(project, [
    ['sprint1', 'Sprint 1 - Campus Request Foundation', 'Build the intake, authentication, and core request tracking workflow.', daysFromNow(-28), daysFromNow(-15), false],
    ['sprint2', 'Sprint 2 - Reservations And Support', 'Add room reservations, support ticket routing, and staff notifications.', daysFromNow(-14), daysFromNow(-1), false],
    ['sprint3', 'Sprint 3 - Analytics And Operations Control', 'Deliver the operations dashboard, board workflow, AI planning support, and release readiness.', daysFromNow(0), daysFromNow(13), true],
  ]);

  const tasks = await ensureTasks(project, users, sprints, [
    ['auth-sso', 'Configure campus SSO login', 'Allow students, faculty, and operations staff to sign in with institutional credentials.', 'DONE', 'URGENT', 'sprint1', 'yehia', 'hadi', ['auth', 'security', 'frontend'], daysFromNow(-24)],
    ['request-schema', 'Model maintenance request data', 'Create data fields for request category, location, severity, SLA, assignee, and requester.', 'DONE', 'HIGH', 'sprint1', 'abed', 'yehia', ['backend', 'database', 'maintenance'], daysFromNow(-23)],
    ['request-intake', 'Build maintenance request intake form', 'Create a guided form for reporting facility issues from desktop and mobile.', 'DONE', 'HIGH', 'sprint1', 'maya', 'hadi', ['frontend', 'maintenance', 'forms'], daysFromNow(-22)],
    ['status-workflow', 'Define request status workflow', 'Map campus requests to backlog, todo, in progress, review, and done board columns.', 'DONE', 'MEDIUM', 'sprint1', 'taimour', 'yehia', ['workflow', 'kanban'], daysFromNow(-21)],
    ['request-comments', 'Add internal comments to campus requests', 'Allow operations staff to discuss diagnosis, parts, and follow-up needs on each request.', 'DONE', 'MEDIUM', 'sprint1', 'karim', 'hadi', ['comments', 'collaboration'], daysFromNow(-19)],
    ['basic-notifications', 'Send assignment notifications', 'Notify staff when they are assigned a request or support ticket.', 'DONE', 'HIGH', 'sprint1', 'sara', 'yehia', ['notifications', 'realtime'], daysFromNow(-18)],
    ['room-inventory', 'Import room inventory', 'Load campus buildings, room capacities, equipment, and availability metadata.', 'DONE', 'HIGH', 'sprint2', 'abed', 'hadi', ['reservations', 'database'], daysFromNow(-12)],
    ['reservation-form', 'Create room reservation form', 'Build a form for staff to reserve rooms with date, time, capacity, and equipment needs.', 'DONE', 'HIGH', 'sprint2', 'maya', 'yehia', ['frontend', 'reservations', 'forms'], daysFromNow(-10)],
    ['support-routing', 'Route student support tickets by category', 'Automatically route academic, IT, housing, and facilities tickets to the right queue.', 'DONE', 'URGENT', 'sprint2', 'karim', 'hadi', ['support', 'automation', 'backend'], daysFromNow(-9)],
    ['calendar-api', 'Expose reservation calendar API', 'Create API endpoints for room availability and reservation details.', 'DONE', 'MEDIUM', 'sprint2', 'yehia', 'abed', ['api', 'reservations', 'backend'], daysFromNow(-7)],
    ['socket-updates', 'Broadcast request board updates', 'Use realtime events so multiple operations users see board changes without manual refresh.', 'DONE', 'HIGH', 'sprint2', 'taimour', 'yehia', ['realtime', 'socket.io', 'kanban'], daysFromNow(-6)],
    ['reservation-notifications', 'Notify facilities team of room changes', 'Send notifications when room setup, cleanup, or equipment requests are assigned.', 'DONE', 'MEDIUM', 'sprint2', 'sara', 'hadi', ['notifications', 'reservations'], daysFromNow(-5)],
    ['analytics-widgets', 'Build operations analytics widgets', 'Show open requests, urgent tickets, completion rate, and work distribution by assignee.', 'IN_PROGRESS', 'URGENT', 'sprint3', 'hadi', 'yehia', ['analytics', 'dashboard', 'demo'], daysFromNow(3)],
    ['sla-risk', 'Highlight SLA risk on urgent requests', 'Surface requests that are close to missing response or resolution targets.', 'IN_PROGRESS', 'URGENT', 'sprint3', 'sara', 'hadi', ['analytics', 'risk', 'maintenance'], daysFromNow(2)],
    ['ai-breakdown-campus', 'Prepare AI task breakdown prompt examples', 'Create demo-ready feature descriptions for breaking down a campus operations feature.', 'TODO', 'HIGH', 'sprint3', 'maya', 'hadi', ['ai', 'planning', 'demo'], daysFromNow(4)],
    ['ai-sprint-suggestions', 'Seed backlog for AI sprint suggestions', 'Ensure the backlog has enough mixed priority tasks for AI planning recommendations.', 'TODO', 'HIGH', 'sprint3', 'taimour', 'yehia', ['ai', 'sprint-planning', 'backlog'], daysFromNow(5)],
    ['risk-analysis-demo', 'Configure sprint risk analysis demo', 'Prepare active sprint data with realistic WIP, urgent tasks, and review bottlenecks.', 'IN_REVIEW', 'HIGH', 'sprint3', 'abed', 'hadi', ['ai', 'risk', 'sprint'], daysFromNow(1)],
    ['document-linking', 'Link project documents to key tasks', 'Attach overview, API, deployment, and planning notes to tasks and sprints.', 'IN_REVIEW', 'MEDIUM', 'sprint3', 'karim', 'maya', ['documents', 'demo'], daysFromNow(6)],
    ['drag-drop-polish', 'Polish board drag and drop states', 'Make active drag, empty columns, and drop transitions clear for the sprint board demo.', 'TODO', 'MEDIUM', 'sprint3', 'taimour', 'hadi', ['frontend', 'kanban', 'demo'], daysFromNow(7)],
    ['profile-demo', 'Verify user profile update flow', 'Confirm profile edits work for presenter identity and team member context.', 'DONE', 'LOW', 'sprint3', 'omar', 'hadi', ['profile', 'demo'], daysFromNow(8)],
    ['demo-script-rehearsal', 'Rehearse presenter demo flow', 'Walk through login, dashboard, project, backlog, sprint, AI, analytics, documents, notifications, profile, and logout.', 'IN_PROGRESS', 'HIGH', 'sprint3', 'hadi', 'yehia', ['demo', 'scrum-180'], daysFromNow(1)],
    ['mobile-intake', 'Improve mobile request intake layout', 'Optimize the request form for students reporting issues from phones.', 'BACKLOG', 'MEDIUM', null, 'maya', 'hadi', ['mobile', 'frontend', 'maintenance'], daysFromNow(15)],
    ['building-map', 'Add building map references', 'Let users attach building and floor references to maintenance requests.', 'BACKLOG', 'LOW', null, null, 'abed', ['maps', 'maintenance'], daysFromNow(18)],
    ['student-ticket-import', 'Import student support ticket CSV', 'Allow support admins to upload a CSV of legacy student support requests.', 'BACKLOG', 'MEDIUM', null, 'karim', 'yehia', ['support', 'import', 'backend'], daysFromNow(20)],
    ['room-equipment-search', 'Filter rooms by equipment', 'Support search for projectors, hybrid meeting gear, lab benches, and accessibility equipment.', 'BACKLOG', 'HIGH', null, 'sara', 'hadi', ['reservations', 'search', 'filters'], daysFromNow(22)],
    ['maintenance-photo-upload', 'Support photo uploads for maintenance requests', 'Allow requesters to attach photos of damaged equipment or facilities issues.', 'BACKLOG', 'HIGH', null, null, 'maya', ['maintenance', 'uploads', 'frontend'], daysFromNow(25)],
    ['vendor-handoff', 'Create vendor handoff checklist', 'Document what external vendors need before handling facilities repairs.', 'BACKLOG', 'LOW', null, 'omar', 'hadi', ['documents', 'maintenance'], daysFromNow(28)],
    ['analytics-export', 'Export operations analytics summary', 'Generate a CSV summary of tickets by category, status, priority, and assignee.', 'BACKLOG', 'MEDIUM', null, 'yehia', 'hadi', ['analytics', 'export'], daysFromNow(30)],
    ['after-hours-escalation', 'Define after-hours escalation rules', 'Document and implement routing for urgent issues submitted outside normal campus hours.', 'BACKLOG', 'URGENT', null, 'sara', 'yehia', ['notifications', 'risk', 'support'], daysFromNow(10)],
    ['accessibility-audit', 'Run accessibility audit on reservation flow', 'Check keyboard navigation, labels, focus states, and contrast for the reservation workflow.', 'BACKLOG', 'MEDIUM', null, null, 'maya', ['accessibility', 'reservations', 'qa'], daysFromNow(12)],
    ['daily-digest-copy', 'Tune daily digest language', 'Make the operations digest concise enough for a morning standup.', 'BACKLOG', 'LOW', null, 'karim', 'hadi', ['ai', 'digest', 'copy'], daysFromNow(16)],
    ['qa-smoke-test', 'Create demo smoke test checklist', 'Prepare a manual checklist for validating the demo environment before presentation.', 'BACKLOG', 'MEDIUM', null, 'omar', 'hadi', ['qa', 'demo', 'checklist'], daysFromNow(9)],
  ]);

  const documents = await ensureDocuments(project, users, [
    ['overview', 'Project Overview', 'hadi', '<h1>Smart Campus Operations Platform</h1><p>This project centralizes maintenance requests, room reservations, student support tickets, and operational analytics for campus staff.</p><ul><li>Backlog search and filters</li><li>Sprint planning and board movement</li><li>AI-assisted planning and risk review</li><li>Project documentation and notifications</li></ul>'],
    ['api', 'API Notes', 'yehia', '<h1>API Notes</h1><p>The backend exposes authenticated endpoints for projects, tasks, sprints, documents, notifications, daily digests, and retrospectives.</p><ul><li>Search available rooms by date range and capacity.</li><li>Create reservation requests with equipment metadata.</li><li>Return conflict details when a room is unavailable.</li></ul>'],
    ['deployment', 'Deployment Checklist', 'abed', '<h1>Deployment Checklist</h1><ul><li>Confirm frontend environment points to the active API.</li><li>Run Prisma migrations against the target database.</li><li>Verify Gemini API key, SMTP settings, and Socket.io connection.</li><li>Smoke-test login, board movement, documents, and notifications.</li></ul>'],
    ['planning', 'Sprint Planning Notes', 'maya', '<h1>Sprint Planning Notes</h1><p>Sprint 3 focuses on analytics, AI planning support, board polish, document linking, and demo readiness.</p><ul><li>Analytics widgets depend on realistic task distribution.</li><li>AI features need Gemini availability or prepared fallback output.</li><li>Review column must stay visible for the sprint risk demo.</li></ul>'],
  ]);

  await ensureSprintDocuments(sprints, documents, [
    ['sprint1', 'overview'],
    ['sprint2', 'api'],
    ['sprint3', 'planning'],
    ['sprint3', 'deployment'],
  ]);

  await ensureTaskDocuments(tasks, documents, [
    ['analytics-widgets', 'overview'],
    ['calendar-api', 'api'],
    ['document-linking', 'planning'],
    ['demo-script-rehearsal', 'deployment'],
    ['qa-smoke-test', 'deployment'],
    ['ai-breakdown-campus', 'planning'],
  ]);

  await ensureComments(users, tasks, [
    ['auth-sso', 'yehia', 'SSO happy path is ready. I added a note to test expired sessions during the demo rehearsal.', daysFromNow(-24)],
    ['reservation-form', 'hadi', 'Please keep the room equipment fields visible in the first screen. It helps explain the campus use case quickly.', daysFromNow(-10)],
    ['socket-updates', 'taimour', 'Realtime board movement is working in two browser sessions. We should mention Socket.io during the board step.', daysFromNow(-5)],
    ['analytics-widgets', 'sara', 'The analytics cards now show a useful spread across status, priority, and assignee.', daysFromNow(-1)],
    ['document-linking', 'karim', 'I linked the sprint planning notes so the documents page has something meaningful to search for.', daysFromNow(0)],
    ['maintenance-photo-upload', 'maya', 'Keep one unassigned backlog item visible so the filters can show assigned and unassigned work.', daysFromNow(0)],
  ]);

  await ensureNotifications(users, [
    ['hadi', 'SPRINT_STARTED', 'Sprint 3 - Analytics And Operations Control started.', false, daysFromNow(0)],
    ['maya', 'TASK_ASSIGNED', 'You were assigned "Prepare AI task breakdown prompt examples".', false, daysFromNow(0)],
    ['sara', 'TASK_ASSIGNED', 'You were assigned "Highlight SLA risk on urgent requests".', false, daysFromNow(-1)],
    ['karim', 'COMMENT_ADDED', 'Maya added a comment on "Support photo uploads for maintenance requests".', true, daysFromNow(0)],
    ['taimour', 'TASK_MOVED', '"Broadcast request board updates" moved to Done.', true, daysFromNow(-5)],
    ['abed', 'MENTION', 'You were mentioned in the sprint risk analysis demo task.', false, daysFromNow(0)],
    ['omar', 'TASK_ASSIGNED', 'You were assigned "Create demo smoke test checklist".', false, daysFromNow(0)],
  ]);

  await ensureProjectActivities(project, users, [
    ['PROJECT_CREATED', project.name, 'Created demo project for campus operations workflow.', 'hadi', daysFromNow(-30)],
    ['MEMBERS_INVITED', 'Project team', 'Added campus operations, frontend, backend, QA, and viewer roles.', 'hadi', daysFromNow(-29)],
    ['SPRINT_STARTED', sprints.sprint1.name, 'Started foundation work for request intake and authentication.', 'yehia', daysFromNow(-28)],
    ['SPRINT_COMPLETED', sprints.sprint1.name, 'Completed authentication, request intake, comments, and assignment notifications.', 'hadi', daysFromNow(-15)],
    ['SPRINT_STARTED', sprints.sprint2.name, 'Started room reservation and support routing work.', 'hadi', daysFromNow(-14)],
    ['DOCUMENT_CREATED', 'Sprint Planning Notes', 'Documented current sprint goals, risks, and demo talking points.', 'maya', daysFromNow(-2)],
    ['SPRINT_STARTED', sprints.sprint3.name, 'Started analytics, AI support, and demo readiness sprint.', 'hadi', daysFromNow(0)],
  ]);

  await ensureTaskActivities(users, tasks, [
    ['socket-updates', 'STATUS_CHANGED', 'Moved from In Review to Done.', 'taimour', daysFromNow(-5)],
    ['analytics-widgets', 'ASSIGNED', 'Assigned analytics widgets to Hadi for active sprint demo.', 'yehia', daysFromNow(-1)],
    ['analytics-widgets', 'STATUS_CHANGED', 'Moved from Todo to In Progress.', 'hadi', daysFromNow(0)],
    ['document-linking', 'COMMENT_ADDED', 'Added document linking note for the demo.', 'karim', daysFromNow(0)],
    ['risk-analysis-demo', 'STATUS_CHANGED', 'Moved into review to create a realistic review queue.', 'abed', daysFromNow(0)],
  ]);

  await ensureDailyDigests(project, users, [
    {
      title: 'Daily Digest - Sprint 2 Closeout',
      summary: 'Room reservations and support routing are complete. Realtime board updates are working, and notification coverage is ready for the next sprint.',
      completedCount: 6,
      inProgressCount: 0,
      blockerCount: 0,
      source: 'manual',
      generatedByKey: 'hadi',
      createdAt: daysFromNow(-1),
    },
    {
      title: 'Daily Digest - Demo Readiness',
      summary: 'Sprint 3 has active analytics, AI planning, document linking, and demo rehearsal work. SLA risk and review queue items should be watched closely.',
      completedCount: 1,
      inProgressCount: 3,
      blockerCount: 1,
      source: 'manual',
      generatedByKey: 'yehia',
      createdAt: daysFromNow(0),
    },
  ]);

  await ensureSprintRetrospectives(project, users, sprints, [
    {
      sprintKey: 'sprint1',
      whatWentWell: 'The team completed the request intake foundation, authentication, comments, and assignment notifications on schedule.',
      whatDidnt: 'Some acceptance criteria were added late, which made the first review pass slower than expected.',
      actionItems: 'Create acceptance criteria before sprint start and link planning documents to high-priority work.',
      manualNotes: 'Keep the request intake flow in the demo because it explains the campus operations domain quickly.',
      generatedByKey: 'hadi',
      createdAt: daysFromNow(-15),
    },
    {
      sprintKey: 'sprint2',
      whatWentWell: 'Reservation API, support routing, and realtime board updates shipped together and created a stronger product story.',
      whatDidnt: 'Room inventory assumptions changed mid-sprint and required extra validation work.',
      actionItems: 'Add API notes earlier and keep sample room data stable before demo rehearsal.',
      manualNotes: 'Mention Socket.io when showing the board because it connects the demo to the architecture.',
      generatedByKey: 'yehia',
      createdAt: daysFromNow(-1),
    },
  ]);

  return project;
}

function findDuplicateKeys(rows, keyFn) {
  const counts = new Map();

  for (const row of rows) {
    const key = keyFn(row);
    counts.set(key, (counts.get(key) || 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([key, count]) => ({ key, count }));
}

async function verifyDemoData() {
  const projects = await prisma.project.findMany({
    where: { key: { in: ['AIWW', 'SCOP'] } },
    include: {
      _count: {
        select: {
          members: true,
          sprints: true,
          tasks: true,
          documents: true,
          activities: true,
          dailyDigests: true,
          retrospectives: true,
        },
      },
    },
    orderBy: { key: 'asc' },
  });

  const projectIds = projects.map((project) => project.id);
  const [tasks, sprints, documents, comments, notifications] = await Promise.all([
    prisma.task.findMany({
      where: { projectId: { in: projectIds } },
      select: { projectId: true, title: true },
    }),
    prisma.sprint.findMany({
      where: { projectId: { in: projectIds } },
      select: { projectId: true, name: true },
    }),
    prisma.document.findMany({
      where: { projectId: { in: projectIds } },
      select: { projectId: true, title: true },
    }),
    prisma.comment.findMany({
      where: { task: { projectId: { in: projectIds } } },
      select: { taskId: true, authorId: true, content: true },
    }),
    prisma.notification.findMany({
      where: {
        user: {
          projectMembers: {
            some: { projectId: { in: projectIds } },
          },
        },
      },
      select: { userId: true, type: true, message: true },
    }),
  ]);

  const duplicateReport = {
    tasks: findDuplicateKeys(tasks, (task) => `${task.projectId}|${task.title}`),
    sprints: findDuplicateKeys(sprints, (sprint) => `${sprint.projectId}|${sprint.name}`),
    documents: findDuplicateKeys(documents, (document) => `${document.projectId}|${document.title}`),
    comments: findDuplicateKeys(
      comments,
      (comment) => `${comment.taskId}|${comment.authorId}|${comment.content}`,
    ),
    notifications: findDuplicateKeys(
      notifications,
      (notification) => `${notification.userId}|${notification.type}|${notification.message}`,
    ),
  };

  const missingProjects = ['AIWW', 'SCOP'].filter((key) => !projects.some((project) => project.key === key));
  const duplicateKinds = Object.entries(duplicateReport).filter(([, duplicates]) => duplicates.length > 0);

  if (missingProjects.length > 0 || duplicateKinds.length > 0) {
    throw new Error(
      `Demo verification failed. Missing projects: ${missingProjects.join(', ') || 'none'}. Duplicate groups: ${
        duplicateKinds.map(([kind]) => kind).join(', ') || 'none'
      }.`,
    );
  }

  return projects;
}

async function seedDemo() {
  console.log('Seeding demo data without deleting existing records...');

  const hashedPassword = await bcrypt.hash(demoPassword, 10);
  const userData = [
    { key: 'hadi', name: 'Hadi Wehbe', email: 'hadi@team1.com' },
    { key: 'yehia', name: 'Yehia Fayyad', email: 'yehia@team1.com' },
    { key: 'taimour', name: 'Taimour Shmait', email: 'taimour@team1.com' },
    { key: 'abed', name: 'Abed Al-Hamid', email: 'abed@team1.com' },
    { key: 'maya', name: 'Maya Haddad', email: 'maya@team1.com' },
    { key: 'karim', name: 'Karim Nasser', email: 'karim@team1.com' },
    { key: 'sara', name: 'Sara Mansour', email: 'sara@team1.com' },
    { key: 'omar', name: 'Omar Khalil', email: 'omar@team1.com' },
  ];

  const users = {};
  for (const user of userData) {
    users[user.key] = await ensureUser(user, hashedPassword);
  }

  const aiProject = await seedAiProjectManagementHub(users);
  const campusProject = await seedSmartCampusOperationsPlatform(users);
  const verifiedProjects = await verifyDemoData();

  console.log('Database seeded successfully');
  console.log(`   Demo password for newly-created users: ${demoPassword}`);
  console.log(`   Users available: ${userData.map(({ name }) => name).join(', ')}`);
  console.log(`   Projects available: ${aiProject.name} (${aiProject.key}), ${campusProject.name} (${campusProject.key})`);
  for (const project of verifiedProjects) {
    console.log(
      `   Verified ${project.name}: ${project._count.members} members, ${project._count.sprints} sprints, ${project._count.tasks} tasks, ${project._count.documents} documents`,
    );
  }
}

seedDemo()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
