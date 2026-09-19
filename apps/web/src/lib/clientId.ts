// Định danh ẩn danh ổn định theo thiết bị (localStorage) — dùng để server rate-limit ĐÚNG người
// gửi thay vì theo IP: cả lớp dùng chung wifi/NAT trường học sẽ ra cùng 1 IP nên rate-limit theo
// IP chặn nhầm học viên hợp lệ. Dùng chung 1 khoá cho poll, word cloud và bảng cộng tác.
const CLIENT_ID_KEY = "wordcloud_client_id"; // giữ khoá cũ để thiết bị đã có id không bị đổi

export function getClientId(): string {
  try {
    let id = localStorage.getItem(CLIENT_ID_KEY);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLIENT_ID_KEY, id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
