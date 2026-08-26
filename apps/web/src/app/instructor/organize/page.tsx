import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { CalendarCheck, FlaskConical, Zap } from "lucide-react";
import { listExamRuns } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import ExamRunsList from "./ExamRunsList";

export const dynamic = "force-dynamic";

/**
 * Nhà của BUỔI THI — danh từ thứ hai bên cạnh gói đề.
 *
 * Ban đầu tôi dựng đây thành bệ phóng thuần, với lập luận "không được thành cái
 * kho, kẻo lại có hai lối vào cùng một đối tượng". Lập luận đó đúng KHI buổi
 * thi chưa có danh tính riêng. Sau khi tách gói đề khỏi buổi thi, buổi thi có
 * thời lượng riêng, giờ riêng, mã riêng, thí sinh riêng — và không có nhà. Nên
 * danh sách các lần thi ở đây không phải bản sao của mục "Đề thi".
 *
 * Phân công để hai nơi không giẫm chân nhau:
 *   - Đề thi → tab Kết quả  = "gói đề này chạy ra sao" (gộp mọi lần)
 *   - Ở đây                 = "buổi hôm đó ra sao" (từng lần chạy)
 *
 * Ba lựa chọn tạo mới vẫn theo nguyên tắc "hỏi ý định": hỏi trước chỉ đúng khi
 * hai luồng cho ra form khác hẳn nhau. Với MỤC ĐÍCH thì không (hệ thống tự suy
 * từ trạng thái câu hỏi); với QUY MÔ thì có — link nhanh cần 3 ô, kỳ thi cuối
 * kỳ cần đợt, ca, phòng, giám thị, danh sách thí sinh.
 */
export default async function OrganizePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/organize");

  const courseCount = await prisma.course.count({
    where: { instructors: { some: { userId: session.user.id } } },
  });
  const runs = await listExamRuns(session.user.id);

  return (
    <main className="mx-auto max-w-4xl px-4 py-6 lg:px-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold">
        <CalendarCheck className="h-6 w-6 shrink-0 text-amber-600" />
        Tổ chức thi
      </h1>
      <p className="mt-1 text-body text-faint">
        Bạn định tổ chức kiểu gì? Chọn xong hệ thống lo phần còn lại.
      </p>

      {courseCount === 0 ? (
        <div className="mt-6 banner-info px-4 py-3 text-sm">
          Bạn cần là giảng viên của một khoá học trước đã.{" "}
          <Link href="/instructor/courses/new" className="underline">
            Tạo khoá đầu tiên
          </Link>
          .
        </div>
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <OptionCard
            href="/instructor/exams/quick?purpose=assessment"
            icon={<Zap className="h-5 w-5 shrink-0 text-emerald-600" />}
            title="Link thi nhanh"
            blurb="Khảo sát, điểm danh, kiểm tra nhanh trên lớp."
            detail="Đặt tên, thêm câu hỏi, phát link. Mở ngay, đóng khi bạn bấm."
            cta="Tạo link"
            lead
          />
          <OptionCard
            href="/instructor/exams/quick?purpose=field_test"
            icon={<FlaskConical className="h-5 w-5 shrink-0 text-blue-600" />}
            title="Thử nghiệm câu hỏi"
            blurb="Đo chất lượng câu trước khi kết nạp vào ngân hàng."
            detail="Chở được câu chưa kết nạp. Không hiện đáp án, để không đốt câu hỏi."
            cta="Mở đợt thử"
          />
          <OptionCard
            href="/instructor/exams/new"
            icon={<CalendarCheck className="h-5 w-5 shrink-0 text-amber-600" />}
            title="Kỳ thi cuối kỳ"
            blurb="Nhiều ca, nhiều phòng, có giám thị."
            detail="Chia ca, xếp phòng, cấp mã từng thí sinh, in phiếu."
            cta="Bắt đầu"
          />
        </div>
      )}

      <p className="mt-4 text-caption text-faint">
        Nội dung câu hỏi soạn ở mục{" "}
        <Link href="/instructor/exams" className="underline">
          Đề thi
        </Link>
        ; ở đây quyết định chạy khi nào, bao lâu, ai vào.
      </p>

      {courseCount > 0 && <ExamRunsList runs={runs} />}
    </main>
  );
}

function OptionCard({
  href,
  icon,
  title,
  blurb,
  detail,
  cta,
  lead,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  blurb: string;
  detail: string;
  cta: string;
  lead?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col rounded-lg border bg-white p-4 transition-shadow hover:shadow-md ${
        lead ? "border-emerald-400" : "border-default"
      }`}
    >
      {icon}
      <h2 className="mt-2 text-base font-semibold">{title}</h2>
      <p className="mt-1 text-sm text-ink-2">{blurb}</p>
      <p className="mt-2 text-caption text-faint">{detail}</p>
      <span
        className={`mt-3 inline-block self-start rounded px-3 py-1 text-xs font-medium ${
          lead
            ? "bg-emerald-600 text-white"
            : "border border-default text-faint"
        }`}
      >
        {cta} →
      </span>
    </Link>
  );
}
