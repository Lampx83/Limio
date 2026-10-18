// Hỏi đáp với AI về một slide (tab Nhờ AI). Module thuần: chuẩn hoá câu trả lời của mô hình, lọc lịch sử trò chuyện
// gửi lên, chọn đoạn tài liệu liên quan. Không tin thẳng đầu ra mô hình: đề xuất sửa luôn đi qua proposalFromDraft.

import { stripEmoji, type DeckSourceKind } from "./limioLiveOutline";
import { deepStripEmoji, proposalFromDraft, type DraftContext, type SlideDraft } from "./limioLiveGenerate";

export const CHAT_HISTORY_TURNS = 6;
export const CHAT_MESSAGE_MAX = 500;
const REPLY_MAX = 1500;
const OPTION_MAX = 200;
const SUGGESTION_MAX = 400;
const HISTORY_TEXT_MAX = 1200;
/** Chữ tài liệu tối đa gửi kèm mỗi lượt (khoảng 2–3 nghìn token), thay cho cả tài liệu. */
export const CHAT_EXCERPT_CHARS = 6000;

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export type ChatProposal = { type: "content" | "quiz"; config: Record<string, unknown> };

export type ChatResult =
  | { kind: "answer"; reply: string; suggestion: string }
  | { kind: "clarify"; reply: string; options: string[] }
  | { kind: "propose"; reply: string; proposal: ChatProposal };

// Bỏ emoji rồi gỡ khoảng trắng nó để lại trước dấu câu ("đúng ✅." → "đúng.").
const clean = (v: unknown, max: number) => (typeof v === "string" ? stripEmoji(v).replace(/\s+([.,;:!?])(?=\s|$)/g, "$1").trim().slice(0, max) : "");

/**
 * Câu trả lời thô của mô hình → một trong ba kiểu. Hỏi lại thiếu hướng thì thành trả lời bằng lời; đề xuất mà bản nháp
 * không đủ cho bố cục (kể cả sau khi lấp phần giữ nguyên) hoặc có con số bịa thì thành câu báo rõ, không có đề xuất rỗng.
 */
export function normalizeChatReply(
  raw: unknown,
  opts: { current: { config: Record<string, unknown> }; layoutLabel: string; ctx?: DraftContext },
): ChatResult {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const reply = clean(o.reply, REPLY_MAX);
  const kind = o.kind === "clarify" || o.kind === "propose" ? o.kind : "answer";

  if (kind === "propose") {
    const draft = (o.draft && typeof o.draft === "object" ? { ...(o.draft as SlideDraft), index: 0 } : undefined) as SlideDraft | undefined;
    const proposal = proposalFromDraft("custom", opts.current, draft && deepStripEmoji(draft), opts.ctx);
    if (proposal) return { kind: "propose", reply: reply || "Đây là bản đề xuất sửa slide.", proposal };
    return {
      kind: "answer",
      reply: `AI chưa viết được bản đề xuất đủ nội dung cho bố cục ${opts.layoutLabel}. Thầy/cô thử nói rõ hơn phần cần sửa, hoặc dùng một lựa chọn nhanh.`,
      suggestion: "",
    };
  }
  if (kind === "clarify") {
    const options = [...new Set((Array.isArray(o.options) ? o.options : []).map((x) => clean(x, OPTION_MAX)).filter(Boolean))].slice(0, 3);
    if (options.length >= 2) return { kind: "clarify", reply: reply || "Thầy/cô muốn sửa theo hướng nào?", options };
  }
  return {
    kind: "answer",
    reply: reply || "AI chưa trả lời được câu này. Thầy/cô thử hỏi lại theo cách khác.",
    suggestion: clean(o.suggestion, SUGGESTION_MAX),
  };
}

/** Lịch sử do trình duyệt gửi lên: chỉ hai vai trò, chữ không rỗng, giữ các lượt cuối. */
export function sanitizeChatHistory(raw: unknown): ChatTurn[] {
  return (Array.isArray(raw) ? raw : [])
    .filter((t): t is Record<string, unknown> => !!t && typeof t === "object")
    .filter((t) => t.role === "user" || t.role === "assistant")
    .map((t) => ({ role: t.role as ChatTurn["role"], text: clean(t.text, HISTORY_TEXT_MAX) }))
    .filter((t) => t.text)
    .slice(-CHAT_HISTORY_TURNS);
}

const STOP = new Set(
  "của và là các cho có được một những với trong này thì không người học bài slide như khi để từ theo về đã sẽ đang cũng hay hoặc nào gì".split(" "),
);
const terms = (s: string) => [...new Set(s.toLowerCase().split(/[^\p{L}\p{N}]+/u).filter((w) => w.length >= 2 && !STOP.has(w)))];

function score(block: string, q: string[]): number {
  const words = new Set(block.toLowerCase().split(/[^\p{L}\p{N}]+/u));
  return q.reduce((n, t) => n + (words.has(t) ? 1 : 0), 0);
}

/** Chọn các khối có điểm cao nhất cho tới khi đủ ngân sách, trả theo thứ tự gốc. */
function pick(blocks: string[], q: string[], budget: number): string[] {
  const ranked = blocks
    .map((b, i) => ({ b, i, s: score(b, q) }))
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s || a.i - b.i);
  const chosen: typeof ranked = [];
  let used = 0;
  for (const x of ranked) {
    if (used + x.b.length + 2 > budget) continue;
    chosen.push(x);
    used += x.b.length + 2;
  }
  return chosen.sort((a, b) => a.i - b.i).map((x) => x.b);
}

function chunk(text: string, size: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n{2,}/)) {
    if (para.length <= size) out.push(para);
    else for (let i = 0; i < para.length; i += size) out.push(para.slice(i, i + size));
  }
  return out.filter((p) => p.trim());
}

/**
 * Đoạn tài liệu gửi kèm một lượt hỏi đáp: các đoạn liên quan nhất tới slide và câu hỏi (trùng từ), theo thứ tự gốc.
 * Bài có nguồn internet: giữ mô tả và nguyên dòng đầu "[n] tên (địa chỉ)" của từng trang được chọn để AI còn dẫn số nguồn.
 */
export function relevantExcerpt(source: string, query: string, kind: DeckSourceKind, max = CHAT_EXCERPT_CHARS): string {
  if (source.length <= max) return source;
  const q = terms(query);
  if (kind === "topic_web") {
    const marker = "# Nguồn tìm trên internet";
    const at = source.indexOf(marker);
    const head = (at >= 0 ? source.slice(0, at) : "").trim();
    const pages = (at >= 0 ? source.slice(at + marker.length) : source)
      .split(/\n+(?=\[\d+\] )/)
      .map((p) => p.trim().slice(0, 1600))
      .filter(Boolean);
    const budget = max - head.length - marker.length - 4;
    const chosen = pick(pages, q, budget);
    return `${head}\n\n${marker}\n${(chosen.length ? chosen : pages.slice(0, 1)).join("\n\n")}`.slice(0, max);
  }
  const chosen = pick(chunk(source, 1200), q, max);
  return chosen.length ? chosen.join("\n\n") : source.slice(0, max);
}
