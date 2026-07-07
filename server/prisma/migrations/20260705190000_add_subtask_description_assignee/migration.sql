-- AlterTable: additive, nullable-only columns so subtasks can carry a description
-- and an optional assignee without affecting existing rows.
ALTER TABLE "task_checklist_items" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "task_checklist_items" ADD COLUMN IF NOT EXISTS "assigneeId" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "task_checklist_items_assigneeId_idx" ON "task_checklist_items"("assigneeId");

-- AddForeignKey
ALTER TABLE "task_checklist_items" ADD CONSTRAINT "task_checklist_items_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
