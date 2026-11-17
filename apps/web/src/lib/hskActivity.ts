/**
 * Khối "课堂活动 · Hoạt động trên lớp" của bài HSK (HTML nhập sẵn từ sách): nhãn loại hoạt động ("■ 双人活动 Hoạt động theo cặp") và các đoạn tình huống
 * ("场景一：在机场接人。A…B…" + bản dịch trong <em>). Dựng lại lúc hiển thị: nhãn thành viên thuốc, mỗi tình huống một thẻ có tên tình huống, vai A/B thành ô màu.
 * Chạy ở trình duyệt sau khi HTML đã được làm sạch (cần DOMParser); không có thì trả nguyên. Chỉ tạo phần tử bằng DOM (textContent), không ghép chuỗi HTML.
 */

const SCENE = /^\s*场景\s*[一二三四五六七八九十\d]/;

function el(doc: Document, tag: string, cls?: string, text?: string): HTMLElement {
  const e = doc.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

/** Một bước của tình huống: mỗi vế của câu mô tả (tách ở "；") là việc của MỘT vai; vai đứng đầu vế là vai của bước. */
function stepsOf(doc: Document, nodes: ChildNode[]): Array<{ role: string | null; han: HTMLElement }> {
  const clauses: ChildNode[][] = [[]];
  for (const n of nodes) {
    clauses[clauses.length - 1]!.push(n);
    if (/；\s*$/.test(n.textContent ?? "")) clauses.push([]);
  }
  const out: Array<{ role: string | null; han: HTMLElement }> = [];
  for (const c of clauses) {
    if (!c.length) continue;
    const first = c[0]!;
    const role = first.nodeType === 3 && /^\s*[A-Z]\s*$/.test(first.textContent ?? "") ? (first.textContent ?? "").trim() : null;
    const han = el(doc, "p", "hsk-step-han");
    han.lang = "zh-Hans";
    for (const n of role ? c.slice(1) : c) {
      const t = n.textContent ?? "";
      if (n.nodeType === 3 && /^\s*[A-Z]\s*$/.test(t)) {
        const r = el(doc, "b", "hsk-role", t.trim());
        r.dataset.r = t.trim();
        han.appendChild(r);
      } else han.appendChild(doc.createTextNode(t));
    }
    out.push({ role, han });
  }
  return out;
}

/** Một đoạn tình huống → thẻ. Câu mô tả có từ hai vế trở lên thì mỗi vế là một bước (nền và màu theo vai A/B). Không đúng khuôn (không có <em> dịch hoặc không có span tên) thì trả null để giữ nguyên đoạn gốc. */
function sceneCard(doc: Document, p: HTMLParagraphElement): HTMLElement | null {
  const nodes = Array.from(p.childNodes);
  const titleEl = nodes.find((n): n is HTMLElement => n.nodeType === 1 && (n as HTMLElement).tagName === "SPAN");
  const emEl = nodes.find((n): n is HTMLElement => n.nodeType === 1 && (n as HTMLElement).tagName === "EM");
  if (!titleEl || !emEl) return null;
  const titleHan = (titleEl.textContent ?? "").trim();
  const steps = stepsOf(doc, nodes.slice(nodes.indexOf(titleEl) + 1, nodes.indexOf(emEl)));
  const vi = (emEl.textContent ?? "").trim();
  const m = /^(Tình huống\s*\d+\s*[:：][^.]*?)\.\s+([\s\S]*)$/.exec(vi);
  const rest = m ? m[2]! : vi;
  const sentences = rest.split(/(?<=[.!?])\s+/).filter(Boolean);
  const card = el(doc, "div", "hsk-scn");
  const head = el(doc, "p", "hsk-scn-title");
  const hz = el(doc, "span", "hz", titleHan);
  hz.lang = "zh-Hans";
  head.appendChild(hz);
  if (m) head.appendChild(el(doc, "span", "vi", m[1]));
  card.appendChild(head);
  if (steps.length >= 2) {
    // Bản dịch cũng tách theo câu khi số câu khớp số bước: mỗi bước có Hán và Việt của nó; không khớp thì để cả đoạn dịch bên dưới.
    const perStep = sentences.length === steps.length;
    const ol = el(doc, "ol", "hsk-steps");
    steps.forEach((st, i) => {
      const li = el(doc, "li", "hsk-step");
      if (st.role) li.dataset.r = st.role;
      const mark = el(doc, "b", "hsk-role hsk-role-lg", st.role ?? String(i + 1));
      if (st.role) mark.dataset.r = st.role;
      const body = el(doc, "div", "hsk-step-body");
      body.appendChild(st.han);
      if (perStep) body.appendChild(el(doc, "p", "hsk-step-vi", sentences[i]!));
      li.append(mark, body);
      ol.appendChild(li);
    });
    card.appendChild(ol);
    if (!perStep) card.appendChild(el(doc, "p", "hsk-scn-vi", rest));
  } else {
    const han = el(doc, "p", "hsk-scn-han");
    han.lang = "zh-Hans";
    const only = steps[0];
    if (only?.role) {
      const r = el(doc, "b", "hsk-role", only.role);
      r.dataset.r = only.role;
      han.appendChild(r);
    }
    if (only) for (const c of Array.from(only.han.childNodes)) han.appendChild(c.cloneNode(true));
    card.appendChild(han);
    card.appendChild(el(doc, "p", "hsk-scn-vi", rest));
  }
  return card;
}

function transform(html: string, withTag: boolean): string {
  if (typeof DOMParser === "undefined" || (!/场景/.test(html) && !withTag)) return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  let changed = false;
  let tagDone = !withTag;
  for (const p of Array.from(doc.body.querySelectorAll("p"))) {
    const text = p.textContent ?? "";
    if (SCENE.test(text)) {
      const card = sceneCard(doc, p as HTMLParagraphElement);
      if (card) {
        p.replaceWith(card);
        changed = true;
      }
    } else if (!tagDone && /^\s*■/.test(text) && /[㐀-鿿]/.test(text)) {
      const span = p.querySelector("span");
      const han = (span?.textContent ?? "").trim();
      const vi = text.replace(/^\s*■/, "").replace(han, "").trim();
      if (han) {
        const pill = el(doc, "span", "hsk-act-pill");
        const hz = el(doc, "span", "hz", han);
        hz.lang = "zh-Hans";
        pill.appendChild(hz);
        if (vi) pill.appendChild(doc.createTextNode(vi));
        const wrap = el(doc, "p", "hsk-act-tag");
        wrap.appendChild(pill);
        p.replaceWith(wrap);
        tagDone = true;
        changed = true;
      }
    }
  }
  return changed ? doc.body.innerHTML : html;
}

/** Khối hoạt động đầy đủ: nhãn loại hoạt động (đoạn "■" đầu tiên) + các thẻ tình huống. */
export function hskActivityHtml(html: string): string {
  return transform(html, true);
}

/** Khối khác có đoạn tình huống (vd. tình huống 2 nằm riêng một khối): chỉ dựng thẻ tình huống. */
export function hskScenarioHtml(html: string): string {
  return transform(html, false);
}

/**
 * Khối tiêu đề đứng ngay trước hội thoại: đoạn có "■" (yêu cầu, vd "■ 听两遍对话… Nghe hai lần…") thành dải nhắc, đoạn còn lại là câu dẫn cảnh.
 * Bỏ ký hiệu "■" (dải nhắc đã có biểu tượng riêng).
 */
export function hskBriefHtml(html: string): string {
  if (typeof DOMParser === "undefined") return html;
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  let changed = false;
  for (const p of Array.from(doc.body.querySelectorAll("p"))) {
    const strong = p.querySelector("strong");
    if (strong && (strong.textContent ?? "").trim() === "■") {
      strong.remove();
      p.className = "hsk-brief";
    } else if ((p.textContent ?? "").trim()) p.className = "hsk-scene";
    else continue;
    changed = true;
  }
  return changed ? doc.body.innerHTML : html;
}
