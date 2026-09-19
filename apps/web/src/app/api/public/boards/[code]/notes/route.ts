import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { publish } from "@/lib/realtime/publisher";
import { rateLimit } from "@/lib/realtime/rateLimit";
import { peekClientId } from "@/lib/realtime/clientKey";
import { channelForBoard } from "@/lib/board";
import { isValidAttachmentUrl } from "@/app/instructor/classroom/boardNoteStyle";

export const runtime = "nodejs";

// Pastel palette — học viên chọn 1 hoặc bỏ trống để server random.
const COLORS = [
  "#FEF3C7", // amber
  "#DBEAFE", // blue
  "#D1FAE5", // green
  "#FCE7F3", // pink
  "#E9D5FF", // purple
  "#FED7AA", // orange
];
const COLOR_SET = new Set(COLORS);

// POST — public: học viên post note (không cần login)
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();

  // Rate limit: 1 note/5s theo THIẾT BỊ (clientId; client cũ → IP) + trần theo IP và theo bảng.
  // Theo IP thì cả lớp chung wifi/NAT chỉ post được 1 note mỗi 5 giây.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const clientId = await peekClientId(req);
  const rlIp = await rateLimit(
    clientId ? `board:${code}:client:${clientId}` : `board:${code}:ip:${ip}`,
    1,
    5_000,
  );
  if (!rlIp.ok) {
    return Response.json(
      { error: "rate_limited", resetMs: rlIp.resetMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rlIp.resetMs / 1000)) } },
    );
  }
  const rlIpBurst = await rateLimit(`board:${code}:ip-burst:${ip}`, 300, 60_000);
  if (!rlIpBurst.ok) {
    return Response.json({ error: "rate_limited", resetMs: rlIpBurst.resetMs }, { status: 429 });
  }
  const rlBoard = await rateLimit(`board:${code}:board`, 300, 60_000);
  if (!rlBoard.ok) {
    return Response.json(
      { error: "board_throttled", resetMs: rlBoard.resetMs },
      { status: 429 },
    );
  }

  let body: {
    authorName?: string;
    content?: string;
    color?: string;
    attachmentUrl?: string;
    column?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  let parsed;
  try {
    parsed = z
      .object({
        authorName: z.string().min(1).max(40),
        // content có thể rỗng nếu note chỉ đính link (UI cho phép) — bắt buộc ít nhất
        // 1 trong 2 (content/attachmentUrl) khác rỗng ở .refine bên dưới.
        content: z.string().max(500),
        color: z.string().optional(),
        attachmentUrl: z.string().max(2000).optional(),
        column: z.string().max(30).optional(),
      })
      .refine(
        (data) => data.content.trim().length > 0 || !!data.attachmentUrl?.trim(),
        { message: "content_or_attachment_required" },
      )
      .parse(body);
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400 });
  }

  // Validate attachment URL nếu có (chỉ http/https).
  if (parsed.attachmentUrl && !isValidAttachmentUrl(parsed.attachmentUrl)) {
    return Response.json({ error: "invalid_attachment_url" }, { status: 400 });
  }

  const board = await prisma.interactiveBoard.findUnique({
    where: { code },
    select: { id: true, status: true, columns: true },
  });
  if (!board) return Response.json({ error: "not_found" }, { status: 404 });
  if (board.status !== "open") {
    return Response.json({ error: "board_closed" }, { status: 403 });
  }

  // Board có bật grid theo nhóm → bắt buộc chọn đúng 1 cột đang tồn tại.
  // Board không bật grid → bỏ qua field này (giữ hành vi cũ), không lưu rác vào column.
  let column: string | null = null;
  if (board.columns.length > 0) {
    if (!parsed.column || !board.columns.includes(parsed.column)) {
      return Response.json({ error: "invalid_column" }, { status: 400 });
    }
    column = parsed.column;
  }

  // Hard cap 2000 note/board để tránh DB phình.
  const count = await prisma.boardNote.count({ where: { boardId: board.id } });
  if (count >= 2000) {
    return Response.json({ error: "board_full" }, { status: 403 });
  }

  // Học viên chọn 1 màu trong palette (validate strict); nếu không chọn → random.
  const color =
    parsed.color && COLOR_SET.has(parsed.color)
      ? parsed.color
      : COLORS[Math.floor(Math.random() * COLORS.length)]!;
  const note = await prisma.boardNote.create({
    data: {
      boardId: board.id,
      authorName: parsed.authorName.trim(),
      content: parsed.content.trim(),
      color,
      attachmentUrl: parsed.attachmentUrl?.trim() || null,
      column,
    },
    select: {
      id: true,
      authorName: true,
      content: true,
      color: true,
      attachmentUrl: true,
      column: true,
      createdAt: true,
    },
  });

  // Broadcast tới host view + các tab public khác. Fire-and-forget.
  publish(channelForBoard(board.id), {
    type: "note.created",
    note,
  }).catch((err) => {
    console.error("[boards/public/notes] publish failed:", err);
  });

  return Response.json(note, { status: 201 });
}
