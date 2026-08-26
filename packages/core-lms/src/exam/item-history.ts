import { prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditBank } from "./bank";
import { ExamError } from "./types";

/**
 * Hồ sơ chất lượng của một câu hỏi qua từng lần đem ra dùng.
 *
 * `BankQuestionStats` gộp mọi lần dùng thành MỘT số bình quân có trọng số, nên
 * một câu tệ ở đợt đầu (p = 0,25) rồi sửa lại tốt ở đợt sau (p = 0,58) hiện ra
 * là 0,41 — con số không mô tả bất kỳ phiên bản nào từng tồn tại, và che mất
 * đúng điều cần thấy. Ở đây giữ nguyên chuỗi, và chỉ gộp TRONG CÙNG một phiên
 * bản câu chữ.
 */

/**
 * Ngưỡng cỡ mẫu. Với n = 30, khoảng tin cậy 95% của độ phân biệt rộng tới
 * ±0,33 — đo được D = 0,3 thì giá trị thật nằm đâu đó từ 0 tới 0,6, tức không
 * kết luận được gì. Nên tách ngưỡng cho từng chỉ số thay vì dùng chung một con
 * số dễ dãi.
 */
export const TRIAL_MIN_N = {
  /** Đủ để nói câu quá dễ hay quá khó. */
  pValue: 30,
  /** Đủ để bắt câu đảo dấu (D âm). */
  discrimination: 100,
  /** Đủ để so trước và sau khi sửa câu chữ. */
  compareVersions: 300,
} as const;

export interface ItemTrialPoint {
  examId: string;
  examTitle: string;
  examPurpose: "assessment" | "field_test";
  versionId: string;
  versionNumber: number;
  roundId: string | null;
  roundTitle: string | null;
  attemptCount: number;
  correctCount: number;
  /** -1 khi chưa đủ mẫu để tính (sentinel của tầng analytics). */
  pValue: number;
  /** -2 khi chưa đủ mẫu. */
  discrimination: number;
  computedAt: string;
}

export interface ItemVersionRollup {
  versionId: string;
  versionNumber: number;
  trials: number;
  /** Cộng dồn cỡ mẫu qua các đợt CÙNG phiên bản — cách duy nhất để đủ n. */
  totalAttempts: number;
  totalCorrect: number;
  /** Tính lại từ tổng, không phải trung bình của các p. */
  pValue: number | null;
  /** Trung bình có trọng số theo cỡ mẫu. Null khi chưa đủ. */
  discrimination: number | null;
  enoughForP: boolean;
  enoughForD: boolean;
}

export interface ItemTrialHistory {
  bankQuestionId: string;
  prompt: string;
  status: "draft" | "published" | "archived";
  currentVersionNumber: number | null;
  points: ItemTrialPoint[];
  rollups: ItemVersionRollup[];
  /** Gộp của phiên bản hiện hành — căn cứ để quyết định kết nạp. */
  currentRollup: ItemVersionRollup | null;
}

export async function getItemTrialHistory(
  actorUserId: string,
  bankQuestionId: string,
  db: PrismaClient = prisma,
): Promise<ItemTrialHistory> {
  const q = await db.bankQuestion.findUnique({
    where: { id: bankQuestionId },
    select: {
      id: true,
      bankId: true,
      prompt: true,
      status: true,
      versions: {
        select: { id: true, versionNumber: true },
        orderBy: { versionNumber: "desc" },
      },
    },
  });
  if (!q) throw new ExamError("bank_question_not_found");
  await assertCanEditBank(actorUserId, q.bankId, db);

  const versionNumberById = new Map(q.versions.map((v) => [v.id, v.versionNumber]));
  const currentVersion = q.versions[0] ?? null;

  const rows = await db.itemTrialStat.findMany({
    where: { bankQuestionId },
    orderBy: { computedAt: "asc" },
    select: {
      examId: true,
      bankQuestionVersionId: true,
      roundId: true,
      attemptCount: true,
      correctCount: true,
      pValue: true,
      discrimination: true,
      computedAt: true,
    },
  });

  const examIds = [...new Set(rows.map((r) => r.examId))];
  const exams = await db.exam.findMany({
    where: { id: { in: examIds } },
    select: { id: true, title: true, purpose: true },
  });
  const examById = new Map(exams.map((e) => [e.id, e]));

  const roundIds = [...new Set(rows.map((r) => r.roundId).filter(Boolean))] as string[];
  const rounds = roundIds.length
    ? await db.examRound.findMany({
        where: { id: { in: roundIds } },
        select: { id: true, title: true },
      })
    : [];
  const roundById = new Map(rounds.map((r) => [r.id, r]));

  const points: ItemTrialPoint[] = rows.map((r) => ({
    examId: r.examId,
    examTitle: examById.get(r.examId)?.title ?? "(đề đã xoá)",
    examPurpose: (examById.get(r.examId)?.purpose ?? "assessment") as
      | "assessment"
      | "field_test",
    versionId: r.bankQuestionVersionId,
    versionNumber: versionNumberById.get(r.bankQuestionVersionId) ?? 0,
    roundId: r.roundId,
    roundTitle: r.roundId ? (roundById.get(r.roundId)?.title ?? null) : null,
    attemptCount: r.attemptCount,
    correctCount: r.correctCount,
    pValue: r.pValue,
    discrimination: r.discrimination,
    computedAt: r.computedAt.toISOString(),
  }));

  // Gộp theo phiên bản. Cộng dồn bản trước và sau khi sửa là vô nghĩa — đó
  // chính là lỗi BankQuestionStats đang mắc.
  const byVersion = new Map<string, ItemTrialPoint[]>();
  for (const p of points) {
    if (!byVersion.has(p.versionId)) byVersion.set(p.versionId, []);
    byVersion.get(p.versionId)!.push(p);
  }

  const rollups: ItemVersionRollup[] = [...byVersion.entries()].map(
    ([versionId, ps]) => {
      const totalAttempts = ps.reduce((s, p) => s + p.attemptCount, 0);
      const totalCorrect = ps.reduce((s, p) => s + p.correctCount, 0);
      const enoughForP = totalAttempts >= TRIAL_MIN_N.pValue;
      const enoughForD = totalAttempts >= TRIAL_MIN_N.discrimination;

      // D trung bình có trọng số, bỏ qua các đợt chưa tính được.
      const usable = ps.filter((p) => p.discrimination !== -2 && p.attemptCount > 0);
      const dW = usable.reduce((s, p) => s + p.attemptCount, 0);
      const discrimination =
        enoughForD && dW > 0
          ? usable.reduce((s, p) => s + p.discrimination * p.attemptCount, 0) / dW
          : null;

      return {
        versionId,
        versionNumber: ps[0]!.versionNumber,
        trials: ps.length,
        totalAttempts,
        totalCorrect,
        // Tính lại từ tổng chứ không lấy trung bình của các p — trung bình của
        // tỉ lệ trên các cỡ mẫu khác nhau không phải tỉ lệ của tổng.
        pValue: enoughForP ? totalCorrect / totalAttempts : null,
        discrimination,
        enoughForP,
        enoughForD,
      };
    },
  );
  rollups.sort((a, b) => b.versionNumber - a.versionNumber);

  return {
    bankQuestionId: q.id,
    prompt: q.prompt,
    status: q.status,
    currentVersionNumber: currentVersion?.versionNumber ?? null,
    points,
    rollups,
    currentRollup:
      rollups.find((r) => r.versionId === currentVersion?.id) ?? null,
  };
}

