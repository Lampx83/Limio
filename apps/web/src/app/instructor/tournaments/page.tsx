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
      {/* Back link */}
      <Link
        href="/instructor/dashboard"
        className="link inline-flex items-center gap-1 text-sm"
      >
        ← Dashboard
      </Link>

      {/* Header */}
      <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="chip-accent">Tournament</span>
          <h1 className="mt-3 h-display text-h1">
            Tournaments của tôi
          </h1>
          <p className="mt-2 text-muted">
            {tournaments.length > 0
              ? `${tournaments.length} tournament`
              : "Bạn chưa tạo tournament nào."}
          </p>
        </div>
        <Link href="/instructor/tournaments/new" className="btn-primary">
          + Tạo tournament mới
        </Link>
      </div>

      {/* Filter */}
      <TournamentFilter />

      {/* List */}
      {tournaments.length === 0 ? (
        <EmptyState
          className="mt-10"
          icon="🏆"
          title={validStatus ? `Không có tournament ở trạng thái "${STATUS_LABEL[validStatus]}"` : "Chưa có tournament nào"}
          description={validStatus ? "Đổi filter trạng thái hoặc tạo tournament mới." : "Tạo tournament đầu tiên để học viên tham gia missions, leaderboard, prize."}
          actions={[{ label: "+ Tạo tournament mới", href: "/instructor/tournaments/new" }]}
        />
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {tournaments.map((t) => (
            <li key={t.id}>
              <Link href={`/instructor/tournaments/${t.id}`} className="group block h-full" prefetch={false}>
                <div className="card-hover h-full">
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-base font-semibold transition-colors group-hover:text-brand-600">
                      {t.title}
                    </span>
                    <span className={STATUS_TONE[t.status] ?? "chip"}>
                      {STATUS_LABEL[t.status] ?? t.status}
                    </span>
                  </div>

                  <p className="mt-1 text-xs text-faint">
                    {t.course ? t.course.title : "Platform-wide"}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                    <span>
                      {formatDate(t.startsAt)} → {formatDate(t.endsAt)}
                    </span>
                    <span>·</span>
                    <span>{t._count.registrations} người tham gia</span>
                    <span>·</span>
                    <span>{t._count.missions} missions</span>
                  </div>

                  <div className="mt-4 flex items-center justify-end border-t border-token pt-3">
                    <span className="text-sm font-medium text-brand-600 group-hover:text-brand-700">
                      Quản lý →
                    </span>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
