-- B16 — khoá học mở tự do hay chỉ vào bằng link mời lớp.
-- Mặc định 'open': mọi khoá đang có giữ nguyên hành vi.
CREATE TYPE "EnrollMode" AS ENUM ('open', 'invite_only');

ALTER TABLE "Course"
  ADD COLUMN "enrollMode" "EnrollMode" NOT NULL DEFAULT 'open';
