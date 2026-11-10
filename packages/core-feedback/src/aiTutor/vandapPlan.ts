import type OpenAI from "openai";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { DEFAULT_MODEL, assertWithinCaps, recordAiUsage } from "./aiTutor";
import { AiGenerationError, callJsonModel } from "./generators";

/**
 * Limio Vấn đáp — "Tạo dàn từ tài liệu" (docs/tieu-chi/limio-van-dap.md, AC1.3–AC1.5).
 *
 * Dàn = 6–12 "ý cần hỏi": HỎI GÌ, THỨ TỰ NÀO. AI chỉ ĐỀ XUẤT; thầy/cô sửa rồi mới dùng. Hai điểm thiết kế:
 *  1. Tài liệu được tách thành đoạn đánh số; mô hình trả về SỐ ĐOẠN, còn đoạn nguồn (`sourceExcerpt`) do CODE ghép từ
 *     chính tài liệu. Nhờ vậy đoạn nguồn không bao giờ là chữ do mô hình bịa.
 *  2. Tài liệu dài hơn một lần đọc thì sinh THEO TỪNG PHẦN (ứng viên cho mỗi phần) rồi một lượt GỘP chọn–xếp thứ tự;
 *     không cắt mất phần sau (AC1.4). Lượt gộp chỉ CHỌN và SẮP các ứng viên đã có, không viết ý mới.
 *
 * Mọi lượt gọi đều ghi hạn mức AI của giảng viên. Lỗi ở bất kỳ lượt nào → ném lỗi, không trả dàn nửa vời (AC1.5).
 */

export const PLAN_MIN_ITEMS = 6;
export const PLAN_MAX_ITEMS = 12;
export const PLAN_MIN_CHARS = 200;
/** Ngân sách chữ tài liệu cho MỘT lần đọc (≈ 8–10 nghìn token đầu vào). */
export const PLAN_PART_BUDGET_CHARS = 24_000;
/** Đoạn dài hơn mức này bị cắt ở dấu câu để mỗi đoạn là một đơn vị nguồn vừa phải. */
const PARA_MAX_CHARS = 1_200;
const EXCERPT_MAX_CHARS = 1_800;
/** Tối đa số phần: tài liệu quá dài thì từ chối rõ ràng thay vì tốn token vô hạn. */
export const PLAN_MAX_PARTS = 12;

export type PlanLevel = "basic" | "intermediate" | "advanced";
export type PlanLanguage = "vi" | "en" | "zh";

export interface PlanSource {
  title: string;
  text: string;
}

export interface PlanItemDraft {
  core: string;
  sourceExcerpt: string;
  level: PlanLevel;
  expectedAnswer: string;
  maxFollowUps: number;
}

export interface GeneratedVanDapPlan {
  items: PlanItemDraft[];
  /** Số phần tài liệu mô hình đã đọc (>1 = sinh theo từng phần rồi gộp). */
  parts: number;
}

export interface GenerateVanDapPlanInput {
  materials: PlanSource[];
  durationMin: number;
  language: PlanLanguage;
}

interface Para {
  /** Chỉ số toàn cục, bắt đầu từ 0. */
  index: number;
  source: string;
  text: string;
}

interface RawCandidate {
  core: string;
  level: string;
  expectedAnswer: string;
  maxFollowUps: number;
  paras: number[];
}

interface Candidate extends PlanItemDraft {
  part: number;
}

// ── Tách đoạn và chia phần (thuần, test được) ──────────────────────────────

function splitLong(text: string): string[] {
  if (text.length <= PARA_MAX_CHARS) return [text];
  const out: string[] = [];
  let rest = text;
  while (rest.length > PARA_MAX_CHARS) {
    const window = rest.slice(0, PARA_MAX_CHARS);
    const cut = Math.max(window.lastIndexOf(". "), window.lastIndexOf("。"), window.lastIndexOf("; "), window.lastIndexOf(", "));
    const at = cut > PARA_MAX_CHARS * 0.5 ? cut + 1 : PARA_MAX_CHARS;
    out.push(rest.slice(0, at).trim());
    rest = rest.slice(at).trim();
  }
  if (rest) out.push(rest);
  return out;
}

