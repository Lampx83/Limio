-- Trần token/ngày toàn hệ thống cộng tổng AiUsageLog theo dayKey mà không kèm
-- userId. Unique (userId, dayKey, model) không phục vụ được truy vấn đó vì cột
-- dẫn đầu là userId, nên nếu thiếu index này thì mỗi lượt gọi AI là một lần
-- quét toàn bảng.
CREATE INDEX IF NOT EXISTS "AiUsageLog_dayKey_idx" ON "AiUsageLog"("dayKey");
