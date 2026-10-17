"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BarChart2, ChevronDown, Download, PenLine, Search, Users } from "lucide-react";
import type { ExamResults, ExamResultRow } from "@feedbackme/core-lms";
import { apiUrl } from "@/lib/apiUrl";
import { formatDateTime } from "@/lib/datetime";
import { formatPct, resultVerdict, TONE_CLASS } from "@/lib/examResultStatus";
import AnalyticsPanel from "./AnalyticsPanel";

type Slice = "students" | "items" | "grading";

/**
 * Tab Kết quả của một bài thi.
 *
 * Trước đây tab này mở thẳng vào phân tích từng câu, còn danh sách điểm nằm ở
 * một panel cũng tên "Kết quả" nhưng thuộc màn hình ca thi, cách ba cấp điều
 * hướng. Giáo viên bấm đúng chữ mình cần và nhận về thứ mình không tìm.
 *
 * Giờ một bài có một trang kết quả; ca và phòng là BỘ LỌC, chỉ hiện khi bài
 * thực sự có nhiều hơn một.
 */
export default function ResultsPanel({
  examId,
  courseId,
  lockedSessionId,
}: {
  examId: string;
  courseId: string;
  /**
   * Khoá vào MỘT buổi thi. Dùng ở trang kết quả của từng lần thi: ở đó bộ lọc
   * ca không còn nghĩa lý gì vì đã chọn ca rồi.
   */
  lockedSessionId?: string;
}) {
  const [slice, setSlice] = useState<Slice>("students");
  const [data, setData] = useState<ExamResults | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [sessionId, setSessionId] = useState(lockedSessionId ?? "");
  const [roomId, setRoomId] = useState("");

  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams();
    if (sessionId) qs.set("sessionId", sessionId);
    if (roomId) qs.set("roomId", roomId);
    setErr(null);
    fetch(apiUrl(`/api/exams/${examId}/results-list?${qs}`))
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return (await r.json()) as ExamResults;
      })
      .then((j) => alive && setData(j))
      .catch((e) => alive && setErr(e instanceof Error ? e.message : "load_failed"));
    return () => {
      alive = false;
    };
  }, [examId, sessionId, roomId]);

  const s = data?.summary;
  const showFilters =
    !lockedSessionId &&
    ((data?.sessions.length ?? 0) > 1 || (data?.rooms.length ?? 0) > 1);

  // Cao nhất / thấp nhất chỉ tính trên bài đã chấm đủ — bài còn câu tự luận
  // chưa có điểm cuối, đưa vào sẽ làm hai con số này sai.
  const finished = useMemo(
    () =>
      (data?.rows ?? []).filter(
        (r): r is ExamResultRow & { scorePct: number } =>
          r.scorePct != null && !r.needsGrading,
      ),
    [data],
  );
  const hi = finished.length ? Math.max(...finished.map((r) => r.scorePct)) : null;
  const lo = finished.length ? Math.min(...finished.map((r) => r.scorePct)) : null;

  // Phạm vi ca/phòng đang chọn — dùng chung cho các nút xuất file để file và
  // màn hình luôn nói về cùng một tập người.
  const scope = new URLSearchParams();
  if (sessionId) scope.set("sessionId", sessionId);
  if (roomId) scope.set("roomId", roomId);
  const scopeQs = scope.toString();

  return (
    <div>
      {/* Dải số tổng quan — trả lời ngay trước khi phải đọc bảng. */}
      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-default bg-default sm:grid-cols-4">
        <Stat label="đã nộp" value={s ? `${s.submitted}/${s.expected}` : "—"} />
        <Stat
          label={
            s?.avgScorePct != null
              ? `điểm trung bình · ${s.avgScoreCount} bài đã chấm`
              : "điểm trung bình"
          }
          value={s?.avgScorePct != null ? formatPct(s.avgScorePct) : "—"}
          hint={
            hi != null && lo != null && finished.length > 1
              ? `cao nhất ${formatPct(hi)} · thấp nhất ${formatPct(lo)}`
              : undefined
          }
        />
        <Stat
          label="bài chờ chấm tay"
          value={s ? `${s.pendingGrading}` : "—"}
          alert={(s?.pendingGrading ?? 0) > 0}
        />
        <Stat
          label="chưa làm"
          value={s ? `${s.notStarted}` : "—"}
        />
      </div>

      {data?.weightsNote && (
        <p className="mb-3 text-xs text-slate-600">
          Điểm tính theo trọng số: <b>{data.weightsNote}</b>. Điểm thô ({data.totalPoints} điểm tối đa) giữ nguyên.
        </p>
      )}

      {/* Ba lát cắt, đúng ba câu hỏi giáo viên hay hỏi. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Seg on={slice === "students"} onClick={() => setSlice("students")}>
          <Users className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
          Theo thí sinh/học viên
        </Seg>
        <Seg on={slice === "items"} onClick={() => setSlice("items")}>
          <BarChart2 className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
          Theo câu hỏi
        </Seg>
        <Seg on={slice === "grading"} onClick={() => setSlice("grading")}>
          <PenLine className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
          Chờ chấm tay{s?.pendingGrading ? ` · ${s.pendingGrading}` : ""}
        </Seg>

        <div className="ml-auto">
          <ExportMenu examId={examId} scopeQs={scopeQs} />
        </div>
      </div>

      {/* Cấu trúc ca/phòng chỉ xuất hiện khi bài thực sự có nhiều hơn một. */}
      {showFilters && (
        <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-faint">Lọc:</span>
          {data!.sessions.length > 1 && (
            <select
              value={sessionId}
              onChange={(e) => setSessionId(e.target.value)}
              className="rounded border border-default bg-white px-2 py-1"
            >
              <option value="">Tất cả ca thi</option>
              {data!.sessions.map((x) => (
                <option key={x.id} value={x.id}>{x.title}</option>
              ))}
            </select>
          )}
          {data!.rooms.length > 1 && (
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="rounded border border-default bg-white px-2 py-1"
            >
              <option value="">Tất cả phòng</option>
              {data!.rooms.map((x) => (
                <option key={x.id} value={x.id}>{x.name}</option>
              ))}
            </select>
          )}
        </div>
      )}

      {err && (
        <div className="banner-danger px-3 py-2 text-sm">Không tải được kết quả: {err}</div>
      )}

      {slice === "students" && (
        <StudentList data={data} courseId={courseId} examId={examId} />
      )}
      {slice === "items" && (
        // Đang xem một đợt thì chỉ số phải tính riêng đợt đó, không gộp mọi
        // đợt của gói đề — đó là cả lý do trang này tồn tại.
        <AnalyticsPanel examId={examId} sessionId={sessionId || undefined} />
      )}
      {slice === "grading" && (
        <GradingSlice
          courseId={courseId}
          examId={examId}
          pending={s?.pendingGrading ?? 0}
        />
      )}
    </div>
  );
}

