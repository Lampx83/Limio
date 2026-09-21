import { getLiveJoinState } from "@/lib/limioLiveJoin";

export const dynamic = "force-dynamic";

/**
 * GET /api/public/live/[code]/state
 * Học viên poll (không cần đăng nhập) để biết giảng viên đang chiếu slide tương tác nào.
 * Chỉ trả câu hỏi/phương án — không lộ đáp án đúng.
 */
export async function GET(_req: Request, { params }: { params: { code: string } }) {
  const state = await getLiveJoinState(params.code);
  if (state.status === "not_found") return Response.json(state, { status: 404 });
  return Response.json(state, { headers: { "Cache-Control": "no-store" } });
}
