import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { Radio } from "lucide-react";
import {
  canEditCourse,
  getRoomScope,
  liveCountsByRoom,
} from "@feedbackme/core-lms";
import RoomGrid, { type RoomCell } from "./RoomGrid";
import { auth } from "@/lib/auth";
import LiveDashboard from "./LiveDashboard";

export const dynamic = "force-dynamic";

/**
 * Quá số này thì KHÔNG dựng lưới thẻ, mà bắt chọn phòng.
 *
 * 150 là chỗ mắt người hết quét nổi, và cũng là chỗ chi phí bắt đầu vô ích:
 * mỗi thẻ là 40 chấm tiến độ, và mỗi người xem phải nghe toàn bộ luồng sự
 * kiện của đề. Mở nhầm cả ca 200 người không được phép làm treo máy ai.
 */
const LIVE_CARD_LIMIT = 150;

/**
 * Màn giám sát. `?sessionId=<uuid>` giới hạn vào MỘT ca thi.
 *
 * Không có sessionId thì giữ nguyên hành vi cũ: mọi bài làm của gói đề trong
 * 24h. Có sessionId thì bỏ cửa sổ 24h — ca đã bó tập bài làm rồi, và giáo
 * viên cần xem lại ca đã đóng từ tuần trước chứ không chỉ ca đang chạy.
 */
