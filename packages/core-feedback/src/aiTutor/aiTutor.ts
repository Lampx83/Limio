import OpenAI from "openai";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { AiTutorError } from "./errors";
import { getChatModel } from "./llm";
import { assertHasTokenBudget, chargeTokens } from "./tokenWallet";

export { AiTutorError } from "./errors";

// Caps — override per env if needed.
export const MAX_TURNS_PER_HOUR = Number(process.env.AI_TURNS_PER_HOUR ?? "10");
// Trần toàn hệ thống: mặc định KHÔNG có trần. Mức cũ 5 triệu token/ngày đã chặn
// giữa chừng 24 lượt thi vấn đáp (2026-11-02): một đợt thi tự nó đã dùng hết con
// số đó, mà LLM tự host thì không tính tiền theo token. Muốn đặt trần thì đặt
// SiteSetting hoặc env; 0 vẫn là công tắc khẩn tắt mọi lời gọi AI.
export const GLOBAL_TOKENS_PER_DAY_KEY = "ai.tokens_per_day_global";
export const DEFAULT_GLOBAL_TOKENS_PER_DAY = Number(
  process.env.AI_TOKENS_PER_DAY_GLOBAL ?? Number.POSITIVE_INFINITY,
);

/**
 * Cộng dồn một lần gọi AI vào sổ ngày. Mọi đường sinh ra chi phí đều phải đi
 * qua đây — cap chỉ đúng bằng mức đầy đủ của sổ mà nó đọc; một endpoint gọi
 * OpenAI mà quên ghi thì vừa vô hình trong báo cáo, vừa làm cap của mọi
 * endpoint khác nới ra một cách thầm lặng.
 */
