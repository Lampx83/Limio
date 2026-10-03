/**
 * Neo annotation vào văn bản kiểu "text quote": lưu đoạn trích + chữ liền
 * trước/sau + offset. Offset dựng lại nhanh; quote/prefix/suffix cứu lại khi
 * giảng viên sửa bài làm offset lệch.
 *
 * Hai nửa: phần thuần (locateQuote, không đụng DOM — test được ở node) và phần
 * DOM (textOffsetOf, rangeFromOffsets) ở cuối file.
 */

export interface AnchorHint {
  quote: string;
  prefix: string;
  suffix: string;
  startOffset: number;
}

/** Độ dài đoạn chung dài nhất giữa phần ĐUÔI của `a` và phần ĐUÔI của `b`. */
function commonSuffixLen(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[a.length - 1 - n] === b[b.length - 1 - n]) n++;
  return n;
}

/** Độ dài đoạn chung dài nhất giữa phần ĐẦU của `a` và phần ĐẦU của `b`. */
function commonPrefixLen(a: string, b: string): number {
  let n = 0;
  while (n < a.length && n < b.length && a[n] === b[n]) n++;
  return n;
}

/**
 * Tìm vị trí bắt đầu của annotation trong `text`. Trả null nếu đoạn trích không
 * còn nữa (bài đã sửa mất đoạn đó) — annotation khi ấy "mồ côi": không vẽ,
 * nhưng dữ liệu còn nguyên.
 *
 * Nhiều chỗ khớp (cụm "ví dụ" xuất hiện năm lần) thì chọn chỗ có ngữ cảnh
 * trước/sau giống nhất; hoà thì chọn chỗ gần offset cũ nhất.
 */
export function locateQuote(text: string, hint: AnchorHint): number | null {
  const { quote, prefix, suffix, startOffset } = hint;
  if (!quote) return null;

  // Đường nhanh: offset cũ vẫn đúng và ngữ cảnh khớp.
  if (text.startsWith(quote, startOffset)) {
    const before = text.slice(Math.max(0, startOffset - prefix.length), startOffset);
    const after = text.slice(startOffset + quote.length, startOffset + quote.length + suffix.length);
    if (before === prefix && after === suffix) return startOffset;
  }

  let best: { index: number; score: number; dist: number } | null = null;
  let from = 0;
  for (;;) {
    const i = text.indexOf(quote, from);
    if (i < 0) break;
    from = i + 1;
    const score =
      commonSuffixLen(text.slice(Math.max(0, i - prefix.length), i), prefix) +
      commonPrefixLen(text.slice(i + quote.length, i + quote.length + suffix.length), suffix);
    const dist = Math.abs(i - startOffset);
    if (!best || score > best.score || (score === best.score && dist < best.dist)) {
      best = { index: i, score, dist };
    }
  }
  return best ? best.index : null;
}

// ---------------------------------------------------------------------------
// Phần DOM — chỉ chạy ở trình duyệt.
// ---------------------------------------------------------------------------

/** Offset ký tự của (node, offset) tính từ đầu `root`, theo thứ tự văn bản. */
export function textOffsetOf(root: Node, node: Node, offset: number): number {
  const r = document.createRange();
  r.selectNodeContents(root);
  r.setEnd(node, offset);
  return r.toString().length;
}

export interface CapturedAnchor extends AnchorHint {
  endOffset: number;
  contentItemId: string;
}

const CONTEXT = 32;

/**
 * Chụp toạ độ của vùng đang bôi đen. Trả null nếu vùng không nằm gọn trong MỘT
 * khối nội dung (data-item-id) — annotation neo vào một khối, nên chọn vắt qua
 * hai khối thì không ghi chú được (vẫn hỏi AI được).
 */
export function captureAnchor(range: Range): CapturedAnchor | null {
  const startEl = elementOf(range.startContainer)?.closest<HTMLElement>("[data-item-id]");
  const endEl = elementOf(range.endContainer)?.closest<HTMLElement>("[data-item-id]");
  if (!startEl || startEl !== endEl) return null;
  const itemId = startEl.dataset.itemId;
  if (!itemId) return null;

  const full = startEl.textContent ?? "";
  const start = textOffsetOf(startEl, range.startContainer, range.startOffset);
  const end = textOffsetOf(startEl, range.endContainer, range.endOffset);
  // Cắt khoảng trắng hai đầu: bôi đen cả từ thường kéo theo dấu cách thừa, mà
  // dấu cách ấy làm highlight lòi ra khỏi chữ.
  const raw = full.slice(start, end);
  const lead = raw.length - raw.trimStart().length;
  const quote = raw.trim();
  if (!quote) return null;
  const s = start + lead;
  const e = s + quote.length;
  return {
    contentItemId: itemId,
    quote,
    prefix: full.slice(Math.max(0, s - CONTEXT), s),
    suffix: full.slice(e, e + CONTEXT),
    startOffset: s,
    endOffset: e,
  };
}

function elementOf(n: Node): Element | null {
  return n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement;
}

/** Dựng lại Range từ offset trong `root`. */
export function rangeFromOffsets(root: Element, start: number, end: number): Range | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const range = document.createRange();
  let pos = 0;
  let startSet = false;
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const len = (n as Text).data.length;
    if (!startSet && start < pos + len) {
      range.setStart(n, start - pos);
      startSet = true;
    }
    if (startSet && end <= pos + len) {
      range.setEnd(n, end - pos);
      return range;
    }
    pos += len;
  }
  return null;
}

/** Annotation → Range hiện tại trong DOM, hoặc null nếu mồ côi / khối chưa render. */
export function resolveAnnotationRange(
  container: ParentNode,
  a: AnchorHint & { contentItemId: string },
): Range | null {
  const el = container.querySelector<HTMLElement>(
    `[data-item-id="${CSS.escape(a.contentItemId)}"]`,
  );
  if (!el) return null;
  const text = el.textContent ?? "";
  const start = locateQuote(text, a);
  if (start === null) return null;
  return rangeFromOffsets(el, start, start + a.quote.length);
}
