import { NextResponse } from "next/server";
import { z } from "zod";
import {
  bulkUpdateBankQuestionStatus,
  listMatchingQuestionIds,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Bulk publish/archive/draft. Hai modes:
 *   - `ids`: client gửi danh sách ID đã chọn.
 *   - `applyToFilter`: server tự fetch ID khớp filter (cho "Tất cả X câu đang lọc").
 *
 * Trả về `{ ok: string[], skipped: { id, reason }[] }` để UI báo chính xác câu
 * nào không apply được (chưa tag skill, archived sẵn, không thấy bank…).
 */
const BodySchema = z.union([
  z.object({
    action: z.enum(["publish", "archive", "draft"]),
    ids: z.array(z.string().uuid()).min(1).max(1000),
  }),
  z.object({
    action: z.enum(["publish", "archive", "draft"]),
    applyToFilter: z.object({
      status: z.array(z.enum(["draft", "published", "archived"])).optional(),
      cognitiveLevel: z
        .array(z.enum(["remember_understand", "apply", "analyze_plus"]))
        .optional(),
      difficulty: z.array(z.number().int().min(1).max(5)).optional(),
      topics: z.array(z.string()).optional(),
      q: z.string().optional(),
    }),
  }),
]);

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    let ids: string[];
    if ("ids" in parsed.data) {
      ids = parsed.data.ids;
    } else {
      ids = await listMatchingQuestionIds(userId, {
        bankIds: [params.id],
        ...parsed.data.applyToFilter,
      });
    }
    const result = await bulkUpdateBankQuestionStatus(userId, ids, parsed.data.action);
    return NextResponse.json(result);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
