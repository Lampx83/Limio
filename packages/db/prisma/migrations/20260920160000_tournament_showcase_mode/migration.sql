-- Tournament: giảng viên chọn khi nào showcase (bài nộp của các đội) mở cho mọi người.
-- "after_end" (mặc định, kể cả giải cũ) chỉ mở sau khi giải kết thúc; "always" mở ngay.
ALTER TABLE "Tournament" ADD COLUMN "showcaseMode" TEXT NOT NULL DEFAULT 'after_end';
