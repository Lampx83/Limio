/**
 * Bài Khởi động (热身) của bài HSK (HTML nhập sẵn): khối mục tiêu ("目标 Mục tiêu" + danh sách gạch đầu dòng Hán và Việt) và khối hoạt động theo cặp
 * ("2 两人一组… Làm việc theo cặp…" + các tình huống "（1）…"). Dựng lại lúc hiển thị: mục tiêu thành thẻ có dấu tích, tình huống thành thẻ đánh số.
 * Chạy ở trình duyệt sau khi HTML đã được làm sạch (cần DOMParser); không đúng khuôn thì trả nguyên. Tạo phần tử bằng DOM (textContent).
 */

const HAN = /[㐀-鿿]/;
const LATIN_VI = /[A-Za-zÀ-ỹ]/;

function el(doc: Document, tag: string, cls?: string, text?: string): HTMLElement {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Một dòng "chữ Hán (nhiều <span>, có thể có "/" giữa) + bản dịch tiếng Việt là chữ thường theo sau": tách thành phần Hán và phần Việt. */
export function splitHanVi(li: Element): { han: string; vi: string } {
  let han = "";
  let vi = "";
  let inVi = false;
  for (const n of Array.from(li.childNodes)) {
    const t = n.textContent ?? "";
    if (!inVi && n.nodeType === 3 && LATIN_VI.test(t)) inVi = true;
    if (inVi) vi += t;
    else han += t;
  }
  return { han: han.replace(/^\s*[（(]\s*\d+\s*[)）]\s*/, "").trim(), vi: vi.trim() };
}

function card(doc: Document, cls: string, mark: HTMLElement, han: string, vi: string): HTMLElement {
  const item = el(doc, "li", cls);
  const body = el(doc, "div", "hsk-exb");
  const h = el(doc, "p", "han", han);
  h.lang = "zh-Hans";
  body.appendChild(h);
  if (vi) body.appendChild(el(doc, "p", "vi2", vi));
  item.append(mark, body);
  return item;
}

/** Khối mục tiêu: bỏ dải tên unit (đầu bài đã có) và tiêu đề "目标 Mục tiêu" (đã là tiêu đề mục); mỗi mục tiêu thành một thẻ có dấu tích. */
export function hskGoalsHtml(html: string): string {
  if (typeof DOMParser === "undefined" || !/目标/.test(html)) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const root = doc.body;
  let changed = false;
  for (const k of Array.from(root.children)) {
    // Dải tên unit: <div> nền gradient đứng đầu khối ("1 我们去机场接你们").
    if (k.tagName === "DIV" && /linear-gradient/.test(k.getAttribute("style") ?? "")) {
      k.remove();
      changed = true;
    } else if (k.tagName === "H2" && /目标/.test(k.textContent ?? "")) {
      k.remove();
      changed = true;
    } else if (k.tagName === "UL" || k.tagName === "OL") {
      const ol = el(doc, "ol", "hsk-goals");
      for (const li of Array.from(k.children)) {
        const { han, vi } = splitHanVi(li);
        if (!han && !vi) continue;
        ol.appendChild(card(doc, "hsk-goal", el(doc, "span", "ck"), han, vi));
      }
      if (ol.children.length) {
        k.replaceWith(ol);
        changed = true;
      }
    } else if (k.tagName === "P" && /^\d+$/.test((k.firstElementChild?.textContent ?? "").trim()) && HAN.test(k.textContent ?? "")) {
      // Câu yêu cầu của bài tập số N nằm cuối khối ("1 给下面的词语选择对应的图片。Nối các từ…"): dòng dẫn như ở hoạt động theo cặp, ngăn cách với phần mục tiêu.
      k.firstElementChild!.remove();
      const { han, vi } = splitHanVi(k);
      const lead = el(doc, "p", "hsk-pair-lead hsk-lead-sep");
      const hz = el(doc, "span", "hz", han);
      hz.lang = "zh-Hans";
      lead.appendChild(hz);
      if (vi) lead.appendChild(el(doc, "span", "vi", vi));
      k.replaceWith(lead);
      changed = true;
    }
  }
  return changed ? root.innerHTML : html;
}

/** Khối hoạt động theo cặp: đoạn yêu cầu có số đầu dòng ("2 两人一组… Làm việc theo cặp…") thành dòng dẫn không số; các tình huống thành thẻ đánh số. */
export function hskPairHtml(html: string): string {
  if (typeof DOMParser === "undefined" || !/两人一组/.test(html)) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const root = doc.body;
  let changed = false;
  for (const k of Array.from(root.children)) {
    if (k.tagName === "P" && /两人一组/.test(k.textContent ?? "")) {
      const first = k.firstElementChild;
      if (first && /^\d+$/.test((first.textContent ?? "").trim())) first.remove(); // số thứ tự của sách
      const { han, vi } = splitHanVi(k);
      const lead = el(doc, "p", "hsk-pair-lead");
      const hz = el(doc, "span", "hz", han);
      hz.lang = "zh-Hans";
      lead.appendChild(hz);
      if (vi) lead.appendChild(el(doc, "span", "vi", vi));
      k.replaceWith(lead);
      changed = true;
    } else if (k.tagName === "UL" || k.tagName === "OL") {
      const ol = el(doc, "ol", "hsk-exs");
      Array.from(k.children).forEach((li, i) => {
        const { han, vi } = splitHanVi(li);
        if (!HAN.test(han)) return;
        ol.appendChild(card(doc, "hsk-ex", el(doc, "span", "n", String(i + 1)), han, vi));
      });
      if (ol.children.length) {
        k.replaceWith(ol);
        changed = true;
      }
    }
  }
  return changed ? root.innerHTML : html;
}
