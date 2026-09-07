-- Bán token: gói + đơn mua thanh toán bằng chuyển khoản, admin đối soát.

CREATE TYPE "AiTokenOrderStatus" AS ENUM ('pending', 'paid', 'cancelled');

CREATE TABLE "AiTokenPackage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    -- Giá bằng ĐỒNG, không phải cents: VND không có phần lẻ.
    "priceVnd" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTokenPackage_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AiTokenOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "packageId" TEXT NOT NULL,
    "tokens" INTEGER NOT NULL,
    "priceVnd" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "status" "AiTokenOrderStatus" NOT NULL DEFAULT 'pending',
    "note" TEXT,
    "confirmedBy" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiTokenOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AiTokenOrder_code_key" ON "AiTokenOrder"("code");
CREATE INDEX "AiTokenOrder_userId_createdAt_idx" ON "AiTokenOrder"("userId", "createdAt");
CREATE INDEX "AiTokenOrder_status_createdAt_idx" ON "AiTokenOrder"("status", "createdAt");

ALTER TABLE "AiTokenOrder" ADD CONSTRAINT "AiTokenOrder_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AiTokenOrder" ADD CONSTRAINT "AiTokenOrder_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "AiTokenPackage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Ba gói khởi điểm. Giá vốn thật ~5,7đ/1.000 token, nên phần lớn giá bán ở đây
-- là chi phí đối soát thủ công của admin chứ không phải tiền API — đó là lý do
-- gói nhỏ nhất vẫn 20.000đ. Admin sửa/tắt qua bảng này.
INSERT INTO "AiTokenPackage" ("id", "name", "tokens", "priceVnd", "sortOrder", "updatedAt") VALUES
  ('a0000000-0000-4000-8000-000000000001', 'Gói nhỏ — 200.000 token',   200000, 20000, 1, NOW()),
  ('a0000000-0000-4000-8000-000000000002', 'Gói vừa — 500.000 token',   500000, 45000, 2, NOW()),
  ('a0000000-0000-4000-8000-000000000003', 'Gói lớn — 1.000.000 token', 1000000, 80000, 3, NOW())
ON CONFLICT ("id") DO NOTHING;
