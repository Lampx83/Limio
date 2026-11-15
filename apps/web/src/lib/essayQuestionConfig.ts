/**
 * Cấu hình câu `essay` (Tự luận, trả lời mở) trong trình soạn: đọc từ / dựng thành `config` lưu vào ExamQuestion.
 * docs/tieu-chi/bai-luyen-tra-loi-bang-giong-noi-va-bai-mau.md (AC3, AC5a).
 *
 * Hàm thuần để test được. Hai công tắc `voiceAnswer` / `aiFeedback` mặc định BẬT, nên chỉ ghi `false` khi tắt (config gọn,
 * câu cũ chưa có khoá vẫn hiểu là bật). `explanationAudio` là đường dẫn kho đề do route tải lên trả về (`/api/exam-assets/<tên>`).
 */

import { parseRolePlay, parseScript } from "./rolePlayView";
import { parseFreeChatView, parseScaffoldView } from "./freeChatView";

/** Hội thoại đóng vai trong trình soạn: kịch bản viết bằng chữ ("A: …"/"B: …" mỗi dòng), tên hai vai và audio từng lượt (theo thứ tự lượt). */
export interface RolePlayDraft {
  text: string;
  roleA: string;
  roleB: string;
  audio: string[];
}

export function emptyRolePlayDraft(): RolePlayDraft {
  return { text: "", roleA: "", roleB: "", audio: [] };
}

/** Đọc `config.roleplay` đã lưu thành bản nháp của form (kịch bản thành chữ). Không có thì bản nháp rỗng. */
export function rolePlayDraftFromConfig(cfg: Record<string, unknown>): RolePlayDraft {
  const rp = parseRolePlay(cfg);
  if (!rp) return emptyRolePlayDraft();
  return {
    text: rp.turns.map((t) => `${t.speaker}: ${t.text}`).join("\n"),
    roleA: rp.roles.A === "A" ? "" : rp.roles.A,
    roleB: rp.roles.B === "B" ? "" : rp.roles.B,
    audio: rp.turns.map((t) => t.audio ?? ""),
  };
}

/** Dựng `config.roleplay`; undefined nếu kịch bản ít hơn 2 lượt (không phải hội thoại). Dòng sai dạng bị bỏ (form báo riêng). Audio theo đúng số thứ tự lượt. */
export function buildRolePlayConfig(d: RolePlayDraft): Record<string, unknown> | undefined {
  const { turns } = parseScript(d.text);
  if (turns.length < 2) return undefined;
  const roles = { ...(d.roleA.trim() ? { A: d.roleA.trim() } : {}), ...(d.roleB.trim() ? { B: d.roleB.trim() } : {}) };
  return {
    ...(Object.keys(roles).length ? { roles } : {}),
    turns: turns.map((t, i) => {
      const audio = cleanExplanationAudio(d.audio[i]);
      return { speaker: t.speaker, text: t.text, ...(audio ? { audio } : {}) };
    }),
  };
}

/** "Thử nói tự do" với bạn ảo trong trình soạn: tình huống, vai, lời mở đầu, cụm mục tiêu (mỗi dòng một cụm) và số lượt tối đa. */
export interface FreeChatDraft {
  scenario: string;
  partnerRole: string;
  learnerRole: string;
  opening: string;
  targets: string;
  maxTurns: number;
  /**
   * Gợi ý soạn sẵn (docs/tieu-chi/limio-language-ban-ao-scaffolding-moc-1.md AC4): ý tưởng (mỗi dòng một ý), mẫu câu "câu có ___ | nghĩa", cụm từ và từ vựng
   * "mục | nghĩa", đoạn nói mẫu (`modelText` có `**…**` tô sáng mẫu câu) và audio của nó (`modelAudio`, đường dẫn `/api/exam-assets/<tên>`).
   */
  ideas?: string;
  frames?: string;
  phrases?: string;
  vocab?: string;
  modelText?: string;
  modelAudio?: string;
}

export const emptyFreeChatDraft = (): FreeChatDraft => ({ scenario: "", partnerRole: "", learnerRole: "", opening: "", targets: "", maxTurns: 8, ideas: "", frames: "", phrases: "", vocab: "", modelText: "", modelAudio: "" });

/** "câu | nghĩa" → { en, vi }; thiếu nghĩa thì vi rỗng. Dấu `|` đầu tiên là chỗ tách. */
const splitPair = (line: string): { en: string; vi: string } => {
  const i = line.indexOf("|");
  return i < 0 ? { en: line.trim(), vi: "" } : { en: line.slice(0, i).trim(), vi: line.slice(i + 1).trim() };
};
const joinPairs = (a: Array<{ en: string; vi: string }>): string => a.map((x) => (x.vi ? `${x.en} | ${x.vi}` : x.en)).join("\n");
const lines = (t: string): string[] => t.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);

