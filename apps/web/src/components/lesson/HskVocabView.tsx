"use client";

import AudioLessonPlayer from "@/components/AudioLessonPlayer";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Eye, EyeOff, Layers, LayoutGrid, Pause, Shuffle, Volume2 } from "lucide-react";
import RubyText, { rubyPlan } from "@/components/RubyText";
import HanFontLoader from "@/components/HanFontLoader";
import type { VocabViewItem } from "@/components/VocabListView";
import { useExclusiveAudio } from "@/components/useExclusiveAudio";
import { cleanVocabItems, hasHanChars, shortVocabTag, splitVocabMeaning, splitVocabNote, vocabHanPieces } from "@/lib/hskVocab";
import { hskT } from "./hskT";
import HanziStrokeDialog from "./HanziStrokeDialog";
import type { UiLang } from "@/lib/i18n/core";

/**
 * Mục Từ mới của bài HSK do tác giả soạn (khối `vocab_list`), cùng kiểu với bài HSK nhập từ sách (HskVocabSwitch): nút chuyển "Thẻ từ | Flashcard", mở sẵn ở "Thẻ từ".
 * Thẻ từ: nhãn từ loại, chữ Hán lớn có pinyin dưới từng chữ, nghĩa; dấu nhỏ "Chủ động/Nhận biết" từ ghi chú; bấm thẻ mở "Cách viết" kèm pinyin, nghĩa, ví dụ.
 * Flashcard: mặt trước chữ Hán (pinyin bật/tắt), mặt sau pinyin, nghĩa, ví dụ (có pinyin và bản dịch), ghi chú. Thẻ cũ (không có `reading`) vẫn hiện như trước.
 * Mọi chữ là text node, React tự thoát HTML. Tên mục "生词 Từ mới" do tiêu đề mục đánh số của bài đã hiện nên không lặp lại ở đây.
 */
/** Thẻ của từ đang được đọc trong audio tổng hợp: thẻ có `trackStartSec` lớn nhất mà ≤ giây hiện tại (chưa có mốc nào thì null). */
export function currentTrackItem(items: Array<{ id: string; trackStartSec?: number }>, sec: number): string | null {
  let best: { id: string; at: number } | null = null;
  for (const it of items) if (typeof it.trackStartSec === "number" && it.trackStartSec <= sec + 0.05 && (!best || it.trackStartSec >= best.at)) best = { id: it.id, at: it.trackStartSec };
  return best?.id ?? null;
}

