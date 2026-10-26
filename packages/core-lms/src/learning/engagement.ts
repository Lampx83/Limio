import { z } from "zod";
import { prisma, type Prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "./events";
import { LearningError } from "./lessons";

/**
 * B11 — ghi lại người học thực sự ở lại bài bao lâu.
 *
 * Trước đây hệ thống chỉ biết một người **đã mở** bài (`lesson.viewed`, bắn
 * đúng một lần lúc trang tải xong). Nghĩa là em đọc kỹ hai mươi phút và em mở
 * bài rồi bỏ đó nhìn giống hệt nhau trong dữ liệu — và với một thực nghiệm về
 * phản hồi cá nhân hoá thì đó là biến quan trọng bị thiếu.
 *
 * Ba lựa chọn đáng nói:
 *
 * 1. **Máy khách cộng dồn, máy chủ nhận phần chênh.** Mỗi nhịp gửi lên số giây
 *    *thêm* kể từ nhịp trước, không phải tổng. Mất một nhịp thì mất đúng nhịp
 *    đó, chứ không làm sai lệch tổng — và không cần máy chủ nhớ trạng thái
 *    phiên.
 * 2. **Chỉ đếm lúc tab thực sự hiện.** Một tab mở suốt đêm không phải là tám
 *    tiếng học bài. Con số nào cũng đo được, nhưng con số sai thì tệ hơn không
 *    có, vì nó vẫn được đem đi phân tích.
 * 3. **Event chỉ phát khi khép một lượt ngồi đọc, không phát theo từng nhịp.**
 *    `LearningEvent` là append-only; một lớp 60 người đọc 30 phút mà mỗi nhịp
 *    một dòng thì sinh ra hàng nghìn dòng nói đúng những gì một dòng tổng kết
 *    đã nói.
 *
 * `videoRanges` (thêm sau, cho báo cáo chi tiết hơn) đi theo triết lý khác hẳn
 * ba điểm trên: máy khách gửi **toàn bộ tập đoạn đã gộp của lượt hiện tại**
 * mỗi nhịp (không phải phần chênh), máy chủ hợp với những gì đã lưu rồi gộp
 * lại. Hợp đoạn là phép idempotent — gửi trùng hay gửi lại một nhịp đã mất
 * trước đó đều không sai lệch gì, khác hẳn `activeSecDelta` (mất một nhịp là
 * mất thật). Không dùng chung triết lý phần-chênh cho ranges vì tua đi tua
 * lại sinh nhiều đoạn nhỏ, cộng dồn kiểu chênh lệch sẽ nhân đôi phần chồng
 * lấn.
 *
 * `pdf` (đo đọc PDF theo trang, docs/tieu-chi/doc-pdf-theo-trang.md) quay lại
 * triết lý phần-chênh của `activeSecDelta`: giây dừng ở một trang là đại lượng
 * cộng được, không có "hợp" nào để gộp. Giá phải trả giống `activeSec` — mất
 * một nhịp là mất đúng phần giây của nhịp đó. `maxScrollPct` không thay được:
 * PDF phân trang một canvas, lật hết 40 trang mà không cuộn trang bài thì vẫn
 * ghi 0%. Số liệu nằm ở cột `pdfPages`, KHÔNG phát event mỗi lần lật trang
 * (append-only); `lesson.engaged` chỉ mang một bản tóm tắt cộng dồn.
 */

/** Chặn trên cho phần chênh mỗi nhịp — xem giải thích ở `MAX_DELTA_SEC`. */
export const MAX_DELTA_SEC = 120;
/** Trần số đoạn gửi lên một nhịp — chống payload phình vì client lỗi/cố ý. */
const MAX_RANGES_PER_BEAT = 40;

const VideoRange = z.tuple([z.number().min(0), z.number().min(0)]);

/** Trần số PDF và số trang gửi lên một nhịp — cùng lý do với MAX_RANGES_PER_BEAT. */
const MAX_PDFS_PER_BEAT = 10;
const MAX_PDF_PAGES_PER_BEAT = 60;
/** Trần số trang một PDF — chặn khai totalPages vô lý làm phình cột JSON. */
const MAX_PDF_TOTAL_PAGES = 2000;

/**
 * Một trang được coi là "đã xem" khi tổng thời gian dừng đạt ngưỡng này. Giây
 * thô vẫn được lưu, nên đổi ngưỡng khi phân tích không phải đo lại.
 */
export const PDF_PAGE_VIEWED_MIN_SEC = 3;

const PdfViewInput = z.object({
  contentItemId: z.string().min(1).max(64),
  totalPages: z.number().int().min(1).max(MAX_PDF_TOTAL_PAGES),
  /** Trang đang mở lúc gửi nhịp — "điểm dừng", khác trang xem lâu nhất. */
  lastPage: z.number().int().min(1).max(MAX_PDF_TOTAL_PAGES),
  /** Phần chênh: số giây dừng ở mỗi trang kể từ nhịp trước. Khoá là số trang. */
  dwellSec: z
    .record(z.string().regex(/^\d{1,4}$/), z.number().int().min(1).max(MAX_DELTA_SEC))
    .refine((r) => Object.keys(r).length <= MAX_PDF_PAGES_PER_BEAT, {
      message: "too_many_pages",
    }),
});
export type PdfViewInput = z.infer<typeof PdfViewInput>;

export interface PdfItemState {
  totalPages: number;
  lastPage: number;
  /** { "<trang>": tổng giây } */
  dwellSec: Record<string, number>;
}
/** { [contentItemId]: PdfItemState } — hình dạng của cột `LessonEngagement.pdfPages`. */
export type PdfPagesState = Record<string, PdfItemState>;

/**
 * Cộng phần chênh của một nhịp vào số liệu đã lưu. Hàm thuần: không sửa đối
 * tượng đầu vào. Bỏ mục không thuộc `validItemIds` (khối của bài khác, khối
 * không phải PDF, id bịa) và bỏ trang ngoài 1..totalPages — nhưng KHÔNG ném
 * lỗi: một mục hỏng không đáng làm mất thời gian đọc, cuộn của cả nhịp.
 * Trả về null chỉ khi chưa có gì để lưu, để cột giữ nguyên nghĩa "chưa từng đo".
 */
export function mergePdfPages(
  existing: PdfPagesState | null,
  incoming: PdfViewInput[],
  validItemIds: ReadonlySet<string>,
): PdfPagesState | null {
  const out: PdfPagesState = {};
  for (const [id, st] of Object.entries(existing ?? {})) {
    out[id] = { ...st, dwellSec: { ...st.dwellSec } };
  }

  for (const v of incoming) {
    if (!validItemIds.has(v.contentItemId)) continue;
    const accepted: Array<[string, number]> = [];
    for (const [key, sec] of Object.entries(v.dwellSec)) {
      const page = Number(key);
      if (page >= 1 && page <= v.totalPages && sec > 0) accepted.push([String(page), sec]);
    }
    if (accepted.length === 0) continue;

    const cur = out[v.contentItemId] ?? { totalPages: v.totalPages, lastPage: 1, dwellSec: {} };
    for (const [key, sec] of accepted) {
      cur.dwellSec[key] = (cur.dwellSec[key] ?? 0) + sec;
    }
    cur.totalPages = v.totalPages;
    cur.lastPage = Math.max(1, Math.min(v.totalPages, v.lastPage));
    out[v.contentItemId] = cur;
  }

  return Object.keys(out).length > 0 ? out : null;
}

export interface PdfSummary {
  contentItemId: string;
  totalPages: number;
  /** Số trang có tổng thời gian dừng ≥ PDF_PAGE_VIEWED_MIN_SEC. */
  pagesViewed: number;
  lastPage: number;
}

/** Tóm tắt cộng dồn cho payload `lesson.engaged` và cho báo cáo. */
export function summarizePdfPages(state: PdfPagesState | null): PdfSummary[] {
  return Object.entries(state ?? {}).map(([contentItemId, st]) => {
    let pagesViewed = 0;
    for (const [key, sec] of Object.entries(st.dwellSec)) {
      // Trang vượt totalPages còn sót lại khi giảng viên thay PDF bằng bản ngắn hơn.
      if (Number(key) <= st.totalPages && sec >= PDF_PAGE_VIEWED_MIN_SEC) pagesViewed += 1;
    }
    return { contentItemId, totalPages: st.totalPages, pagesViewed, lastPage: st.lastPage };
  });
}

export const EngagementInput = z.object({
  /** Số giây tab hiện, tính từ lần gửi trước. */
  activeSecDelta: z.number().int().min(0).max(MAX_DELTA_SEC),
  /** Cuộn sâu nhất trong lượt này, 0–100. */
  scrollPct: z.number().int().min(0).max(100),
  /** Tỉ lệ video cao nhất trong lượt này, 0–100. */
  videoPct: z.number().int().min(0).max(100),
  /** Nhịp đầu tiên của một lượt ngồi đọc — dùng để đếm sessionCount. */
  sessionStart: z.boolean().default(false),
  /** Nhịp cuối — người học rời bài. Chỉ nhịp này mới phát event. */
  sessionEnd: z.boolean().default(false),
  /** Các đoạn [start,end] giây đã xem thật trong lượt này, đã gộp phía client. */
  videoRanges: z.array(VideoRange).max(MAX_RANGES_PER_BEAT).optional(),
  /** Vị trí phát (giây) tại lần timeupdate gần nhất — "điểm dừng". */
  videoPositionSec: z.number().min(0).optional(),
  /** Đo đọc PDF theo trang — phần chênh kể từ nhịp trước. Thiếu = máy khách cũ hoặc bài không PDF. */
  pdf: z.array(PdfViewInput).max(MAX_PDFS_PER_BEAT).optional(),
});

export interface EngagementResult {
  activeSec: number;
  maxScrollPct: number;
  maxVideoPct: number;
  sessionCount: number;
}

/**
 * Gộp hai tập đoạn [start,end] thành một tập không chồng lấn, sắp theo start.
 * Chỉ gộp khi thật sự chồng lấn hoặc chạm nhau (start ≤ end đoạn trước) — độ
 * "liên tục" của việc phát video do phía client tự quyết khi dựng đoạn, hàm
 * này chỉ hợp các đoạn đã có, không đoán thêm.
 */
export function mergeVideoRanges(
  existing: Array<[number, number]>,
  incoming: Array<[number, number]>,
): Array<[number, number]> {
  const all = [...existing, ...incoming]
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s)
    .map(([s, e]) => [Math.max(0, s), e] as [number, number])
    .sort((a, b) => a[0] - b[0]);

  const merged: Array<[number, number]> = [];
  for (const [s, e] of all) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) {
      if (e > last[1]) last[1] = e;
    } else {
      merged.push([s, e]);
    }
  }
  return merged;
}

