-- Escape hatch: reverses 20260702140000_add_project_statuses.
-- Run this manually in the Supabase SQL editor if the forward migration needs to be undone.
-- Caveat: if any task was moved to a status whose name is not one of the 5 seeded defaults
-- (i.e. a custom status created after this migration), it falls back to 'BACKLOG' below since
-- there is no corresponding TaskStatus enum value to restore it to.

BEGIN;

-- Recreate TaskStatus enum if it's missing. The forward migration never drops it (schema.prisma
-- keeps it declared), so this only fires if something else removed it out of band.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskStatus') THEN
    CREATE TYPE "TaskStatus" AS ENUM ('BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE');
  END IF;
END
$$;

-- Add back the legacy status column, nullable first so we can backfill it.
ALTER TABLE "tasks" ADD COLUMN "status" "TaskStatus";

-- Backfill status from project_statuses.name via the current statusId.
UPDATE "tasks" t
SET "status" = CASE ps."name"
      WHEN 'Backlog' THEN 'BACKLOG'::"TaskStatus"
      WHEN 'To Do' THEN 'TODO'::"TaskStatus"
      WHEN 'In Progress' THEN 'IN_PROGRESS'::"TaskStatus"
      WHEN 'In Review' THEN 'IN_REVIEW'::"TaskStatus"
      WHEN 'Done' THEN 'DONE'::"TaskStatus"
      ELSE 'BACKLOG'::"TaskStatus"
    END
FROM "project_statuses" ps
WHERE ps."id" = t."statusId";

ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'BACKLOG';
ALTER TABLE "tasks" ALTER COLUMN "status" SET NOT NULL;

-- Drop the new FK, indexes, and column.
ALTER TABLE "tasks" DROP CONSTRAINT IF EXISTS "tasks_statusId_fkey";
DROP INDEX IF EXISTS "tasks_projectId_statusId_idx";
DROP INDEX IF EXISTS "tasks_sprintId_statusId_idx";
DROP INDEX IF EXISTS "tasks_assigneeId_statusId_idx";
ALTER TABLE "tasks" DROP COLUMN "statusId";

-- Restore the old status-based composite indexes.
CREATE INDEX "tasks_projectId_status_idx" ON "tasks"("projectId", "status");
CREATE INDEX "tasks_sprintId_status_idx" ON "tasks"("sprintId", "status");
CREATE INDEX "tasks_assigneeId_status_idx" ON "tasks"("assigneeId", "status");

-- Drop project_statuses and the StatusCategory enum.
DROP TABLE IF EXISTS "project_statuses";
DROP TYPE IF EXISTS "StatusCategory";

COMMIT;
