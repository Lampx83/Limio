-- LANG G1 — bài nghe: file audio hoặc link https, có trình phát và lời thoại
-- tuỳ chọn. Cùng cách thêm giá trị enum như html_block/teacher_note trước đó.
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'audio';
