/**
 * Báo cáo file mồ côi — CHỈ ĐỌC, script này không có khả năng xoá.
 * Dùng để xem trước danh sách trước khi bật STORAGE_ORPHAN_SWEEP=apply.
 *
 *   pnpm storage:orphans
 *   pnpm storage:orphans -- --days=60 --list      # in đủ danh sách thay vì 20 mẫu
 */

import { prisma } from "@feedbackme/db";
import { findOrphanedFiles } from "../src/storage/index";

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}=`))?.split("=")[1];
const days = Math.max(7, Number.parseInt(arg("days") ?? "30", 10) || 30);
const listAll = process.argv.includes("--list");
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

async function main() {
  const scan = await findOrphanedFiles({ olderThanDays: days });
  const bytes = scan.orphans.reduce((s, o) => s + o.sizeBytes, 0);

  console.log(`File không đổi quá ${days} ngày (đúng loại được dọn): ${scan.eligible}`);
  console.log(`  Còn được dùng:            ${scan.referenced}`);
  console.log(`  Tên lạ, bỏ qua:           ${scan.unverifiable}`);
  console.log(`  Chưa đủ ngày (chưa xét):  ${scan.tooRecent}`);
  console.log(`  MỒ CÔI:                   ${scan.orphans.length} file, ${mb(bytes)}`);
  console.log(`  (đối chiếu với ${scan.referencedTokens} tên file xuất hiện trong DB)\n`);

  const byKind = new Map<string, { files: number; bytes: number }>();
  for (const o of scan.orphans) {
    const k = byKind.get(o.kind) ?? { files: 0, bytes: 0 };
    k.files++;
    k.bytes += o.sizeBytes;
    byKind.set(o.kind, k);
  }
  for (const [kind, v] of [...byKind].sort((a, b) => b[1].bytes - a[1].bytes)) {
    console.log(`  ${kind.padEnd(20)} ${String(v.files).padStart(6)} file  ${mb(v.bytes).padStart(12)}`);
  }

  const shown = listAll ? scan.orphans : scan.orphans.slice(0, 20);
  if (shown.length) console.log(`\n${listAll ? "Toàn bộ" : "20 mẫu đầu"} (cũ nhất trước):`);
  for (const o of shown) {
    console.log(`  ${String(o.ageDays).padStart(4)} ngày  ${mb(o.sizeBytes).padStart(10)}  ${o.layer}/${o.key}`);
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error && e.message === "reference_scan_empty"
      ? "DỪNG AN TOÀN: quét ra 0 tham chiếu trong DB trong khi có file cần xét — nhiều khả năng quét hỏng."
      : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
