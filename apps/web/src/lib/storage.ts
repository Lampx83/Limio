import { promises as fs } from "node:fs";
import path from "node:path";
import type { Readable } from "node:stream";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  CopyObjectCommand,
} from "@aws-sdk/client-s3";
import type { StorageKey, StorageLayer } from "./storage-keys";

/**
 * Storage abstraction. Default = local filesystem under apps/web/uploads/.
 * Set S3_BUCKET (+ S3_REGION + creds) to switch to S3 (or any S3-compatible
 * service like R2, Backblaze, Wasabi).
 *
 * Files are organized into three layers — `public`, `private`, `tmp` — which
 * map to subdirectories locally and (eventually) to separate buckets / prefixes
 * with different access policies on S3:
 *   - public  → CDN-cacheable, capability URL OK (avatars, lesson-media, exam-assets)
 *   - private → auth required at serve time, signed URLs on S3 (submissions)
 *   - tmp     → staging for multi-step uploads, TTL'd, auto-purged
 *
 * Use the key builders in `storage-keys.ts` instead of constructing keys by hand.
 */
/** Một đoạn byte đọc theo luồng — dùng phát video/PDF có Range mà không nạp cả file vào RAM. */
export interface RangeRead {
  body: Readable;
  total: number;
  start: number;
  end: number;
}

export interface StorageAdapter {
  put(key: string, body: Buffer, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Server-to-server copy. Adapter implementations should avoid round-tripping bytes. */
  copy(srcKey: string, destKey: string): Promise<void>;
  /** Public URL or signed URL clients can fetch directly. Null = serve via app. */
  publicUrl(key: string): string | null;
  /** Dung lượng file (byte) mà không đọc nội dung; null nếu không có. */
  sizeOf(key: string): Promise<number | null>;
  /**
   * Đọc theo luồng một đoạn [start, end] (end mặc định = hết file). Null nếu
   * adapter không hỗ trợ hoặc file không có ở đó — caller rơi về `get()`.
   */
  getRange?(key: string, start: number, end?: number): Promise<RangeRead | null>;
}

function localRoot(): string {
  // Anchor at the repo's apps/web/uploads regardless of where the runtime cwd
  // happens to be. Next.js dev/build cwd = apps/web; cron container cwd = /app.
  const override = process.env.UPLOADS_ROOT;
  if (override) return path.resolve(override);
  return path.resolve(process.cwd(), "uploads");
}

class LocalFsAdapter implements StorageAdapter {
  constructor(private root: string) {}

  private resolve(key: string): string {
    if (key.includes("..")) throw new Error("invalid_key");
    return path.join(this.root, key);
  }

  async put(key: string, body: Buffer): Promise<void> {
    const dest = this.resolve(key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, body);
  }
  async get(key: string): Promise<Buffer> {
    return fs.readFile(this.resolve(key));
  }
  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key));
    } catch {
      // already gone
    }
  }
  async exists(key: string): Promise<boolean> {
    try {
      await fs.stat(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }
  async copy(srcKey: string, destKey: string): Promise<void> {
    const src = this.resolve(srcKey);
    const dest = this.resolve(destKey);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.copyFile(src, dest);
  }
  publicUrl(): string | null {
    // Serve via app routes, no public URL.
    return null;
  }
  async sizeOf(key: string): Promise<number | null> {
    try {
      return (await fs.stat(this.resolve(key))).size;
    } catch {
      return null;
    }
  }

  /** Internal: absolute on-disk path (for streaming endpoints that need fd-level ops). */
  absPath(key: string): string {
    return this.resolve(key);
  }
}

class S3Adapter implements StorageAdapter {
  constructor(
    private client: S3Client,
    private bucket: string,
    private prefix: string,
    private publicBaseUrl: string | null,
  ) {}

  private k(key: string): string {
    return this.prefix ? `${this.prefix}/${key}` : key;
  }

  async put(key: string, body: Buffer, contentType?: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: this.k(key),
        Body: body,
        ContentType: contentType,
      }),
    );
  }
  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: this.k(key) }),
    );
    if (!res.Body) throw new Error("empty_body");
    const chunks: Uint8Array[] = [];
    // @ts-expect-error -- Body is a Node Readable stream in Node runtime.
    for await (const chunk of res.Body) chunks.push(chunk);
    return Buffer.concat(chunks);
  }
  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: this.k(key) }),
    );
  }
  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.k(key) }),
      );
      return true;
    } catch {
      return false;
    }
  }
  async copy(srcKey: string, destKey: string): Promise<void> {
    await this.client.send(
      new CopyObjectCommand({
        Bucket: this.bucket,
        CopySource: `${this.bucket}/${this.k(srcKey)}`,
        Key: this.k(destKey),
      }),
    );
  }
  publicUrl(key: string): string | null {
    return this.publicBaseUrl ? `${this.publicBaseUrl}/${this.k(key)}` : null;
  }
  async sizeOf(key: string): Promise<number | null> {
    try {
      const res = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: this.k(key) }),
      );
      return res.ContentLength ?? null;
    } catch {
      return null;
    }
  }
  async getRange(key: string, start: number, end?: number): Promise<RangeRead | null> {
    const total = await this.sizeOf(key);
    if (total === null || start >= total) return null;
    const last = Math.min(end ?? total - 1, total - 1);
    const res = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: this.k(key),
        Range: `bytes=${start}-${last}`,
      }),
    );
    if (!res.Body) return null;
    return { body: res.Body as Readable, total, start, end: last };
  }
}

