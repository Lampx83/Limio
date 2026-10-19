"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Users } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { fromDateTimeInputValue, toDateTimeInputValue } from "@/lib/datetime";

type Paper = { id: string; title: string; courseTitle: string; questionCount: number };

const REVEAL_HINT: Record<string, string> = {
  after_close: "Cả ca nộp xong và bạn đóng ca thì học viên mới xem được đáp án.",
  immediately: "Học viên xem được đáp án ngay khi nộp — người thi sau có thể hỏi người thi trước.",
  never: "Học viên không xem được đáp án hay điểm chi tiết.",
};

const ERRORS: Record<string, string> = {
  forbidden: "Bạn không có quyền tổ chức thi với đề này.",
  exam_not_found: "Không tìm thấy đề thi.",
  exam_not_written: "Đề vấn đáp AI mở qua Link thi nhanh, không dùng ở đây.",
};

/**
 * Tạo một ca kỳ thi chính thức thẳng từ đề — không còn bước "tạo đợt" trước.
 * Tạo xong chuyển sang trang ca để thêm phòng, giám thị, thí sinh.
 */
export default function CreateFormalSessionForm({
  papers,
  initialPaperId,
}: {
  papers: Paper[];
  initialPaperId?: string;
}) {
  const router = useRouter();
  const [examId, setExamId] = useState(
    papers.some((p) => p.id === initialPaperId) ? (initialPaperId as string) : "",
  );
  const [title, setTitle] = useState("");
  const [opens, setOpens] = useState(() =>
    toDateTimeInputValue(new Date(Date.now() + 60 * 60_000)),
  );
  const [closes, setCloses] = useState(() =>
    toDateTimeInputValue(new Date(Date.now() + 2 * 60 * 60_000)),
  );
  const [mode, setMode] = useState<"assigned_code" | "open_code">("assigned_code");
  const [reveal, setReveal] = useState<"after_close" | "immediately" | "never">("after_close");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (papers.length === 0) {
    return (
      <div>
        <p className="text-sm">Chưa có đề thi nào có câu hỏi.</p>
        <p className="mt-1 text-caption text-faint">
          Soạn đề ở mục Thiết kế đề thi, rồi quay lại đây để tạo ca thi.
        </p>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    const opensIso = fromDateTimeInputValue(opens);
    const closesIso = fromDateTimeInputValue(closes);
    if (!examId) return setErr("Chọn đề thi cho ca.");
    if (!opensIso || !closesIso) return setErr("Nhập giờ mở và giờ đóng.");
    if (new Date(opensIso) >= new Date(closesIso))
      return setErr("Giờ đóng phải sau giờ mở.");

    setBusy(true);
    try {
      const res = await fetch(apiUrl("/api/exam-sessions"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          examId,
          title: title.trim() || null,
          opensAt: opensIso,
          closesAt: closesIso,
          accessMode: mode,
          revealAnswers: reveal,
        }),
      });
      const j = (await res.json().catch(() => null)) as
        | { id?: string; error?: string; details?: { message?: string } }
        | null;
      if (!res.ok || !j?.id) {
        setErr(
          j?.details?.message ??
            (j?.error && ERRORS[j.error]) ??
            "Không tạo được ca. Vui lòng thử lại.",
        );
        return;
      }
      router.push(`/instructor/exam-sessions/${j.id}?tab=rooms`);
    } catch {
      setErr("Mất kết nối khi tạo ca. Vui lòng thử lại.");
    } finally {
      setBusy(false);
    }
  };

  const modeBtn = (on: boolean, tone: string) =>
    `rounded-lg border-2 p-3 text-left transition-colors ${
      on ? tone : "border-slate-200 hover:border-slate-300"
    }`;

  return (
    <form onSubmit={submit} className="space-y-4">
      <label className="block">
        <span className="block text-sm font-medium">Đề thi</span>
        <select
          value={examId}
          onChange={(e) => setExamId(e.target.value)}
          className="mt-1 w-full rounded border border-token bg-white px-3 py-2 text-sm"
        >
          <option value="">— Chọn đề thi —</option>
          {papers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title} · {p.questionCount} câu{p.courseTitle ? ` · ${p.courseTitle}` : ""}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="block text-sm font-medium">
          Tên ca <span className="font-normal text-faint">(tuỳ chọn)</span>
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          placeholder="Ví dụ: Giữa kỳ — Ca sáng"
          className="mt-1 w-full rounded border border-token px-3 py-2 text-sm"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="block text-sm font-medium">Mở lúc</span>
          <input
            type="datetime-local"
            value={opens}
            onChange={(e) => setOpens(e.target.value)}
            className="mt-1 w-full rounded border border-token px-3 py-2 text-sm"
          />
        </label>
        <label className="block">
          <span className="block text-sm font-medium">Đóng lúc</span>
          <input
            type="datetime-local"
            value={closes}
            onChange={(e) => setCloses(e.target.value)}
            className="mt-1 w-full rounded border border-token px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div>
        <span className="block text-sm font-medium">Cách vào thi</span>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            aria-pressed={mode === "assigned_code"}
            onClick={() => setMode("assigned_code")}
            className={modeBtn(mode === "assigned_code", "border-blue-500 bg-blue-50")}
          >
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Users className="h-3.5 w-3.5 shrink-0" aria-hidden /> Theo phòng
            </div>
            <div className="mt-0.5 text-caption text-faint">
              Có danh sách thí sinh, mỗi người một mã riêng, xếp phòng và giám thị.
            </div>
          </button>
          <button
            type="button"
            aria-pressed={mode === "open_code"}
            onClick={() => setMode("open_code")}
            className={modeBtn(mode === "open_code", "border-purple-500 bg-purple-50")}
          >
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              <Globe className="h-3.5 w-3.5 shrink-0" aria-hidden /> Tự do
            </div>
            <div className="mt-0.5 text-caption text-faint">
              Một mã chung cho cả ca, thí sinh tự nhập tên khi vào.
            </div>
          </button>
        </div>
      </div>

      <label className="block">
        <span className="block text-sm font-medium">Hiện đáp án và kết quả</span>
        <select
          value={reveal}
          onChange={(e) => setReveal(e.target.value as typeof reveal)}
          className="mt-1 w-full rounded border border-token bg-white px-3 py-2 text-sm"
        >
          <option value="after_close">Sau khi đóng ca</option>
          <option value="immediately">Ngay sau khi nộp</option>
          <option value="never">Không hiện</option>
        </select>
        <span className="mt-1 block text-caption text-faint">{REVEAL_HINT[reveal]}</span>
      </label>

      {err && (
        <p role="alert" className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {err}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
      >
        {busy ? "Đang tạo…" : "Tạo ca thi"}
      </button>
    </form>
  );
}
