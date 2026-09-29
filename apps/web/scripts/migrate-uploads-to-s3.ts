/**
 * D.1 — Chuyển file upload cũ từ local disk (apps/web/uploads/{public,private,tmp})
 * lên S3/R2, sau khi đã bật S3_BUCKET trong môi trường chạy script này.
 *
 * KHÔNG bao gồm SCORM/H5P package (apps/web/uploads/{scorm,h5p}/{packageId}/) —
 * hai loại đó ghi thẳng xuống local disk qua packages/core-lms/src/scorm/scorm.ts
 * và h5p/h5p.ts, hoàn toàn ngoài storage.ts. Xem "SCORM/H5P vẫn local" trong
 * ghi chú cuối file — cần một thay đổi riêng, rủi ro cao hơn, không gộp ở đây.
 *
 * Vì local path CHÍNH LÀ storage key (xem storage-keys.ts — layout đã sharded
 * sẵn dạng public/avatars/{userId}/{file}, public/lesson-media/videos/{yyyy}/{mm}/{file}...),
 * script chỉ cần đi bộ đệ quy 3 thư mục layer và ghi mỗi file lên S3 bằng
 * đúng path tương đối làm key — không cần suy luận theo loại nội dung.
 *
 * An toàn: mặc định DRY-RUN (chỉ liệt kê + tính tổng dung lượng). Với --apply,
 * COPY file lên S3 (không xoá bản gốc trên local disk — việc xoá cân nhắc
 * riêng, thủ công, sau khi đã xác nhận app chạy ổn với S3 một thời gian).
 * Idempotent: file đã tồn tại đúng kích thước ở đích thì bỏ qua, an toàn để
 * chạy lại nhiều lần (vd nếu bị ngắt giữa chừng).
 *
 * Usage (chạy TRÊN server 224, trong container web hoặc host có mount volume
 * web-uploads — không chạy được từ máy dev vì file không nằm ở đó):
 *   tsx scripts/migrate-uploads-to-s3.ts                # dry-run toàn bộ
 *   tsx scripts/migrate-uploads-to-s3.ts --apply         # copy thật
 *   tsx scripts/migrate-uploads-to-s3.ts --apply --only public   # 1 layer trước
 *   UPLOADS_ROOT=/custom/path tsx scripts/migrate-uploads-to-s3.ts
 *
 * Trước khi chạy --apply, BẮT BUỘC đã chạy verify-s3-storage.ts thành công.
 */
import { promises as fs } from "node:fs";
import path from "node:path";
import { getPrimaryS3Storage } from "../src/lib/storage";
import type { StorageLayer } from "../src/lib/storage-keys";

const LAYERS: StorageLayer[] = ["public", "private", "tmp"];
const APPLY = process.argv.includes("--apply");
const onlyIdx = process.argv.indexOf("--only");
const ONLY_LAYER = onlyIdx >= 0 ? (process.argv[onlyIdx + 1] as StorageLayer | undefined) : undefined;

function localRoot(): string {
  const override = process.env.UPLOADS_ROOT;
  if (override) return path.resolve(override);
  return path.resolve(process.cwd(), "uploads");
}

const EXT_TO_MIME: Record<string, string> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".ogv": "video/ogg",
  ".mov": "video/quicktime",
  ".mkv": "video/x-matroska",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".pdf": "application/pdf",
  ".vtt": "text/vtt",
  ".srt": "application/x-subrip",
  ".html": "text/html",
  ".htm": "text/html",
  ".txt": "text/plain",
};
function guessMime(filename: string): string | undefined {
  return EXT_TO_MIME[path.extname(filename).toLowerCase()];
}

async function* walk(dir: string): AsyncGenerator<string> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return;
    throw e;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

interface Stats {
  scanned: number;
  copied: number;
  skippedAlready: number;
  bytesCopied: number;
  failed: { key: string; error: string }[];
}

