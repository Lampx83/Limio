"use client";

import { useState } from "react";
import { copyText } from "@/lib/clipboard";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Copy, Download } from "lucide-react";
import type { ExamRun } from "@feedbackme/core-lms";
import { apiUrl, shareUrl } from "@/lib/apiUrl";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
  });

/**
 * Lịch sử các lần thi CÙNG MỘT DẠNG.
 *
 * Mỗi hình thức tổ chức có trang riêng, và lịch sử tách theo hình thức chứ
 * không gộp một chỗ: kỳ thi chính thức cần thấy ca/phòng/giám thị, còn link nhanh
 * chỉ cần mã và số người nộp.
 */
export default function ExamRunsList({
  runs,
  emptyHint,
}: {
  runs: ExamRun[];
  emptyHint?: string;
}) {
  const open = runs.filter((r) => r.isOpen);
  const past = runs.filter((r) => !r.isOpen);

  if (runs.length === 0) {
    return (
      <p className="rounded-lg border border-default bg-white px-4 py-6 text-center text-sm text-faint">
        {emptyHint ?? "Chưa có lần thi nào."}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {open.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold">
            Đang mở <span className="font-normal text-faint">· {open.length}</span>
          </h2>
          <ul className="mt-2 space-y-2">
            {open.map((r) => (
              <Row key={r.sessionId} r={r} />
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold">
            Đã đóng <span className="font-normal text-faint">· {past.length}</span>
          </h2>
          <ul className="mt-2 space-y-2">
            {past.map((r) => (
              <Row key={r.sessionId} r={r} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Row({ r }: { r: ExamRun }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [copyErr, setCopyErr] = useState(false);
  const [busy, setBusy] = useState(false);

  // Lần thi dùng mã cấp riêng hoặc vào bằng tài khoản thì không có link chung
  // để phát cho cả lớp.
  // shareUrl lo phần tiền tố đường dẫn của production — ghép tay với
  // window.location.origin thì ra link thiếu tiền tố, người nhận bấm vào 404.
  const fullUrl = r.path ? shareUrl(r.path) : "";

  const copy = async () => {
    // Nói thật khi hỏng. Bản cũ nuốt lỗi im lặng: clipboard giữ nguyên nội
    // dung cũ mà giao diện không báo gì, người dùng dán ra thứ chẳng liên quan
    // rồi tưởng app copy sai.
    const ok = await copyText(fullUrl);
    if (!ok) {
      setCopyErr(true);
      setTimeout(() => setCopyErr(false), 4000);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggle = async (open: boolean) => {
    if (
      !open &&
      !confirm(`Đóng buổi thi "${r.examTitle}"? Người đang làm vẫn làm hết giờ.`)
    )
      return;
    setBusy(true);
    try {
      await fetch(apiUrl(`/api/exam-sessions/${r.sessionId}/open-state`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ open }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  const setReveal = async (value: string) => {
    setBusy(true);
    try {
      await fetch(apiUrl(`/api/exam-sessions/${r.sessionId}/reveal-policy`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        // "inherit" là khái niệm của UI, không phải của API — quy về null.
        body: JSON.stringify({ policy: value === "inherit" ? null : value }),
      });
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <li
      className={`flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 ${
        r.isOpen
          ? "border-emerald-300 bg-emerald-50"
          : "border-default bg-white"
      }`}
    >
      <span className="inline-flex items-center gap-1.5">
        <span
          className={`font-mono text-base font-semibold tracking-widest ${
            r.isOpen ? "text-emerald-900" : "text-faint"
          }`}
        >
          {r.code ??
            (r.accessMode === "assigned_code" ? "mã riêng" : "ghi danh")}
        </span>
        {r.isOpen && r.code && (
          <button
            type="button"
            onClick={copy}
            className="rounded p-1 text-emerald-800 hover:bg-emerald-100"
            aria-label={`Sao chép link buổi thi ${r.examTitle}`}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </span>

      {/* min-w-48 chứ không min-w-0: khối này chứa TÊN ĐỀ, thứ giáo viên
          dùng để nhận ra dòng nào là dòng nào. Cho nó co vô hạn thì mọi nút
          khác giành hết chỗ và tên đề cụt thành "Bài kiểm tra ...". Có sàn thì
          khi chật, cụm nút xuống dòng — dài thêm một dòng còn hơn mất tên. */}
      <span className="min-w-48 flex-1">
        <span className="block truncate text-sm font-medium">{r.examTitle}</span>
        {r.startedCount > r.submittedCount && (
          <span className="block text-caption text-amber-700">
            {r.startedCount - r.submittedCount} người đang làm dở
          </span>
        )}
        {copyErr && (
          <span className="block text-caption text-red-700">
            Không sao chép được — đọc mã cho lớp hoặc bôi đen rồi copy tay.
          </span>
        )}
        <span className="block text-caption text-faint">
          {fmt(r.opensAt)} · {r.durationMin} phút
          {r.isOpen && !r.closesAt ? " · đóng khi bạn bấm" : ""}
          {r.closesAt ? ` · đóng ${fmt(r.closesAt)}` : ""}
        </span>
      </span>

      {/* Số bài đã nộp, kiểu Google Form: nhãn + số trong vòng tròn đậm.
          Trước đây nó nằm lẫn trong dòng phụ ("0/0 đã nộp") giữa giờ mở và
          thời lượng — thứ giáo viên mở trang này để xem đầu tiên lại là thứ
          khó thấy nhất.

          Đếm bài ĐÃ NỘP, không đếm bài đã bắt đầu: người mở đề rồi bỏ ngang
          chưa phải một lượt thi. Số đang làm dở hiện riêng, và chỉ khi có. */}
      <Link
        href={`/instructor/exam-runs/${r.sessionId}`}
        className="flex shrink-0 items-center gap-2 rounded px-1 py-0.5 hover:bg-black/5"
        title={`${r.submittedCount} bài đã nộp — bấm để xem chi tiết`}
      >
        <span className="text-sm text-ink-2">Bài đã nộp</span>
        <span className="flex h-7 min-w-7 items-center justify-center rounded-full bg-slate-800 px-1.5 text-sm font-semibold tabular-nums text-white">
          {r.submittedCount}
        </span>
      </Link>

      <span className="flex shrink-0 items-center gap-2">
        <Link
          href={`/instructor/exam-runs/${r.sessionId}`}
          className="text-xs underline"
        >
          Kết quả
        </Link>
        <a
          href={apiUrl(
            `/api/exams/${r.examId}/results?sessionId=${r.sessionId}`,
          )}
          className="inline-flex items-center gap-1 rounded border border-default bg-white px-2 py-1 text-xs hover:bg-slate-50"
          title="Tải kết quả thí sinh của lần thi này"
        >
          <Download className="h-3 w-3 shrink-0" />
          Tải
        </a>
        {/* Đổi được sau khi tạo: giáo viên hay chọn "không hiện" lúc tạo rồi
            cuối buổi mới muốn chữa đề cho cả lớp. Không cho sửa ở đây thì họ
            đi sửa cờ trên gói đề — mà cờ đó dùng chung cho mọi ca. */}
        <span className="text-xs text-faint">Đáp án</span>
        <select
          value={r.revealAnswers ?? "inherit"}
          onChange={(e) => setReveal(e.target.value)}
          disabled={busy}
          aria-label={`Chính sách hiện đáp án của buổi thi ${r.examTitle}`}
          title="Khi nào học sinh được xem đáp án và điểm chi tiết"
          className="rounded border border-default bg-white px-2 py-1 text-xs disabled:opacity-50"
        >
          {r.revealAnswers === null && (
            <option value="inherit">theo gói đề</option>
          )}
          <option value="immediately">hiện ngay</option>
          <option value="after_close">sau khi đóng</option>
          <option value="never">không hiện</option>
        </select>
        {r.timingMode === "manual" && (
          <button
            type="button"
            onClick={() => toggle(!r.isOpen)}
            disabled={busy}
            className="rounded border border-default bg-white px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-50"
          >
            {busy ? "…" : r.isOpen ? "Đóng" : "Mở lại"}
          </button>
        )}
      </span>
    </li>
  );
}
