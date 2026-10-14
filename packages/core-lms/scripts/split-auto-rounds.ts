/**
 * Tách "Đợt thi tự động" (AUTO-EXAM-…) — xem src/exam/auto-round-split.ts.
 *
 *   pnpm split:auto-rounds            # dry-run: chỉ đọc, in số liệu
 *   pnpm split:auto-rounds -- --apply # ghi thật, trong một transaction
 *
 * Chạy dry-run trước và đọc kết quả. --apply luôn chạy lại planAutoRoundSplit
 * ngay trước khi ghi, nên không áp một kế hoạch cũ.
 */

import { prisma } from "@feedbackme/db";
import { applyAutoRoundSplit, planAutoRoundSplit } from "../src/exam/auto-round-split";

const apply = process.argv.includes("--apply");

async function main() {
  const plan = await planAutoRoundSplit(prisma);
  console.log(`${apply ? "" : "[dry-run] "}Kế hoạch:`);
  console.log(`  gỡ khỏi đợt (buổi đơn):          ${plan.detachSessionIds.length}`);
  console.log(`  xoá ca (kỳ thi chưa ai làm):     ${plan.deleteSessionIds.length}`);
  console.log(`  đóng ca đang mở (theo lịch):     ${plan.closeScheduledIds.length}`);
  console.log(`  đóng ca đang mở (thủ công):      ${plan.closeManualIds.length}`);
  console.log(`  giữ, đổi thành đợt chính thức:   ${plan.renameRounds.length} đợt`);
  console.log(`  xoá đợt rỗng:                    ${plan.deleteRoundIds.length}`);
  console.log(`  bỏ qua:                          ${plan.skipped.length}`);
  for (const s of plan.skipped) console.log(`    - ca ${s.sessionId} (đợt ${s.roundId}): ${s.reason}`);

  if (!apply) {
    console.log("\nChưa ghi gì. Chạy lại với -- --apply để áp dụng.");
    return;
  }
  // Lập kế hoạch lại ngay trước khi ghi, rồi áp đúng kế hoạch mới đó.
  const fresh = await planAutoRoundSplit(prisma);
  await applyAutoRoundSplit(fresh, prisma);
  console.log("\nĐã ghi xong.");
}

main().finally(() => prisma.$disconnect());
