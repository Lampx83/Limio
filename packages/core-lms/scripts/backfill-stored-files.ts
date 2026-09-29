/**
 * Storage ledger — đưa file ĐÃ CÓ trên đĩa vào sổ ghi dung lượng, rồi gán
 * "tính cho ai" theo tham chiếu (chủ khoá).
 *
 * Idempotent: chạy lại chỉ thêm file còn thiếu và gán lại các file chưa được
 * gán theo tham chiếu. Không bao giờ xoá hay sửa file trên đĩa.
 *
 *   pnpm backfill:stored-files
 *   pnpm backfill:stored-files -- --dry-run
 *
 * Gốc quét: $UPLOADS_ROOT, mặc định apps/web/uploads. Trên production (Docker)
 * chạy trong container web, nơi volume uploads được mount.
 *
 * Giới hạn (P0): chỉ quét đĩa local. Kho S3/R2 chưa liệt kê được — file mới lên
 * S3 vẫn được ghi sổ lúc upload, chỉ file cũ trên S3 là cần bước riêng.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { prisma } from "@feedbackme/db";
import {
  attributeStoredFiles,
  classifyStorageKey,
  getStorageUsageReport,
  recordStoredFile,
} from "../src/storage/index";

const dryRun = process.argv.includes("--dry-run");
// tmp là vùng đệm tự dọn sau 24 giờ — không phải dung lượng người dùng "sở hữu".
const LAYERS = ["public", "private"] as const;

function root(): string {
  return process.env.UPLOADS_ROOT
    ? path.resolve(process.env.UPLOADS_ROOT)
    : path.resolve(__dirname, "../../../apps/web/uploads");
}

async function* walk(dir: string, base = dir): AsyncGenerator<{ key: string; size: number }> {
  let entries: import("node:fs").Dirent[];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const abs = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(abs, base);
    else if (e.isFile()) {
      const stat = await fs.stat(abs);
      yield { key: path.relative(base, abs).split(path.sep).join("/"), size: stat.size };
    }
  }
}

const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

async function main() {
  const uploads = root();
  console.log(`${dryRun ? "[dry-run] " : ""}Quét ${uploads}\n`);

  const stats = { scanned: 0, added: 0, alreadyKnown: 0, bytes: 0 };
  const byKind = new Map<string, { files: number; bytes: number }>();

  for (const layer of LAYERS) {
    const known = new Set(
      (await prisma.storedFile.findMany({ where: { layer }, select: { key: true } })).map((r) => r.key),
    );
    for await (const f of walk(path.join(uploads, layer))) {
      stats.scanned++;
      stats.bytes += f.size;
      const kind = classifyStorageKey(layer, f.key);
      const k = byKind.get(kind) ?? { files: 0, bytes: 0 };
      k.files++;
      k.bytes += f.size;
      byKind.set(kind, k);

      if (known.has(f.key)) {
        stats.alreadyKnown++;
        continue;
      }
      stats.added++;
      if (!dryRun) await recordStoredFile({ layer, key: f.key, sizeBytes: f.size });
    }
  }

  console.log(`Tìm thấy ${stats.scanned} file, ${mb(stats.bytes)}`);
  console.log(`  Đã có trong sổ: ${stats.alreadyKnown} · Cần thêm: ${stats.added}\n`);
  for (const [kind, v] of [...byKind].sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log(`  ${kind.padEnd(20)} ${String(v.files).padStart(6)} file  ${mb(v.bytes).padStart(12)}`);
  }

  if (dryRun) {
    console.log("\n[dry-run] Không ghi gì. Bỏ --dry-run để ghi sổ và gán chủ.");
    return;
  }

  console.log("\nGán chủ theo tham chiếu (chủ khoá)…");
  const r = await attributeStoredFiles({ limit: 1_000_000 });
  console.log(
    `  Xét ${r.scanned} file · gán theo chủ khoá: ${r.attributed} · ` +
      `khoá không còn chủ: ${r.courseWithoutOwner} · chưa ai tham chiếu: ${r.unreferenced}`,
  );

  const report = await getStorageUsageReport({ topN: 10 });
  console.log(`\nTổng trong sổ: ${report.totalFiles} file, ${mb(report.totalBytes)}`);
  console.log(`Chưa gán được cho ai: ${report.unattributed.files} file, ${mb(report.unattributed.bytes)}`);
  console.log("Top người dùng:");
  for (const u of report.topUsers) {
    console.log(`  ${(u.displayName ?? u.email ?? u.userId).padEnd(30)} ${mb(u.bytes).padStart(12)}`);
  }
  console.log(
    `Gói SCORM/H5P (bảng riêng, chưa vào sổ): SCORM ${mb(report.packages.scormBytes)}, H5P ${mb(report.packages.h5pBytes)}`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
