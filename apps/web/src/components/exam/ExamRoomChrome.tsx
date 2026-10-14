/**
 * LANG G5a — "vibe phòng thi": trong phòng thi thử ẩn khung của hệ thống (thanh trên,
 * chân trang, nút nổi) để thí sinh chỉ thấy đề. Render phía server nên không có
 * khoảnh khắc thanh trên hiện rồi mới biến mất; <style> này nằm trong cây trang nên
 * tự mất khi điều hướng đi nơi khác. Các phần tử cần ẩn đánh dấu `data-app-chrome`.
 */
export default function ExamRoomChrome() {
  return <style>{`[data-app-chrome]{display:none !important}`}</style>;
}
