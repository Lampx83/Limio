/**
 * Dựng lại HTML thân bài HSK do tác giả soạn (xem hskAuthored.ts) cho giao diện bài HSK: bỏ style nội tuyến nhiều màu (màu và cỡ chữ do hskLesson.css lo),
 * hộp "Mục tiêu bài học"/"Tổng kết" thành thẻ nhẹ, mỗi điểm ngữ pháp ("1. …") thành một thẻ có tiêu đề hồng + ô Cấu trúc/Cách dùng + ví dụ có pinyin, hộp <aside> thành ô ghi chú,
 * bảng có cột Pinyin thành pinyin dưới từng chữ Hán. Chạy ở trình duyệt sau khi HTML đã được làm sạch (cần DOMParser); không có thì trả nguyên.
 * Chỉ tạo phần tử bằng DOM (textContent), không ghép chuỗi HTML từ nội dung.
 */

import { appendHanWithReading } from "./hskGrammar";
import { dressWordCell } from "./lessonVocabRuby";
import { alignReading } from "./rolePlayView";
import { PINYIN_TOKEN, type AuthoredKind } from "./hskAuthored";

const HAN = /[㐀-鿿]/;

function el(doc: Document, tag: string, cls?: string, text?: string): HTMLElement {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Bảng "Câu | Pinyin | Nghĩa" (ví dụ) thành danh sách thẻ đánh số có pinyin dưới từng chữ; bảng khác có cột Pinyin thì gộp pinyin vào ô chữ Hán đứng trước. */
function dressTables(doc: Document, root: HTMLElement): void {
  for (const table of Array.from(root.querySelectorAll("table"))) {
    const head = table.rows[0];
    if (!head) continue;
    const heads = Array.from(head.cells).map((c) => (c.textContent ?? "").trim());
    const pi = heads.findIndex((h, i) => i > 0 && /^pinyin$/i.test(h));
    if (pi < 1) continue;
    const body = Array.from(table.rows).slice(1);
    const isExamples = heads.length === 3 && pi === 1 && /^nghĩa/i.test(heads[2]!) && !/^từ$/i.test(heads[0]!) && body.length > 0 && body.every((r) => HAN.test(r.cells[0]?.textContent ?? ""));
    if (isExamples) {
      const ol = el(doc, "ol", "hsk-exs");
      body.forEach((r, i) => {
        const item = el(doc, "li", "hsk-ex");
        const box = el(doc, "div", "hsk-exb");
        const han = el(doc, "p", "han");
        han.lang = "zh-Hans";
        appendHanWithReading(doc, han, (r.cells[0]?.textContent ?? "").trim(), (r.cells[1]?.textContent ?? "").trim() || undefined, "hsk-py");
        box.appendChild(han);
        const viCell = r.cells[2];
        const vi = (viCell?.textContent ?? "").trim();
        if (vi) {
          const viP = el(doc, "p", "vi2");
          // Bản dịch có thể chứa chữ Hán đã gắn token pinyin: giữ nguyên các nút con thay vì lấy chữ thuần.
          if (viCell!.querySelector("[data-hzrb]")) viCell!.childNodes.forEach((c) => viP.appendChild(c.cloneNode(true)));
          else viP.textContent = vi;
          box.appendChild(viP);
        }
        item.append(el(doc, "span", "n", String(i + 1)), box);
        ol.appendChild(item);
      });
      const host = table.parentElement;
      (host && host !== root && host.tagName === "DIV" && host.children.length === 1 ? host : table).replaceWith(ol);
      continue;
    }
    const hasHan = body.some((r) => HAN.test(r.cells[pi - 1]?.textContent ?? ""));
    for (const row of Array.from(table.rows)) {
      const cells = Array.from(row.cells);
      if (cells.length <= pi) continue;
      if (hasHan && row !== head && HAN.test(cells[pi - 1]!.textContent ?? "")) dressWordCell(cells[pi - 1]!, (cells[pi]!.textContent ?? "").trim());
      cells[pi]!.remove();
    }
  }
}

/** Bỏ mọi style nội tuyến (màu, cỡ, viền của importer). Ô chữ Hán cỡ 1.3em thành `.hz` để CSS tô lại; ảnh không giữ cỡ riêng (CSS lo). */
function destyle(root: HTMLElement): void {
  for (const e of Array.from(root.querySelectorAll("[style]"))) {
    const st = e.getAttribute("style") ?? "";
    e.removeAttribute("style");
    if (e.tagName === "SPAN" && /font-size:\s*1\.3em/.test(st)) {
      e.classList.add("hz");
      e.setAttribute("lang", "zh-Hans");
    }
  }
}

/** Nhãn đầu hộp: chữ trong phần tử đầu tiên. */
const labelOf = (e: Element): string => (e.firstElementChild?.textContent ?? "").trim();

/** Hàng "CẤU TRÚC / CÁCH DÙNG": nhãn + nội dung, lấy từ hộp "Ghi nhớ" (chữ đậm đầu hộp là "Cấu trúc") hoặc đoạn "Cách dùng." */
function usageRow(doc: Document, n: Element): HTMLElement | null {
  let src: Element | null = null;
  if (n.tagName === "ASIDE") {
    const body = n.children[1];
    if (/^Ghi nhớ$/i.test(labelOf(n)) && body && body.firstElementChild?.tagName === "STRONG" && /^Cấu trúc$/i.test((body.firstElementChild.textContent ?? "").trim())) src = body;
  } else if (n.tagName === "P" && n.firstElementChild?.tagName === "STRONG" && /^Cách dùng\.?$/i.test((n.firstElementChild.textContent ?? "").trim())) src = n;
  if (!src) return null;
  const strong = src.firstElementChild!;
  const label = (strong.textContent ?? "").trim().replace(/\.$/, "");
  const p = el(doc, "p");
  const rest = Array.from(src.childNodes).filter((c) => c !== strong);
  for (const c of rest) p.appendChild(c.cloneNode(true));
  const first = p.firstChild;
  if (first?.nodeType === 3) first.textContent = (first.textContent ?? "").replace(/^\s+/, "");
  const row = el(doc, "div", "hsk-gr");
  row.append(el(doc, "b", undefined, label), p);
  return row;
}

/** Mỗi điểm ngữ pháp "N. tiêu đề" (h3) cùng phần theo sau (đến h2/h3 kế) thành một thẻ; ô Cấu trúc và Cách dùng đứng cạnh nhau gộp thành một khung. */
function grammarPoints(doc: Document, root: HTMLElement): void {
  const kids = Array.from(root.children);
  const isPoint = (n: Element) => n.tagName === "H3" && /^\s*\d+\s*[.．、]/.test(n.textContent ?? "");
  const stops = (n: Element) => n.tagName === "H2" || n.tagName === "H3" || n.tagName === "SECTION";
  kids.forEach((k, i) => {
    if (!isPoint(k) || k.parentNode !== root) return;
    let end = i + 1;
    while (end < kids.length && !stops(kids[end]!)) end++;
    const members = kids.slice(i + 1, end);
    const wrap = el(doc, "div", "hsk-ap");
    const no = /^\s*(\d+)/.exec(k.textContent ?? "")?.[1] ?? "";
    const title = el(doc, "h3", "hsk-ap-t");
    for (const c of Array.from(k.childNodes)) title.appendChild(c);
    const first = title.firstChild;
    if (first?.nodeType === 3) first.textContent = (first.textContent ?? "").replace(/^\s*\d+\s*[.．、]\s*/, "");
    const headRow = el(doc, "div", "hsk-ap-head");
    headRow.append(el(doc, "span", "hsk-ap-n", no), title);
    wrap.appendChild(headRow);
    let box: HTMLElement | null = null;
    for (const m of members) {
      const row = usageRow(doc, m);
      if (row) {
        if (!box) {
          box = el(doc, "div", "hsk-gexp");
          wrap.appendChild(box);
        }
        box.appendChild(row);
        m.remove();
      } else {
        box = null;
        wrap.appendChild(m);
      }
    }
    k.replaceWith(wrap);
  });
}

/** Hộp <aside> còn lại thành ô ghi chú: Ghi nhớ (xanh), Bẫy thường gặp (hồng), Mẹo thực hành (nhẹ). */
function dressAsides(root: HTMLElement): void {
  for (const a of Array.from(root.querySelectorAll("aside"))) {
    const lab = a.firstElementChild;
    const t = (lab?.textContent ?? "").trim();
    a.className = "hsk-aside";
    a.setAttribute("data-tone", /Bẫy|Lưu ý|Chú ý/i.test(t) ? "warn" : /Mẹo/i.test(t) ? "tip" : "note");
    if (lab?.tagName === "DIV") {
      lab.className = "hsk-aside-t";
      const body = lab.nextElementSibling;
      if (body?.tagName === "DIV") body.className = "hsk-aside-b";
    }
  }
}

/**
 * Token `{{汉字^pīnyīn}}` → dấu `<span data-hzrb="pīnyīn">汉字</span>`. Chỉ chữ Hán và chữ cái pinyin (có dấu thanh, dấu cách) lọt qua được biểu thức của PINYIN_TOKEN,
 * nên chuỗi sinh ra không mang được thẻ hay thuộc tính nào khác; phần dựng ruby thật làm bằng DOM ở `rubyTokens`.
 */
function markPinyinTokens(html: string): string {
  return html.replace(PINYIN_TOKEN, (_m, han: string, py: string) => `<span data-hzrb="${py.trim()}">${han}</span>`);
}

/**
 * Dựng ruby cho mọi dấu `[data-hzrb]`: pinyin DƯỚI từng chữ Hán (cùng lớp `.ruby-han` với hội thoại và thẻ từ). Pinyin không ghép được từng chữ
 * (số âm tiết khác số chữ) thì hiện chữ Hán kèm pinyin nhỏ liền sau. Chạy SAU mọi bước dựng khác để các bước đó còn đọc được chữ thuần của ô/tiêu đề.
 */
function rubyTokens(doc: Document, root: HTMLElement): void {
  for (const mark of Array.from(root.querySelectorAll("[data-hzrb]"))) {
    const han = mark.textContent ?? "";
    const reading = mark.getAttribute("data-hzrb") ?? "";
    const wrap = el(doc, "span", "hz hz-rb");
    wrap.lang = "zh-Hans";
    // Từ ngắn (≤ 5 chữ) không bị ngắt dòng giữa chừng ("一桌 / 子"); cả câu dài thì vẫn xuống dòng được giữa các chữ.
    if ([...han].length <= 5) wrap.classList.add("hz-rb-nw");
    if (alignReading(han, reading)) appendHanWithReading(doc, wrap, han, reading, "hz-rb-py");
    else {
      wrap.appendChild(doc.createTextNode(han));
      if (reading) wrap.appendChild(el(doc, "span", "hz-rb-fb", ` ${reading}`));
    }
    mark.replaceWith(wrap);
  }
}

/**
 * Chỉ đổi token `{{汉字^pīnyīn}}` thành ruby, không dựng lại bố cục. Dùng cho bài chưa vào giao diện HSK (khách xem thử, chưa ghi danh, giao diện cũ):
 * HTML lưu trong bài mang sẵn token, nên không đổi thì người xem thấy nguyên dấu `{{ }}`. Không có DOMParser (máy chủ) thì bỏ token, giữ chữ Hán.
 */
export function rubyTokensOnlyHtml(html: string): string {
  if (!html.includes("{{")) return html;
  if (typeof DOMParser === "undefined") return html.replace(PINYIN_TOKEN, "$1");
  const doc = new DOMParser().parseFromString(`<body>${markPinyinTokens(html)}</body>`, "text/html");
  rubyTokens(doc, doc.body);
  return doc.body.innerHTML;
}

export function hskAuthoredHtml(html: string, _kind?: AuthoredKind): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<body>${markPinyinTokens(html)}</body>`, "text/html");
  const root = doc.body;
  root.querySelectorAll('nav[aria-label="Mục lục bài học"]').forEach((n) => n.remove());
  // Hộp mục tiêu / tổng kết → thẻ nhẹ.
  for (const sec of Array.from(root.querySelectorAll("section[aria-label]"))) {
    const sum = /Tổng kết/i.test(sec.getAttribute("aria-label") ?? "");
    sec.className = `hsk-note ${sum ? "hsk-note-sum" : "hsk-note-goals"}`;
    const lab = sec.firstElementChild;
    if (lab?.tagName === "DIV") lab.className = "hsk-note-t";
    sec.querySelectorAll(":scope > ul, :scope > ol").forEach((l) => l.classList.add("hsk-note-ul"));
    // Đóng/mở được cho gọn (mặc định mở): <details> bản địa, nhãn thành <summary>, không cần JS và dùng được bằng bàn phím.
    if (lab?.tagName === "DIV") {
      const det = el(doc, "details", sec.className);
      det.setAttribute("open", "");
      const sm = el(doc, "summary", "hsk-note-t hsk-note-sum-btn");
      while (lab.firstChild) sm.appendChild(lab.firstChild);
      det.appendChild(sm);
      for (const child of Array.from(sec.children)) if (child !== lab) det.appendChild(child);
      sec.replaceWith(det);
    }
  }
  dressTables(doc, root);
  destyle(root);
  root.querySelectorAll("figure").forEach((f) => f.classList.add("hsk-fig"));
  grammarPoints(doc, root);
  dressAsides(root);
  root.querySelectorAll("h3:not(.hsk-ap-t), h4").forEach((h) => h.classList.add("hsk-h3"));
  for (const table of Array.from(root.querySelectorAll("table"))) {
    const host = table.parentElement;
    if (host && host.tagName === "DIV" && host.children.length === 1 && !host.className) host.className = "hsk-tw";
    else {
      const w = el(doc, "div", "hsk-tw");
      table.replaceWith(w);
      w.appendChild(table);
    }
  }
  rubyTokens(doc, root);
  return root.innerHTML;
}
