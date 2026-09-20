-- TimerTemplate: cỡ chữ ghi chú (sm | md | lg | xl). Nullable: mẫu cũ không có giá trị, giao diện dùng md.
ALTER TABLE "TimerTemplate" ADD COLUMN "noteSize" TEXT;
