import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { updateOrganizationLogo } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { storageFor } from "@/lib/storage";
import { orgLogoKey, orgLogoKeyFromFilename } from "@/lib/storage-keys";

export const runtime = "nodejs";

const MAX_LOGO_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Best-effort delete of a previously uploaded org logo. Xem deletePreviousAvatar. */
async function deletePreviousLogo(prevUrl: string | null): Promise<void> {
  if (!prevUrl || !prevUrl.startsWith("/api/org-logos/")) return;
  const filename = prevUrl.replace(/^\/api\/org-logos\//, "").split("?")[0];
  if (!filename || filename.includes("/") || filename.includes("\\")) return;
  const sharded = orgLogoKeyFromFilename(filename);
  if (sharded) {
    await storageFor(sharded).delete(sharded.key).catch(() => undefined);
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

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
  if (file.size > MAX_LOGO_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", details: { maxBytes: MAX_LOGO_BYTES } },
      { status: 413 },
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      { error: "unsupported_media_type", details: { allowed: Array.from(ALLOWED_MIME) } },
      { status: 415 },
    );
  }

  const ext = MIME_TO_EXT[file.type] ?? "bin";
  const suffix = randomBytes(6).toString("hex");
  const filename = `${params.id}-${suffix}.${ext}`;
  const key = orgLogoKey(params.id, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await storageFor(key).put(key.key, buf, file.type);
  const logoUrl = `/api/org-logos/${filename}`;

  const before = await prisma.organization.findUnique({
    where: { id: params.id },
    select: { brandingLogoUrl: true },
  });

  try {
    await updateOrganizationLogo(userId, params.id, logoUrl);
  } catch (e) {
    // Không có quyền — dọn file vừa upload để không rác storage.
    await storageFor(key).delete(key.key).catch(() => undefined);
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
  await deletePreviousLogo(before?.brandingLogoUrl ?? null);

  return NextResponse.json({ ok: true, brandingLogoUrl: logoUrl }, { status: 201 });
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const before = await prisma.organization.findUnique({
    where: { id: params.id },
    select: { brandingLogoUrl: true },
  });

  try {
    await updateOrganizationLogo(userId, params.id, null);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
  await deletePreviousLogo(before?.brandingLogoUrl ?? null);

  return NextResponse.json({ ok: true });
}
