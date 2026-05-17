import { NextResponse } from "next/server";
import { publish } from "@/lib/realtime/publisher";
import { rateLimit } from "@/lib/realtime/rateLimit";
import { enqueueRealtimePublish } from "@/lib/queue/realtimePublishJob";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Demo POST.
// Query ?async=1 → enqueue qua BullMQ worker (test hot path async).
// Mặc định → publish sync (test path hiện tại).
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const url = new URL(req.url);
  const isAsync = url.searchParams.get("async") === "1";

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = await rateLimit(`demo:${params.id}:${ip}`, 5, 5_000);
  if (!rl.ok) {
    return NextResponse.json(
      { error: "rate_limited", resetMs: rl.resetMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const event = { ts: Date.now(), payload: body };
  const channel = `demo:${params.id}`;

  if (isAsync) {
    const jobId = await enqueueRealtimePublish({ channel, event });
    return NextResponse.json({ jobId, mode: "async" }, { status: 202 });
  }

  const { id } = await publish(channel, event);
  return NextResponse.json({ id, mode: "sync" }, { status: 202 });
}
