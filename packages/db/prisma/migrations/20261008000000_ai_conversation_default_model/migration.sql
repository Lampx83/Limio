-- Chat chuyển sang LLM tự host (Qwen3.5 qua vLLM): hội thoại MỚI mặc định ghi model này.
-- Chỉ đổi DEFAULT của cột; hàng cũ giữ nguyên giá trị lịch sử (code không đọc lại cột này
-- để chọn model gọi, xem runChatTurn).
ALTER TABLE "AiConversation" ALTER COLUMN "model" SET DEFAULT 'qwen3.5-35b-a3b-int4';
