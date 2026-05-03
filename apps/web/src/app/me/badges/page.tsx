import { redirect } from "next/navigation";
import { listBadgeCatalog, listUserBadges } from "@feedbackme/core-gamification";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function BadgesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/me/badges");

  const [milestones, earned] = await Promise.all([
    listBadgeCatalog(),
    listUserBadges(session.user.id),
  ]);

  const earnedByCode = new Map(earned.map((u) => [u.badge.code, u]));
  const earnedSkillBadges = earned.filter((u) => u.badge.category === "skill");

  const lockedMilestones = milestones.filter((m) => !earnedByCode.has(m.code));

  const totalAvailable = milestones.length + earnedSkillBadges.length;
  const progressPct =
    totalAvailable === 0 ? 0 : Math.round((earned.length / totalAvailable) * 100);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div>
        <span className="chip-accent">Gamification</span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
          Huy hiệu của bạn
        </h1>
        <p className="mt-2 text-muted">
          Đã đạt <span className="font-semibold text-[rgb(var(--text))]">{earned.length}</span> /{" "}
          {totalAvailable} huy hiệu khả dụng
          {earnedSkillBadges.length > 0 && (
            <> (bao gồm {earnedSkillBadges.length} skill master)</>
          )}
        </p>

        {/* Overall progress bar */}
        <div className="mt-5 max-w-md">
          <div className="flex items-baseline justify-between text-xs">
            <span className="text-muted">Tổng tiến độ</span>
            <span className="font-semibold tabular-nums">{progressPct}%</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]">
            <div
              className="h-2 rounded-full bg-gradient-to-r from-accent-400 via-accent-500 to-accent-600 transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Earned */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">
          Đã đạt được{" "}
          <span className="ml-1 text-sm font-normal text-muted">
            ({earned.length})
          </span>
        </h2>
        {earned.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-token p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-accent-100 text-2xl">
              🏅
            </div>
            <p className="mt-4 text-muted">
              Chưa có huy hiệu nào. Bắt đầu học và làm quiz để mở khóa!
            </p>
          </div>
        ) : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {earned.map((u, idx) => (
              <li
                key={u.id}
                title={u.badge.description}
                className="group relative overflow-hidden rounded-2xl border border-accent-200 bg-gradient-to-br from-accent-50 to-white p-5 text-center shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover animate-fade-in-up"
                style={{ animationDelay: `${Math.min(idx * 40, 240)}ms` }}
              >
                <div className="absolute inset-x-0 -top-12 mx-auto h-24 w-24 rounded-full bg-accent-300/30 blur-2xl transition-opacity group-hover:opacity-100" aria-hidden />
                <div className="relative text-4xl drop-shadow-sm">
                  {u.badge.emoji ?? "🏅"}
                </div>
                <div className="relative mt-2 text-sm font-semibold leading-tight">
                  {u.badge.name}
                </div>
                <div className="relative mt-1 text-[11px] text-faint">
                  Đạt {new Date(u.earnedAt).toLocaleDateString("vi-VN")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Locked */}
      {lockedMilestones.length > 0 && (
        <section className="mt-12">
          <h2 className="text-lg font-semibold">
            Chưa mở khóa{" "}
            <span className="ml-1 text-sm font-normal text-muted">
              ({lockedMilestones.length})
            </span>
          </h2>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {lockedMilestones.map((b) => (
              <li
                key={b.code}
                title={b.description}
                className="rounded-2xl border border-dashed border-token bg-[rgb(var(--surface-muted))] p-5 text-center opacity-80 transition-opacity hover:opacity-100"
              >
                <div className="text-4xl grayscale">{b.emoji ?? "🔒"}</div>
                <div className="mt-2 text-sm font-semibold leading-tight text-muted">
                  {b.name}
                </div>
                <div className="mt-1 text-[11px] text-faint">{b.description}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
