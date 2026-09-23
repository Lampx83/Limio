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
export default async function OrganizePage({
  searchParams,
}: {
  searchParams: { examId?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/organize");

  const courseCount = await prisma.course.count({
    where: { instructors: { some: { userId: session.user.id } } },
  });

  // Đi từ một đề sang đây (nút "Tổ chức thi" ở danh sách đề) thì mang đề đó theo:
  // hiện tên đề, và các trang con chọn sẵn nó — giảng viên khỏi phải tìm lại.
  // Chỉ nhận đề thuộc khoá mình dạy; id lạ thì bỏ qua như không có.
  const examId = typeof searchParams.examId === "string" ? searchParams.examId : null;
  const exam = examId
    ? await prisma.exam.findFirst({
        where: {
          id: examId,
          kind: "written",
          course: { instructors: { some: { userId: session.user.id } } },
        },
        select: { id: true, title: true, status: true, courseId: true },
      })
    : null;
  const q = exam ? `?examId=${exam.id}` : "";

  return (
    <main>
      <h1 className="text-2xl font-bold">Tổ chức thi</h1>
      <p className="mt-1 text-body text-faint">
        Bạn định tổ chức kiểu gì? Chọn xong hệ thống lo phần còn lại.
      </p>

      {exam && (
        <div className="mt-4 banner-info px-4 py-3 text-sm" data-testid="organize-exam-context">
          Đang tổ chức cho đề: <strong>{exam.title}</strong>.{" "}
          {exam.status === "published" ? (
            "Chọn hình thức bên dưới — đề này sẽ được chọn sẵn."
          ) : (
            <>
              Đề chưa publish nên chưa mở thi được.{" "}
              <Link
                href={`/instructor/courses/${exam.courseId}/exams/${exam.id}`}
                className="font-semibold underline"
              >
                Publish đề trước →
              </Link>
            </>
          )}
        </div>
      )}

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
            href={`/instructor/organize/quick${q}`}
            icon={<Zap className="h-5 w-5" aria-hidden />}
            title="Link thi nhanh"
            blurb="Khảo sát, điểm danh, kiểm tra nhanh trên lớp."
            detail="Chọn đề thi, đặt thời lượng. Mở ngay, đóng khi bạn bấm."
            lead
          />
          <OptionCard
            href={`/instructor/organize/field-test${q}`}
            icon={<FlaskConical className="h-5 w-5" aria-hidden />}
            title="Thử nghiệm câu hỏi"
            blurb="Đo chất lượng câu trước khi kết nạp vào ngân hàng."
            detail="Chở được câu chưa kết nạp. Không hiện đáp án, để không đốt câu hỏi."
          />
          <OptionCard
            href={`/instructor/organize/formal${q}`}
            icon={<CalendarCheck className="h-5 w-5" aria-hidden />}
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
      className={`group flex flex-col rounded-xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
        lead ? "border-brand-400" : "border-default"
      }`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
        {icon}
      </span>
      <h2 className="mt-3 flex items-center gap-1.5 text-base font-semibold">
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
