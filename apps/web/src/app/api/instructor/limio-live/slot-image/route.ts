import { NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { allow } from "@/lib/rate-limit";
import { RemoteImageFetchError, fetchRemoteImage } from "@/lib/safeFetchImage";
import { SLIDE_IMAGE_MAX_BYTES, saveSlideImage } from "@/lib/slideImage";

export const runtime = "nodejs";

/**
 * POST — ảnh riêng cho ô hình của slide Chữ và hình (mockup docs/mockup/anh-rieng-o-hinh.html).
 * - multipart/form-data, trường `file`: ảnh tải từ máy (dán bằng Ctrl+V hay kéo thả cũng đi đường này);
 * - JSON `{ url }`: máy chủ tải ảnh về (safeFetchImage chặn SSRF) rồi xử lý y như ảnh tải lên.
 * Loại ảnh xác định bằng magic bytes (PNG, JPG, WebP, GIF); SVG và mọi thứ khác bị từ chối.
 * Trả `{ url, width, height }`; url nằm dưới /api/limio-live-resource/, có bản ?w=480|960.
 */
export async function POST(req: Request) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  // Xử lý ảnh tốn CPU, lấy ảnh từ địa chỉ thì tốn thêm request ra ngoài: giới hạn theo người dùng.
  const rl = await allow("live:slide-image", userId, 30, 10 * 60_000);
  if (!rl.ok) return NextResponse.json({ error: "rate_limited", retryAfterSec: rl.retryAfterSec }, { status: 429 });

  let input: Buffer;
  const ct = req.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    const body = (await req.json().catch(() => null)) as { url?: unknown } | null;
    if (!body || typeof body.url !== "string" || body.url.length > 2000) {
      return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    }
    try {
      input = (await fetchRemoteImage(body.url)).body;
    } catch (e) {
      const code = e instanceof RemoteImageFetchError ? e.code : "fetch_failed";
      const status = code === "too_large" ? 413 : code === "not_image" ? 415 : code === "fetch_failed" ? 502 : 400;
      return NextResponse.json({ error: code }, { status });
    }
  } else {
    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    if (file.size > SLIDE_IMAGE_MAX_BYTES) {
      return NextResponse.json({ error: "too_large", details: { maxBytes: SLIDE_IMAGE_MAX_BYTES } }, { status: 413 });
    }
    input = Buffer.from(await file.arrayBuffer());
  }

  const saved = await saveSlideImage(userId, input);
  if (!saved) return NextResponse.json({ error: "not_image" }, { status: 415 });
  return NextResponse.json(
    { ok: true, url: `/api/limio-live-resource/${saved.filename}`, width: saved.width ?? null, height: saved.height ?? null },
    { status: 201 },
  );
}
