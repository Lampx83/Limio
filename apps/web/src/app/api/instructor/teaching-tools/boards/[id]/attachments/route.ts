import { randomBytes } from "node:crypto";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { storageFor } from "@/lib/storage";
import { boardAttachmentKey } from "@/lib/storage-keys";
import {
  BOARD_ATTACHMENT_MAX_BYTES,
  BOARD_ATTACHMENT_MIME_TO_EXT,
} from "@/app/instructor/classroom/boardNoteStyle";

export const runtime = "nodejs";

// POST — GV upload file trực tiếp làm đính kèm note (ảnh/pdf, ≤5MB). Học viên
// (public) vẫn chỉ dán URL — không có route tương đương ở /api/public/boards.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const board = await prisma.interactiveBoard.findUnique({
    where: { id: params.id },
    select: { id: true, ownerId: true },
  });
  if (!board) return Response.json({ error: "not_found" }, { status: 404 });
  if (board.ownerId !== userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "invalid_form_data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "no_file" }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "empty_file" }, { status: 400 });
  }
  if (file.size > BOARD_ATTACHMENT_MAX_BYTES) {
    return Response.json(
      { error: "file_too_large", details: { maxBytes: BOARD_ATTACHMENT_MAX_BYTES } },
      { status: 413 },
    );
  }
  const ext = BOARD_ATTACHMENT_MIME_TO_EXT[file.type];
  if (!ext) {
    return Response.json(
      { error: "unsupported_media_type", details: { allowed: Object.keys(BOARD_ATTACHMENT_MIME_TO_EXT) } },
      { status: 415 },
    );
  }

  const now = new Date();
  const filename = `${board.id}-${now.getTime()}-${randomBytes(6).toString("hex")}.${ext}`;
  const key = boardAttachmentKey(now, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await storageFor(key).put(key.key, buf, file.type);

  return Response.json({ url: `/api/board-attachments/${filename}` }, { status: 201 });
}
