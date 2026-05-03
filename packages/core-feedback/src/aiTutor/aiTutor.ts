import OpenAI from "openai";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";

export class AiTutorError extends Error {
  constructor(
    public readonly code:
      | "no_api_key"
      | "rate_limited"
      | "daily_token_cap"
      | "lesson_not_found"
      | "validation_failed"
      | "openai_error",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

// Caps — override per env if needed.
export const MAX_TURNS_PER_HOUR = Number(process.env.AI_TURNS_PER_HOUR ?? "10");
export const MAX_TOKENS_PER_DAY = Number(
  process.env.AI_TOKENS_PER_DAY ?? "50000",
);

// Default model. gpt-4o-mini = cheap + fast. Override per-conversation if needed.
export const DEFAULT_MODEL = "gpt-4o-mini";

// Rough pricing per 1K tokens for cost log (USD). Update when models change.
// Source: openai.com/api/pricing — values as of 2026-05.
const PRICE_PER_1K_INPUT: Record<string, number> = {
  "gpt-4o-mini": 0.00015,
  "gpt-4o": 0.0025,
};
const PRICE_PER_1K_OUTPUT: Record<string, number> = {
  "gpt-4o-mini": 0.0006,
  "gpt-4o": 0.01,
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

/** Throws AiTutorError if user has exceeded turns/hour or tokens/day cap. */
export async function assertWithinCaps(
  userId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  // Turns/hour: count user's assistant messages in last 60 min.
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

  // Tokens/day: aggregate from AiUsageLog for today.
  const today = dayKeyUtc();
  const logs = await db.aiUsageLog.findMany({
    where: { userId, dayKey: today },
    select: { tokensInput: true, tokensOutput: true },
  });
  const totalToday = logs.reduce(
    (s, l) => s + l.tokensInput + l.tokensOutput,
    0,
  );
  if (totalToday >= MAX_TOKENS_PER_DAY) {
    throw new AiTutorError("daily_token_cap", {
      totalToday,
      cap: MAX_TOKENS_PER_DAY,
    });
  }
}

interface LessonContext {
  lessonId: string;
  lessonTitle: string;
  courseTitle: string;
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
): Promise<LessonContext> {
  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    include: {
      module: { include: { course: { select: { title: true } } } },
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
    contextText,
    skillStates,
  };
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

  return `Bạn là AI tutor cho FeedBackMe — nền tảng học cá nhân hóa.

Khóa học: "${ctx.courseTitle}"
Bài học hiện tại: "${ctx.lessonTitle}"

Nội dung bài học (để bạn tham khảo):
"""
${ctx.contextText || "(không có nội dung text)"}
"""

Tình trạng học của user trên các skill liên quan:
${weak ? `- Đang yếu: ${weak}` : "- Không có skill yếu rõ rệt."}
${strong ? `- Đã thành thạo: ${strong}` : ""}

Nguyên tắc giảng dạy:
1. Phương pháp Socratic — hỏi ngược, gợi ý từng bước, KHÔNG đưa thẳng đáp án bài tập / quiz.
2. Trả lời tiếng Việt nếu user dùng tiếng Việt; tiếng Anh nếu user dùng tiếng Anh.
3. Tham chiếu nội dung bài học khi giải thích — đừng nói chung chung.
4. Nếu user hỏi ngoài phạm vi bài học, lịch sự hướng họ về phía bài học.
5. Tôn trọng skill yếu của user — bắt đầu từ kiến thức nền, không dùng từ chuyên môn cao cấp với họ.

Trả lời ngắn gọn, dùng markdown khi cần (list, code block).`;
}

interface ChatTurnInput {
  conversationId: string;
  userId: string;
  /** The user's new message content. */
  userMessage: string;
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

  const ctx = await buildLessonContext(input.userId, conv.lessonId, db);
  const system = buildSystemPrompt(ctx);
  const model = input.model ?? conv.model ?? DEFAULT_MODEL;

  // Persist the user message first so a crash mid-stream isn't lost.
  const userMsg = await db.aiMessage.create({
    data: {
      conversationId: conv.id,
      role: "user",
      content: input.userMessage.trim(),
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
    { role: "user", content: input.userMessage.trim() },
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
    throw new AiTutorError("openai_error", (e as Error).message);
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

  // Aggregate daily usage.
  const dayKey = dayKeyUtc();
  await db.aiUsageLog.upsert({
    where: { userId_dayKey_model: { userId: input.userId, dayKey, model } },
    create: {
      userId: input.userId,
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
