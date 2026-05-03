import { promises as fs } from "node:fs";
import path from "node:path";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";

/**
 * Storage abstraction. Default = local filesystem under apps/web/uploads/.
 * Set S3_BUCKET (+ S3_REGION + creds) to switch to S3 (or any S3-compatible
 * service like R2, Backblaze, Wasabi).
 *
 * Used by SCORM, H5P, and (future) assignment file uploads.
 */
export interface StorageAdapter {
  put(key: string, body: Buffer, contentType?: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
  exists(key: string): Promise<boolean>;
  /** Public URL or signed URL clients can fetch directly. Null = serve via app. */
  publicUrl(key: string): string | null;
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
  publicUrl(): string | null {
    // Serve via app routes, no public URL.
    return null;
  }
}

class S3Adapter implements StorageAdapter {
  constructor(
    private client: S3Client,
    private bucket: string,
    private publicBaseUrl: string | null,
  ) {}

  async put(key: string, body: Buffer, contentType?: string): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }
  async get(key: string): Promise<Buffer> {
    const res = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!res.Body) throw new Error("empty_body");
    const chunks: Uint8Array[] = [];
    // @ts-expect-error -- Body is a Node Readable stream in Node runtime.
    for await (const chunk of res.Body) chunks.push(chunk);
    return Buffer.concat(chunks);
  }
  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return true;
    } catch {
      return false;
    }
  }
  publicUrl(key: string): string | null {
    return this.publicBaseUrl ? `${this.publicBaseUrl}/${key}` : null;
  }
}

let cached: StorageAdapter | null = null;

export function getStorage(namespace: string): StorageAdapter {
  if (cached && cached.constructor.name === "S3Adapter") return cached;
  if (process.env.S3_BUCKET) {
    const client = new S3Client({
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
    cached = new S3Adapter(
      client,
      process.env.S3_BUCKET,
      process.env.S3_PUBLIC_BASE_URL ?? null,
    );
    return cached;
  }
  // Local fs fallback. Each call gets its own root namespace so collisions
  // between e.g. scorm + h5p don't happen.
  const root = path.join(
    process.cwd(),
    "..",
    "..",
    "apps",
    "web",
    "uploads",
    namespace,
  );
  return new LocalFsAdapter(root);
}
