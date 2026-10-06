"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Code2, Crown, ExternalLink, Eye, Play, Presentation, Video, X } from "lucide-react";
import VoteButton from "./VoteButton";
import { showcaseEmbed } from "@/lib/showcaseEmbed";
import { stepIndex } from "@/lib/tournamentShowcase";

/** Dữ liệu một bài, đã làm sạch ở máy chủ (link chỉ http/https). */
export type ViewerItem = {
  submissionId: string;
  missionId: string;
  missionTitle: string;
  teamLabel: string;
  captainName: string;
  memberNames: string[];
  statusLabel: string;
  statusTone: "ok" | "bad" | "wait";
  scoreLabel: string | null;
  submittedAtLabel: string;
  writeup: string | null;
  repoHref: string | null;
  slidesHref: string | null;
  demoHref: string | null;
  votable: boolean;
  voteCount: number;
  voted: boolean;
  voteDisabled: boolean;
  voteDisabledReason: string;
  isTopVoted: boolean;
};

type Ctx = { open: (submissionId: string) => void };
const ViewerCtx = createContext<Ctx | null>(null);

/** Nút mở khung xem trước từ thẻ bài. Đặt trong <ShowcaseViewerProvider>. */
export function OpenViewerButton({
  submissionId,
  className,
  children,
  label,
}: {
  submissionId: string;
  className?: string;
  children: React.ReactNode;
  label?: string;
}) {
  const ctx = useContext(ViewerCtx);
  return (
    <button
      type="button"
      onClick={() => ctx?.open(submissionId)}
      className={className}
      aria-label={label}
      aria-haspopup="dialog"
    >
      {children}
    </button>
  );
}

type TabKey = "slides" | "demo" | "repo";

