-- LANG G2 — khối từ vựng (vocab_list) và hội thoại (dialogue). Chỉ thêm giá trị
-- enum, cùng cách với audio/html_block/teacher_note trước đó.
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'vocab_list';
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'dialogue';
