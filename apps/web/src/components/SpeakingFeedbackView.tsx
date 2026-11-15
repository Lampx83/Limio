"use client";

import { useT } from "@/lib/i18n/client";
import WritingFeedbackView, { type WritingFeedbackBody } from "./WritingFeedbackView";

/**
 * LANG G7 — hiển thị một bản góp ý bài nói. Dùng chung phần thân với góp ý Viết (nhãn chưa duyệt/đã duyệt,
 * tiêu chí ba mức, lỗi → bản sửa → giải thích), thêm: ghi chú cố định về giới hạn phát âm (G7c.1) và bản chữ
 * máy nghe được kèm nhãn "có thể nghe sai" (G7c.2). Mọi chữ là text node — React tự thoát HTML.
 */
export default function SpeakingFeedbackView({
  body,
  review,
  reviewerNote,
  transcript,
}: {
  body: WritingFeedbackBody;
  review: "unreviewed" | "approved";
  reviewerNote?: string | null;
  transcript: string;
}) {
  const t = useT();
  return (
    <div className="space-y-4" data-testid="speaking-feedback-view">
      <p className="banner-info text-sm" role="note">
        {t("practice.sf.notice")}
      </p>
      <WritingFeedbackView body={body} review={review} reviewerNote={reviewerNote} />
      <section aria-label={t("practice.sf.v.transcriptAria")}>
        <h4 className="text-sm font-semibold">
          {t("practice.sf.v.heard")} <span className="text-meta font-normal">{t("practice.sf.v.mayBeWrong")}</span>
        </h4>
        <p className="mt-1 whitespace-pre-wrap rounded border border-token bg-[rgb(var(--surface-muted))] px-3 py-2 text-sm">
          {transcript}
        </p>
      </section>
    </div>
  );
}