export async function recordAiUsage(
  userId: string,
  model: string,
  inputTokens: number,
  outputTokens: number,
  db: PrismaClient = prisma,
): Promise<number> {
  const costUsd = estimateCost(model, inputTokens, outputTokens);
  const dayKey = dayKeyUtc();
  await db.aiUsageLog.upsert({
    where: { userId_dayKey_model: { userId, dayKey, model } },
    create: {
      userId,
      dayKey,
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
  const log = await db.aiUsageLog.findUnique({
    where: { userId_dayKey_model: { userId, dayKey, model } },
    select: { id: true },
  });
  await chargeTokens(userId, inputTokens + outputTokens, log?.id ?? null, db);
  return costUsd;
}

/** Phạm vi gọi AI — quyết định cap nào được áp. */
// A6.3 — "oral_exam": lượt hỏi/đáp trong 1 buổi vấn đáp AI. Người gọi là
// SINH VIÊN đang thi bắt buộc — khác "tutor"/"generator" (tự nguyện dùng AI).
export type AiCapScope = "tutor" | "generator" | "oral_exam";

/**
 * Trần ngày toàn hệ thống. Ưu tiên SiteSetting (đổi được lúc đang chạy, không
 * cần restart) rồi mới tới env. Giá trị 0 là công tắc khẩn: tắt sạch mọi lời
 * gọi AI. Giá trị rác thì bỏ qua và quay về mặc định.
 */
async function resolveGlobalTokenCap(db: PrismaClient): Promise<number> {
  const row = await db.siteSetting.findUnique({
    where: { key: GLOBAL_TOKENS_PER_DAY_KEY },
  });
  if (row) {
    const n = Number(row.value);
    if (Number.isFinite(n) && n >= 0) return n;
  }
  return DEFAULT_GLOBAL_TOKENS_PER_DAY;
}

// Default chat model — LLM tự host qua vLLM (xem llm.ts). Giá không có trong bảng
// dưới ⇒ cost = 0 (tự host: tốn hạ tầng chứ không tính theo token); token vẫn
// được đếm cho cap.
export const DEFAULT_MODEL = getChatModel();

/** Số ký tự tối đa của đoạn bôi đen gửi kèm câu hỏi. */
export const MAX_QUOTE_CHARS = 800;

// Rough pricing per 1K tokens for cost log (USD). Update when models change.
// Source: openai.com/api/pricing — values as of 2026-05.
const PRICE_PER_1K_INPUT: Record<string, number> = {
  // LANG G7 — Whisper tính theo phút (0,006 USD); 1 phút = 6.000 token ví nên ≈ 0,001 USD / 1K token ví.
  "whisper-1": 0.001,
};
const PRICE_PER_1K_OUTPUT: Record<string, number> = {
};

function dayKeyUtc(now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  const d = String(now.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const inP = PRICE_PER_1K_INPUT[model] ?? 0;
  const outP = PRICE_PER_1K_OUTPUT[model] ?? 0;
  return (inputTokens / 1000) * inP + (outputTokens / 1000) * outP;
}

/**
 * Ném AiTutorError nếu vượt bất kỳ trần nào: toàn hệ thống, lượt/giờ, hoặc
 * token/ngày của chính người gọi. Gọi TRƯỚC khi chạm OpenAI — cap chỉ có ý
 * nghĩa nếu nó chặn được request chứ không phải ghi nhận sau khi đã tiêu tiền.
 *
 * Thứ tự kiểm có chủ ý: trần toàn hệ thống đứng trước, vì nó là thứ duy nhất
 * đứng giữa một con bug (vòng lặp gọi AI, script chạy hoảng) và hoá đơn — nên
 * phải chặn kể cả khi người gọi còn dư quota riêng.
 *
 * `scope: "generator"` bỏ qua cap lượt/giờ: cap đó đếm AiMessage, mà chỉ hội
 * thoại mới tạo bản ghi ấy. Áp cho generator là đếm nhầm sang việc khác —
 * giảng viên sinh câu hỏi mười lần sẽ bị chặn bởi một bộ đếm không hề tăng.
 */
export async function assertWithinCaps(
  userId: string,
  db: PrismaClient = prisma,
  scope: AiCapScope = "tutor",
): Promise<void> {
  const today = dayKeyUtc();

  // 1. Trần toàn hệ thống.
  const globalCap = await resolveGlobalTokenCap(db);
  const globalAgg = await db.aiUsageLog.aggregate({
    where: { dayKey: today },
    _sum: { tokensInput: true, tokensOutput: true },
  });
  const globalToday =
    (globalAgg._sum.tokensInput ?? 0) + (globalAgg._sum.tokensOutput ?? 0);
  if (globalToday >= globalCap) {
    throw new AiTutorError("global_token_cap", {
      globalToday,
      cap: globalCap,
    });
  }

  // 2. Lượt/giờ — chỉ với hội thoại.
  if (scope === "tutor") {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const turnsLastHour = await db.aiMessage.count({
      where: {
        role: "assistant",
        conversation: { userId },
        createdAt: { gte: oneHourAgo },
      },
    });
    if (turnsLastHour >= MAX_TURNS_PER_HOUR) {
      throw new AiTutorError("rate_limited", {
        turnsLastHour,
        cap: MAX_TURNS_PER_HOUR,
      });
    }
  }

  // 3. Ví token của người gọi — hạn mức tháng cộng phần đã mua. Bỏ qua cho
  // "oral_exam": đây là thi bắt buộc — không thể để sinh viên hết ví cá nhân
  // (vì lỡ hỏi AI Tutor nhiều) mà không thi được. Trần hệ thống ở bước 1 +
  // trần cứng số câu hỏi/thời gian (application layer, runOralExamTurn) đã
  // đủ chặn chi phí vượt tầm kiểm soát cho scope này.
  if (scope !== "oral_exam") {
    await assertHasTokenBudget(userId, db);
  }
}

export interface LessonContext {
  lessonId: string;
  lessonTitle: string;
  courseTitle: string;
  /** `Course.language` (mã như "en", "vi"). Chỉ là gợi ý dự phòng — ngôn ngữ trả lời theo tin nhắn của người học. */
  courseLanguage?: string | null;
  /** Ngôn ngữ giao diện của người học ("vi" | "en"); dự phòng sau `courseLanguage`. */
  uiLocale?: string | null;
  /** Concatenated markdown content + content item descriptions. Truncated to ~6KB. */
  contextText: string;
  /** Skills tagged on the lesson with current learner mastery. */
  skillStates: Array<{
    skillCode: string;
    skillName: string;
    masteryProbability: number;
  }>;
}

/** Build the lesson context block injected into the system prompt. */
export async function buildLessonContext(
  userId: string,
  lessonId: string,
  db: PrismaClient = prisma,
  uiLocale?: string | null,
): Promise<LessonContext> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: { include: { course: { select: { title: true, language: true } } } },
      contentItems: {
        orderBy: { orderIndex: "asc" },
        select: { type: true, payload: true },
      },
    },
  });
  if (!lesson) throw new AiTutorError("lesson_not_found");

  // Pull text content — markdown body + asset descriptions. Cap total length.
  const parts: string[] = [];
  if (lesson.description) parts.push(lesson.description);
  for (const c of lesson.contentItems) {
    const p = (c.payload ?? {}) as Record<string, unknown>;
    if (c.type === "markdown" && typeof p.body === "string") {
      parts.push(p.body);
    } else if (c.type === "video") {
      parts.push(
        `[Video: ${String(p.url ?? "")}${p.transcriptUrl ? ` — transcript: ${p.transcriptUrl}` : ""}]`,
      );
    } else if (c.type === "external_link" || c.type === "embed") {
      parts.push(`[Link: ${String(p.title ?? "")} ${String(p.url ?? "")}]`);
    } else if (c.type === "file" || c.type === "pdf") {
      parts.push(`[File: ${String(p.title ?? p.filename ?? "")}]`);
    }
  }
  const contextText = parts.join("\n\n").slice(0, 6_000);

  // Skill states for skills tagged on this lesson.
  const skillTags = await db.contentSkillMapping.findMany({
    where: { contentType: "lesson", contentId: lesson.id },
    include: { skill: { select: { code: true, name: true } } },
  });
  const skillStates: LessonContext["skillStates"] = [];
  if (skillTags.length > 0) {
    const states = await db.learnerSkillState.findMany({
      where: { userId, skillId: { in: skillTags.map((t) => t.skillId) } },
    });
    const byId = new Map(states.map((s) => [s.skillId, s]));
    for (const tag of skillTags) {
      const s = byId.get(tag.skillId);
      skillStates.push({
        skillCode: tag.skill.code,
        skillName: tag.skill.name,
        masteryProbability: s?.masteryProbability ?? 0.2,
      });
    }
  }

  return {
    lessonId,
    lessonTitle: lesson.title,
    courseTitle: lesson.module.course.title,
    courseLanguage: lesson.module.course.language,
    uiLocale: uiLocale ?? null,
    contextText,
    skillStates,
  };
}

