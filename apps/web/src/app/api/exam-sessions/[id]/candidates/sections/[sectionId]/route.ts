import { addSessionCandidatesFromSection, listSectionStudents } from "@feedbackme/core-lms";
import { readJson } from "@/lib/apiHelpers";
import { withUser } from "../../_shared";

export const runtime = "nodejs";

type Params = { params: { id: string; sectionId: string } };

/** GET — học viên đang ghi danh ở lớp, kèm cờ đã có trong ca. */
export async function GET(_req: Request, { params }: Params) {
  return withUser((userId) => listSectionStudents(userId, params.id, params.sectionId));
}

/** POST { userIds } — thêm các học viên đã chọn vào ca. */
export async function POST(req: Request, { params }: Params) {
  const body = (await readJson(req)) as { userIds?: unknown } | null;
  return withUser((userId) => addSessionCandidatesFromSection(userId, params.id, params.sectionId, body?.userIds));
}
