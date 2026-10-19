import { LESSON_BOX_LABELS, type LessonLook } from "@feedbackme/shared-types";
import { EXTENSIONS } from "@/components/richtext/extensions";
import { probeEditorLoss } from "@/components/richtext/lossProbe";

/**
 * Chuyển bài "Định dạng bằng AI" kiểu cũ (màu viết thẳng vào từng thẻ, bị khoá
 * không sửa tay được) sang dạng khối mới (S5):
 *   div.lesson-objectives / .lesson-summary / .callout → hộp Mục tiêu / Tổng kết / Lưu ý,
 *   mỗi <h2> mở một mục (bố cục Văn bản), mỗi <h3> trong mục mở một phần,
 *   bỏ mọi style viết thẳng; giao diện cũ đổi sang bảng màu + kiểu chữ gần nhất.
 *
 * Chỉ nhận kết quả khi KHÔNG mất gì: cùng bộ chữ (trừ đúng các nhãn "Mục tiêu
 * học tập"/"Tổng kết" đã thành tên hộp), cùng bộ ảnh, và trình soạn mở ra không
 * mất gì. Không đạt thì trả lý do — bài giữ nguyên, không chuyển nửa vời.
 *
 * Cần DOM (DOMParser + TipTap): chạy ở trình duyệt, hoặc trong script với jsdom.
 */

export type ConvertResult =
  | { ok: true; html: string; look: LessonLook }
  | { ok: false; reason: "not_legacy" | "unsupported_media" | "text_mismatch" | "image_mismatch" | "editor_loss" | "empty" };

/**
 * Bài có dấu riêng của "Định dạng bằng AI" kiểu cũ. Phải chặt: bài nhập bằng
 * script (packages/core-lms/scripts/import-course.ts) cũng viết màu thẳng vào thẻ
 * nhưng là thiết kế có chủ ý (mục lục <nav>, tiêu đề có id "muc-…") — không được đụng.
 */
