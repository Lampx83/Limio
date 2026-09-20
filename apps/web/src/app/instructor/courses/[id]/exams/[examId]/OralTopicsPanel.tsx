"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Shuffle, Trash2 } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import EmptyState from "@/components/ui/EmptyState";

interface Topic {
  id: string;
  title: string;
  brief: string;
  orderIndex: number;
  /** Số lượt thi đã được giao chủ đề này. */
  assignedCount: number;
}

// Phải khớp TopicInput trong packages/core-lms/src/exam/oral-topics.ts.
const TITLE_MAX = 200;
const BRIEF_MAX = 4_000;
const TOPICS_MAX = 30;

const FRIENDLY_ERROR: Record<string, string> = {
  validation_failed: "Cần nhập cả tiêu đề và mô tả (và không vượt giới hạn ký tự).",
  exam_not_draft: "Đề đã publish — chủ đề đã khoá.",
  topic_not_found: "Chủ đề này không còn tồn tại.",
};

/**
 * A6.7 — Chủ đề giao cho từng sinh viên. Khi sinh viên bắt đầu lượt vấn đáp, hệ thống GIAO một chủ đề
 * (chia đều cả lớp) và AI giám khảo chỉ hỏi trong chủ đề đó. Không có chủ đề nào = cả lớp hỏi chung theo
 * tài liệu như trước. Chủ đề khoá sau khi publish (cùng lý do với tài liệu: công bằng giữa các sinh viên).
 */
export default function OralTopicsPanel({ examId, editable }: { examId: string; editable: boolean }) {
  const router = useRouter();
  const [topics, setTopics] = useState<Topic[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    const res = await fetch(apiUrl(`/api/exams/${examId}/oral-topics`));
    if (res.ok) setTopics(((await res.json()) as { topics: Topic[] }).topics);
  };

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  function resetForm() {
    setTitle("");
    setBrief("");
    setEditingId(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const res = await fetch(
        apiUrl(
          editingId ? `/api/exams/${examId}/oral-topics/${editingId}` : `/api/exams/${examId}/oral-topics`,
        ),
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, brief }),
        },
      );
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(FRIENDLY_ERROR[data.error ?? ""] ?? "Lưu chủ đề thất bại.");
        return;
      }
      resetForm();
      await refresh();
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Xoá chủ đề này?")) return;
    setErr(null);
    const res = await fetch(apiUrl(`/api/exams/${examId}/oral-topics/${id}`), { method: "DELETE" });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErr(FRIENDLY_ERROR[data.error ?? ""] ?? "Xoá thất bại.");
      return;
    }
    if (editingId === id) resetForm();
    await refresh();
    router.refresh();
  }

  function startEdit(t: Topic) {
    setEditingId(t.id);
    setTitle(t.title);
    setBrief(t.brief);
    setErr(null);
  }

  const atLimit = (topics?.length ?? 0) >= TOPICS_MAX && !editingId;

  return (
    <section className="mt-6 rounded border border-default bg-white p-5">
      <h2 className="mb-1 text-base font-semibold">Chủ đề giao cho từng sinh viên</h2>
      <p className="mb-4 text-sm text-faint">
        Tuỳ chọn. Khi sinh viên bắt đầu lượt vấn đáp, hệ thống giao <strong>một chủ đề</strong> (chia đều cả
        lớp; thi lại thì ưu tiên chủ đề chưa gặp) và AI chỉ hỏi trong chủ đề đó. Mỗi chủ đề gồm tiêu đề và mô
        tả — bối cảnh, dữ kiện — để AI đọc. Không có chủ đề nào: cả lớp cùng hỏi chung theo tài liệu.
      </p>

      {!editable && (
        <p className="banner-warning mb-4 px-3 py-2 text-caption">
          Đề đã publish hoặc lưu trữ — chủ đề đã khoá, không thêm/sửa/xoá được nữa.
        </p>
      )}

      {err && (
        <div className="mb-4 rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">{err}</div>
      )}

      {topics === null ? (
        <p className="text-sm text-faint">Đang tải…</p>
      ) : topics.length === 0 ? (
        <EmptyState
          icon="🎲"
          title="Chưa có chủ đề nào"
          description="Không bắt buộc. Thêm chủ đề nếu muốn mỗi sinh viên được hỏi về một tình huống riêng."
        />
      ) : (
        <ul className="space-y-2">
          {topics.map((t, i) => (
            <li key={t.id} className="flex items-start gap-3 rounded border border-default p-3">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-caption font-medium">
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{t.title}</p>
                <p className="mt-0.5 line-clamp-2 whitespace-pre-line text-caption text-faint">{t.brief}</p>
                {t.assignedCount > 0 && (
                  <p className="mt-1 text-caption text-faint">Đã giao cho {t.assignedCount} lượt thi</p>
                )}
              </div>
              {editable && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    aria-label="Sửa"
                    onClick={() => startEdit(t)}
                    className="rounded p-1 text-faint hover:bg-slate-100"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    aria-label="Xoá"
                    onClick={() => remove(t.id)}
                    className="rounded p-1 text-red-600 hover:bg-red-50"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {topics !== null && topics.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-caption text-faint">
          <Shuffle size={14} aria-hidden />
          {topics.length} chủ đề — mỗi sinh viên được giao một chủ đề, chia đều.
        </p>
      )}

      {editable && (
        <form onSubmit={submit} className="mt-5 space-y-3 rounded border border-default bg-slate-50 p-4">
          <p className="text-sm font-medium">{editingId ? "Sửa chủ đề" : "Thêm chủ đề"}</p>
          <div>
            <label htmlFor="oral-topic-title" className="block text-caption font-medium">
              Tiêu đề (AI sẽ nói ra với sinh viên)
            </label>
            <input
              id="oral-topic-title"
              value={title}
              maxLength={TITLE_MAX}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Trang đăng ký học phần"
              className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label htmlFor="oral-topic-brief" className="block text-caption font-medium">
              Mô tả cho AI — bối cảnh, dữ kiện (sinh viên không đọc trực tiếp)
            </label>
            <textarea
              id="oral-topic-brief"
              rows={4}
              value={brief}
              maxLength={BRIEF_MAX}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="VD: Cuối đợt đăng ký, 35% sinh viên bỏ dở ở bước chọn lớp; nhật ký cho thấy họ mở 6–7 lớp rồi thoát."
              className="mt-1 w-full rounded border border-default bg-white px-3 py-2 text-sm"
            />
            <p className="mt-1 text-right text-caption text-faint" aria-live="polite">
              {brief.length.toLocaleString("vi-VN")} / {BRIEF_MAX.toLocaleString("vi-VN")} ký tự
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={busy || atLimit || !title.trim() || !brief.trim()}
              className="btn btn-primary btn-sm disabled:opacity-50"
            >
              {busy ? "Đang lưu…" : editingId ? "Lưu thay đổi" : "Thêm chủ đề"}
            </button>
            {editingId && (
              <button type="button" onClick={resetForm} className="btn btn-secondary btn-sm">
                Huỷ
              </button>
            )}
            {atLimit && <span className="text-caption text-faint">Đã đủ {TOPICS_MAX} chủ đề.</span>}
          </div>
        </form>
      )}
    </section>
  );
}
