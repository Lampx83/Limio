import {
  OUTLINE_BOX_KINDS,
  isLessonLayoutKey,
  type LessonLayoutKey,
  type LessonOutline,
  type OutlineBoxKind,
  type OutlineSection,
  type SourcePara,
} from "@feedbackme/shared-types";
import { htmlToParas } from "./lessonSource";
import { newOutlineId } from "./lessonOutline";

/**
 * "Làm lại từ dàn ý" (S4): dựng dàn ý từ chính khối Văn bản hiện có, không gọi
 * AI. Tài liệu nguồn là chữ của bài (tách đoạn như tài liệu tải lên); mỗi mục
 * <section> của bài thành một mục dàn ý giữ nguyên tiêu đề, bố cục, hộp và các
 * đoạn của nó. Bài cũ không chia mục thì chia theo <h2>. Hàm thuần, chạy ở máy chủ.
 */

function textOf(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function firstSentence(paras: SourcePara[]): string[] {
  const t = paras.find((p): p is { t: string } => "t" in p && p.t.length > 20);
  if (!t) return [];
  const s = t.t.split(/(?<=[.!?])\s/)[0] ?? t.t;
  return [s.slice(0, 280)];
}

interface Chunk {
  title: string;
  layout: LessonLayoutKey;
  inner: string;
}

function boxKinds(html: string): OutlineBoxKind[] {
  const kinds = [...html.matchAll(/class="lesson-box" data-kind="(\w+)"/g)].map((m) => m[1]);
  return [...new Set(kinds.filter((k): k is OutlineBoxKind => (OUTLINE_BOX_KINDS as readonly string[]).includes(k ?? "")))];
}

export function outlineFromLessonHtml(html: string, lessonTitle: string): { paras: SourcePara[]; outline: LessonOutline } {
  // Mục tiêu hiện có (hộp Mục tiêu học tập ở ngoài các mục) được giữ làm mục tiêu của dàn ý.
  const objectives: string[] = [];
  let rest = html.replace(/<div class="lesson-box" data-kind="objectives"[^>]*>([\s\S]*?)<\/div>/g, (_m, inner: string) => {
    for (const li of inner.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/g)) {
      const t = textOf(li[1] ?? "");
      if (t) objectives.push(t);
    }
    return "";
  });
  // Tổng kết sẽ được viết lại từ bài mới — bỏ khỏi nguồn.
  rest = rest.replace(/<div class="lesson-box" data-kind="summary"[^>]*>[\s\S]*?<\/div>/g, "");

  const chunks: Chunk[] = [];
  let leading = "";
  if (/<section class="lesson-section"/.test(rest)) {
    let last = 0;
    for (const m of rest.matchAll(/<section class="lesson-section" data-layout="(\w+)">([\s\S]*?)<\/section>/g)) {
      leading += rest.slice(last, m.index);
      last = (m.index ?? 0) + m[0].length;
      const inner = m[2] ?? "";
      const h2 = /<h2[^>]*>([\s\S]*?)<\/h2>/.exec(inner);
      chunks.push({
        title: textOf(h2?.[1] ?? "") || "Mục chưa có tiêu đề",
        layout: isLessonLayoutKey(m[1]) ? m[1] : "text",
        inner: h2 ? inner.replace(h2[0], "") : inner,
      });
    }
    leading += rest.slice(last);
  } else {
    // Bài chưa chia mục: mỗi <h2> mở một mục; phần trước <h2> đầu tiên là mở đầu.
    const pieces = rest.split(/(?=<h2[\s>])/);
    for (const piece of pieces) {
      const h2 = /^<h2[^>]*>([\s\S]*?)<\/h2>/.exec(piece);
      if (h2) chunks.push({ title: textOf(h2[1] ?? "") || "Mục chưa có tiêu đề", layout: "text", inner: piece.slice(h2[0].length) });
      else leading += piece;
    }
  }

  const paras: SourcePara[] = [];
  const leadParas = htmlToParas(leading);
  paras.push(...leadParas);
  const sections: OutlineSection[] = [];
  if (leadParas.length && chunks.length === 0) chunks.push({ title: lessonTitle || "Nội dung bài", layout: "text", inner: "" });
  chunks.forEach((c, i) => {
    const own = htmlToParas(c.inner);
    const start = paras.length;
    paras.push(...own);
    const idx = own.map((_, k) => start + k);
    // Phần mở đầu (trước mục đầu tiên) thuộc về mục đầu tiên.
    const withLead = i === 0 ? [...leadParas.map((_, k) => k), ...idx] : idx;
    sections.push({
      id: newOutlineId(),
      title: c.title,
      layout: c.layout,
      points: firstSentence(own.length ? own : leadParas),
      boxes: boxKinds(c.inner),
      paras: withLead,
    });
  });

  return {
    paras,
    outline: {
      ignoredParas: [],
      lessons: [{ id: newOutlineId(), title: lessonTitle, objectives: objectives.slice(0, 5), sections }],
    },
  };
}
