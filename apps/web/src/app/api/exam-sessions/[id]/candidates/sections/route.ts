import { listSessionSections } from "@feedbackme/core-lms";
import { withUser } from "../_shared";

export const runtime = "nodejs";

/** GET /api/exam-sessions/[id]/candidates/sections — các lớp của khoá chứa đề thi. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return withUser((userId) => listSessionSections(userId, params.id));
}
