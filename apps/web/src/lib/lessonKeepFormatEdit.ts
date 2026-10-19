import { inline } from "./lessonRender";

/**
 * "Nhờ AI" sửa một ĐOẠN trong bài giữ nguyên định dạng. Đoạn = thẻ <p> hoặc <li>
 * (không tính <li> đã chứa <p>). Đoạn có liên kết, ảnh, mã, chỉ số trên/dưới hay
 * xuống dòng cứng thì không cho AI sửa — viết lại chữ sẽ làm mất chúng âm thầm.
 * Chạy trên DOM của trình duyệt; vị trí đoạn là chỉ số trong thứ tự tài liệu.
 */

const BLOCKS = "p, li";
const INLINE_OK = new Set(["STRONG", "B", "EM", "I", "SPAN", "U"]);

/** Các đoạn có thể là đối tượng sửa, theo thứ tự tài liệu. */
export function candidateBlocks(root: ParentNode): Element[] {
  return Array.from(root.querySelectorAll(BLOCKS)).filter((el) => !(el.tagName === "LI" && el.querySelector("p")));
}

/** Chữ của đoạn, đậm/nghiêng ghi bằng ** và *. null = đoạn có thứ AI không xử lý được. */
export function blockToText(el: Element): string | null {
  let ok = true;
  const walk = (node: Node): string => {
    let out = "";
    node.childNodes.forEach((c) => {
      if (c.nodeType === 3) {
        out += c.textContent ?? "";
      } else if (c.nodeType === 1) {
        const e = c as Element;
        if (!INLINE_OK.has(e.tagName)) {
          ok = false;
          return;
        }
        const inner = walk(e);
        out += e.tagName === "STRONG" || e.tagName === "B" ? `**${inner}**` : e.tagName === "EM" || e.tagName === "I" ? `*${inner}*` : inner;
      }
    });
    return out;
  };
  const text = walk(el).replace(/\s+/g, " ").trim();
  return ok && text ? text : null;
}

/** Tiêu đề gần nhất phía trên đoạn (để AI hiểu ngữ cảnh). */
export function headingBefore(el: Element, root: ParentNode): string {
  let last = "";
  for (const h of Array.from(root.querySelectorAll("h1, h2, h3, h4, h5, h6, p, li"))) {
    if (h === el) break;
    if (/^H[1-6]$/.test(h.tagName)) last = (h.textContent ?? "").trim();
  }
  return last;
}

export const AI_EXAMPLE_LABEL = "Ví dụ (AI gợi ý)";

/**
 * Thay chữ của đoạn thứ `index` trong HTML của bài. `expected` là chữ đoạn đó trên
 * màn hình lúc chọn: lệch với bản lưu (vd. trang cũ) thì không sửa gì, trả null.
 * `example` (nếu có) được thêm ngay sau đoạn, mang nhãn "AI gợi ý".
 */
export function replaceBlock(html: string, index: number, expected: string, text: string, example = ""): string | null {
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const el = candidateBlocks(doc.body)[index];
  if (!el || blockToText(el) !== expected) return null;
  el.innerHTML = inline(text);
  if (example) {
    if (el.tagName === "LI") {
      el.insertAdjacentHTML("beforeend", ` <em>${AI_EXAMPLE_LABEL}: ${inline(example)}</em>`);
    } else {
      el.insertAdjacentHTML("afterend", `<p><strong>${AI_EXAMPLE_LABEL}:</strong> ${inline(example)}</p>`);
    }
  }
  return doc.body.innerHTML;
}
