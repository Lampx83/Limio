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
      email: true,
      displayName: true,
      avatarUrl: true,
      locale: true,
      timezone: true,
      leaderboardOptOut: true,
      authProviders: { select: { provider: true } },
    },
  });
  const hasPassword = me.authProviders.some((p) => p.provider === "password");

  return (
    <main className="mx-auto max-w-6xl px-4 py-6 lg:px-6">
      <div>
        <span className="chip-brand">Tài khoản</span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">Cài đặt</h1>
        <p className="mt-2 text-muted">
          Quản lý hồ sơ, quyền riêng tư và tùy chọn hiển thị.
        </p>
      </div>
      <div className="mt-8">
        <SettingsForm
          initial={{
            email: me.email,
            displayName: me.displayName,
            avatarUrl: me.avatarUrl,
            locale: me.locale,
            timezone: me.timezone,
            leaderboardOptOut: me.leaderboardOptOut,
            hasPassword,
          }}
        />
      </div>
    </main>
  );
}
