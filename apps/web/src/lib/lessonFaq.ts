/**
 * Bố cục "Hỏi và đáp": trong HTML đã lưu, mỗi câu là một phần thường
 * (<div class="lesson-part"><h3>Câu hỏi</h3>…trả lời…</div>) để trình soạn thảo
 * sửa được như mọi phần khác. Chỉ ở trang học viên, phần đó mới được dựng thành
 * <details><summary> để bấm mở/đóng — có sẵn bàn phím và trình đọc màn hình.
 *
 * Chữ giữ nguyên thứ tự (câu hỏi rồi trả lời), nên vị trí ghi chú/đánh dấu của
 * học viên (neo theo chữ) không lệch. Câu đầu tiên mở sẵn để học viên biết là
 * bấm được.
 *
 * Chạy ở trình duyệt (cần DOMParser), trên HTML ĐÃ làm sạch.
 */
export function buildFaqDetails(html: string): string {
  if (!html.includes('data-layout="faq"')) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const sections = doc.body.querySelectorAll('section.lesson-section[data-layout="faq"]');
  sections.forEach((section) => {
    let first = true;
    Array.from(section.children).forEach((part) => {
      if (!part.classList.contains("lesson-part")) return;
      const question = part.firstElementChild;
      if (!question || !/^H[1-6]$/.test(question.tagName)) return;
      const details = doc.createElement("details");
      details.className = "lesson-part";
      if (first) details.setAttribute("open", "");
      first = false;
      const summary = doc.createElement("summary");
      // Giữ nguyên nội dung câu hỏi (kể cả in đậm, liên kết…).
      while (question.firstChild) summary.appendChild(question.firstChild);
      details.appendChild(summary);
      question.remove();
      while (part.firstChild) details.appendChild(part.firstChild);
      part.replaceWith(details);
    });
  });
  return doc.body.innerHTML;
}
