-- Ví token AI: hạn mức tháng theo vai trò + phần mua thêm.
-- AiUsageLog nói "đã tiêu bao nhiêu"; hai bảng này nói "được tiêu bao nhiêu nữa".

CREATE TYPE "AiTokenLedgerKind" AS ENUM ('monthly_grant', 'purchase', 'consumption', 'admin_adjustment', 'refund');

CREATE TABLE "AiTokenLedger" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AiTokenLedgerKind" NOT NULL,
    "amount" INTEGER NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiTokenLedger_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiTokenBalance" (
    "userId" TEXT NOT NULL,
    "purchased" INTEGER NOT NULL DEFAULT 0,
    "monthlyRemaining" INTEGER NOT NULL DEFAULT 0,
    "periodKey" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTokenBalance_pkey" PRIMARY KEY ("userId")
);

-- Chặn cộng trùng: webhook thanh toán gọi lại, hoặc hai request song song cùng
-- cấp hạn mức tháng, đều không được sinh ra hai dòng.
CREATE UNIQUE INDEX "AiTokenLedger_userId_kind_refType_refId_key" ON "AiTokenLedger"("userId", "kind", "refType", "refId");
CREATE INDEX "AiTokenLedger_userId_createdAt_idx" ON "AiTokenLedger"("userId", "createdAt");

ALTER TABLE "AiTokenLedger" ADD CONSTRAINT "AiTokenLedger_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiTokenBalance" ADD CONSTRAINT "AiTokenBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
