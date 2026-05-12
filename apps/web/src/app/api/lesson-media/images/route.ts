import { randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

const MAX_IMG_MB = 10;
const MAX_IMG_BYTES = MAX_IMG_MB * 1024 * 1024;

const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};

function imgRoot(): string {
  return (
    process.env.LESSON_IMAGE_ROOT ??
    path.join(process.cwd(), "uploads", "lesson-images")
  );
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

  const suffix = randomBytes(8).toString("hex");
  const filename = `${userId}-${Date.now()}-${suffix}.${ext}`;
  const root = imgRoot();
  await fs.mkdir(root, { recursive: true });
  const buf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(path.join(root, filename), buf);

  return NextResponse.json(
    {
      ok: true,
      url: `/api/lesson-media/images/${filename}`,
      filename,
      sizeBytes: file.size,
    },
    { status: 201 },
  );
}
