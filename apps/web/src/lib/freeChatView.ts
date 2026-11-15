/**
 * "Thử nói tự do" với bạn ảo — phần thuần của giao diện (docs/tieu-chi/limio-language-noi-tu-do-voi-ban-ao.md): đọc cấu hình, đánh dấu cụm
 * mục tiêu đã dùng, dựng bản chữ để lưu (và để AI nhận xét) và khôi phục từ bản chữ đã lưu, lời nhắn lỗi.
 */

import { tFor } from "@/lib/i18n/tFor";
import type { UiLang } from "@/lib/i18n/core";

export const FREECHAT_MAX_CHARS = 300;
export const FREECHAT_MIN_FEEDBACK_TURNS = 2;

/** Gợi ý soạn sẵn của phiếu (docs/tieu-chi/limio-language-ban-ao-scaffolding-moc-1.md, AC2). Giới hạn trùng `parseScaffold` của core-feedback. */
export interface FreeChatScaffold {
  ideas: string[];
  frames: Array<{ en: string; vi: string }>;
  phrases: Array<{ en: string; vi: string }>;
  vocab: Array<{ en: string; vi: string }>;
  /** Đoạn nói mẫu: `text` có `**…**` tô sáng mẫu câu; `audio` là đường dẫn `/api/exam-assets/<tên>` hoặc rỗng. */
  model: { text: string; audio: string } | null;
}

/** Chỗ trống trong mẫu câu: học viên phải điền trước khi gửi. */
export const FRAME_BLANK = "___";

export interface FreeChatView {
  scenario: string;
  partnerRole: string;
  learnerRole: string;
  opening: string;
  targets: string[];
  maxTurns: number;
  /** Không có = phiếu không có gợi ý soạn sẵn (giao diện như trước, chỉ thêm công thức và khay "Khi bị bí"). */
  scaffold?: FreeChatScaffold | null;
}

/** Giọng đọc lời bạn ảo do máy chủ trả: các đoạn âm thanh base64 phát nối tiếp. */
export interface PartnerSpeech {
  audioChunks: string[];
  contentType: string;
}

/** Đọc `speech` trong phản hồi máy chủ (dữ liệu không đáng tin): đúng dạng thì trả lại, sai/thiếu thì null (chỉ có chữ). */
export function asPartnerSpeech(v: unknown): PartnerSpeech | null {
  if (!isObj(v) || typeof v.contentType !== "string" || !Array.isArray(v.audioChunks)) return null;
  const chunks = v.audioChunks.filter((c): c is string => typeof c === "string" && c !== "");
  return chunks.length > 0 ? { audioChunks: chunks, contentType: v.contentType } : null;
}

/** Một lượt bạn ảo trả lời: chữ, kèm giọng đọc nếu máy chủ đọc được (null/thiếu → chỉ có chữ). */
export interface PartnerReply {
  text: string;
  speech?: PartnerSpeech | null;
}

