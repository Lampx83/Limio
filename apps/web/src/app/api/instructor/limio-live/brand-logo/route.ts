import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { storageFor } from "@/lib/storage";
import { liveSlideImageKey } from "@/lib/storage-keys";

export const runtime = "nodejs";

// Logo thương hiệu của bài giảng: ảnh nhỏ, nên giới hạn thấp hơn ảnh slide. Không nhận SVG
// (tệp có thể chứa mã chạy trên trình duyệt người xem); PNG nền trong suốt là lựa chọn tốt nhất.
const MAX_LOGO_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/**
 * POST /api/instructor/limio-live/brand-logo — tải logo lên; trả địa chỉ để lưu vào thương hiệu của bài giảng
 * (PATCH decks/[deckId] { brand }). Tệp dùng chung kho và đường phục vụ với ảnh slide (/api/limio-live-media).
 */
export async function POST(req: Request) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "validation_failed", details: "no_file" }, { status: 400 });
  if (file.size === 0) return NextResponse.json({ error: "validation_failed", details: "empty_file" }, { status: 400 });
  if (file.size > MAX_LOGO_BYTES) {
    return NextResponse.json({ error: "file_too_large", details: { maxBytes: MAX_LOGO_BYTES } }, { status: 413 });
  }
  const ext = ALLOWED_MIME[file.type];
  if (!ext) {
    return NextResponse.json({ error: "unsupported_media_type", details: { allowed: Object.keys(ALLOWED_MIME) } }, { status: 415 });
  }

  const now = new Date();
  const filename = `${userId}-logo-${now.getTime()}-${randomBytes(8).toString("hex")}.${ext}`;
  const key = liveSlideImageKey(now, filename);
  await storageFor(key).put(key.key, Buffer.from(await file.arrayBuffer()), file.type);

  return NextResponse.json({ ok: true, url: `/api/limio-live-media/${filename}`, filename, sizeBytes: file.size }, { status: 201 });
}
