import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import {
  assertCanEditCourse,
  CourseAuthzError,
  getCourseEngagement,
  videoRangesCoverageSec,
} from "@feedbackme/core-lms";
import { LearningEventType } from "@feedbackme/shared-types";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";
import { identityCols, learnerIndex } from "@/lib/researchExport";

export const runtime = "nodejs";

/**
 * B13 — một dòng cho mỗi cặp (người học × bài học): họ ở lại bài bao lâu, cuộn
 * tới đâu, xem được bao nhiêu phần video.
 *
 * Xuất cả những người CHƯA từng mở bài, dưới dạng dòng 0: thiếu dữ liệu và
 * "không đọc" là hai chuyện khác nhau, mà một bảng chỉ có người đã đọc thì
 * không phân biệt được — và sẽ đẩy mọi giá trị trung bình lên cao.
 */
export async function GET(
  _req: Request,
  { params }: { params: { courseId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await assertCanEditCourse(userId, params.courseId);
  } catch (err) {
    if (err instanceof CourseAuthzError) {
      return NextResponse.json(
        { error: err.code === "not_found" ? "course_not_found" : "forbidden" },
        { status: err.code === "not_found" ? 404 : 403 },
      );
    }
    throw err;
  }

  const course = await prisma.course.findUnique({
    where: { id: params.courseId },
    select: { slug: true },
  });
  if (!course) return NextResponse.json({ error: "course_not_found" }, { status: 404 });

  const [index, engagement, lessons, tutorEvents] = await Promise.all([
    learnerIndex(params.courseId),
    getCourseEngagement(params.courseId),
    prisma.lesson.findMany({
      where: { module: { courseId: params.courseId }, isHidden: false },
      select: {
        id: true,
        title: true,
        orderIndex: true,
        module: { select: { title: true, orderIndex: true } },
        // Chỉ để tính % phủ thật (đoạn đã xem / độ dài) — không dùng type
        // "video" nào khác nên không cần lọc thêm.
        contentItems: { where: { type: "video" }, select: { payload: true }, take: 1 },
      },
      orderBy: [{ module: { orderIndex: "asc" } }, { orderIndex: "asc" }],
    }),
    // B15 — số lượt hỏi trợ giảng AI, đếm từ dòng event chứ không từ bảng hội
    // thoại: hội thoại gộp theo cửa sổ 24 giờ nên đếm hội thoại sẽ đếm hụt.
    prisma.learningEvent.findMany({
      where: { courseId: params.courseId, eventType: LearningEventType.AiTutorAsked },
      select: { userId: true, payload: true },
    }),
  ]);

  const byPair = new Map(engagement.map((e) => [`${e.userId}:${e.lessonId}`, e]));

  const tutorTurns = new Map<string, number>();
  for (const e of tutorEvents) {
    const lid = (e.payload as { lessonId?: string } | null)?.lessonId;
    if (!e.userId || !lid) continue;
    const k = `${e.userId}:${lid}`;
    tutorTurns.set(k, (tutorTurns.get(k) ?? 0) + 1);
  }

  const out: Array<Record<string, unknown>> = [];
  for (const [uid, ref] of index) {
    for (const l of lessons) {
      const e = byPair.get(`${uid}:${l.id}`);
      const durationSec = (l.contentItems[0]?.payload as { durationSec?: number } | undefined)
        ?.durationSec;
      const coverageSec = e?.videoRanges ? videoRangesCoverageSec(e.videoRanges) : 0;
      out.push({
        ...identityCols(ref),
        Module: l.module.title,
        "Bài học": l.title,
        "Thứ tự bài": l.orderIndex + 1,
        "Đã mở bài?": e !== undefined,
        "Thời gian đọc (giây)": e?.activeSec ?? 0,
        "Cuộn sâu nhất (%)": e?.maxScrollPct ?? 0,
        "Xem video (%)": e?.maxVideoPct ?? 0,
        // Khác cột trên: đo đoạn THẬT SỰ đã xem (đã gộp, không đếm hai lần
        // đoạn xem lại), nên phân biệt được "xem liền một mạch" với "tua tới
        // cuối". Rỗng khi bài không có video.
        "Độ phủ video thực tế (%)":
          durationSec && durationSec > 0
            ? Math.round(Math.min(1, coverageSec / durationSec) * 100)
            : "",
        "Điểm dừng gần nhất (giây)": e?.lastVideoPositionSec ?? "",
        "Số lượt mở": e?.sessionCount ?? 0,
        "Số lượt hỏi trợ giảng AI": tutorTurns.get(`${uid}:${l.id}`) ?? 0,
        "Lần cuối vào": e?.lastSeenAt ?? "",
      });
    }
  }

  const day = new Date().toISOString().slice(0, 10);
  return csvResponse(`nghien-cuu-doc-bai-${course.slug}-${day}.csv`, out);
}
