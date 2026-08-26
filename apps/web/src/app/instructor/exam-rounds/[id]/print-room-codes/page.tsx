import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canViewExamRound } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import PrintAutoFire, { PrintButton } from "../sessions/[sessionId]/rooms/[roomId]/print/PrintAutoFire";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

/**
 * In tất cả mã ca thi + mã phòng thi của 1 đợt thi, mỗi phòng 1 trang A5 để
 * phát cho giám thị đọc cho thí sinh.
 */
export default async function PrintRoundRoomCodesPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id)
    redirect(
      `/signin?callbackUrl=/instructor/exam-rounds/${params.id}/print-room-codes`,
    );
  const userId = session.user.id;

  const round = await prisma.examRound.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      code: true,
      opensAt: true,
      closesAt: true,
      course: { select: { id: true, title: true, slug: true } },
    },
  });
  if (!round) notFound();
  if (!(await canViewExamRound(userId, round.id))) notFound();

  // Mã lớp thi & mã lớp học: liên kết theo CohortExamClass.code = Room.name
  // (theo workflow bulk-import-full hiện tại). Lookup 1 lần cho cả round.
  const examClasses = await prisma.cohortExamClass.findMany({
    where: { courseId: round.course.id },
    select: {
      code: true,
      cohort: { select: { name: true, code: true } },
    },
  });
  const examClassByCode = new Map(
    examClasses.map((ec) => [
      ec.code,
      {
        examClassCode: ec.code,
        cohortName: ec.cohort.name,
        cohortCode: ec.cohort.code,
      },
    ]),
  );

  const sessions = await prisma.examSession.findMany({
    where: { roundId: round.id },
    orderBy: [{ opensAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      title: true,
      code: true,
      openCode: true,
      accessMode: true,
      opensAt: true,
      closesAt: true,
      exam: { select: { title: true, openCode: true, accessMode: true } },
      rooms: {
        orderBy: [{ orderIndex: "asc" }, { createdAt: "asc" }],
        select: {
          id: true,
          name: true,
          orderIndex: true,
          locationNote: true,
          accessCode: true,
          isDefault: true,
          proctor: { select: { displayName: true } },
          _count: { select: { candidates: true } },
        },
      },
    },
  });

  // Flatten thành 1 list (1 entry = 1 trang in).
  const pages = sessions.flatMap((s) =>
    s.rooms.map((r) => ({
      session: {
        id: s.id,
        title: s.title,
        code: s.code,
        // Mã ca thi cho thí sinh: ưu tiên openCode của session (PR2.12), fallback openCode của exam (legacy).
        openCode: s.accessMode === "open_code" ? (s.openCode ?? s.exam.openCode) : null,
        accessMode: s.accessMode,
        opensAt: s.opensAt.toISOString(),
        closesAt: s.closesAt?.toISOString() ?? null,
        examTitle: s.exam.title,
      },
      room: {
        id: r.id,
        name: r.name,
        orderIndex: r.orderIndex,
        accessCode: r.accessCode,
        isDefault: r.isDefault,
        locationNote: r.locationNote,
        proctorName: r.proctor.displayName,
        candidateCount: r._count.candidates,
        // Mã lớp thi = Room.name nếu match CohortExamClass; mã lớp học = cohort.code
        examClassCode: examClassByCode.get(r.name)?.examClassCode ?? null,
        cohortName: examClassByCode.get(r.name)?.cohortName ?? null,
        cohortCode: examClassByCode.get(r.name)?.cohortCode ?? null,
      },
    })),
  );

  const totalRooms = pages.length;
  // Ghép từng cặp 2 phòng vào 1 tờ A4 landscape (2 phiếu A5 portrait cạnh nhau,
  // in xong cắt đôi). Nếu lẻ thì phiếu cuối đứng 1 mình, ô bên kia để trống.
  const sheets: Array<{ left: typeof pages[number]; right: typeof pages[number] | null }> = [];
  for (let i = 0; i < pages.length; i += 2) {
    sheets.push({ left: pages[i]!, right: pages[i + 1] ?? null });
  }

  return (
    <>
      <PrintAutoFire />
      {/* A4 landscape, 2 phiếu A5 / tờ — cắt đôi sau khi in */}
      <style>{`
        @page { size: A4 landscape; margin: 8mm; }
        @media print {
          .a4-sheet { page-break-after: always; }
          .a4-sheet:last-child { page-break-after: auto; }
          body { background: white; }
        }
      `}</style>

      <main className="mx-auto max-w-[281mm] text-slate-900">
        <div className="mb-4 flex items-center justify-between print:hidden">
          <Link
            href={`/instructor/exam-rounds/${round.id}`}
            className="text-sm text-blue-600 hover:underline"
          >
            ← Quay lại đợt thi
          </Link>
          <PrintButton />
        </div>
        <p className="mb-4 text-xs text-slate-500 print:hidden">
          {totalRooms} phòng thi · 2 phiếu A5 / tờ A4 (cắt đôi sau khi in). Mở dialog in (Ctrl+P) → chọn khổ A4 landscape.
        </p>

        {pages.length === 0 ? (
          <div className="rounded border border-default bg-white p-8 text-center text-sm text-faint print:hidden">
            Đợt thi này chưa có phòng thi nào.
          </div>
        ) : (
          sheets.map(({ left, right }, sheetIdx) => (
            <div
              key={`sheet-${sheetIdx}`}
              className="a4-sheet mb-8 grid grid-cols-2 gap-3 print:mb-0 print:gap-2"
            >
              {[left, right].map((slot, slotIdx) => {
                if (!slot) {
                  return (
                    <div
                      key={`empty-${sheetIdx}-${slotIdx}`}
                      className="border-l border-dashed border-slate-300 print:border-slate-400"
                    />
                  );
                }
                const { session: s, room: r } = slot;
                const idx = sheetIdx * 2 + slotIdx;
                return (
            <section
              key={`${s.id}:${r.id}`}
              className={`border border-slate-300 bg-white p-4 print:border-0 print:p-2 ${
                slotIdx === 1 ? "print:border-l print:border-dashed print:border-slate-400" : ""
              }`}
            >
              {/* Header */}
              <header className="border-b-2 border-slate-300 pb-2">
                <div className="text-[10px] uppercase tracking-wide text-slate-500">
                  {round.course.title}
                </div>
                <h1 className="mt-0.5 text-lg font-bold leading-tight">
                  {round.title}
                </h1>
                <div className="mt-1 text-[10px] text-slate-600">
                  Mã đợt: <span className="font-mono">{round.code}</span> ·{" "}
                  Phiếu {idx + 1}/{totalRooms}
                </div>
              </header>

              {/* Mã ca thi + Mã phòng — phần quan trọng nhất */}
              <div className="my-3 grid grid-cols-2 gap-3">
                <div className="rounded-lg border-2 border-blue-300 bg-blue-50 p-3 text-center">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-900">
                    Mã ca thi
                  </div>
                  <div className="mt-1 font-mono text-3xl font-bold tracking-[0.2em] text-blue-900">
                    {s.openCode ?? "—"}
                  </div>
                  <div className="mt-0.5 text-[9px] text-blue-800">
                    {s.openCode ? "Thí sinh dùng để vào /exam/<mã>" : "Ca thi không dùng mã"}
                  </div>
                </div>
                <div
                  className={`rounded-lg border-2 p-3 text-center ${
                    r.accessCode
                      ? "border-amber-300 bg-amber-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">
                    Mã phòng thi
                  </div>
                  <div className="mt-1 font-mono text-3xl font-bold tracking-[0.2em] text-amber-900">
                    {r.accessCode ?? "—"}
                  </div>
                  <div className="mt-0.5 text-[9px] text-amber-800">
                    {r.isDefault
                      ? "Phòng mặc định — TS không nhập mã sẽ vào phòng này"
                      : "Thí sinh bắt buộc nhập để vào đúng phòng"}
                  </div>
                </div>
              </div>

              {/* Thông tin phòng */}
              <table className="w-full border-collapse text-xs">
                <tbody>
                  <Row label="Phòng thi">
                    <span className="font-semibold">
                      {r.name}{" "}
                      <span className="font-normal text-slate-500">
                        (STT {r.orderIndex})
                      </span>
                    </span>
                    {r.isDefault && (
                      <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-medium text-amber-800">
                        ★ Mặc định
                      </span>
                    )}
                  </Row>
                  <Row label="Ca thi">
                    {s.title ?? s.code ?? "Ca thi"}
                  </Row>
                  <Row label="Đề thi">{s.examTitle}</Row>
                  <Row label="Thời gian">
                    {formatDate(s.opensAt)} → {s.closesAt ? formatDate(s.closesAt) : "đóng thủ công"}
                  </Row>
                  <Row label="Giám thị">{r.proctorName}</Row>
                  <Row label="Địa điểm">
                    {r.locationNote ?? <span className="text-slate-400">—</span>}
                  </Row>
                  <Row label="Thời gian thi">
                    {formatDate(s.opensAt)} → {s.closesAt ? formatDate(s.closesAt) : "đóng thủ công"}
                  </Row>
                  <Row label="Mã lớp thi">
                    {r.examClassCode ? (
                      <span className="font-mono">{r.examClassCode}</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Row>
                  <Row label="Mã lớp học">
                    {r.cohortCode ? (
                      <>
                        <span className="font-mono">{r.cohortCode}</span>
                        {r.cohortName && (
                          <span className="ml-1 text-slate-500">({r.cohortName})</span>
                        )}
                      </>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </Row>
                  <Row label="Số TS dự kiến">
                    {r.candidateCount > 0 ? `${r.candidateCount} thí sinh` : "—"}
                  </Row>
                </tbody>
              </table>

              {/* Hướng dẫn 5 bước cho giám thị tiến hành buổi thi */}
              <div className="mt-3 rounded border border-slate-300 bg-slate-50 p-2 text-[10px] leading-relaxed text-slate-700">
                <div className="mb-1 font-semibold text-slate-900">
                  Hướng dẫn giám thị tiến hành thi:
                </div>
                <ol className="list-decimal space-y-0.5 pl-4">
                  <li>
                    Giám thị mở{" "}
                    <span className="font-mono font-semibold">limio.vn/thi</span>
                    {" "}trên máy chiếu / máy giám thị.
                  </li>
                  <li>Gọi thí sinh vào phòng theo danh sách, ổn định chỗ ngồi.</li>
                  <li>
                    Đến giờ thi, yêu cầu thí sinh tự nhập{" "}
                    <strong>Mã dự thi</strong> ghi trên phiếu này (mã ca thi:{" "}
                    <span className="font-mono font-bold">{s.openCode ?? "—"}</span>).
                  </li>
                  <li>
                    Thí sinh nhập đầy đủ thông tin cá nhân, bao gồm{" "}
                    <strong>Mã phòng thi</strong>:{" "}
                    <span className="font-mono font-bold">
                      {r.accessCode ?? "(không có — bỏ trống)"}
                    </span>.
                  </li>
                  <li>
                    Bấm "Bắt đầu thi" và làm bài.{" "}
                    <strong>Nhắc thí sinh KHÔNG chuyển tab, KHÔNG tắt trình duyệt</strong>{" "}
                    — hệ thống ghi nhận toàn bộ hành vi và sẽ cảnh báo / đánh dấu vi phạm.
                  </li>
                </ol>
              </div>

              <footer className="mt-3 border-t border-slate-200 pt-2 text-[9px] text-slate-500">
                In ngày {formatDateTime(new Date())} · Mã đợt {round.code}
              </footer>
            </section>
                );
              })}
            </div>
          ))
        )}
      </main>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr className="border-b border-slate-200">
      <td className="w-24 py-1 pr-2 align-top text-slate-500">{label}</td>
      <td className="py-1">{children}</td>
    </tr>
  );
}

function formatDate(iso: string): string {
  return formatDateTime(iso);
}
