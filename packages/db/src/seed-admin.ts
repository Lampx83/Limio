/**
 * Seed đúng 1 tài khoản Admin (+ Learner) cho một server mới, để có chỗ đăng
 * nhập bắt đầu cài đặt hệ thống khi chưa cấu hình được SSO.
 *
 *   ADMIN_EMAIL=you@example.com ADMIN_PASSWORD='...' pnpm exec tsx src/seed-admin.ts
 *
 * Email/password lấy từ env — repo public nên không được hardcode. Mật khẩu
 * tối thiểu 12 ký tự. Idempotent: chạy lại sẽ đặt lại mật khẩu và đảm bảo
 * đủ role. Cũng upsert các Role (như seed.ts) để chạy được trên DB trống.
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "./generated/client";
import { RoleName } from "@feedbackme/shared-types";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_NAME?.trim() || "Admin";

  if (!email || !email.includes("@")) throw new Error("ADMIN_EMAIL chưa set hoặc không hợp lệ.");
  if (!password || password.length < 12) {
    throw new Error("ADMIN_PASSWORD chưa set hoặc ngắn hơn 12 ký tự.");
  }

  for (const name of Object.values(RoleName)) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({
    where: { email },
    include: { authProviders: true },
  });

  const userId = existing
    ? (
        await prisma.user.update({
          where: { id: existing.id },
          data: { passwordHash, emailVerifiedAt: new Date() },
        })
      ).id
    : (
        await prisma.user.create({
          data: {
            email,
            passwordHash,
            displayName,
            emailVerifiedAt: new Date(),
          },
        })
      ).id;

  if (!existing?.authProviders.some((p) => p.provider === "password")) {
    await prisma.authProvider.create({
      data: { userId, provider: "password", providerUserId: email },
    });
  }

  for (const roleName of [RoleName.Learner, RoleName.Admin]) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
    const hasRole = await prisma.userRole.findFirst({ where: { userId, roleId: role.id } });
    if (!hasRole) {
      await prisma.userRole.create({ data: { userId, roleId: role.id, grantedBy: userId } });
    }
  }

  console.log(`${existing ? "Refreshed" : "Created"} admin ${email}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
