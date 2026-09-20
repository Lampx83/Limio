import { randomBytes } from "node:crypto";
import { prisma } from "@feedbackme/db";
import { rateLimit } from "@/lib/realtime/rateLimit";
import { storageFor } from "@/lib/storage";
import { boardAttachmentKey } from "@/lib/storage-keys";
import { BOARD_ATTACHMENT_MAX_BYTES } from "@/app/instructor/classroom/boardNoteStyle";

export const runtime = "nodejs";

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

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
  if (!PNG_MAGIC.every((b, i) => buf[i] === b)) {
    return Response.json({ error: "unsupported_media_type" }, { status: 415 });
  }

  const now = new Date();
  const filename = `${board.id}-${now.getTime()}-${randomBytes(6).toString("hex")}.png`;
  const key = boardAttachmentKey(now, filename);
  await storageFor(key).put(key.key, buf, "image/png");

  return Response.json({ url: `/api/board-attachments/${filename}` }, { status: 201 });
}
