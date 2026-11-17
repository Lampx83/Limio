/**
 * Khung "小语讲堂 · Lớp học của Tiểu Ngữ" của bài HSK (HTML nhập sẵn): mỗi điểm ngữ pháp bắt đầu bằng đoạn "<strong>1</strong> 固定短语“看上去/看起来” Cụm cố định…",
 * rồi các đoạn giải thích, danh sách ví dụ "（1）…" và dòng "■ 完成句子。". Dựng lại lúc hiển thị: cụm khoá trong dấu “ ” thành viên thuốc, ví dụ thành thẻ đánh số,
 * dòng "■" thành dòng thử ngay. Chạy ở trình duyệt sau khi HTML đã được làm sạch (cần DOMParser); không đúng khuôn thì trả nguyên.
 */

import { alignReading, hanTokens } from "./rolePlayView";
import { splitHanRuns } from "./hskLesson";

const HAN = /[㐀-鿿]/;

/** Nội dung bổ sung của một điểm ngữ pháp (lưu ở `payload.hskGrammar[số điểm]` của khối ngữ pháp): cụm khoá + pinyin, nghĩa, cách dùng, lưu ý, pinyin và bản dịch từng câu ví dụ. */
export interface HskGrammarPoint {
  phrases?: Array<{ han: string; reading: string }>;
  meaning?: string | null;
  usage?: string | null;
  note?: string | null;
  examples?: Array<{ reading?: string; vi?: string }>;
}

const str = (v: unknown, max: number): string | null => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : null);

/** Đọc `payload.hskGrammar` không tin cậy: chỉ giữ chuỗi đúng độ dài, mảng có giới hạn. Sai dạng thì bỏ qua (khối vẫn hiện bằng nội dung sách). */
export function readGrammarData(raw: unknown): Record<string, HskGrammarPoint> {
  const out: Record<string, HskGrammarPoint> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>).slice(0, 20)) {
    if (!/^\d{1,2}$/.test(k) || !v || typeof v !== "object") continue;
    const o = v as Record<string, unknown>;
    const phrases = Array.isArray(o.phrases)
      ? o.phrases
          .slice(0, 4)
          .map((x) => ({ han: str((x as Record<string, unknown>)?.han, 40), reading: str((x as Record<string, unknown>)?.reading, 80) }))
          .filter((x): x is { han: string; reading: string } => !!x.han && !!x.reading)
      : [];
    const examples = Array.isArray(o.examples)
      ? o.examples.slice(0, 12).map((x) => ({ reading: str((x as Record<string, unknown>)?.reading, 300) ?? undefined, vi: str((x as Record<string, unknown>)?.vi, 400) ?? undefined }))
      : [];
    out[k] = { phrases, meaning: str(o.meaning, 140), usage: str(o.usage, 260), note: str(o.note, 200), examples };
  }
  return out;
}

function el(doc: Document, tag: string, cls?: string): HTMLElement {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  return e;
}

/** Chữ Hán có pinyin dưới từng chữ (ruby) nếu pinyin ghép được; không thì chữ kèm dòng pinyin nhỏ dưới. Tạo phần tử bằng DOM (textContent). */
function appendHanWithReading(doc: Document, into: HTMLElement, han: string, reading: string | undefined, readingCls: string): void {
  const syl = reading ? alignReading(han, reading) : null;
  if (syl) {
    let k = 0;
    // Dấu câu dính liền chữ đứng trước trong một nhóm không ngắt dòng, để dấu không rơi xuống đầu dòng một mình.
    let group: HTMLElement | null = null;
    for (const t of hanTokens(han)) {
      if (t.scored) {
        group = el(doc, "span", "whitespace-nowrap");
        const ruby = el(doc, "ruby", "ruby-han");
        const base = el(doc, "span");
        base.textContent = t.text;
        const rt = el(doc, "rt");
        rt.textContent = syl[k++] ?? "";
        ruby.append(base, rt);
        group.appendChild(ruby);
        into.appendChild(group);
      } else (group ?? into).appendChild(doc.createTextNode(t.text + (t.sep ? " " : "")));
    }
    into.classList.add("ruby-line");
    return;
  }
  into.appendChild(doc.createTextNode(han));
  if (reading) {
    const r = el(doc, "span", readingCls);
    r.textContent = reading;
    into.appendChild(r);
  }
}

/** Câu tiếng Việt có xen chữ Hán: chữ Hán tô màu riêng. */
function appendMixed(doc: Document, into: HTMLElement, text: string): void {
  for (const r of splitHanRuns(text)) {
    if (r.han) {
      const hz = el(doc, "span", "hz");
      hz.lang = "zh-Hans";
      hz.textContent = r.text;
      into.appendChild(hz);
    } else into.appendChild(doc.createTextNode(r.text));
  }
}