/** Tổng số giây thật sự được phủ bởi tập đoạn (đã gộp). */
export function videoRangesCoverageSec(ranges: Array<[number, number]>): number {
  return ranges.reduce((sum, [s, e]) => sum + (e - s), 0);
}

export async function recordLessonEngagement(
  userId: string,
  lessonId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<EngagementResult> {
  const parsed = EngagementInput.safeParse(rawInput);
  if (!parsed.success) {
    throw new LearningError("validation_failed", parsed.error.flatten());
  }
  const input = parsed.data;

  const lesson = await db.lesson.findUnique({
    where: { id: lessonId },
    select: {
      id: true,
      module: { select: { courseId: true } },
      contentItems: {
        where: { type: { in: ["video", "pdf"] } },
        select: { id: true, type: true, payload: true },
      },
    },
  });
  if (!lesson) throw new LearningError("lesson_not_found");
  const videoItem = lesson.contentItems.find((c) => c.type === "video");
  const courseId = lesson.module.courseId;

  // Ghi danh là điều kiện: giảng viên xem thử bài của chính mình không nên
  // trộn vào số liệu về người học.
  const enrolled = await db.enrollment.findUnique({
    where: { userId_courseId: { userId, courseId } },
    select: { id: true },
  });
  if (!enrolled) throw new LearningError("not_enrolled");

  const existing = await db.lessonEngagement.findUnique({
    where: { userId_lessonId: { userId, lessonId } },
    select: {
      activeSec: true,
      maxScrollPct: true,
      maxVideoPct: true,
      sessionCount: true,
      videoRanges: true,
      pdfPages: true,
    },
  });

  const mergedRanges = input.videoRanges
    ? mergeVideoRanges(
        (existing?.videoRanges as Array<[number, number]> | null) ?? [],
        input.videoRanges,
      )
    : ((existing?.videoRanges as Array<[number, number]> | null) ?? undefined);

  const existingPdf = (existing?.pdfPages as PdfPagesState | null) ?? null;
  const nextPdf = input.pdf
    ? mergePdfPages(
        existingPdf,
        input.pdf,
        new Set(lesson.contentItems.filter((c) => c.type === "pdf").map((c) => c.id)),
      )
    : existingPdf;

  const next = {
    activeSec: (existing?.activeSec ?? 0) + input.activeSecDelta,
    maxScrollPct: Math.max(existing?.maxScrollPct ?? 0, input.scrollPct),
    maxVideoPct: Math.max(existing?.maxVideoPct ?? 0, input.videoPct),
    sessionCount: (existing?.sessionCount ?? 0) + (input.sessionStart ? 1 : 0),
  };

  await db.lessonEngagement.upsert({
    where: { userId_lessonId: { userId, lessonId } },
    create: {
      userId,
      lessonId,
      courseId,
      ...next,
      videoRanges: mergedRanges ?? undefined,
      lastVideoPositionSec: input.videoPositionSec,
      pdfPages: (nextPdf as unknown as Prisma.InputJsonValue | null) ?? undefined,
    },
    update: {
      ...next,
      ...(mergedRanges !== undefined ? { videoRanges: mergedRanges } : {}),
      ...(input.videoPositionSec !== undefined
        ? { lastVideoPositionSec: input.videoPositionSec }
        : {}),
      ...(nextPdf && nextPdf !== existingPdf
        ? { pdfPages: nextPdf as unknown as Prisma.InputJsonValue }
        : {}),
    },
  });

  // Một lượt ngồi đọc khép lại — giờ mới có gì đáng kể vào lịch sử. Bỏ qua
  // lượt 0 giây: mở nhầm rồi đóng ngay không phải một lần học.
  if (input.sessionEnd && input.activeSecDelta > 0) {
    const durationSec = (videoItem?.payload as { durationSec?: number } | undefined)?.durationSec;
    const pdf = summarizePdfPages(nextPdf);
    const coverageSec = mergedRanges ? videoRangesCoverageSec(mergedRanges) : undefined;
    await emitEvent(
      userId,
      LearningEventType.LessonEngaged,
      {
        lessonId,
        activeSec: input.activeSecDelta,
        scrollPct: input.scrollPct,
        videoPct: input.videoPct,
        totalActiveSec: next.activeSec,
        ...(coverageSec !== undefined ? { videoCoverageSec: coverageSec } : {}),
        ...(coverageSec !== undefined && durationSec
          ? { videoCoveragePct: Math.round(Math.min(1, coverageSec / durationSec) * 100) }
          : {}),
        // Cộng dồn như totalActiveSec; vắng mặt (không phải mảng rỗng) khi chưa đo được trang nào.
        ...(pdf.length > 0 ? { pdf } : {}),
      },
      { courseId },
      db,
    );
  }

  return next;
}

export interface LessonEngagementRow {
  userId: string;
  lessonId: string;
  activeSec: number;
  maxScrollPct: number;
  maxVideoPct: number;
  sessionCount: number;
  lastSeenAt: Date;
  /** Đoạn video đã xem thật, đã gộp. Null nếu bài không có video hoặc chưa nhận range nào. */
  videoRanges: Array<[number, number]> | null;
  /** Vị trí phát gần nhất — điểm dừng. */
  lastVideoPositionSec: number | null;
  /** Thời gian dừng theo trang của từng PDF. Null = chưa từng đo (không phải "không xem"). */
  pdfPages: PdfPagesState | null;
}

/** Toàn bộ số liệu tương tác của một khoá — dùng cho bảng phân tích và export. */
export async function getCourseEngagement(
  courseId: string,
  db: PrismaClient = prisma,
): Promise<LessonEngagementRow[]> {
  const rows = await db.lessonEngagement.findMany({
    where: { courseId },
    select: {
      userId: true,
      lessonId: true,
      activeSec: true,
      maxScrollPct: true,
      maxVideoPct: true,
      sessionCount: true,
      lastSeenAt: true,
      videoRanges: true,
      lastVideoPositionSec: true,
      pdfPages: true,
    },
    orderBy: [{ lessonId: "asc" }, { userId: "asc" }],
  });
  return rows.map((r) => ({
    ...r,
    videoRanges: r.videoRanges as Array<[number, number]> | null,
    pdfPages: r.pdfPages as PdfPagesState | null,
  }));
}
