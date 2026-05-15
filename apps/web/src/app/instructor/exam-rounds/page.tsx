import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { CalendarCheck } from "lucide-react";
import { listExamRounds } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import CreateRoundButton from "./CreateRoundButton";

export const dynamic = "force-dynamic";

type RoundStatus = "draft" | "open" | "closed" | "archived";

const STATUS_LABEL: Record<RoundStatus, string> = {
  draft: "Nháp",
  open: "Đang mở",
  closed: "Đã đóng",
  archived: "Lưu trữ",
};
const STATUS_TONE: Record<RoundStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  open: "bg-emerald-100 text-emerald-800",
  closed: "bg-slate-200 text-slate-700",
  archived: "bg-amber-100 text-amber-800",
};
const STATUS_ORDER: Array<RoundStatus | "all"> = [
  "all",
  "draft",
  "open",
  "closed",
  "archived",
];
const STATUS_FILTER_LABEL: Record<RoundStatus | "all", string> = {
  all: "Tất cả",
  draft: "Nháp",
  open: "Đang mở",
  closed: "Đã đóng",
  archived: "Lưu trữ",
};

function parseStatus(raw: string | undefined): RoundStatus | undefined {
  if (raw === "draft" || raw === "open" || raw === "closed" || raw === "archived")
    return raw;
  return undefined;
}

export default async function ExamRoundsHubPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const session = await auth();
  if (!session?.user?.id)
    redirect("/signin?callbackUrl=/instructor/exam-rounds");
  const userId = session.user.id;
  const status = parseStatus(searchParams.status);

  const [rounds, ownedCourses] = await Promise.all([
    listExamRounds(userId, { status }),
    prisma.course.findMany({
      where: { instructors: { some: { userId } } },
      select: { id: true, title: true, slug: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const counts = {
    draft: 0,
    open: 0,
    closed: 0,
    archived: 0,
  };
  for (const r of rounds) counts[r.status]++;

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/instructor/dashboard"
        className="text-sm text-blue-600 hover:underline"
      >
        ← Dashboard
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold"><CalendarCheck className="h-6 w-6 shrink-0 text-amber-600" /> Tổ chức thi</h1>
          <p className="mt-1 text-sm text-faint">
            {rounds.length} đợt · {counts.draft} nháp · {counts.open} đang mở ·{" "}
            {counts.closed} đã đóng · {counts.archived} lưu trữ
          </p>
        </div>
        <CreateRoundButton courses={ownedCourses} />
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-faint">
          Trạng thái
        </span>
        {STATUS_ORDER.map((s) => {
          const active = (s === "all" && !status) || s === status;
          const href =
            s === "all" ? "/instructor/exam-rounds" : `/instructor/exam-rounds?status=${s}`;
          return (
            <Link
              key={s}
              href={href}
              className={`rounded-full border px-3 py-1 text-xs ${
                active
                  ? "border-amber-500 bg-amber-50 font-semibold text-amber-700"
                  : "border-default text-slate-700 hover:bg-slate-50"
              }`}
            >
              {STATUS_FILTER_LABEL[s]}
            </Link>
          );
        })}
      </div>

      {rounds.length === 0 ? (
        <div className="mt-6 rounded-lg border border-dashed border-default p-8 text-center text-sm text-faint">
          {status
            ? `Không có đợt thi nào ở trạng thái "${STATUS_FILTER_LABEL[status]}".`
            : "Chưa có đợt thi nào. Click \"+ Tạo đợt thi\" để bắt đầu."}
        </div>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-default bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2.5">Mã đợt</th>
                <th className="px-4 py-2.5">Tên</th>
                <th className="px-4 py-2.5">Khoá học</th>
                <th className="px-4 py-2.5">Thời gian</th>
                <th className="px-4 py-2.5 text-right">Số ca</th>
                <th className="px-4 py-2.5">Trạng thái</th>
                <th className="px-4 py-2.5"></th>
              </tr>
            </thead>
            <tbody>
              {rounds.map((r) => (
                <tr key={r.id} className="border-t border-default">
                  <td className="px-4 py-3 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/instructor/exam-rounds/${r.id}`}
                      className="font-medium hover:text-blue-700"
                    >
                      {r.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className="rounded-sm bg-slate-100 px-1.5 py-0.5 text-xs text-slate-700"
                      title={r.course.courseTitle}
                    >
                      {r.course.courseTitle}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-faint">
                    {formatDate(r.opensAt)} → {formatDate(r.closesAt)}
                  </td>
                  <td className="px-4 py-3 text-right">{r.sessionCount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${STATUS_TONE[r.status]}`}
                    >
                      {STATUS_LABEL[r.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/instructor/exam-rounds/${r.id}`}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Xem chi tiết →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
