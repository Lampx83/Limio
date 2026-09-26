import { prisma } from "@feedbackme/db";
import { getCourseGamificationStats } from "@feedbackme/core-gamification";
import GamificationTable from "./GamificationTable";

/**
 * Tab "Gamification" của trình soạn khoá — thống kê XP / level / streak / badge
 * theo học viên. Chỉ đọc. Caller đã kiểm quyền (canViewAnalytics).
 */
export default async function GamificationTab({
  courseId,
  sectionId,
}: {
  courseId: string;
  sectionId?: string;
}) {
  const sections = await prisma.courseSection.findMany({
    where: { courseId, isDefault: false },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  // Bỏ qua sectionId lạ (thuộc khoá khác / đã xoá) thay vì trả rỗng khó hiểu.
  const activeSection = sections.some((s) => s.id === sectionId) ? sectionId : undefined;

  const stats = await getCourseGamificationStats({
    courseId,
    sectionId: activeSection,
  });
  const { summary } = stats;

  const csvHref = `/api/instructor/courses/${courseId}/analytics/exports/gamification${
    activeSection ? `?section=${activeSection}` : ""
  }`;

  return (
    <div className="mt-8 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">Gamification</h2>
          <p className="mt-1 text-sm text-muted">
            XP, level, streak và badge của học viên trong khoá này.
          </p>
        </div>
        {stats.hasData && (
          <a href={csvHref} className="btn-secondary">
            Tải CSV
          </a>
        )}
      </div>

      {!stats.hasData ? (
        <div className="banner-info rounded-2xl p-5 text-sm">
          Khoá này chưa có dữ liệu gamification.
        </div>
      ) : (
        <>
          {sections.length > 0 && (
            <form method="get" className="flex flex-wrap items-center gap-2 text-sm">
              <input type="hidden" name="tab" value="gamification" />
              <label htmlFor="gami-section" className="text-muted">
                Lớp
              </label>
              <select
                id="gami-section"
                name="section"
                defaultValue={activeSection ?? ""}
                className="rounded-lg border border-token bg-transparent px-2 py-1"
              >
                <option value="">Tất cả</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn-secondary">
                Lọc
              </button>
            </form>
          )}

          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <Tile label="Học viên" value={summary.learnerCount} />
            <Tile label="Tổng XP" value={summary.totalXp} />
            <Tile label="XP trung bình" value={summary.avgXp} />
            <Tile label="Badge đã cấp" value={summary.totalBadges} />
            <Tile label="Đang có streak" value={summary.activeStreakCount} />
          </dl>

          <LevelDistribution dist={summary.levelDistribution} />

          {stats.rows.length === 0 ? (
            <p className="text-sm text-muted">Lớp này chưa có học viên.</p>
          ) : (
            <GamificationTable
              courseId={courseId}
              rows={stats.rows.map((r) => ({
                userId: r.userId,
                displayName: r.displayName,
                email: r.email,
                sectionName: r.sectionName,
                xp: r.xp,
                level: r.level,
                currentStreak: r.currentStreak,
                badges: r.badges.map((b) => ({
                  code: b.code,
                  name: b.name,
                  description: b.description,
                  category: b.category,
                  earnedAt: b.earnedAt.toISOString(),
                })),
                leaderboardOptOut: r.leaderboardOptOut,
              }))}
            />
          )}
        </>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-token p-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

function LevelDistribution({ dist }: { dist: Record<number, number> }) {
  const levels = Object.keys(dist)
    .map(Number)
    .sort((a, b) => a - b);
  if (levels.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="text-muted">Phân bố level:</span>
      {levels.map((lv) => (
        <span key={lv} className="chip">
          Lv {lv}: {dist[lv]}
        </span>
      ))}
    </div>
  );
}
