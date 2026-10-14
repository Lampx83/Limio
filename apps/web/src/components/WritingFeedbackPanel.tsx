"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { describeWritingError } from "@/lib/writingFeedbackText";
import WritingFeedbackView, { type WritingFeedbackBody } from "./WritingFeedbackView";

export interface LearnerFeedbackState {
  review: "unreviewed" | "approved";
  body: WritingFeedbackBody;
  reviewerNote: string | null;
}

/**
 * LANG G6 — học viên bấm "Nhận góp ý bài viết" trên bài đã nộp. Gửi bài tới nhà cung cấp AI và trừ ví
 * token AI của CHÍNH học viên (nói rõ ngay trên nút); bản nhận về là nháp kèm nhãn "chưa duyệt" cho tới
 * khi giảng viên duyệt. Hết lượt/hạn mức báo rõ, không thất bại lặng lẽ.
 */
export default function WritingFeedbackPanel({
  submissionId,
  initial,
}: {
  submissionId: string;
  initial: LearnerFeedbackState | null;
}) {
  const [fb, setFb] = useState<LearnerFeedbackState | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function request() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(apiUrl(`/api/submissions/${submissionId}/writing-feedback`), { method: "POST" });
      const j = (await res.json().catch(() => null)) as
        | { error?: string; reused?: boolean; status?: string; body?: WritingFeedbackBody }
        | null;
      if (!res.ok || !j?.body) {
        setError(describeWritingError(j?.error ?? (res.status === 401 ? "unauthorized" : undefined)));
        return;
      }
      setFb((prev) => ({
        review: j.status === "approved" ? "approved" : "unreviewed",
        body: j.body!,
        reviewerNote: prev?.reviewerNote ?? null,
      }));
      if (j.reused) setNote("Nội dung bài chưa đổi nên giữ nguyên góp ý trước — không gọi AI và không trừ thêm lượt.");
    } catch {
      setError("Chưa nhận được góp ý. Kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-token p-3" aria-label="Góp ý bài viết bằng AI" data-testid="writing-feedback-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Góp ý bài viết (AI)</h3>
        <button
          type="button"
          onClick={() => void request()}
          disabled={busy}
          className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Đang phân tích…" : fb ? "Phân tích lại" : "Nhận góp ý bài viết"}
        </button>
      </div>
      <p className="text-meta mt-1">
        Khi bấm, bài viết của bạn được gửi tới nhà cung cấp AI để phân tích và trừ một phần lượt AI trong ví của bạn
        (không trừ khi nội dung bài chưa đổi). Góp ý hiện ngay kèm nhãn “chưa duyệt” cho tới khi giảng viên duyệt.
      </p>
      {error && (
        <p role="alert" className="banner-danger mt-3 text-sm">
          {error}
        </p>
      )}
      {note && <p className="text-meta mt-2">{note}</p>}
      {fb && (
        <div className="mt-3">
          <WritingFeedbackView body={fb.body} review={fb.review} reviewerNote={fb.reviewerNote} />
        </div>
      )}
    </section>
  );
}