/** Tách tài liệu thành đoạn đánh số liên tục qua mọi tài liệu. Dòng quá ngắn (số trang, đầu trang) được nối vào đoạn kế. */
export function splitIntoParas(sources: PlanSource[]): Para[] {
  const paras: Para[] = [];
  for (const src of sources) {
    const blocks = src.text
      .replace(/\r\n?/g, "\n")
      .split(/\n{2,}|\n(?=\s*(?:#{1,6}\s|\d+[.)]\s|[-*•]\s))/)
      .map((b) => b.replace(/\s*\n\s*/g, " ").trim())
      .filter((b) => b.length > 0);
    let carry = "";
    for (const b of blocks) {
      const merged = carry ? `${carry} ${b}` : b;
      if (merged.length < 40) {
        carry = merged;
        continue;
      }
      carry = "";
      for (const piece of splitLong(merged)) paras.push({ index: paras.length, source: src.title, text: piece });
    }
    if (carry) paras.push({ index: paras.length, source: src.title, text: carry });
  }
  return paras;
}

/** Chia đoạn thành các phần liên tiếp, mỗi phần không vượt ngân sách chữ (một đoạn luôn nằm trọn trong một phần). */
export function chunkParas(paras: Para[], budget = PLAN_PART_BUDGET_CHARS): Para[][] {
  const parts: Para[][] = [];
  let cur: Para[] = [];
  let size = 0;
  for (const p of paras) {
    if (cur.length > 0 && size + p.text.length > budget) {
      parts.push(cur);
      cur = [];
      size = 0;
    }
    cur.push(p);
    size += p.text.length;
  }
  if (cur.length > 0) parts.push(cur);
  return parts;
}

// ── Lời nhắc và lược đồ ────────────────────────────────────────────────────

const LANGUAGE_NAME: Record<PlanLanguage, string> = { vi: "tiếng Việt", en: "tiếng Anh", zh: "tiếng Trung" };

const CANDIDATE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          core: { type: "string" },
          level: { type: "string", enum: ["basic", "intermediate", "advanced"] },
          expectedAnswer: { type: "string" },
          maxFollowUps: { type: "integer" },
          paras: { type: "array", items: { type: "integer" } },
        },
        required: ["core", "level", "expectedAnswer", "maxFollowUps", "paras"],
      },
    },
  },
  required: ["items"],
};

const MERGE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: { keep: { type: "array", items: { type: "integer" } } },
  required: ["keep"],
};

const RULES = (language: PlanLanguage) => `Quy tắc nội dung:
- Chỉ dựa vào tài liệu. Không thêm kiến thức, số liệu, ví dụ hay khẳng định không có trong tài liệu.
- Viết bằng ${LANGUAGE_NAME[language]}, câu đầy đủ chủ ngữ và vị ngữ, không viết cụt, không emoji. Giữ nguyên thuật ngữ, tên riêng, số liệu của tài liệu.
- Mỗi "ý cần hỏi" là MỘT điều giám khảo muốn kiểm tra người học có hiểu hay không, không phải một câu hỏi viết sẵn.`;

function candidateSystem(language: PlanLanguage, want: { min: number; max: number }, partial: boolean): string {
  return `Bạn là giám khảo vấn đáp đại học. Đọc tài liệu của giảng viên (đã chia thành các đoạn đánh số [1], [2]…) và đề xuất "ý cần hỏi" cho buổi vấn đáp. Chỉ lập dàn ý, CHƯA đặt câu hỏi cho người học.${partial ? " Bạn chỉ thấy MỘT PHẦN của tài liệu; các phần khác được xử lý riêng." : ""}

${RULES(language)}

Mỗi ý gồm:
- core: nội dung cốt lõi cần kiểm tra, một câu (tối đa 40 từ).
- level: "basic" (nhớ/hiểu khái niệm), "intermediate" (giải thích, so sánh, áp dụng đơn giản), "advanced" (phân tích, đánh giá, vận dụng tình huống mới).
- expectedAnswer: ý đáp án mong đợi, 1–3 câu, người học KHÔNG được thấy phần này.
- maxFollowUps: số câu đào sâu tối đa cho ý này (0 đến 3). Ý dễ: 1; ý trọng tâm: 2; ý khó: 3.
- paras: số thứ tự các đoạn tài liệu làm căn cứ cho ý (1 đến 3 đoạn, chỉ dùng số đã thấy).

Đề xuất từ ${want.min} đến ${want.max} ý, xếp theo mức quan trọng giảm dần, bao phủ các nội dung chính khác nhau và pha trộn các mức độ. Trả JSON đúng lược đồ.`;
}

