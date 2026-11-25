-- Chuyển khoản tự động qua SePay (docs/tieu-chi/thanh-toan-sepay.md). Giá trị enum mới + bảng nhật ký; dữ liệu hiện có không đổi.
ALTER TYPE "PaymentProvider" ADD VALUE 'sepay';

CREATE TYPE "BankTransactionStatus" AS ENUM ('matched', 'unmatched', 'amount_mismatch', 'duplicate_payment', 'ignored');

CREATE TABLE "BankTransaction" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "gateway" TEXT,
    "accountNumber" TEXT,
    "referenceCode" TEXT,
    "transactedAt" TIMESTAMP(3),
    "status" "BankTransactionStatus" NOT NULL,
    "orderId" TEXT,
    "overpaidAmount" INTEGER,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BankTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BankTransaction_provider_externalId_key" ON "BankTransaction"("provider", "externalId");
CREATE INDEX "BankTransaction_status_receivedAt_idx" ON "BankTransaction"("status", "receivedAt");
