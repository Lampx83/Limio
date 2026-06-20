import Link from "next/link";
import { prisma } from "@feedbackme/db";
import { formatDateTime } from "@/lib/datetime";

export const dynamic = "force-dynamic";

/** Nhãn tiếng Việt cho các action audit (mở rộng dần). */
const ACTION_LABELS: Record<string, string> = {
  "course.created": "Tạo khoá học",
  "course.published": "Xuất bản khoá",
  "course.archived": "Lưu trữ khoá",
  "course.deleted": "Xoá khoá",
  "course.duplicated": "Nhân bản khoá",
  "course.personalization.toggled": "Bật/tắt cá nhân hoá",
  "course.version.bumped": "Tăng version khoá",
  "role.granted": "Cấp quyền",
  "role.revoked": "Thu hồi quyền",
  "impersonation.started": "Bắt đầu impersonate",
  "impersonation.stopped": "Dừng impersonate",
  "user.password.changed": "Đổi mật khẩu",
  "exam.attempt.extended": "Gia hạn lượt thi",
  "exam.attempt.force_submitted": "Ép nộp bài thi",
  "exam.attempt.disqualified": "Loại thí sinh",
  "exam.message.sent": "Nhắn thí sinh",
  "exam.message.broadcast": "Thông báo phòng thi",
};

function actionLabel(a: string): string {
  return ACTION_LABELS[a] ?? a;
}

function payloadHint(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  for (const k of ["courseTitle", "title", "name", "roleName", "courseId"]) {
    if (typeof p[k] === "string") return p[k] as string;
  }
  return null;
}

export default async function InstructorActivityPage({
  searchParams,
}: {
  searchParams: { instructor?: string };
}) {
  // Tất cả user có role instructor (mọi scope).
  const roleRows = await prisma.userRole.findMany({
    where: { role: { name: "instructor" } },
    select: {
      userId: true,
      user: { select: { id: true, displayName: true, email: true } },
    },
  });
  const instructorMap = new Map(roleRows.map((r) => [r.userId, r.user]));
  const instructors = [...instructorMap.values()];
  const instructorIds = instructors.map((i) => i.id);

  const filterId =
    searchParams.instructor && instructorMap.has(searchParams.instructor)
      ? searchParams.instructor
      : null;

  const logs = instructorIds.length
    ? await prisma.auditLog.findMany({
        where: {
          actorUserId: filterId ? filterId : { in: instructorIds },
        },
        orderBy: { occurredAt: "desc" },
        take: 300,
        include: {
          actor: { select: { displayName: true, email: true } },
          target: { select: { displayName: true, email: true } },
        },
      })
    : [];

  // Đếm số action / instructor (toàn bộ, không theo filter) để hiển thị chip.
  const countByInstructor = new Map<string, number>();
  if (instructorIds.length) {
    const grouped = await prisma.auditLog.groupBy({
      by: ["actorUserId"],
      where: { actorUserId: { in: instructorIds } },
      _count: { _all: true },
    });
    for (const g of grouped) {
      if (g.actorUserId) countByInstructor.set(g.actorUserId, g._count._all);
    }
  }

  const base = "/admin/instructor-activity";

  return (
    <main>
      <header>
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
          Quản trị
        </span>
        <h1 className="mt-3 h-display text-2xl font-bold sm:text-3xl">
          Hoạt động giảng viên
        </h1>
        <p className="mt-1 text-sm text-muted">
          Nhật ký hành động (audit log) của các tài khoản có quyền giảng viên —
          tạo/xuất bản khoá, đổi quyền, can thiệp kỳ thi…
        </p>
      </header>

      {/* Bộ lọc theo giảng viên */}
      <div className="mt-5 flex flex-wrap gap-1.5">
        <Link
          href={base}
          className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
            !filterId
              ? "bg-brand-gradient text-white"
              : "bg-[rgb(var(--surface-muted))] text-muted hover:bg-[rgb(var(--surface))]"
          }`}
        >
          Tất cả ({instructors.length})
        </Link>
        {instructors.map((i) => (
          <Link
            key={i.id}
            href={`${base}?instructor=${i.id}`}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
              filterId === i.id
                ? "bg-brand-gradient text-white"
                : "bg-[rgb(var(--surface-muted))] text-muted hover:bg-[rgb(var(--surface))]"
            }`}
          >
            {i.displayName || i.email}
            <span className="ml-1 opacity-70">
              ({countByInstructor.get(i.id) ?? 0})
            </span>
          </Link>
        ))}
      </div>

      {/* Feed */}
      <section className="card mt-5">
        {logs.length === 0 ? (
          <p className="text-sm text-muted">
            {instructors.length === 0
              ? "Chưa có tài khoản giảng viên nào."
              : "Chưa có hoạt động nào được ghi nhận."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-token text-left text-xs uppercase text-faint">
                <tr>
                  <th className="px-3 py-2 font-medium">Thời gian</th>
                  <th className="px-3 py-2 font-medium">Giảng viên</th>
                  <th className="px-3 py-2 font-medium">Hành động</th>
                  <th className="px-3 py-2 font-medium">Đối tượng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-token">
                {logs.map((l) => {
                  const hint = payloadHint(l.payload);
                  return (
                    <tr key={l.id}>
                      <td className="whitespace-nowrap px-3 py-2 text-xs text-faint">
                        {formatDateTime(l.occurredAt)}
                      </td>
                      <td className="px-3 py-2">
                        {l.actor?.displayName ?? l.actor?.email ?? "—"}
                      </td>
                      <td className="px-3 py-2">
                        <span className="font-medium">
                          {actionLabel(l.action)}
                        </span>
                        <span className="ml-1.5 font-mono text-[10px] text-faint">
                          {l.action}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted">
                        {l.target?.displayName ?? l.target?.email ?? hint ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-[11px] text-faint">
          Hiển thị tối đa 300 hành động gần nhất. Để tải đầy đủ, dùng export
          audit log.
        </p>
      </section>
    </main>
  );
}
