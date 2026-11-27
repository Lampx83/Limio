/**
 * Tài khoản admin mẫu cho DB dev: mỗi loại tổ chức một admin, để xem menu quản trị và nhãn "Admin trung tâm / trường / NXB".
 *   pnpm --filter @feedbackme/web exec tsx scripts/seed-demo-admins.ts
 * Idempotent. Từ chối chạy nếu DATABASE_URL không phải máy local. Mật khẩu chung: password1234 (chỉ dùng trên dev).
 */
import { prisma } from "@feedbackme/db";
import { registerUser } from "@feedbackme/core-lms";

const PASSWORD = "password1234";

const ADMINS = [
  { email: "admin-trungtam@demo.limio.dev", name: "Admin trung tâm (Demo)", kind: "center", orgCode: "TT-DEMO", orgName: "Trung tâm demo" },
  { email: "admin-truong@demo.limio.dev", name: "Admin trường (Demo)", kind: "school", orgCode: "HUST-DEMO", orgName: "HUST" },
  { email: "admin-nxb@demo.limio.dev", name: "Admin NXB (Demo)", kind: "publisher", orgCode: "nxb-demo", orgName: "NXB Demo" },
] as const;

async function main() {
  if (!/@(localhost|127\.0\.0\.1)(:|\/)/.test(process.env.DATABASE_URL ?? "")) {
    throw new Error("Chỉ chạy trên DB local (DATABASE_URL phải trỏ localhost).");
  }
  for (const a of ADMINS) {
    // Tổ chức: dùng cái đã có theo mã; chưa có thì tạo đúng loại.
    const org =
      (await prisma.organization.findUnique({ where: { code: a.orgCode } })) ??
      (await prisma.organization.create({ data: { code: a.orgCode, name: a.orgName, kind: a.kind, centerEnabled: a.kind === "center" } }));
    if (org.kind !== a.kind) throw new Error(`Tổ chức ${a.orgCode} đang là loại ${org.kind}, không phải ${a.kind}.`);

    let user = await prisma.user.findUnique({ where: { email: a.email } });
    if (!user) {
      const { userId } = await registerUser({ email: a.email, password: PASSWORD, displayName: a.name }, "http://localhost:3000");
      user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    }
    if (!user.emailVerifiedAt) await prisma.user.update({ where: { id: user.id }, data: { emailVerifiedAt: new Date() } });
    await prisma.organizationAdmin.upsert({
      where: { organizationId_userId: { organizationId: org.id, userId: user.id } },
      create: { organizationId: org.id, userId: user.id },
      update: {},
    });
    console.log(`${a.kind.padEnd(9)} ${a.email}  →  ${org.name} (${org.code})`);
  }
  console.log(`\nMật khẩu chung: ${PASSWORD}`);
}

main().finally(() => prisma.$disconnect());
