"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, CheckCircle2, FileQuestion, Play, Timer } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import EntryShell, { EntryFacts, EntryGreeting } from "@/components/exam/EntryShell";

const MESSAGES: Record<string, string> = {
  exam_not_open: "Ca thi chưa mở. Vui lòng đợi trong phòng chờ.",
  exam_window_closed: "Ca thi đã đóng.",
  invalid_code: "Mã vào thi không còn hiệu lực.",
  attempt_already_submitted: "Bạn đã nộp bài trong ca này.",
  candidate_disabled: "Thí sinh này đã bị vô hiệu hoá. Liên hệ giảng viên.",
  forbidden: "Tài khoản này không được vào ca thi này. Liên hệ giảng viên.",
  rate_limited: "Bạn thao tác quá nhanh. Thử lại sau ít phút.",
  network_not_allowed: "Bạn đang ở dải mạng không phù hợp để vào thi.",
};

/** Vào thi bằng tài khoản đang đăng nhập — không hỏi lại tên hay MSSV. */
export default function AccountClaim({
  code,
  examTitle,
  subtitle,
  displayName,
  durationMin,
  questionCount,
  resuming,
  submitted,
}: {
  code: string;
  examTitle: string;
  subtitle: string | null;
  displayName: string;
  durationMin: number;
  questionCount: number;
  /** Đã có bài đang làm: bấm sẽ tiếp tục, không bắt đầu lại. */
  resuming: boolean;
  /** Đã nộp (hoặc hết giờ tự nộp) trong ca này: không còn gì để vào. */
  submitted: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(apiUrl(`/api/exam-lobby/${code}/claim`), { method: "POST" });
      const j = (await r.json().catch(() => null)) as { attemptId?: string; error?: string } | null;
      if (!r.ok || !j?.attemptId) {
        setErr(MESSAGES[j?.error ?? ""] ?? "Không vào được ca thi. Thử lại.");
        setBusy(false);
        return;
      }
      // Giữ nút bận tới khi chuyển trang xong: nhả sớm thì bấm đúp tạo hai lượt.
      router.replace(`/exam-take/${j.attemptId}`);
    } catch {
      setErr("Lỗi mạng — thử lại");
      setBusy(false);
    }
  };

  if (submitted) {
    return (
      <EntryShell step={3}>
        <EntryGreeting name={displayName} />
        <div className="mt-4 text-center">
          <CheckCircle2 className="mx-auto h-14 w-14 text-emerald-500" aria-hidden />
          <h1 className="mt-4 text-h2 text-[rgb(var(--text))]">Bạn đã nộp bài</h1>
          <p className="mt-2 text-sm text-muted">
            Bài làm của bạn trong <b className="text-[rgb(var(--text))]">{examTitle}</b> đã được ghi
            nhận. Mỗi thí sinh chỉ làm một lượt.
          </p>
          <p className="mt-1 text-xs text-faint">Cần làm lại hoặc có nhầm lẫn, hãy liên hệ giảng viên.</p>
        </div>
      </EntryShell>
    );
  }

  return (
    <EntryShell step={3}>
      <EntryGreeting name={displayName} />
      <div className="mt-4 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800 dark:bg-brand-900 dark:text-brand-100">
          <span className="relative flex h-2 w-2" aria-hidden>
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-60" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-600" />
          </span>
          {resuming ? "Bài đang làm của bạn" : "Ca thi đã mở"}
        </span>
        <h1 className="mt-4 text-h2 text-[rgb(var(--text))]">{examTitle}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>

      <div className="mt-6">
        <EntryFacts
          items={[
            { icon: <Timer className="h-3.5 w-3.5" />, label: "Thời gian", value: `${durationMin} phút` },
            { icon: <FileQuestion className="h-3.5 w-3.5" />, label: "Số câu", value: questionCount > 0 ? `${questionCount} câu` : "—" },
          ]}
        />
      </div>

      <p className="mt-5 flex items-start gap-2 rounded-xl bg-[rgb(var(--surface-muted))] px-4 py-3 text-sm text-muted">
        <Timer className="mt-0.5 h-4 w-4 shrink-0 text-accent-600" aria-hidden />
        <span>
          {resuming ? (
            <>Bạn sẽ tiếp tục bài đang làm; đồng hồ không bị tính lại.</>
          ) : (
            <>
              Đồng hồ <b className="text-[rgb(var(--text))]">{durationMin} phút</b> bắt đầu ngay khi bạn
              bấm Vào thi.
            </>
          )}
        </span>
      </p>

      <button
        type="button"
        onClick={start}
        disabled={busy}
        className="btn-primary btn-lg mt-6 w-full"
      >
        <Play className="h-5 w-5" aria-hidden />
        {busy ? "Đang vào thi…" : resuming ? "Tiếp tục làm bài" : "Vào thi"}
      </button>

      {err && (
        <p
          role="alert"
          className="mt-4 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-200"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          {err}
        </p>
      )}

    </EntryShell>
  );
}
