"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

type Batch = {
  id: string;
  status: "running" | "completed" | "stopped" | "halted";
  total: number;
  done: number;
  failed: number;
  skipped: number;
  tokensUsed: number;
  stopRequested: boolean;
  haltReason: string | null;
  problems: { submissionId: string; code: string }[];
};

type Plan = {
  pending: number;
  estimatedTokens: number;
  budgetTokens: number;
  runnable: number;
  overflow: number;
  excluded: Record<string, number>;
};

const HALT_TEXT: Record<string, string> = {
  no_token_budget:
    "Ví token AI đã hết nên lô dừng giữa chừng. Các gợi ý đã có vẫn được giữ; nạp thêm token rồi chạy tiếp, bài đã có gợi ý sẽ không chạy lại.",
  global_token_cap: "Hệ thống đang vượt hạn mức dùng AI hôm nay nên lô dừng. Chạy tiếp sau; gợi ý đã có vẫn được giữ.",
  daily_token_cap: "Hệ thống đang vượt hạn mức dùng AI hôm nay nên lô dừng. Chạy tiếp sau; gợi ý đã có vẫn được giữ.",
  rate_limited: "AI đang bị giới hạn lượt gọi nên lô dừng. Chạy tiếp sau; gợi ý đã có vẫn được giữ.",
  openai_not_configured: "Hệ thống chưa cấu hình AI — báo quản trị viên.",
  forbidden: "Bạn không còn quyền chấm bài này nên lô dừng.",
  timeout: "Lô đã chạy quá lâu mà không có tiến triển nên được đóng lại. Bấm chạy lại cho các bài còn thiếu.",
  internal_error: "Lô dừng vì lỗi hệ thống. Bấm chạy lại cho các bài còn thiếu.",
};

const PROBLEM_TEXT: Record<string, string> = {
  attachment_unreadable: "AI không đọc được tệp học viên nộp",
  empty_submission: "bài nộp trống",
  already_graded: "đã được chấm tay trong lúc chạy",
  ai_error: "AI xử lý thất bại",
  validation_failed: "AI trả kết quả không hợp lệ",
  openai_error: "AI xử lý thất bại",
};

const EXCLUDED_TEXT: Record<string, string> = {
  has_suggestion: "đã có gợi ý",
  empty_submission: "bài trống",
};

const fmt = (n: number) => n.toLocaleString("vi-VN");

/**
 * Chấm bài tập bằng AI hàng loạt (docs/tieu-chi/cham-bai-tap-bang-ai-hang-loat.md). Chỉ tạo GỢI Ý; điểm chỉ được ghi
 * khi giảng viên chốt (từng bài trong cửa sổ chấm, hoặc chọn nhiều bài ở bảng rồi "Chốt theo gợi ý AI").
 */
