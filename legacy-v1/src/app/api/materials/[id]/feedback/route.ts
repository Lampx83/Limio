import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  generateMaterialFeedback,
  loadPersonalizationContext,
} from "@/lib/feedback";

interface MaterialRow {
  id: number;
  type: "video" | "pdf" | "quiz";
  title: string;
  description: string | null;
  reading_text: string | null;
  quiz_data: string | null;
  video_url: string | null;
}

interface InteractionRow {
  id: number;
  data: string | null;
  score: number | null;
}

export async function POST(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  }
  const { id } = await ctx.params;
  const mid = Number(id);
  if (!Number.isFinite(mid)) {
    return NextResponse.json({ error: "ID học liệu không hợp lệ" }, { status: 400 });
  }

  const m = db
    .prepare(
      "SELECT id, type, title, description, reading_text, quiz_data, video_url FROM learning_materials WHERE id = ?",
    )
    .get(mid) as MaterialRow | undefined;
  if (!m) return NextResponse.json({ error: "Không tìm thấy học liệu" }, { status: 404 });

  const interaction = db
    .prepare(
      "SELECT id, data, score FROM material_interactions WHERE user_id = ? AND material_id = ?",
    )
    .get(user.id, mid) as InteractionRow | undefined;
  if (!interaction) {
    return NextResponse.json(
      { error: "Hãy hoàn thành học liệu (xem/đọc/làm quiz) trước khi xin phản hồi AI" },
      { status: 400 },
    );
  }

  // Đã có feedback rồi → trả về luôn (idempotent)
  const existing = db
    .prepare(
      "SELECT id, summary, strengths, gaps, next_steps, metacog_prompt FROM material_feedbacks WHERE interaction_id = ?",
    )
    .get(interaction.id) as
    | {
        id: number;
        summary: string;
        strengths: string;
        gaps: string;
        next_steps: string;
        metacog_prompt: string;
      }
    | undefined;
  if (existing) {
    return NextResponse.json({ ok: true, cached: true, feedback: existing });
  }

  const condition = user.experiment_condition ?? "control";

  // Tóm tắt nội dung tài liệu
  let materialSummary = m.description ?? "";
  if (m.type === "pdf" && m.reading_text) {
    materialSummary +=
      "\n\nNội dung tài liệu (đoạn đầu):\n" +
      m.reading_text.slice(0, 1500);
  }
  if (m.type === "video" && m.video_url) {
    materialSummary += `\nVideo URL: ${m.video_url}`;
  }
  if (m.type === "quiz" && m.quiz_data) {
    const qs = JSON.parse(m.quiz_data) as Array<{ q: string }>;
    materialSummary += "\n\nCâu hỏi quiz: " + qs.map((x) => x.q).join(" | ");
  }

  let body: { reflection?: string } = {};
  try {
    body = await req.json();
  } catch {
    /* optional body */
  }

  const interactionData = JSON.parse(interaction.data ?? "{}");
  const reflection =
    body.reflection ?? (interactionData.reflection as string) ?? "";

  const ctx2 =
    condition === "personalized"
      ? loadPersonalizationContext(user.id)
      : { studentName: "", learningStyle: null, srl: null };

  try {
    const { result, raw } = await generateMaterialFeedback({
      materialType: m.type,
      materialTitle: m.title,
      materialDescription: m.description ?? "",
      materialSummary,
      interactionData,
      reflectionText: reflection,
      condition,
      studentName: ctx2.studentName,
      learningStyle: ctx2.learningStyle,
      srl: ctx2.srl,
    });

    db.prepare(
      `INSERT INTO material_feedbacks (interaction_id, condition, raw_response, summary, strengths, gaps, next_steps, metacog_prompt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      interaction.id,
      condition,
      raw,
      result.summary,
      result.strengths,
      result.gaps,
      result.next_steps,
      result.metacog_prompt,
    );

    return NextResponse.json({ ok: true, cached: false, feedback: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    return NextResponse.json(
      { error: `Sinh phản hồi AI thất bại: ${message}` },
      { status: 500 },
    );
  }
}
