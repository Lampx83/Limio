import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import SettingsForm from "./SettingsForm";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/me/settings");

  const me = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: {
      displayName: true,
      locale: true,
      timezone: true,
      leaderboardOptOut: true,
    },
  });

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div>
        <span className="chip-brand">Tài khoản</span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">Cài đặt</h1>
        <p className="mt-2 text-muted">
          Quản lý hồ sơ, quyền riêng tư và tùy chọn hiển thị.
        </p>
      </div>
      <div className="mt-8">
        <SettingsForm initial={me} />
      </div>
    </main>
  );
}
