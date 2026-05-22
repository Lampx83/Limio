-- Cho phép đăng ký tham dự khi tournament đã chuyển sang `active`. Mặc định
-- true để giữ backward-compat với solo tournaments (vốn vẫn cho register
-- trong active). Tournament team-based muốn lock composition khi start có
-- thể tắt cờ này.
ALTER TABLE "Tournament" ADD COLUMN "allowLateRegistration" BOOLEAN NOT NULL DEFAULT true;
