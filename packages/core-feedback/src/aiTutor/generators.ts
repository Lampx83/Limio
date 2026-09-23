import OpenAI from "openai";
import { z } from "zod";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import type { LessonFormatTemplateKey } from "@feedbackme/shared-types";
import { assertWithinCaps, recordAiUsage } from "./aiTutor";

/**
 * AI authoring generators — used by instructor UI to draft skill tags,
 * feedback templates, and quiz questions. All return STRUCTURED suggestions
 * that the instructor reviews + confirms before persisting.
 *
 * Each generator logs its usage to AiUsageLog so cost tracking is unified
 * with AI Tutor (per-day-per-model bucket per user).
 *
 * Mọi generator đều gọi assertWithinCaps(..., "generator") trước khi chạm
 * OpenAI. Trước đây chỉ hội thoại bị chặn cap, còn nhánh này thì không —
 * mà nó mới là nhánh đắt: mỗi lần tới 2.000 token đầu ra, có endpoint chạy
 * theo lô cả khoá. Thêm generator mới thì phải thêm cả lời gọi này, nếu
 * không nó lại là một cửa mở thầm lặng.
 */

export class AiGenerationError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "openai_error"
      | "json_parse_failed",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

async function logUsage(
  userId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  db: PrismaClient,
) {
  return recordAiUsage(userId, model, inputTokens, outputTokens, db);
}

/** Wraps OpenAI's structured-output API. Returns parsed JSON + usage. */
async function callJsonModel<T>(
  openai: OpenAI,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  schemaName: string,
  schemaDef: Record<string, unknown>,
  maxTokens = 2000,
): Promise<{ data: T; inputTokens: number; outputTokens: number }> {
  try {
    const res = await openai.chat.completions.create({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: schemaName,
          strict: true,
          schema: schemaDef,
        },
      },
      temperature: 0.3,
      max_tokens: maxTokens,
    });
    const content = res.choices[0]?.message?.content ?? "";
    let data: T;
    try {
      data = JSON.parse(content);
    } catch {
      throw new AiGenerationError("json_parse_failed", content.slice(0, 200));
    }
    return {
      data,
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
    };
  } catch (e) {
    if (e instanceof AiGenerationError) throw e;
    throw new AiGenerationError("openai_error", (e as Error).message);
  }
}

// =====================================================================
// (a) Skill suggester — match content against existing Skill catalog.
// =====================================================================

export interface SkillSuggestion {
  skillId: string;
  skillCode: string;
  skillName: string;
  /** 0..1 confidence — model-reported. */
  confidence: number;
  /** Why this skill matches — shown to instructor for review. */
  rationale: string;
}

const SKILL_SUGGEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          skillCode: { type: "string" },
          confidence: { type: "number" },
          rationale: { type: "string" },
        },
        required: ["skillCode", "confidence", "rationale"],
      },
    },
  },
  required: ["suggestions"],
};

export async function suggestSkillsForContent(
  userId: string,
  contentText: string,
  openai: OpenAI,
  model = "gpt-4o-mini",
  db: PrismaClient = prisma,
): Promise<SkillSuggestion[]> {
  if (!contentText.trim()) {
    throw new AiGenerationError("validation_failed", "empty_content");
  }
  await assertWithinCaps(userId, db, "generator");
  const skills = await db.skill.findMany({
    select: { id: true, code: true, name: true, description: true },
    orderBy: { code: "asc" },
  });
  if (skills.length === 0) return [];

  const catalog = skills
    .map(
      (s) =>
        `- code=${s.code} | name=${s.name}${s.description ? ` | desc=${s.description}` : ""}`,
    )
    .join("\n");

  const system = `You are an expert curriculum designer. Match LMS content to skills from a fixed catalog.
Return ONLY JSON. Pick at most 5 most-relevant skills. Confidence is your subjective relevance score [0..1].
NEVER invent a skill code that isn't in the catalog — if no match, return empty list.`;

  const user = `# Skill catalog
${catalog}

# Content to tag
"""
${contentText.slice(0, 6000)}
"""

Return JSON: { suggestions: [{ skillCode, confidence, rationale }] }`;

  const { data, inputTokens, outputTokens } = await callJsonModel<{
    suggestions: Array<{ skillCode: string; confidence: number; rationale: string }>;
  }>(openai, model, system, user, "skill_suggestions", SKILL_SUGGEST_SCHEMA);

  await logUsage(userId, model, inputTokens, outputTokens, db);

  // Resolve skillCode → id; drop suggestions for unknown codes.
  const byCode = new Map(skills.map((s) => [s.code, s]));
  return data.suggestions
    .map((s) => {
      const sk = byCode.get(s.skillCode);
      if (!sk) return null;
      return {
        skillId: sk.id,
        skillCode: sk.code,
        skillName: sk.name,
        confidence: Math.max(0, Math.min(1, s.confidence)),
        rationale: s.rationale,
      };
    })
    .filter((x): x is SkillSuggestion => x !== null)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
}

// =====================================================================
// (a2) Generative learning activity suggester — propose 2–3 generative
// activities (Fiorella & Mayer 2016 taxonomy) for a lesson's content.
// Output is a draft the instructor reviews + edits before saving.
// =====================================================================

export type GenerativeActivityTypeName =
  | "summarizing"
  | "self_explaining"
  | "imagining"
  | "mapping"
  | "drawing"
  | "teaching"
  | "enacting";

export interface ActivitySuggestion {
  type: GenerativeActivityTypeName;
  title: string;
  /** Concrete prompt the instructor can paste into the assignment. */
  prompt: string;
  /** Why this activity fits this content — for instructor sanity check. */
  rationale: string;
  /** 0..1 model-reported. */
  confidence: number;
}

const ACTIVITY_TYPES: GenerativeActivityTypeName[] = [
  "summarizing",
  "self_explaining",
  "imagining",
  "mapping",
  "drawing",
  "teaching",
  "enacting",
];

const ACTIVITY_SUGGEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ACTIVITY_TYPES },
          title: { type: "string" },
          prompt: { type: "string" },
          rationale: { type: "string" },
          confidence: { type: "number" },
        },
        required: ["type", "title", "prompt", "rationale", "confidence"],
      },
    },
  },
  required: ["suggestions"],
};