/** Tên tiếng Anh của ngôn ngữ — prompt viết bằng tiếng Anh để chính chỉ dẫn không kéo model sang tiếng Việt. */
const TUTOR_LANGUAGE_NAMES: Record<string, string> = {
  vi: "Vietnamese",
  en: "English",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  fr: "French",
  de: "German",
};

function languageNameOf(code: string | null | undefined): string | null {
  const base = (code ?? "").trim().toLowerCase().split(/[-_]/)[0] ?? "";
  return TUTOR_LANGUAGE_NAMES[base] ?? null;
}

/**
 * Ngôn ngữ dự phòng khi tin nhắn quá ngắn/mơ hồ để đoán: ngôn ngữ của khoá học
 * (`Course.language`), rồi mới tới ngôn ngữ giao diện, rồi tiếng Việt (mặc định
 * của nền tảng). Mã lạ không có trong bảng tên thì bị bỏ qua, không đoán.
 */
export function resolveTutorFallbackLanguage(
  courseLanguage: string | null | undefined,
  uiLocale: string | null | undefined,
): string {
  return languageNameOf(courseLanguage) ?? languageNameOf(uiLocale) ?? "Vietnamese";
}

/**
 * Chỉ dẫn ngôn ngữ trả lời. Có mặt ở ĐẦU và CUỐI system prompt: chỉ dẫn cuối
 * thắng khi phần giữa (nội dung bài học, tên skill) viết bằng tiếng khác — chính
 * là lỗi gốc: nội dung/skill bằng tiếng Việt kéo câu trả lời sang tiếng Việt dù
 * học viên hỏi bằng tiếng Anh.
 */
export function tutorLanguageRule(ctx: Pick<LessonContext, "courseLanguage" | "uiLocale">): string {
  const fallback = resolveTutorFallbackLanguage(ctx.courseLanguage, ctx.uiLocale);
  return `LANGUAGE RULE (highest priority): Always answer in the language of the user's LAST message — English question → English answer, Vietnamese → Vietnamese, any other language → that language. Decide it from the user's own words, NOT from the language of the lesson content, the course title, the skill names, or earlier assistant replies. Everything you write — explanations, Socratic questions, quiz/practice questions and their option labels, headings, hints, closing lines — must be in that same language; never mix in another language, except quoted lesson terms. Only if the last message is too short or ambiguous to tell its language (e.g. a single word, a number, an emoji), answer in ${fallback} (the course's language, otherwise the interface language).`;
}

