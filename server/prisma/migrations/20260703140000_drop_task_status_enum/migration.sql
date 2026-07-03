-- Drops the legacy TaskStatus enum, which has been unused since the custom-statuses migration
-- (20260702140000_add_project_statuses) replaced tasks.status with tasks.statusId → project_statuses.
-- No column references this type; safe to drop.

BEGIN;

DROP TYPE IF EXISTS "TaskStatus";

COMMIT;
