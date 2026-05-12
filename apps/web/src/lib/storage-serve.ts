import { createReadStream, promises as fs } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { localAbsPath, storageFor } from "./storage";
import type { StorageKey } from "./storage-keys";

/**
 * Helpers for the serving side of uploads.
 *
 * URLs in DB rows are flat (`/api/lesson-media/images/<filename>`); the
 * sharded on-disk key is reconstructed from the filename by the matching
 * `*KeyFromFilename` helper in `storage-keys.ts`. Routes pass the resulting
 * key here to read the blob.
 */

const SAFE_FILENAME = /^[A-Za-z0-9._-]+$/;

export function isSafeFilename(name: string): boolean {
  return SAFE_FILENAME.test(name) && !name.includes("..");
}

/**
 * Resolve a sharded storage key into a readable handle. Returns null when the
 * key is unparseable (caller already 403'd on bad filename) or the file is
 * missing.
 */
export async function resolveKey(
  key: StorageKey | null,
): Promise<{ get(): Promise<Buffer>; absPath: string | null } | null> {
  if (!key) return null;
  const adapter = storageFor(key);
  if (!(await adapter.exists(key.key))) return null;
  return {
    get: () => adapter.get(key.key),
    absPath: localAbsPath(key),
  };
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

/**
 * Stream a local file with HTTP Range support. Used by lesson video + PDF
 * serving where seek/scrub matters. When `absPath` is null (file lives on S3),
 * the caller should fall back to buffered get + 200 response.
 */
export async function streamWithRange(
  absPath: string,
  contentType: string,
  req: Request,
): Promise<NextResponse> {
  let stat;
  try {
    stat = await fs.stat(absPath);
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
    const stream = createReadStream(absPath, { start, end: clampedEnd });
    return new NextResponse(readableToWeb(stream), {
      status: 206,
      headers: {
        "content-type": contentType,
        "content-length": String(chunkSize),
        "content-range": `bytes ${start}-${clampedEnd}/${total}`,
        "accept-ranges": "bytes",
        "cache-control": "public, max-age=604800, immutable",
      },
    });
  }

  const stream = createReadStream(absPath);
  return new NextResponse(readableToWeb(stream), {
    headers: {
      "content-type": contentType,
      "content-length": String(total),
      "accept-ranges": "bytes",
      "cache-control": "public, max-age=604800, immutable",
    },
  });
}