/** Các cụm trong dấu “ ” của tên điểm ngữ pháp, tách theo "/" ("看上去/看起来" → 2 cụm); chỉ lấy cụm có chữ Hán. */
export function grammarPhrases(titleText: string): string[] {
  const out: string[] = [];
  for (const m of titleText.matchAll(/[“"]([^”"]+)[”"]/g)) {
    for (const part of m[1]!.split(/[/／]/)) {
      const t = part.trim();
      if (t && HAN.test(t) && !out.includes(t)) out.push(t);
    }
  }
  return out;
}

function isPointTitle(n: Element): boolean {
  if (n.tagName !== "P") return false;
  const first = n.firstElementChild;
  // Số điểm ngữ pháp nằm trong <strong> hoặc <span> đầu đoạn (importer dùng span có style).
  return !!first && (first.tagName === "STRONG" || first.tagName === "SPAN") && /^\d+$/.test((first.textContent ?? "").trim());
}

export function hskGrammarHtml(html: string, data: Record<string, HskGrammarPoint> = {}): string {
  if (typeof DOMParser === "undefined" || !/小语讲堂/.test(html)) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const root = doc.body;
  const kids = Array.from(root.children);
  const starts = kids.map((k, i) => (isPointTitle(k) ? i : -1)).filter((i) => i >= 0);
  if (!starts.length) return html;
  const groups: Element[][] = [];
  starts.forEach((st, gi) => groups.push(kids.slice(st, gi + 1 < starts.length ? starts[gi + 1] : kids.length)));
  for (const g of groups) {
    const wrap = el(doc, "div", "hsk-gp");
    const [titleP, ...rest] = g;
    const pointNo = (titleP!.firstElementChild?.textContent ?? "").trim();
    const info: HskGrammarPoint = data[pointNo] ?? {};
    let exIdx = 0;
    titleP!.firstElementChild?.remove();
    const titleText = (titleP!.textContent ?? "").trim();
    const quoted = grammarPhrases(titleText);
    const phrases = info.phrases?.length ? info.phrases : quoted.map((han) => ({ han, reading: "" }));
    // "=" chỉ khi ghi chú nói hai cụm thay thế được cho nhau; còn lại ngăn bằng "/".
    const interchangeable = phrases.length === 2 && /thay thế/.test(info.note ?? "");
    if (phrases.length) {
      const pills = el(doc, "div", "hsk-pills");
      phrases.forEach((ph, i) => {
        if (i > 0) pills.appendChild(el(doc, "span", "hsk-eq")).textContent = interchangeable ? "=" : "/";
        const pill = el(doc, "span", "hsk-pill");
        pill.lang = "zh-Hans";
        appendHanWithReading(doc, pill, ph.han, ph.reading || undefined, "hsk-pill-py");
        pills.appendChild(pill);
      });
      wrap.appendChild(pills);
    } else {
      const h = el(doc, "p", "hsk-gp-title");
      h.innerHTML = titleP!.innerHTML;
      wrap.appendChild(h);
    }
    for (const n of rest) {
      if (n.tagName === "UL" || n.tagName === "OL") {
        if (!wrap.querySelector(".hsk-gexp") && (info.meaning || info.usage)) {
          const box = el(doc, "div", "hsk-gexp");
          for (const [label, text] of [["Nghĩa", info.meaning], ["Cách dùng", info.usage]] as const) {
            if (!text) continue;
            const row = el(doc, "div", "hsk-gr");
            const b = el(doc, "b");
            b.textContent = label;
            const p = el(doc, "p");
            appendMixed(doc, p, text);
            row.append(b, p);
            box.appendChild(row);
          }
          wrap.appendChild(box);
        }
        const ol = el(doc, "ol", "hsk-exs");
        for (const li of Array.from(n.children)) {
          if (li.tagName !== "LI") continue;
          // Ví dụ là chữ thường: lấy chữ (bỏ "（n）" đầu dòng, thường bị chia giữa nhiều <span>).
          const text = li.textContent ?? "";
          const m = /^\s*[（(]\s*(\d+)\s*[)）]\s*/.exec(text);
          const item = el(doc, "li", "hsk-ex");
          const num = el(doc, "span", "n");
          num.textContent = m ? m[1]! : String(ol.children.length + 1);
          const han = text.replace(/^\s*[（(]\s*\d+\s*[)）]\s*/, "").trim();
          const ex = info.examples?.[exIdx++];
          const body = el(doc, "div", "hsk-exb");
          const hanP = el(doc, "p", "han");
          appendHanWithReading(doc, hanP, han, ex?.reading, "hsk-py");
          body.appendChild(hanP);
          if (ex?.vi) {
            const v = el(doc, "p", "vi2");
            v.textContent = ex.vi;
            body.appendChild(v);
          }
          item.append(num, body);
          ol.appendChild(item);
        }
        wrap.appendChild(ol);
      } else if (n.tagName === "P" && (n.querySelector("strong")?.textContent ?? "").trim() === "■") {
        n.querySelector("strong")!.remove();
        n.className = "hsk-try";
        wrap.appendChild(n);
      } else {
        n.classList.add("hsk-gx");
        wrap.appendChild(n);
      }
    }
    if (info.note) {
      const note = el(doc, "p", "hsk-gnote");
      const b = el(doc, "b");
      b.textContent = "Lưu ý";
      const span = el(doc, "span");
      appendMixed(doc, span, info.note.replace(/[“”"]/g, ""));
      note.append(b, span);
      const tryP = wrap.querySelector(".hsk-try");
      if (tryP) wrap.insertBefore(note, tryP);
      else wrap.appendChild(note);
    }
    kids[kids.indexOf(g[0]!)]!.replaceWith(wrap);
    for (const n of g.slice(1)) if (n.parentNode === root) n.remove();
  }
  return root.innerHTML;
}
