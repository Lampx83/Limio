"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeftRight, ChevronDown, Headphones, Info, Loader2, Pencil, Presentation, Users, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { LessonDeckClientError, createLessonDeckFromArticle, lessonDeckErrorText } from "@/lib/lessonDeckClient";

export interface LessonSlideInfo {
  /** Bài giảng đang gắn với bài học (null = chưa có); slideCount 0 = mới có dàn ý, chưa tạo slide. */
  deck: { id: string; slideCount: number; canOpen: boolean; ownerName: string | null } | null;
  /** Số từ của bài (0 = bài không có chữ) và đã đủ dài để soạn dàn ý chưa. */
  textWords: number;
  longEnough: boolean;
  /** Ước lượng token của cả việc tạo bài giảng, đã tính ở máy chủ. */
  tokenLabel: string;
}

/**
 * Nút "Slide" của người sửa được khoá, đứng cạnh Nghe giảng và Podcast (docs/tieu-chi/nghe-giang-slide.md, AC6).
 * - Chưa có bài giảng: bấm ra hộp hỏi "tạo slide từ nội dung bài?" (kèm lời khuyên và chi phí).
 * - Mới có dàn ý chưa tạo slide: menu một mục "Tiếp tục" tới trang dàn ý.
 * - Đã có slide: menu "Xem slide để dạy" (trình chiếu Limio-Live) / "Xem slide để nghe giảng" (slideshow như học viên).
 * Chủ khoá và đồng giảng viên của khoá đều thấy nút. Bài giảng thuộc người tạo; chỉ chủ bài và đồng giảng viên của bài giảng (Limio-Live)
 * mở được trình soạn và trình chiếu, người khác chỉ có "Xem slide để nghe giảng". Học viên không có nút này; nút nghe giảng slide của họ chỉ hiện khi bài đã có giọng.
 */
