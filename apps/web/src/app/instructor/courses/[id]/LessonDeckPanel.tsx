"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
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
  isOwner: boolean;
}

const ERRORS: Record<string, string> = {
  forbidden: "Bạn không có quyền sửa khoá này.",
  deck_in_use: "Bài giảng này đang gắn với một bài học khác. Gỡ ở bài kia trước.",
  deck_not_owned_by_course_owner: "Chỉ gắn được bài giảng của chủ khoá.",
  lesson_has_deck: "Bài học đã có bài giảng. Tải lại trang rồi chọn lại.",
  only_course_owner: "Chỉ chủ khoá tạo được bài giảng từ bài viết (bài giảng thuộc chủ khoá).",
  source_too_short: "Bài viết còn quá ngắn để soạn bài giảng.",
  openai_not_configured: "Chưa cấu hình mô hình AI trên máy chủ này.",
  empty_outline: "AI chưa soạn được dàn ý. Thử lại sau.",
  generate_failed: "AI chưa soạn được dàn ý. Thử lại sau.",
  validation_failed: "AI trả về dàn ý chưa hợp lệ. Thử lại sau.",
  ai_quota_exceeded: "Đã hết hạn mức AI. Thử lại sau.",
};

/**
 * Bài giảng slide của bài học (docs/tieu-chi/nghe-giang-slide.md, AC1): chọn một bài giảng của chủ khoá để học viên xem
 * slide ngay trong bài. Chưa có giọng đọc ở bước này; tạo giọng sẽ làm ở trang quản trị "Giọng đọc".
 */
export default function LessonDeckPanel({ lessonId, courseSlug }: { lessonId: string; courseSlug: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [pick, setPick] = useState("");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

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
      const form = new FormData();
      form.set("lessonId", lessonId);
      if (replacing) form.set("replace", "1");
      const r = await fetch(apiUrl("/api/instructor/limio-live/outline"), { method: "POST", body: form });
      if (!r.ok || !r.body) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setError(ERRORS[j.error ?? ""] ?? "Chưa tạo được bài giảng từ bài viết.");
        return;
      }
      // Luồng NDJSON: nhịp giữ kết nối rồi {type:"done",deckId} hoặc {type:"error",error}.
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let deckId: string | null = null;
      let failure: string | null = null;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as { type: string; deckId?: string; error?: string };
          if (ev.type === "done" && ev.deckId) deckId = ev.deckId;
          if (ev.type === "error") failure = ev.error ?? "generate_failed";
        }
      }
      if (failure || !deckId) setError(ERRORS[failure ?? ""] ?? "Chưa tạo được bài giảng từ bài viết.");
      else router.push(`/instructor/limio-live/${deckId}/outline`);
    } catch {
      setError("Mất kết nối khi soạn dàn ý. Thử lại.");
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
      {data.isOwner && (
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
      )}
      {error && <p role="alert" className="text-danger-700">{error}</p>}
    </div>
  );
}
