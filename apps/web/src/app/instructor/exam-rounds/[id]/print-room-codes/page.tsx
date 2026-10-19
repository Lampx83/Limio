import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canViewExamRound } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import PrintRoomCodesView, {
  loadPrintPages,
} from "../../../exam-sessions/PrintRoomCodesView";

export const dynamic = "force-dynamic";

/**
 * In tất cả mã ca thi + mã phòng thi của 1 đợt thi (đợt cũ). Kỳ thi mới không
 * thuộc đợt — in theo ca ở /instructor/exam-sessions/[sessionId]/print-room-codes.
 */
export default async function PrintRoundRoomCodesPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await auth();
  if (!session?.user?.id)
    redirect(`/signin?callbackUrl=/instructor/exam-rounds/${params.id}/print-room-codes`);
  const userId = session.user.id;

  const round = await prisma.examRound.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      code: true,
      course: { select: { id: true, title: true } },
    },
  });
  if (!round) notFound();
  if (!(await canViewExamRound(userId, round.id))) notFound();
  // Đợt tự sinh cho đề độc lập không gắn khoá học — in mã theo lớp thi luôn
  // cần khoá thật.
  if (!round.course) notFound();

  const pages = await loadPrintPages({
    sessionWhere: { roundId: round.id },
    courseId: round.course.id,
  });

  return (
    <PrintRoomCodesView
      header={{ courseTitle: round.course.title, title: round.title, code: round.code }}
      backHref={`/instructor/exam-rounds/${round.id}`}
      backLabel="Quay lại đợt thi"
      emptyText="Đợt thi này chưa có phòng thi nào."
      pages={pages}
    />
  );
}
