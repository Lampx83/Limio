import { notFound, redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { isUserEnrolled } from "@feedbackme/core-lms";
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
export const dynamic = "force-dynamic";

export default async function LessonPrintPage({
  params,
}: {
  params: { slug: string; lessonId: string };
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

      {lesson.contentItems.map((item) => {
        const payload = (item.payload ?? {}) as Record<string, unknown>;
        const html = typeof payload.html === "string" ? payload.html : null;
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