export default function AiBatchPanel({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [batch, setBatch] = useState<Batch | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [includeFresh, setIncludeFresh] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevStatus = useRef<string | null>(null);

  const load = useCallback(
    async (fresh: boolean) => {
      try {
        const res = await fetch(apiUrl(`/api/assignments/${assignmentId}/ai-grade?includeFresh=${fresh ? 1 : 0}`));
        if (!res.ok) return;
        const d = (await res.json()) as { batch: Batch | null; plan: Plan };
        setBatch(d.batch);
        setPlan(d.plan);
      } catch {
        /* mạng chập chờn — lần thăm dò sau sẽ thử lại */
      } finally {
        setLoaded(true);
      }
    },
    [assignmentId],
  );

  useEffect(() => {
    void load(includeFresh);
  }, [load, includeFresh]);

  // Thăm dò tiến độ khi lô đang chạy; chạy xong thì làm mới trang để bảng hiện gợi ý mới.
  const running = batch?.status === "running";
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void load(includeFresh), 3000);
    return () => clearInterval(t);
  }, [running, load, includeFresh]);
  useEffect(() => {
    if (prevStatus.current === "running" && batch && batch.status !== "running") router.refresh();
    prevStatus.current = batch?.status ?? null;
  }, [batch, router]);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(apiUrl(`/api/assignments/${assignmentId}/ai-grade`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ includeFresh }),
      });
      const d = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(
          d.error === "no_token_budget"
            ? "Ví token AI của bạn không đủ cho bài nào. Nạp thêm token rồi thử lại."
            : d.error === "batch_running"
              ? "Đang có một lô chạy cho bài tập này."
              : d.error === "nothing_to_grade"
                ? "Không còn bài nào cần AI gợi ý."
                : d.error === "forbidden"
                  ? "Bạn không có quyền chấm bài này."
                  : "Không bắt đầu được. Thử lại sau.",
        );
        await load(includeFresh);
        return;
      }
      setConfirming(false);
      await load(includeFresh);
    } catch {
      setError("Mất kết nối tới máy chủ. Kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    try {
      await fetch(apiUrl(`/api/assignments/${assignmentId}/ai-grade/stop`), { method: "POST" });
      await load(includeFresh);
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;
  const hasPending = (plan?.pending ?? 0) > 0;
  const finished = batch && batch.status !== "running" ? batch : null;
  // Không có gì để chạy, không có lô nào đang chạy hay vừa xong: ẩn hẳn.
  if (!running && !hasPending && !finished && !confirming) return null;

  const processed = batch ? batch.done + batch.failed + batch.skipped : 0;
  const pct = batch && batch.total > 0 ? Math.round((processed / batch.total) * 100) : 0;
  const problemSummary = finished
    ? Object.entries(
        finished.problems.reduce<Record<string, number>>((m, p) => ({ ...m, [p.code]: (m[p.code] ?? 0) + 1 }), {}),
      )
    : [];

  return (
    <section className="mt-6 rounded-2xl border border-violet-200 bg-violet-50/60 p-4" aria-label="Chấm bằng AI hàng loạt">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-sm font-semibold text-violet-900">✨ Gợi ý điểm bằng AI cho cả lớp</h2>
        {!running && hasPending && !confirming && (
          <button type="button" className="btn-primary btn-sm" onClick={() => setConfirming(true)}>
            Gợi ý điểm bằng AI cho {plan!.pending} bài chưa chấm
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-violet-900/80">
        AI chỉ đưa ra gợi ý điểm và nhận xét; không có điểm nào được ghi cho tới khi thầy/cô chốt. Học viên không thấy gợi ý.
      </p>

      {error && (
        <p role="alert" className="banner-danger mt-2 text-sm">
          {error}
        </p>
      )}

      {confirming && !running && plan && (
        <div className="mt-3 rounded-xl border border-violet-200 bg-white p-3 text-sm">
          <p>
            Sẽ chạy AI cho <b>{plan.pending}</b> bài. Ước lượng cần khoảng <b>{fmt(plan.estimatedTokens)}</b> token; ví của bạn còn{" "}
            <b>{fmt(plan.budgetTokens)}</b> token.
          </p>
          {plan.overflow > 0 && (
            <p className="banner-warning mt-2 text-xs">
              Ví chỉ đủ khoảng {plan.runnable}/{plan.pending} bài. Hệ thống sẽ chạy {plan.runnable} bài đầu (theo thứ tự nộp) rồi dừng; nạp thêm
              token để chạy phần còn lại.
            </p>
          )}
          {Object.keys(plan.excluded).length > 0 && (
            <p className="mt-2 text-xs text-muted">
              Bỏ qua:{" "}
              {Object.entries(plan.excluded)
                .filter(([k]) => EXCLUDED_TEXT[k])
                .map(([k, n]) => `${n} bài ${EXCLUDED_TEXT[k]}`)
                .join("; ") || "—"}
              .
            </p>
          )}
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-muted">
            <input type="checkbox" checked={includeFresh} onChange={(e) => setIncludeFresh(e.target.checked)} />
            Chạy lại cả bài đã có gợi ý (tốn thêm token)
          </label>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn-primary btn-sm" disabled={busy || plan.runnable === 0} onClick={start}>
              {busy ? "Đang bắt đầu…" : `Bắt đầu (${plan.runnable} bài)`}
            </button>
            <button type="button" className="btn-secondary btn-sm" disabled={busy} onClick={() => setConfirming(false)}>
              Huỷ
            </button>
          </div>
        </div>
      )}

      {running && batch && (
        <div className="mt-3" role="status" aria-live="polite">
          <div className="flex items-center justify-between text-sm">
            <span>
              Đã xong {processed}/{batch.total} bài
              {batch.failed > 0 && <span className="text-danger-700"> · lỗi {batch.failed}</span>}
              {batch.skipped > 0 && <span className="text-muted"> · bỏ qua {batch.skipped}</span>}
            </span>
            <button type="button" className="btn-secondary btn-sm" disabled={busy || batch.stopRequested} onClick={stop}>
              {batch.stopRequested ? "Đang dừng…" : "Dừng"}
            </button>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-violet-100">
            <div className="h-full rounded-full bg-violet-500 transition-all" style={{ width: `${pct}%` }} />
          </div>
          <p className="mt-1 text-xs text-muted">
            Có thể đóng trang, lô vẫn chạy nền. Bài đang chạy sẽ xong rồi mới dừng khi bấm &ldquo;Dừng&rdquo;.
          </p>
        </div>
      )}

      {finished && !running && (
        <div className="mt-3 text-sm" role="status">
          <p>
            {finished.status === "completed" ? "Lô gần nhất đã xong" : finished.status === "stopped" ? "Lô gần nhất đã dừng theo yêu cầu" : "Lô gần nhất dừng giữa chừng"}
            : {finished.done}/{finished.total} bài có gợi ý
            {finished.failed > 0 && `, ${finished.failed} bài lỗi`}
            {finished.skipped > 0 && `, ${finished.skipped} bài chưa gợi ý được`}
            {finished.tokensUsed > 0 && ` · đã dùng khoảng ${fmt(finished.tokensUsed)} token`}.
          </p>
          {finished.haltReason && (
            <p className="banner-warning mt-2 text-xs">{HALT_TEXT[finished.haltReason] ?? "Lô dừng giữa chừng."}</p>
          )}
          {problemSummary.length > 0 && (
            <p className="mt-1 text-xs text-muted">
              Chưa gợi ý được: {problemSummary.map(([code, n]) => `${n} bài (${PROBLEM_TEXT[code] ?? code})`).join("; ")}. Các bài lỗi sẽ được chạy lại khi bạn bấm
              chạy lần nữa.
            </p>
          )}
        </div>
      )}
    </section>
  );
}