export interface PromotionReadiness {
  ready: boolean;
  /** Lý do chưa đủ điều kiện — rỗng khi ready. */
  blockers: string[];
  rollup: ItemVersionRollup | null;
}

/**
 * Bài kiểm tra trước cửa kết nạp: câu này đã đủ bằng chứng để vào kho chưa.
 *
 * CẢNH BÁO chứ không chặn cứng — xem promoteBankQuestion(). Giáo viên có căn
 * cứ mà thống kê không thấy, và chặn cứng thường chỉ đẩy người ta đi đường vòng.
 */
export function assessPromotionReadiness(
  h: ItemTrialHistory,
): PromotionReadiness {
  const r = h.currentRollup;
  const blockers: string[] = [];

  if (!r || r.totalAttempts === 0) {
    return {
      ready: false,
      blockers: ["Chưa có lượt làm nào với phiên bản hiện tại."],
      rollup: r,
    };
  }
  if (!r.enoughForP) {
    blockers.push(
      `Mới ${r.totalAttempts} lượt làm; cần ít nhất ${TRIAL_MIN_N.pValue} để nói được về độ khó.`,
    );
  }
  if (!r.enoughForD) {
    blockers.push(
      `Cần ít nhất ${TRIAL_MIN_N.discrimination} lượt để độ phân biệt đáng tin (đang có ${r.totalAttempts}).`,
    );
  }
  if (r.discrimination !== null && r.discrimination < 0) {
    blockers.push(
      `Độ phân biệt âm (${r.discrimination.toFixed(2)}) — học sinh giỏi làm sai nhiều hơn học sinh yếu. Nên xem lại đáp án.`,
    );
  }
  if (r.pValue !== null && (r.pValue < 0.2 || r.pValue > 0.95)) {
    blockers.push(
      `Độ khó ${r.pValue.toFixed(2)} nằm ngoài khoảng dùng được (0,2–0,95).`,
    );
  }

  return { ready: blockers.length === 0, blockers, rollup: r };
}

/**
 * Kết nạp một câu vào kho — bọc publishBankQuestion() bằng bằng chứng.
 *
 * Hàm gốc chỉ đổi trạng thái, không hỏi gì không xem gì. Ở đây bắt buộc phải
 * có `reason` khi bằng chứng chưa đủ, để sáu tháng sau còn biết vì sao câu đó
 * được cho vào kho.
 */
export async function promoteBankQuestion(
  actorUserId: string,
  bankQuestionId: string,
  opts: { reason?: string } = {},
  db: PrismaClient = prisma,
): Promise<{ promoted: boolean; readiness: PromotionReadiness }> {
  const history = await getItemTrialHistory(actorUserId, bankQuestionId, db);
  const readiness = assessPromotionReadiness(history);

  if (!readiness.ready && !opts.reason?.trim()) {
    throw new ExamError("validation_failed", {
      reason: "promotion_needs_justification",
      blockers: readiness.blockers,
      message:
        "Câu này chưa đủ bằng chứng. Vẫn kết nạp được, nhưng phải ghi lý do.",
    });
  }

  const { publishBankQuestion } = await import("./bank");
  await publishBankQuestion(actorUserId, bankQuestionId, db);

  if (opts.reason?.trim()) {
    // editNote là changelog free-text sẵn có trên câu hỏi.
    const note = `[Kết nạp dù chưa đủ bằng chứng] ${opts.reason.trim()}`;
    await db.bankQuestion.update({
      where: { id: bankQuestionId },
      data: { editNote: note, reviewStatus: "approved", reviewedByUserId: actorUserId, reviewedAt: new Date() },
    });
  } else {
    await db.bankQuestion.update({
      where: { id: bankQuestionId },
      data: { reviewStatus: "approved", reviewedByUserId: actorUserId, reviewedAt: new Date() },
    });
  }

  return { promoted: true, readiness };
}
