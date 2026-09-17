import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { storageFor } from "@/lib/storage";
import { whiteboardPageKey } from "@/lib/storage-keys";

export const runtime = "nodejs";

// Ảnh nền 1 trang whiteboard (chế độ annotate tài liệu) — chỉ ảnh, vì PDF
// được rasterize thành ảnh ngay trên client (pdfjs-dist, xem PdfViewer.tsx)
// rồi upload từng trang qua endpoint này. Cùng convention với lesson-media.
const MAX_IMG_MB = 10;
const MAX_IMG_BYTES = MAX_IMG_MB * 1024 * 1024;

const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(req: Request) {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "validation_failed", details: "no_file" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "validation_failed", details: "empty_file" }, { status: 400 });
  }
  if (file.size > MAX_IMG_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", details: { maxBytes: MAX_IMG_BYTES } },
      { status: 413 },
    );
  }
  const ext = ALLOWED_MIME[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: "unsupported_media_type", details: { allowed: Object.keys(ALLOWED_MIME) } },
      { status: 415 },
    );
  }

  const now = new Date();
  const suffix = randomBytes(8).toString("hex");
  const filename = `${userId}-${now.getTime()}-${suffix}.${ext}`;
  const key = whiteboardPageKey(now, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await storageFor(key).put(key.key, buf, file.type);

  return NextResponse.json(
    {
      ok: true,
      url: `/api/whiteboard-media/${filename}`,
      filename,
      sizeBytes: file.size,
    },
    { status: 201 },
  );
}
