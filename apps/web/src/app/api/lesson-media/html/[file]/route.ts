import { NextResponse } from "next/server";
import { lessonHtmlKeyFromFilename } from "@/lib/storage-keys";
import { isSafeFilename, resolveKey } from "@/lib/storage-serve";

export const runtime = "nodejs";

/**
 * Instructor-uploaded HTML is untrusted content that happens to live on our
 * own origin. `LessonContent.tsx` already frames it in a sandboxed iframe
 * (no `allow-same-origin`) — but nothing stops a learner from opening this
 * URL directly in a new tab, which would bypass that iframe's sandbox
 * entirely and run the file as a normal same-origin page (full cookie/DOM
 * access). Sending `Content-Security-Policy: sandbox` on the response itself
 * closes that hole: the browser treats it as sandboxed no matter how it was
 * loaded, framed or not, and — critically — we omit `allow-same-origin` here
 * too, so a direct visit still can't read Limio's cookies or session.
 */
const SANDBOX_CSP =
  "sandbox allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox";

export async function GET(
  _req: Request,
  { params }: { params: { file: string } },
) {
  const file = params.file;
  if (!isSafeFilename(file)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const resolved = await resolveKey(lessonHtmlKeyFromFilename(file));
  if (!resolved) return new NextResponse("not_found", { status: 404 });

  const buf = await resolved.get();
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-length": String(buf.length),
      "cache-control": "public, max-age=604800, immutable",
      "content-security-policy": SANDBOX_CSP,
      "x-content-type-options": "nosniff",
    },
  });
}
