import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Stream an uploaded lesson video. Honors HTTP Range so the browser can
 * seek (essential — without 206 partial responses, scrubbing the video
 * triggers a full re-download from byte 0).
 *
 * Public read for now (capability-based: filename embeds a random
 * suffix). Tighten when we wire enroll-aware access checks.
 */

const MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
};

function videoRoot(): string {
  return (
    process.env.LESSON_MEDIA_ROOT ??
    path.join(process.cwd(), "uploads", "lesson-videos")
  );
}

function readableToWeb(stream: Readable): ReadableStream<Uint8Array> {
  // Node 18+: built-in helper. Falls back to a manual adapter on older runtimes.
  const anyStream = stream as unknown as {
    [Symbol.asyncIterator]?: () => AsyncIterableIterator<Buffer>;
  };
  if (typeof (Readable as unknown as { toWeb?: unknown }).toWeb === "function") {
    return (Readable as unknown as {
      toWeb: (s: Readable) => ReadableStream<Uint8Array>;
    }).toWeb(stream);
  }
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of anyStream as AsyncIterable<Buffer>) {
          controller.enqueue(new Uint8Array(chunk));
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });
}

export async function GET(
  req: Request,
  { params }: { params: { file: string } },
) {
  const file = params.file;
  if (!/^[a-zA-Z0-9._-]+$/.test(file) || file.includes("..")) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const root = videoRoot();
  const abs = path.normalize(path.join(root, file));
  if (!abs.startsWith(root + path.sep) && abs !== path.join(root, file)) {
    return new NextResponse("forbidden", { status: 403 });
  }

  let stat;
  try {
    stat = await fs.stat(abs);
  } catch {
    return new NextResponse("not_found", { status: 404 });
  }
  if (!stat.isFile()) return new NextResponse("not_found", { status: 404 });

  const ext = path.extname(abs).toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";
  const total = stat.size;

  const range = req.headers.get("range");
  if (range) {
    // bytes=START-END  (END optional)
    const m = /^bytes=(\d+)-(\d+)?$/.exec(range);
    if (!m) {
      return new NextResponse("invalid_range", {
        status: 416,
        headers: { "content-range": `bytes */${total}` },
      });
    }
    const start = Number(m[1]);
    const end = m[2] ? Number(m[2]) : total - 1;
    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start > end ||
      start >= total
    ) {
      return new NextResponse("invalid_range", {
        status: 416,
        headers: { "content-range": `bytes */${total}` },
      });
    }
    const clampedEnd = Math.min(end, total - 1);
    const chunkSize = clampedEnd - start + 1;
    const stream = createReadStream(abs, { start, end: clampedEnd });
    return new NextResponse(readableToWeb(stream), {
      status: 206,
      headers: {
        "content-type": mime,
        "content-length": String(chunkSize),
        "content-range": `bytes ${start}-${clampedEnd}/${total}`,
        "accept-ranges": "bytes",
        "cache-control": "public, max-age=604800, immutable",
      },
    });
  }

  // Full-file response — still advertise Range so the browser can use it next.
  const stream = createReadStream(abs);
  return new NextResponse(readableToWeb(stream), {
    headers: {
      "content-type": mime,
      "content-length": String(total),
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=604800, immutable",
    },
  });
}
