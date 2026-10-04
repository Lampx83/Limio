"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Flag, Play, RotateCcw, Trash2, X } from "lucide-react";
import type { TurnEditorItem } from "@/lib/langBlockEditor";
import { formatMark, markNext, nextUnmarkedIndex, parseMark, setMark, undoLastMark, validateMarks } from "@/lib/dialogueTiming";

/**
 * LANG K2c — đặt mốc thời gian cho từng lượt trong audio cả đoạn bằng cách NGHE VÀ BẤM: mỗi lần bấm
 * "Đánh dấu lượt kế" (phím M) ghi thời điểm hiện tại làm mốc cho lượt chưa có mốc đầu tiên. Sửa tay từng mốc
 * (m:ss,d), nghe từ mốc, hoàn tác, xoá hết. Chỉ tính các lượt đã điền đủ người nói và lời thoại.
 */

const filled = (t: TurnEditorItem) => t.speaker.trim() !== "" && t.text.trim() !== "";
const snippet = (t: string) => (t.trim().length > 24 ? `${t.trim().slice(0, 24)}…` : t.trim());

/** Phím tắt chỉ có nghĩa khi người dùng không đang gõ. */
function isTypingTarget(el: EventTarget | null): boolean {
  const n = el as HTMLElement | null;
  if (!n || !n.tagName) return false;
  return n.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(n.tagName);
}

export default function DialogueTimingPanel({
  audioUrl,
  turns,
  onTurns,
}: {
  audioUrl: string;
  turns: TurnEditorItem[];
  onTurns: (turns: TurnEditorItem[]) => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  // Thao tác trên danh sách LƯỢT ĐÃ ĐIỀN; ghi lại vào đúng lượt (theo id) của danh sách đầy đủ.
  const view = turns.filter(filled);
  const writeBack = useCallback(
    (next: TurnEditorItem[]) => {
      const byId = new Map(next.map((t) => [t.id, t]));
      onTurns(turns.map((t) => byId.get(t.id) ?? t));
    },
    [turns, onTurns],
  );
  const nextIdx = nextUnmarkedIndex(view);
  const problems = validateMarks(view);

  const mark = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    const r = markNext(view, a.currentTime);
    if (!r.ok) {
      setError(r.reason);
      return;
    }
    setError(null);
    writeBack(r.turns);
  }, [view, writeBack]);

  // Phím M — dùng bản mới nhất của `mark` mà không gắn lại listener mỗi lần.
  const markRef = useRef(mark);
  markRef.current = mark;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key !== "m" && e.key !== "M") || e.ctrlKey || e.metaKey || e.altKey || isTypingTarget(e.target)) return;
      e.preventDefault();
      markRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function commitDraft(idx: number, raw: string) {
    const t = view[idx]!;
    setDrafts((d) => {
      const { [t.id]: _drop, ...rest } = d;
      return rest;
    });
    if (raw.trim() === "") {
      setError(null);
      const cleared = setMark(view, idx, null);
      if (cleared.ok) writeBack(cleared.turns);
      return;
    }
    const sec = parseMark(raw);
    if (sec === null) {
      setError("Mốc không đọc được. Gõ dạng 1:05,3 (phút:giây,phần mười) hoặc số giây như 65,3.");
      return;
    }
    const r = setMark(view, idx, sec);
    if (!r.ok) {
      setError(r.reason);
      return;
    }
    setError(null);
    writeBack(r.turns);
  }

  function playFrom(sec: number) {
    const a = audioRef.current;
    if (!a) return;
    a.currentTime = sec;
    void a.play().catch(() => undefined);
  }

  const btn = "inline-flex items-center gap-1.5 rounded-lg border border-token px-2.5 py-1.5 text-xs hover:bg-brand-soft disabled:opacity-40";

  return (
    <section
      aria-labelledby="dlg-timing"
      className="space-y-3 rounded-xl border border-brand-200 bg-brand-soft/30 p-4"
      data-testid="dialogue-timing-panel"
    >
      <div>
        <h3 id="dlg-timing" className="text-sm font-medium">Đặt mốc thời gian</h3>
        <p className="text-xs text-muted">
          Bấm phát và <b>nghe</b>; mỗi lần một lượt bắt đầu thì bấm “Đánh dấu lượt kế” (hoặc phím M). Học viên nghe audio cả
          đoạn sẽ thấy lượt tương ứng sáng lên và bấm vào lượt để tua tới đó.
        </p>
      </div>

      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={audioRef} src={audioUrl} controls preload="metadata" className="w-full" aria-label="Nghe audio cả đoạn để đặt mốc" />

      {view.length === 0 ? (
        <p className="text-sm text-muted">Điền ít nhất một lượt có đủ “Người nói” và “Lời thoại” ở danh sách bên dưới để đặt mốc.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={mark}
              disabled={nextIdx === null}
              className="btn-primary inline-flex items-center gap-2 text-sm"
              aria-keyshortcuts="M"
            >
              <Flag size={15} aria-hidden /> Đánh dấu lượt kế
            </button>
            <span className="text-xs text-muted">(phím M)</span>
            <button type="button" className={btn} onClick={() => writeBack(undoLastMark(view))} disabled={nextIdx === 0 && view.every((t) => t.startSec === undefined)}>
              <RotateCcw size={13} aria-hidden /> Hoàn tác
            </button>
            <button type="button" className={btn} onClick={() => writeBack(view.map((t) => ({ ...t, startSec: undefined })))} disabled={view.every((t) => t.startSec === undefined)}>
              <Trash2 size={13} aria-hidden /> Xoá hết mốc
            </button>
          </div>

          <p className="text-sm" role="status" aria-live="polite">
            {nextIdx === null ? (
              <b className="text-brand-700">Đã đánh dấu hết các lượt.</b>
            ) : (
              <>
                Sắp đánh dấu: lượt {nextIdx + 1} — <b>{view[nextIdx]!.speaker.trim()}</b>: {snippet(view[nextIdx]!.text)}
              </>
            )}
          </p>

          {(error || problems.length > 0) && (
            <div role="alert" className="banner-warning text-xs">
              {error && <p>{error}</p>}
              {problems.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          )}

          <ol className="space-y-1.5">
            {view.map((t, i) => (
              <li key={t.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-[rgb(var(--surface))] px-2 py-1.5 text-sm">
                <span className="w-6 text-center text-xs text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">
                  <b className="mr-1.5 text-xs text-muted">{t.speaker.trim()}</b>
                  {snippet(t.text)}
                </span>
                <input
                  aria-label={`Mốc của lượt ${i + 1}`}
                  className="input h-8 w-24 text-xs tabular-nums"
                  inputMode="decimal"
                  placeholder="chưa có"
                  value={drafts[t.id] ?? (t.startSec === undefined ? "" : formatMark(t.startSec))}
                  onChange={(e) => setDrafts((d) => ({ ...d, [t.id]: e.target.value }))}
                  onBlur={(e) => {
                    if (t.id in drafts) commitDraft(i, e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                  }}
                />
                <button type="button" className={btn} disabled={t.startSec === undefined} onClick={() => playFrom(t.startSec!)}>
                  <Play size={12} aria-hidden /> Nghe từ mốc này
                </button>
                <button
                  type="button"
                  className={btn}
                  disabled={t.startSec === undefined}
                  aria-label={`Xoá mốc của lượt ${i + 1}`}
                  onClick={() => commitDraft(i, "")}
                >
                  <X size={12} aria-hidden />
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}
