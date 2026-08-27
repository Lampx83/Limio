/**
 * Số liệu giám sát TỔNG HỢP cho cấp ca và cấp đợt.
 *
 * Màn giám sát chi tiết (lưới thẻ từng thí sinh) chỉ hợp với PHÒNG — 30–50
 * người là thứ mắt quét được. Lên tới ca (~200) hay đợt (1000+) thì không ai
 * đọc nổi từng thẻ, mà mỗi người xem lại phải nhận toàn bộ luồng sự kiện của
 * đề rồi tự lọc: đo được ~100 sự kiện/giây với 1000 thí sinh (heartbeat 10s),
 * nhân với số người đang xem.
 *
 * Hai cấp trên chỉ cần ĐẾM. Một truy vấn gộp mỗi 10–15 giây rẻ hơn nhiều so
 * với nghe luồng rồi tự cộng, và không phụ thuộc Redis còn nóng hay không.
 */

import { prisma, type PrismaClient } from "@feedbackme/db";

export interface LiveCount {
  /** Phòng thi, hoặc ca thi — tuỳ hàm gọi. */
  id: string;
  /** Đã bắt đầu làm, gồm cả người đang làm dở. */
  started: number;
  /** Đã nộp (mọi trạng thái cuối). */
  submitted: number;
  /** Đang làm dở ngay lúc này. */
  inProgress: number;
}

const FINAL = ["submitted", "auto_submitted", "graded"] as const;

function toCounts(
  rows: { key: string | null; status: string; n: number }[],
): Map<string, LiveCount> {
  const out = new Map<string, LiveCount>();
  for (const r of rows) {
    if (r.key === null) continue;
    const cur =
      out.get(r.key) ?? { id: r.key, started: 0, submitted: 0, inProgress: 0 };
    cur.started += r.n;
    if ((FINAL as readonly string[]).includes(r.status)) cur.submitted += r.n;
    if (r.status === "in_progress") cur.inProgress += r.n;
    out.set(r.key, cur);
  }
  return out;
}

/**
 * Đếm theo PHÒNG trong một ca.
 *
 * Bài làm về phòng qua ExamCandidate. Học viên vào bằng tài khoản đã ghi danh
 * không có candidate nên không thuộc phòng nào — chúng nằm ngoài bản đếm này,
 * đúng với thực tế: thi kiểu đó không xếp phòng.
 */
export async function liveCountsByRoom(
  sessionId: string,
  db: PrismaClient = prisma,
): Promise<Map<string, LiveCount>> {
  const rows = await db.$queryRaw<
    { key: string | null; status: string; n: bigint }[]
  >`
    SELECT c."roomId" AS key, a.status::text AS status, count(*) AS n
    FROM "ExamAttempt" a
    JOIN "ExamCandidate" c ON c.id = a."candidateId"
    WHERE c."sessionId" = ${sessionId}
    GROUP BY c."roomId", a.status
  `;
  return toCounts(rows.map((r) => ({ ...r, n: Number(r.n) })));
}

/**
 * Đếm theo CA trong một đợt.
 *
 * Lấy cả hai đường về ca — cột trên bài làm và đường qua thí sinh — vì bài làm
 * trước 26/08/2026 chưa có `ExamAttempt.sessionId`.
 */
export async function liveCountsBySession(
  roundId: string,
  db: PrismaClient = prisma,
): Promise<Map<string, LiveCount>> {
  const rows = await db.$queryRaw<
    { key: string | null; status: string; n: bigint }[]
  >`
    SELECT COALESCE(a."sessionId", c."sessionId") AS key,
           a.status::text AS status,
           count(*) AS n
    FROM "ExamAttempt" a
    LEFT JOIN "ExamCandidate" c ON c.id = a."candidateId"
    WHERE COALESCE(a."sessionId", c."sessionId") IN (
      SELECT id FROM "ExamSchedule" WHERE "roundId" = ${roundId}
    )
    GROUP BY 1, 2
  `;
  return toCounts(rows.map((r) => ({ ...r, n: Number(r.n) })));
}
