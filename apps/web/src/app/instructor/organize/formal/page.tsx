import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@feedbackme/db";
import { listExamRuns } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import OrganizeLayout from "../OrganizeLayout";

export const dynamic = "force-dynamic";

/**
 * Kỳ thi chính thức — tạo mới + lịch sử các kỳ đã tổ chức.
 *
 * Phần tạo mới dẫn thẳng vào luồng cũ: đợt thi → ca thi (Tự do / Theo phòng)
 * → phòng thi. Đó là trình tự giáo viên đã quen và nó vốn đầy đủ; hai hình
 * thức kia mới là thứ cần rút gọn, không phải cái này.
 *
 * "Tự do" = ExamAccessMode.open_code (một mã chung cho cả ca).
 * "Theo phòng" = assigned_code (mã cấp riêng từng thí sinh, có xếp phòng).
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
      title="Kỳ thi chính thức"
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
            Kỳ thi chính thức đi theo trình tự đầy đủ, ba bước:
          </p>
          <ol className="mt-2 space-y-1 text-sm text-ink-2">
            <li>
              <strong>1. Đợt thi</strong> — kỳ nào, của học phần nào.
            </li>
            <li>
              <strong>2. Ca thi</strong> — mỗi ca chọn gói đề, giờ, và hình thức:{" "}
              <em>Tự do</em> (một mã chung cho cả ca) hoặc <em>Theo phòng</em>{" "}
              (mã cấp riêng từng thí sinh).
            </li>
            <li>
              <strong>3. Phòng thi</strong> — xếp phòng, gán giám thị, in phiếu.
            </li>
          </ol>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href="/instructor/exam-rounds"
              className="rounded bg-amber-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-amber-700"
            >
              Vào quản lý đợt thi →
            </Link>
            <Link
              href="/instructor/exams/new"
              className="rounded border border-default px-3 py-1.5 text-sm"
            >
              Soạn gói đề mới bằng trình hỗ trợ
            </Link>
          </div>
          <p className="mt-3 text-caption text-faint">
            Gói đề soạn trước ở mục Đề thi, rồi chọn lại khi tạo ca — cùng một
            gói dùng được cho nhiều ca.
          </p>
        </>
      )}
    </OrganizeLayout>
  );
}
