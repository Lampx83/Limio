/**
 * Chặn in trang học liệu của khoá bản quyền (docs/tieu-chi/chan-in-hoc-lieu-ban-quyen.md, AC2–AC4).
 *
 * Chỉ nhúng khi khoá bật "Học liệu có bản quyền". Khi in (Ctrl+P, menu In, "Lưu thành PDF") mọi thứ trong
 * <body> bị ẩn, chỉ còn một dòng thông báo; trên màn hình trang không đổi gì.
 *
 * Đây là lớp làm khó người dùng thường, KHÔNG phải rào chắn: tắt CSS, đọc DOM hay chụp màn hình vẫn lấy được
 * chữ. Chỗ chặn chắc là máy chủ không dựng trang `/print`. Nên giao diện bật cờ không được hứa hơn thế.
 *
 * Thành phần máy chủ, không cần JS ở trình duyệt, nên cũng chạy khi script chưa hydrate.
 */
export default function PrintBlock({ message }: { message: string }) {
  // Chuỗi CSS: bỏ ký tự có thể thoát khỏi dấu nháy, đóng thẻ style hoặc xuống dòng.
  const safe = message.replace(/[\\"<>\r\n]/g, " ");
  const css = `@media print{html body > *{display:none !important}html body::before{content:"${safe}";display:block;padding:2rem;font:16px/1.5 system-ui,sans-serif;color:#000}}`;
  return <style data-print-block dangerouslySetInnerHTML={{ __html: css }} />;
}