export function ShowcaseViewerProvider({
  tournamentId,
  items,
  children,
}: {
  tournamentId: string;
  /** Toàn bộ bài theo đúng thứ tự đang lọc/sắp xếp (không chỉ trang hiện tại). */
  items: ViewerItem[];
  children: React.ReactNode;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [preferredTab, setPreferredTab] = useState<TabKey | null>(null);
  const ctx = useMemo<Ctx>(() => ({ open: setOpenId }), []);
  // Tra theo id mỗi lần render để số phiếu/ trạng thái mới (sau router.refresh) hiện ngay.
  const index = openId ? items.findIndex((i) => i.submissionId === openId) : -1;
  const item = index >= 0 ? items[index]! : null;

  const close = useCallback(() => setOpenId(null), []);
  const prev = stepIndex(index, items.length, -1);
  const next = stepIndex(index, items.length, 1);
  const go = useCallback(
    (to: number | null) => {
      if (to !== null) setOpenId(items[to]!.submissionId);
    },
    [items],
  );

  return (
    <ViewerCtx.Provider value={ctx}>
      {children}
      {item && (
        <ViewerDialog
          key={item.submissionId}
          tournamentId={tournamentId}
          item={item}
          position={index + 1}
          total={items.length}
          onPrev={prev === null ? null : () => go(prev)}
          onNext={next === null ? null : () => go(next)}
          onClose={close}
          preferredTab={preferredTab}
          onTabChange={setPreferredTab}
        />
      )}
    </ViewerCtx.Provider>
  );
}

function ViewerDialog({
  tournamentId,
  item,
  position,
  total,
  onPrev,
  onNext,
  onClose,
  preferredTab,
  onTabChange,
}: {
  tournamentId: string;
  item: ViewerItem;
  preferredTab: TabKey | null;
  onTabChange: (t: TabKey) => void;
  position: number;
  total: number;
  onPrev: (() => void) | null;
  onNext: (() => void) | null;
  onClose: () => void;
}) {
  const tabs = useMemo(() => {
    const t: { key: TabKey; label: string; href: string; icon: React.ReactNode }[] = [];
    // Video luôn đứng đầu và là tab mở sẵn; slide, mã nguồn xếp sau.
    if (item.demoHref) t.push({ key: "demo", label: "Video demo", href: item.demoHref, icon: <Video size={14} /> });
    if (item.slidesHref) t.push({ key: "slides", label: "Slide", href: item.slidesHref, icon: <Presentation size={14} /> });
    if (item.repoHref) t.push({ key: "repo", label: "Mã nguồn", href: item.repoHref, icon: <Code2 size={14} /> });
    return t;
  }, [item.slidesHref, item.demoHref, item.repoHref]);
  // Tab ưa thích do provider giữ: chuyển bài kế vẫn ở tab đang xem (so sánh các đội cùng loại sản phẩm);
  // bài không có loại đó thì rơi về tab đầu tiên.
  const active = tabs.find((t) => t.key === preferredTab) ?? tabs[0] ?? null;
  const embed = active ? showcaseEmbed(active.href) : null;

  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      e.preventDefault();
      (e.key === "ArrowLeft" ? onPrev : onNext)?.();
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose, onPrev, onNext]);

  // Đưa focus vào khung để phím mũi tên không bị kẹt ở nút ngoài trang.
  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  const toneCls =
    item.statusTone === "ok"
      ? "bg-success-50 text-success-700"
      : item.statusTone === "bad"
        ? "bg-danger-50 text-danger-700"
        : "bg-amber-50 text-amber-700";

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      aria-label={`Bài của ${item.teamLabel}`}
      className="fixed inset-0 z-50 flex flex-col bg-[rgb(var(--surface))] outline-none"
    >
      <header className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-token px-4 py-3">
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold uppercase tracking-wider text-brand-700 dark:text-brand-300">
            {item.missionTitle}
          </p>
          <h2 className="truncate text-base font-bold leading-tight sm:text-lg">{item.teamLabel}</h2>
        </div>
        <div className="flex shrink-0 items-center gap-1.5" role="group" aria-label="Chuyển bài nộp">
          <button
            type="button"
            onClick={() => onPrev?.()}
            disabled={!onPrev}
            className="btn-secondary btn-sm inline-flex items-center gap-1"
            aria-label="Bài trước"
            title="Bài trước (←)"
          >
            <ChevronLeft size={16} />
            <span className="hidden sm:inline">Trước</span>
          </button>
          <span className="min-w-[3.5rem] text-center text-xs tabular-nums text-muted" aria-live="polite">
            {position}/{total}
          </span>
          <button
            type="button"
            onClick={() => onNext?.()}
            disabled={!onNext}
            className="btn-secondary btn-sm inline-flex items-center gap-1"
            aria-label="Bài sau"
            title="Bài sau (→)"
          >
            <span className="hidden sm:inline">Sau</span>
            <ChevronRight size={16} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="btn-secondary btn-sm ml-1 inline-flex items-center gap-1"
            aria-label="Đóng"
            title="Đóng (Esc)"
          >
            <X size={16} />
            <span className="hidden sm:inline">Đóng</span>
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-1">
        {/* Khung xem trước */}
        <section className="flex min-h-0 flex-col bg-[rgb(var(--surface-muted))]">
          {tabs.length > 1 && (
            <div className="flex gap-1 border-b border-token bg-[rgb(var(--surface))] px-3 py-2" role="tablist">
              {tabs.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active?.key === t.key}
                  onClick={() => onTabChange(t.key)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active?.key === t.key
                      ? "border-brand-500 bg-brand-soft text-brand-700"
                      : "border-token hover:bg-[rgb(var(--surface-muted))]"
                  }`}
                >
                  {t.icon}
                  {t.label}
                </button>
              ))}
            </div>
          )}

          <div className="flex min-h-0 flex-1 items-center justify-center p-3">
            {!active ? (
              <p className="text-sm text-muted">Đội này chưa nộp liên kết sản phẩm nào.</p>
            ) : embed ? (
              <div className="flex h-full w-full max-w-5xl flex-col gap-2">
                <iframe
                  key={embed.src}
                  src={embed.src}
                  title={`${active.label} của ${item.teamLabel}`}
                  loading="eager"
                  allowFullScreen
                  referrerPolicy="no-referrer"
                  className={`w-full min-h-0 rounded-xl border border-token bg-white ${
                    embed.shape === "video" ? "aspect-video max-h-full" : "flex-1"
                  }`}
                />
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-faint">
                  <a
                    href={active.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline dark:text-brand-300"
                  >
                    <ExternalLink size={12} /> Mở tab mới
                  </a>
                  {embed.needsSharing && (
                    <span>Khung trống hoặc hiện trang đăng nhập nghĩa là đội chưa mở quyền xem cho mọi người có liên kết.</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full max-w-md rounded-2xl border border-token bg-[rgb(var(--surface))] p-6 text-center">
                <p className="text-sm font-semibold">{active.label}</p>
                <p className="mt-1 break-all text-xs text-faint">{active.href}</p>
                <p className="mt-3 text-xs text-muted">Liên kết này không xem trực tiếp được trong khung.</p>
                <a
                  href={active.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary btn-sm mt-4 inline-flex items-center gap-1.5"
                >
                  <ExternalLink size={14} /> Mở tab mới
                </a>
              </div>
            )}
          </div>
        </section>

        {/* Thông tin bài */}
        <aside className="max-h-[38vh] space-y-4 overflow-y-auto border-t border-token p-4 lg:max-h-none lg:border-l lg:border-t-0">
          <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
            <span className={`rounded-full px-2 py-0.5 font-semibold ${toneCls}`}>{item.statusLabel}</span>
            {item.scoreLabel && (
              <span className="rounded-full bg-[rgb(var(--surface-muted))] px-2 py-0.5 font-semibold tabular-nums">
                Điểm {item.scoreLabel}
              </span>
            )}
            {item.isTopVoted && (
              <span className="rounded-full bg-amber-500 px-2 py-0.5 font-bold text-white">Nhiều phiếu nhất</span>
            )}
            {item.votable && (
              <VoteButton
                tournamentId={tournamentId}
                missionId={item.missionId}
                submissionId={item.submissionId}
                initialVoted={item.voted}
                initialCount={item.voteCount}
                disabled={item.voteDisabled}
                disabledReason={item.voteDisabledReason}
              />
            )}
          </div>

          <div className="text-xs text-muted">
            <p className="flex items-center gap-1.5">
              <Crown size={12} className="text-amber-500" />
              {item.captainName}
            </p>
            {item.memberNames.length > 0 && (
              <p className="mt-1">Thành viên: {item.memberNames.join(", ")}</p>
            )}
            <p className="mt-1 text-faint">Nộp lúc {item.submittedAtLabel}</p>
          </div>

          {item.writeup ? (
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-faint">Mô tả của đội</p>
              <p className="mt-1.5 whitespace-pre-wrap text-sm">{item.writeup}</p>
            </div>
          ) : (
            <p className="text-xs text-faint">Đội không viết mô tả.</p>
          )}

          <p className="hidden text-[11px] text-faint lg:block">Phím ← → chuyển bài, Esc đóng.</p>
        </aside>
      </div>
    </div>
  );
}

/** Nhãn nhỏ "Xem bài" dùng trên thẻ. */
export function ViewLabel() {
  return (
    <span className="inline-flex items-center gap-1">
      <Eye size={12} />
      Xem bài
    </span>
  );
}

/** Ảnh bìa của thẻ bài (bấm để mở khung xem trước). Ảnh lỗi/không có quyền thì rơi về nền màu. */
export function CardCover({
  submissionId,
  label,
  thumbSrc,
  missionTitle,
}: {
  submissionId: string;
  label: string;
  thumbSrc: string | null;
  missionTitle: string;
}) {
  const ctx = useContext(ViewerCtx);
  const [failed, setFailed] = useState(false);
  const showImg = thumbSrc && !failed;
  return (
    <button
      type="button"
      onClick={() => ctx?.open(submissionId)}
      aria-label={label}
      aria-haspopup="dialog"
      className={
        showImg
          ? "group relative block aspect-video w-full overflow-hidden bg-slate-900"
          : "block w-full bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 p-4 text-left text-white"
      }
    >
      {showImg ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={thumbSrc}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
          />
          <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/95 text-rose-600 shadow-lg">
              <Play size={20} fill="currentColor" />
            </span>
          </span>
        </>
      ) : (
        <p className="text-xs font-bold uppercase tracking-wider opacity-90">{missionTitle}</p>
      )}
    </button>
  );
}
