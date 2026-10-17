import { attachStudentCodes } from "@feedbackme/core-lms";
import { readJson } from "@/lib/apiHelpers";
import { withMessages, withUser } from "../_shared";

export const runtime = "nodejs";

/** POST /api/exam-sessions/[id]/candidates/attach-mssv — { rows: [{line,email,mssv}], dryRun? }. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const body = (await readJson(req)) as { rows?: unknown; dryRun?: unknown } | null;
  return withUser(async (userId) => {
    const r = await attachStudentCodes(userId, params.id, body?.rows, { dryRun: body?.dryRun === true });
    return { ...r, rows: withMessages(r.rows) };
  });
}
