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


/** Một dòng của bảng từ mới trong sách: từ, pinyin, loại từ (đg., d., lg.…) và nghĩa. */
export interface VocabRow {
  term: string;
  reading: string;
  pos: string;
  meaning: string;
}

function vocabTable(doc: Document): { table: HTMLTableElement; ri: number } | null {
  for (const table of Array.from(doc.querySelectorAll("table"))) {
    const head = table.rows[0];
    if (!head) continue;
    const heads = Array.from(head.cells);
    const ri = heads.findIndex((c, i) => i > 0 && READING_HEAD.test((c.textContent ?? "").trim()));
    if (ri >= 1 && HAN.test(heads[ri - 1]!.textContent ?? "")) return { table, ri };
  }
  return null;
}

function readVocabRows(table: HTMLTableElement, ri: number): VocabRow[] {
  const rows: VocabRow[] = [];
  for (const tr of Array.from(table.rows).slice(1)) {
    const cells = Array.from(tr.cells).map((c) => (c.textContent ?? "").trim());
    if (cells.length <= ri) continue;
    const rest = cells.slice(ri + 1);
    const term = cells[ri - 1] ?? "";
    if (!term) continue;
    rows.push({ term, reading: cells[ri] ?? "", pos: rest.length >= 2 ? rest[0]! : "", meaning: rest.length >= 2 ? rest.slice(1).join(" ") : (rest[0] ?? "") });
  }
  return rows;
}

/** Đọc bảng từ mới (词 | Pinyin | 词性 | nghĩa) thành danh sách dòng, đúng thứ tự trong sách (gồm cả tên riêng mà thẻ ghi nhớ của bài có thể bỏ). Không có bảng thì null. */
export function parseVocabTable(html: string): VocabRow[] | null {
  if (typeof DOMParser === "undefined" || !/<table/i.test(html)) return null;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const found = vocabTable(doc);
  if (!found) return null;
  const rows = readVocabRows(found.table, found.ri);
  return rows.length ? rows : null;
}

/** Bảng từ mới → lưới thẻ từ (mỗi từ một thẻ: loại từ, chữ Hán có pinyin dưới từng chữ, nghĩa). HTML không có bảng như vậy thì trả nguyên. */
export function buildVocabCards(html: string): string {
  if (typeof DOMParser === "undefined" || !/<table/i.test(html)) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const found = vocabTable(doc);
  if (!found) return html;
  const rows = readVocabRows(found.table, found.ri);
  if (!rows.length) return html;
  const items = rows
    .map((r) => {
      const syl = alignReading(r.term, r.reading);
      let k = 0;
      const han = syl
        ? hanTokens(r.term)
            .map((t) => (t.scored ? `<ruby class="ruby-han"><span>${esc(t.text)}</span><rt>${esc(syl[k++] ?? "")}</rt></ruby>` : esc(t.text) + (t.sep ? " " : "")))
            .join("")
        : `${esc(r.term)}${r.reading ? `<span class="vocab-reading">${esc(r.reading)}</span>` : ""}`;
      // Từ có chữ Hán: thẻ bấm được (mở "Cách viết"); khung lắng nghe nằm ở HskVocabSwitch.
      const writable = /[\u3400-\u4dbf\u4e00-\u9fff]/.test(r.term) ? ` role="button" tabindex="0" data-term="${esc(r.term)}"` : "";
      return `<li class="hsk-wc"${writable}>${r.pos ? `<span class="hsk-pos">${esc(r.pos)}</span>` : ""}<p class="hsk-wc-han">${han}</p><p class="hsk-wc-mean">${esc(r.meaning)}</p></li>`;
    })
    .join("");
  const ul = doc.createElement("ul");
  ul.className = "hsk-words";
  ul.innerHTML = items;
  found.table.replaceWith(ul);
  return doc.body.innerHTML;
}
