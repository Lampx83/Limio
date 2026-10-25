-- CreateTable
CREATE TABLE "NarrationVoiceLabel" (
    "voice" TEXT NOT NULL,
    "region" TEXT NOT NULL,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NarrationVoiceLabel_pkey" PRIMARY KEY ("voice")
);
