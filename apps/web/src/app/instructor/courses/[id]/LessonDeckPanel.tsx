"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";

interface DeckSummary {
  id: string;
  title: string;
  slideCount: number;
  updatedAt: string;
}

interface Data {
  attached: DeckSummary | null;
  candidates: DeckSummary[];
}

const ERRORS: Record<string, string> = {
  forbidden: "Bạn không có quyền sửa khoá này.",
  deck_in_use: "Bài giảng này đang gắn với một bài học khác. Gỡ ở bài kia trước.",
  deck_not_owned_by_course_owner: "Chỉ gắn được bài giảng của chủ khoá.",
  lesson_has_deck: "Bài học đã có bài giảng. Tải lại trang rồi chọn lại.",
};

/**
 * Bài giảng slide của bài học (docs/tieu-chi/nghe-giang-slide.md, AC1): chọn một bài giảng của chủ khoá để học viên xem
 * slide ngay trong bài. Chưa có giọng đọc ở bước này; tạo giọng sẽ làm ở trang quản trị "Giọng đọc".
 */
export default function LessonDeckPanel({ lessonId, courseSlug }: { lessonId: string; courseSlug: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [pick, setPick] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(apiUrl(`/api/lessons/${lessonId}/deck`), { cache: "no-store" });
    if (r.ok) setData((await r.json()) as Data);
    else setError(ERRORS[((await r.json().catch(() => ({}))) as { error?: string }).error ?? ""] ?? "Không tải được bài giảng của bài học.");
  }, [lessonId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function attach() {
    if (!pick) return;
    const replacing = !!data?.attached;
    if (replacing && !window.confirm("Thay bài giảng đang gắn bằng bài giảng này? Bài giảng cũ không bị xoá, chỉ được gỡ khỏi bài học.")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/lessons/${lessonId}/deck`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId: pick, replace: replacing }),
      });
      if (!r.ok) setError(ERRORS[((await r.json().catch(() => ({}))) as { error?: string }).error ?? ""] ?? "Chưa gắn được bài giảng.");
      else setPick("");
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function detach() {
    if (!window.confirm("Gỡ bài giảng khỏi bài học? Bài giảng vẫn còn trong Limio-Live.")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/lessons/${lessonId}/deck`), { method: "DELETE" });
      if (!r.ok) setError("Chưa gỡ được bài giảng.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  if (!data) return <p className="text-sm text-muted">{error ?? "Đang tải…"}</p>;

  return (
    <div className="space-y-3 text-sm">
      {data.attached ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-token px-3 py-2">
          <span className="font-medium">{data.attached.title}</span>
          <span className="text-muted">{data.attached.slideCount} slide</span>
          <span className="ml-auto flex flex-wrap gap-2">
            <Link href={`/instructor/limio-live/${data.attached.id}`} className="btn-secondary btn-sm" prefetch={false}>
              Mở trình soạn
            </Link>
            <Link href={`/learn/${courseSlug}/lessons/${lessonId}/slides`} className="btn-secondary btn-sm" prefetch={false}>
              Xem slideshow
            </Link>
            <button type="button" className="btn-ghost btn-sm" onClick={() => void detach()} disabled={busy}>
              Gỡ
            </button>
          </span>
        </div>
      ) : (
        <p className="text-muted">Bài học chưa có bài giảng slide. Học viên vẫn nghe giảng theo bài viết.</p>
      )}

      {data.candidates.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <select className="input max-w-xs" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Chọn bài giảng của chủ khoá">
            <option value="">{data.attached ? "Đổi sang bài giảng khác…" : "Chọn bài giảng của chủ khoá…"}</option>
            {data.candidates.map((d) => (
              <option key={d.id} value={d.id}>
                {d.title} ({d.slideCount} slide)
              </option>
            ))}
          </select>
          <button type="button" className="btn-primary btn-sm" onClick={() => void attach()} disabled={busy || !pick}>
            {data.attached ? "Thay" : "Gắn vào bài"}
          </button>
        </div>
      ) : (
        !data.attached && (
          <p className="text-muted">
            Chủ khoá chưa có bài giảng nào chưa gắn. Tạo ở{" "}
            <Link href="/instructor/limio-live" className="link" prefetch={false}>
              Limio-Live
            </Link>
            .
          </p>
        )
      )}
      {error && <p role="alert" className="text-danger-700">{error}</p>}
    </div>
  );
}
