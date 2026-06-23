-- CreateTable
CREATE TABLE "daily_digests" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "completedCount" INTEGER NOT NULL DEFAULT 0,
    "inProgressCount" INTEGER NOT NULL DEFAULT 0,
    "blockerCount" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "projectId" TEXT NOT NULL,
    "generatedById" TEXT,

    CONSTRAINT "daily_digests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprint_retrospectives" (
    "id" TEXT NOT NULL,
    "whatWentWell" TEXT NOT NULL,
    "whatDidnt" TEXT NOT NULL,
    "actionItems" TEXT NOT NULL,
    "manualNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "sprintId" TEXT NOT NULL,
    "generatedById" TEXT,

    CONSTRAINT "sprint_retrospectives_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "daily_digests_projectId_createdAt_idx" ON "daily_digests"("projectId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "sprint_retrospectives_sprintId_key" ON "sprint_retrospectives"("sprintId");

-- CreateIndex
CREATE INDEX "sprint_retrospectives_projectId_createdAt_idx" ON "sprint_retrospectives"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "daily_digests" ADD CONSTRAINT "daily_digests_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_digests" ADD CONSTRAINT "daily_digests_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_retrospectives" ADD CONSTRAINT "sprint_retrospectives_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_retrospectives" ADD CONSTRAINT "sprint_retrospectives_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_retrospectives" ADD CONSTRAINT "sprint_retrospectives_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
