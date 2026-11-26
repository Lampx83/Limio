import { plainText } from "./htmlChunks";
import { alignReading } from "./rolePlayView";

/**
 * Bảng ví dụ của bài (Câu | Pinyin | Nghĩa) gộp cột Pinyin vào cột chữ Hán: pinyin nằm DƯỚI từng chữ Hán (ruby) và bảng chỉ còn hai cột
 * (docs/tieu-chi/hsk-che-do-chieu-lop.md, A5). Hàng nào ghép pinyin không khớp số chữ Hán thì giữ pinyin thành một dòng nhỏ dưới câu, không mất chữ.
 * Hàm thuần, chạy trên chuỗi HTML (không cần DOM).
 */

const HAN = /[㐀-鿿]/;
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** HTML ruby cho một câu: mỗi chữ Hán một <ruby>, phần còn lại giữ nguyên. Không ghép được thì trả null. */
export function rubyHtml(han: string, reading: string): string | null {
  const syl = alignReading(han, reading);
  if (!syl) return null;
  let k = 0;
  const body = [...han]
    .map((c) => (HAN.test(c) ? `<ruby class="ruby-han"><span>${esc(c)}</span><rt>${esc(syl[k++] ?? "")}</rt></ruby>` : esc(c)))
    .join("");
  return `<span class="hz hz-rb ruby-line" lang="zh-Hans">${body}</span>`;
}

const CELL = /<(td|th)\b([^>]*)>([\s\S]*?)<\/\1>/gi;

function cellsOf(row: string): Array<{ tag: string; attrs: string; inner: string }> {
  const out: Array<{ tag: string; attrs: string; inner: string }> = [];
  CELL.lastIndex = 0;
  for (let m = CELL.exec(row); m; m = CELL.exec(row)) out.push({ tag: m[1]!.toLowerCase(), attrs: m[2]!, inner: m[3]! });
  return out;
}

export function mergePinyinColumn(html: string): string {
  return html.replace(/<table\b[\s\S]*?<\/table>/gi, (table) => {
    const rows = table.match(/<tr\b[\s\S]*?<\/tr>/gi);
    if (!rows || rows.length < 2) return table;
    const head = cellsOf(rows[0]!);
    const py = head.findIndex((c) => /^pinyin$/i.test(plainText(c.inner)));
    if (py < 1) return table; // không có cột Pinyin đứng sau một cột chữ
    let out = table;
    for (const row of rows) {
      const cells = cellsOf(row);
      if (cells.length <= py) continue;
      const han = cells[py - 1]!;
      const reading = cells[py]!;
      let merged = han.inner;
      if (han.tag === "td") {
        const r = rubyHtml(plainText(han.inner), plainText(reading.inner));
        merged = r ?? `${han.inner}<div class="py-latin" style="font-size:.7em">${reading.inner}</div>`;
      }
      const rebuilt = cells
        .filter((_, i) => i !== py)
        .map((c, i) => `<${c.tag}${c.attrs}>${i === py - 1 ? merged : c.inner}</${c.tag}>`)
        .join("");
      const open = /^<tr\b[^>]*>/i.exec(row)![0];
      out = out.replace(row, `${open}${rebuilt}</tr>`);
    }
    return out;
  });
}
