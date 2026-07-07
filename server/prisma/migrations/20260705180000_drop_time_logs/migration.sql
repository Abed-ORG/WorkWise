-- Removes the time-logging feature (introduced in 20260630110000_scrum_228_task_enhancements)
-- per demo feedback: time tracking is being dropped entirely. Application code (routes,
-- controllers, service functions, client UI) has already been removed in the same change;
-- this migration only needs to drop the now-unreferenced table.

BEGIN;

-- DropForeignKey
ALTER TABLE "time_logs" DROP CONSTRAINT IF EXISTS "time_logs_taskId_fkey";
ALTER TABLE "time_logs" DROP CONSTRAINT IF EXISTS "time_logs_userId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "time_logs_taskId_createdAt_idx";
DROP INDEX IF EXISTS "time_logs_userId_createdAt_idx";

-- DropTable
DROP TABLE IF EXISTS "time_logs";

COMMIT;
