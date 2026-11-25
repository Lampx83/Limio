-- Cổng thanh toán SePay (docs/tieu-chi/thanh-toan-sepay-pg.md): thêm giá trị enum, không đụng dữ liệu hiện có.
ALTER TYPE "PaymentProvider" ADD VALUE 'sepay_pg';
