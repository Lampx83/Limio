import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/session";
import { storageFor } from "@/lib/storage";
import { lessonHtmlKey } from "@/lib/storage-keys";

export const runtime = "nodejs";

const MAX_HTML_MB = 10;
const MAX_HTML_BYTES = MAX_HTML_MB * 1024 * 1024;

// Browsers report "text/html" for .html/.htm reliably, but some OS/file-picker
// combos leave `file.type` empty — fall back to the extension in that case,
// same trade-off the PDF/image routes make (client-declared type, no
// server-side content sniffing).
function isHtmlUpload(file: File): boolean {
  const name = file.name.toLowerCase();
  const hasHtmlExt = name.endsWith(".html") || name.endsWith(".htm");
  return hasHtmlExt && (file.type === "" || file.type === "text/html");
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
  if (file.size > MAX_HTML_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", details: { maxBytes: MAX_HTML_BYTES } },
      { status: 413 },
    );
  }
  if (!isHtmlUpload(file)) {
    return NextResponse.json(
      { error: "unsupported_media_type", details: { allowed: [".html", ".htm"] } },
      { status: 415 },
    );
  }

  const now = new Date();
  const suffix = randomBytes(8).toString("hex");
  const filename = `${userId}-${now.getTime()}-${suffix}.html`;
  const key = lessonHtmlKey(now, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await storageFor(key).put(key.key, buf, "text/html");

  return NextResponse.json(
    {
      ok: true,
      url: `/api/lesson-media/html/${filename}`,
      filename,
      sizeBytes: file.size,
    },
    { status: 201 },
  );
}
