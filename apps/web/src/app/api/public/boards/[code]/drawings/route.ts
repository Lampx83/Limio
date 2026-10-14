import { prisma } from "@feedbackme/db";
import { rateLimit } from "@/lib/realtime/rateLimit";
import { saveBoardImage, sniffImageExt } from "@/lib/boardImage";
import { BOARD_ATTACHMENT_MAX_BYTES } from "@/app/instructor/classroom/boardNoteStyle";

export const runtime = "nodejs";

// POST — public: học viên tải hình vẽ Draw-it (PNG) lên, trả về URL để đính vào note.
// Chỉ nhận trên board bật drawingMode và còn mở; chỉ PNG (kiểm cả magic bytes, không tin Content-Type).
// Học viên không login nên chặn theo thiết bị/IP giống route đăng note.
export async function POST(req: Request, { params }: { params: { code: string } }) {
  const code = params.code.toUpperCase();

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  // Body là multipart nên không dùng peekClientId (đọc JSON) — clientId gửi qua header, không thì rơi về IP
  // (cả lớp chung wifi sẽ bị chặn nhau).
  const rawClientId = req.headers.get("x-client-id");
  const clientId = rawClientId && rawClientId.length >= 8 && rawClientId.length <= 64 ? rawClientId : null;
  const rl = await rateLimit(
    clientId ? `board:${code}:draw:client:${clientId}` : `board:${code}:draw:ip:${ip}`,
    1,
    5_000,
  );
  if (!rl.ok) {
    return Response.json(
      { error: "rate_limited", resetMs: rl.resetMs },
      { status: 429, headers: { "Retry-After": String(Math.ceil(rl.resetMs / 1000)) } },
    );
  }
  const rlBoard = await rateLimit(`board:${code}:draw:board`, 300, 60_000);
  if (!rlBoard.ok) {
    return Response.json({ error: "board_throttled", resetMs: rlBoard.resetMs }, { status: 429 });
  }

  const board = await prisma.interactiveBoard.findUnique({
    where: { code },
    select: { id: true, status: true, drawingMode: true },
  });
  if (!board) return Response.json({ error: "not_found" }, { status: 404 });
  if (!board.drawingMode) return Response.json({ error: "not_a_drawing_board" }, { status: 403 });
  if (board.status !== "open") return Response.json({ error: "board_closed" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "invalid_form_data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "no_file" }, { status: 400 });
  if (file.size === 0) return Response.json({ error: "empty_file" }, { status: 400 });
  if (file.size > BOARD_ATTACHMENT_MAX_BYTES) {
    return Response.json(
      { error: "file_too_large", details: { maxBytes: BOARD_ATTACHMENT_MAX_BYTES } },
      { status: 413 },
    );
  }

  const buf = Buffer.from(await file.arrayBuffer());
  if (sniffImageExt(buf) !== "png") {
    return Response.json({ error: "unsupported_media_type" }, { status: 415 });
  }
  const saved = await saveBoardImage(board.id, buf);
  if (!saved) return Response.json({ error: "unsupported_media_type" }, { status: 415 });

  return Response.json({ url: `/api/board-attachments/${saved.filename}` }, { status: 201 });
}