export interface ChatMsg {
  role: "learner" | "partner";
  text: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

const pairs = (v: unknown, max: number, enMax: number, viMax: number): Array<{ en: string; vi: string }> =>
  Array.isArray(v)
    ? v
        .map((x) => (isObj(x) ? { en: str(x.en, enMax), vi: str(x.vi, viMax) } : { en: "", vi: "" }))
        .filter((x) => x.en)
        .slice(0, max)
    : [];

/** Đọc `scaffold` từ dữ liệu không đáng tin: mục sai dạng bị bỏ, quá giới hạn bị cắt; không còn gì thì null. */
export function parseScaffoldView(v: unknown): FreeChatScaffold | null {
  if (!isObj(v)) return null;
  const ideas = Array.isArray(v.ideas) ? v.ideas.map((t) => str(t, 120)).filter(Boolean).slice(0, 4) : [];
  const frames = pairs(v.frames, 8, 120, 120);
  const phrases = pairs(v.phrases, 12, 40, 60);
  const vocab = pairs(v.vocab, 12, 40, 60);
  const m = isObj(v.model) ? v.model : null;
  const text = m ? str(m.text, 700) : "";
  const audio = m ? str(m.audio, 300) : "";
  const model = text ? { text, audio: audio.startsWith("/api/exam-assets/") ? audio : "" } : null;
  return ideas.length || frames.length || phrases.length || vocab.length || model ? { ideas, frames, phrases, vocab, model } : null;
}

/** Đọc `config.freechat` từ dữ liệu không đáng tin; null nếu thiếu tình huống hoặc lời mở đầu. Số lượt kẹp vào 4–12 (mặc định 8). */
export function parseFreeChatView(config: unknown): FreeChatView | null {
  const fc = isObj(config) ? config.freechat : null;
  if (!isObj(fc)) return null;
  const scenario = str(fc.scenario, 600);
  const opening = str(fc.opening, FREECHAT_MAX_CHARS);
  if (!scenario || !opening) return null;
  const targets = Array.isArray(fc.targets) ? fc.targets.map((t) => str(t, 120)).filter(Boolean).slice(0, 10) : [];
  const turns = typeof fc.maxTurns === "number" && Number.isFinite(fc.maxTurns) ? Math.round(fc.maxTurns) : 8;
  return {
    scenario,
    partnerRole: str(fc.partnerRole, 60) || "Partner",
    learnerRole: str(fc.learnerRole, 60) || "You",
    opening,
    targets,
    maxTurns: Math.min(12, Math.max(4, turns)),
    scaffold: parseScaffoldView(fc.scaffold),
  };
}

const norm = (t: string) =>
  t
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Cụm mục tiêu có trong lời học viên không: "…" (hoặc "...") là chỗ học viên điền, nên cụm được tách thành các đoạn, mỗi đoạn phải xuất hiện
 * (dãy từ liền nhau, không phân biệt hoa thường, dấu câu, dấu nháy) THEO THỨ TỰ. Cụm không còn đoạn nào (chỉ có "…") thì không khớp.
 */
export function phraseUsed(target: string, text: string): boolean {
  const segments = target
    .split(/(?:…|\.\.\.)+/)
    .map(norm)
    .filter(Boolean);
  if (!segments.length) return false;
  const hay = ` ${norm(text)} `;
  let pos = 0;
  for (const seg of segments) {
    const at = hay.indexOf(` ${seg} `, pos);
    if (at < 0) return false;
    pos = at + seg.length + 1; // giữ dấu cách cuối của đoạn này làm dấu cách đầu của đoạn sau
  }
  return true;
}

/** Phần của mẫu câu dùng để so khớp ✓: đoạn không rỗng đầu tiên khi tách theo chỗ trống (mẫu không có chỗ trống thì cả câu). */
export const frameStem = (en: string): string => en.split(FRAME_BLANK).map((x) => x.trim()).find(Boolean) ?? "";

export const frameUsed = (en: string, learnerTexts: string[]): boolean => {
  const stem = frameStem(en);
  return !!stem && learnerTexts.some((x) => phraseUsed(stem, x));
};

/** Lời còn chỗ trống chưa điền thì không gửi được. */
export const hasBlank = (text: string): boolean => text.includes(FRAME_BLANK);

/**
 * Chèn `piece` vào `text` tại vùng chọn [start, end] (thay vùng chọn nếu có). Thêm dấu cách trước nếu chữ liền trước không phải khoảng trắng. Kết quả cắt ở `max`
 * ký tự. Trả vùng chọn mới: có chỗ trống thì bôi đen chỗ trống ĐẦU TIÊN của đoạn vừa chèn (để gõ đè), không thì đặt con trỏ cuối đoạn chèn.
 */
export function insertIntoDraft(text: string, start: number, end: number, piece: string, max: number): { text: string; selStart: number; selEnd: number } {
  const a = Math.max(0, Math.min(start, text.length));
  const b = Math.max(a, Math.min(end, text.length));
  const before = text.slice(0, a);
  const lead = before !== "" && !/\s$/.test(before) ? " " : "";
  const inserted = lead + piece;
  const out = (before + inserted + text.slice(b)).slice(0, max);
  const blank = inserted.indexOf(FRAME_BLANK);
  if (blank >= 0) {
    const s0 = before.length + blank;
    return { text: out, selStart: Math.min(s0, out.length), selEnd: Math.min(s0 + FRAME_BLANK.length, out.length) };
  }
  const caret = Math.min(before.length + inserted.length, out.length);
  return { text: out, selStart: caret, selEnd: caret };
}

/** Tách đoạn nói mẫu thành các đoạn thường và đoạn tô sáng (`**…**`); dấu `**` không khớp cặp thì coi như chữ thường. */
export function highlightSegments(text: string): Array<{ text: string; hl: boolean }> {
  const parts = text.split("**");
  if (parts.length % 2 === 0) return [{ text: text.split("**").join(""), hl: false }];
  return parts.map((t, i) => ({ text: t, hl: i % 2 === 1 })).filter((p) => p.text !== "");
}

/** Chữ thuần của đoạn nói mẫu (bỏ `**`), để đọc thành tiếng hoặc kiểm tra. */
export const plainModel = (text: string): string => text.split("**").join("");

/** Công thức 3 bước của một lượt nói (cố định, mọi phiếu). */
export const FORMULA_STEPS = ["Trả lời", "Thêm một lý do hoặc ví dụ", "Hỏi lại"] as const;
export const FORMULA_EXAMPLE = "I prefer cities because there is more to do. What about you?";

/** Khay "Khi bị bí" (tiếng Anh, chỉ cho khoá tiếng Anh): `___` là chỗ trống học viên phải điền. */
export const STUCK_GROUPS: Array<{ label: string; items: string[] }> = [
  { label: "Câu giờ", items: ["Let me think…", "Well, ___", "That's a good question."] },
  { label: "Chưa biết nói", items: ["How can I say ___ in English?", "I mean ___", "It's a thing you use to ___", "It's a kind of ___"] },
  { label: "Nhờ nhắc lại", items: ["Could you say that again?", "Sorry, I didn't catch that.", "Could you speak more slowly?"] },
  { label: "Hỏi lại", items: ["What about you?", "How about you?", "Really? Why?"] },
];

export function usedTargets(targets: string[], learnerTexts: string[]): boolean[] {
  return targets.map((t) => learnerTexts.some((x) => phraseUsed(t, x)));
}

/** Bản chữ để lưu làm câu trả lời: "[Free chat]" rồi mỗi dòng "Partner: …"/"Learner: …" (lời mở đầu là dòng đầu). */
export function transcriptOf(view: Pick<FreeChatView, "opening">, history: ChatMsg[]): string {
  const lines = [`Partner: ${view.opening}`, ...history.map((m) => `${m.role === "learner" ? "Learner" : "Partner"}: ${m.text}`)];
  return `[Free chat]\n${lines.join("\n")}`;
}

/** Số lượt học viên trong bản chữ đã lưu (số dòng "Learner:"). */
export function learnerTurnCount(text: string): number {
  return text.split(/\r?\n/).filter((l) => l.startsWith("Learner: ")).length;
}

/**
 * Đọc lại bản chữ đã lưu thành lịch sử (không gồm lời mở đầu) để tải lại trang không mất hội thoại. Không đọc được (sai dạng,
 * không xen kẽ, kết thúc bằng lượt của học viên) thì trả null.
 */
export function restoreChat(text: string, view: Pick<FreeChatView, "opening">): ChatMsg[] | null {
  if (!text.startsWith("[Free chat]")) return null;
  const lines = text.split(/\r?\n/).slice(1).filter((l) => l.trim());
  if (!lines.length || !lines[0]!.startsWith("Partner: ") || lines[0]!.slice(9).trim() !== view.opening) return null;
  const out: ChatMsg[] = [];
  for (const [i, l] of lines.slice(1).entries()) {
    const want = i % 2 === 0 ? "Learner: " : "Partner: ";
    if (!l.startsWith(want)) return null;
    out.push({ role: want === "Learner: " ? "learner" : "partner", text: l.slice(want.length).trim() });
  }
  return out.length && out.length % 2 === 0 ? out : out.length === 0 ? [] : null;
}

/** Lời nhắn lỗi theo mã của máy chủ (hoặc "network"), theo ngôn ngữ giao diện. Hội thoại và lời đã nhập vẫn còn, bấm gửi lại được. */
export function freeChatErrorMessage(code: string | null | undefined, lang: UiLang = "vi"): string {
  const t = tFor(lang);
  switch (code) {
    case "openai_not_configured":
      return t("practice.say.err.notConfigured");
    case "daily_token_cap":
    case "no_token_budget":
    case "global_token_cap":
    case "rate_limited":
      return t("practice.say.err.quota");
    case "control_group":
      return t("practice.say.err.control");
    case "turn_limit":
      return t("practice.say.err.turnLimit");
    case "message_invalid":
      return t("practice.say.err.message", { n: FREECHAT_MAX_CHARS });
    case "blank_left":
      return t("practice.say.err.blank");
    case "openai_error":
    case "analysis_empty":
      return t("practice.say.err.reply");
    case "network":
      return t("practice.say.err.network");
    default:
      return t("practice.say.err.other");
  }
}
