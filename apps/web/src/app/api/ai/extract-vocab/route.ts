import { NextResponse } from "next/server";
import { AiGenerationError, AiTutorError, extractVocabFromText } from "@feedbackme/core-feedback";
import { isAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";

export const runtime = "nodejs";

/**
 * LANG G2.5 — "Nhập từ vựng bằng AI". Giảng viên dán văn bản thô, AI tách thành các
 * dòng từ vựng có cấu trúc; hàm sinh đã chuẩn hoá và loại dòng không hợp lệ.
 *
 * Cùng quyền và cùng cách xử lý lỗi với /api/ai/extract-questions: bất kỳ giảng viên
 * (hoặc admin) nào cũng dùng được, không gắn với một khoá cụ thể vì kết quả không phụ
 * thuộc đích đến. Route này KHÔNG ghi từ vựng vào DB — ngoài sổ dùng AI và ví token
 * (qua extractVocabFromText) không có thay đổi dữ liệu nào; việc lưu vẫn là của giảng
 * viên, ở bước bấm Tạo/Lưu khối.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const [admin, anyCourse] = await Promise.all([
    isAdmin(userId),
    prisma.courseInstructor.findFirst({ where: { userId } }),
  ]);
  if (!admin && !anyCourse) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = (await readJson(req)) as { rawText?: unknown; fillMissing?: unknown } | null;
  if (
    !body ||
    typeof body.rawText !== "string" ||
    (body.fillMissing !== undefined && typeof body.fillMissing !== "boolean")
  ) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  let openai;
  try {
    openai = await getOpenaiClient();
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") {
      return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
    }
    throw e;
  }

  try {
    const result = await extractVocabFromText(
      userId,
      { rawText: body.rawText, fillMissing: body.fillMissing === true },
      openai,
    );
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AiTutorError) {
      // Vượt trần hoặc hết ví token — 429: người gọi không sai gì, hết hạn mức thì thử lại sau.
      return NextResponse.json({ error: e.code, details: e.details }, { status: 429 });
    }
    if (e instanceof AiGenerationError) {
      return NextResponse.json({ error: e.code, details: e.details }, { status: 400 });
    }
    throw e;
  }
}
