import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { isOrgAdminOf } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { storageFor } from "@/lib/storage";
import { orgLogoKey } from "@/lib/storage-keys";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/**
 * POST /api/orgs/[id]/space/asset — multipart `file`: ảnh dùng trong space (logo, logo đối tác, ảnh hero, biểu tượng khoá).
 * Trả { url }. Lưu cùng chỗ và cùng đường phục vụ với logo trường (`/api/org-logos/<tên>`) nhưng KHÔNG đổi logo trường.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isOrgAdminOf(userId, params.id))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "validation_failed", details: "no_file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  const ext = MIME_TO_EXT[file.type];
  if (!ext) return NextResponse.json({ error: "unsupported_media_type" }, { status: 415 });

  // Tên tệp `<orgId>-<hex>.<ext>` để route phục vụ logo suy được thư mục từ tên.
  const filename = `${params.id}-${randomBytes(6).toString("hex")}.${ext}`;
  const key = orgLogoKey(params.id, filename);
  await storageFor(key).put(key.key, Buffer.from(await file.arrayBuffer()), file.type);
  return NextResponse.json({ ok: true, url: `/api/org-logos/${filename}` }, { status: 201 });
}
