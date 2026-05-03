import { db } from "./db";

export interface RecItem {
  type: "review" | "next" | "challenge" | "srl_alert";
  material_id?: number;
  material_title?: string;
  material_type?: "video" | "pdf" | "quiz";
  module_id?: number;
  module_title?: string;
  reason: string;
}

interface QuizResultRow {
  material_id: number;
  module_id: number;
  module_title: string;
  score: number;
  material_title: string;
}

interface MaterialRow {
  id: number;
  type: "video" | "pdf" | "quiz";
  title: string;
  module_id: number;
  module_title: string;
}

export function recommendNext(userId: number): RecItem[] {
  const recs: RecItem[] = [];

  // 1. Quiz điểm thấp (<60) → gợi ý ôn lại tài liệu cùng module
  const lowQuiz = db
    .prepare(
      `SELECT mi.material_id, lm.module_id, m.title AS module_title,
              mi.score, lm.title AS material_title
       FROM material_interactions mi
       JOIN learning_materials lm ON lm.id = mi.material_id
       JOIN modules m ON m.id = lm.module_id
       WHERE mi.user_id = ? AND lm.type = 'quiz' AND mi.score < 60
       ORDER BY mi.completed_at DESC LIMIT 1`,
    )
    .get(userId) as QuizResultRow | undefined;

  if (lowQuiz) {
    const reviewable = db
      .prepare(
        `SELECT lm.id, lm.type, lm.title, lm.module_id, m.title AS module_title
         FROM learning_materials lm
         JOIN modules m ON m.id = lm.module_id
         WHERE lm.module_id = ? AND lm.type IN ('video','pdf')
         ORDER BY lm.order_idx LIMIT 1`,
      )
      .get(lowQuiz.module_id) as MaterialRow | undefined;
    if (reviewable) {
      recs.push({
        type: "review",
        material_id: reviewable.id,
        material_title: reviewable.title,
        material_type: reviewable.type,
        module_id: reviewable.module_id,
        module_title: reviewable.module_title,
        reason: `Quiz "${lowQuiz.material_title}" mới đạt ${lowQuiz.score}/100 — ôn lại tài liệu nền sẽ giúp bạn vững hơn.`,
      });
    }
  }

  // 2. SRL thấp → cảnh báo nhẹ + gợi ý
  const srl = db
    .prepare(
      "SELECT score_total FROM srl_responses WHERE user_id = ? AND phase='pre'",
    )
    .get(userId) as { score_total: number } | undefined;
  if (srl && srl.score_total < 3) {
    recs.push({
      type: "srl_alert",
      reason: `SRL hiện tại ${srl.score_total}/5 (mức thấp). Hãy thử: trước khi học, viết ra 1 mục tiêu cụ thể; sau khi học, dành 2 phút tự kiểm tra hiểu bài.`,
    });
  }

  // 3. Học liệu kế tiếp chưa làm
  const nextItem = db
    .prepare(
      `SELECT lm.id, lm.type, lm.title, lm.module_id, m.title AS module_title
       FROM learning_materials lm
       JOIN modules m ON m.id = lm.module_id
       LEFT JOIN material_interactions mi ON mi.material_id = lm.id AND mi.user_id = ?
       WHERE mi.id IS NULL
       ORDER BY lm.module_id, lm.order_idx LIMIT 1`,
    )
    .get(userId) as MaterialRow | undefined;
  if (nextItem) {
    recs.push({
      type: "next",
      material_id: nextItem.id,
      material_title: nextItem.title,
      material_type: nextItem.type,
      module_id: nextItem.module_id,
      module_title: nextItem.module_title,
      reason: "Học liệu kế tiếp trong lộ trình.",
    });
  }

  // 3.5 Spaced repetition: quiz đã làm 3+ ngày trước với điểm <80 → ôn lại
  // Schedule: 1d sau lần đầu, 3d, 7d, 14d (Leitner box)
  const dueReview = db
    .prepare(
      `SELECT mi.material_id, lm.title, lm.module_id, m.title AS module_title, mi.score,
              mi.completed_at,
              CAST((julianday('now') - julianday(mi.completed_at)) AS INTEGER) AS days_since
       FROM material_interactions mi
       JOIN learning_materials lm ON lm.id = mi.material_id
       JOIN modules m ON m.id = lm.module_id
       WHERE mi.user_id = ?
         AND lm.type = 'quiz'
         AND mi.score < 80
         AND CAST((julianday('now') - julianday(mi.completed_at)) AS INTEGER) IN (1, 3, 7, 14)
       ORDER BY mi.completed_at DESC LIMIT 1`,
    )
    .get(userId) as
    | {
        material_id: number;
        title: string;
        module_id: number;
        module_title: string;
        score: number;
        days_since: number;
      }
    | undefined;
  if (dueReview) {
    recs.push({
      type: "review",
      material_id: dueReview.material_id,
      material_title: dueReview.title,
      material_type: "quiz",
      module_id: dueReview.module_id,
      module_title: dueReview.module_title,
      reason: `Spaced repetition: ${dueReview.days_since} ngày trước bạn đạt ${dueReview.score}/100 ở quiz này — ôn lại để củng cố trí nhớ dài hạn.`,
    });
  }

  // 4. Quiz điểm cao (>=80) → gợi ý làm quiz khó hơn
  const highQuiz = db
    .prepare(
      `SELECT mi.material_id, lm.module_id, lm.title AS material_title, mi.score
       FROM material_interactions mi
       JOIN learning_materials lm ON lm.id = mi.material_id
       WHERE mi.user_id = ? AND lm.type = 'quiz' AND mi.score >= 80
       ORDER BY mi.completed_at DESC LIMIT 1`,
    )
    .get(userId) as { material_id: number; module_id: number; material_title: string; score: number } | undefined;
  if (highQuiz) {
    const next = db
      .prepare(
        `SELECT lm.id, lm.type, lm.title, lm.module_id, m.title AS module_title
         FROM learning_materials lm
         JOIN modules m ON m.id = lm.module_id
         LEFT JOIN material_interactions mi ON mi.material_id = lm.id AND mi.user_id = ?
         WHERE lm.type = 'quiz' AND lm.module_id > ? AND mi.id IS NULL
         ORDER BY lm.module_id LIMIT 1`,
      )
      .get(userId, highQuiz.module_id) as MaterialRow | undefined;
    if (next) {
      recs.push({
        type: "challenge",
        material_id: next.id,
        material_title: next.title,
        material_type: next.type,
        module_id: next.module_id,
        module_title: next.module_title,
        reason: `Bạn vừa đạt ${highQuiz.score}/100 ở "${highQuiz.material_title}" — sẵn sàng cho thử thách quiz tiếp theo!`,
      });
    }
  }

  return recs.slice(0, 3);
}