export function looksLegacyAi(html: string): boolean {
  if (!/style\s*=/.test(html)) return false;
  // Dấu của bài nhập bằng script.
  if (/<nav\b|<h2[^>]*\bid="muc-|class="lesson-(section|box|part|figure)"/.test(html)) return false;
  // Các lớp chỉ lời nhắc "Định dạng bằng AI" sinh ra, hoặc phông chữ nó viết thẳng vào thẻ.
  return /class="(lesson-objectives|lesson-summary|callout)"/.test(html) || (/<h2[^>]*style=/.test(html) && /Inter, ui-sans-serif/.test(html));
}

/** Giao diện cũ → bảng màu + kiểu chữ gần nhất (tài liệu tiêu chí S5). */
function detectLook(doc: Document): LessonLook {
  const h2s = Array.from(doc.querySelectorAll("h2"));
  const styles = h2s.map((h) => h.getAttribute("style") ?? "");
  const first = styles[0] ?? "";
  if (/linear-gradient/i.test(first)) return { palette: "sunset", font: "modern" };
  if (/georgia|serif/i.test(first)) return { palette: "plain", font: "academic" };
  const colors = new Set(styles.map((st) => /(?:^|;)\s*color\s*:\s*([^;]+)/i.exec(st)?.[1]?.trim()).filter(Boolean));
  if (colors.size > 1 || /border-left/i.test(first)) return { palette: "vibrant", font: "modern" };
  return { palette: "limio", font: "modern" };
}

function words(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter(Boolean)
    .sort();
}

function removeWords(all: string[], remove: string[]): string[] {
  const counts = new Map<string, number>();
  for (const w of remove) counts.set(w, (counts.get(w) ?? 0) + 1);
  return all.filter((w) => {
    const c = counts.get(w) ?? 0;
    if (c > 0) {
      counts.set(w, c - 1);
      return false;
    }
    return true;
  });
}

const imgs = (root: ParentNode) =>
  Array.from(root.querySelectorAll("img"))
    .map((i) => i.getAttribute("src") ?? "")
    .sort()
    .join("|");

export function convertLegacyAiHtml(html: string): ConvertResult {
  if (!looksLegacyAi(html)) return { ok: false, reason: "not_legacy" };
  // Nhúng video/khung/âm thanh không có chữ cũng không có ảnh — các phép so bên dưới
  // không thấy chúng mất. Trình soạn bỏ chúng, nên không chuyển những bài này.
  if (/<(iframe|video|audio|embed|object|svg|form)\b/i.test(html)) return { ok: false, reason: "unsupported_media" };
  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const look = detectLook(doc);
  const removedLabels: string[] = [];

  // Bỏ vỏ bọc: <div style="font-family…"> bao cả bài.
  let root: Element = doc.body;
  while (
    root.children.length === 1 &&
    root.firstElementChild?.tagName === "DIV" &&
    !root.firstElementChild.className &&
    !Array.from(root.childNodes).some((n) => n.nodeType === 3 && n.textContent?.trim())
  ) {
    root = root.firstElementChild;
  }

  // Bảng bọc trong <div style="overflow-x:auto"> → bảng trơn (khung trình soạn tự lo cuộn ngang).
  root.querySelectorAll("div").forEach((d) => {
    if (!d.className && d.children.length === 1 && d.firstElementChild?.tagName === "TABLE") d.replaceWith(d.firstElementChild);
  });

  const toBox = (el: Element, kind: keyof typeof LESSON_BOX_LABELS, label: RegExp | null): Element => {
    const box = doc.createElement("div");
    box.className = "lesson-box";
    box.setAttribute("data-kind", kind);
    box.setAttribute("data-title", LESSON_BOX_LABELS[kind]);
    const first = el.firstElementChild;
    if (label && first && /^H[1-6]$/.test(first.tagName) && label.test(first.textContent ?? "")) {
      removedLabels.push(first.textContent ?? "");
      first.remove();
    }
    while (el.firstChild) box.appendChild(el.firstChild);
    return box;
  };

  // Chuyển từng phần tử cấp đầu, rồi gom thành mục/phần.
  const out = doc.createElement("div");
  let section: Element | null = null;
  let part: Element | null = null;
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === 3) {
      if (child.textContent?.trim()) {
        const p = doc.createElement("p");
        p.textContent = child.textContent.trim();
        (part ?? section ?? out).appendChild(p);
      }
      continue;
    }
    if (child.nodeType !== 1) continue;
    let el = child as Element;
    const cls = el.classList;
    if (cls.contains("lesson-objectives")) el = toBox(el, "objectives", /mục tiêu/i);
    else if (cls.contains("lesson-summary")) {
      out.appendChild(toBox(el, "summary", /tổng kết|kết luận/i));
      section = null;
      part = null;
      continue;
    } else if (cls.contains("callout")) el = toBox(el, "note", null);

    if (el.tagName === "H2") {
      section = doc.createElement("section");
      section.className = "lesson-section";
      section.setAttribute("data-layout", "text");
      section.appendChild(el);
      out.appendChild(section);
      part = null;
    } else if (section && el.tagName === "H3") {
      part = doc.createElement("div");
      part.className = "lesson-part";
      part.appendChild(el);
      section.appendChild(part);
    } else {
      (part ?? section ?? out).appendChild(el);
    }
  }

  // Gỡ toàn bộ style và class lạ (giữ class của các khối mới).
  const KEEP = new Set(["lesson-section", "lesson-part", "lesson-box", "lesson-figure"]);
  out.querySelectorAll("*").forEach((n) => {
    n.removeAttribute("style");
    if (n.hasAttribute("class") && !KEEP.has(n.getAttribute("class") ?? "")) n.removeAttribute("class");
  });

  const next = out.innerHTML.trim();
  if (!next) return { ok: false, reason: "empty" };

  const before = removeWords(words(textOf(html)), removedLabels.flatMap((l) => words(l)));
  const after = words(textOf(next));
  if (before.join(" ") !== after.join(" ")) return { ok: false, reason: "text_mismatch" };
  if (imgs(new DOMParser().parseFromString(html, "text/html")) !== imgs(out)) return { ok: false, reason: "image_mismatch" };
  if (probeEditorLoss(next, EXTENSIONS)) return { ok: false, reason: "editor_loss" };
  return { ok: true, html: next, look };
}

/** Chữ của bài, mỗi nút chữ cách nhau một dấu cách (textContent dính liền chữ của hai khối kề nhau). */
function textOf(html: string): string {
  const body = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html").body;
  const parts: string[] = [];
  const walker = body.ownerDocument.createTreeWalker(body, 4 /* NodeFilter.SHOW_TEXT */);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) parts.push(n.nodeValue ?? "");
  return parts.join(" ");
}
