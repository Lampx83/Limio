import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import {
  assertCanEditCourse,
  CourseAuthzError,
  getCourseEngagement,
  summarizePdfPages,
  videoRangesCoverageSec,
} from "@feedbackme/core-lms";
import { LearningEventType } from "@feedbackme/shared-types";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";
import { requireResearcher, identityCols, learnerIndex } from "@/lib/researchExport";

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
  const denied = await requireResearcher(userId);
  if (denied) return denied;
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
        // Video: để tính % phủ thật (đoạn đã xem / độ dài). PDF: để biết bài có
        // PDF nào, và tổng số trang làm mẫu số cho "số trang đã xem".
        contentItems: {
          where: { type: { in: ["video", "pdf"] } },
          select: { id: true, type: true, payload: true },
        },
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

  // Tổng số trang của từng PDF: số lớn nhất mà bất kỳ người học nào từng báo
  // (người chưa mở bài không báo gì, nhưng mẫu số phải như nhau cho cả lớp), rồi
  // mới tới số ghi sẵn trong khối. Thiếu cả hai -> để trống, không đoán.
  const pdfTotalPages = new Map<string, number>();
  for (const e of engagement) {
    for (const [id, st] of Object.entries(e.pdfPages ?? {})) {
      pdfTotalPages.set(id, Math.max(pdfTotalPages.get(id) ?? 0, st.totalPages));
    }
  }

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
      const durationSec = (
        l.contentItems.find((c) => c.type === "video")?.payload as
          | { durationSec?: number }
          | undefined
      )?.durationSec;
      const pdfItems = l.contentItems.filter((c) => c.type === "pdf");
      const pdfTotals = pdfItems.map(
        (c) =>
          pdfTotalPages.get(c.id) ??
          (c.payload as { totalPages?: number } | null)?.totalPages,
      );
      const pdfIds = new Set(pdfItems.map((c) => c.id));
      const pdfSummary = summarizePdfPages(e?.pdfPages ?? null).filter((p) =>
        pdfIds.has(p.contentItemId),
      );
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
        // Bài không có PDF -> rỗng, khác với "có PDF mà không xem" -> 0.
        "Số trang PDF đã xem":
          pdfItems.length === 0 ? "" : pdfSummary.reduce((n, p) => n + p.pagesViewed, 0),
        "Tổng số trang PDF":
          pdfItems.length === 0 || pdfTotals.some((t) => t === undefined)
            ? ""
            : pdfTotals.reduce<number>((n, t) => n + (t ?? 0), 0),
        // Chỉ rõ nghĩa khi bài có đúng một PDF; nhiều PDF thì không có "trang cuối" chung.
        "Trang PDF dừng gần nhất": pdfItems.length === 1 ? (pdfSummary[0]?.lastPage ?? "") : "",
        "Số lượt mở": e?.sessionCount ?? 0,
        "Số lượt hỏi trợ giảng AI": tutorTurns.get(`${uid}:${l.id}`) ?? 0,
        "Lần cuối vào": e?.lastSeenAt ?? "",
      });
    }
  }

  const day = new Date().toISOString().slice(0, 10);
  return csvResponse(`nghien-cuu-doc-bai-${course.slug}-${day}.csv`, out);
}
