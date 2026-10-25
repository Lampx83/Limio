"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { LESSON_DECK_ERRORS, LessonDeckClientError, createLessonDeckFromArticle } from "@/lib/lessonDeckClient";

interface DeckSummary {
  id: string;
  title: string;
  slideCount: number;
  updatedAt: string;
  canOpen: boolean;
  ownerName: string | null;
}

interface Data {
  attached: DeckSummary | null;
  candidates: DeckSummary[];
}

const ERRORS = LESSON_DECK_ERRORS;

/**
 * Bài giảng slide của bài học (docs/tieu-chi/nghe-giang-slide.md, AC1): chọn một bài giảng của chính bạn để học viên xem
 * slide ngay trong bài. Chưa có giọng đọc ở bước này; tạo giọng sẽ làm ở trang quản trị "Giọng đọc".
 */
export default function LessonDeckPanel({ lessonId, courseSlug }: { lessonId: string; courseSlug: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [pick, setPick] = useState("");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [hidden, setHidden] = useState(false);

  const load = useCallback(async () => {
    const r = await fetch(apiUrl(`/api/lessons/${lessonId}/deck`), { cache: "no-store" });
    if (r.status === 403) setHidden(true); // chỉ chủ khoá dùng phần này: người khác không thấy mục
    else if (r.ok) setData((await r.json()) as Data);
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

  /**
   * Tạo bài giảng slide từ chữ của bài học (nghe-giang-slide.md, AC2): máy chủ đọc bài, AI đề xuất dàn ý rồi gắn bài giảng nháp vào
   * bài học. Sau đó chuyển sang trang dàn ý để thầy/cô xem, sửa và xác nhận trước khi sinh slide.
   */
  async function generate() {
    const replacing = !!data?.attached;
    if (
      replacing &&
      !window.confirm("Bài học đang có bài giảng. Tạo bài giảng mới từ bài viết sẽ thay bài giảng đó (bài giảng cũ không bị xoá, chỉ được gỡ khỏi bài học). Tiếp tục?")
    )
      return;
    setBusy(true);
    setGenerating(true);
    setError(null);
    try {
      const { deckId } = await createLessonDeckFromArticle(lessonId, { replace: replacing });
      router.push(`/instructor/limio-live/${deckId}/outline`);
    } catch (e) {
      setError(e instanceof LessonDeckClientError ? e.message : "Mất kết nối khi soạn dàn ý. Thử lại.");
    } finally {
      setGenerating(false);
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

  if (hidden) return null;
  if (!data) return <p className="text-sm text-muted">{error ?? "Đang tải…"}</p>;

  return (
    <div className="space-y-3 text-sm">
      {data.attached ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-token px-3 py-2">
          <span className="font-medium">{data.attached.title}</span>
          <span className="text-muted">{data.attached.slideCount} slide</span>
          <span className="ml-auto flex flex-wrap gap-2">
            {data.attached.canOpen && (
              <Link href={`/instructor/limio-live/${data.attached.id}`} className="btn-secondary btn-sm" prefetch={false}>
                Mở trình soạn
              </Link>
            )}
            <Link href={`/learn/${courseSlug}/lessons/${lessonId}/slides`} className="btn-secondary btn-sm" prefetch={false}>
              Xem slideshow
            </Link>
            <button type="button" className="btn-ghost btn-sm" onClick={() => void detach()} disabled={busy}>
              Gỡ
            </button>
          </span>
          {!data.attached.canOpen && (
            <p className="w-full text-muted">
              Bài giảng của {data.attached.ownerName ?? "người khác"}; nhờ họ thêm thầy/cô làm đồng giảng viên của bài giảng để mở trình soạn. Thầy/cô vẫn gỡ hoặc thay được.
            </p>
          )}
        </div>
      ) : (
        <p className="text-muted">Bài học chưa có bài giảng slide. Học viên vẫn nghe giảng theo bài viết.</p>
      )}

      {data.candidates.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <select className="input max-w-xs" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Chọn bài giảng của bạn">
            <option value="">{data.attached ? "Đổi sang bài giảng khác…" : "Chọn bài giảng của bạn hoặc được chia sẻ…"}</option>
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
            Bạn chưa có bài giảng nào chưa gắn. Tạo ở{" "}
            <Link href="/instructor/limio-live" className="link" prefetch={false}>
              Limio-Live
            </Link>
            .
          </p>
        )
      )}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary btn-sm" onClick={() => void generate()} disabled={busy}>
          {generating ? "Đang soạn dàn ý…" : "Tạo bài giảng từ bài viết"}
        </button>
        <span className="text-muted">
          {generating
            ? "AI đọc bài viết và đề xuất dàn ý, khoảng một phút. Đừng đóng trang."
            : "AI soạn từ chữ của bài; thầy/cô xem và xác nhận dàn ý trước khi tạo slide."}
        </span>
      </div>
      {error && <p role="alert" className="text-danger-700">{error}</p>}
    </div>
  );
}