/**
 * D.1 cutover: ghi luôn đi thẳng lên `primary` (S3); đọc thử `primary` trước,
 * không thấy thì rơi về `fallback` (local disk cũ). Cho phép bật S3_BUCKET mà
 * KHÔNG cần migrate hết file cũ trước — file cũ vẫn phục vụ được nguyên trạng
 * từ local, file mới tự động lên S3. Sau khi migrate xong (script riêng) và
 * xoá file local, lớp fallback trở thành no-op vô hại (fallback luôn miss).
 *
 * Không tự chuyển file từ fallback sang primary khi đọc trúng — đó là việc
 * của migrate-uploads-to-s3.ts, làm một lần, có kiểm soát, không lồng vào mỗi
 * request đọc (tránh vừa đọc vừa âm thầm ghi lại, khó debug khi có lỗi).
 */
class FallbackReadAdapter implements StorageAdapter {
  constructor(
    private primary: StorageAdapter,
    private fallback: StorageAdapter,
  ) {}

  async put(key: string, body: Buffer, contentType?: string): Promise<void> {
    await this.primary.put(key, body, contentType);
  }
  async get(key: string): Promise<Buffer> {
    if (await this.primary.exists(key)) return this.primary.get(key);
    return this.fallback.get(key);
  }
  async exists(key: string): Promise<boolean> {
    if (await this.primary.exists(key)) return true;
    return this.fallback.exists(key);
  }
  async delete(key: string): Promise<void> {
    // File có thể đang ở primary, fallback, hoặc cả hai (đã migrate tay nhưng
    // chưa dọn bản gốc) — xoá cả hai cho chắc, không quan tâm bên nào có.
    await Promise.allSettled([this.primary.delete(key), this.fallback.delete(key)]);
  }
  async copy(srcKey: string, destKey: string): Promise<void> {
    if (await this.primary.exists(srcKey)) {
      await this.primary.copy(srcKey, destKey);
      return;
    }
    // Src chỉ có ở fallback (chưa migrate) — đọc rồi ghi thẳng lên primary,
    // để bản copy mới hội tụ về S3 thay vì tạo thêm bản sao trên local.
    const buf = await this.fallback.get(srcKey);
    await this.primary.put(destKey, buf);
  }
  publicUrl(key: string): string | null {
    // CHƯA migrate xong mà bật S3_PUBLIC_BASE_URL: link CDN sẽ 404 cho file
    // cũ còn ở fallback (không có cách nào biết trước đồng bộ vì đây là hàm
    // sync). publicUrl() hiện không được gọi ở đâu trong app — nhưng nếu sau
    // này có người dùng, chỉ bật S3_PUBLIC_BASE_URL SAU KHI đã migrate xong.
    return this.primary.publicUrl(key);
  }
  async sizeOf(key: string): Promise<number | null> {
    return (await this.primary.sizeOf(key)) ?? this.fallback.sizeOf(key);
  }
  async getRange(key: string, start: number, end?: number): Promise<RangeRead | null> {
    // Chỉ primary (S3) stream được; file còn ở fallback local đã có đường
    // absPath riêng, hoặc rơi về get() ở caller.
    return this.primary.getRange ? this.primary.getRange(key, start, end) : null;
  }
}

