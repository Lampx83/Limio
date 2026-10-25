"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Headphones, Info, Loader2, Pencil, Presentation, Users, X } from "lucide-react";
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
  const [dialogOpen, setDialogOpen] = useState(false);
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
        aria-expanded={hasMenu ? menuOpen : dialogOpen}
        onClick={() => (hasMenu ? setMenuOpen((v) => !v) : setDialogOpen(true))}
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
        </div>
      )}

      {dialogOpen && <CreateSlideDialog lessonId={lessonId} lessonTitle={lessonTitle} info={info} onClose={() => setDialogOpen(false)} />}
    </div>
  );
}

function CreateSlideDialog({ lessonId, lessonTitle, info, onClose }: { lessonId: string; lessonTitle: string; info: LessonSlideInfo; onClose: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const { deckId } = await createLessonDeckFromArticle(lessonId);
      router.push(`/instructor/limio-live/${deckId}/outline`);
    } catch (e) {
      setError(e instanceof LessonDeckClientError ? e.message : lessonDeckErrorText(null));
      setBusy(false);
    }
  }

  const canCreate = info.longEnough;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 p-3 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="slide-dialog-title" className="w-full max-w-md rounded-2xl bg-[rgb(var(--surface))] p-5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <h2 id="slide-dialog-title" className="text-h4">
            Tạo slide cho bài này?
          </h2>
          <button ref={closeRef} type="button" onClick={onClose} disabled={busy} aria-label="Đóng" className="-mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full hover:bg-[rgb(var(--surface-muted))] disabled:opacity-40">
            <X size={16} aria-hidden="true" />
          </button>
        </div>

        <p className="mt-2 text-body">
          Bài “{lessonTitle}” chưa có slide.
          {info.longEnough ? (
            <> Hệ thống sẽ đọc nội dung bài (khoảng {info.textWords.toLocaleString("vi-VN")} từ) và nhờ AI đề xuất dàn ý; thầy/cô xem và xác nhận dàn ý trước khi tạo slide.</>
          ) : (
            <> Bài này chưa có đủ nội dung dạng văn bản để AI soạn slide; thầy/cô hãy viết nội dung bài trước.</>
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
        {busy && (
          <p role="status" className="mt-3 flex items-center gap-2 text-body">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            AI đang đọc bài và đề xuất dàn ý, khoảng một phút. Đừng đóng trang.
          </p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-body text-danger-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" className="btn-secondary btn-sm" onClick={onClose} disabled={busy}>
            {canCreate ? "Để sau" : "Đóng"}
          </button>
          {canCreate && (
            <button type="button" className="btn-primary btn-sm" onClick={() => void create()} disabled={busy}>
              {busy ? "Đang soạn dàn ý…" : "Tạo slide từ bài viết"}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
