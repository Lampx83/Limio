"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { SPEAKING_CONSENT, SPEAKING_NOTICE, describeSpeakingError } from "@/lib/speakingFeedbackText";
import SpeakingFeedbackView from "./SpeakingFeedbackView";
import type { WritingFeedbackBody } from "./WritingFeedbackView";

export interface LearnerSpeakingState {
  review: "unreviewed" | "approved";
  body: WritingFeedbackBody;
  reviewerNote: string | null;
  transcript: { text: string };
}

/**
 * LANG G7 — học viên bấm "Nhận góp ý bài nói" trên bài đã nộp có bản ghi âm. Bản ghi được gửi tới OpenAI (chuyển
 * chữ) rồi AI chấm; trừ ví token AI của CHÍNH học viên — nói rõ NGAY trên nút (G7e.2). Bản nhận về là nháp
 * kèm nhãn "chưa duyệt". Mọi lỗi (hết ví, không nghe thấy tiếng, quá dài...) đều có lời nhắn riêng.
 */
export default function SpeakingFeedbackPanel({
  submissionId,
  initial,
}: {
  submissionId: string;
  initial: LearnerSpeakingState | null;
}) {
  const [fb, setFb] = useState<LearnerSpeakingState | null>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  async function request() {
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(apiUrl(`/api/submissions/${submissionId}/speaking-feedback`), { method: "POST" });
      const j = (await res.json().catch(() => null)) as
        | { error?: string; reused?: boolean; status?: string; body?: WritingFeedbackBody; transcript?: { text: string } }
        | null;
      if (!res.ok || !j?.body) {
        setError(describeSpeakingError(j?.error ?? (res.status === 401 ? "unauthorized" : undefined)));
        return;
      }
      setFb((prev) => ({
        review: j.status === "approved" ? "approved" : "unreviewed",
        body: j.body!,
        reviewerNote: prev?.reviewerNote ?? null,
        transcript: j.transcript ?? prev?.transcript ?? { text: "" },
      }));
      if (j.reused) setNote("Bản ghi chưa đổi nên giữ nguyên góp ý trước — không gọi AI và không trừ thêm lượt.");
    } catch {
      setError("Chưa nhận được góp ý. Kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-token p-3" aria-label="Góp ý bài nói bằng AI" data-testid="speaking-feedback-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">Góp ý bài nói (AI)</h3>
        <button
          type="button"
          onClick={() => void request()}
          disabled={busy}
          className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Đang chuyển thành chữ và chấm…" : fb ? "Chấm lại" : "Nhận góp ý bài nói"}
        </button>
      </div>
      <p className="text-meta mt-1">{SPEAKING_CONSENT}</p>
      {!fb && <p className="text-meta mt-1">{SPEAKING_NOTICE}</p>}
      {error && (
        <p role="alert" className="banner-danger mt-3 text-sm">
          {error}
        </p>
      )}
      {note && <p className="text-meta mt-2">{note}</p>}
      {fb && (
        <div className="mt-3">
          <SpeakingFeedbackView body={fb.body} review={fb.review} reviewerNote={fb.reviewerNote} transcript={fb.transcript.text} />
        </div>
      )}
    </section>
  );
}
