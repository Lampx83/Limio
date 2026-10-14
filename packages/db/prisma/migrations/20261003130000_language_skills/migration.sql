-- LANG G3 — nhãn kỹ năng ngôn ngữ (nghe/nói/đọc/viết) và chế độ ngoại ngữ.
-- Chỉ thêm kiểu enum và cột mới (null/false mặc định), không đổi dữ liệu có sẵn.
CREATE TYPE "LanguageSkill" AS ENUM ('listening', 'speaking', 'reading', 'writing');

ALTER TABLE "Course" ADD COLUMN "languageMode" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lesson" ADD COLUMN "languageSkill" "LanguageSkill";
ALTER TABLE "Skill" ADD COLUMN "languageSkill" "LanguageSkill";
