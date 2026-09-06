import OpenAI from "openai";
import { z } from "zod";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";

/**
 * AI authoring generators — used by instructor UI to draft skill tags,
 * feedback templates, and quiz questions. All return STRUCTURED suggestions
 * that the instructor reviews + confirms before persisting.
 *
 * Each generator logs its usage to AiUsageLog so cost tracking is unified
 * with AI Tutor (per-day-per-model bucket per user).
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

const PRICE_PER_1K_INPUT: Record<string, number> = {
  "gpt-4o-mini": 0.00015,
  "gpt-4o": 0.0025,
};
const PRICE_PER_1K_OUTPUT: Record<string, number> = {
  "gpt-4o-mini": 0.0006,
  "gpt-4o": 0.01,
};

function dayKey(now = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

async function logUsage(
  userId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  db: PrismaClient,
) {
  const inP = PRICE_PER_1K_INPUT[model] ?? 0;
  const outP = PRICE_PER_1K_OUTPUT[model] ?? 0;
  const costUsd = (inputTokens / 1000) * inP + (outputTokens / 1000) * outP;
  const k = dayKey();
  await db.aiUsageLog.upsert({
    where: { userId_dayKey_model: { userId, dayKey: k, model } },
    create: {
      userId,
      dayKey: k,
      model,
      tokensInput: inputTokens,
      tokensOutput: outputTokens,
      costUsd,
      turns: 1,
    },
    update: {
      tokensInput: { increment: inputTokens },
      tokensOutput: { increment: outputTokens },
      costUsd: { increment: costUsd },
      turns: { increment: 1 },
    },
  });
  return costUsd;
}

/** Wraps OpenAI's structured-output API. Returns parsed JSON + usage. */
async function callJsonModel<T>(
  openai: OpenAI,
  model: string,
  systemPrompt: string,
  userPrompt: string,
  schemaName: string,
  schemaDef: Record<string, unknown>,
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
      max_tokens: 2000,
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
): Promise<MisconceptionProposal[]> {
  const wrong = question.options.filter((o) => !o.isCorrect);
  if (wrong.length === 0) return [];

  const catalogue = await db.misconception.findMany({
    select: { code: true, name: true, description: true },
    orderBy: { code: "asc" },
  });
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

  await logUsage(userId, model, inputTokens, outputTokens, db);

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
