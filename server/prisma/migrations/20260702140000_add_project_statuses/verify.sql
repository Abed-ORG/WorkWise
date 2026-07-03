-- Run these against the Supabase SQL editor right after applying migration.sql, before COMMIT
-- is trusted as final. All four should return 0 rows / 0 counts on success.

-- 1. No task should be left without a status.
SELECT COUNT(*) AS null_status_count
FROM "tasks"
WHERE "statusId" IS NULL;

-- 2. No task's statusId should point at a ProjectStatus belonging to a different project.
SELECT COUNT(*) AS cross_project_mismatch_count
FROM "tasks" t
JOIN "project_statuses" ps ON ps."id" = t."statusId"
WHERE ps."projectId" != t."projectId";

-- 3. Every project should have exactly the 5 seeded statuses (including projects that
--    ended up with 0 rows, which the LEFT JOIN + COALESCE catches).
SELECT COUNT(*) AS mismatched_project_count
FROM "projects" p
LEFT JOIN (
    SELECT "projectId", COUNT(*) AS cnt
    FROM "project_statuses"
    GROUP BY "projectId"
) s ON s."projectId" = p."id"
WHERE COALESCE(s."cnt", 0) != 5;

-- 4. Category distribution sanity check: expect TODO = 2x, IN_PROGRESS = 2x, DONE = 1x
--    the number of projects.
SELECT "category", COUNT(*) AS status_count
FROM "project_statuses"
GROUP BY "category"
ORDER BY "category";
