import { sseResponse } from "@/lib/realtime/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SSE stream cho QuickPoll. Event payload: { choice: string, prev?: string, ts: number } — prev có mặt khi người bỏ phiếu đổi ý (trừ 1 ở prev)
// Client cộng dồn votesByOption locally; instructor không phải polling /results.
export async function GET(
  req: Request,
  { params }: { params: { pollId: string } },
) {
  return sseResponse(`poll:${params.pollId}`, req);
}
