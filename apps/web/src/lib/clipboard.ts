/**
 * Sao chép một đoạn chữ vào clipboard. Trả về có thành công hay không.
 *
 * `navigator.clipboard` CHỈ tồn tại trong secure context — https, hoặc
 * localhost. Mở app qua http trần (vd. http://<ip>:8004) thì nó `undefined`,
 * và `navigator.clipboard.writeText(...)` ném TypeError ngay ở bước đọc thuộc
 * tính. Các chỗ gọi cũ bọc trong try/catch rỗng nên lỗi biến mất không dấu
 * vết: clipboard giữ nguyên nội dung CŨ, người dùng dán ra thấy thứ chẳng
 * liên quan và tưởng app copy sai.
 *
 * Nên hàm này làm hai việc mà mọi chỗ gọi đều cần:
 *   1. Có đường dự phòng cho ngữ cảnh không an toàn (textarea + execCommand).
 *      execCommand đã bị khai tử trên giấy tờ nhưng vẫn chạy ở mọi trình
 *      duyệt, và là cách duy nhất còn lại khi không có secure context.
 *   2. TRẢ VỀ kết quả thay vì nuốt. Chỗ gọi phải nói thật với người dùng —
 *      báo "Đã copy" trong khi không copy được là kiểu hỏng khó lần nhất.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Có API nhưng bị từ chối (quyền, hoặc không phải cử chỉ người dùng)
    // → thử tiếp cách cũ.
  }

  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    // Để trong luồng nhưng khuất khỏi tầm nhìn: `display:none` thì không
    // select được, còn đặt ở toạ độ âm thì trang không bị giật.
    ta.style.position = "fixed";
    ta.style.top = "-1000px";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, ta.value.length);
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
