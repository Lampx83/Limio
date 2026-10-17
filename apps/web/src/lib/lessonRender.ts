import {
  LESSON_BOX_LABELS,
  type OutlineLesson,
  type OutlineSection,
  type SectionDraft,
  type SourcePara,
} from "@feedbackme/shared-types";

/**
 * Dựng HTML bài học từ dàn ý + các mục AI đã viết (SectionDraft). Đúng dạng mà
 * trình soạn thảo bài học hiểu (components/richtext/lessonNodes.ts), nên bài
 * tạo ra mở sửa được ngay, không mất gì. Mọi chữ đều được thoát HTML; chỉ
 * **đậm** và *nghiêng* được đổi thành thẻ. Hàm thuần.
 */

const ESC: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" };

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ESC[c]!);
}

/** Chữ thường → HTML trong dòng: thoát ký tự, rồi **đậm**, *nghiêng*. Gỡ emoji. */
export function inline(s: string): string {
  return escapeHtml(s.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]/gu, "").replace(/\s+/g, " ").trim())
    .replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>");
}

const p = (t: string) => `<p>${inline(t)}</p>`;
const ul = (items: string[]) => (items.length ? `<ul>${items.map((i) => `<li>${p(i)}</li>`).join("")}</ul>` : "");

function box(kind: keyof typeof LESSON_BOX_LABELS, title: string, inner: string): string {
  const label = escapeHtml(title.trim() || LESSON_BOX_LABELS[kind]);
  return `<div class="lesson-box" data-kind="${kind}" data-title="${label}">${inner}</div>`;
}

function figure(img: { img: string; alt: string }, caption: string): string {
  return `<figure class="lesson-figure"><img src="${escapeHtml(img.img)}" alt="${escapeHtml(img.alt)}"><figcaption>${inline(caption || img.alt)}</figcaption></figure>`;
}

function imagesOf(s: OutlineSection, paras: SourcePara[]): Array<{ img: string; alt: string }> {
  return s.paras.map((n) => paras[n]).filter((x): x is { img: string; alt: string } => !!x && "img" in x);
}

/** Một mục AI viết → <section>. */
export function renderSection(s: OutlineSection, d: SectionDraft, paras: SourcePara[]): string {
  const imgs = imagesOf(s, paras);
  let out = `<section class="lesson-section" data-layout="${s.layout}"><h2>${inline(s.title)}</h2>`;
  out += d.intro.map(p).join("");
  // Ảnh của tài liệu luôn được giữ (D2): ảnh đầu dùng chú thích AI viết, các ảnh sau dùng mô tả gốc.
  out += imgs.map((img, i) => figure(img, i === 0 ? d.imageCaption : img.alt)).join("");
  for (const part of d.parts) {
    const head = part.title ? `<h3>${inline(part.title)}</h3>` : "";
    const body = part.paragraphs.map(p).join("") + ul(part.bullets);
    // Phần phải có ít nhất một khối; chỉ có tiêu đề thì vẫn hợp lệ.
    out += `<div class="lesson-part">${head || ""}${body || (head ? "" : "<p></p>")}</div>`;
  }
  for (const b of d.boxes) out += box(b.kind, b.title, b.paragraphs.map(p).join(""));
  return `${out}</section>`;
}

/**
 * Mục sau khi "Nhờ AI" sửa (S2): dựng lại khối từ bản đề xuất, đặt lại đúng các
 * ảnh có chú thích của mục cũ (AI không nhìn thấy ảnh nên không làm mất được).
 */
export function renderEditedSection(
  head: { title: string; layout: string },
  d: SectionDraft,
  figures: Array<{ src: string; alt: string; caption: string }>,
): string {
  let out = `<section class="lesson-section" data-layout="${escapeHtml(head.layout)}"><h2>${inline(head.title)}</h2>`;
  out += d.intro.map(p).join("");
  out += figures
    .map((f) => `<figure class="lesson-figure"><img src="${escapeHtml(f.src)}" alt="${escapeHtml(f.alt)}"><figcaption>${inline(f.caption)}</figcaption></figure>`)
    .join("");
  for (const part of d.parts) {
    const h = part.title ? `<h3>${inline(part.title)}</h3>` : "";
    const body = part.paragraphs.map(p).join("") + ul(part.bullets);
    out += `<div class="lesson-part">${h}${body || (h ? "" : "<p></p>")}</div>`;
  }
  for (const b of d.boxes) out += box(b.kind, b.title, b.paragraphs.map(p).join(""));
  return `${out}</section>`;
}

/** Dự phòng khi AI không viết được mục (T5): giữ nguyên các đoạn tài liệu của mục. */
export function fallbackSection(s: OutlineSection, paras: SourcePara[]): string {
  let out = `<section class="lesson-section" data-layout="${s.layout === "image" ? "image" : "text"}"><h2>${inline(s.title)}</h2>`;
  const texts = s.paras.map((n) => paras[n]).filter((x): x is { t: string } => !!x && "t" in x);
  out += texts.length ? texts.map((t) => p(t.t)).join("") : s.points.map(p).join("") || "<p></p>";
  out += imagesOf(s, paras).map((img) => figure(img, img.alt)).join("");
  return `${out}</section>`;
}

export interface RenderLessonInput {
  lesson: OutlineLesson;
  /** HTML từng mục (đã dựng bằng renderSection hoặc fallbackSection), cùng thứ tự với lesson.sections. */
  sectionsHtml: string[];
  /** null = không thêm Mục tiêu và Tổng kết (giảng viên tắt). */
  objectivesAndSummary: { objectives: string[]; summary: string[] } | null;
}

export function renderLesson(input: RenderLessonInput): string {
  let out = "";
  const os = input.objectivesAndSummary;
  if (os && os.objectives.length) out += box("objectives", "", ul(os.objectives));
  out += input.sectionsHtml.join("");
  if (os && os.summary.length) out += box("summary", "", ul(os.summary));
  return out;
}

/** Chữ của một đoạn HTML (bỏ thẻ, giải thực thể cơ bản) — dùng để đối chiếu. */
function textOfHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function words(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFC")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Cách "Giữ nguyên lời" (T6): đoạn tài liệu nào không thấy trong bài. Một đoạn
 * coi là "có" khi ít nhất 60% cụm 3 từ liên tiếp của nó xuất hiện trong bài —
 * chịu được sửa chính tả, chia đoạn, nhưng bắt được đoạn bị bỏ hay bị viết lại.
 */
export function missingParas(paras: SourcePara[], indices: number[], html: string): number[] {
  const outWords = words(textOfHtml(html));
  const grams = new Set<string>();
  for (let i = 0; i + 2 < outWords.length; i++) grams.add(`${outWords[i]} ${outWords[i + 1]} ${outWords[i + 2]}`);
  const flat = ` ${outWords.join(" ")} `;
  const out: number[] = [];
  for (const n of indices) {
    const src = paras[n];
    if (!src || !("t" in src)) continue;
    const w = words(src.t);
    if (w.length === 0) continue;
    if (w.length < 3) {
      if (!flat.includes(` ${w.join(" ")} `)) out.push(n);
      continue;
    }
    let hit = 0;
    const total = w.length - 2;
    for (let i = 0; i < total; i++) if (grams.has(`${w[i]} ${w[i + 1]} ${w[i + 2]}`)) hit++;
    if (hit / total < 0.6) out.push(n);
  }
  return out;
}
