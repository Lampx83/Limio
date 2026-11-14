"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { describeWritingError } from "@/lib/writingFeedbackText";
import { useT, useUiLang } from "@/lib/i18n/client";
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
  const t = useT();
  const lang = useUiLang();
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
        setError(describeWritingError(j?.error ?? (res.status === 401 ? "unauthorized" : undefined), lang));
        return;
      }
      setFb((prev) => ({
        review: j.status === "approved" ? "approved" : "unreviewed",
        body: j.body!,
        reviewerNote: prev?.reviewerNote ?? null,
      }));
      if (j.reused) setNote(t("practice.wf.p.reused"));
    } catch {
      setError(t("practice.wf.p.netError"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-lg border border-token p-3" aria-label={t("practice.wf.p.aria")} data-testid="writing-feedback-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold">{t("practice.wf.p.title")}</h3>
        <button
          type="button"
          onClick={() => void request()}
          disabled={busy}
          className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? t("practice.wf.p.busy") : fb ? t("practice.wf.p.again") : t("practice.wf.p.get")}
        </button>
      </div>
      <p className="text-meta mt-1">
        {t("practice.wf.p.consent")}
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
