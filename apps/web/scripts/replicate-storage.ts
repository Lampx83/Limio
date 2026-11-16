/**
 * Đuổi bản sao kho tệp: chép mọi object có ở kho chính (S3_*) mà bản sao (S3_REPLICA_*) còn thiếu hoặc lệch dung lượng.
 *
 *   tsx scripts/replicate-storage.ts [--dry-run] [--max-gb 20]
 *
 * Idempotent, chỉ THÊM/ghi đè bản sao — không bao giờ xoá gì ở cả hai phía. Mỗi object tải về rồi ghi sang bên kia theo luồng
 * trong bộ nhớ (video tối đa vài trăm MB). Chạy định kỳ (cron) để bản sao theo kịp; upload mới đã tự ghi kèm bản sao
 * (`ReplicaReadAdapter.put`), script này lo dữ liệu cũ và những lần bản sao từng lỗi.
 * Giả định một bucket chung cho mọi layer (như production: bucket `limio`, khoá `public/…` / `private/…`).
 */
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

function client(prefix: string): { c: S3Client; bucket: string } {
  const e = (k: string) => process.env[`${prefix}_${k}`];
  if (!e("BUCKET") || !e("ENDPOINT") || !e("ACCESS_KEY_ID") || !e("SECRET_ACCESS_KEY")) throw new Error(`thiếu biến ${prefix}_BUCKET/ENDPOINT/ACCESS_KEY_ID/SECRET_ACCESS_KEY`);
  return {
    bucket: e("BUCKET")!,
    c: new S3Client({
      region: e("REGION") ?? process.env.S3_REGION ?? "us-east-1",
      endpoint: e("ENDPOINT"),
      forcePathStyle: true,
      credentials: { accessKeyId: e("ACCESS_KEY_ID")!, secretAccessKey: e("SECRET_ACCESS_KEY")! },
      requestHandler: { connectionTimeout: 5_000, requestTimeout: 60_000 },
    }),
  };
}

async function listAll(c: S3Client, bucket: string): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  let token: string | undefined;
  do {
    const r = await c.send(new ListObjectsV2Command({ Bucket: bucket, ContinuationToken: token }));
    for (const o of r.Contents ?? []) if (o.Key) out.set(o.Key, o.Size ?? 0);
    token = r.IsTruncated ? r.NextContinuationToken : undefined;
  } while (token);
  return out;
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const gbIdx = process.argv.indexOf("--max-gb");
  const maxBytes = (gbIdx > 0 ? Number(process.argv[gbIdx + 1]) : 20) * 1024 ** 3;
  const src = client("S3");
  const dst = client("S3_REPLICA");
  const [have, got] = await Promise.all([listAll(src.c, src.bucket), listAll(dst.c, dst.bucket)]);
  const todo = [...have].filter(([k, size]) => got.get(k) !== size);
  const bytes = todo.reduce((n, [, s]) => n + s, 0);
  console.log(`kho chính ${have.size} object, bản sao ${got.size}; cần chép ${todo.length} (${(bytes / 1024 ** 3).toFixed(2)} GB)`);
  if (dryRun) return;

  let done = 0, copied = 0, failed = 0;
  for (const [key, size] of todo) {
    if (copied + size > maxBytes) { console.log(`dừng: chạm trần ${maxBytes / 1024 ** 3} GB mỗi lượt, lượt sau chép tiếp`); break; }
    try {
      const r = await src.c.send(new GetObjectCommand({ Bucket: src.bucket, Key: key }));
      const chunks: Uint8Array[] = [];
      // @ts-expect-error -- Body là Readable của Node.
      for await (const ch of r.Body) chunks.push(ch);
      const body = Buffer.concat(chunks);
      if (body.length !== size) throw new Error(`đọc thiếu ${body.length}/${size}`);
      await dst.c.send(new PutObjectCommand({ Bucket: dst.bucket, Key: key, Body: body, ContentType: r.ContentType }));
      copied += size; done++;
      if (done % 20 === 0) console.log(`  ${done}/${todo.length}`);
    } catch (e) {
      failed++;
      console.warn(`✗ ${key}: ${(e as Error).message}`);
    }
  }
  console.log(`xong: chép ${done}, lỗi ${failed}`);
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
