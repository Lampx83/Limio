import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

function avatarRoot(): string {
  return (
    process.env.AVATAR_STORAGE_ROOT ??
    path.join(process.cwd(), "uploads", "avatars")
  );
}

/**
 * Best-effort delete of a previously uploaded avatar living under our
 * own /api/avatars/ namespace. Anything else (external URL, missing
 * file) is ignored.
 */
async function deletePreviousAvatar(prevUrl: string | null): Promise<void> {
  if (!prevUrl) return;
  if (!prevUrl.startsWith("/api/avatars/")) return; // external URL, leave it
  const filename = prevUrl.replace(/^\/api\/avatars\//, "").split("?")[0];
  if (!filename || filename.includes("/") || filename.includes("\\")) return;
  const fullPath = path.join(avatarRoot(), filename);
  try {
    await fs.unlink(fullPath);
  } catch {
    // not fatal — file may have been already removed
  }
}

export async function POST(req: Request) {
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
    return NextResponse.json(
      { error: "validation_failed", details: "no_file" },
      { status: 400 },
    );
  }

  if (file.size === 0) {
    return NextResponse.json(
      { error: "validation_failed", details: "empty_file" },
      { status: 400 },
    );
  }
  if (file.size > MAX_AVATAR_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", details: { maxBytes: MAX_AVATAR_BYTES } },
      { status: 413 },
    );
  }
  if (!ALLOWED_MIME.has(file.type)) {
    return NextResponse.json(
      {
        error: "unsupported_media_type",
        details: { allowed: Array.from(ALLOWED_MIME) },
      },
      { status: 415 },
    );
  }

  const ext = MIME_TO_EXT[file.type] ?? "bin";
  const suffix = randomBytes(6).toString("hex");
  const filename = `${userId}-${suffix}.${ext}`;
  const root = avatarRoot();
  await fs.mkdir(root, { recursive: true });
  const fullPath = path.join(root, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(fullPath, buf);

  const avatarUrl = `/api/avatars/${filename}`;

  // Look up previous avatar so we can clean it up after the swap.
  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl },
  });
  await deletePreviousAvatar(before?.avatarUrl ?? null);

  return NextResponse.json({ ok: true, avatarUrl }, { status: 201 });
}

export async function DELETE() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const before = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarUrl: true },
  });
  await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl: null },
  });
  await deletePreviousAvatar(before?.avatarUrl ?? null);

  return NextResponse.json({ ok: true });
}
