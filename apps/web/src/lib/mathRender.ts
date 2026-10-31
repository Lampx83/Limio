/**
 * Công thức toán trong bài học. HTML đã lưu chỉ mang NGUỒN LaTeX, không mang kết quả dựng:
 *   <span class="math-inline" data-latex="x^2-5x+6=0">x^2-5x+6=0</span>
 *   <div class="math-block" data-latex="x=\frac{-b\pm\sqrt{\Delta}}{2a}">…</div>
 * Lưu nguồn thay vì HTML của KaTeX vì (1) nhỏ, (2) sửa được ở trình soạn, (3) đổi bản KaTeX không phải nhập lại
 * khoá, (4) nơi nào không dựng được (in, email, trình soạn) vẫn đọc được chữ LaTeX thay vì khung trống.
 *
 * Chạy ở trình duyệt, trên HTML ĐÃ qua DOMPurify. Đầu ra của KaTeX do chính KaTeX sinh từ chuỗi LaTeX
 * (`trust: false` cấm \href, \url, \includegraphics…), không đi qua đường dữ liệu người dùng nữa.
 */

/** Chỉ tải KaTeX khi bài có công thức; bài thường không tốn thêm byte nào. */
export function hasMath(html: string): boolean {
  return html.includes("data-latex");
}

export async function renderMath(html: string): Promise<string> {
  if (!hasMath(html)) return html;
  const katex = (await import("katex")).default;
  const tpl = document.createElement("template");
  tpl.innerHTML = html;
  tpl.content.querySelectorAll<HTMLElement>("[data-latex]").forEach((el) => {
    const latex = el.getAttribute("data-latex") ?? "";
    try {
      el.innerHTML = katex.renderToString(latex, {
        displayMode: el.classList.contains("math-block"),
        throwOnError: false,
        trust: false,
        strict: "ignore",
        output: "htmlAndMathml",
        // Chặn bài báo "bom" macro lồng nhau làm treo tab.
        maxExpand: 1000,
      });
      el.setAttribute("data-math-rendered", "1");
    } catch {
      // throwOnError=false nên hiếm khi tới đây; giữ nguyên chữ nguồn.
    }
  });
  return tpl.innerHTML;
}
