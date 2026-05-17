import { sseResponse } from "@/lib/realtime/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// SSE stream cho 1 WordCloud — broadcast submission mới tới instructor host view.
// Replace polling /results cũ (1s/lần, sập ở lớp lớn).
// Event payload: { text: string, ts: number }
// Client áp event vào local state + recompute frequency map client-side.
export async function GET(
  req: Request,
  { params }: { params: { cloudId: string } },
) {
  return sseResponse(`wordcloud:${params.cloudId}`, req);
}
