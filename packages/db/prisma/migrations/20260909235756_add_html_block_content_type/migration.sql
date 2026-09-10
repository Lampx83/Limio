-- GV upload 1 file .html, hiển thị trong lesson qua iframe sandbox (không
-- allow-same-origin). Cùng cách thêm giá trị enum như teacher_note trước đó.
ALTER TYPE "ContentType" ADD VALUE IF NOT EXISTS 'html_block';
