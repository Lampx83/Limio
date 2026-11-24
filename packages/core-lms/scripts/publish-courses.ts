/**
 * Xuất bản một hoặc nhiều khoá theo slug bằng đúng `publishCourse` của hệ thống (kiểm nhãn kỹ năng, ghi audit).
 *
 *   pnpm publish:courses -- --owner gv@example.com --slugs hsk-4-quyen-1,hsk-4-quyen-2 [--apply]
 *
 * Không có --apply thì chỉ in trạng thái hiện tại. Khoá đã xuất bản thì bỏ qua.
 */
import { prisma } from "@feedbackme/db";
import { publishCourse } from "../src/courses/courses";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const email = arg("owner");
  const slugs = (arg("slugs") ?? "").split(",").filter(Boolean);
  if (!email || slugs.length === 0) throw new Error("Cần --owner <email> và --slugs a,b,c");
  const apply = process.argv.includes("--apply");
  const owner = await prisma.user.findFirst({ where: { email }, select: { id: true } });
  if (!owner) throw new Error(`Không thấy người dùng ${email}`);

  for (const slug of slugs) {
    const c = await prisma.course.findUnique({ where: { slug }, select: { id: true, status: true, title: true } });
    if (!c) {
      console.log(`${slug}: KHÔNG CÓ`);
      continue;
    }
    if (c.status === "published") {
      console.log(`${slug}: đã xuất bản, bỏ qua`);
      continue;
    }
    if (!apply) {
      console.log(`${slug}: ${c.status} (chạy thử)`);
      continue;
    }
    await publishCourse(owner.id, c.id);
    const after = await prisma.course.findUnique({ where: { id: c.id }, select: { status: true, publishedAt: true } });
    console.log(`${slug}: ${c.status} -> ${after?.status} (${after?.publishedAt?.toISOString()})`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
