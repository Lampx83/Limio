import { NextResponse } from "next/server";
import OpenAI from "openai";
import {
  AiTutorError,
  openAiChatCompute,
  openAiEmbedCompute,
  openAiSpeechToText,
  openAiTextToSpeech,
  OpenAiVoiceError,
  runOralExamTurn,
} from "@feedbackme/core-feedback";
import { getIntegrationSecret, IntegrationError } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * A6.6 — Vấn đáp bằng giọng nói. multipart/form-data: audio=<file> (bỏ trống
 * cho lượt đầu, giống studentMessage=null ở bản gõ chữ); forceEnd="1" khi SV
 * chủ động bấm "Kết thúc vấn đáp" (bỏ qua audio, đi thẳng vào lời kết — xem
 * runOralExamTurn).
 *
 * A6.6 (test tạm) — STT/TTS dùng OpenAI (Whisper + TTS API) thay Vbee: chỉ
 * cần key OpenAI đã có sẵn cho phần chat, không phải trả phí thuê bao Vbee 1
 * năm chỉ để thử luồng. Đổi lại sang Vbee (packages/core-feedback/src/oralExam/vbee.ts)
 * khi cần giọng tiếng Việt chuyên biệt hơn.
 *
 * KHÔNG dùng SSE như bản chữ: phải chờ nghe xong (STT) rồi mới hỏi tiếp rồi
 * mới tổng hợp giọng đọc — không có gì để stream từng ký tự, trả về 1 JSON
 * sau khi xong toàn bộ.
 *
 * Response: { studentTranscript, assistantText, audioChunks (base64[],
 * phát nối tiếp theo thứ tự), contentType, ended, questionsAsked }
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string; attemptId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const attempt = await prisma.examAttempt.findUnique({
    where: { id: params.attemptId },
    select: { exam: { select: { answerMode: true, kind: true } } },
  });
  if (!attempt) {
    return NextResponse.json({ error: "attempt_not_found" }, { status: 404 });
  }
  if (attempt.exam.kind !== "oral" || attempt.exam.answerMode !== "voice") {
    return NextResponse.json({ error: "not_voice_exam" }, { status: 409 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }
  const forceEnd = form.get("forceEnd") === "1";
  const audioFile = forceEnd ? null : form.get("audio");

  const openaiKey = await getIntegrationSecret("openai").catch((e) => {
    if (e instanceof IntegrationError && e.code === "key_not_found") return null;
    throw e;
  });
  if (!openaiKey) {
    return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
  }
  const openai = new OpenAI({ apiKey: openaiKey });

  let studentTranscript: string | null = null;
  if (audioFile instanceof File) {
    const audioBuf = Buffer.from(await audioFile.arrayBuffer());
    try {
      const sttResult = await openAiSpeechToText(openai)(audioBuf, audioFile.type || "audio/wav");
      studentTranscript = sttResult.transcript.trim() || null;
    } catch (e) {
      if (e instanceof OpenAiVoiceError) {
        return NextResponse.json({ error: e.code, details: e.details }, { status: 502 });
      }
      throw e;
    }
    if (!studentTranscript) {
      return NextResponse.json({ error: "empty_transcript" }, { status: 400 });
    }
  }

  let turnResult;
  try {
    turnResult = await runOralExamTurn({
      attemptId: params.attemptId,
      studentUserId: userId,
      studentMessage: studentTranscript,
      forceEnd,
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
    // Câu hỏi/lời kết vẫn đã lưu vào transcript ở runOralExamTurn — không
    // mất gì nếu chỉ riêng bước đọc thành tiếng lỗi. Trả về không có audio,
    // SV dùng bản chữ (assistantText) qua nút "chuyển sang gõ chữ".
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
