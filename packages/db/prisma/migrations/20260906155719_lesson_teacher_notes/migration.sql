-- Ghi chú giảng viên: một loại nội dung riêng thay vì mượn cờ isHidden.
-- Postgres ≥ 12 cho phép ADD VALUE trong transaction miễn là không dùng giá
-- trị mới ngay trong chính transaction đó — migration này không dùng.
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'teacher_note';
