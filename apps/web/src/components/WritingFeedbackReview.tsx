"use client";

import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { CATEGORY_LABEL } from "@/lib/writingFeedbackText";
import WritingFeedbackView, { type WritingFeedbackBody } from "./WritingFeedbackView";

interface FeedbackRow {
  id: string;
  status: "draft" | "approved" | "rejected";
  body: WritingFeedbackBody;
  generatedAt: string;
  reviewedAt: string | null;
  reviewerNote: string | null;
}

/**
 * LANG G6c.3 — giảng viên duyệt góp ý AI cạnh bài nộp: sửa từng mục (bản sửa, giải thích), xoá mục, thêm
 * ghi chú, rồi Duyệt hoặc Từ chối. Chỉ sửa/xoá được lỗi đã có (không thêm lỗi mới, không đổi trích đoạn).
 */
export default function WritingFeedbackReview({ submissionId }: { submissionId: string }) {
  const [rows, setRows] = useState<FeedbackRow[] | null>(null);
  const [edits, setEdits] = useState<Record<string, { correction: string; explanation: string }>>({});
  const [removed, setRemoved] = useState<Set<string>>(new Set());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(apiUrl(`/api/submissions/${submissionId}/writing-feedback/review`));
      if (!res.ok) {
        setRows([]);
        return;
      }
      setRows(((await res.json()) as { feedbacks: FeedbackRow[] }).feedbacks);
    } catch {
      setRows([]);
    }
  }, [submissionId]);
  useEffect(() => {
    void load();
  }, [load]);

  if (rows === null) return <p className="text-meta mt-4">Đang tải góp ý AI…</p>;
  if (rows.length === 0) return null; // học viên chưa nhờ AI góp ý — không có gì để duyệt
  const latest = rows[0]!;
  const draft = latest.status === "draft" ? latest : null;

  async function act(action: "approve" | "reject") {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const body =
        action === "approve"
          ? {
              action,
              note: note.trim() || undefined,
              removeErrorIds: [...removed],
              editErrors: Object.entries(edits).map(([id, e]) => ({ id, correction: e.correction, explanation: e.explanation })),
            }
          : { action, note: note.trim() || undefined };
      const res = await fetch(apiUrl(`/api/writing-feedback/${draft.id}/review`), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        setError(res.status === 409 ? "Bản này đã được duyệt rồi — tải lại trang." : "Không lưu được. Vui lòng thử lại.");
        return;
      }
      setEdits({});
      setRemoved(new Set());
      setNote("");
      await load();
    } catch {
      setError("Không lưu được. Kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-6 rounded-lg border border-token p-3" aria-label="Duyệt góp ý AI" data-testid="writing-feedback-review">
      <h3 className="text-sm font-semibold">Góp ý bài viết do AI tạo</h3>
      {!draft ? (
        <div className="mt-2">
          <p className="text-meta mb-2">
            Bản gần nhất đã được <b>{latest.status === "approved" ? "duyệt" : "từ chối"}</b>
            {latest.status === "rejected" && " (học viên không thấy bản này)"}.
          </p>
          {latest.status === "approved" && <WritingFeedbackView body={latest.body} review="approved" reviewerNote={latest.reviewerNote} />}
        </div>
      ) : (
        <div className="mt-2 space-y-3">
          <p className="text-meta">
            Học viên đang thấy bản này kèm nhãn “chưa duyệt”. Sửa hoặc xoá mục sai rồi bấm Duyệt; Từ chối thì học viên sẽ không
            thấy bản này nữa.
          </p>
          {draft.body.summary && <p className="text-sm">{draft.body.summary}</p>}
          <ul className="space-y-2">
            {draft.body.errors.map((e) => {
              const gone = removed.has(e.id);
              const ed = edits[e.id] ?? { correction: e.correction, explanation: e.explanation };
              return (
                <li key={e.id} className={`rounded border border-token px-3 py-2 text-sm ${gone ? "opacity-50" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span>
                      <span className="mr-2 rounded bg-[rgb(var(--surface-muted))] px-2 py-0.5 text-xs text-muted">
                        {CATEGORY_LABEL[e.category] ?? e.category}
                      </span>
                      <span className="line-through decoration-red-400">{e.quote}</span>
                    </span>
                    <label className="flex shrink-0 items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={gone}
                        onChange={() =>
                          setRemoved((s) => {
                            const n = new Set(s);
                            if (n.has(e.id)) n.delete(e.id);
                            else n.add(e.id);
                            return n;
                          })
                        }
                      />
                      Xoá mục
                    </label>
                  </div>
                  <input
                    aria-label={`Bản sửa cho “${e.quote}”`}
                    className="input mt-2 w-full"
                    maxLength={300}
                    disabled={gone}
                    value={ed.correction}
                    onChange={(ev) => setEdits((p) => ({ ...p, [e.id]: { ...ed, correction: ev.target.value } }))}
                  />
                  <textarea
                    aria-label={`Giải thích cho “${e.quote}”`}
                    className="input mt-2 w-full"
                    rows={2}
                    maxLength={400}
                    disabled={gone}
                    value={ed.explanation}
                    onChange={(ev) => setEdits((p) => ({ ...p, [e.id]: { ...ed, explanation: ev.target.value } }))}
                  />
                </li>
              );
            })}
            {draft.body.errors.length === 0 && <li className="text-meta">AI không tìm thấy lỗi cần sửa.</li>}
          </ul>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Ghi chú cho học viên (không bắt buộc)</span>
            <textarea className="input w-full" rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => void act("approve")} className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              Duyệt
            </button>
            <button type="button" disabled={busy} onClick={() => void act("reject")} className="rounded-full border border-token px-4 py-1.5 text-sm hover:bg-brand-soft disabled:opacity-50">
              Từ chối
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
