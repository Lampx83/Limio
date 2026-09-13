import { z } from "zod";
import { Prisma, prisma } from "@feedbackme/db";
import { publish } from "@/lib/realtime/publisher";
import { rateLimit } from "@/lib/realtime/rateLimit";
import { channelForWhiteboard } from "@/lib/whiteboard";
import {
  mergeSnapshotPage,
  type WhiteboardElement,
  type WhiteboardSnapshot,
} from "@/lib/whiteboardReconcile";

export const runtime = "nodejs";

// Element Excalidraw — chỉ validate phần server cần để reconcile
// (id/version/versionNonce/updated); mọi field khác đi qua nguyên vẹn.
const elementSchema = z
  .object({
    id: z.string().min(1).max(100),
    version: z.number(),
    versionNonce: z.number(),
    updated: z.number(),
  })
  .passthrough();

const MAX_BATCH = 200; // số element tối đa / request
const MAX_SNAPSHOT_ELEMENTS = 5000; // hard cap / whiteboard (kiosk triển lãm chạy cả ngày)

// POST — public: client (host hoặc guest) đẩy batch element vừa đổi
// (không cần login — join bằng code, giống notes của InteractiveBoard).
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();

  // Rate limit rộng hơn note (vẽ tay tần suất cao hơn nhiều so với gõ note).
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rlIp = await rateLimit(`wb:${code}:ip:${ip}`, 15, 1_000);
  if (!rlIp.ok) {
    return Response.json(
      { error: "rate_limited", resetMs: rlIp.resetMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rlIp.resetMs / 1000)) } },
    );
  }
  const rlBoard = await rateLimit(`wb:${code}:board`, 300, 1_000);
  if (!rlBoard.ok) {
    return Response.json({ error: "board_throttled", resetMs: rlBoard.resetMs }, { status: 429 });
  }

  let body: { elements?: unknown; page?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  let elements: WhiteboardElement[];
  let page: number;
  try {
    elements = z
      .array(elementSchema)
      .min(1)
      .max(MAX_BATCH)
      .parse(body.elements) as WhiteboardElement[];
    page = z.number().int().min(0).default(0).parse(body.page ?? 0);
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  const board = await prisma.whiteboard.findUnique({
    where: { code },
    select: { id: true, status: true },
  });
  if (!board) return Response.json({ error: "not_found" }, { status: 404 });
  if (board.status !== "open") {
    return Response.json({ error: "board_closed" }, { status: 403 });
  }

  // Lock theo row (FOR UPDATE) để 2 request cùng lúc không đè mất merge của
  // nhau — snapshot là 1 JSON blob nên read-modify-write cần serialize theo
  // board, không thể merge atomic bằng 1 câu UPDATE thường.
  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ snapshot: WhiteboardSnapshot }[]>`
      SELECT snapshot FROM "Whiteboard" WHERE id = ${board.id} FOR UPDATE
    `;
    const current = rows[0]?.snapshot ?? {};
    let next = mergeSnapshotPage(current, page, elements);
    // Cap số element / trang (kiosk triển lãm chạy cả ngày) — giữ mới nhất.
    const key = String(page);
    const pageElements = next[key] ?? [];
    if (pageElements.length > MAX_SNAPSHOT_ELEMENTS) {
      const trimmed = [...pageElements]
        .sort((a, b) => a.updated - b.updated)
        .slice(pageElements.length - MAX_SNAPSHOT_ELEMENTS);
      next = { ...next, [key]: trimmed };
    }
    await tx.whiteboard.update({
      where: { id: board.id },
      data: { snapshot: next as unknown as Prisma.InputJsonValue },
    });
  });

  // Broadcast batch gốc (chưa merge) — mỗi client tự reconcile phía mình,
  // giống cơ chế của excalidraw.com.
  publish(channelForWhiteboard(board.id), {
    type: "elements.updated",
    page,
    elements,
  }).catch((err) => {
    console.error("[whiteboards/public/elements] publish failed:", err);
  });

  return Response.json({ ok: true }, { status: 201 });
}
