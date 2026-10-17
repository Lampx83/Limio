import { removeSessionCandidate, updateSessionCandidate } from "@feedbackme/core-lms";
import { readJson } from "@/lib/apiHelpers";
import { withUser } from "../_shared";

export const runtime = "nodejs";

type Params = { params: { id: string; candidateId: string } };

/** PATCH { displayName?, mssv?, email? } — sửa một thí sinh của ca. */
export async function PATCH(req: Request, { params }: Params) {
  const body = await readJson(req);
  return withUser(async (userId) => {
    await updateSessionCandidate(userId, params.candidateId, body);
    return { ok: true };
  });
}

/** DELETE — xoá thí sinh chưa làm bài. */
export async function DELETE(_req: Request, { params }: Params) {
  return withUser(async (userId) => {
    await removeSessionCandidate(userId, params.candidateId);
    return { ok: true };
  });
}
