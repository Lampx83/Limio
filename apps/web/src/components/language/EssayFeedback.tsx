"use client";

import { apiUrl } from "@/lib/apiUrl";
import {
  CRITERION_LABEL,
  LEVEL_CLASS,
  LEVEL_LABEL,
  feedbackErrorMessage,
  sampleAudioOf,
  sampleTextOf,
  type FeedbackView,
} from "@/lib/practiceEssayView";

/**
 * Kết quả của câu mở sau "Kiểm tra câu n" (docs/tieu-chi/bai-luyen-tra-loi-bang-giong-noi-va-bai-mau.md, AC2–AC4):
 * khối "Góp ý" do AI viết (không có số điểm), rồi khối "Bài mẫu" (chữ + audio nếu có). Cả hai nằm DƯỚI câu trả lời của
 * học viên. Không có góp ý (AI tắt, chưa cấu hình, lỗi) thì vẫn hiện bài mẫu kèm lời nhắn nhẹ.
 */
export default function EssayFeedback({
  config,
  feedback,
  feedbackError,
  preview,
}: {
  /** Cấu hình đầy đủ của câu (có `explanation`, `explanationAudio`) — chỉ trả về sau khi kiểm tra. */
  config: unknown;
  feedback: FeedbackView | null;
  feedbackError: string | null;
  preview: boolean;
}) {
  const sample = sampleTextOf(config);
  const audio = sampleAudioOf(config);
  const errorText = feedback ? null : feedbackErrorMessage(feedbackError, !!sample);

  return (
    <div className="mt-3 space-y-3" data-testid="lp-essay-result">
      {feedback && (
        <section aria-label="Góp ý" data-testid="lp-feedback" className="break-words rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-3">
          <h4 className="text-sm font-semibold">Góp ý</h4>
          <p className="text-xs text-muted">Góp ý do AI tạo, có thể sai. Hãy đối chiếu với bài mẫu.</p>
          {feedback.summary && <p className="mt-2 text-sm leading-relaxed">{feedback.summary}</p>}
          {feedback.criteria.length > 0 && (
            <ul className="mt-3 space-y-2">
              {feedback.criteria.map((c) => (
                <li key={c.key} data-testid={`lp-criterion-${c.key}`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{CRITERION_LABEL[c.key]}</span>
                    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${LEVEL_CLASS[c.level]}`}>{LEVEL_LABEL[c.level]}</span>
                  </div>
                  {c.comment && <p className="mt-0.5 text-sm leading-relaxed">{c.comment}</p>}
                </li>
              ))}
            </ul>
          )}
          {feedback.errors.length > 0 && (
            <div className="mt-3">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-muted">Lỗi cần sửa</h5>
              <ul className="mt-1 space-y-2">
                {feedback.errors.map((e, i) => (
                  <li key={i} className="text-sm leading-relaxed" data-testid="lp-feedback-error">
                    <span className="text-muted line-through decoration-1">{e.quote}</span>
                    <span aria-hidden> → </span>
                    <span className="sr-only"> sửa thành </span>
                    <span className="font-semibold text-lime-800">{e.correction}</span>
                    {e.explanation && <p className="text-xs text-muted">{e.explanation}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {feedback.nextSteps.length > 0 && (
            <div className="mt-3">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-muted">Bước luyện tiếp</h5>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed">
                {feedback.nextSteps.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {!feedback && preview && <p className="text-xs text-muted">Xem thử: không nhận xét bằng AI.</p>}
      {errorText && (
        <p role="status" className="rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-3 text-sm" data-testid="lp-feedback-note">
          {errorText}
        </p>
      )}

      {sample ? (
        <section aria-label="Bài mẫu" data-testid="lp-sample" className="break-words rounded-lg border border-lime-300 bg-lime-50 p-3">
          <h4 className="text-sm font-semibold text-lime-800">
            Bài mẫu <span className="font-normal text-muted">· Sample answer</span>
          </h4>
          <p className="text-xs text-muted">Hãy tự đối chiếu bài làm của bạn với bài mẫu.</p>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[rgb(var(--text))]">{sample}</p>
          {audio && (
            <div className="mt-3" data-testid="lp-sample-audio">
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <audio controls preload="none" src={apiUrl(audio)} className="w-full" aria-label="Nghe bài mẫu" />
            </div>
          )}
        </section>
      ) : (
        !feedback && !errorText && !preview && (
          <p className="rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-3 text-sm" data-testid="lp-essay-manual">
            Câu tự luận không kiểm tra tự động được. Hãy nhờ giảng viên góp ý.
          </p>
        )
      )}
    </div>
  );
}
