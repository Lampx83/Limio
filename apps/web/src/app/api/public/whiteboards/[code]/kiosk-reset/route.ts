import { prisma } from "@feedbackme/db";
import { publish } from "@/lib/realtime/publisher";
import { rateLimit } from "@/lib/realtime/rateLimit";
import { channelForWhiteboard } from "@/lib/whiteboard";

export const runtime = "nodejs";

// POST — public, KHÔNG cần login: chỉ dùng cho whiteboard đã bật kioskMode
// (khách tham quan không có tài khoản). Client tự gọi khi phát hiện im lặng
// quá lâu (xem WhiteboardCanvas.tsx) — không phải hành động của instructor,
// nên đi qua endpoint riêng, tách khỏi reset thường (luôn yêu cầu đăng nhập).
// Luôn xoá TOÀN BỘ mọi trang + đưa currentPage về 0 — dọn sạch cho khách kế
// tiếp, khác với reset thường (có thể chỉ xoá 1 trang).
export async function POST(_req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();

  // Rate limit rộng — chống spam gọi liên tục, không nhằm chặn người dùng
  // thật (kiosk tự gọi tối đa vài lần/giờ).
  const rl = await rateLimit(`wb:${code}:kiosk-reset`, 4, 60_000);
  if (!rl.ok) {
    return Response.json({ error: "rate_limited" }, { status: 429 });
  }

  const board = await prisma.whiteboard.findUnique({
    where: { code },
    select: { id: true, kioskMode: true, currentPage: true },
  });
  if (!board) return Response.json({ error: "not_found" }, { status: 404 });
  if (!board.kioskMode) {
    return Response.json({ error: "not_kiosk_mode" }, { status: 403 });
  }

  await prisma.whiteboard.update({
    where: { id: board.id },
    data: { snapshot: {}, currentPage: 0 },
  });

  publish(channelForWhiteboard(board.id), { type: "board.cleared" }).catch((err) => {
    console.error("[whiteboards/kiosk-reset] publish cleared failed (non-fatal):", err);
  });
  if (board.currentPage !== 0) {
    publish(channelForWhiteboard(board.id), { type: "doc.page.changed", page: 0 }).catch((err) => {
      console.error("[whiteboards/kiosk-reset] publish page failed (non-fatal):", err);
    });
  }

  return Response.json({ ok: true });
}
