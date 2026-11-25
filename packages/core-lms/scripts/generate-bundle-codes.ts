/**
 * Sinh mã kích hoạt COMBO và ghi ra tệp CSV (docs/tieu-chi/combo-khoa-hoc.md, AC8).
 *
 *   pnpm generate:bundle-codes -- --bundle hsk-4-tron-bo --count 20 --admin admin@example.com --out ma.csv [--note "đợt 1"] [--apply]
 *
 * Không có --apply thì chỉ in việc sẽ làm. Mã tự nó cấp quyền: tệp CSV chỉ để admin gửi cho người mua, đừng commit,
 * đừng dán vào chat; script không in mã ra màn hình.
 */
import { writeFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { generateBundleCodes } from "../src/learning/bundleCode";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const slug = arg("bundle");
  const adminEmail = arg("admin");
  const out = arg("out");
  const count = Number(arg("count") ?? "0");
  if (!slug || !adminEmail || !out || !Number.isInteger(count) || count < 1) {
    throw new Error("Cần --bundle <slug> --count <n> --admin <email> --out <tệp.csv>");
  }
  const apply = process.argv.includes("--apply");
  const admin = await prisma.user.findFirst({ where: { email: adminEmail }, select: { id: true } });
  if (!admin) throw new Error(`Không thấy ${adminEmail}`);
  const bundle = await prisma.courseBundle.findUnique({
    where: { slug },
    select: { id: true, title: true, status: true, durationMonths: true, items: { select: { course: { select: { slug: true } } } } },
  });
  if (!bundle) throw new Error(`Không thấy combo ${slug}`);
  console.log(`Combo ${slug} [${bundle.status}] "${bundle.title}", ${bundle.items.length} khoá, hạn ${bundle.durationMonths ?? "vĩnh viễn"} tháng: sinh ${count} mã`);
  if (!apply) {
    console.log("Chạy thử xong (chưa ghi). Thêm --apply để thực hiện.");
    return;
  }
  const codes = await generateBundleCodes(admin.id, bundle.id, count, { note: arg("note") });
  writeFileSync(out, ["ma_kich_hoat,combo,ghi_chu", ...codes.map((c) => `${c.code},${slug},${(arg("note") ?? "").replace(/,/g, " ")}`)].join("\n") + "\n", { mode: 0o600 });
  console.log(`Đã sinh ${codes.length} mã, ghi vào ${out} (quyền 600).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
