import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse, CourseAuthzError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { csvResponse } from "@/lib/csvExport";
import { identityCols, IDENTITY_COLUMNS, learnerIndex } from "@/lib/researchExport";

export const runtime = "nodejs";

/**
 * B15 — nội dung hội thoại với trợ giảng AI, một dòng mỗi tin nhắn.
 *
 * Trước đây nội dung này chỉ đọc được bởi chính người học: endpoint duy nhất
 * trả hội thoại lọc theo `userId` của người gọi. Giảng viên không có đường nào
 * để biết lớp mình đang hỏi AI những gì — trong khi đó chính là chỗ lộ ra
 * những câu người học không dám hỏi trên lớp.
 *
 * Đây là dữ liệu nhạy cảm hơn mọi báo cáo khác: nó là lời người học viết ra
 * khi tưởng chỉ có máy đọc. Ba ràng buộc theo đó:
 *  - Chỉ người dạy khoá này đọc được (`assertCanEditCourse`), và chỉ hội thoại
 *    thuộc bài của khoá này.
 *  - Cột `Mã ẩn danh` đứng đầu để bỏ Email/Họ tên là ra ngay bộ chia sẻ được.
 *  - Không có bộ lọc theo từng người học: báo cáo này để đọc xu hướng cả lớp,
 *    không phải để soi một em.
 */
export async function GET(
  _req: Request,
  { params }: { params: { courseId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await assertCanEditCourse(userId, params.courseId);
  } catch (err) {
    if (err instanceof CourseAuthzError) {
      return NextResponse.json(
        { error: err.code === "not_found" ? "course_not_found" : "forbidden" },
        { status: err.code === "not_found" ? 404 : 403 },
      );
    }
    throw err;
  }

  const course = await prisma.course.findUnique({
    where: { id: params.courseId },
    select: { slug: true },
  });
  if (!course) return NextResponse.json({ error: "course_not_found" }, { status: 404 });

  const [index, conversations] = await Promise.all([
    learnerIndex(params.courseId),
    prisma.aiConversation.findMany({
      where: { lesson: { module: { courseId: params.courseId } } },
      select: {
        id: true,
        userId: true,
        createdAt: true,
        lesson: {
          select: { title: true, module: { select: { title: true } } },
        },
        messages: {
          // Vai trò `system` là lời nhắc do hệ thống dựng, không phải lời của
          // ai cả — để vào bảng chỉ làm loãng.
          where: { role: { in: ["user", "assistant"] } },
          orderBy: { createdAt: "asc" },
          select: {
            role: true,
            content: true,
            tokensInput: true,
            tokensOutput: true,
            costUsd: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const out: Array<Record<string, unknown>> = [];
  for (const c of conversations) {
    let turn = 0;
    c.messages.forEach((m, i) => {
      if (m.role === "user") turn += 1;
      out.push({
        ...identityCols(index.get(c.userId)),
        Module: c.lesson.module.title,
        "Bài học": c.lesson.title,
        "Mã hội thoại": c.id,
        "Thứ tự tin nhắn": i + 1,
        "Lượt hỏi thứ": turn,
        "Người nói": m.role === "user" ? "Người học" : "Trợ giảng AI",
        "Nội dung": m.content.replace(/\s+/g, " "),
        "Số ký tự": m.content.length,
        "Token vào": m.tokensInput ?? "",
        "Token ra": m.tokensOutput ?? "",
        "Chi phí (USD)": m.costUsd !== null ? m.costUsd.toFixed(6) : "",
        "Lúc": m.createdAt,
      });
    });
  }

  const day = new Date().toISOString().slice(0, 10);
  return csvResponse(`nghien-cuu-tro-giang-ai-${course.slug}-${day}.csv`, out, [
    ...IDENTITY_COLUMNS,
    "Module",
    "Bài học",
    "Mã hội thoại",
    "Thứ tự tin nhắn",
    "Lượt hỏi thứ",
    "Người nói",
    "Nội dung",
    "Số ký tự",
    "Token vào",
    "Token ra",
    "Chi phí (USD)",
    "Lúc",
  ]);
}
