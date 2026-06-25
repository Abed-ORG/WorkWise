CREATE INDEX IF NOT EXISTS "projects_updatedAt_idx" ON "projects"("updatedAt");

CREATE INDEX IF NOT EXISTS "project_members_projectId_idx" ON "project_members"("projectId");
CREATE INDEX IF NOT EXISTS "project_members_userId_role_idx" ON "project_members"("userId", "role");

CREATE INDEX IF NOT EXISTS "sprints_projectId_isActive_idx" ON "sprints"("projectId", "isActive");
CREATE INDEX IF NOT EXISTS "sprints_projectId_startDate_idx" ON "sprints"("projectId", "startDate");
CREATE INDEX IF NOT EXISTS "sprints_projectId_endDate_idx" ON "sprints"("projectId", "endDate");

CREATE INDEX IF NOT EXISTS "tasks_projectId_status_idx" ON "tasks"("projectId", "status");
CREATE INDEX IF NOT EXISTS "tasks_projectId_sprintId_idx" ON "tasks"("projectId", "sprintId");
CREATE INDEX IF NOT EXISTS "tasks_projectId_updatedAt_idx" ON "tasks"("projectId", "updatedAt");
CREATE INDEX IF NOT EXISTS "tasks_projectId_createdAt_idx" ON "tasks"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "tasks_sprintId_status_idx" ON "tasks"("sprintId", "status");
CREATE INDEX IF NOT EXISTS "tasks_assigneeId_status_idx" ON "tasks"("assigneeId", "status");
CREATE INDEX IF NOT EXISTS "tasks_assigneeId_updatedAt_idx" ON "tasks"("assigneeId", "updatedAt");

CREATE INDEX IF NOT EXISTS "task_activities_taskId_createdAt_idx" ON "task_activities"("taskId", "createdAt");
CREATE INDEX IF NOT EXISTS "task_activities_userId_createdAt_idx" ON "task_activities"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "documents_projectId_updatedAt_idx" ON "documents"("projectId", "updatedAt");
CREATE INDEX IF NOT EXISTS "documents_projectId_createdAt_idx" ON "documents"("projectId", "createdAt");
CREATE INDEX IF NOT EXISTS "documents_authorId_updatedAt_idx" ON "documents"("authorId", "updatedAt");

CREATE INDEX IF NOT EXISTS "notifications_userId_isRead_createdAt_idx" ON "notifications"("userId", "isRead", "createdAt");
CREATE INDEX IF NOT EXISTS "notifications_userId_createdAt_idx" ON "notifications"("userId", "createdAt");

CREATE INDEX IF NOT EXISTS "invitations_email_status_idx" ON "invitations"("email", "status");
CREATE INDEX IF NOT EXISTS "invitations_projectId_status_idx" ON "invitations"("projectId", "status");
CREATE INDEX IF NOT EXISTS "invitations_senderId_createdAt_idx" ON "invitations"("senderId", "createdAt");
