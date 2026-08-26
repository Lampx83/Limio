import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { CalendarCheck, FlaskConical, Zap } from "lucide-react";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Bệ phóng tổ chức thi — KHÔNG phải một cái kho.
 *
 * Màn hình này không có danh sách đề, không có tab, không giữ trạng thái. Nó
 * hỏi ý định rồi bàn giao; sau khi tạo, mọi thứ sống dưới bài thi.
 *
 * Ranh giới đó quan trọng: nếu ở đây mọc thêm "các đợt thi của tôi" thì ta lại
 * có hai lối vào cùng một đối tượng — đúng thứ đã đẻ ra hai lối tạo đề và hai
 * bản xuất điểm mà đợt thiết kế lại này vừa dọn.
 *
 * Vì sao có màn hình này dù nguyên tắc chung là "suy ra, đừng hỏi": hỏi trước
 * chỉ đúng khi hai luồng cho ra form khác hẳn nhau. Với MỤC ĐÍCH thì không —
 * cùng bộ trường, chỉ khác mặc định, nên hệ thống tự suy. Với QUY MÔ thì có:
 * link nhanh cần 3 ô, kỳ thi cuối kỳ cần đợt, ca, phòng, giám thị, danh sách
 * thí sinh.
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

      <p className="mt-6 text-caption text-faint">
        Cả ba đều tạo ra một bài thi. Sau khi tạo, bạn quản lý nó ở mục{" "}
        <Link href="/instructor/exams" className="underline">
          Đề thi
        </Link>
        .
      </p>
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
