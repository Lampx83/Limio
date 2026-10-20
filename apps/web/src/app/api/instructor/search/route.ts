import { requireInstructor } from "@/lib/session";
import { cleanQuery } from "@/lib/instructorSearchShared";
import { searchInstructorContent } from "@/lib/instructorSearch";

export const runtime = "nodejs";

/**
 * GET /api/instructor/search?q=...
 * Ô tìm kiếm ở trang chủ giảng viên: khoá học, bài học, đề thi và slide CỦA giảng viên đang đăng nhập (phạm vi do
 * server tự suy từ phiên, không nhận từ trình duyệt). Gõ không dấu vẫn khớp. Trả { hits: SearchHit[] }.
 */
export async function GET(req: Request) {
  const userId = await requireInstructor();
  if (!userId) return Response.json({ error: "forbidden" }, { status: 403 });

  const q = cleanQuery(new URL(req.url).searchParams.get("q"));
  if (!q) return Response.json({ hits: [] });
  const hits = await searchInstructorContent(userId, q);
  return Response.json({ hits }, { headers: { "cache-control": "private, no-store" } });
}
