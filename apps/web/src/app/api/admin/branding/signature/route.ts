import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import {
  setSiteSetting,
  getSiteSetting,
  LIMIO_SIGNATURE_URL_KEY,
  LIMIO_SIGNATURE_NAME_KEY,
  LIMIO_SIGNATURE_TITLE_KEY,
} from "@/lib/site-settings";
import { storageFor } from "@/lib/storage";
import { platformSignatureKey } from "@/lib/storage-keys";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Best-effort delete of the previous signature file — xem deletePreviousLogo ở /api/orgs/[id]/logo. */
async function deletePrevious(prevUrl: string | null): Promise<void> {
  if (!prevUrl || !prevUrl.startsWith("/api/branding-signature/")) return;
  const filename = prevUrl.replace(/^\/api\/branding-signature\//, "").split("?")[0];
  if (!filename || filename.includes("/") || filename.includes("\\")) return;
  const key = platformSignatureKey(filename);
  await storageFor(key).delete(key.key).catch(() => undefined);
}

// A6 — Ảnh chữ ký đại diện Limio, dùng chung cho mọi chứng nhận (khác chữ ký
// riêng của từng Organization ở /api/orgs/[id]/signature). Chỉ Platform Admin.
export async function POST(req: Request) {
  const userId = await requireAdmin();
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
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large", details: { maxBytes: MAX_BYTES } }, { status: 413 });
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: "unsupported_media_type", details: { allowed: Array.from(ALLOWED_MIME) } },
      { status: 415 },
    );
  }

  const ext = MIME_TO_EXT[file.type] ?? "bin";
  const filename = `signature-${randomBytes(6).toString("hex")}.${ext}`;
  const key = platformSignatureKey(filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await storageFor(key).put(key.key, buf, file.type);
  const url = `/api/branding-signature/${filename}`;

  const before = await getSiteSetting(LIMIO_SIGNATURE_URL_KEY);
  await setSiteSetting(LIMIO_SIGNATURE_URL_KEY, url);
  await deletePrevious(before);

  return NextResponse.json({ ok: true, url }, { status: 201 });
}

export async function PATCH(req: Request) {
  const userId = await requireAdmin();
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const { name, title } = (body as { name?: unknown; title?: unknown } | null) ?? {};
  if (
    (name !== undefined && typeof name !== "string") ||
    (title !== undefined && typeof title !== "string")
  ) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  if (typeof name === "string") await setSiteSetting(LIMIO_SIGNATURE_NAME_KEY, name.trim());
  if (typeof title === "string") await setSiteSetting(LIMIO_SIGNATURE_TITLE_KEY, title.trim());

  return NextResponse.json({ ok: true, name: name?.trim() ?? "", title: title?.trim() ?? "" });
}

export async function DELETE() {
  const userId = await requireAdmin();
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const before = await getSiteSetting(LIMIO_SIGNATURE_URL_KEY);
  await setSiteSetting(LIMIO_SIGNATURE_URL_KEY, "");
  await deletePrevious(before);

  return NextResponse.json({ ok: true });
}