export function freeChatDraftFromConfig(cfg: Record<string, unknown>): FreeChatDraft {
  const v = parseFreeChatView(cfg);
  if (!v) return emptyFreeChatDraft();
  return {
    scenario: v.scenario,
    partnerRole: v.partnerRole === "Partner" ? "" : v.partnerRole,
    learnerRole: v.learnerRole === "You" ? "" : v.learnerRole,
    opening: v.opening,
    targets: v.targets.join("\n"),
    maxTurns: v.maxTurns,
    ideas: (v.scaffold?.ideas ?? []).join("\n"),
    frames: joinPairs(v.scaffold?.frames ?? []),
    phrases: joinPairs(v.scaffold?.phrases ?? []),
    vocab: joinPairs(v.scaffold?.vocab ?? []),
    modelText: v.scaffold?.model?.text ?? "",
    modelAudio: v.scaffold?.model?.audio ?? "",
  };
}

/** Dựng `config.freechat`; undefined nếu thiếu tình huống hoặc lời mở đầu. Cụm mục tiêu: mỗi dòng một cụm, tối đa 10. Số lượt kẹp 4–12. */
export function buildFreeChatConfig(d: FreeChatDraft): Record<string, unknown> | undefined {
  const scenario = d.scenario.trim();
  const opening = d.opening.trim();
  if (!scenario || !opening) return undefined;
  const targets = d.targets.split(/\r?\n/).map((t) => t.trim()).filter(Boolean).slice(0, 10);
  const turns = Math.min(12, Math.max(4, Math.round(Number.isFinite(d.maxTurns) ? d.maxTurns : 8)));
  const scaffold = parseScaffoldView({
    ideas: lines(d.ideas ?? ""),
    frames: lines(d.frames ?? "").map(splitPair),
    phrases: lines(d.phrases ?? "").map(splitPair),
    vocab: lines(d.vocab ?? "").map(splitPair),
    model: (d.modelText ?? "").trim() ? { text: (d.modelText ?? "").trim(), audio: (d.modelAudio ?? "").trim() } : undefined,
  });
  return {
    scenario: scenario.slice(0, 600),
    ...(d.partnerRole.trim() ? { partnerRole: d.partnerRole.trim().slice(0, 60) } : {}),
    ...(d.learnerRole.trim() ? { learnerRole: d.learnerRole.trim().slice(0, 60) } : {}),
    opening: opening.slice(0, 300),
    ...(targets.length ? { targets: targets.map((t) => t.slice(0, 120)) } : {}),
    maxTurns: turns,
    ...(scaffold ? { scaffold } : {}),
  };
}

export interface EssayDraft {
  /** Tiêu chí đánh giá cho AI (HTML từ trình soạn chữ). */
  rubric: string;
  minWords: number;
  /** Bài mẫu (Sample answer). */
  explanation: string;
  explanationAudio: string;
  voiceAnswer: boolean;
  aiFeedback: boolean;
}

export function emptyEssayDraft(): EssayDraft {
  return { rubric: "", minWords: 0, explanation: "", explanationAudio: "", voiceAnswer: true, aiFeedback: true };
}

/** Đường dẫn audio bài mẫu hợp lệ của kho đề (khớp `EssayConfig.explanationAudio`); không thì chuỗi rỗng. */
export function cleanExplanationAudio(v: unknown): string {
  return typeof v === "string" && /^\/api\/exam-assets\/[A-Za-z0-9._-]+$/.test(v) && v.length <= 500 ? v : "";
}

/**
 * Đọc `config` đã lưu thành bản nháp của form. `rubricToHtml` đổi chữ thường của rubric cũ thành HTML cho trình soạn chữ
 * (truyền `plainToRichHtml`; tách ra để hàm này không kéo theo phụ thuộc).
 */
export function essayDraftFromConfig(cfg: Record<string, unknown>, rubricToHtml: (s: string) => string = (s) => s): EssayDraft {
  return {
    rubric: rubricToHtml(typeof cfg.rubric === "string" ? cfg.rubric : ""),
    minWords: typeof cfg.minWords === "number" ? cfg.minWords : 0,
    explanation: typeof cfg.explanation === "string" ? cfg.explanation : "",
    explanationAudio: cleanExplanationAudio(cfg.explanationAudio),
    voiceAnswer: cfg.voiceAnswer !== false,
    aiFeedback: cfg.aiFeedback !== false,
  };
}

/** Dựng `config` của câu essay: chỉ ghi khoá có giá trị; công tắc chỉ ghi khi tắt. */
export function buildEssayConfig(d: EssayDraft, roleplay?: RolePlayDraft, freechat?: FreeChatDraft): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (d.rubric) out.rubric = d.rubric;
  if (d.minWords > 0) out.minWords = d.minWords;
  const explanation = d.explanation.trim();
  if (explanation) out.explanation = explanation;
  const audio = cleanExplanationAudio(d.explanationAudio);
  if (audio) out.explanationAudio = audio;
  if (!d.voiceAnswer) out.voiceAnswer = false;
  if (!d.aiFeedback) out.aiFeedback = false;
  const rp = roleplay ? buildRolePlayConfig(roleplay) : undefined;
  if (rp) out.roleplay = rp;
  // Hai kiểu hội thoại không dùng cùng một câu: đã có kịch bản thì bỏ qua nói tự do.
  const fc = !rp && freechat ? buildFreeChatConfig(freechat) : undefined;
  if (fc) out.freechat = fc;
  return out;
}