function ExportMenu({ examId, scopeQs }: { examId: string; scopeQs: string }) {
  const [open, setOpen] = useState(false);
  const xlsx = apiUrl(`/api/exams/${examId}/results${scopeQs ? `?${scopeQs}` : ""}`);
  const analysisQs = `format=analysis${scopeQs ? `&${scopeQs}` : ""}`;
  const analysis = apiUrl(`/api/exams/${examId}/results?${analysisQs}`);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex items-center rounded border border-default px-2.5 py-1 text-xs hover:bg-slate-50"
      >
        <Download className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
        Xuất file
        <ChevronDown className="ml-1 inline h-3.5 w-3.5 align-text-bottom" />
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-default bg-white p-1 shadow-lg">
          <a
            href={xlsx}
            onClick={() => setOpen(false)}
            className="block rounded px-3 py-2 hover:bg-slate-50"
          >
            <div className="text-sm font-medium">Bảng điểm (Excel)</div>
            <div className="text-caption text-faint">
              Mở bằng Excel. Điểm, tỉ lệ và trạng thái của từng người; sheet thứ
              hai cho thấy đúng/sai từng câu. Dùng để lưu sổ hoặc gửi khoa.
            </div>
          </a>
          <div className="mt-1 border-t border-default px-3 pb-1 pt-2 text-caption text-faint">
            Dành cho chuyên gia đo lường
          </div>
          <a
            href={analysis}
            onClick={() => setOpen(false)}
            className="block rounded px-3 py-2 hover:bg-slate-50"
          >
            <div className="text-sm font-medium">Dữ liệu phân tích (CSV)</div>
            <div className="text-caption text-faint">
              Mỗi người × mỗi câu một dòng. Nạp vào R, jMetrik hoặc mirt để phân
              tích độ khó và độ phân biệt.
            </div>
          </a>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
  alert,
}: {
  label: string;
  value: string;
  hint?: string;
  alert?: boolean;
}) {
  return (
    <div className="bg-white px-3 py-2.5">
      <div
        className={`text-xl font-bold tabular-nums ${alert ? "text-amber-600" : ""}`}
      >
        {value}
      </div>
      <div className="text-caption text-faint">{label}</div>
      {hint && <div className="text-caption text-faint tabular-nums">{hint}</div>}
    </div>
  );
}