export default function LessonSlideButton({
  lessonId,
  lessonTitle,
  courseSlug,
  info,
}: {
  lessonId: string;
  lessonTitle: string;
  courseSlug: string;
  info: LessonSlideInfo;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<"create" | "pick" | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const { deck } = info;

  useEffect(() => {
    if (!menuOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const item = "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm hover:bg-[rgb(var(--surface-muted))]";
  const hasMenu = !!deck;
  // Lối tắt sửa slide: chỉ người mở được trình soạn (chủ bài giảng, đồng giảng viên của bài giảng) mới thấy.
  const editHref = deck?.canOpen ? (deck.slideCount === 0 ? `/instructor/limio-live/${deck.id}/outline` : `/instructor/limio-live/${deck.id}`) : null;

  return (
    <div ref={rootRef} className="relative print:hidden max-sm:min-w-0 max-sm:flex-1">
      <button
        type="button"
        className={`btn-listen btn-listen-slide${editHref ? " btn-listen-has-edit" : ""}`}
        aria-haspopup={hasMenu ? "menu" : "dialog"}
        aria-expanded={hasMenu ? menuOpen : dialog !== null}
        onClick={() => (hasMenu ? setMenuOpen((v) => !v) : setDialog("create"))}
      >
        <span className="listen-icon">
          <Presentation size={18} />
        </span>
        <span className="listen-label">
          <span>Slide</span>
        </span>
        {hasMenu && <ChevronDown size={14} aria-hidden="true" className={`transition-transform ${menuOpen ? "rotate-180" : ""}`} />}
      </button>
      {editHref && (
        <Link href={editHref} prefetch={false} className="listen-edit" aria-label="Sửa slide trong Limio-Live" title="Sửa slide trong Limio-Live">
          <Pencil size={14} aria-hidden="true" />
        </Link>
      )}

      {menuOpen && deck && (
        <div role="menu" className="absolute left-0 z-30 mt-2 w-64 rounded-xl border border-token bg-[rgb(var(--surface))] p-1 shadow-card">
          {deck.slideCount === 0 ? (
            deck.canOpen ? (
              <>
                <Link role="menuitem" href={`/instructor/limio-live/${deck.id}/outline`} className={item} prefetch={false} onClick={() => setMenuOpen(false)}>
                  <Presentation size={16} aria-hidden="true" />
                  Tiếp tục: xem và xác nhận dàn ý
                </Link>
                <p className="px-3 pb-2 pt-1 text-caption text-muted">Bài giảng mới có dàn ý, chưa tạo slide.</p>
              </>
            ) : (
              <p className="px-3 py-2 text-caption text-muted">
                Bài giảng của {deck.ownerName ?? "người khác"} mới có dàn ý, chưa tạo slide; chỉ chủ bài giảng và đồng giảng viên của bài giảng mở được để xác nhận dàn ý.
              </p>
            )
          ) : (
            <>
              {deck.canOpen && (
                <Link role="menuitem" href={`/instructor/limio-live/${deck.id}/present?from=start`} className={item} prefetch={false} onClick={() => setMenuOpen(false)}>
                  <Users size={16} aria-hidden="true" />
                  Xem slide để dạy
                </Link>
              )}
              <Link role="menuitem" href={`/learn/${courseSlug}/lessons/${lessonId}/slides`} className={item} prefetch={false} onClick={() => setMenuOpen(false)}>
                <Headphones size={16} aria-hidden="true" />
                Xem slide để nghe giảng
              </Link>
              {!deck.canOpen && (
                <p className="px-3 pb-2 pt-1 text-caption text-muted">
                  Bài giảng của {deck.ownerName ?? "người khác"}; nhờ họ thêm thầy/cô làm đồng giảng viên của bài giảng để mở trình soạn và trình chiếu.
                </p>
              )}
            </>
          )}
          <button
            type="button"
            role="menuitem"
            className={`${item} border-t border-token`}
            onClick={() => {
              setMenuOpen(false);
              setDialog("pick");
            }}
          >
            <ArrowLeftRight size={16} aria-hidden="true" />
            Chọn bài giảng có sẵn
          </button>
        </div>
      )}

      {dialog && (
        <SlideDialog mode={dialog} lessonId={lessonId} lessonTitle={lessonTitle} info={info} hasDeck={!!deck} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

interface DeckOption {
  id: string;
  title: string;
  slideCount: number;
}

/**
 * Hộp thoại của nút Slide. "create": bài chưa có bài giảng, tạo từ bài viết hoặc chọn một bài giảng có sẵn; "pick": bài đã có
 * bài giảng, đổi sang bài giảng khác (bài giảng cũ không bị xoá, chỉ được gỡ khỏi bài học).
 */
function SlideDialog({
  mode,
  lessonId,
  lessonTitle,
  info,
  hasDeck,
  onClose,
}: {
  mode: "create" | "pick";
  lessonId: string;
  lessonTitle: string;
  info: LessonSlideInfo;
  hasDeck: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<DeckOption[] | null>(null);
  const [pick, setPick] = useState("");
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const r = await fetch(apiUrl(`/api/lessons/${lessonId}/deck`), { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const j = (await r.json()) as { candidates: DeckOption[] };
        if (alive) setCandidates(j.candidates);
      } catch {
        if (alive) {
          setCandidates([]);
          setError("Không tải được danh sách bài giảng của thầy/cô.");
        }
      }
    })();
    return () => {
      alive = false;
    };
  }, [lessonId]);

  async function create() {
    setBusy(true);
    setGenerating(true);
    setError(null);
    try {
      const { deckId } = await createLessonDeckFromArticle(lessonId);
      router.push(`/instructor/limio-live/${deckId}/outline`);
    } catch (e) {
      setError(e instanceof LessonDeckClientError ? e.message : lessonDeckErrorText(null));
      setBusy(false);
      setGenerating(false);
    }
  }

  async function attach() {
    if (!pick) return;
    if (hasDeck && !window.confirm("Thay bài giảng đang gắn bằng bài giảng này? Bài giảng cũ không bị xoá, chỉ được gỡ khỏi bài học.")) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(apiUrl(`/api/lessons/${lessonId}/deck`), {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deckId: pick, replace: hasDeck }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => ({}))) as { error?: string };
        setError(lessonDeckErrorText(j.error, "Chưa gắn được bài giảng."));
        setBusy(false);
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError("Mất kết nối. Thử lại.");
      setBusy(false);
    }
  }

  const creating = mode === "create";
  const canCreate = creating && info.longEnough;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="slide-dialog-title" className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-[rgb(var(--surface))] p-5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <h2 id="slide-dialog-title" className="text-h4">
            {creating ? "Tạo slide cho bài này?" : "Chọn bài giảng có sẵn"}
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} disabled={busy} aria-label="Đóng" className="-mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[rgb(var(--surface-muted))] disabled:opacity-40">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        {creating && (
          <>
            <p className="mt-2 text-body">
              Bài “{lessonTitle}” chưa có slide.
              {info.longEnough ? (
                <> Hệ thống sẽ đọc nội dung bài (khoảng {info.textWords.toLocaleString("vi-VN")} từ) và nhờ AI đề xuất dàn ý; thầy/cô xem và xác nhận dàn ý trước khi tạo slide.</>
              ) : (
                <> Bài này chưa có đủ nội dung dạng văn bản để AI soạn slide; thầy/cô hãy viết nội dung bài trước, hoặc chọn một bài giảng có sẵn bên dưới.</>
              )}
            </p>

            {info.longEnough && (
              <div className="banner-info mt-3" role="note">
                <Info size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                <p>
                  <strong>Lời khuyên:</strong> chỉ nên bấm tạo slide khi thầy/cô đã thiết kế xong nội dung dạng văn bản cho bài này. Slide được tạo từ nội dung hiện tại; sửa bài viết sau đó thì slide không tự cập nhật.
                </p>
              </div>
            )}

            {canCreate && <p className="mt-3 text-meta text-muted">Dự kiến dùng khoảng {info.tokenLabel} token AI.</p>}
            {generating && (
              <p role="status" className="mt-3 flex items-center gap-2 text-body">
                <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                AI đang đọc bài và đề xuất dàn ý, khoảng một phút. Đừng đóng trang.
              </p>
            )}
            {canCreate && (
              <div className="mt-3 flex justify-end">
                <button type="button" className="btn-primary btn-sm" onClick={() => void create()} disabled={busy}>
                  {generating ? "Đang soạn dàn ý…" : "Tạo slide từ bài viết"}
                </button>
              </div>
            )}
          </>
        )}

        <div className={creating ? "mt-4 border-t border-token pt-4" : "mt-2"}>
          <p className="text-body">
            {creating ? "Hoặc gắn một bài giảng thầy/cô đã có (của thầy/cô hoặc được chia sẻ):" : "Gắn một bài giảng thầy/cô đã có (của thầy/cô hoặc được chia sẻ) vào bài này:"}
          </p>
          {candidates === null ? (
            <p className="mt-2 flex items-center gap-2 text-meta text-muted">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              Đang tải…
            </p>
          ) : candidates.length > 0 ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <select className="input min-w-0 flex-1" value={pick} onChange={(e) => setPick(e.target.value)} disabled={busy} aria-label="Chọn bài giảng có sẵn">
                <option value="">Chọn bài giảng…</option>
                {candidates.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.title} ({d.slideCount} slide)
                  </option>
                ))}
              </select>
              <button type="button" className="btn-secondary btn-sm" onClick={() => void attach()} disabled={busy || !pick}>
                {hasDeck ? "Thay" : "Gắn vào bài"}
              </button>
            </div>
          ) : (
            <p className="mt-2 text-meta text-muted">
              Thầy/cô chưa có bài giảng nào chưa gắn vào bài học. Tạo ở{" "}
              <Link href="/instructor/limio-live" className="link" prefetch={false}>
                Limio-Live
              </Link>
              .
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-3 text-body text-danger-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={onClose} disabled={busy}>
            {canCreate ? "Để sau" : "Đóng"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
