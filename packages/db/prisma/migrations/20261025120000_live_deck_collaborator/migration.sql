-- Đồng giảng viên của bài giảng Limio-Live (docs/tieu-chi/dong-giang-vien-bai-giang.md).
CREATE TABLE "LiveDeckCollaborator" (
    "deckId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LiveDeckCollaborator_pkey" PRIMARY KEY ("deckId","userId")
);

CREATE INDEX "LiveDeckCollaborator_userId_idx" ON "LiveDeckCollaborator"("userId");

ALTER TABLE "LiveDeckCollaborator" ADD CONSTRAINT "LiveDeckCollaborator_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "LiveDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LiveDeckCollaborator" ADD CONSTRAINT "LiveDeckCollaborator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