export default function HskVocabView({ items: raw, lang = "vi", trackUrl }: { title?: string; items: VocabViewItem[]; lang?: UiLang; trackUrl?: string }) {
  const t = (key: Parameters<typeof hskT>[1], params?: Record<string, string | number>) => hskT(lang, key, params);
  const items = useMemo(() => cleanVocabItems<VocabViewItem>(raw), [raw]);
  const [view, setView] = useState<"cards" | "flash">("cards");
  const [showReading, setShowReading] = useState(true);
  const [open, setOpen] = useState<VocabViewItem | null>(null);
  const { playingId, toggle } = useExclusiveAudio();
  // Audio tổng hợp đang phát: thẻ của từ đang được đọc sáng lên (mốc `trackStartSec` của từng thẻ).
  const [trackTime, setTrackTime] = useState(0);
  const [trackPlaying, setTrackPlaying] = useState(false);
  const nowId = useMemo(() => (trackPlaying ? currentTrackItem(items, trackTime) : null), [items, trackPlaying, trackTime]);
  useEffect(() => {
    if (!nowId) return;
    document.getElementById(`vocab-${nowId}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [nowId]);
  if (items.length === 0) return null;
  return (
    <section className="hsk-vv">
      {trackUrl && (
        <div className="hsk-vv-track">
          <p className="hsk-vv-track-t">{t("learn.hsk.vocab.track")}</p>
          {/* Trình phát của Limio (thanh tua, tốc độ 0,75×/1×/1,25×, lặp lại), cùng kiểu với hội thoại. */}
          <AudioLessonPlayer url={trackUrl} showTranscript={false} compact onTimeChange={setTrackTime} onPlayingChange={setTrackPlaying} />
        </div>
      )}
      <div className="mb-3 flex flex-wrap items-center justify-end gap-2">
        {view === "flash" && (
          <button
            type="button"
            aria-pressed={showReading}
            onClick={() => setShowReading((v) => !v)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border border-token px-3.5 text-sm transition-colors ${
              showReading ? "bg-brand-100 font-medium text-brand-800 shadow-sm" : "bg-[rgb(var(--surface))] text-muted line-through hover:bg-brand-soft"
            }`}
          >
            {showReading ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
            {t("learn.hsk.vocab.pinyin")}
          </button>
        )}
        <div role="group" aria-label={t("learn.hsk.vocab.viewAria")} className="inline-flex h-9 items-center gap-0.5 rounded-full border border-token bg-[rgb(var(--surface))] p-0.5">
          {(
            [
              ["cards", t("learn.hsk.vocab.cards"), LayoutGrid],
              ["flash", t("learn.hsk.vocab.flash"), Layers],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              type="button"
              aria-pressed={view === k}
              onClick={() => setView(k)}
              className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-sm transition-colors ${
                view === k ? "bg-brand-100 font-medium text-brand-800 shadow-sm" : "text-muted hover:bg-brand-soft"
              }`}
            >
              <Icon size={14} aria-hidden />
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === "flash" ? (
        <Flash items={items} showReading={showReading} lang={lang} playingId={playingId} onAudio={toggle} />
      ) : (
        <WordGrid items={items} playingId={playingId} nowId={nowId} onAudio={toggle} onOpen={setOpen} />
      )}
      {open && (
        <HanziStrokeDialog
          term={open.term}
          lang={lang}
          onClose={() => setOpen(null)}
          head={<DialogHead it={open} />}
          foot={<DialogFoot it={open} lang={lang} />}
        />
      )}
    </section>
  );
}

/** Lưới thẻ từ: cùng khuôn với bảng từ mới của bài HSK nhập từ sách (`.hsk-words` / `.hsk-wc`). Thẻ có chữ Hán bấm được để mở "Cách viết". */
function WordGrid({ items, playingId, nowId, onAudio, onOpen }: { items: VocabViewItem[]; playingId: string | null; nowId: string | null; onAudio: (id: string, url: string) => void; onOpen: (it: VocabViewItem) => void }) {
  return (
    <>
      <HanFontLoader lang="zh-Hans" />
      <ul className="hsk-words">
        {items.map((it) => (
          <WordCard key={it.id} it={it} playing={playingId === it.id} now={nowId === it.id} onAudio={onAudio} onOpen={onOpen} />
        ))}
      </ul>
    </>
  );
}

function WordCard({ it, playing, now, onAudio, onOpen }: { it: VocabViewItem; playing: boolean; now: boolean; onAudio: (id: string, url: string) => void; onOpen: (it: VocabViewItem) => void }) {
  const { m, n } = useParts(it);
  const han = useMemo(() => vocabHanPieces(it.term, it.reading), [it.term, it.reading]);
  const writable = hasHanChars(it.term);
  const tag = shortVocabTag(n.tag);
  return (
    <li
      id={`vocab-${it.id}`}
      className="hsk-wc"
      data-term={writable ? it.term : undefined}
      data-playing={playing ? "true" : undefined}
      data-now={now ? "true" : undefined}
      onClick={writable ? () => onOpen(it) : undefined}
    >
      {(m.pos || tag) && (
        <div className="hsk-wc-top">
          {m.pos ? <span className="hsk-pos">{m.pos}</span> : <span />}
          {tag && (
            <span className={`hsk-wc-tag ${n.active ? "hsk-wc-tag-on" : ""}`} title={n.tag ?? undefined}>
              {tag}
            </span>
          )}
        </div>
      )}
      <div
        className="hsk-wc-body"
        role={writable ? "button" : undefined}
        tabIndex={writable ? 0 : undefined}
        onKeyDown={
          writable
            ? (e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(it);
                }
              }
            : undefined
        }
      >
        <p className="hsk-wc-han" lang="zh-Hans">
          {han.pieces.length > 0
            ? han.pieces.map((p, i) =>
                p.rt ? (
                  <ruby key={i} className="ruby-han">
                    <span>{p.text}</span>
                    <rt>{p.rt}</rt>
                  </ruby>
                ) : (
                  <span key={i}>{p.text}</span>
                ),
              )
            : it.term}
          {han.reading && <span className="vocab-reading">{han.reading}</span>}
        </p>
        <p className="hsk-wc-mean">{m.meaning}</p>
      </div>
      {it.audioUrl && (
        <button
          type="button"
          aria-label={it.term}
          aria-pressed={playing}
          onClick={(e) => {
            e.stopPropagation();
            onAudio(it.id, it.audioUrl!);
          }}
          className="hsk-wc-audio"
        >
          {playing ? <Pause size={14} aria-hidden /> : <Volume2 size={14} aria-hidden />}
        </button>
      )}
    </li>
  );
}

/** Đầu hộp "Cách viết": pinyin, từ loại và nghĩa của từ. */
function DialogHead({ it }: { it: VocabViewItem }) {
  const m = splitVocabMeaning(it.meaning);
  return (
    <div className="hsk-wd-head">
      {it.reading && <p className="hsk-wd-py">{it.reading}</p>}
      <p className="hsk-wd-mean">
        {m.pos && <span className="hsk-pos">{m.pos}</span>}
        {m.meaning}
      </p>
    </div>
  );
}

/** Cuối hộp "Cách viết": câu ví dụ kèm pinyin và bản dịch (nếu thẻ có). */
function DialogFoot({ it, lang }: { it: VocabViewItem; lang: UiLang }) {
  if (!it.example) return null;
  return (
    <div className="hsk-wd-ex">
      <p className="hsk-wd-ex-l">{hskT(lang, "learn.hsk.vocab.example")}</p>
      <Example it={it} masked={false} />
    </div>
  );
}

/** Chữ Hán có pinyin dưới từng chữ (ghép được) hoặc kèm dòng pinyin nhỏ dưới; tắt pinyin = làm mờ, vẫn giữ chỗ. */
function Han({ text, reading, masked, className }: { text: string; reading?: string; masked: boolean; className?: string }) {
  const plan = rubyPlan(text, reading);
  return (
    <>
      <HanFontLoader lang={plan.lang} />
      <span lang={plan.lang} className={`${plan.syllables ? "ruby-line " : ""}${className ?? ""}`}>
        {plan.syllables ? <RubyText text={text} syllables={plan.syllables} masked={masked} /> : text}
      </span>
      {!plan.syllables && reading && (
        <span data-masked={masked ? "true" : undefined} className={`hsk-py block ${masked ? "select-none blur-sm" : ""}`}>
          {reading}
        </span>
      )}
    </>
  );
}

function useParts(it: VocabViewItem) {
  return useMemo(() => ({ m: splitVocabMeaning(it.meaning), n: splitVocabNote(it.note) }), [it.meaning, it.note]);
}

function Example({ it, masked, playingId, onAudio }: { it: VocabViewItem; masked: boolean; playingId?: string | null; onAudio?: (id: string, url: string) => void }) {
  if (!it.example) return null;
  const exId = `${it.id}:ex`;
  const playing = playingId === exId;
  return (
    <div className="hsk-vex">
      <p className="hsk-vex-han">
        <Han text={it.example} reading={it.exampleReading} masked={masked} />
        {it.exampleAudioUrl && onAudio && (
          <button
            type="button"
            aria-label={it.example}
            aria-pressed={playing}
            onClick={(e) => {
              e.stopPropagation();
              onAudio(exId, it.exampleAudioUrl!);
            }}
            className={`hsk-vex-play ${playing ? "hsk-vex-play-on" : ""}`}
          >
            {playing ? <Pause size={14} aria-hidden /> : <Volume2 size={14} aria-hidden />}
          </button>
        )}
      </p>
      {it.exampleMeaning && <p className="hsk-vex-vi">{it.exampleMeaning}</p>}
    </div>
  );
}

function Chips({ tag, active }: { tag: string | null; active: boolean }) {
  return tag ? <span className={`hsk-vtag ${active ? "hsk-vtag-on" : ""}`}>{tag}</span> : null;
}

function Flash({ items, showReading, lang, playingId, onAudio }: { items: VocabViewItem[]; showReading: boolean; lang: UiLang; playingId: string | null; onAudio: (id: string, url: string) => void }) {
  const t = (key: Parameters<typeof hskT>[1], params?: Record<string, string | number>) => hskT(lang, key, params);
  const [order, setOrder] = useState<number[]>(() => items.map((_, i) => i));
  const [pos, setPos] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setOrder(items.map((_, i) => i));
    setPos(0);
    setFlipped(false);
  }, [items]);
  const total = items.length;
  const it = items[order[Math.min(pos, total - 1)] ?? 0];
  const parts = useParts(it ?? { id: "", term: "", meaning: "" });
  if (!it) return null;
  const { m, n } = parts;
  const go = (next: number) => {
    setPos(Math.min(total - 1, Math.max(0, next)));
    setFlipped(false);
  };
  const shuffle = () => {
    const a = items.map((_, i) => i);
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j]!, a[i]!];
    }
    setOrder(a);
    setPos(0);
    setFlipped(false);
    rootRef.current?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") {
      e.preventDefault();
      go(pos + 1);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      go(pos - 1);
    } else if ((e.key === " " || e.key === "Enter") && e.target === e.currentTarget) {
      e.preventDefault();
      setFlipped((v) => !v);
    }
  };
  const playing = playingId === it.id;
  const progress = total > 1 ? (pos / (total - 1)) * 100 : 100;
  return (
    <div ref={rootRef} tabIndex={0} onKeyDown={onKeyDown} aria-label={t("practice.fc.vf.aria")} className="hsk-fc space-y-3 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-brand-300">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted">
        <span className="tabular-nums" aria-live="polite">
          {t("practice.fc.vf.pos", { a: pos + 1, b: total })}
        </span>
        {total > 1 && (
          <button type="button" onClick={shuffle} className="btn-pill" title={t("practice.fc.vf.shuffleTitle")}>
            <Shuffle size={14} aria-hidden />
            {t("practice.fc.vf.shuffle")}
          </button>
        )}
      </div>
      <div className="flip-card hsk-fc-card mx-auto w-full max-w-xl" data-flipped={flipped ? "true" : "false"}>
        <div
          role="button"
          tabIndex={-1}
          onMouseDown={(e) => {
            if (e.detail > 1) e.preventDefault();
          }}
          onClick={(e) => {
            if (e.detail <= 1 && window.getSelection()?.toString()) return;
            setFlipped((v) => !v);
          }}
          aria-label={flipped ? t("practice.fc.vf.flipBack") : t("practice.fc.flip")}
          className="flip-card-inner hsk-fc-inner"
        >
          <span aria-hidden={flipped} className="flip-face hsk-fc-face hsk-fc-front">
            {m.pos && <span className="hsk-pos">{m.pos}</span>}
            <span className="hsk-fc-term">
              <Han text={it.term} reading={it.reading} masked={!showReading} />
            </span>
            <span className="hsk-fc-hint">{t("practice.fc.vf.hintMeaning")}</span>
          </span>
          <span aria-hidden={!flipped} className="flip-face flip-back hsk-fc-face hsk-fc-back">
            <span className="hsk-fc-b-term">{it.term}</span>
            {it.reading && (
              <span data-masked={showReading ? undefined : "true"} className={`hsk-fc-b-py ${showReading ? "" : "select-none blur-sm"}`}>
                {it.reading}
              </span>
            )}
            <span className="hsk-fc-mean">
              {m.pos && <span className="hsk-pos">{m.pos}</span>}
              {m.meaning}
            </span>
            {(n.tag || n.note) && (
              <span className="hsk-fc-note">
                <Chips tag={n.tag} active={n.active} />
                {n.note}
              </span>
            )}
            <Example it={it} masked={!showReading} playingId={playingId} onAudio={onAudio} />
          </span>
        </div>
        {it.audioUrl && (
          <button
            type="button"
            aria-label={it.term}
            aria-pressed={playing}
            onClick={() => onAudio(it.id, it.audioUrl!)}
            className={`absolute right-3 top-3 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border transition-colors ${
              playing ? "border-brand-400 bg-brand-100 text-brand-800" : "border-token bg-[rgb(var(--surface))] hover:bg-brand-soft"
            }`}
          >
            {playing ? <Pause size={16} aria-hidden /> : <Volume2 size={16} aria-hidden />}
          </button>
        )}
      </div>
      <div className="mx-auto flex w-full max-w-xl items-center gap-3">
        <button type="button" onClick={() => go(pos - 1)} disabled={pos === 0} className="btn-secondary btn-sm" aria-label={t("practice.fc.vf.prevAria")}>
          <ArrowLeft size={16} aria-hidden />
          {t("practice.fc.vf.prev")}
        </button>
        <div className="hsk-fc-bar" role="progressbar" aria-label={t("practice.fc.vf.seen")} aria-valuenow={pos + 1} aria-valuemin={1} aria-valuemax={total}>
          <i style={{ width: `${progress}%` }} />
        </div>
        <button type="button" onClick={() => go(pos + 1)} disabled={pos === total - 1} className="btn-primary btn-sm" aria-label={t("practice.fc.vf.nextAria")}>
          {t("practice.fc.vf.next")}
          <ArrowRight size={16} aria-hidden />
        </button>
      </div>
    </div>
  );
}
