/**
 * Tạo tài khoản giảng viên MẪU (dữ liệu giả) trên dev DB để chụp ảnh cho khoá
 * "Hướng dẫn sử dụng Limio". Không dùng dữ liệu người thật: ảnh chụp sẽ công khai.
 *
 *   DEMO_PASSWORD='...' pnpm --filter @feedbackme/db exec tsx \
 *     src/seed-demo-instructor.ts
 *
 * Mật khẩu lấy từ env (repo public, không hardcode). Idempotent.
 * Muốn bấm chip "Vào" ở màn hình đăng nhập dev thì chạy với DEMO_PASSWORD bằng mật khẩu
 * dev dùng chung (hằng DEMO_PASSWORD trong app/(auth)/signin/SignInForm.tsx).
 */
import bcrypt from "bcryptjs";
import { PrismaClient } from "./generated/client";

const EMAIL = "giangvien.mau@feedbackme.dev";
const NAME = "Giảng viên Mẫu";
const prisma = new PrismaClient();

async function main() {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12) throw new Error("DEMO_PASSWORD chưa set hoặc ngắn hơn 12 ký tự.");
  for (const name of ["learner", "instructor"]) {
    await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  }
  const passwordHash = await bcrypt.hash(password, 12);
  // Đánh dấu đã xem hướng dẫn lần đầu, không thì cửa sổ hướng dẫn che mọi ảnh chụp.
  const seen = new Date().toISOString();
  const helpTourCompletedByRole = { instructor: seen, learner: seen };
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { passwordHash, displayName: NAME, emailVerifiedAt: new Date(), helpTourCompletedByRole },
    create: { email: EMAIL, passwordHash, displayName: NAME, emailVerifiedAt: new Date(), helpTourCompletedByRole },
  });
  const hasPw = await prisma.authProvider.findFirst({ where: { userId: user.id, provider: "password" } });
  if (!hasPw) await prisma.authProvider.create({ data: { userId: user.id, provider: "password", providerUserId: EMAIL } });
  for (const name of ["learner", "instructor"]) {
    const role = await prisma.role.findUniqueOrThrow({ where: { name } });
    const has = await prisma.userRole.findFirst({ where: { userId: user.id, roleId: role.id } });
    if (!has) await prisma.userRole.create({ data: { userId: user.id, roleId: role.id, grantedBy: user.id } });
  }
  console.log(`OK ${EMAIL} (${user.id})`);
}
main().catch((e) => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
