import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { canEditCourse, isUserEnrolled } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import SafeHtml from "@/components/SafeHtml";
import { plainToRichHtml } from "@/lib/richText";
import PrintTrigger from "@/components/lesson/PrintTrigger";

/**
 * Bản in của một bài học — để người học lưu thành PDF mang về.
 *
 * Không dựng PDF ở máy chủ: làm vậy phải nhét Chromium vào image (~300MB) và
 * bản PDF sẽ trôi khỏi nội dung mỗi lần giảng viên sửa bài. Trang này render
 * đúng nội dung đang có rồi để trình duyệt lo phần xuất file, nên bản tải về
 * luôn khớp với bản đang học.
 *
 * Quy tắc truy cập giống hệt trang học (`../page.tsx`): đã ghi danh, hoặc bài
 * cho xem thử, hoặc khoá công khai VÀ đã publish. Một trang in mở hơn trang
 * học là một đường vòng để lấy nội dung — nên hai nơi phải cùng một luật.
 */
/**
 * Tên tài liệu quyết định TÊN FILE mà trình duyệt gợi ý khi người dùng chọn
 * "Lưu thành PDF" — Chrome, Edge và Safari đều lấy từ <title>. Trước đây nó là
 * tên mặc định của ứng dụng, nên mọi bài tải về đều trùng tên và người học có
 * một thư mục toàn file giống hệt nhau.
 *
 * Bỏ ký tự "/" và ":" — macOS và Windows đều không cho chúng nằm trong tên file,
 * và trình duyệt sẽ tự thay bằng thứ gì đó xấu hơn nhiều.
 */
export async function generateMetadata({
  params,
}: {
  params: { slug: string; lessonId: string };
}): Promise<Metadata> {
  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    select: { title: true, module: { select: { course: { select: { title: true } } } } },
  });
  if (!lesson) return { title: "Bản in bài học" };
  const clean = (v: string) => v.replace(/[/:\\?%*|"<>]/g, "-").trim();
  return { title: `${clean(lesson.title)} — ${clean(lesson.module.course.title)}` };
}

export const dynamic = "force-dynamic";

export default async function LessonPrintPage({
  params,
  searchParams,
}: {
  params: { slug: string; lessonId: string };
  /** `gv=1`: bản in kèm ghi chú giảng viên, chỉ dựng cho người có quyền sửa khoá. */
  searchParams?: { gv?: string };
}) {
  const session = await auth();
  const userId = session?.user?.id ?? null;

  const lesson = await prisma.lesson.findUnique({
    where: { id: params.lessonId },
    include: {
      module: {
        include: {
          course: {
            select: {
              id: true,
              slug: true,
              title: true,
              status: true,
              publicAccess: true,
              priceCents: true,
            },
          },
        },
      },
      // Cùng bộ lọc với trang bài học: khối bị ẩn là khối giảng viên CỐ Ý giấu
      // (đáp án, ghi chú riêng). Trang in trước đây lấy hết, nên bấm
      // "In / Lưu PDF" là thấy đúng những thứ vừa giấu.
      //
      // Ghi chú giảng viên lấy về hết ở đây rồi lọc bên dưới theo quyền: bản in
      // của giảng viên (?gv=1) có ghi chú để cầm lên bục, bản của học viên thì
      // không.
      contentItems: { where: { isHidden: false }, orderBy: { orderIndex: "asc" } },
    },
  });

  if (!lesson || lesson.module.course.slug !== params.slug) notFound();
  if (lesson.isHidden) notFound();

  const course = lesson.module.course;
  const publiclyReadable = course.publicAccess && course.status === "published";
  const enrolled = userId ? await isUserEnrolled(userId, course.id) : false;
  const printUrl = `/learn/${params.slug}/lessons/${params.lessonId}/print`;

  if (!enrolled) {
    if (!userId) {
      if (!publiclyReadable) redirect(`/signin?callbackUrl=${printUrl}`);
    } else if (!lesson.previewable && !publiclyReadable) {
      const paid = course.priceCents !== null && course.priceCents > 0;
      redirect(`/catalog/${params.slug}${paid ? "?paywall=1" : ""}`);
    }
  }

  // Ghi chú chỉ đi vào bản in khi CẢ HAI đúng: người xem có quyền sửa khoá, và
  // họ chủ động xin bản có ghi chú. Thiếu một trong hai thì lọc sạch.
  const canEdit = userId ? await canEditCourse(userId, course.id) : false;
  const withNotes = canEdit && searchParams?.gv === "1";
  const printItems = lesson.contentItems.filter(
    (c) => c.type !== "teacher_note" || withNotes,
  );

  const printedAt = new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "long",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date());

  return (
    <main className="mx-auto max-w-3xl px-6 py-8 print:max-w-none print:px-0 print:py-0">
      <PrintTrigger backHref={`/learn/${params.slug}/lessons/${params.lessonId}`} />

      <header className="border-b border-token pb-4">
        <p className="text-meta text-muted">
          {course.title} · {lesson.module.title}
        </p>
        <h1 className="mt-2 text-h1 font-bold">{lesson.title}</h1>
        {lesson.description && (
          <SafeHtml
            html={plainToRichHtml(lesson.description)}
            className="prose prose-sm mt-2 max-w-none text-muted dark:prose-invert"
          />
        )}
      </header>

      {printItems.map((item) => {
        const payload = (item.payload ?? {}) as Record<string, unknown>;
        const html = typeof payload.html === "string" ? payload.html : null;
        if (html && item.type === "teacher_note") {
          // Trên giấy không có màu nền để phân biệt, nên ghi chú phải tự nói ra
          // nó là ghi chú — cầm nhầm tờ rồi đọc to lên lớp thì không rút lại được.
          return (
            <aside
              key={item.id}
              className="mt-6 border-l-4 border-accent-400 pl-4"
            >
              <p className="text-xs font-bold uppercase tracking-wider text-accent-700">
                Ghi chú giảng viên · không phát cho học viên
              </p>
              <SafeHtml
                html={html}
                className="prose prose-sm mt-1 max-w-none dark:prose-invert"
              />
            </aside>
          );
        }
        if (html) {
          return (
            <SafeHtml
              key={item.id}
              html={html}
              className="prose prose-sm mt-6 max-w-none dark:prose-invert"
            />
          );
        }
        // Nội dung không in ra giấy được (video, nhúng, tệp): ghi lại đường dẫn
        // thay vì lặng lẽ bỏ qua, để bản in không thiếu mà người đọc không biết.
        const url =
          typeof payload.url === "string"
            ? payload.url
            : typeof payload.src === "string"
              ? payload.src
              : null;
        return (
          <p key={item.id} className="mt-6 text-body text-muted">
            [{item.type}] {typeof payload.title === "string" ? `${payload.title} — ` : ""}
            {url ?? "nội dung chỉ xem được trên hệ thống"}
          </p>
        );
      })}

      <footer className="mt-10 border-t border-token pt-4 text-meta text-muted">
        {course.title} · {lesson.title} · bản in ngày {printedAt}
      </footer>
    </main>
  );
}
