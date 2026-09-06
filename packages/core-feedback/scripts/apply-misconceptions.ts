/**
 * B9.3 bước 3 — áp dụng file đề xuất đã duyệt.
 *
 * Ghi vào DB, nên mọi thứ đều có kiểm tra tiền đề và bọc transaction:
 *   - từ chối option không tồn tại, hoặc đã gắn misconception khác
 *   - từ chối option thuộc câu ordering/matching kể cả khi file có (chặn tầng cuối)
 *   - tạo FeedbackTemplate cho mỗi misconception mới — thiếu template thì
 *     misconception vô dụng, feedback vẫn rơi về generic
 *
 *   pnpm --filter @feedbackme/core-feedback apply:misconceptions -- \
 *     --file=./proposals-uiux.json --dry-run
 */

import { prisma } from "@feedbackme/db";
import fs from "node:fs";

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

const filePath = arg("file");
const dryRun = process.argv.includes("--dry-run");

const TAGGABLE = new Set(["mcq", "true_false"]);
const CODE_RE = /^[a-z][a-z0-9_]*$/;

interface ProposalOption {
  optionId: string;
  optionLabel: string;
  misconceptionCode: string | null;
  misconceptionName: string | null;
  misconceptionDescription: string | null;
  feedbackBody: string | null;
  skip?: boolean;
}

interface ProposalFile {
  course: string;
  items: Array<{ questionId: string; options: ProposalOption[] }>;
}

