-- VNPay: mã giao dịch phía cổng. Nullable, đơn cũ giữ NULL.
ALTER TABLE "Order" ADD COLUMN "gatewayTxnRef" TEXT;
