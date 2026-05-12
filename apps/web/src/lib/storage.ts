import { promises as fs } from "node:fs";
import path from "node:path";
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
export interface StorageAdapter {
  put(key: string, body: Buffer, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Server-to-server copy. Adapter implementations should avoid round-tripping bytes. */
  copy(srcKey: string, destKey: string): Promise<void>;
  /** Public URL or signed URL clients can fetch directly. Null = serve via app. */
  publicUrl(key: string): string | null;
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
}

const localCache = new Map<StorageLayer, LocalFsAdapter>();
const s3Cache = new Map<StorageLayer, S3Adapter>();

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

/** Adapter rooted at a specific storage layer. Keys are layer-relative. */
export function getLayerStorage(layer: StorageLayer): StorageAdapter {
  const client = s3Client();
  if (client) {
    const cached = s3Cache.get(layer);
    if (cached) return cached;
    // Allow each layer to live in its own bucket if desired (recommended for prod
    // so public bucket can have CDN/anonymous-read while private bucket can't).
    const layerBucket = process.env[`S3_BUCKET_${layer.toUpperCase()}`];
    const sharedBucket = process.env.S3_BUCKET!;
    const adapter = new S3Adapter(
      client,
      layerBucket ?? sharedBucket,
      // When sharing one bucket across layers, prefix each layer's keys with the
      // layer name to keep them separable in lifecycle rules / IAM policies.
      layerBucket ? "" : layer,
      layer === "public" ? (process.env.S3_PUBLIC_BASE_URL ?? null) : null,
    );
    s3Cache.set(layer, adapter);
    return adapter;
  }
  const cached = localCache.get(layer);
  if (cached) return cached;
  const adapter = new LocalFsAdapter(path.join(localRoot(), layer));
  localCache.set(layer, adapter);
  return adapter;
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
  const adapter = getLayerStorage(key.layer);
  if (adapter instanceof LocalFsAdapter) return adapter.absPath(key.key);
  return null;
}