/**
 * Sổ ghi dung lượng: mọi file đi qua `put/copy` được ghi vào `StoredFile`, mọi
 * `delete` được đánh dấu xoá. Đặt ở tầng adapter (chứ không ở từng route) để
 * KHÔNG có đường upload nào lọt sổ — kể cả route viết sau này.
 *
 * Ghi sổ là phụ: lỗi sổ (DB chập chờn…) chỉ cảnh báo log, TUYỆT ĐỐI không làm
 * hỏng upload của người dùng. Hệ quả chấp nhận được ở P0 (chỉ đo): thi thoảng
 * thiếu một dòng, script backfill bù lại được.
 */
export interface StorageLedger {
  record(input: {
    layer: string;
    key: string;
    sizeBytes: number;
    contentType?: string | null;
  }): Promise<void>;
  markDeleted(layer: string, key: string): Promise<void>;
}

export function withLedger(
  inner: StorageAdapter,
  layer: StorageLayer,
  ledger: StorageLedger,
): StorageAdapter {
  const safe = async (what: string, fn: () => Promise<void>) => {
    try {
      await fn();
    } catch (e) {
      console.warn(`[storage-ledger] ${what} thất bại:`, (e as Error).message);
    }
  };
  return {
    async put(key, body, contentType) {
      await inner.put(key, body, contentType);
      await safe(`ghi ${layer}/${key}`, () =>
        ledger.record({ layer, key, sizeBytes: body.length, contentType }),
      );
    },
    get: (key) => inner.get(key),
    exists: (key) => inner.exists(key),
    publicUrl: (key) => inner.publicUrl(key),
    sizeOf: (key) => inner.sizeOf(key),
    getRange: inner.getRange ? (key, start, end) => inner.getRange!(key, start, end) : undefined,
    async delete(key) {
      await inner.delete(key);
      await safe(`đánh dấu xoá ${layer}/${key}`, () => ledger.markDeleted(layer, key));
    },
    async copy(srcKey, destKey) {
      await inner.copy(srcKey, destKey);
      await safe(`ghi bản sao ${layer}/${destKey}`, async () => {
        const size = await inner.sizeOf(destKey);
        if (size !== null) await ledger.record({ layer, key: destKey, sizeBytes: size });
      });
    },
  };
}

const localCache = new Map<StorageLayer, LocalFsAdapter>();
// combinedCache giữ adapter THÔ (không bọc sổ) — cần cho `instanceof LocalFsAdapter`
// ở localAbsPath. ledgerCache là bản đã bọc sổ, đây mới là thứ app dùng.
const combinedCache = new Map<StorageLayer, StorageAdapter>();
const ledgerCache = new Map<StorageLayer, StorageAdapter>();

function s3Client(): S3Client | null {
  if (!process.env.S3_BUCKET) return null;
  return new S3Client({
    region: process.env.S3_REGION ?? "us-east-1",
    ...(process.env.S3_ENDPOINT && {
      endpoint: process.env.S3_ENDPOINT,
      forcePathStyle: true,
    }),
    ...(process.env.S3_ACCESS_KEY_ID &&
      process.env.S3_SECRET_ACCESS_KEY && {
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY_ID,
          secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
        },
      }),
  });
}