async function migrateLayer(layer: StorageLayer, root: string, stats: Stats): Promise<void> {
  const layerRoot = path.join(root, layer);
  // Dùng adapter S3 THUẦN (không qua getLayerStorage/FallbackReadAdapter) —
  // nếu dùng getLayerStorage() ở đây, exists() sẽ luôn báo "đã có" giả vì
  // fallback-đọc-local đương nhiên thấy đúng những file mình đang định copy,
  // khiến script tưởng đã migrate xong mà không copy gì cả.
  const dest = getPrimaryS3Storage(layer);
  if (!dest) {
    throw new Error(
      `layer=${layer}: S3_BUCKET chưa set trong process này — chạy ` +
        "verify-s3-storage.ts trước để chắc chắn env đúng.",
    );
  }

  console.log(`\n[${layer}] quét ${layerRoot} ...`);
  for await (const absPath of walk(layerRoot)) {
    const key = path.relative(layerRoot, absPath).split(path.sep).join("/");
    stats.scanned++;

    let already = false;
    try {
      already = await dest.exists(key);
    } catch {
      already = false;
    }
    if (already) {
      stats.skippedAlready++;
      continue;
    }

    try {
      const buf = await fs.readFile(absPath);
      await dest.put(key, buf, guessMime(path.basename(absPath)));
      stats.copied++;
      stats.bytesCopied += buf.byteLength;
      if (stats.copied % 50 === 0) {
        console.log(`  ... đã copy ${stats.copied} file (${(stats.bytesCopied / 1024 / 1024).toFixed(1)} MB)`);
      }
    } catch (e) {
      stats.failed.push({ key: `${layer}/${key}`, error: e instanceof Error ? e.message : String(e) });
    }
  }
}

async function main() {
  const root = localRoot();
  const layers = ONLY_LAYER ? [ONLY_LAYER] : LAYERS;
  if (ONLY_LAYER && !LAYERS.includes(ONLY_LAYER)) {
    throw new Error(`--only phải là một trong: ${LAYERS.join(", ")}`);
  }

  console.log(`Root local: ${root}`);
  console.log(`Chế độ: ${APPLY ? "APPLY (copy thật lên S3)" : "DRY-RUN (chỉ liệt kê)"}`);
  console.log(`Layer: ${layers.join(", ")}`);
  console.log(
    "LƯU Ý: script này KHÔNG xoá file gốc trên local disk và KHÔNG xử lý " +
      "apps/web/uploads/{scorm,h5p}/ (packages riêng, ngoài phạm vi).",
  );

  if (!APPLY) {
    // Dry-run: chỉ đếm + tổng dung lượng, không đụng S3 (không cần S3_BUCKET
    // set để chạy dry-run — hữu ích để biết trước sẽ tốn bao nhiêu dung lượng
    // trên bucket trước khi cấu hình credentials thật).
    for (const layer of layers) {
      const layerRoot = path.join(root, layer);
      let count = 0;
      let bytes = 0;
      for await (const absPath of walk(layerRoot)) {
        count++;
        try {
          bytes += (await fs.stat(absPath)).size;
        } catch {
          /* file biến mất giữa lúc quét — bỏ qua khi đếm ước lượng */
        }
      }
      console.log(`[${layer}] ${count} file, ${(bytes / 1024 / 1024).toFixed(1)} MB`);
    }
    console.log("\nChạy lại với --apply (sau khi verify-s3-storage.ts pass) để copy thật.");
    return;
  }

  const stats: Stats = { scanned: 0, copied: 0, skippedAlready: 0, bytesCopied: 0, failed: [] };
  for (const layer of layers) {
    await migrateLayer(layer, root, stats);
  }

  console.log("\n=== Kết quả ===");
  console.log(`Quét: ${stats.scanned}`);
  console.log(`Copy mới: ${stats.copied} (${(stats.bytesCopied / 1024 / 1024).toFixed(1)} MB)`);
  console.log(`Đã có sẵn ở đích (bỏ qua): ${stats.skippedAlready}`);
  console.log(`Lỗi: ${stats.failed.length}`);
  for (const f of stats.failed) console.log(`  ! ${f.key}: ${f.error}`);

  if (stats.failed.length > 0) {
    console.log(
      "\nCó lỗi — CHƯA nên coi là migrate xong. Chạy lại lệnh y hệt (idempotent, " +
        "sẽ bỏ qua file đã copy thành công) sau khi xử lý nguyên nhân lỗi.",
    );
    process.exit(1);
  }
  console.log(
    "\nXong. File gốc trên local disk VẪN CÒN NGUYÊN — chỉ xoá thủ công sau khi " +
      "đã xác nhận app phục vụ tốt từ S3 (vài ngày quan sát), và đã có backup.",
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
