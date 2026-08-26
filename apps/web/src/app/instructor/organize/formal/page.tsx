import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@feedbackme/db";
import { listExamRuns } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import OrganizeLayout from "../OrganizeLayout";

export const dynamic = "force-dynamic";

/**
 * Kỳ thi cuối kỳ — tạo mới + lịch sử các kỳ đã tổ chức.
 *
 * Phần tạo mới vẫn dẫn sang wizard cũ. Wizard đó hiện TẠO ĐỀ MỚI chứ chưa cho
 * chọn gói đề có sẵn như hai hình thức kia — chỗ chưa nhất quán còn lại, cần
 * một đợt riêng vì nó đụng cả luồng blueprint và rút ngẫu nhiên.
 */
export default async function OrganizeFormalPage() {
  const session = await auth();
  if (!session?.user?.id)
    redirect("/signin?callbackUrl=/instructor/organize/formal");
  const userId = session.user.id;

  const [courseCount, runs] = await Promise.all([
    prisma.course.count({ where: { instructors: { some: { userId } } } }),
    listExamRuns(userId, { scale: "formal" }),
  ]);

  return (
    <OrganizeLayout
      title="Kỳ thi cuối kỳ"
      blurb="Nhiều ca, nhiều phòng, có giám thị. Chia ca, xếp phòng, cấp mã từng thí sinh, in phiếu."
      runs={runs}
      historyTitle="Các kỳ đã tổ chức"
      emptyHint="Chưa tổ chức kỳ thi nào."
    >
      {courseCount === 0 ? (
        <p className="text-sm">
          Bạn cần là giảng viên của một khoá học trước đã.{" "}
          <Link href="/instructor/courses/new" className="underline">
            Tạo khoá đầu tiên
          </Link>
          .
        </p>
      ) : (
        <>
          <p className="text-sm">
            Kỳ thi cuối kỳ đi qua trình tạo đề đầy đủ: chọn phạm vi nội dung,
            cấu hình độ khó, chia ca và phát đề.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/instructor/exams/new"
              className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
            >
              Bắt đầu kỳ thi mới →
            </Link>
            <Link
              href="/instructor/exam-rounds"
              className="rounded border border-default px-3 py-1.5 text-sm"
            >
              Quản lý đợt và ca
            </Link>
          </div>
          <p className="mt-3 text-caption text-faint">
            Trình này hiện tạo gói đề mới. Muốn dùng lại gói đề có sẵn thì mở
            bằng “Link thi nhanh” — cùng một gói chạy được nhiều lần thi.
          </p>
        </>
      )}
    </OrganizeLayout>
  );
}
