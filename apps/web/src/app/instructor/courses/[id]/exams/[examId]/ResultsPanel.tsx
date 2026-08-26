"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { BarChart2, Download, PenLine, Users } from "lucide-react";
import type { ExamResults, ExamResultRow } from "@feedbackme/core-lms";
import { apiUrl } from "@/lib/apiUrl";
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

  return (
    <div>
      {/* Dải số tổng quan — trả lời ngay trước khi phải đọc bảng. */}
      <div className="mb-4 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-default bg-default sm:grid-cols-4">
        <Stat
          label="đã nộp"
          value={s ? `${s.submitted}/${s.expected}` : "—"}
        />
        <Stat
          label="điểm trung bình"
          value={s?.avgScorePct != null ? `${s.avgScorePct.toFixed(1)}%` : "—"}
        />
        <Stat
          label={`đạt (ngưỡng ${data?.passScore ?? "—"}%)`}
          value={s ? `${s.passedCount}` : "—"}
        />
        <Stat
          label="chờ chấm tay"
          value={s ? `${s.pendingGrading}` : "—"}
          alert={(s?.pendingGrading ?? 0) > 0}
        />
      </div>

      {/* Ba lát cắt, đúng ba câu hỏi giáo viên hay hỏi. */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Seg on={slice === "students"} onClick={() => setSlice("students")}>
          <Users className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
          Theo học sinh
        </Seg>
        <Seg on={slice === "items"} onClick={() => setSlice("items")}>
          <BarChart2 className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
          Theo câu hỏi
        </Seg>
        <Seg on={slice === "grading"} onClick={() => setSlice("grading")}>
          <PenLine className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
          Cần chấm{s?.pendingGrading ? ` · ${s.pendingGrading}` : ""}
        </Seg>

        <a
          href={apiUrl(`/api/exams/${examId}/results`)}
          className="ml-auto rounded border border-default px-2.5 py-1 text-xs hover:bg-slate-50"
        >
          <Download className="mr-1 inline h-3.5 w-3.5 align-text-bottom" />
          Xuất Excel
        </a>
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
        <StudentTable data={data} courseId={courseId} examId={examId} />
      )}
      {slice === "items" && <AnalyticsPanel examId={examId} />}
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

function Stat({
  label,
  value,
  alert,
}: {
  label: string;
  value: string;
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

function StudentTable({
  data,
  courseId,
  examId,
}: {
  data: ExamResults | null;
  courseId: string;
  examId: string;
}) {
  if (!data) return <p className="py-8 text-center text-sm text-faint">Đang tải…</p>;
  if (data.rows.length === 0)
    return (
      <p className="py-8 text-center text-sm text-faint">
        Chưa có ai làm bài này.
      </p>
    );

  return (
    <div className="overflow-x-auto rounded-lg border border-default">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-slate-50 text-left text-xs text-faint">
          <tr>
            <th className="px-3 py-2 font-medium">Học sinh</th>
            <th className="px-3 py-2 font-medium">Nộp lúc</th>
            <th className="px-3 py-2 text-right font-medium">Điểm</th>
            <th className="px-3 py-2 font-medium">Kết quả</th>
            <th className="px-3 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((r, i) => (
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
      <td className="px-3 py-2 text-xs text-faint">
        {r.submittedAt
          ? new Date(r.submittedAt).toLocaleString("vi-VN", {
              timeZone: "Asia/Ho_Chi_Minh",
              hour: "2-digit",
              minute: "2-digit",
              day: "2-digit",
              month: "2-digit",
            })
          : "—"}
      </td>
      <td className="px-3 py-2 text-right tabular-nums">
        {r.score != null ? `${r.score}/${totalPoints}` : "—"}
      </td>
      <td className="px-3 py-2">
        <Verdict r={r} />
      </td>
      <td className="px-3 py-2 text-right">
        {r.attemptId && (
          <Link
            href={`/instructor/courses/${courseId}/exams/${examId}/live/${r.attemptId}`}
            className="text-xs text-blue-600 hover:underline"
          >
            Xem bài
          </Link>
        )}
      </td>
    </tr>
  );
}

function Verdict({ r }: { r: ExamResultRow }) {
  if (r.status === "not_started")
    return <span className="text-xs text-faint">Chưa làm</span>;
  if (r.status === "in_progress")
    return <span className="text-xs text-blue-700">Đang làm</span>;
  if (r.needsGrading)
    return <span className="text-xs text-amber-700">Chờ chấm</span>;
  if (r.passed === true)
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
        Đạt
      </span>
    );
  if (r.passed === false)
    return (
      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs text-red-800">
        Chưa đạt
      </span>
    );
  return <span className="text-xs text-faint">Đã nộp</span>;
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
