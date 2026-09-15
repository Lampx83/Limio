-- Rút gọn tên 3 gói token AI. Số token giờ đã hiển thị riêng trong card mua
-- (packages/../me/ai-tokens), lặp lại trong tên gây dài dòng: "Gói nhỏ —
-- 200.000 token" -> "Gói nhỏ". Sửa bằng UPDATE theo id cố định (đặt từ
-- migration 20260908090000_ai_token_packages) thay vì insert lại.
UPDATE "AiTokenPackage" SET "name" = 'Gói nhỏ' WHERE "id" = 'a0000000-0000-4000-8000-000000000001';
UPDATE "AiTokenPackage" SET "name" = 'Gói vừa' WHERE "id" = 'a0000000-0000-4000-8000-000000000002';
UPDATE "AiTokenPackage" SET "name" = 'Gói lớn' WHERE "id" = 'a0000000-0000-4000-8000-000000000003';
