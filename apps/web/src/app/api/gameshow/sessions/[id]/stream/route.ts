import { sseResponse } from "@/lib/realtime/sse";
import { gameChannel } from "@/lib/gameshow/bus";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public — channel không chứa đáp án đúng cho tới khi host bấm "reveal",
// nên không cần auth để subscribe (giống pattern board/quick-poll stream).
export async function GET(req: Request, { params }: { params: { id: string } }) {
  return sseResponse(gameChannel(params.id), req);
}