export default async function ExamLiveDashboardPage({
  params,
  searchParams,
}: {
  params: { id: string; examId: string };
  searchParams?: { sessionId?: string; roomId?: string };
}) {
  const sessionId = searchParams?.sessionId ?? null;
  const roomId = searchParams?.roomId ?? null;
  const session = await auth();
  if (!session?.user?.id)
    redirect(
      `/signin?callbackUrl=/instructor/courses/${params.id}/exams/${params.examId}/live`,
    );

  const exam = await prisma.exam.findUnique({
    where: { id: params.examId },
    select: { id: true, courseId: true, title: true, durationMin: true, accessMode: true },
  });
  if (!exam || exam.courseId !== params.id) notFound();

  const isInstructor = await canEditCourse(session.user.id, exam.courseId);
  const scope = isInstructor
    ? null
    : await getRoomScope(session.user.id, exam.id);
  if (!isInstructor && (!scope || scope.proctorRoomIds.length === 0)) {
    redirect("/instructor/exam-sessions");
  }

  // Restrict initial seed to candidates of proctor's rooms (the SSE stream
  // applies the same filter; this just keeps the SSR snapshot consistent).
  // Thu hẹp theo PHÒNG. Hai nguồn ràng buộc, giao nhau:
  //   - giám thị chỉ được xem phòng mình coi (như trước);
  //   - bất kỳ ai cũng có thể tự chọn một phòng qua ?roomId=.
  //
  // Trước đây chỉ giám thị mới bị thu hẹp, còn giảng viên thấy TẤT CẢ. Với
  // kỳ thi 5 ca × 4 phòng × 50 người, giảng viên mở màn này là nạp 1000 bài
  // và nghe toàn bộ luồng sự kiện của đề — không ai đọc nổi 1000 thẻ, mà máy
  // thì gánh đủ.
  const roomIds: string[] | null =
    !isInstructor && scope
      ? roomId
        ? scope.proctorRoomIds.filter((r) => r === roomId)
        : scope.proctorRoomIds
      : roomId
        ? [roomId]
        : null;

  let proctorCandidateIds: string[] | null = null;
  if (roomIds !== null) {
    const cands = await prisma.examCandidate.findMany({
      where: { examId: exam.id, roomId: { in: roomIds } },
      select: { id: true },
    });
    proctorCandidateIds = cands.map((c) => c.id);
  }

  // Ordered list of questions — passed to client so every attempt row uses the
  // same dot positions (so instructor can scan "câu 3 chưa ai làm" easily).
  const questions = await prisma.examQuestion.findMany({
    where: { examId: exam.id },
    select: { id: true, orderInExam: true },
    orderBy: { orderInExam: "asc" },
  });
  const totalQuestions = questions.length;

  // Initial list — only attempts started in the last 24h.
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const attempts = await prisma.examAttempt.findMany({
    where: {
      examId: exam.id,
      ...(sessionId
        ? {
            OR: [
              { sessionId },
              { sessionId: null, candidate: { sessionId } },
            ],
          }
        : { startedAt: { gt: since } }),
      ...(proctorCandidateIds !== null
        ? { candidateId: { in: proctorCandidateIds } }
        : {}),
    },
    select: {
      id: true,
      userId: true,
      candidateId: true,
      candidateDisplayName: true,
      status: true,
      startedAt: true,
      submittedAt: true,
      durationSec: true,
      resumeCount: true,
      lastHeartbeatAt: true,
      user: { select: { displayName: true, email: true } },
      candidate: { select: { displayName: true, accessCode: true } },
      // Ô đỏ trên thẻ giám sát là thứ giáo viên đọc như "đáng ngờ", nên
      // KHÔNG đếm network_lost: mất wifi là chuyện hạ tầng, không phải hành
      // vi của thí sinh. Sự cố mạng vẫn được ghi và vẫn hiện đủ ở trang chi
      // tiết từng bài làm — chỉ là không thổi phồng con số cảnh báo.
      _count: {
        select: {
          incidents: { where: { type: { not: "network_lost" } } },
        },
      },
    },
    orderBy: { startedAt: "asc" },
  });

  // Câu nào đã trả lời — GỘP TRONG SQL, một dòng mỗi bài làm.
  //
  // Trước đây đi kèm findMany bằng `answers: { select: { questionId: true } }`.
  // Với 500 thí sinh × 40 câu, Prisma dựng 20.000 object rồi Next đóng gói
  // 20.000 chuỗi UUID xuống trình duyệt — đo được ~1,4 MB chỉ riêng ID. Bản
  // thân truy vấn chỉ mất 6,6 ms; chi phí nằm ở phần dựng object và tải về.
  //
  // Gộp lại còn 502 dòng, và trả về THỨ TỰ CÂU (số nguyên) thay vì UUID: giao
  // diện chỉ cần biết chấm thứ i sáng hay tối, không cần biết id của nó.
  const attemptIds = attempts.map((a) => a.id);
  // Hai chỗ phải đi đường vòng, cả hai đều là giới hạn của $queryRaw:
  //
  // 1. `string_agg(...)` chứ không `array_agg(...)` — Prisma không ánh xạ
  //    được int4[] của Postgres qua $queryRaw.
  // 2. Danh sách id truyền thành MỘT chuỗi rồi tách bằng string_to_array,
  //    chứ không `IN (${Prisma.join(ids)})`. Dưới bundler của Next,
  //    Prisma.join bị đối xử như một giá trị đơn (jsonb) thay vì danh sách
  //    tham số, và câu lệnh chết với "operator does not exist: text = jsonb".
  //    Một tham số text thì không dính bẫy đó. UUID không chứa dấu phẩy nên
  //    tách lại luôn đúng.
  const answeredRows =
    attemptIds.length === 0
      ? []
      : await prisma.$queryRaw<{ attemptId: string; orders: string }[]>`
          SELECT an."attemptId", string_agg(q."orderInExam"::text, ',') AS orders
          FROM "ExamAnswer" an
          JOIN "ExamQuestion" q ON q.id = an."questionId"
          WHERE an."attemptId" = ANY(string_to_array(${attemptIds.join(",")}, ','))
          GROUP BY an."attemptId"
        `;
  const answeredByAttempt = new Map(
    answeredRows.map((r) => [
      r.attemptId,
      r.orders ? r.orders.split(",").map(Number) : [],
    ]),
  );

  const examAccessMode = exam.accessMode ?? "authenticated";

  // Ca thi đang xem — để đầu trang nói rõ đây là ca nào và còn mở hay đã đóng.
  const run = sessionId
    ? await prisma.examSession.findFirst({
        where: { id: sessionId, examId: exam.id },
        select: { id: true, openCode: true, status: true, timingMode: true },
      })
    : null;
  const runClosed = run !== null && run.status !== "open";

  const initial = attempts.map((a) => {
    const subjectType: "user" | "open" | "assigned" = a.userId
      ? "user"
      : a.candidate?.accessCode
        ? "assigned"
        : examAccessMode === "assigned_code"
          ? "assigned"
          : "open";
    return {
    attemptId: a.id,
    userId: a.userId,
    userName:
      a.user?.displayName ??
      a.user?.email ??
      a.candidate?.displayName ??
      a.candidateDisplayName ??
      "(no name)",
    subjectType,
    status: a.status,
    startedAt: a.startedAt.getTime(),
    expiresAt: a.startedAt.getTime() + a.durationSec * 1000,
    submittedAt: a.submittedAt?.getTime() ?? null,
    answeredIdx: answeredByAttempt.get(a.id) ?? [],
    totalQuestions,
    incidentCount: a._count.incidents,
    lastSeenAt:
      a.lastHeartbeatAt?.getTime() ??
      a.submittedAt?.getTime() ??
      a.startedAt.getTime(),
    resumeCount: a.resumeCount,
    };
  });

  // Also expose exam.accessMode to the page so we can fetch it for the
  // server-render select above (just used for derivation, no extra query).

  // Phạm vi quá rộng mà chưa chọn phòng → hiện lưới PHÒNG thay vì 200 thẻ.
  const tooMany = attempts.length > LIVE_CARD_LIMIT && roomId === null;
  let roomCells: RoomCell[] = [];
  if (tooMany && run) {
    const [rooms, counts] = await Promise.all([
      prisma.examRoom.findMany({
        where: { sessionId: run.id },
        select: {
          id: true,
          name: true,
          proctor: { select: { displayName: true, email: true } },
        },
        orderBy: { orderIndex: "asc" },
      }),
      liveCountsByRoom(run.id),
    ]);
    roomCells = rooms.map((r) => {
      const c = counts.get(r.id);
      return {
        id: r.id,
        name: r.name,
        proctorName: r.proctor?.displayName ?? r.proctor?.email ?? null,
        started: c?.started ?? 0,
        submitted: c?.submitted ?? 0,
        inProgress: c?.inProgress ?? 0,
      };
    });
  }

  return (
    <main>
      <Link
        href={run ? "/instructor/organize" : `/instructor/courses/${exam.courseId}/exams/${exam.id}`}
        className="text-sm text-blue-600 hover:underline"
      >
        {run ? "← Tổ chức thi" : "← Quay lại bài thi"}
      </Link>
      <div className="mt-3 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Radio
              className={`h-5 w-5 shrink-0 ${runClosed ? "text-faint" : "text-red-500"}`}
            />
            {runClosed ? "Xem lại" : "Live"} — {exam.title}
            {run?.openCode && (
              <span className="font-mono text-base font-semibold tracking-widest text-faint">
                {run.openCode}
              </span>
            )}
          </h1>
          <p className="mt-1 text-sm text-faint">
            {run
              ? runClosed
                ? "Ca thi đã đóng — đây là toàn bộ bài làm của ca, giữ nguyên để xem lại."
                : "Theo dõi realtime bài làm của riêng ca này."
              : "Theo dõi trạng thái sinh viên đang thi realtime (24h gần nhất)"}
          </p>
        </div>
        <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700">
          Thời lượng: {exam.durationMin} phút · Tổng {totalQuestions} câu
        </span>
      </div>

      {tooMany && run ? (
        <RoomGrid
          courseId={exam.courseId}
          examId={exam.id}
          sessionId={run.id}
          rooms={roomCells}
          reason={`Ca này có ${attempts.length} lượt thi — quá nhiều để theo dõi từng người trên một màn hình. Chọn phòng để xem chi tiết.`}
        />
      ) : (
      <LiveDashboard
        examId={exam.id}
        sessionId={run?.id}
        roomId={roomId ?? undefined}
        initial={initial}
        questions={questions.map((q) => ({ id: q.id, order: q.orderInExam }))}
      />
      )}
    </main>
  );
}