export function buildSystemPrompt(ctx: LessonContext): string {
  const weak = ctx.skillStates
    .filter((s) => s.masteryProbability < 0.5)
    .map((s) => `${s.skillName} (${Math.round(s.masteryProbability * 100)}%)`)
    .join(", ");
  const strong = ctx.skillStates
    .filter((s) => s.masteryProbability >= 0.8)
    .map((s) => s.skillName)
    .join(", ");
  const languageRule = tutorLanguageRule(ctx);

  return `${languageRule}

You are the AI tutor of FeedBackMe, a personalised learning platform.

Course: "${ctx.courseTitle}"
Current lesson: "${ctx.lessonTitle}"

Lesson content (for your reference; it may be in a different language from the user's message):
"""
${ctx.contextText || "(no text content)"}
"""

The learner's status on the skills related to this lesson:
${weak ? `- Weak: ${weak}` : "- No clearly weak skills."}
${strong ? `- Mastered: ${strong}` : ""}

Teaching principles:
1. Socratic method: ask guiding questions and give hints step by step; do NOT hand over the answers to exercises or quizzes.
2. Refer to the lesson content when explaining; do not stay generic.
3. If the user asks about something outside the lesson, politely steer them back to the lesson.
4. Respect the learner's weak skills: start from foundations and avoid advanced jargon with them.
5. When asked to summarise, simplify or quiz, do it on the lesson content above. Weak-skill remarks and quiz questions follow the language rule too.

Keep answers short; use markdown when helpful (lists, code blocks).

${languageRule}`;
}

interface ChatTurnInput {
  conversationId: string;
  userId: string;
  /** The user's new message content. */
  userMessage: string;
  /**
   * Đoạn học viên bôi đen trong bài rồi chọn "Hỏi AI". Được lưu chung vào tin
   * nhắn dưới dạng trích dẫn (blockquote) chứ không chỉ nhét vào system prompt:
   * lịch sử hội thoại là thứ gửi lại cho model ở các lượt sau, nên câu hỏi
   * "ý này nghĩa là gì?" vẫn còn nguyên nó đang hỏi về chỗ nào.
   */
  quote?: string;
  /** Ngôn ngữ giao diện của người học ("vi" | "en") — dự phòng cuối cho ngôn ngữ trả lời. */
  uiLocale?: string;
  /** OpenAI client — caller injects so we can swap providers / mock in tests. */
  openai: OpenAI;
  model?: string;
  /** When set, full assistant text is streamed via this callback as it arrives. */
  onDelta?: (delta: string) => void;
}

export interface ChatTurnResult {
  assistantContent: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
    costUsd: number;
  };
}

/**
 * Run one chat turn. Persists user + assistant messages, increments AiUsageLog,
 * checks rate caps. Streaming is optional — caller passes onDelta to receive
 * partial output as it arrives.
 */
