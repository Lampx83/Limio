-- Dải mạng được phép vào thi theo từng trường (Organization).
--
-- Chỉ cộng thêm một cột mảng, mặc định rỗng = không giới hạn nên không đổi hành
-- vi của trường nào đang có. IF NOT EXISTS để chạy lại an toàn.
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "examAllowedIps" TEXT[] DEFAULT ARRAY[]::TEXT[];
