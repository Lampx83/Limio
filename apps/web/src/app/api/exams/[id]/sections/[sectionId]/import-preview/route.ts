import { NextResponse } from "next/server";
import { z } from "zod";
import { importPreviewToExam } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

const Body = z
  .object({
    /**
     * Truyền nếu instructor đã reshuffle preview và muốn import đúng bộ N câu
     * vừa thấy. Bỏ trống = dùng seed mặc định `preview:{sectionId}`.
     */
    reshuffleSeed: z.string().optional(),
  })
  .optional();

/**
 * Chốt cứng pool: chuyển section random_from_bank thành fixed, copy mỗi
 * BankQuestion (theo seed) thành ExamQuestion + ExamSectionItem. Sau đó mọi
 * học viên đều thấy cùng bộ câu. Instructor có thể sửa/reorder từng câu ở
 * tab Nội dung.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string; sectionId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req).catch(() => null);
  const parsed = Body.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    const r = await importPreviewToExam(
      userId,
      params.id,
      params.sectionId,
      parsed.data ?? {},
    );
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
