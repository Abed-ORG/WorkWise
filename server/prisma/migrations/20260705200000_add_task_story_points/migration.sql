-- AlterTable: additive, nullable — safe to leave unapplied until merge day.
-- estimatedHours is intentionally left in place; it will be dropped in a
-- separate merge-day migration once zero code references it (see DB CHANGES STACK).
ALTER TABLE "tasks" ADD COLUMN "storyPoints" INTEGER;
