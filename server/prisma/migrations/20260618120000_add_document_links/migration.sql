-- CreateTable
CREATE TABLE "task_documents" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "taskId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "task_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sprint_documents" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sprintId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "sprint_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "task_documents_taskId_documentId_key" ON "task_documents"("taskId", "documentId");

-- CreateIndex
CREATE INDEX "task_documents_documentId_idx" ON "task_documents"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "sprint_documents_sprintId_documentId_key" ON "sprint_documents"("sprintId", "documentId");

-- CreateIndex
CREATE INDEX "sprint_documents_documentId_idx" ON "sprint_documents"("documentId");

-- AddForeignKey
ALTER TABLE "task_documents" ADD CONSTRAINT "task_documents_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "task_documents" ADD CONSTRAINT "task_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_documents" ADD CONSTRAINT "sprint_documents_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sprint_documents" ADD CONSTRAINT "sprint_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
