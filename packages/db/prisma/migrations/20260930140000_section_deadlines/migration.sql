-- CreateTable
CREATE TABLE "AssignmentSectionDue" (
    "assignmentId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AssignmentSectionDue_pkey" PRIMARY KEY ("assignmentId","sectionId")
);
-- CreateTable
CREATE TABLE "QuizSectionSchedule" (
    "quizId" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "opensAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "QuizSectionSchedule_pkey" PRIMARY KEY ("quizId","sectionId")
);
-- CreateIndex
CREATE INDEX "AssignmentSectionDue_sectionId_idx" ON "AssignmentSectionDue"("sectionId");
-- CreateIndex
CREATE INDEX "QuizSectionSchedule_sectionId_idx" ON "QuizSectionSchedule"("sectionId");
-- AddForeignKey
ALTER TABLE "AssignmentSectionDue" ADD CONSTRAINT "AssignmentSectionDue_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "AssignmentSectionDue" ADD CONSTRAINT "AssignmentSectionDue_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "QuizSectionSchedule" ADD CONSTRAINT "QuizSectionSchedule_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- AddForeignKey
ALTER TABLE "QuizSectionSchedule" ADD CONSTRAINT "QuizSectionSchedule_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "Cohort"("id") ON DELETE CASCADE ON UPDATE CASCADE;
