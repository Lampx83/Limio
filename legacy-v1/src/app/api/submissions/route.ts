import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { logEvent } from "@/lib/log";
import {
  generateFeedback,
  loadPersonalizationContext,
} from "@/lib/feedback";

interface AssignmentRow {
  id: number;
  title: string;
  prompt: string;
  learning_objectives: string;
  rubric: string;
  min_words: number;
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || user.role !== "student") {
    return NextResponse.json({ error: "Không có quyền" }, { status: 401 });
  }
  let body: {
    assignment_id?: number;
    content?: string;
    time_spent_sec?: number;
    edit_count?: number;
    paste_count?: number;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 400 });
  }

  const aid = Number(body.assignment_id);
  const content = (body.content ?? "").trim();
  if (!aid || !content) {
    return NextResponse.json({ error: "Thiếu dữ liệu" }, { status: 400 });
  }

  const a = db
    .prepare(
      "SELECT id, title, prompt, learning_objectives, rubric, min_words FROM assignments WHERE id = ?",
    )
    .get(aid) as AssignmentRow | undefined;
  if (!a) {
    return NextResponse.json({ error: "Không tìm thấy bài tập" }, { status: 404 });
  }

  const wordCount = content.split(/\s+/).filter(Boolean).length;
  if (wordCount < a.min_words) {
    return NextResponse.json(
      { error: `Bài tối thiểu ${a.min_words} từ, hiện ${wordCount}` },
      { status: 400 },
    );
  }

  const exists = db
    .prepare("SELECT id FROM submissions WHERE assignment_id=? AND user_id=?")
    .get(aid, user.id);
  if (exists) {
    return NextResponse.json(
      { error: "Bạn đã nộp bài này rồi" },
      { status: 409 },
    );
  }

  const condition = user.experiment_condition ?? "control";

  const subResult = db
    .prepare(
      `INSERT INTO submissions (assignment_id, user_id, content, time_spent_sec, edit_count, paste_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      aid,
      user.id,
      content,
      Math.max(0, Number(body.time_spent_sec) || 0),
      Math.max(0, Number(body.edit_count) || 0),
      Math.max(0, Number(body.paste_count) || 0),
    );
  const submissionId = Number(subResult.lastInsertRowid);

  logEvent(user.id, "assignment_submit", aid, {
    submission_id: submissionId,
    word_count: wordCount,
    time_spent_sec: body.time_spent_sec,
    edit_count: body.edit_count,
    paste_count: body.paste_count,
    condition,
  });

  // Sinh feedback
  const ctx =
    condition === "personalized"
      ? loadPersonalizationContext(user.id)
      : { studentName: "", learningStyle: null, srl: null };

  try {
    const { result, raw } = await generateFeedback({
      assignmentTitle: a.title,
      assignmentPrompt: a.prompt,
      learningObjectives: a.learning_objectives,
      rubric: a.rubric,
      studentAnswer: content,
      condition,
      studentName: ctx.studentName,
      learningStyle: ctx.learningStyle,
      srl: ctx.srl,
      behavioralHints: {
        timeSpentSec: Number(body.time_spent_sec) || 0,
        editCount: Number(body.edit_count) || 0,
        pasteCount: Number(body.paste_count) || 0,
        wordCount,
      },
    });

    db.prepare(
      `INSERT INTO ai_feedbacks (submission_id, condition, raw_response,
        feed_up, feed_back_task, feed_back_process, feed_back_self_reg,
        feed_forward, metacog_prompt, score)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      submissionId,
      condition,
      raw,
      result.feed_up,
      result.feed_back_task,
      result.feed_back_process,
      result.feed_back_self_reg,
      result.feed_forward,
      result.metacog_prompt,
      result.score,
    );

    return NextResponse.json({ ok: true, submission_id: submissionId });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Lỗi không xác định";
    // Vẫn lưu submission, đánh dấu pending để giảng viên có thể xử lý thủ công
    return NextResponse.json(
      {
        ok: true,
        submission_id: submissionId,
        warning: `Sinh phản hồi AI thất bại: ${message}. Bài đã được lưu.`,
      },
      { status: 202 },
    );
  }
}