export async function suggestActivitiesForContent(
  userId: string,
  contentText: string,
  openai: OpenAI,
  model = "gpt-4o-mini",
  db: PrismaClient = prisma,
): Promise<ActivitySuggestion[]> {
  if (!contentText.trim()) {
    throw new AiGenerationError("validation_failed", "empty_content");
  }
  await assertWithinCaps(userId, db, "generator");
  const system = `Bạn là chuyên gia thiết kế hoạt động học sâu (generative learning, Fiorella & Mayer 2016).
Nhiệm vụ: Đọc nội dung bài học và đề xuất 2–3 hoạt động học sâu phù hợp giúp học viên CHỦ ĐỘNG xây dựng kiến thức (thay vì học thuộc).
Mỗi hoạt động phải gắn với 1 trong 7 type:
- summarizing: học viên viết/nói lại nội dung bằng lời mình
- self_explaining: học viên giải thích vì sao điều đó đúng/xảy ra
- imagining: học viên tưởng tượng/hình dung tình huống mô tả
- mapping: tạo concept map / sơ đồ
- drawing: vẽ minh hoạ
- teaching: dạy lại nội dung cho người khác
- enacting: thực hiện hành động/cử chỉ minh hoạ
Prompt cần CỤ THỂ với nội dung bài, không nói chung chung. Tiếng Việt.
NEVER invent một type ngoài danh sách trên.`;

  const user = `# Nội dung bài học
"""
${contentText.slice(0, 6000)}
"""

Trả về JSON: { suggestions: [{ type, title, prompt, rationale, confidence }] } — 2 hoặc 3 phần tử.`;

  const { data, inputTokens, outputTokens } = await callJsonModel<{
    suggestions: ActivitySuggestion[];
  }>(
    openai,
    model,
    system,
    user,
    "activity_suggestions",
    ACTIVITY_SUGGEST_SCHEMA,
  );

  await logUsage(userId, model, inputTokens, outputTokens, db);

  const allowed = new Set(ACTIVITY_TYPES);
  return data.suggestions
    .filter((s) => allowed.has(s.type))
    .map((s) => ({
      ...s,
      confidence: Math.max(0, Math.min(1, s.confidence)),
    }))
    .slice(0, 3);
}

// =====================================================================
// (b) Feedback template body generator.
// =====================================================================

export interface FeedbackBodyDraft {
  body: string;
  /** Why this body matches the misconception — for instructor sanity check. */
  rationale: string;
}

const FEEDBACK_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    body: { type: "string" },
    rationale: { type: "string" },
  },
  required: ["body", "rationale"],
};

