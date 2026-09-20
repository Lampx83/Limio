import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { TournamentStatus } from "@feedbackme/db";
import { isAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import TournamentFilter from "./TournamentFilter";
import { EmptyState } from "@/components/ui";
import { formatDate as formatDateVN } from "@/lib/datetime";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, string> = {
  draft: "chip",
  published: "chip-accent",
  active: "chip-success",
  ended: "chip",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Nháp",
  published: "Đã publish",
  active: "Đang diễn ra",
  ended: "Đã kết thúc",
};

const VALID_STATUSES: TournamentStatus[] = ["draft", "published", "active", "ended"];

function formatDate(d: Date) {
  return formatDateVN(d);
}

export default async function InstructorTournamentsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/instructor/tournaments");
  const userId = session.user.id;

  const admin = await isAdmin(userId);
  const statusFilter = searchParams.status;

  // Validate status filter is a valid enum value
  const validStatus = statusFilter && statusFilter !== "all" && VALID_STATUSES.includes(statusFilter as TournamentStatus)
    ? (statusFilter as TournamentStatus)
    : undefined;

  const tournaments = await prisma.tournament.findMany({
    where: {
      ...(admin ? {} : { creatorId: userId }),
      ...(validStatus ? { status: validStatus } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      course: { select: { title: true, slug: true } },
      _count: { select: { registrations: true, missions: true } },
    },
  });

  return (
    <main>
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">
            Đấu trường của tôi
          </h1>
          <p className="mt-2 text-muted">
            {tournaments.length > 0
              ? `${tournaments.length} đấu trường`
              : "Bạn chưa tạo đấu trường nào."}
          </p>
        </div>
        <Link href="/instructor/tournaments/new" className="btn-primary">
          + Tạo đấu trường mới
        </Link>
      </div>

      {/* Filter */}
      <TournamentFilter />

      {/* List */}
      {tournaments.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon="🏆"
          title={validStatus ? `Không có đấu trường ở trạng thái "${STATUS_LABEL[validStatus]}"` : "Chưa có đấu trường nào"}
          description={validStatus ? "Đổi filter trạng thái hoặc tạo đấu trường mới." : "Tạo đấu trường đầu tiên để học viên tham gia missions, leaderboard, prize."}
          actions={[{ label: "+ Tạo đấu trường mới", href: "/instructor/tournaments/new" }]}
        />
      ) : (
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {tournaments.map((t) => {
            const isTeam = t.teamSize > 1;
            const accent =
              t.status === "draft"
                ? "from-slate-300 to-slate-200 dark:from-slate-600 dark:to-slate-700"
                : t.status === "ended"
                  ? "from-slate-400 to-slate-300 dark:from-slate-500 dark:to-slate-600"
                  : isTeam
                    ? "from-indigo-500 to-sky-400"
                    : t.status === "active"
                      ? "from-rose-500 to-orange-400"
                      : "from-amber-400 to-yellow-300";
            return (
              <li key={t.id}>
                <Link href={`/instructor/tournaments/${t.id}`} className="group block h-full" prefetch={false}>
                  <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-card-hover">
                    <div className={`h-1.5 w-full bg-gradient-to-r ${accent}`} aria-hidden />

                    <div className="flex flex-1 flex-col p-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={STATUS_TONE[t.status] ?? "chip"}>
                          {STATUS_LABEL[t.status] ?? t.status}
                        </span>
                        <span className="rounded-full bg-[rgb(var(--surface-muted))] px-2.5 py-0.5 text-xs font-medium text-muted">
                          {isTeam ? `Đội ${t.teamSize}` : "Cá nhân"}
                        </span>
                      </div>

                      <h2 className="mt-3 text-lg font-bold leading-snug transition-colors group-hover:text-brand-600">
                        {t.title}
                      </h2>
                      <p className="mt-1 text-xs text-faint">
                        {t.course ? t.course.title : "Toàn nền tảng"}
                      </p>

                      <dl className="mt-4 grid grid-cols-3 divide-x divide-[rgb(var(--border))] rounded-xl bg-[rgb(var(--surface-muted))] py-2.5 text-center">
                        <div className="px-2">
                          <dd className="text-base font-bold">{t._count.registrations}</dd>
                          <dt className="text-[10px] uppercase tracking-wide text-muted">người tham gia</dt>
                        </div>
                        <div className="px-2">
                          <dd className="text-base font-bold">{t._count.missions}</dd>
                          <dt className="text-[10px] uppercase tracking-wide text-muted">nhiệm vụ</dt>
                        </div>
                        <div className="px-2">
                          <dd className={`text-base font-bold ${t.prizeXp > 0 ? "text-amber-600 dark:text-amber-300" : ""}`}>
                            {t.prizeXp > 0 ? `💎 ${t.prizeXp}` : "—"}
                          </dd>
                          <dt className="text-[10px] uppercase tracking-wide text-muted">XP thưởng</dt>
                        </div>
                      </dl>

                      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                        <p className="text-xs text-muted">
                          {formatDate(t.startsAt)} → {formatDate(t.endsAt)}
                        </p>
                        <span className="shrink-0 text-sm font-medium text-brand-600 transition-transform group-hover:translate-x-0.5 group-hover:text-brand-700">
                          Quản lý →
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
