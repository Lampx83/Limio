import { alignReading, hanTokens } from "./rolePlayView";

/** Tiêu đề cột phiên âm mà bảng từ mới của các khoá chữ Hán dùng. */
const READING_HEAD = /^(pinyin|phiên âm|phien am|reading)$/i;
const HAN = /[㐀-鿿]/;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Bảng từ mới "词 | Pinyin | 词性 | nghĩa" (HTML đã nhập sẵn) → bỏ cột Pinyin, đặt pinyin DƯỚI từng chữ Hán của từ (ruby). Pinyin không ghép được từng chữ (số âm tiết khác số chữ)
 * thì hiện thành một dòng nhỏ ngay dưới từ, vẫn ở trong ô của từ. Chỉ đụng bảng có cột "Pinyin" đứng ngay sau cột chữ Hán; HTML khác giữ nguyên, nên bài cũ không bị ảnh hưởng.
 * Chạy ở trình duyệt sau khi HTML đã được làm sạch (cần DOMParser); không có DOMParser (máy chủ) thì trả nguyên.
 */
export function buildVocabRuby(html: string): string {
  if (typeof DOMParser === "undefined" || !/<table/i.test(html) || !/pinyin|phiên âm|phien am/i.test(html)) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  let changed = false;
  for (const table of Array.from(doc.querySelectorAll("table"))) {
    const head = table.rows[0];
    if (!head) continue;
    const heads = Array.from(head.cells);
    const ri = heads.findIndex((c, i) => i > 0 && READING_HEAD.test((c.textContent ?? "").trim()));
    if (ri < 1 || !HAN.test(heads[ri - 1]!.textContent ?? "")) continue;
    for (const row of Array.from(table.rows)) {
      const cells = Array.from(row.cells);
      if (cells.length <= ri) continue;
      if (row !== head) dressWordCell(cells[ri - 1]!, (cells[ri]!.textContent ?? "").trim());
      cells[ri]!.remove();
    }
    changed = true;
  }
  return changed ? doc.body.innerHTML : html;
}

function dressWordCell(cell: HTMLTableCellElement, reading: string): void {
  const word = (cell.textContent ?? "").trim();
  if (!word || !reading) return;
  const syl = alignReading(word, reading);
  if (syl) {
    let k = 0;
    const inner = hanTokens(word)
      .map((t) =>
        t.scored
          ? `<ruby class="ruby-han"><span>${esc(t.text)}</span><rt>${esc(syl[k++] ?? "")}</rt></ruby>`
          : esc(t.text) + (t.sep ? " " : ""),
      )
      .join("");
    cell.innerHTML = `<span style="font-size:1.3em">${inner}</span>`;
  } else {
    cell.insertAdjacentHTML("beforeend", `<div class="vocab-reading">${esc(reading)}</div>`);
  }
}
