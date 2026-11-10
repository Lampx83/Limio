import Link from "next/link";
import { resolveVanDapJoinCode } from "@feedbackme/core-lms";
import { normalizeJoinCode } from "@/lib/joinCode";

export const dynamic = "force-dynamic";

/**
 * Phòng vào của Limio Vấn đáp (Mốc 2 sẽ thay phần "chờ" bằng phòng thi thật: bộ điều khiển hỏi theo dàn, ghi hình
 * lượt hỏi–đáp). Hiện mới tra đúng mã và chỉ hiện thông tin học viên ĐƯỢC thấy: tên đề, thời lượng, ngôn ngữ.
 * Dàn câu hỏi, đáp án mong đợi và đoạn nguồn không bao giờ có ở trang này (xem getVanDapPublicView).
 */
export default async function VanDapJoinPage({ params }: { params: { code: string } }) {
  const code = normalizeJoinCode(params.code);
  const join = await resolveVanDapJoinCode(code);

  if (!join) {
    return (
      <main className="mx-auto max-w-md px-4 py-12 text-center">
        <h1 className="text-h2">Không tìm thấy buổi vấn đáp</h1>
        <p className="mt-2 text-sm text-faint">Mã này không khớp buổi vấn đáp nào. Hãy kiểm tra lại mã với giảng viên.</p>
        <Link href="/learn" className="btn btn-secondary btn-sm mt-4 inline-block">
          Về trang học
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-md px-4 py-12 text-center">
      <h1 className="text-h2 break-words">{join.exam.title}</h1>
      <p className="mt-1 text-sm text-faint">Vấn đáp · {join.exam.durationMin} phút</p>
      {join.isOpen ? (
        <p className="banner-info mt-6 text-sm" role="status">
          Buổi vấn đáp đã sẵn sàng nhưng phòng thi của bản này đang được hoàn thiện. Thầy/cô sẽ báo khi có thể vào thi.
        </p>
      ) : (
        <p className="banner-warning mt-6 text-sm" role="status">
          Buổi vấn đáp này đã đóng.
        </p>
      )}
    </main>
  );
}
