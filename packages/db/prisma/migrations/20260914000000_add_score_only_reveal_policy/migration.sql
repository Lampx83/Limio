-- Hiện điểm cuối cùng ngay, nhưng không hiện đáp án/câu nào đúng-sai. Xem
-- reveal-policy.ts. Cùng cách thêm giá trị enum như html_block trước đó.
ALTER TYPE "ExamRevealPolicy" ADD VALUE IF NOT EXISTS 'score_only';
