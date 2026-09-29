/**
 * D.1 — Smoke test cho S3/R2 storage TRƯỚC KHI tin tưởng chạy migrate hay
 * đổi công tắc production. Không đụng dữ liệu thật: tự tạo, đọc lại, rồi xoá
 * đúng 1 object test cho mỗi layer (public/private/tmp).
 *
 * Chạy sau khi đã set S3_BUCKET (+ S3_ENDPOINT/S3_REGION/creds, và tuỳ chọn
 * S3_BUCKET_PUBLIC/S3_BUCKET_PRIVATE) trong môi trường, TRƯỚC khi set các
 * biến đó trong .env.prod thật:
 *
 *   S3_BUCKET=feedbackme-private \
 *   S3_BUCKET_PUBLIC=feedbackme-public \
 *   S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com \
 *   S3_REGION=auto \
 *   S3_ACCESS_KEY_ID=... S3_SECRET_ACCESS_KEY=... \
 *   tsx scripts/verify-s3-storage.ts
 *
 * Thoát mã khác 0 nếu bất kỳ layer nào lỗi — an toàn để dùng làm gate trước
 * khi chạy migrate-uploads-to-s3.ts hay redeploy web với S3 bật.
 */
import { randomBytes } from "node:crypto";
import { getLayerStorage, localAbsPath } from "../src/lib/storage";
import type { StorageLayer } from "../src/lib/storage-keys";

const LAYERS: StorageLayer[] = ["public", "private", "tmp"];

async function verifyLayer(layer: StorageLayer): Promise<void> {
  if (!process.env.S3_BUCKET) {
    throw new Error(
      "S3_BUCKET chưa được set — script này chỉ có ý nghĩa khi test cấu hình S3, " +
        "nếu không set gì thì storage.ts sẽ fallback về local disk và test sẽ " +
        "'pass' giả (không kiểm tra được gì).",
    );
  }

  const key = `_smoke-test/${layer}-${Date.now()}-${randomBytes(4).toString("hex")}.txt`;
  const payload = Buffer.from(`feedbackme storage smoke test — ${new Date().toISOString()}`);

  const adapter = getLayerStorage(layer);

  // Nếu vẫn resolve ra path local nghĩa là S3_BUCKET không được đọc đúng
  // (env chưa export vào process này, hoặc typo tên biến).
  const asLocalPath = localAbsPath({ layer, key });
  if (asLocalPath) {
    throw new Error(
      `layer=${layer} vẫn đang dùng LocalFsAdapter (path: ${asLocalPath}) dù ` +
        "S3_BUCKET đã set — kiểm tra lại biến môi trường có được export vào " +
        "đúng process chạy script này không.",
    );
  }

  await adapter.put(key, payload, "text/plain");

  const exists = await adapter.exists(key);
  if (!exists) throw new Error(`layer=${layer}: put() xong nhưng exists() trả false`);

  const readBack = await adapter.get(key);
  if (!readBack.equals(payload)) {
    throw new Error(
      `layer=${layer}: nội dung đọc lại KHÔNG khớp — ghi ${payload.length} byte, ` +
        `đọc lại ${readBack.length} byte`,
    );
  }

  await adapter.delete(key);
  const existsAfterDelete = await adapter.exists(key);
  if (existsAfterDelete) {
    throw new Error(`layer=${layer}: delete() xong nhưng exists() vẫn trả true`);
  }

  console.log(`  OK  layer=${layer}  bucket-env=${bucketEnvFor(layer)}`);
}

function bucketEnvFor(layer: StorageLayer): string {
  const specific = process.env[`S3_BUCKET_${layer.toUpperCase()}`];
  return specific ? `S3_BUCKET_${layer.toUpperCase()}=${specific}` : `S3_BUCKET=${process.env.S3_BUCKET}`;
}

async function main() {
  console.log("Kiểm tra put → exists → get → delete cho từng storage layer...\n");
  const failures: string[] = [];
  for (const layer of LAYERS) {
    try {
      await verifyLayer(layer);
    } catch (e) {
      failures.push(`${layer}: ${e instanceof Error ? e.message : String(e)}`);
      console.error(`  FAIL layer=${layer}  —  ${e instanceof Error ? e.message : e}`);
    }
  }

  if (failures.length > 0) {
    console.error(`\n${failures.length}/${LAYERS.length} layer lỗi. KHÔNG chạy migrate hay đổi công tắc production.`);
    process.exit(1);
  }
  console.log("\nTất cả layer OK. An toàn để chạy migrate-uploads-to-s3.ts hoặc set env này trong .env.prod.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