function candidatePrompt(part: Para[], index: number, total: number, durationMin: number): string {
  const lines = part.map((p) => `[${p.index + 1}] ${p.text}`).join("\n\n");
  return `Buổi vấn đáp dài khoảng ${durationMin} phút.${total > 1 ? ` Đây là phần ${index + 1}/${total} của tài liệu.` : ""}

${lines}

Đề xuất các ý cần hỏi theo quy tắc ở trên. Trả JSON.`;
}

const MERGE_SYSTEM = (language: PlanLanguage, durationMin: number) => `Bạn là giám khảo vấn đáp đại học. Dưới đây là danh sách "ý cần hỏi" đã được đề xuất riêng cho từng phần của một tài liệu dài. Hãy CHỌN và XẾP THỨ TỰ ƯU TIÊN để buổi vấn đáp dài ${durationMin} phút (viết ${LANGUAGE_NAME[language]}).

Quy tắc:
- Chọn từ ${PLAN_MIN_ITEMS} đến ${PLAN_MAX_ITEMS} ý. Bỏ các ý trùng hoặc gần trùng nhau.
- Thứ tự là thứ tự ưu tiên: ý quan trọng nhất đứng đầu, vì hết giờ thì các ý cuối sẽ không được hỏi. Vẫn bảo đảm các phần khác nhau của tài liệu đều có đại diện.
- CHỈ dùng số thứ tự trong danh sách. KHÔNG viết ý mới, KHÔNG sửa nội dung ý.
Trả JSON: { keep: [số thứ tự, theo thứ tự ưu tiên] }.`;

// ── Chuẩn hoá (thuần, test được) ───────────────────────────────────────────

const LEVELS: PlanLevel[] = ["basic", "intermediate", "advanced"];

function clampInt(n: unknown, lo: number, hi: number, dflt: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return dflt;
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

function excerptFor(paraNumbers: number[], paras: Para[]): string {
  const seen = new Set<number>();
  const pieces: string[] = [];
  for (const n of paraNumbers) {
    const idx = Number(n) - 1; // lời nhắc đánh số từ 1
    if (!Number.isInteger(idx) || idx < 0 || idx >= paras.length || seen.has(idx)) continue;
    seen.add(idx);
    pieces.push(paras[idx]!.text);
    if (pieces.length >= 3) break;
  }
  const joined = pieces.join("\n\n");
  return joined.length > EXCERPT_MAX_CHARS ? `${joined.slice(0, EXCERPT_MAX_CHARS - 1).trimEnd()}…` : joined;
}

/** Biến đầu ra thô của mô hình thành ứng viên đã kiểm: bỏ ý rỗng/trùng, ép giá trị về miền hợp lệ, ghép đoạn nguồn từ tài liệu. */
export function normalizeCandidates(raw: unknown, paras: Para[], part: number): Candidate[] {
  const list = (raw as { items?: unknown })?.items;
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const out: Candidate[] = [];
  for (const r of list as Partial<RawCandidate>[]) {
    const core = typeof r.core === "string" ? r.core.trim().replace(/\s+/g, " ") : "";
    if (!core) continue;
    const key = core.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      core: core.slice(0, 600),
      level: LEVELS.includes(r.level as PlanLevel) ? (r.level as PlanLevel) : "intermediate",
      expectedAnswer: typeof r.expectedAnswer === "string" ? r.expectedAnswer.trim().slice(0, 2000) : "",
      maxFollowUps: clampInt(r.maxFollowUps, 0, 3, 2),
      sourceExcerpt: excerptFor(Array.isArray(r.paras) ? (r.paras as number[]) : [], paras),
      part,
    });
  }
  return out;
}

