import { createReadStream } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function imgRoot(): string {
  return (
    process.env.LESSON_IMAGE_ROOT ??
    path.join(process.cwd(), "uploads", "lesson-images")
  );
}

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
};

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
  _req: Request,
  { params }: { params: { file: string } },
) {
  const file = params.file;
  if (!/^[a-zA-Z0-9._-]+$/.test(file) || file.includes("..")) {
    return new NextResponse("forbidden", { status: 403 });
  }

  const root = imgRoot();
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

  const ext = (file.split(".").pop() ?? "").toLowerCase();
  const contentType = CONTENT_TYPE_BY_EXT[ext] ?? "application/octet-stream";

  const stream = createReadStream(abs);
  return new NextResponse(readableToWeb(stream), {
    headers: {
      "content-type": contentType,
      "content-length": String(stat.size),
      "cache-control": "public, max-age=604800, immutable",
    },
  });
}
