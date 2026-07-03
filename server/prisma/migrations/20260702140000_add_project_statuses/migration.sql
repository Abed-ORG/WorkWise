BEGIN;

-- Ensure gen_random_uuid() is available for generating project_statuses ids during backfill.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateEnum
CREATE TYPE "StatusCategory" AS ENUM ('TODO', 'IN_PROGRESS', 'DONE');

-- CreateTable
CREATE TABLE "project_statuses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "StatusCategory" NOT NULL,
    "order" INTEGER NOT NULL,
    "color" TEXT,
    "isBacklogDefault" BOOLEAN NOT NULL DEFAULT false,
    "isSprintDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "project_statuses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_statuses_projectId_name_key" ON "project_statuses"("projectId", "name");

-- CreateIndex
CREATE INDEX "project_statuses_projectId_order_idx" ON "project_statuses"("projectId", "order");

-- AddForeignKey
ALTER TABLE "project_statuses" ADD CONSTRAINT "project_statuses_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed 5 default statuses per existing project: Backlog/To Do (TODO), In Progress/In Review (IN_PROGRESS), Done (DONE).
INSERT INTO "project_statuses" ("id", "name", "category", "order", "isBacklogDefault", "isSprintDefault", "createdAt", "updatedAt", "projectId")
SELECT gen_random_uuid()::text, v.name, v.category::"StatusCategory", v.ord, v.is_backlog, v.is_sprint, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, p.id
FROM "projects" p
CROSS JOIN (
    VALUES
        ('Backlog',     'TODO',        0, true,  false),
        ('To Do',       'TODO',        1, false, true),
        ('In Progress', 'IN_PROGRESS', 2, false, false),
        ('In Review',   'IN_PROGRESS', 3, false, false),
        ('Done',        'DONE',        4, false, false)
) AS v(name, category, ord, is_backlog, is_sprint);

-- AlterTable: add statusId nullable first so we can backfill before enforcing NOT NULL.
ALTER TABLE "tasks" ADD COLUMN "statusId" TEXT;

-- Backfill statusId from the legacy status enum, matching the seeded row within the same project.
UPDATE "tasks" t
SET "statusId" = ps."id"
FROM "project_statuses" ps
WHERE ps."projectId" = t."projectId"
  AND ps."name" = CASE t."status"
        WHEN 'BACKLOG' THEN 'Backlog'
        WHEN 'TODO' THEN 'To Do'
        WHEN 'IN_PROGRESS' THEN 'In Progress'
        WHEN 'IN_REVIEW' THEN 'In Review'
        WHEN 'DONE' THEN 'Done'
      END;

-- Safety net: aborts the whole transaction if any task failed to match a seeded status.
ALTER TABLE "tasks" ALTER COLUMN "statusId" SET NOT NULL;

-- DropIndex: old status-based composite indexes
DROP INDEX IF EXISTS "tasks_projectId_status_idx";
DROP INDEX IF EXISTS "tasks_sprintId_status_idx";
DROP INDEX IF EXISTS "tasks_assigneeId_status_idx";

-- AlterTable: drop legacy enum column, now fully superseded by statusId
ALTER TABLE "tasks" DROP COLUMN "status";

-- CreateIndex
CREATE INDEX "tasks_projectId_statusId_idx" ON "tasks"("projectId", "statusId");

-- CreateIndex
CREATE INDEX "tasks_sprintId_statusId_idx" ON "tasks"("sprintId", "statusId");

-- CreateIndex
CREATE INDEX "tasks_assigneeId_statusId_idx" ON "tasks"("assigneeId", "statusId");

-- AddForeignKey
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES "project_statuses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
