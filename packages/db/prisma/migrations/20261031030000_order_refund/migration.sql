-- AC4: khớp sự kiện hoàn tiền Stripe với đơn. Cả hai cột nullable; đơn cũ giữ NULL.
ALTER TABLE "Order" ADD COLUMN "paymentIntentRef" TEXT;
ALTER TABLE "Order" ADD COLUMN "refundedCents" INTEGER;

CREATE UNIQUE INDEX "Order_paymentIntentRef_key" ON "Order"("paymentIntentRef");