export async function generateFeedbackBody(
  userId: string,
  input: {
    misconceptionName: string;
    misconceptionDescription: string;
    /** Optional course/lesson context to ground the feedback. */
    context?: string;
    /** Optional skill names linked to this misconception. */
    skillNames?: string[];
  },
  openai: OpenAI,
  model = "gpt-4o-mini",
  db: PrismaClient = prisma,
): Promise<FeedbackBodyDraft> {
  if (!input.misconceptionName.trim() || !input.misconceptionDescription.trim()) {
    throw new AiGenerationError("validation_failed");
  }
  await assertWithinCaps(userId, db, "generator");

  const system = `Bạn là chuyên gia giáo dục viết phản hồi (feedback) cho học viên.
Nhiệm vụ: Khi học viên trả lời sai vì rơi vào misconception, viết một đoạn ngắn (60-150 từ) bằng TIẾNG VIỆT để:
1. Chỉ ra rõ misconception đó là gì.
2. Giải thích tại sao nó SAI.
3. Hướng dẫn cách tư duy đúng (ngắn gọn, không spoil đáp án bài tập cụ thể).
Phong cách: thân thiện, không phán xét. Markdown được phép.`;

  const user = `# Misconception
- Tên: ${input.misconceptionName}
- Mô tả: ${input.misconceptionDescription}
${input.skillNames?.length ? `- Liên quan skill: ${input.skillNames.join(", ")}` : ""}
${input.context ? `\n# Context bài học\n${input.context.slice(0, 3000)}` : ""}

Trả về JSON: { body, rationale }`;

  const { data, inputTokens, outputTokens } = await callJsonModel<FeedbackBodyDraft>(
    openai,
    model,
    system,
    user,
    "feedback_body_draft",
    FEEDBACK_SCHEMA,
  );

  await logUsage(userId, model, inputTokens, outputTokens, db);
  return data;
}

// =====================================================================
// (c) Quiz question generator.
// =====================================================================

export interface QuestionDraft {
  type: "mcq" | "true_false" | "fill_in";
  prompt: string;
  options: Array<{
    label: string;
    isCorrect: boolean;
    /** When non-null, the option represents a known misconception. */
    misconceptionHint: string | null;
  }>;
  explanation: string;
  /** Suggested skill codes from the catalog this question tests. */
  skillCodes: string[];
}

const QUESTIONS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: { type: "string", enum: ["mcq", "true_false", "fill_in"] },
          prompt: { type: "string" },
          options: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                label: { type: "string" },
                isCorrect: { type: "boolean" },
                misconceptionHint: { type: ["string", "null"] },
              },
              required: ["label", "isCorrect", "misconceptionHint"],
            },
          },
          explanation: { type: "string" },
          skillCodes: { type: "array", items: { type: "string" } },
        },
        required: ["type", "prompt", "options", "explanation", "skillCodes"],
      },
    },
  },
  required: ["questions"],
};

export const QuestionDraftInput = z.object({
  lessonContent: z.string().min(20).max(8000),
  count: z.number().int().min(1).max(10).default(3),
  /** Difficulty hint — drives prompt tone. */
  difficulty: z.enum(["easy", "medium", "hard"]).default("medium"),
});

export async function generateQuestions(
  userId: string,
  input: z.infer<typeof QuestionDraftInput>,
  openai: OpenAI,
  model = "gpt-4o-mini",
  db: PrismaClient = prisma,
): Promise<QuestionDraft[]> {
  await assertWithinCaps(userId, db, "generator");

  const skills = await db.skill.findMany({ select: { code: true, name: true } });
  const catalog = skills.map((s) => `- ${s.code}: ${s.name}`).join("\n");

  const system = `Bạn là chuyên gia ra đề kiểm tra cho LMS.
Nhiệm vụ: Đọc nội dung bài học, sinh ra ${input.count} câu hỏi chất lượng cao bằng TIẾNG VIỆT (trừ khi nội dung bài học toàn tiếng Anh).

Quy tắc:
1. Mỗi câu CÓ ÍT NHẤT một option đúng.
2. type="mcq" có 3-4 options, đúng đa số 1 (multi nếu cần).
3. type="true_false" có ĐÚNG 2 options ("Đúng"/"Sai" hoặc "True"/"False"), 1 đúng.
4. type="fill_in" mỗi option label = đáp án chấp nhận được.
5. Với MCQ, các option SAI nên reflect MISCONCEPTION cụ thể — set "misconceptionHint" mô tả ngắn lỗi tư duy đó. Option đúng có misconceptionHint=null.
6. explanation: vài câu giải thích tại sao đáp án đúng.
7. skillCodes: chọn từ catalog dưới đây (skip nếu không match).

# Skill catalog
${catalog || "(empty — bỏ trống skillCodes)"}

Difficulty: ${input.difficulty}`;

  const user = `# Lesson content
"""
${input.lessonContent}
"""

Trả về JSON: { questions: [...] }`;

  const { data, inputTokens, outputTokens } = await callJsonModel<{
    questions: QuestionDraft[];
  }>(openai, model, system, user, "question_drafts", QUESTIONS_SCHEMA);

  await logUsage(userId, model, inputTokens, outputTokens, db);

  // Sanity: only return questions that satisfy at least 1 isCorrect option.
  return data.questions
    .filter(
      (q) => Array.isArray(q.options) && q.options.some((o) => o.isCorrect),
    )
    .slice(0, input.count);
}

// =====================================================================
// (e) Misconception suggester — B9.3.
//
// For one MCQ / true-false question, propose what each wrong option reveals
// about the learner's thinking, reusing the existing catalogue where possible.
// Output is a PROPOSAL: the instructor reviews it before anything is written.
// =====================================================================

export interface MisconceptionProposal {
  optionId: string;
  optionLabel: string;
  /** null = this distractor is merely wrong and diagnoses nothing. */
  misconceptionCode: string | null;
  isNew: boolean;
  misconceptionName: string | null;
  misconceptionDescription: string | null;
  /** Feedback text the learner will read when they pick this option. */
  feedbackBody: string | null;
  confidence: number;
  rationale: string;
}

const MISCONCEPTION_SUGGEST_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    proposals: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          optionId: { type: "string" },
          misconceptionCode: { type: ["string", "null"] },
          isNew: { type: "boolean" },
          misconceptionName: { type: ["string", "null"] },
          misconceptionDescription: { type: ["string", "null"] },
          feedbackBody: { type: ["string", "null"] },
          confidence: { type: "number" },
          rationale: { type: "string" },
        },
        required: [
          "optionId",
          "misconceptionCode",
          "isNew",
          "misconceptionName",
          "misconceptionDescription",
          "feedbackBody",
          "confidence",
          "rationale",
        ],
      },
    },
  },
  required: ["proposals"],
};

/** Codes must satisfy CreateMisconceptionInput in core-lms. */
const MISCONCEPTION_CODE_RE = /^[a-z][a-z0-9_]*$/;

export interface MisconceptionCatalogueEntry {
  code: string;
  name: string;
  description: string;
}

export interface MisconceptionSuggestOptions {
  /**
   * Danh mục misconception dùng để đối chiếu. Truyền vào khi chạy offline với
   * dữ liệu trích từ môi trường khác — DB local không có danh mục của prod.
   */
  catalogue?: MisconceptionCatalogueEntry[];
  /** Bỏ ghi AiUsageLog (chế độ offline: DB đang nối không phải nơi phát sinh). */
  skipUsageLog?: boolean;
}

export interface MisconceptionQuestionInput {
  questionId: string;
  prompt: string;
  options: Array<{ id: string; label: string; isCorrect: boolean }>;
  /** Lesson title, so the model can pitch the explanation at the right level. */
  lessonTitle?: string;
  /** Language of the feedback shown to learners. */
  language?: string;
}

export async function suggestMisconceptionsForQuestion(
  userId: string,
  question: MisconceptionQuestionInput,
  openai: OpenAI,
  model = "gpt-4o-mini",
  db: PrismaClient = prisma,
  opts: MisconceptionSuggestOptions = {},
): Promise<MisconceptionProposal[]> {
  const wrong = question.options.filter((o) => !o.isCorrect);
  if (wrong.length === 0) return [];

  await assertWithinCaps(userId, db, "generator");

  const catalogue =
    opts.catalogue ??
    (await db.misconception.findMany({
      select: { code: true, name: true, description: true },
      orderBy: { code: "asc" },
    }));
  const known = new Set(catalogue.map((m) => m.code));

  const catalogueText =
    catalogue.length > 0
      ? catalogue
          .map((m) => `- ${m.code} | ${m.name} | ${m.description.slice(0, 160)}`)
          .join("\n")
      : "(trống)";

  const correct = question.options
    .filter((o) => o.isCorrect)
    .map((o) => o.label)
    .join(" / ");

  const system = `Bạn là chuyên gia thiết kế đánh giá. Với mỗi phương án SAI của một câu hỏi, hãy xác định phương án đó phản ánh hiểu nhầm gì của người học.

Quy tắc bắt buộc:
- Ưu tiên TÁI DÙNG mã trong danh mục. Chỉ đặt mã mới khi hiểu nhầm thật sự khác, và khi đó isNew=true.
- Mã mới phải khớp ^[a-z][a-z0-9_]*$ (chữ thường và gạch dưới, không dấu chấm, không gạch ngang).
- Nếu một phương án chỉ đơn giản là SAI mà không lộ ra hiểu nhầm nào đáng đặt tên, hãy trả misconceptionCode=null. KHÔNG ép gán — gán bừa tạo ra độ chính xác giả và làm hỏng dữ liệu phân tích.
- feedbackBody viết bằng ${question.language ?? "tiếng Việt"}, xưng hô với người học, 1-3 câu, nói rõ họ nhầm ở đâu và vì sao, KHÔNG chỉ nhắc lại đáp án đúng.
- confidence là mức tự tin của bạn [0..1].

Chỉ trả JSON.`;

  const user = `# Danh mục hiểu nhầm đã có
${catalogueText}

# Câu hỏi${question.lessonTitle ? ` (thuộc bài: ${question.lessonTitle})` : ""}
${question.prompt.slice(0, 2000)}

# Đáp án đúng
${correct}

# Các phương án SAI cần phân tích
${wrong.map((o) => `- optionId=${o.id} | ${o.label.slice(0, 400)}`).join("\n")}

Trả JSON: { proposals: [{ optionId, misconceptionCode, isNew, misconceptionName, misconceptionDescription, feedbackBody, confidence, rationale }] }`;

  const { data, inputTokens, outputTokens } = await callJsonModel<{
    proposals: Array<Omit<MisconceptionProposal, "optionLabel">>;
  }>(
    openai,
    model,
    system,
    user,
    "misconception_proposals",
    MISCONCEPTION_SUGGEST_SCHEMA,
  );

  if (!opts.skipUsageLog) {
    await logUsage(userId, model, inputTokens, outputTokens, db);
  }

  const labelById = new Map(wrong.map((o) => [o.id, o.label]));

  return data.proposals
    .filter((p) => labelById.has(p.optionId))
    .map((p) => {
      let code = p.misconceptionCode?.trim() || null;
      // AC-2.4 — a proposed new code that breaks the format is dropped rather
      // than silently reshaped; the reviewer sees the gap and decides.
      const isNew = code !== null && !known.has(code);
      if (code !== null && isNew && !MISCONCEPTION_CODE_RE.test(code)) {
        code = null;
      }
      return {
        optionId: p.optionId,
        optionLabel: labelById.get(p.optionId)!,
        misconceptionCode: code,
        isNew: code !== null && !known.has(code),
        misconceptionName: p.misconceptionName?.trim() || null,
        misconceptionDescription: p.misconceptionDescription?.trim() || null,
        feedbackBody: p.feedbackBody?.trim() || null,
        confidence: Math.max(0, Math.min(1, p.confidence ?? 0)),
        rationale: p.rationale ?? "",
      };
    });
}

// =====================================================================
// (f) Lesson content formatter — instructor pastes raw text into the
// richtext editor, picks a visual template, and this turns it into clean
// styled HTML. Output REPLACES nothing by itself: the caller shows it as
// a preview and only applies it to the editor on explicit confirmation.
// =====================================================================

const FORMAT_MAX_INPUT_CHARS = 100_000;

interface StyleGuide {
  label: string;
  /** Vietnamese instructions for the model — inline styles per tag, no <style>. */
  rules: string;
}

// Colors/fonts/sizes baked as inline `style="..."` on each generated tag
// (not CSS classes): payload.html renders standalone via SafeHtml wherever
// a lesson is viewed, with no guarantee a matching stylesheet is loaded —
// self-contained HTML is the only way the template survives everywhere.
//
// Thang chữ (1.25rem thân bài / 1.7rem h2 / 1.42rem h3 / 1rem caption) và
// font Inter khớp ĐÚNG với packages/core-lms/scripts/import-course.ts (renderer
// dựng các bài "Thiết kế UI/UX" đang có trên prod) — để bài AI-format và bài
// dựng tay trông cùng một cỡ chữ trong cùng một khoá, không lệch tông.
const FONT_STACK = 'Inter, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const STYLE_GUIDES: Record<LessonFormatTemplateKey, StyleGuide> = {
  clean: {
    label: "Sạch sẽ",
    rules: `- font-family: ${FONT_STACK} cho MỌI thẻ
- <h2>: style="color:#1e40af;font-size:1.7rem;font-weight:700;margin:1.5rem 0 .6rem"
- <h3> (mục tiêu/tổng kết): style="color:#1e40af;font-size:1.42rem;margin:0 0 .6rem"
- <p>/<li>: style="color:#374151;font-size:1.25rem;line-height:1.7"
- <div class="callout">: style="background:#eff6ff;border-left:4px solid #1e40af;padding:12px;border-radius:4px;margin:12px 0;font-size:1.25rem"
- <table>: style="border-collapse:collapse;width:100%;margin:12px 0"
- <th>: style="border:1px solid #bfdbfe;background:#eff6ff;color:#1e40af;font-size:1.25rem;font-weight:700;padding:8px 12px;text-align:left"
- <td>: style="border:1px solid #e5e7eb;color:#374151;font-size:1.25rem;line-height:1.7;padding:8px 12px"
- <blockquote>: style="border-left:4px solid #93c5fd;background:#f8fafc;color:#374151;font-style:italic;font-size:1.25rem;line-height:1.7;padding:10px 16px;margin:12px 0"
- <img>: style="max-width:calc(100% - 3cm);max-height:480px;height:auto;border-radius:8px;margin:12px auto;display:block"`,
  },
  academic: {
    label: "Học thuật",
    rules: `- <h2>/<h3>: font-family:Georgia,"Times New Roman",serif; <p>/<li>: font-family:${FONT_STACK}
- <h2>: style="color:#581c87;font-size:1.7rem;font-weight:700;margin:1.5rem 0 .6rem;font-family:Georgia,serif"
- <h3>: style="color:#581c87;font-size:1.42rem;margin:0 0 .6rem;font-family:Georgia,serif"
- <p>/<li>: style="color:#1f2937;font-size:1.25rem;line-height:1.7"
- <div class="callout">: style="background:#f3f4f6;border-left:3px solid #581c87;padding:12px;border-radius:4px;margin:16px 0;font-size:1.25rem"
- <table>: style="border-collapse:collapse;width:100%;margin:16px 0;font-family:${FONT_STACK}"
- <th>: style="border:1px solid #d8b4fe;background:#f3f4f6;color:#581c87;font-size:1.25rem;font-weight:700;padding:8px 12px;text-align:left"
- <td>: style="border:1px solid #e5e7eb;color:#1f2937;font-size:1.25rem;line-height:1.7;padding:8px 12px"
- <blockquote>: style="border-left:3px solid #c4b5fd;background:#faf5ff;color:#1f2937;font-style:italic;font-size:1.25rem;line-height:1.7;padding:10px 16px;margin:16px 0;font-family:Georgia,serif"
- <img>: style="max-width:calc(100% - 3cm);max-height:480px;height:auto;border-radius:8px;margin:12px auto;display:block"`,
  },
  modern: {
    label: "Hiện đại",
    rules: `- font-family: ${FONT_STACK} cho MỌI thẻ
- <h2>: style="background:linear-gradient(135deg,#0d9488,#0369a1);color:#ffffff;font-size:1.7rem;font-weight:700;border-radius:4px;padding:8px 12px;display:inline-block;margin:1.5rem 0 .6rem"
- <h3>: style="color:#0d9488;font-size:1.42rem;margin:0 0 .6rem"
- <p>/<li>: style="color:#111827;font-size:1.25rem;line-height:1.7"
- <div class="callout">: style="background:#dcfce7;border-left:4px solid #16a34a;padding:12px;border-radius:4px;margin:12px 0;font-size:1.25rem" (đổi sang #fed7aa/#f97316 nếu là cảnh báo, #dbeafe/#0284c7 nếu là ví dụ)
- <table>: style="border-collapse:collapse;width:100%;margin:12px 0"
- <th>: style="border:1px solid #5eead4;background:#0d9488;color:#ffffff;font-size:1.25rem;font-weight:700;padding:8px 12px;text-align:left"
- <td>: style="border:1px solid #e5e7eb;color:#111827;font-size:1.25rem;line-height:1.7;padding:8px 12px"
- <blockquote>: style="border-left:4px solid #5eead4;background:#f0fdfa;color:#111827;font-style:italic;font-size:1.25rem;line-height:1.7;padding:10px 16px;margin:12px 0"
- <img>: style="max-width:calc(100% - 3cm);max-height:480px;height:auto;border-radius:8px;margin:12px auto;display:block"`,
  },
  // Khớp ĐÚNG palette SECTION_HUES/SECTION_TEXT_HUES của
  // packages/core-lms/scripts/import-course.ts (renderer khoá "Thiết kế
  // UI/UX") — 5 màu đã đo tương phản ≥4:1 trên cả nền trắng lẫn nền tối, xoay
  // vòng theo THỨ TỰ mục ## xuất hiện (mục 1→5). Vì cấu trúc chỉ cho tối đa 5
  // mục ## nên không cần xử lý wrap-around.
  vibrant: {
    label: "Sinh động",
    rules: `- font-family: ${FONT_STACK} cho MỌI thẻ
- MỖI mục <h2> lấy MỘT MÀU THEO THỨ TỰ xuất hiện (mục thứ 1 → màu 1, mục thứ 2 → màu 2, ...) — KHÔNG dùng cùng 1 màu cho mọi mục:
  1. lam: nền rgba(59,130,246,.14) · viền/chữ rgb(40,118,245)
  2. tím: nền rgba(139,92,246,.14) · viền/chữ rgb(138,91,246)
  3. ngọc: nền rgba(13,148,136,.14) · viền/chữ rgb(12,141,129)
  4. hổ phách: nền rgba(217,150,40,.14) · viền/chữ rgb(165,113,29)
  5. hồng sen: nền rgba(219,90,140,.14) · viền/chữ rgb(214,67,124)
- <h2> (của mục thứ N): style="color:rgb(<màu chữ N>);font-size:1.7rem;font-weight:700;margin:1.5rem 0 .6rem;border-left:4px solid rgb(<màu chữ N>);padding-left:.7rem"
- <h3> bên trong mục nào thì dùng ĐÚNG màu chữ của mục cha đó: style="color:rgb(<màu chữ của mục cha>);font-size:1.42rem;margin:0 0 .6rem"
- <p>/<li>: style="color:#111827;font-size:1.25rem;line-height:1.7" (không đổi màu theo mục — chỉ heading đổi màu)
- <div class="callout"> bên trong mục nào thì dùng màu nền+chữ của mục đó: style="background:rgba(<màu nền của mục>);border-left:4px solid rgb(<màu chữ của mục>);padding:12px;border-radius:4px;margin:12px 0;font-size:1.25rem"
- <table>: style="border-collapse:collapse;width:100%;margin:12px 0" (không đổi màu theo mục — như <p>/<li>)
- <th>: style="border:1px solid #e5e7eb;background:#f9fafb;color:#111827;font-size:1.25rem;font-weight:700;padding:8px 12px;text-align:left"
- <td>: style="border:1px solid #e5e7eb;color:#111827;font-size:1.25rem;line-height:1.7;padding:8px 12px"
- <blockquote>: style="border-left:4px solid #9ca3af;background:#f9fafb;color:#111827;font-style:italic;font-size:1.25rem;line-height:1.7;padding:10px 16px;margin:12px 0" (không đổi màu theo mục — như <table>)
- <img>: style="max-width:calc(100% - 3cm);max-height:480px;height:auto;border-radius:8px;margin:12px auto;display:block"`,
  },
};

const FORMAT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    html: { type: "string" },
  },
  required: ["html"],
};

export interface FormatLessonContentInput {
  /** HTML hiện có trong ô richtext — thường là văn bản thô dán vào, lộn xộn. */
  html: string;
  template: LessonFormatTemplateKey;
}

export async function formatLessonContent(
  userId: string,
  input: FormatLessonContentInput,
  openai: OpenAI,
  model = "gpt-4o-mini",
  db: PrismaClient = prisma,
): Promise<{ html: string }> {
  const raw = input.html.trim();
  if (!raw) {
    throw new AiGenerationError("validation_failed", "empty_content");
  }
  if (raw.length > FORMAT_MAX_INPUT_CHARS) {
    throw new AiGenerationError("validation_failed", "too_long");
  }
  const guide = STYLE_GUIDES[input.template];
  if (!guide) {
    throw new AiGenerationError("validation_failed", "unknown_template");
  }
  await assertWithinCaps(userId, db, "generator");

  const system = `Bạn là chuyên gia thiết kế học liệu. Định dạng lại nội dung bài học (dán thô, có thể lộn xộn) thành HTML sạch, có cấu trúc, và ÁP DỤNG đúng phong cách bên dưới.

Cấu trúc — chỉ thêm phần nào có đủ cơ sở từ nội dung gốc, KHÔNG bịa:
1. Nếu suy ra được mục tiêu học tập: <div class="lesson-objectives"><h3>Mục tiêu học tập</h3><ul><li>...</li></ul></div> — mỗi mục dùng ĐỘNG TỪ HÀNH ĐỘNG cụ thể theo thang Bloom (vd "phân biệt được", "áp dụng được", "phân tích được" — KHÔNG dùng "hiểu", "biết" chung chung)
2. Chia nội dung thành các mục <h2>...</h2> — TỐI ĐA 5 mục, giữ nguyên câu chữ trong <p>/<ul>/<table>
3. Đoạn ghi chú/lưu ý quan trọng (nếu có trong bài gốc): bọc trong <div class="callout">...</div>
4. Nếu suy ra được tổng kết: <div class="lesson-summary"><h3>Tổng kết</h3><ul><li>...</li></ul></div>

Phong cách "${guide.label}" — áp bằng inline style="..." trực tiếp trên từng thẻ, KHÔNG dùng thẻ <style>:
${guide.rules}

Quy tắc bắt buộc:
- KHÔNG thêm, xoá, hay diễn giải lại Ý NGHĨA nội dung gốc — chỉ định dạng lại cách trình bày.
- KHÔNG bịa mục tiêu/tổng kết nếu nội dung gốc không đủ cơ sở — bỏ qua phần đó thay vì đoán.
- Có <table>: LUÔN bọc trong <div style="overflow-x:auto">...</div> để bảng dài không vỡ layout trên di động.
- Output CHỈ chứa thẻ: div, h2, h3, p, ul, ol, li, strong, em, table, thead, tbody, tr, td, th, a, img, blockquote. KHÔNG <script>, <style>, <iframe>, <form>, thuộc tính onXxx.
- Giữ nguyên href/src của link/ảnh có trong nội dung gốc.
- Trả JSON: { html: "<toàn bộ HTML, một chuỗi>" }`;

  const user = `# Nội dung gốc (HTML thô từ ô soạn thảo)
"""
${raw}
"""

Định dạng lại theo đúng cấu trúc và phong cách "${guide.label}" ở trên. Trả JSON: { html }`;

  const { data, inputTokens, outputTokens } = await callJsonModel<{ html: string }>(
    openai,
    model,
    system,
    user,
    "lesson_format",
    FORMAT_SCHEMA,
    8000,
  );

  await logUsage(userId, model, inputTokens, outputTokens, db);

  const cleanHtml = data.html?.trim();
  if (!cleanHtml) {
    throw new AiGenerationError("openai_error", "empty_html_output");
  }
  return { html: cleanHtml };
}

// =====================================================================
// (g) "Nhập bằng AI" — GV dán văn bản câu hỏi thô (copy từ Word, PDF, ghi
// tay), AI tách thành mảng câu hỏi có cấu trúc. Đây CHỈ là bước "đọc hiểu" —
// AI không tự quyết câu nào hợp lệ, không tự đoán đáp án đúng khi văn bản
// không rõ. Output được feed qua `aiQuestionsToParseResult` (core-lms) để
// chạy lại đúng validate xác định đã dùng cho import Excel — cùng một cổng,
// không có đường tắt riêng cho AI.
// =====================================================================

const EXTRACT_MIN_INPUT_CHARS = 20;
const EXTRACT_MAX_INPUT_CHARS = 20_000;

/**
 * Shape phải khớp CẤU TRÚC với `AiExtractedQuestion` ở
 * packages/core-lms/src/imports/aiQuestionRows.ts — core-feedback không được
 * import core-lms (ranh giới module, CLAUDE.md §4.3), nên định nghĩa lặp lại
 * ở đây; route.ts (apps/web) là tầng orchestration ghép hai bên qua kiểu cấu
 * trúc (structural typing), không qua import chéo.
 */
export type ExtractedAiQuestion =
  | {
      type: "mcq" | "true_false";
      prompt: string;
      options: Array<{ label: string; isCorrect: boolean }>;
      explanation: string | null;
      topic: string | null;
    }
  | {
      type: "ordering";
      prompt: string;
      items: Array<{ label: string }>;
      explanation: string | null;
      topic: string | null;
    }
  | {
      type: "matching";
      prompt: string;
      pairs: Array<{ left: string; right: string }>;
      explanation: string | null;
      topic: string | null;
    }
  | {
      type: "fill_in";
      prompt: string;
      acceptedAnswers: string[];
      explanation: string | null;
      topic: string | null;
    };

/**
 * Một câu bị AI CHỦ ĐỘNG bỏ qua vì không thuộc 5 loại "Nhập bằng AI" hỗ trợ
 * (mcq/true_false/ordering/matching/fill_in). Bắt AI báo lại thay vì im lặng
 * bỏ sót — GV thấy được "vì sao chỉ ra N/tổng câu" thay vì tưởng AI đọc thiếu.
 *
 * Sự cố thật (2026-09-22): trước khi có field này, AI từng ép câu "Sắp xếp
 * thứ tự" và "Ghép cặp" vào type=mcq (coi mỗi mảnh câu / mỗi vế ghép là một
 * "option") — sai hoàn toàn về ngữ nghĩa. Vì validate xác định phía sau
 * (parseRawMcqRows) chỉ kiểm HÌNH THỨC của mcq (có đáp án đúng, ≥2 lựa chọn),
 * nó không có cách nào biết câu gốc vốn là loại khác — nên lọt qua thành
 * "OK" dù nội dung vô nghĩa. Root cause là AI thiếu lựa chọn "bỏ qua" đủ rõ;
 * field này là chỗ để AI dùng lựa chọn đó.
 */
export interface SkippedAiQuestion {
  /** Vì sao không đưa vào — hiện cho GV xem, ví dụ "Câu ghép cặp — chưa hỗ trợ". */
  reason: string;
}

const EXTRACT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    questions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          type: {
            type: "string",
            enum: ["mcq", "true_false", "ordering", "matching", "fill_in"],
          },
          prompt: { type: "string" },
          // mcq/true_false. Rỗng cho các loại khác.
          options: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                label: { type: "string" },
                isCorrect: { type: "boolean" },
              },
              required: ["label", "isCorrect"],
            },
          },
          // ordering — mảnh/bước theo ĐÚNG THỨ TỰ (thứ tự trong mảng = đáp án
          // đúng). Rỗng cho các loại khác.
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: { label: { type: "string" } },
              required: ["label"],
            },
          },
          // matching — mỗi cặp đã ghép ĐÚNG theo đáp án. Rỗng cho các loại khác.
          pairs: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                left: { type: "string" },
                right: { type: "string" },
              },
              required: ["left", "right"],
            },
          },
          // fill_in — mọi biến thể đáp án được chấp nhận. Rỗng cho các loại khác.
          acceptedAnswers: { type: "array", items: { type: "string" } },
          explanation: { type: ["string", "null"] },
          topic: { type: ["string", "null"] },
        },
        required: [
          "type",
          "prompt",
          "options",
          "items",
          "pairs",
          "acceptedAnswers",
          "explanation",
          "topic",
        ],
      },
    },
    skipped: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: { reason: { type: "string" } },
        required: ["reason"],
      },
    },
  },
  required: ["questions", "skipped"],
};

export interface ExtractQuestionsInput {
  /** Văn bản thô GV dán vào — có thể chứa nhiều câu hỏi, định dạng tuỳ ý. */
  rawText: string;
}

export async function extractQuestionsFromText(
  userId: string,
  input: ExtractQuestionsInput,
  openai: OpenAI,
  model = "gpt-4o-mini",
  db: PrismaClient = prisma,
): Promise<{ questions: ExtractedAiQuestion[]; skipped: SkippedAiQuestion[] }> {
  const raw = input.rawText.trim();
  if (!raw) {
    throw new AiGenerationError("validation_failed", "empty_content");
  }
  if (raw.length < EXTRACT_MIN_INPUT_CHARS) {
    throw new AiGenerationError("validation_failed", "too_short");
  }
  if (raw.length > EXTRACT_MAX_INPUT_CHARS) {
    throw new AiGenerationError("validation_failed", "too_long");
  }
  await assertWithinCaps(userId, db, "generator");

  const system = `Bạn là trợ lý trích xuất câu hỏi trắc nghiệm từ văn bản thô cho giáo viên.

Nhiệm vụ: đọc văn bản (copy từ Word, PDF, hoặc gõ tay — có thể lộn xộn, đáp án đúng
có thể được đánh dấu bằng in đậm, gạch chân, dấu *, hoặc ghi "Đáp án: B") và TÁCH ra
từng câu hỏi đã có sẵn trong văn bản.

Quy tắc bắt buộc — vi phạm bất kỳ điều nào đều làm hỏng dữ liệu của giáo viên:
1. CHỈ trích xuất câu hỏi CÓ SẴN trong văn bản. TUYỆT ĐỐI không tự sáng tác thêm
   câu hỏi, đáp án, hay giải thích nào không có trong văn bản gốc.
2. TUYỆT ĐỐI không đoán đại đáp án/thứ tự/cặp ghép cho "đủ dữ liệu" khi văn bản
   không đủ rõ — thà bỏ qua câu đó (thêm vào "skipped") còn hơn đưa thông tin
   sai. Cụ thể theo từng loại:
   - mcq/true_false: không xác định được đáp án nào đúng → để TẤT CẢ option
     isCorrect=false (hệ thống sẽ tự báo thiếu đáp án đúng cho giáo viên xem
     lại — đó là hành vi ĐÚNG, không phải lỗi cần bạn né).
   - ordering: không chắc chắn về THỨ TỰ đúng (văn bản không cho đáp án mẫu để
     đối chiếu) → BỎ QUA câu này, đừng tự sắp xếp theo suy đoán.
   - matching: không chắc chắn cặp nào ghép với cặp nào → BỎ QUA câu này, đừng
     tự đoán cặp ghép "có vẻ hợp lý".
   - fill_in: không xác định được đáp án đúng cho chỗ trống → BỎ QUA câu này.
3. type chỉ được là một trong 5 giá trị sau — MỖI LOẠI DÙNG ĐÚNG FIELD RIÊNG,
   KHÔNG được lẫn lộn cấu trúc của loại này sang loại khác:
   - "mcq" (trắc nghiệm, 2-6 lựa chọn) / "true_false" (đúng/sai, đúng 2 lựa
     chọn "Đúng"/"Sai") → dùng field "options" (label + isCorrect từng lựa
     chọn). Đây là 2 loại DUY NHẤT dùng "options".
   - "ordering" (Sắp xếp thứ tự — xếp các từ/mảnh câu thành câu đúng) → dùng
     field "items" (mỗi phần tử là 1 mảnh, LẤY NGUYÊN VĂN TỪ VĂN BẢN GỐC),
     SẮP XẾP CÁC PHẦN TỬ TRONG MẢNG THEO ĐÚNG THỨ TỰ CỦA ĐÁP ÁN ĐÚNG (thứ tự
     trong mảng CHÍNH LÀ đáp án đúng, không có field nào khác nói thứ tự).
     TUYỆT ĐỐI không dùng "options" cho loại này — các mảnh câu KHÔNG PHẢI là
     lựa chọn để chọn 1 trong N.
   - "matching" (Ghép cặp/Ghép đôi — nối cột trái với cột phải, vd từ Hán ghép
     nghĩa tiếng Việt) → dùng field "pairs", MỖI PHẦN TỬ LÀ MỘT CẶP ĐÃ GHÉP
     ĐÚNG (left + right tương ứng theo đáp án trong văn bản, không phải liệt
     kê rời rạc 2 cột chưa ghép). TUYỆT ĐỐI không dùng "options" cho loại
     này, kể cả khi đề bài viết theo khuôn "A. ... B. ...".
   - "fill_in" (Điền khuyết — câu có chỗ trống) → dùng field "acceptedAnswers"
     (mọi biến thể đáp án được chấp nhận, lấy nguyên văn từ văn bản gốc kể cả
     cách viết/phiên âm khác nhau nếu có liệt kê). Giữ nguyên "prompt" với ký
     hiệu chỗ trống như trong văn bản gốc (gạch dưới, chấm chấm...), không tự
     chuẩn hoá.
   Với câu KHÔNG khớp cả 5 loại trên (tự luận, số học, kéo-thả điền từ vào
   đoạn văn, hoặc bất kỳ dạng nào khác) → BỎ QUA, không cố ép vào loại nào.
   Thêm một mục vào mảng "skipped" với "reason" ngắn gọn tiếng Việt (vd "Câu
   tự luận — chưa hỗ trợ qua Nhập bằng AI"). KHÔNG được im lặng bỏ sót —
   giáo viên cần biết vì sao câu đó không có mặt.
   Với 4 field "options"/"items"/"pairs"/"acceptedAnswers": LUÔN có mặt trong
   JSON, để mảng RỖNG [] cho những field không dùng tới loại của câu đó.
4. Giữ nguyên văn tiếng Việt/Anh của văn bản gốc — không dịch, không diễn giải
   lại, không sửa chính tả trừ khi rõ ràng là lỗi gõ phím (vd thiếu dấu cách).
5. explanation: chỉ điền nếu văn bản gốc có phần giải thích rõ ràng đi kèm câu đó,
   ngược lại để null. topic: chỉ điền nếu văn bản có ghi rõ chủ đề/chương, ngược
   lại để null — không tự suy đoán chủ đề từ nội dung câu hỏi.
6. Nếu văn bản không chứa câu hỏi nào, trả về { questions: [] }.`;

  const user = `# Văn bản gốc
"""
${raw}
"""

Trích xuất mọi câu hỏi trắc nghiệm/đúng-sai có trong văn bản trên; báo lại các câu
đã bỏ qua vào "skipped". Trả JSON: { questions: [...], skipped: [...] }`;

  const { data, inputTokens, outputTokens } = await callJsonModel<{
    questions: ExtractedAiQuestion[];
    skipped?: SkippedAiQuestion[];
  }>(openai, model, system, user, "extracted_questions", EXTRACT_SCHEMA, 4000);

  await logUsage(userId, model, inputTokens, outputTokens, db);

  return { questions: data.questions ?? [], skipped: data.skipped ?? [] };
}

// =====================================================================
// (h) Assignment grade suggester — GV bấm "Gợi ý điểm bằng AI" trên một bài
// nộp cụ thể. CHỈ trả gợi ý — hàm này không ghi gì vào DB, GV phải tự bấm
// "Chấm điểm" ở form mới thực sự lưu, đúng quy ước "suggestion, GV xác nhận"
// của mọi generator trong file này.
// =====================================================================

export interface AssignmentGradeSuggestion {
  score: number;
  /** Viết trực tiếp cho học viên đọc. */
  feedback: string;
  /** Giải thích ngắn cho GV vì sao cho mức điểm này — không phải cho học viên. */
  rationale: string;
}

const ASSIGNMENT_GRADE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    score: { type: "number" },
    feedback: { type: "string" },
    rationale: { type: "string" },
  },
  required: ["score", "feedback", "rationale"],
};

export interface SuggestAssignmentGradeInput {
  assignmentTitle: string;
  assignmentDescription: string;
  maxScore: number;
  /** Rubric GV tự gõ — null/rỗng vẫn chấm được, chỉ kém căn cứ hơn. */
  rubricText: string | null;
  submissionBody: string;
}

export async function suggestAssignmentGrade(
  userId: string,
  input: SuggestAssignmentGradeInput,
  openai: OpenAI,
  model = "gpt-4o-mini",
  db: PrismaClient = prisma,
): Promise<AssignmentGradeSuggestion> {
  if (!input.submissionBody.trim()) {
    throw new AiGenerationError("validation_failed", "empty_submission");
  }
  await assertWithinCaps(userId, db, "generator");

  const rubricBlock = input.rubricText?.trim()
    ? `# Rubric chấm điểm (GV cung cấp)\n${input.rubricText.trim()}`
    : `# Rubric chấm điểm\n(GV chưa cung cấp — chấm theo hiểu biết chung về đề bài, độ chính xác sẽ thấp hơn khi có rubric)`;

  const system = `Bạn là trợ giảng chấm bài tập cho một LMS. Nhiệm vụ: đọc đề bài, rubric (nếu có), và bài nộp của học viên, rồi đề xuất điểm + nhận xét.

Quy tắc bắt buộc:
- Điểm là số trong khoảng [0, ${input.maxScore}] — KHÔNG vượt quá ${input.maxScore}, KHÔNG âm.
- Nếu có rubric: bám sát từng tiêu chí trong rubric, không tự đặt tiêu chí khác.
- Nếu KHÔNG có rubric: chấm theo mức độ bài nộp đáp ứng đề bài, nêu rõ trong "rationale" là đang chấm không có rubric.
- feedback: 2-4 câu, TIẾNG VIỆT, viết trực tiếp cho học viên (xưng "bạn"), chỉ ra điểm được và điểm cần cải thiện cụ thể — không chung chung.
- rationale: 1-2 câu giải thích NGẮN GỌN cho giảng viên vì sao cho mức điểm này — không phải để học viên đọc.
- KHÔNG bịa nội dung bài nộp không có — chỉ đánh giá dựa trên đúng những gì học viên đã viết.
- Trả JSON: { score, feedback, rationale }`;

  const user = `# Đề bài: ${input.assignmentTitle}
${input.assignmentDescription}

# Điểm tối đa: ${input.maxScore}

${rubricBlock}

# Bài nộp của học viên
"""
${input.submissionBody.slice(0, 20_000)}
"""

Trả JSON: { score, feedback, rationale }`;

  const { data, inputTokens, outputTokens } = await callJsonModel<AssignmentGradeSuggestion>(
    openai,
    model,
    system,
    user,
    "assignment_grade_suggestion",
    ASSIGNMENT_GRADE_SCHEMA,
    1200,
  );

  await logUsage(userId, model, inputTokens, outputTokens, db);

  return {
    score: Math.max(0, Math.min(input.maxScore, Math.round(data.score))),
    feedback: data.feedback?.trim() ?? "",
    rationale: data.rationale?.trim() ?? "",
  };
}
