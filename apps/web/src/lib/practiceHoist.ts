import type { PracticeEmbed } from "@feedbackme/core-lms";
import { splitPassageInstruction, type PassageDoc } from "./passageInstruction";

/** Bài đọc từ ngần này từ trở lên được coi là lý thuyết ở trên đầu bài (docs/tieu-chi/limio-language-y-kien-hoc-vien-giao-dien.md, AC8). */
export const READING_MIN_WORDS = 120;

export interface HoistedPassage {
  id: string;
  title: string;
  contentJson: PassageDoc;
  transcripts?: Record<string, string>;
}

function wordsAndAudio(node: unknown): { words: number; audio: boolean } {
  let words = 0;
  let audio = false;
  const walk = (n: unknown) => {
    if (!n || typeof n !== "object") return;
    const o = n as { type?: string; text?: string; content?: unknown[] };
    if (o.type === "audio" || o.type === "video") audio = true;
    if (typeof o.text === "string") words += o.text.split(/\s+/).filter(Boolean).length;
    o.content?.forEach(walk);
  };
  walk(node);
  return { words, audio };
}

const paragraphTexts = (doc: PassageDoc): string[] =>
  doc.content
    .map((n) => {
      let t = "";
      const walk = (x: unknown) => {
        if (!x || typeof x !== "object") return;
        const o = x as { text?: string; content?: unknown[] };
        if (typeof o.text === "string") t += o.text;
        o.content?.forEach(walk);
      };
      walk(n);
      return t.replace(/\s+/g, " ").trim().toLowerCase();
    })
    .filter((t) => t.split(" ").length >= 8);

/**
 * Bài đọc dùng chung cho nhiều exercise (vd ba đoạn A, B, C của 7A, 7B) có thể lặp lại trong từng đoạn của khối: chỉ lên MỘT lần.
 * Đoạn mà mọi đoạn văn đã có trong các đoạn trước thì bỏ; đoạn có nội dung mới thì giữ.
 */
export function dedupeHoisted<T extends { contentJson: PassageDoc }>(list: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const h of list) {
    const ps = paragraphTexts(h.contentJson);
    if (ps.length > 0 && ps.every((p) => seen.has(p))) continue;
    ps.forEach((p) => seen.add(p));
    out.push(h);
  }
  return out;
}

/**
 * Bài đọc dài (từ 120 từ, không có audio/video) của một khối bài luyện là lý thuyết: nội dung (trừ đề bài) trả ra `hoisted` để trang đặt
 * lên phía trên các tab; đoạn trong khối chỉ còn đề bài (một cột), tên đoạn giữ nguyên. Đoạn không có câu hỏi nào, đoạn ngắn hoặc có
 * audio không đổi. Không có gì để đưa lên thì trả đúng `embed` đã nhận.
 */
export function hoistReadingPassages(embed: PracticeEmbed): { embed: PracticeEmbed; hoisted: HoistedPassage[] } {
  const asked = new Set(embed.questions.map((q) => q.passageId).filter((x): x is string => !!x));
  const hoisted: HoistedPassage[] = [];
  const passages = embed.passages.map((p) => {
    if (!asked.has(p.id)) return p;
    const doc = p.contentJson as PassageDoc;
    const { words, audio } = wordsAndAudio(doc);
    if (audio || words < READING_MIN_WORDS) return p;
    const { instruction, rest } = splitPassageInstruction(doc);
    hoisted.push({ id: p.id, title: p.title, contentJson: rest, ...(p.transcripts ? { transcripts: p.transcripts } : {}) });
    const left: PassageDoc = { type: "doc", content: instruction ? (doc.content.slice(0, 1) as unknown[]) : [] };
    return { ...p, contentJson: left };
  });
  if (hoisted.length === 0) return { embed, hoisted };
  return { embed: { ...embed, passages }, hoisted: dedupeHoisted(hoisted) };
}
