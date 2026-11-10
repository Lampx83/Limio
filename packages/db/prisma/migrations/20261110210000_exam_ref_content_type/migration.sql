-- Khối "Đề thi" (exam_ref) gắn đề thi thử của khoá vào bài học. Chỉ thêm giá trị enum, cùng cách với exam_practice.
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'exam_ref';
