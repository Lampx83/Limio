-- Padlet Board (InteractiveBoard + BoardNote)
-- Standalone teaching tool: instructor tạo board → sinh viên join bằng code →
-- post note text → realtime broadcast tới host view qua SSE/Redis Streams.

-- CreateTable
CREATE TABLE "InteractiveBoard" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "sessionId" TEXT,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "prompt" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "InteractiveBoard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardNote" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "authorId" TEXT,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "color" TEXT,
    "hidden" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BoardNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InteractiveBoard_code_key" ON "InteractiveBoard"("code");
CREATE INDEX "InteractiveBoard_ownerId_createdAt_idx" ON "InteractiveBoard"("ownerId", "createdAt");
CREATE INDEX "InteractiveBoard_sessionId_idx" ON "InteractiveBoard"("sessionId");
CREATE INDEX "InteractiveBoard_status_createdAt_idx" ON "InteractiveBoard"("status", "createdAt");

CREATE INDEX "BoardNote_boardId_createdAt_idx" ON "BoardNote"("boardId", "createdAt");
CREATE INDEX "BoardNote_boardId_hidden_createdAt_idx" ON "BoardNote"("boardId", "hidden", "createdAt");
CREATE INDEX "BoardNote_authorId_idx" ON "BoardNote"("authorId");

-- AddForeignKey
ALTER TABLE "InteractiveBoard" ADD CONSTRAINT "InteractiveBoard_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ClassroomSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "InteractiveBoard" ADD CONSTRAINT "InteractiveBoard_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BoardNote" ADD CONSTRAINT "BoardNote_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "InteractiveBoard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BoardNote" ADD CONSTRAINT "BoardNote_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
