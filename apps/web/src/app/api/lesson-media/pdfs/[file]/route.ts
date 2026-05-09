import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function pdfRoot(): string {
  return (
    process.env.LESSON_PDF_ROOT ??
    path.join(process.cwd(), "uploads", "lesson-pdfs")
  );
}

function readableToWeb(stream: Readable): ReadableStream<Uint8Array> {
  if (typeof (Readable as unknown as { toWeb?: unknown }).toWeb === "function") {
    return (Readable as unknown as {
      toWeb: (s: Readable) => ReadableStream<Uint8Array>;
    }).toWeb(stream);
  }
  const anyStream = stream as unknown as AsyncIterable<Buffer>;
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const chunk of anyStream) {
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

  const root = pdfRoot();
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

  const total = stat.size;
  const range = req.headers.get("range");

  if (range) {
    const m = /^bytes=(\d+)-(\d+)?$/.exec(range);
    if (!m) {
      return new NextResponse("invalid_range", {
        status: 416,
        headers: { "content-range": `bytes */${total}` },
      });
    }
    const start = Number(m[1]);
    const end = m[2] ? Number(m[2]) : total - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= total) {
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
        "content-type": "application/pdf",
        "content-length": String(chunkSize),
        "content-range": `bytes ${start}-${clampedEnd}/${total}`,
        "accept-ranges": "bytes",
        "cache-control": "public, max-age=604800, immutable",
      },
    });
  }

  const stream = createReadStream(abs);
  return new NextResponse(readableToWeb(stream), {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(total),
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=604800, immutable",
    },
  });
}
