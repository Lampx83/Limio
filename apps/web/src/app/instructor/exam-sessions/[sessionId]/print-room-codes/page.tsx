import { notFound, redirect } from "next/navigation";
import {
  ExamError,
  getExamSession,
} from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import PrintRoomCodesView, { loadPrintPages } from "../../PrintRoomCodesView";

export const dynamic = "force-dynamic";

/** In mã ca thi + mã từng phòng của MỘT ca — mỗi phòng một phiếu A5. */
export default async function PrintSessionRoomCodesPage({
  params,
}: {
  params: { sessionId: string };
}) {
  const session = await auth();
  if (!session?.user?.id)
    redirect(
      `/signin?callbackUrl=/instructor/exam-sessions/${params.sessionId}/print-room-codes`,
    );
  const userId = session.user.id;

  let detail;
  try {
    // Kiểm tra quyền xem ca (theo đợt nếu có, ngược lại theo đề).
    detail = await getExamSession(userId, params.sessionId);
  } catch (e) {
    if (e instanceof ExamError) notFound();
    throw e;
  }

  const pages = await loadPrintPages({
    sessionWhere: { id: detail.id },
    courseId: detail.courseId,
  });

  return (
    <PrintRoomCodesView
      header={{
        courseTitle: detail.courseTitle ?? "",
        title: detail.title ?? detail.examTitle,
        code: null,
      }}
      backHref={`/instructor/exam-sessions/${detail.id}?tab=rooms`}
      backLabel="Quay lại ca thi"
      emptyText="Ca thi này chưa có phòng thi nào."
      pages={pages}
    />
  );
}
