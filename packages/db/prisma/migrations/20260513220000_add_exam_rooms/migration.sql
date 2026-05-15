-- P0 phòng thi (exam rooms). One proctor per room, 0..N graders.

-- AlterTable: ExamCandidate gets optional room assignment
ALTER TABLE "ExamCandidate" ADD COLUMN "roomId" TEXT;

-- CreateTable
CREATE TABLE "ExamRoom" (
    "id" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "proctorUserId" TEXT NOT NULL,
    "locationNote" TEXT,
    "ipAllowlist" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ExamRoom_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamRoomGrader" (
    "roomId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExamRoomGrader_pkey" PRIMARY KEY ("roomId", "userId")
);

-- CreateIndex
CREATE UNIQUE INDEX "ExamRoom_examId_name_key" ON "ExamRoom"("examId", "name");
CREATE INDEX "ExamRoom_examId_idx" ON "ExamRoom"("examId");
CREATE INDEX "ExamRoom_proctorUserId_idx" ON "ExamRoom"("proctorUserId");
CREATE INDEX "ExamRoomGrader_userId_idx" ON "ExamRoomGrader"("userId");
CREATE INDEX "ExamCandidate_roomId_idx" ON "ExamCandidate"("roomId");

-- AddForeignKey
ALTER TABLE "ExamCandidate" ADD CONSTRAINT "ExamCandidate_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "ExamRoom"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ExamRoom" ADD CONSTRAINT "ExamRoom_examId_fkey"
  FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamRoom" ADD CONSTRAINT "ExamRoom_proctorUserId_fkey"
  FOREIGN KEY ("proctorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ExamRoomGrader" ADD CONSTRAINT "ExamRoomGrader_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "ExamRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExamRoomGrader" ADD CONSTRAINT "ExamRoomGrader_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
