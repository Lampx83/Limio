"use client";

import { useState } from "react";

type Mode = "open" | "assigned";

type Result = {
  examTitle: string;
  candidateName: string;
  status: "submitted" | "auto_submitted" | "graded" | "flagged";
  submittedAt: string | null;
  score: number | null;
  scorePct: number | null;
  fullyGraded: boolean;
  showDetail: boolean;
  details?: {
    prompt: string;
    correct: boolean | null;
    points: number;
    awarded: number | null;
  }[];
};

export default function ResultForm({
  code,
  mode,
}: {
  code: string;
  mode: Mode;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const res = await fetch("/api/public/exam/result-lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code, email: mode === "open" ? email.trim() : undefined }),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setErr(humanize(j?.error ?? `HTTP ${res.status}`));
        return;
      }
      setResult((await res.json()) as Result);
    } catch {
      setErr("Lỗi mạng — thử lại");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    return <ResultPanel r={result} onReset={() => setResult(null)} />;
  }

  return (
    <form
      onSubmit={onSubmit}
      data-testid="result-form"
      className="mt-6 space-y-4 rounded-lg border border-default bg-white p-5 shadow-sm"
    >
      <div>
        <label className="block text-xs font-medium text-slate-600">Mã thi</label>
        <div className="mt-1 rounded bg-slate-100 px-3 py-2 font-mono text-lg tracking-widest text-slate-900">
          {code}
        </div>
      </div>

      {mode === "open" && (
        <label className="block">
          <span className="block text-xs font-medium text-slate-600">
            Email đã đăng ký <span className="text-red-500">*</span>
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            inputMode="email"
            maxLength={200}
            placeholder="ban@example.com"
            className="mt-1 w-full rounded border border-default px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </label>
      )}

      {err && (
        <div
          data-testid="result-error"
          className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {err}
        </div>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded bg-blue-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {busy ? "Đang tra cứu..." : "Xem kết quả"}
      </button>
    </form>
  );
}

function ResultPanel({ r, onReset }: { r: Result; onReset: () => void }) {
  const statusLabel: Record<Result["status"], string> = {
    submitted: "Đã nộp · chờ chấm",
    auto_submitted: "Hết giờ · chờ chấm",
    graded: "Đã chấm",
    flagged: "Bị gắn cờ — liên hệ giám thị",
  };
  return (
    <div
      data-testid="result-panel"
      className="mt-6 space-y-4 rounded-lg border border-default bg-white p-5 shadow-sm"
    >
      <div className="text-center">
        <div className="text-xs uppercase tracking-wide text-faint">Thí sinh</div>
        <div className="mt-0.5 text-lg font-semibold text-slate-900">
          {r.candidateName}
        </div>
        <div className="mt-1 text-xs text-faint">{r.examTitle}</div>
      </div>

      <div className="rounded-lg border border-default bg-slate-50 p-4 text-center">
        <div className="text-xs uppercase tracking-wide text-faint">Trạng thái</div>
        <div className="mt-1 text-sm font-medium text-slate-700">
          {statusLabel[r.status]}
        </div>
        {r.fullyGraded ? (
          <>
            <div className="mt-4 text-4xl font-bold text-slate-900">
              {r.scorePct?.toFixed(0) ?? "—"}
              <span className="text-xl text-faint">%</span>
            </div>
            <div className="mt-1 text-sm text-slate-600">
              Tổng điểm: <b>{r.score?.toFixed(2) ?? "—"}</b>
            </div>
          </>
        ) : (
          <div className="mt-3 text-sm text-faint">
            Một số câu cần giám thị chấm tay. Vui lòng quay lại sau.
          </div>
        )}
      </div>

      {r.showDetail && r.details && r.details.length > 0 && (
        <div>
          <div className="mb-2 text-xs font-medium uppercase tracking-wide text-faint">
            Chi tiết từng câu
          </div>
          <ul className="space-y-2">
            {r.details.map((d, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded border border-default px-3 py-2 text-sm"
              >
                <span
                  className={`mt-0.5 inline-block h-3 w-3 shrink-0 rounded-full ${
                    d.correct ? "bg-emerald-500" : "bg-red-400"
                  }`}
                />
                <span className="flex-1 truncate">{d.prompt}</span>
                <span className="shrink-0 font-mono text-xs text-faint">
                  {d.awarded ?? 0}/{d.points}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <button
        onClick={onReset}
        className="w-full rounded border border-default bg-white px-4 py-2 text-sm hover:bg-slate-50"
      >
        Tra cứu lại
      </button>
    </div>
  );
}

function humanize(code: string): string {
  const map: Record<string, string> = {
    invalid_code: "Mã thi không hợp lệ.",
    result_not_found: "Không tìm thấy kết quả. Kiểm tra mã/email.",
    result_not_yet_graded: "Bài thi của bạn đang được chấm. Vui lòng quay lại sau.",
    candidate_email_required: "Vui lòng nhập email đúng định dạng.",
    rate_limited: "Quá nhiều lần tra cứu. Chờ vài phút rồi thử lại.",
  };
  return map[code] ?? `Lỗi: ${code}`;
}
