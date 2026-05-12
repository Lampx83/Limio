import { createReadStream, promises as fs } from "node:fs";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getStorage, localAbsPath, storageFor } from "./storage";
import type { StorageKey } from "./storage-keys";

/**
 * Helpers for the serving side of uploads.
 *
 * Each upload kind moved to the new sharded layout — but DB rows still point
 * at flat URLs like `/api/lesson-media/images/<filename>`. We can't change the
 * URL contract, so serving routes derive the sharded key from the filename and
 * fall back to the legacy flat namespace for files uploaded before the
 * migration. {@link resolveWithLegacy} encapsulates that fallback.
 */

const SAFE_FILENAME = /^[A-Za-z0-9._-]+$/;

export function isSafeFilename(name: string): boolean {
  return SAFE_FILENAME.test(name) && !name.includes("..");
}

/**
 * Try the new sharded key first; if missing, fall back to the legacy flat
 * namespace (under `uploads/<namespace>/<filename>`). Returns the resolved
 * adapter+key+local-path triple, or null when both miss.
 */
export async function resolveWithLegacy(
  shardedKey: StorageKey | null,
  legacyNamespace: string,
  filename: string,
): Promise<{ get(): Promise<Buffer>; absPath: string | null; size?: number } | null> {
  if (shardedKey) {
    const adapter = storageFor(shardedKey);
    if (await adapter.exists(shardedKey.key)) {
      return {
        get: () => adapter.get(shardedKey.key),
        absPath: localAbsPath(shardedKey),
      };
    }
  }
  const legacy = getStorage(legacyNamespace);
  if (await legacy.exists(filename)) {
    return {
      get: () => legacy.get(filename),
      // Best-effort absolute path for the legacy LocalFsAdapter — for streaming.
      absPath: (legacy as unknown as { absPath?: (k: string) => string }).absPath?.(filename) ?? null,
    };
  }
  return null;
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