function buildS3Adapter(layer: StorageLayer): S3Adapter | null {
  const client = s3Client();
  if (!client) return null;
  // Allow each layer to live in its own bucket if desired (recommended for prod
  // so public bucket can have CDN/anonymous-read while private bucket can't).
  // Compose's `${VAR:-}` substitution yields an empty string (not undefined)
  // when the .env.prod key is blank, so `??` never falls through — use `||`.
  const layerBucket = process.env[`S3_BUCKET_${layer.toUpperCase()}`];
  const sharedBucket = process.env.S3_BUCKET!;
  return new S3Adapter(
    client,
    layerBucket || sharedBucket,
    // When sharing one bucket across layers, prefix each layer's keys with the
    // layer name to keep them separable in lifecycle rules / IAM policies.
    layerBucket ? "" : layer,
    layer === "public" ? (process.env.S3_PUBLIC_BASE_URL || null) : null,
  );
}

function localAdapterFor(layer: StorageLayer): LocalFsAdapter {
  const cached = localCache.get(layer);
  if (cached) return cached;
  const adapter = new LocalFsAdapter(path.join(localRoot(), layer));
  localCache.set(layer, adapter);
  return adapter;
}

function getRawLayerStorage(layer: StorageLayer): StorageAdapter {
  const cached = combinedCache.get(layer);
  if (cached) return cached;
  const s3 = buildS3Adapter(layer);
  const adapter: StorageAdapter = s3
    ? new FallbackReadAdapter(s3, localAdapterFor(layer))
    : localAdapterFor(layer);
  combinedCache.set(layer, adapter);
  return adapter;
}

/**
 * Adapter rooted at a specific storage layer. Keys are layer-relative.
 * Đã bọc sổ ghi dung lượng; đặt STORAGE_LEDGER=off để tắt khẩn cấp.
 */
export function getLayerStorage(layer: StorageLayer): StorageAdapter {
  const cached = ledgerCache.get(layer);
  if (cached) return cached;
  const raw = getRawLayerStorage(layer);
  const adapter =
    process.env.STORAGE_LEDGER === "off"
      ? raw
      : withLedger(raw, layer, {
          // import động: tránh kéo cả @feedbackme/core-lms vào các script ops
          // chỉ cần thao tác S3 thô, và tránh vòng import lúc build.
          record: async (i) => (await import("@feedbackme/core-lms")).recordStoredFile(i),
          markDeleted: async (l, k) =>
            (await import("@feedbackme/core-lms")).markStoredFileDeleted(l, k),
        });
  ledgerCache.set(layer, adapter);
  return adapter;
}

/**
 * Adapter S3 THUẦN cho layer này, bỏ qua fallback đọc local — dùng cho script
 * ops (migrate) cần thao tác thẳng lên S3 mà không bị `exists()` báo "đã có"
 * giả (vì fallback local đương nhiên "có" đúng những file script đang đọc để
 * migrate). Trả null nếu S3 chưa cấu hình (S3_BUCKET không set).
 */
export function getPrimaryS3Storage(layer: StorageLayer): StorageAdapter | null {
  return buildS3Adapter(layer);
}

/** Convenience: resolve a typed key to its adapter. */
export function storageFor(key: StorageKey): StorageAdapter {
  return getLayerStorage(key.layer);
}

/**
 * Move a tmp upload to its permanent location. Idempotent at the destination
 * (if dest already exists, src is just deleted). Use this when a rich-text
 * draft is saved: paste-time wrote to tmp, save-time commits.
 */
export async function commitTmp(
  src: StorageKey,
  dest: StorageKey,
): Promise<void> {
  if (src.layer !== "tmp") throw new Error("commit_source_must_be_tmp");
  const srcAdapter = getLayerStorage(src.layer);
  const destAdapter = getLayerStorage(dest.layer);
  if (!(await srcAdapter.exists(src.key))) throw new Error("tmp_source_missing");
  if (!(await destAdapter.exists(dest.key))) {
    const buf = await srcAdapter.get(src.key);
    await destAdapter.put(dest.key, buf);
  }
  await srcAdapter.delete(src.key);
}

/**
 * On-disk absolute path for a local-FS key. Used by streaming endpoints
 * (range requests on videos/pdfs) where buffering into memory is wasteful.
 * Returns null when storage is S3.
 */
export function localAbsPath(key: StorageKey): string | null {
  const adapter = getRawLayerStorage(key.layer);
  if (adapter instanceof LocalFsAdapter) return adapter.absPath(key.key);
  return null;
}