/** Gộp dự phòng khi lượt gộp trả về không dùng được: lấy luân phiên giữa các phần để phủ đều tài liệu. */
export function roundRobinPick(cands: Candidate[], max = PLAN_MAX_ITEMS): Candidate[] {
  const byPart = new Map<number, Candidate[]>();
  for (const c of cands) byPart.set(c.part, [...(byPart.get(c.part) ?? []), c]);
  const queues = [...byPart.entries()].sort((a, b) => a[0] - b[0]).map(([, q]) => q);
  const out: Candidate[] = [];
  for (let round = 0; out.length < max; round++) {
    let added = false;
    for (const q of queues) {
      const c = q[round];
      if (c && out.length < max) {
        out.push(c);
        added = true;
      }
    }
    if (!added) break;
  }
  return out;
}

function toDraft(c: Candidate): PlanItemDraft {
  const { part: _part, ...rest } = c;
  void _part;
  return rest;
}

// ── Sinh dàn ───────────────────────────────────────────────────────────────

export async function generateVanDapPlan(
  userId: string,
  input: GenerateVanDapPlanInput,
  openai: OpenAI,
  model = DEFAULT_MODEL,
  db: PrismaClient = prisma,
): Promise<GeneratedVanDapPlan> {
  const paras = splitIntoParas(input.materials);
  const chars = paras.reduce((n, p) => n + p.text.length, 0);
  if (chars < PLAN_MIN_CHARS) throw new AiGenerationError("validation_failed", "source_too_short");
  const parts = chunkParas(paras);
  if (parts.length > PLAN_MAX_PARTS) throw new AiGenerationError("validation_failed", "source_too_long");

  await assertWithinCaps(userId, db, "generator");

  const want =
    parts.length === 1
      ? { min: PLAN_MIN_ITEMS, max: PLAN_MAX_ITEMS }
      : { min: 3, max: Math.min(8, Math.ceil((PLAN_MAX_ITEMS * 1.6) / parts.length) + 1) };

  const candidates: Candidate[] = [];
  for (let i = 0; i < parts.length; i++) {
    const { data, inputTokens, outputTokens } = await callJsonModel<unknown>(
      openai,
      model,
      candidateSystem(input.language, want, parts.length > 1),
      candidatePrompt(parts[i]!, i, parts.length, input.durationMin),
      "van_dap_plan_part",
      CANDIDATE_SCHEMA,
      4000,
    );
    await recordAiUsage(userId, model, inputTokens, outputTokens, db);
    candidates.push(...normalizeCandidates(data, paras, i));
  }
  if (candidates.length === 0) throw new AiGenerationError("openai_error", "empty_plan");

  if (parts.length === 1) {
    return { items: candidates.slice(0, PLAN_MAX_ITEMS).map(toDraft), parts: 1 };
  }

  // Nhiều phần: một lượt GỘP chọn–xếp thứ tự các ứng viên, không viết ý mới.
  const listing = candidates.map((c, i) => `[${i + 1}] (phần ${c.part + 1}, ${c.level}) ${c.core}`).join("\n");
  const { data, inputTokens, outputTokens } = await callJsonModel<{ keep?: unknown }>(
    openai,
    model,
    MERGE_SYSTEM(input.language, input.durationMin),
    `Danh sách ý đề xuất:\n${listing}\n\nChọn và xếp thứ tự. Trả JSON.`,
    "van_dap_plan_merge",
    MERGE_SCHEMA,
    1500,
  );
  await recordAiUsage(userId, model, inputTokens, outputTokens, db);

  const picked: Candidate[] = [];
  const used = new Set<number>();
  for (const n of Array.isArray(data?.keep) ? (data.keep as unknown[]) : []) {
    const idx = Number(n) - 1;
    if (!Number.isInteger(idx) || idx < 0 || idx >= candidates.length || used.has(idx)) continue;
    used.add(idx);
    picked.push(candidates[idx]!);
    if (picked.length >= PLAN_MAX_ITEMS) break;
  }
  const finalPick = picked.length >= PLAN_MIN_ITEMS || picked.length >= candidates.length ? picked : roundRobinPick(candidates);
  return { items: finalPick.map(toDraft), parts: parts.length };
}
