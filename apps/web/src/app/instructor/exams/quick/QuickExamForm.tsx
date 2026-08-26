"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";

type RevealPolicy = "immediately" | "never" | "after_close";

interface Paper {
  id: string;
  title: string;
  courseId: string;
  courseTitle: string;
  questionCount: number;
  defaultDurationMin: number;
}

/** datetime-local cần giờ ĐỊA PHƯƠNG, không phải ISO UTC. */
function toLocalInput(d: Date): string {
  const tz = d.getTimezoneOffset() * 60_000;
  return new Date(d.getTime() - tz).toISOString().slice(0, 16);
}

/**
 * Mở buổi thi từ một gói đề có sẵn.
 *
 * Chỉ hỏi hai thứ ở mức cơ bản: dùng gói nào, mỗi học sinh bao nhiêu phút.
 * Giờ mở/đóng nằm sau "Tuỳ chọn nâng cao" vì phần lớn buổi kiểm tra trên lớp
 * không cần — mở ngay, đóng khi giáo viên bấm.
 */
export default function QuickExamForm({
  purpose,
  courses,
  papers,
}: {
  purpose: "assessment" | "field_test";
  courses: Array<{ id: string; title: string }>;
  papers: Paper[];
}) {
  const [paperId, setPaperId] = useState(papers[0]?.id ?? "");
  const paper = useMemo(
    () => papers.find((p) => p.id === paperId) ?? null,
    [papers, paperId],
  );

  const [durationMin, setDurationMin] = useState(
    papers[0]?.defaultDurationMin ?? 15,
  );
  // Mặc định khác nhau theo mục đích, vì rủi ro khác nhau: đề thử nghiệm mà
  // lộ đáp án là đốt câu hỏi, không dùng lại được cho đợt sau.
  const [reveal, setReveal] = useState<RevealPolicy>(
    purpose === "field_test" ? "never" : "immediately",
  );
  const [advanced, setAdvanced] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleClose, setScheduleClose] = useState(false);
  const [opensAt, setOpensAt] = useState(() => toLocalInput(new Date()));
  const [closesAt, setClosesAt] = useState(() =>
    toLocalInput(new Date(Date.now() + 60 * 60_000)),
  );

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<{ code: string; path: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const onPickPaper = (id: string) => {
    setPaperId(id);
    const p = papers.find((x) => x.id === id);
    if (p) setDurationMin(p.defaultDurationMin);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paper) return;
    setBusy(true);
    setErr(null);
    try {
      // Bật bất kỳ mốc giờ nào là chuyển sang chế độ hẹn giờ; không bật thì ca
      // chạy thủ công — mở ngay, đóng khi bấm.
      const scheduled = scheduleOpen || scheduleClose;
      const res = await fetch(apiUrl(`/api/exams/${paper.id}/share`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          timingMode: scheduled ? "scheduled" : "manual",
          durationMin,
          revealAnswers: reveal,
          ...(scheduleOpen ? { opensAt: new Date(opensAt).toISOString() } : {}),
          ...(scheduleClose ? { closesAt: new Date(closesAt).toISOString() } : {}),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        code?: string;
        path?: string;
        error?: string;
        details?: { message?: string };
      };
      if (!res.ok || !data.code) {
        setErr(data.details?.message ?? data.error ?? `HTTP ${res.status}`);
        return;
      }
      setResult({ code: data.code, path: data.path! });
    } finally {
      setBusy(false);
    }
  };

  if (papers.length === 0) {
    return (
      <div className="mt-6 rounded-lg border border-default bg-white p-5">
        <p className="text-sm">
          Chưa có gói đề nào
          {purpose === "field_test" ? " dành cho thử nghiệm" : ""} có câu hỏi.
        </p>
        <p className="mt-1 text-caption text-faint">
          Gói đề là phần nội dung — soạn ở mục Đề thi, rồi quay lại đây để mở
          buổi thi.
        </p>
        <Link
          href={`/instructor/courses/${courses[0]!.id}/exams/new`}
          className="mt-3 inline-block rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          + Soạn gói đề mới
        </Link>
      </div>
    );
  }

  if (result) {
    const fullUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}${result.path}`
        : result.path;
    return (
      <div className="mt-6 rounded-lg border border-emerald-300 bg-emerald-50 p-5">
        <p className="text-sm font-medium text-emerald-900">Đã mở buổi thi.</p>
        <div className="mt-3 flex items-center gap-2">
          <span className="font-mono text-lg font-semibold tracking-widest text-emerald-900">
            {result.code}
          </span>
          <button
            type="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(fullUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              } catch {
                /* trình duyệt chặn clipboard — link vẫn hiện để chọn tay */
              }
            }}
            className="rounded border border-emerald-300 p-1.5 text-emerald-800 hover:bg-emerald-100"
            aria-label="Sao chép link"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <p className="mt-2 break-all text-caption text-emerald-800">{fullUrl}</p>
        <div className="mt-4 flex gap-2">
          <Link
            href={`/instructor/courses/${paper!.courseId}/exams/${paper!.id}?tab=results`}
            className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
          >
            Xem kết quả
          </Link>
          <Link
            href="/instructor/organize"
            className="rounded border border-emerald-300 px-3 py-1.5 text-sm text-emerald-900"
          >
            Mở buổi khác
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="mt-6 space-y-4">
      <label className="block">
        <span className="block text-sm font-medium">Gói đề</span>
        <select
          value={paperId}
          onChange={(e) => onPickPaper(e.target.value)}
          className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
        >
          {papers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} — {p.questionCount} câu
              {courses.length > 1 ? ` · ${p.courseTitle}` : ""}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-caption text-faint">
          Chỉ là phần nội dung. Cùng một gói mở được nhiều buổi thi khác nhau.
        </span>
      </label>

      <label className="block">
        <span className="block text-sm font-medium">Thời lượng làm bài (phút)</span>
        <input
          type="number"
          required
          min={1}
          max={1440}
          value={durationMin}
          onChange={(e) => setDurationMin(Number(e.target.value))}
          className="mt-1 w-32 rounded border border-default bg-white px-3 py-2 text-sm"
        />
        <span className="mt-1 block text-caption text-faint">
          Đếm từ lúc từng học sinh bấm bắt đầu, không phải giờ đồng hồ.
        </span>
      </label>

      <label className="block">
        <span className="block text-sm font-medium">Hiện đáp án và kết quả</span>
        <select
          value={reveal}
          onChange={(e) => setReveal(e.target.value as RevealPolicy)}
          className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
        >
          <option value="immediately">Hiện ngay sau khi nộp</option>
          <option value="after_close">Hiện sau khi đóng buổi thi</option>
          <option value="never">Không hiện</option>
        </select>
        <span className="mt-1 block text-caption text-faint">
          {reveal === "immediately"
            ? "Học sinh xem được điểm từng câu và đáp án đúng ngay khi nộp."
            : reveal === "after_close"
              ? "Học sinh chỉ xem được sau khi bạn đóng buổi thi — cả lớp nộp xong mới lộ đề."
              : "Học sinh chỉ thấy đã nộp, không thấy điểm chi tiết hay đáp án."}
        </span>
        {purpose === "field_test" && reveal !== "never" && (
          <span className="banner-warning mt-2 block px-3 py-2 text-caption">
            Đề thử nghiệm mà lộ đáp án là đốt câu hỏi — đợt sau không dùng lại
            được nữa.
          </span>
        )}
      </label>

      <div className="rounded border border-default bg-white">
        <button
          type="button"
          onClick={() => setAdvanced((v) => !v)}
          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm font-medium"
          aria-expanded={advanced}
        >
          <span>Tuỳ chọn nâng cao — giờ mở/đóng</span>
          <span className="text-faint">{advanced ? "−" : "+"}</span>
        </button>

        {advanced && (
          <div className="space-y-3 border-t border-default px-3 py-3">
            <TimeRow
              label="Hẹn giờ mở"
              hintOff="Bài mở ngay, không chờ giờ."
              hintOn="Bài chỉ mở từ thời điểm này."
              on={scheduleOpen}
              setOn={setScheduleOpen}
              value={opensAt}
              setValue={setOpensAt}
            />
            <TimeRow
              label="Hẹn giờ đóng"
              hintOff="Bài mở tới khi bạn bấm đóng."
              hintOn="Bài tự đóng vào thời điểm này."
              on={scheduleClose}
              setOn={setScheduleClose}
              value={closesAt}
              setValue={setClosesAt}
            />
            <p className="text-caption text-faint">
              {scheduleOpen || scheduleClose
                ? "Buổi thi chạy theo giờ đã đặt."
                : "Buổi thi mở ngay và chỉ đóng khi bạn bấm — hợp với kiểm tra tại lớp."}
            </p>
          </div>
        )}
      </div>

      {err && <div className="banner-danger px-3 py-2 text-sm">{err}</div>}

      <button
        type="submit"
        disabled={busy || !paper}
        className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
      >
        {busy ? "Đang mở…" : "Mở"}
      </button>
    </form>
  );
}

/**
 * Một dòng hẹn giờ.
 *
 * Ghi chú mô tả ĐIỀU ĐANG XẢY RA theo trạng thái công tắc, không phải "tắt =
 * ...". Kiểu cũ bắt người đọc suy ngược từ trạng thái họ không chọn, và câu
 * "Tắt = mở ngay" đọc nhanh thành tự mâu thuẫn.
 */
function TimeRow({
  label,
  hintOn,
  hintOff,
  on,
  setOn,
  value,
  setValue,
}: {
  label: string;
  hintOn: string;
  hintOff: string;
  on: boolean;
  setOn: (v: boolean) => void;
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={label}
          onClick={() => setOn(!on)}
          className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${
            on ? "bg-emerald-600" : "bg-slate-300"
          }`}
        >
          <span
            className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform ${
              on ? "translate-x-4" : "translate-x-0.5"
            }`}
          />
        </button>
      </div>
      {on && (
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
        />
      )}
      <span className="mt-1 block text-caption text-faint">
        {on ? hintOn : hintOff}
      </span>
    </div>
  );
}
