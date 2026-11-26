// Nhãn tiếng Việt dùng chung cho giao diện quản trị gói.
export const PLAN_ERROR_TEXT: Record<string, string> = {
  unknown_key: "Có khoá quyền không tồn tại.",
  non_sellable_key: "Có khoá quyền không được đưa vào gói bán.",
  invalid_value_type: "Giá trị không hợp lệ (phải là số nguyên dương hoặc bật/tắt).",
  plan_not_found: "Không tìm thấy gói.",
  plan_inactive: "Gói này đang ngừng bán, không gán được.",
  invalid_subject: "Gói không đúng phạm vi với đối tượng (gói cá nhân cho người, gói tổ chức cho tổ chức).",
  invalid_dates: "Ngày không hợp lệ (ngày kết thúc phải sau ngày bắt đầu).",
  subscription_not_found: "Không tìm thấy thuê bao.",
  subscription_cancelled: "Thuê bao đã huỷ, không gia hạn được.",
  invalid_body: "Thiếu thông tin cần nhập.",
  forbidden: "Chỉ quản trị nền tảng mới làm được.",
  unauthorized: "Phiên đăng nhập đã hết, hãy đăng nhập lại.",
};
export const planErrorText = (code: unknown) =>
  (typeof code === "string" && PLAN_ERROR_TEXT[code]) || "Có lỗi xảy ra, thử lại sau.";

export const PLANS_DISABLED_TEXT = "Gói chưa bật trên máy chủ này; sửa ở đây chưa có tác dụng.";

export const LIMIT_LABELS: Record<string, string> = {
  "activity.max_responses": "Hoạt động nhanh: số lượt trả lời tối đa",
  "gameshow.max_participants": "Gameshow: số người chơi tối đa",
  "exam.session.max_candidates": "Ca thi: số thí sinh tối đa",
  "ai_oral.monthly_attempts": "Chấm nói AI: số lượt mỗi tháng",
  "ai.tokens.monthly_override": "Token AI mỗi tháng",
  "storage.mb": "Dung lượng (MB)",
  "org.max_instructors": "Tổ chức: số giảng viên tối đa",
  "org.active_learners": "Tổ chức: số học viên đang học tối đa",
};
export const BOOLEAN_LABELS: Record<string, string> = {
  "limio_live.access": "Limio-Live",
  "ai_oral.access": "Chấm nói AI",
  "center.access": "Chức năng trung tâm",
};

export type SubStatus = "active" | "expired" | "cancelled" | "upcoming";
export const SUB_STATUS_LABEL: Record<SubStatus, string> = {
  active: "Hiệu lực",
  expired: "Đã hết",
  cancelled: "Đã huỷ",
  upcoming: "Chưa bắt đầu",
};
export function subStatus(s: { startsAt: string; endsAt: string; cancelledAt: string | null }, now = new Date()): SubStatus {
  if (s.cancelledAt) return "cancelled";
  if (new Date(s.startsAt) > now) return "upcoming";
  if (new Date(s.endsAt) <= now) return "expired";
  return "active";
}
