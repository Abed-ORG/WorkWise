-- AlterTable: additive only — new enum, a NOT NULL column with a default (safe,
-- backfills existing rows to 'STORY' without a table rewrite on PG 11+), and a
-- nullable self-relation column. Authored but NOT applied — see DB CHANGES STACK.

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('STORY', 'BUG', 'SUBTASK');

-- AlterTable
ALTER TABLE "tasks" ADD COLUMN "type" "TaskType" NOT NULL DEFAULT 'STORY';
ALTER TABLE "tasks" ADD COLUMN "parentId" TEXT;

-- CreateIndex
CREATE INDEX "tasks_parentId_idx" ON "tasks"("parentId");
CREATE INDEX "tasks_projectId_parentId_idx" ON "tasks"("projectId", "parentId");

-- AddForeignKey
-- Deleting a parent task deletes its subtasks — subtasks have no independent
-- existence once the parent story/bug they belong to is removed.
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
