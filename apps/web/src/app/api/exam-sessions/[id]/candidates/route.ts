import { importSessionCandidates, listSessionCandidates } from "@feedbackme/core-lms";
import { readJson } from "@/lib/apiHelpers";
import { withMessages, withUser } from "./_shared";

export const runtime = "nodejs";

/** GET /api/exam-sessions/[id]/candidates — toàn bộ thí sinh của ca (kể cả chưa có phòng). */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withUser((userId) => listSessionCandidates(userId, params.id));
}

/**
 * POST /api/exam-sessions/[id]/candidates — { rows, dryRun? }.
 * dryRun = chỉ kiểm tra, trả lỗi từng dòng; không dryRun = lưu các dòng hợp lệ.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = (await readJson(req)) as { rows?: unknown; dryRun?: unknown } | null;
  return withUser(async (userId) => {
    const r = await importSessionCandidates(userId, params.id, body?.rows, { dryRun: body?.dryRun === true });
    return { ...r, rows: withMessages(r.rows) };
  });
}
