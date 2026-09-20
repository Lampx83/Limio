import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  AiTutorError,
  openAiChatCompute,
  openAiEmbedCompute,
  openAiSpeechToText,
  openAiTextToSpeech,
  OpenAiVoiceError,
  runOralExamPreviewTurn,
} from "@feedbackme/core-feedback";
import {
  assertCanEditExam,
  CourseAuthzError,
  getIntegrationSecret,
  IntegrationError,
} from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

const MAX_HISTORY = 400; // không giới hạn số câu hỏi — trần này chỉ chặn request bất thường
const MAX_TEXT = 4_000;

/**
 * "Thử vấn đáp" bằng giọng nói của giáo viên — cùng khuôn /oral-attempt/[attemptId]/voice-turn (STT → chat → TTS,
 * trả 1 JSON) nhưng KHÔNG có lượt thi: lịch sử hội thoại do client gửi trong field "history" (JSON), server không
 * ghi ExamAttempt/OralExamTurn/LearningEvent. Vẫn tính token AI của giáo viên. Chỉ người sửa được đề mới gọi được.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: { id: true, courseId: true, createdById: true, kind: true, language: true },
  });
  if (!exam) return NextResponse.json({ error: "exam_not_found" }, { status: 404 });
  if (exam.kind !== "oral") return NextResponse.json({ error: "exam_not_oral" }, { status: 400 });
  try {
    await assertCanEditExam(userId, exam);
  } catch (e) {
    if (e instanceof CourseAuthzError) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    throw e;
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }
  const forceEnd = form.get("forceEnd") === "1";
  const rawTopicId = form.get("topicId");
  const topicId = typeof rawTopicId === "string" && rawTopicId ? rawTopicId : null;
  const audioFile = forceEnd ? null : form.get("audio");

  let rawHistory: unknown = [];
  try {
    const h = form.get("history");
    rawHistory = typeof h === "string" ? JSON.parse(h) : [];
  } catch {
    return NextResponse.json({ error: "invalid_history" }, { status: 400 });
  }
  if (!Array.isArray(rawHistory) || rawHistory.length > MAX_HISTORY) {
    return NextResponse.json({ error: "invalid_history" }, { status: 400 });
  }
  const history: { role: "examiner" | "student"; content: string }[] = [];
  for (const t of rawHistory as Array<{ role?: unknown; content?: unknown }>) {
    if ((t?.role !== "examiner" && t?.role !== "student") || typeof t.content !== "string") {
      return NextResponse.json({ error: "invalid_history" }, { status: 400 });
    }
    history.push({ role: t.role, content: t.content.slice(0, MAX_TEXT) });
  }

  const openaiKey = await getIntegrationSecret("openai").catch((e) => {
    if (e instanceof IntegrationError && e.code === "key_not_found") return null;
    throw e;
  });
  if (!openaiKey) return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
  const openai = new OpenAI({ apiKey: openaiKey });

  let studentTranscript: string | null = null;
  if (audioFile instanceof File) {
    const audioBuf = Buffer.from(await audioFile.arrayBuffer());
    try {
      const stt = await openAiSpeechToText(openai, exam.language)(audioBuf, audioFile.type || "audio/wav");
      studentTranscript = stt.transcript.trim() || null;
    } catch (e) {
      if (e instanceof OpenAiVoiceError) {
        return NextResponse.json({ error: e.code, details: e.details }, { status: 502 });
      }
      throw e;
    }
    if (!studentTranscript) return NextResponse.json({ error: "empty_transcript" }, { status: 400 });
  }

  let turnResult;
  try {
    turnResult = await runOralExamPreviewTurn({
      examId: exam.id,
      teacherUserId: userId,
      history,
      studentMessage: studentTranscript,
      forceEnd,
      topicId,
      computeChat: openAiChatCompute(openai),
      computeEmbed: openAiEmbedCompute(openai),
    });
  } catch (e) {
    if (e instanceof AiTutorError) {
      return NextResponse.json({ error: e.code, details: e.details }, { status: 400 });
    }
    throw e;
  }

  let audioChunks: string[] = [];
  let contentType = "audio/mpeg";
  try {
    const tts = await openAiTextToSpeech(openai)(turnResult.assistantContent);
    audioChunks = tts.audioChunks.map((b) => b.toString("base64"));
    contentType = tts.contentType;
  } catch (e) {
    // Như bản thật: lỗi đọc thành tiếng thì vẫn trả chữ, không làm hỏng lượt.
    if (!(e instanceof OpenAiVoiceError)) throw e;
  }

  return NextResponse.json({
    studentTranscript,
    assistantText: turnResult.assistantContent,
    audioChunks,
    contentType,
    ended: turnResult.ended,
    questionsAsked: turnResult.questionsAsked,
  });
}