function Seg({
  on,
  onClick,
  children,
}: {
  on: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1 text-xs transition-colors ${
        on
          ? "bg-blue-600 font-medium text-white"
          : "border border-default text-faint hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

type SortKey = "name" | "score" | "time";

function StudentList({
  data,
  courseId,
  examId,
}: {
  data: ExamResults | null;
  courseId: string;
  examId: string;
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("name");

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLocaleLowerCase("vi");
    const filtered = needle
      ? data.rows.filter(
          (r) =>
            r.displayName.toLocaleLowerCase("vi").includes(needle) ||
            (r.identifier ?? "").toLocaleLowerCase("vi").includes(needle),
        )
      : data.rows;
    const sorted = [...filtered];
    if (sort === "name") {
      sorted.sort((a, b) => a.displayName.localeCompare(b.displayName, "vi"));
    } else if (sort === "score") {
      // Chưa có điểm xuống cuối, không để chúng chen vào giữa bảng điểm.
      sorted.sort((a, b) => (b.scorePct ?? -1) - (a.scorePct ?? -1));
    } else {
      // Nộp sớm nhất lên đầu; ai chưa nộp xuống cuối.
      sorted.sort((a, b) => {
        if (!a.submittedAt && !b.submittedAt) return 0;
        if (!a.submittedAt) return 1;
        if (!b.submittedAt) return -1;
        return a.submittedAt.localeCompare(b.submittedAt);
      });
    }
    return sorted;
  }, [data, query, sort]);

  if (!data) return <p className="py-8 text-center text-sm text-faint">Đang tải…</p>;
  if (data.rows.length === 0)
    return (
      <p className="py-8 text-center text-sm text-faint">
        Chưa có ai làm bài này.
      </p>
    );

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <label className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm theo tên hoặc email/mã dự thi"
            className="w-full rounded border border-default bg-white py-1.5 pl-8 pr-2 text-sm"
          />
        </label>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortKey)}
          className="rounded border border-default bg-white px-2 py-1.5 text-sm"
          aria-label="Sắp xếp"
        >
          <option value="name">Tên (A → Z)</option>
          <option value="score">Điểm (cao → thấp)</option>
          <option value="time">Nộp lúc (sớm → muộn)</option>
        </select>
      </div>

      {rows.length === 0 && (
        <p className="py-6 text-center text-sm text-faint">Không có ai khớp với từ khoá.</p>
      )}

      {/* Điện thoại: mỗi người một thẻ, không phải kéo ngang bảng. */}
      <ul className="space-y-2 sm:hidden">
        {rows.map((r, i) => (
          <StudentCard key={r.attemptId ?? `ns-${i}`} r={r} totalPoints={data.totalPoints} courseId={courseId} examId={examId} />
        ))}
      </ul>

      <div className="hidden overflow-x-auto rounded-lg border border-default sm:block">
        <table className="w-full min-w-[560px] text-sm">
          <thead className="bg-slate-50 text-left text-xs text-faint">
            <tr>
              <th className="px-3 py-2 font-medium">Thí sinh / Học viên</th>
              <th className="px-3 py-2 font-medium">Nộp lúc</th>
              <th className="px-3 py-2 text-right font-medium">Điểm</th>
              <th className="px-3 py-2 font-medium">Trạng thái</th>
              <th className="px-3 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <Row
                key={r.attemptId ?? `ns-${i}`}
                r={r}
                totalPoints={data.totalPoints}
                courseId={courseId}
                examId={examId}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ScoreText({ r, totalPoints }: { r: ExamResultRow; totalPoints: number }) {
  if (r.score == null) return <span className="text-faint">—</span>;
  return (
    <>
      <div className="font-medium tabular-nums">
        {r.score}/{totalPoints}
        {r.scorePct != null && (
          <span className="ml-1.5 font-normal text-faint">{formatPct(r.scorePct)}</span>
        )}
      </div>
      {/* Còn câu chờ chấm: số này mới là phần tự chấm, chưa phải điểm cuối. */}
      {r.needsGrading && (
        <div className="text-[11px] text-amber-700">chưa gồm câu chờ chấm</div>
      )}
    </>
  );
}

function ViewLink({ r, courseId, examId }: { r: ExamResultRow; courseId: string; examId: string }) {
  // Chỉ bài đã nộp mới có đáp án để xem/chấm.
  if (!r.attemptId || r.status === "in_progress" || r.status === "not_started") return null;
  return (
    <Link
      href={`/instructor/courses/${courseId}/exams/${examId}/attempts/${r.attemptId}`}
      className="text-xs font-medium text-blue-600 hover:underline"
    >
      Xem bài làm
    </Link>
  );
}

function Row({
  r,
  totalPoints,
  courseId,
  examId,
}: {
  r: ExamResultRow;
  totalPoints: number;
  courseId: string;
  examId: string;
}) {
  return (
    <tr className="border-t border-default">
      <td className="px-3 py-2">
        <div className="font-medium">{r.displayName}</div>
        {r.identifier && (
          <div className="text-caption text-faint">{r.identifier}</div>
        )}
        {r.sessionTitle && (
          <div className="text-caption text-faint">
            {r.sessionTitle}
            {r.roomName ? ` · ${r.roomName}` : ""}
          </div>
        )}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-xs text-faint tabular-nums">
        {r.submittedAt ? formatDateTime(r.submittedAt) : "—"}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        <ScoreText r={r} totalPoints={totalPoints} />
      </td>
      <td className="px-3 py-2">
        <Verdict r={r} />
      </td>
      <td className="px-3 py-2 text-right">
        <ViewLink r={r} courseId={courseId} examId={examId} />
      </td>
    </tr>
  );
}

function StudentCard({
  r,
  totalPoints,
  courseId,
  examId,
}: {
  r: ExamResultRow;
  totalPoints: number;
  courseId: string;
  examId: string;
}) {
  return (
    <li className="rounded-lg border border-default bg-white p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate font-medium">{r.displayName}</div>
          {r.identifier && (
            <div className="truncate text-caption text-faint">{r.identifier}</div>
          )}
        </div>
        <div className="shrink-0 text-right">
          <ScoreText r={r} totalPoints={totalPoints} />
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="text-faint">
          <Verdict r={r} />
          {r.submittedAt && <> · {formatDateTime(r.submittedAt)}</>}
        </span>
        <ViewLink r={r} courseId={courseId} examId={examId} />
      </div>
    </li>
  );
}

function Verdict({ r }: { r: ExamResultRow }) {
  const v = resultVerdict(r);
  return <span className={`text-xs ${TONE_CLASS[v.tone]}`}>{v.label}</span>;
}

function GradingSlice({
  courseId,
  examId,
  pending,
}: {
  courseId: string;
  examId: string;
  pending: number;
}) {
  if (pending === 0)
    return (
      <p className="py-8 text-center text-sm text-faint">
        Không còn bài nào chờ chấm tay.
      </p>
    );
  return (
    <div className="rounded-lg border border-default bg-white p-5">
      <p className="text-sm">
        Còn <strong>{pending}</strong> bài có câu chờ chấm tay.
      </p>
      <Link
        href={`/instructor/courses/${courseId}/exams/${examId}/grading`}
        className="mt-3 inline-block rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
      >
        Mở màn hình chấm
      </Link>
    </div>
  );
}