async function main() {
  if (!filePath) {
    console.error("Thiếu --file=<đường dẫn json> [--dry-run]");
    process.exitCode = 1;
    return;
  }
  const data = JSON.parse(fs.readFileSync(filePath, "utf8")) as ProposalFile;

  // Gom mọi phương án đã duyệt.
  const accepted: ProposalOption[] = [];
  for (const item of data.items ?? []) {
    for (const o of item.options ?? []) {
      if (o.skip === true) continue; // AC-3.1
      if (!o.misconceptionCode) continue; // để trống là hợp lệ, không ép
      accepted.push(o);
    }
  }
  if (accepted.length === 0) {
    console.log("Không có mục nào được duyệt để áp dụng.");
    return;
  }

  // ── Kiểm tra tiền đề trước khi ghi bất cứ thứ gì (AC-3.7, AC-3.8) ────────
  const optionIds = accepted.map((o) => o.optionId);
  const options = await prisma.questionOption.findMany({
    where: { id: { in: optionIds } },
    select: {
      id: true,
      isCorrect: true,
      misconceptionId: true,
      question: { select: { type: true } },
    },
  });
  const byId = new Map(options.map((o) => [o.id, o]));

  const loi: string[] = [];
  for (const a of accepted) {
    const o = byId.get(a.optionId);
    if (!o) {
      loi.push(`option ${a.optionId}: không tồn tại`);
      continue;
    }
    if (o.isCorrect) loi.push(`option ${a.optionId}: là đáp án ĐÚNG, không gắn được`);
    if (!TAGGABLE.has(o.question.type)) {
      loi.push(
        `option ${a.optionId}: thuộc câu ${o.question.type} — loại này khớp giả hoặc không khớp, từ chối`,
      );
    }
    if (!CODE_RE.test(a.misconceptionCode!)) {
      loi.push(`option ${a.optionId}: mã "${a.misconceptionCode}" sai định dạng ^[a-z][a-z0-9_]*$`);
    }
    if (a.misconceptionCode && !a.feedbackBody) {
      loi.push(`option ${a.optionId}: có mã nhưng thiếu feedbackBody`);
    }
  }
  if (loi.length > 0) {
    console.error(`Từ chối áp dụng — ${loi.length} vấn đề:`);
    for (const l of loi.slice(0, 30)) console.error(`  - ${l}`);
    if (loi.length > 30) console.error(`  ... và ${loi.length - 30} nữa`);
    process.exitCode = 1;
    return;
  }

  // ── Thống kê trước khi ghi ──────────────────────────────────────────────
  const codes = Array.from(new Set(accepted.map((a) => a.misconceptionCode!)));
  const existing = await prisma.misconception.findMany({
    where: { code: { in: codes } },
    select: { id: true, code: true },
  });
  const existingByCode = new Map(existing.map((m) => [m.code, m.id]));
  const newCodes = codes.filter((c) => !existingByCode.has(c));

  const withTemplate = await prisma.feedbackTemplate.findMany({
    where: {
      scope: "per_misconception",
      misconceptionId: { in: existing.map((m) => m.id) },
    },
    select: { misconceptionId: true },
  });
  const codesWithTemplate = new Set(
    withTemplate.flatMap((t) =>
      t.misconceptionId ? [existing.find((m) => m.id === t.misconceptionId)!.code] : [],
    ),
  );

  // AC-3.6 — đã gắn đúng mã đó rồi thì lần chạy sau không đếm nữa.
  const toAssign = accepted.filter((a) => {
    const o = byId.get(a.optionId)!;
    if (o.misconceptionId === null) return true;
    const already = existingByCode.get(a.misconceptionCode!);
    return o.misconceptionId !== already;
  });
  const conflicts = toAssign.filter((a) => byId.get(a.optionId)!.misconceptionId !== null);
  if (conflicts.length > 0) {
    console.error(
      `Từ chối: ${conflicts.length} phương án đã gắn misconception KHÁC. Gỡ tay trước nếu thật sự muốn đổi:`,
    );
    for (const c of conflicts.slice(0, 10)) console.error(`  - ${c.optionId}`);
    process.exitCode = 1;
    return;
  }

  console.log(
    `${dryRun ? "[dry-run] " : ""}Áp dụng cho khoá ${data.course}:\n` +
      `  misconception mới:        ${newCodes.length}\n` +
      `  template mới cần tạo:     ${codes.filter((c) => !codesWithTemplate.has(c)).length}\n` +
      `  phương án sẽ gắn:         ${toAssign.length}`,
  );
  if (dryRun) {
    for (const c of newCodes.slice(0, 20)) console.log(`    + ${c}`);
    return;
  }

  // ── Ghi, tất cả trong một transaction ───────────────────────────────────
  const stats = { misconceptions: 0, templates: 0, options: 0 };
  await prisma.$transaction(async (tx) => {
    const idByCode = new Map(existingByCode);

    for (const a of accepted) {
      const code = a.misconceptionCode!;
      if (!idByCode.has(code)) {
        const m = await tx.misconception.create({
          data: {
            code,
            name: a.misconceptionName ?? code,
            description: a.misconceptionDescription ?? a.misconceptionName ?? code,
          },
        });
        idByCode.set(code, m.id);
        stats.misconceptions += 1;
      }
      const misconceptionId = idByCode.get(code)!;

      // AC-3.3 — không có template thì misconception không đổi được gì.
      const hasTemplate = await tx.feedbackTemplate.findFirst({
        where: { scope: "per_misconception", misconceptionId },
        select: { id: true },
      });
      if (!hasTemplate && a.feedbackBody) {
        await tx.feedbackTemplate.create({
          data: {
            scope: "per_misconception",
            misconceptionId,
            body: a.feedbackBody,
            // B9 — feedback giải thích chỗ nhầm là tầng process / km.
            level: "process",
            elaboration: "km",
          },
        });
        stats.templates += 1;
      }

      const current = byId.get(a.optionId)!;
      if (current.misconceptionId === null) {
        await tx.questionOption.update({
          where: { id: a.optionId },
          data: { misconceptionId },
        });
        stats.options += 1;
      }
    }
  });

  console.log(
    `\nXong: +${stats.misconceptions} misconception, +${stats.templates} template, ` +
      `+${stats.options} phương án đã gắn`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
