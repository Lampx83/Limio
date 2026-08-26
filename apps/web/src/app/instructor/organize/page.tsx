import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { CalendarCheck, FlaskConical, Zap } from "lucide-react";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Trang chọn hình thức tổ chức.
 *
 * Chỉ ba thẻ, không danh sách: mỗi hình thức có trang riêng gồm hai phần — tạo
 * mới và lịch sử các lần CÙNG DẠNG. Tách lịch sử theo hình thức vì ba loại cần
 * thấy thông tin khác nhau; gộp lại thì bảng phải cõng mọi cột cho mọi kiểu.
 *
 * Ba hình thức khác nhau trên HAI trục độc lập, không phải một:
 *   mục đích (đo học sinh / đo câu hỏi) × quy mô (một buổi / nhiều ca)
 * Nên chúng nằm ở hai cột riêng — ExamPurpose và ExamSessionScale — thay vì
 * nhồi chung một enum.
 */
export default async function OrganizePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/organize");

  const courseCount = await prisma.course.count({
    where: { instructors: { some: { userId: session.user.id } } },
  });

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
            href="/instructor/organize/quick"
            icon={<Zap className="h-5 w-5 shrink-0 text-emerald-600" />}
            title="Link thi nhanh"
            blurb="Khảo sát, điểm danh, kiểm tra nhanh trên lớp."
            detail="Chọn gói đề, đặt thời lượng. Mở ngay, đóng khi bạn bấm."
            lead
          />
          <OptionCard
            href="/instructor/organize/field-test"
            icon={<FlaskConical className="h-5 w-5 shrink-0 text-blue-600" />}
            title="Thử nghiệm câu hỏi"
            blurb="Đo chất lượng câu trước khi kết nạp vào ngân hàng."
            detail="Chở được câu chưa kết nạp. Không hiện đáp án, để không đốt câu hỏi."
          />
          <OptionCard
            href="/instructor/organize/formal"
            icon={<CalendarCheck className="h-5 w-5 shrink-0 text-amber-600" />}
            title="Kỳ thi chính thức"
            blurb="Nhiều ca, nhiều phòng, có giám thị."
            detail="Chia ca, xếp phòng, cấp mã từng thí sinh, in phiếu."
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
    </main>
  );
}

/**
 * Cả thẻ LÀ cái nút, không có nút con bên trong.
 *
 * Trước đây mỗi thẻ có thêm một <span> giả dạng nút ("Mở buổi thi", "Bắt
 * đầu"…). Nhưng cả thẻ vốn đã là <Link> tới cùng đường dẫn, nên cái nút đó
 * không đi đâu khác — nó chỉ làm người dùng tưởng phải nhắm trúng nó, trong
 * khi bấm chỗ nào trong thẻ cũng được. Ba lựa chọn giờ là ba nút to.
 */
function OptionCard({
  href,
  icon,
  title,
  blurb,
  detail,
  lead,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  blurb: string;
  detail: string;
  lead?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group flex flex-col rounded-lg border bg-white p-4 transition-shadow hover:shadow-md ${
        lead ? "border-emerald-400" : "border-default"
      }`}
    >
      {icon}
      <h2 className="mt-2 flex items-center gap-1.5 text-base font-semibold">
        {title}
        {/* Mũi tên là dấu hiệu duy nhất còn lại rằng thẻ bấm được. Nó nhích
            khi rê chuột nên không cần viền nút để trông "bấm được". */}
        <span
          aria-hidden="true"
          className="text-faint transition-transform group-hover:translate-x-0.5"
        >
          →
        </span>
      </h2>
      <p className="mt-1 text-sm text-ink-2">{blurb}</p>
      <p className="mt-2 text-caption text-faint">{detail}</p>
    </Link>
  );
}