export async function runChatTurn(
  input: ChatTurnInput,
  db: PrismaClient = prisma,
): Promise<ChatTurnResult> {
  if (!input.userMessage.trim()) {
    throw new AiTutorError("validation_failed", "empty_message");
  }
  await assertWithinCaps(input.userId, db);

  const conv = await db.aiConversation.findUnique({
    where: { id: input.conversationId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conv) throw new AiTutorError("validation_failed", "conversation_not_found");
  if (conv.userId !== input.userId) {
    throw new AiTutorError("validation_failed", "wrong_user");
  }

  // Trích đoạn chỉ là ngữ cảnh — cắt để một cú dán cả trang không ăn hết ví token.
  const quote = (input.quote ?? "").trim().slice(0, MAX_QUOTE_CHARS);
  const rawText = input.userMessage.trim();
  const userText = quote
    ? `${quote.split("\n").map((l) => `> ${l}`).join("\n")}\n\n${rawText}`
    : rawText;

  const ctx = await buildLessonContext(input.userId, conv.lessonId, db, input.uiLocale);
  const system = buildSystemPrompt(ctx);
  // KHÔNG dùng conv.model: đó là model lúc tạo hội thoại (các hội thoại cũ ghi
  // "gpt-4o-mini"), gửi tên đó sang LLM tự host sẽ lỗi "model không tồn tại".
  const model = input.model ?? DEFAULT_MODEL;

  // Persist the user message first so a crash mid-stream isn't lost.
  const userMsg = await db.aiMessage.create({
    data: {
      conversationId: conv.id,
      role: "user",
      content: userText,
    },
  });

  // Build chat history: cap at last N turns to keep context window small.
  const HISTORY_TURNS = 12;
  const recent = conv.messages.slice(-HISTORY_TURNS).map((m) => ({
    role: m.role as "system" | "user" | "assistant",
    content: m.content,
  }));

  const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: system },
    ...recent,
    { role: "user", content: userText },
  ];

  let assistantContent = "";
  let inputTokens = 0;
  let outputTokens = 0;

  try {
    const stream = await input.openai.chat.completions.create({
      model,
      messages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: 0.4,
      max_tokens: 800,
    });

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? "";
      if (delta) {
        assistantContent += delta;
        input.onDelta?.(delta);
      }
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens ?? 0;
        outputTokens = chunk.usage.completion_tokens ?? 0;
      }
    }
  } catch (e) {
    throw new AiTutorError("openai_error", (e as Error).message, e);
  }

  if (!assistantContent) {
    throw new AiTutorError("openai_error", "empty_response");
  }

  const costUsd = estimateCost(model, inputTokens, outputTokens);

  // Persist assistant message + usage log + update title on first turn.
  await db.aiMessage.create({
    data: {
      conversationId: conv.id,
      role: "assistant",
      content: assistantContent,
      tokensInput: inputTokens,
      tokensOutput: outputTokens,
      costUsd,
    },
  });
  await db.aiMessage.update({
    where: { id: userMsg.id },
    data: { tokensInput: inputTokens },
  });
  if (!conv.title && conv.messages.length === 0) {
    await db.aiConversation.update({
      where: { id: conv.id },
      data: { title: input.userMessage.trim().slice(0, 80) },
    });
  } else {
    await db.aiConversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date() },
    });
  }

  // Sổ ngày + trừ ví token. Phải đi qua recordAiUsage như mọi đường AI khác: trước
  // đây chỗ này tự upsert AiUsageLog mà không trừ ví, nên lượt hỏi tutor — đường
  // dùng nhiều nhất — không bao giờ làm "còn N lượt" giảm, và hạn mức tháng chỉ
  // cạn vì các tính năng khác.
  await recordAiUsage(input.userId, model, inputTokens, outputTokens, db);

  // B15 — ghi vào dòng hành vi. Trợ giảng AI trước đây là kênh duy nhất không
  // phát event, nên khi dựng lại "em này làm gì trong buổi học" thì mọi lượt
  // hỏi AI biến mất khỏi dòng thời gian. Với một thực nghiệm về phản hồi, đó
  // đúng là biến cần nhìn: lớp bị cắt phản hồi có quay sang hỏi AI nhiều hơn
  // không — nếu có thì AI đang bù vào chỗ trống và làm nhiễu phép so sánh.
  //
  // Phát SAU khi đã ghi xong tin nhắn: event nói rằng lượt hỏi đã hoàn tất,
  // nên không được có mặt cho một lượt hỏng giữa chừng.
  const lessonCourse = await db.lesson.findUnique({
    where: { id: conv.lessonId },
    select: { module: { select: { courseId: true } } },
  });
  await db.learningEvent.create({
    data: {
      userId: input.userId,
      courseId: lessonCourse?.module.courseId ?? null,
      eventType: LearningEventType.AiTutorAsked,
      payload: {
        lessonId: conv.lessonId,
        conversationId: conv.id,
        questionLength: input.userMessage.trim().length,
        // `conv.messages` là ảnh chụp trước lượt này; mỗi lượt gồm một tin
        // của người học và một tin của trợ giảng.
        turnIndex: Math.floor(conv.messages.length / 2) + 1,
      } as Prisma.InputJsonValue,
    },
  });

  return {
    assistantContent,
    usage: { inputTokens, outputTokens, costUsd },
  };
}

export async function getOrCreateConversation(
  userId: string,
  lessonId: string,
  db: PrismaClient = prisma,
) {
  // Reuse the latest conversation in the last 24h, else create new.
  const recent = await db.aiConversation.findFirst({
    where: {
      userId,
      lessonId,
      updatedAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
    },
    orderBy: { updatedAt: "desc" },
  });
  if (recent) return recent;
  return db.aiConversation.create({
    data: { userId, lessonId, model: DEFAULT_MODEL },
  });
}

export async function getConversationWithMessages(
  conversationId: string,
  userId: string,
  db: PrismaClient = prisma,
) {
  const conv = await db.aiConversation.findUnique({
    where: { id: conversationId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!conv || conv.userId !== userId) return null;
  return conv;
}

/** Make a Prisma JSON-safe usage snapshot for client UI. */
export function todayUsageSnapshotShape() {
  return Prisma.validator<Prisma.AiUsageLogSelect>()({
    model: true,
    tokensInput: true,
    tokensOutput: true,
    costUsd: true,
    turns: true,
  });
}
