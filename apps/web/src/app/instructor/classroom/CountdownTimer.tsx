"use client";

import { useState, useEffect, useRef } from "react";
import { Clock, Play, Pause, RotateCcw, Maximize2, Minimize2, X, Music2, Pencil } from "lucide-react";
import type { TimerTemplate } from "@feedbackme/db";
import {
  NOTE_SIZES,
  DEFAULT_NOTE_SIZE,
  noteToPlainText,
  normalizeNoteSize,
  type NoteSizeId,
} from "./countdownNote";
import TemplateSelector from "../teaching-tools/TimerTemplates/TemplateSelector";
import TemplateSaveBar from "../teaching-tools/TimerTemplates/TemplateSaveBar";
import { useTimerTemplates } from "../teaching-tools/TimerTemplates/useTimerTemplates";
import { parseTimeInput, formatCountdown, MAX_COUNTDOWN_SECONDS } from "./countdownTime";

const MUSIC_OPTIONS = [
  { id: "none", name: "Không có âm nhạc", src: "" },
  { id: "upbeat", name: "Vui vẻ", src: "/music/upbeat.mp3" },
  { id: "focus", name: "Tập trung", src: "/music/focus.mp3" },
  { id: "ambient", name: "Thư giãn", src: "/music/ambient.mp3" },
];

const TIMER_PRESETS = [
  { label: "1 phút", seconds: 60 },
  { label: "5 phút", seconds: 300 },
  { label: "10 phút", seconds: 600 },
  { label: "15 phút", seconds: 900 },
  { label: "20 phút", seconds: 1200 },
  { label: "30 phút", seconds: 1800 },
];

const ADJUST_STEPS = [
  { label: "− 1 phút", delta: -60 },
  { label: "+ 1 phút", delta: 60 },
  { label: "+ 5 phút", delta: 300 },
];

interface CountdownTimerProps {
  onExit?: () => void;
  // Điền sẵn khi mở từ 1 event trong kịch bản lớp học (Activity Plan).
  initialMinutes?: number;
}

type TimerState = "ready" | "running" | "paused" | "finished";

const STATE_STYLES: Record<TimerState, { ring: string; bg: string; text: string; label: string; pulse: boolean }> = {
  ready: {
    ring: "border-token",
    bg: "bg-[rgb(var(--surface-muted))]",
    text: "text-fg",
    label: "Sẵn sàng",
    pulse: false,
  },
  running: {
    ring: "border-brand-400 dark:border-brand-500",
    bg: "bg-brand-50 dark:bg-brand-900/20",
    text: "text-brand-700 dark:text-brand-300",
    label: "Đang chạy",
    pulse: false,
  },
  paused: {
    ring: "border-accent-400 dark:border-accent-500",
    bg: "bg-accent-50 dark:bg-accent-900/20",
    text: "text-accent-700 dark:text-accent-300",
    label: "Tạm dừng",
    pulse: false,
  },
  finished: {
    ring: "border-pink-400 dark:border-pink-500",
    bg: "bg-pink-50 dark:bg-pink-950/30",
    text: "text-pink-700 dark:text-pink-300",
    label: "Hết giờ",
    pulse: true,
  },
};

export default function CountdownTimer({ onExit, initialMinutes }: CountdownTimerProps = {}) {
  const [duration, setDuration] = useState((initialMinutes ?? 15) * 60);
  const tpl = useTimerTemplates();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [notes, setNotes] = useState("");
  const [noteSize, setNoteSize] = useState<NoteSizeId>(DEFAULT_NOTE_SIZE);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState("focus");
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [hasFinished, setHasFinished] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (!audioRef.current) return;
    if (!isRunning) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    } else if (selectedMusic !== "none") {
      const musicFile = MUSIC_OPTIONS.find((m) => m.id === selectedMusic);
      if (musicFile?.src && audioRef.current.src !== musicFile.src) {
        audioRef.current.src = musicFile.src;
        audioRef.current.loop = true;
        audioRef.current.play().catch((err) => console.log("Audio playback failed:", err));
      }
    }
  }, [isRunning, selectedMusic]);

  useEffect(() => {
    if (!isRunning) return;
    const interval = setInterval(() => {
      setTotalSeconds((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          setHasFinished(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning]);

  const startFrom = (total: number) => {
    setHasFinished(false);
    setTotalSeconds(total);
    setIsRunning(true);
    if (selectedMusic !== "none" && audioRef.current) {
      const musicFile = MUSIC_OPTIONS.find((m) => m.id === selectedMusic);
      if (musicFile?.src) {
        audioRef.current.src = musicFile.src;
        audioRef.current.loop = true;
        audioRef.current.load();
        audioRef.current.play().catch((err) => console.log("Audio playback failed:", err));
      }
    }
  };

  const handleStart = () => {
    if (duration > 0) startFrom(duration);
  };

  const handlePause = () => setIsRunning(false);

  const handleResume = () => {
    if (totalSeconds > 0) {
      setIsRunning(true);
      if (selectedMusic !== "none" && audioRef.current && audioRef.current.paused) {
        audioRef.current.play().catch((err) => console.log("Audio playback failed:", err));
      }
    }
  };

  // Đặt lại về đúng mốc đang chọn, không nhảy về 15 phút.
  const handleReset = () => {
    setIsRunning(false);
    setHasFinished(false);
    setTotalSeconds(0);
  };

  const handlePresetClick = (s: number) => {
    if (started) return;
    setHasFinished(false);
    setDuration(s);
  };

  // Chưa bắt đầu: đổi mốc. Đang chạy/tạm dừng: cộng/trừ thẳng vào thời gian còn lại.
  const handleAdjust = (delta: number) => {
    if (started) {
      setTotalSeconds((prev) => Math.min(MAX_COUNTDOWN_SECONDS, Math.max(1, prev + delta)));
    } else {
      setHasFinished(false);
      setDuration((prev) => Math.min(MAX_COUNTDOWN_SECONDS, Math.max(10, prev + delta)));
    }
  };

  const beginEdit = () => {
    if (started) return;
    setDraft(formatCountdown(duration));
    setEditing(true);
  };

  const commitEdit = () => {
    const parsed = parseTimeInput(draft);
    if (parsed !== null) {
      setHasFinished(false);
      setDuration(parsed);
    }
    setEditing(false);
  };

  const handleSelectTemplate = (template: TimerTemplate | null) => {
    if (!template) {
      setSelectedTemplateId(null);
      setNotes("");
      setNoteSize(DEFAULT_NOTE_SIZE);
      return;
    }
    setSelectedTemplateId(template.id);
    setNotes(noteToPlainText(template.notes));
    setNoteSize(normalizeNoteSize(template.noteSize));
    // Đồng hồ đang chạy thì chỉ đổi ghi chú, không đụng thời gian và nhạc.
    if (started) return;
    setHasFinished(false);
    setDuration(Math.min(MAX_COUNTDOWN_SECONDS, Math.max(1, template.durationSeconds)));
    if (template.musicId) setSelectedMusic(template.musicId);
  };

  const started = isRunning || totalSeconds > 0;
  const timerState: TimerState = isRunning
    ? "running"
    : hasFinished
    ? "finished"
    : totalSeconds > 0
    ? "paused"
    : "ready";
  const style = STATE_STYLES[timerState];

  const handleFullscreen = () => {
    const next = !isFullscreen;
    setIsFullscreen(next);

    const el = containerRef.current as any;
    const doc = document as any;
    try {
      if (next) {
        const req =
          el?.requestFullscreen ||
          el?.webkitRequestFullscreen ||
          el?.mozRequestFullScreen ||
          el?.msRequestFullscreen;
        const p = req?.call(el);
        if (p && typeof p.catch === "function") p.catch(() => {});
      } else {
        const exit =
          doc.exitFullscreen ||
          doc.webkitExitFullscreen ||
          doc.mozCancelFullScreen ||
          doc.msExitFullscreen;
        const p = exit?.call(doc);
        if (p && typeof p.catch === "function") p.catch(() => {});
      }
    } catch {
      // soft-fullscreen still works via state
    }
  };

  useEffect(() => {
    const sync = () => {
      const doc = document as any;
      const fsEl =
        doc.fullscreenElement ||
        doc.webkitFullscreenElement ||
        doc.mozFullScreenElement ||
        doc.msFullscreenElement;
      // Only react to native exit (e.g. user pressed Esc) — don't override soft-fullscreen.
      if (!fsEl && !document.hasFocus()) return;
      if (!fsEl) setIsFullscreen(false);
    };
    document.addEventListener("fullscreenchange", sync);
    document.addEventListener("webkitfullscreenchange", sync);
    return () => {
      document.removeEventListener("fullscreenchange", sync);
      document.removeEventListener("webkitfullscreenchange", sync);
    };
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsFullscreen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  const shownSeconds = totalSeconds > 0 ? totalSeconds : hasFinished ? 0 : duration;
  const timeText = formatCountdown(shownSeconds);
  const editingDisabled = started;

  const actionBtn =
    "inline-flex items-center gap-1.5 rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2 text-sm font-medium text-fg transition hover:bg-[rgb(var(--surface-muted))] disabled:opacity-50";

  // ── Reusable bits ─────────────────────────────────────────
  const presetChips = (
    <div className="flex flex-wrap justify-center gap-2">
      {TIMER_PRESETS.map((preset) => (
        <button
          key={preset.seconds}
          onClick={() => handlePresetClick(preset.seconds)}
          disabled={editingDisabled}
          aria-pressed={!started && duration === preset.seconds}
          className={`rounded-full border px-4 py-2 text-sm font-medium transition disabled:opacity-50 ${
            !started && duration === preset.seconds
              ? "border-brand-400 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
              : "border-token bg-[rgb(var(--surface))] text-fg hover:border-brand-400 hover:text-brand-700"
          }`}
        >
          {preset.label}
        </button>
      ))}
    </div>
  );

  const adjustChips = (
    <div className="flex flex-wrap justify-center gap-2">
      {ADJUST_STEPS.map((step) => (
        <button
          key={step.delta}
          onClick={() => handleAdjust(step.delta)}
          className="rounded-lg border border-token bg-[rgb(var(--surface))] px-3.5 py-1.5 text-sm font-medium text-fg transition hover:bg-[rgb(var(--surface-muted))]"
        >
          {step.label}
        </button>
      ))}
    </div>
  );

  const noteSizeSelector = (
    <div role="group" aria-label="Cỡ chữ ghi chú" className="inline-flex overflow-hidden rounded-lg border border-token">
      {NOTE_SIZES.map((size, i) => (
        <button
          key={size.id}
          type="button"
          onClick={() => setNoteSize(size.id)}
          aria-pressed={noteSize === size.id}
          className={`px-3.5 py-1.5 text-sm transition ${i > 0 ? "border-l border-token" : ""} ${
            noteSize === size.id
              ? "bg-brand-50 font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300"
              : "bg-[rgb(var(--surface))] text-fg hover:bg-[rgb(var(--surface-muted))]"
          }`}
        >
          {size.label}
        </button>
      ))}
    </div>
  );

  const notePx = NOTE_SIZES.find((s) => s.id === noteSize)?.px ?? 24;
  const noteVh = NOTE_SIZES.find((s) => s.id === noteSize)?.vh ?? 5;

  const primaryBtnSize = (large: boolean) =>
    large ? "h-14 flex-1 gap-2 rounded-xl text-lg" : "gap-2 rounded-xl px-5 py-2.5 text-sm";
  const primaryAction = (large: boolean) => {
    const size = primaryBtnSize(large);
    if (isRunning)
      return (
        <button
          onClick={handlePause}
          className={`inline-flex items-center justify-center border border-accent-300 bg-accent-50 font-semibold text-accent-700 transition hover:bg-accent-100 dark:bg-accent-900/30 dark:text-accent-300 ${size}`}
        >
          <Pause size={large ? 20 : 16} /> Tạm dừng
        </button>
      );
    if (totalSeconds > 0)
      return (
        <button
          onClick={handleResume}
          className={`inline-flex items-center justify-center bg-brand-gradient font-semibold text-white shadow-sm transition hover:shadow-brand-glow ${size}`}
        >
          <Play size={large ? 20 : 16} /> Tiếp tục
        </button>
      );
    return (
      <button
        onClick={handleStart}
        className={`inline-flex items-center justify-center bg-brand-gradient font-semibold text-white shadow-sm transition hover:shadow-brand-glow ${size}`}
      >
        <Play size={large ? 20 : 16} /> {hasFinished ? "Bắt đầu lại" : "Bắt đầu"}
      </button>
    );
  };

  // ── Fullscreen view ────────────────────────────────────────
  // NOTE: both views share a single <audio> element rendered once at the end
  // of this component (outside both branches below). Do not add another
  // <audio> inside either branch — toggling fullscreen would then unmount the
  // element that is currently playing and replace it with a fresh, silent one.
  const fullscreenView = (
      <div
        ref={containerRef}
        className="fixed inset-0 z-50 flex flex-col bg-[rgb(var(--bg))] p-6"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-token pb-3">
          <div className="flex flex-wrap items-center gap-3">
            {presetChips}
            <span className="h-5 w-px bg-token" />
            {adjustChips}
            <span className="h-5 w-px bg-token" />
            {primaryAction(false)}
            {started && (
              <button onClick={handleReset} className={actionBtn}>
                <RotateCcw size={14} /> Đặt lại
              </button>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {noteSizeSelector}
            <button onClick={handleFullscreen} className={actionBtn}>
              <Minimize2 size={14} /> Thoát
            </button>
            {onExit && (
              <button onClick={onExit} className={actionBtn}>
                <X size={14} /> Đóng
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 min-h-0 flex-col gap-3">
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-token bg-[rgb(var(--surface))] p-6">
            {notes.trim() ? (
              <p
                className="whitespace-pre-wrap break-words leading-snug"
                style={{ fontSize: `${noteVh}vh` }}
              >
                {notes}
              </p>
            ) : (
              <p className="text-muted">Chưa có ghi chú. Thoát toàn màn hình để nhập.</p>
            )}
          </div>

          <div
            className={`flex items-center justify-center rounded-2xl border-4 transition-all duration-300 ${style.ring} ${style.bg} ${style.pulse ? "animate-pulse" : ""}`}
            style={{ height: "22vh" }}
          >
            <span
              className={`whitespace-nowrap font-mono font-bold leading-none ${style.text}`}
              style={{ fontSize: "16vh" }}
            >
              {timeText}
            </span>
          </div>
        </div>
      </div>
  );

  // ── Normal view ────────────────────────────────────────────
  const normalView = (
    <div ref={containerRef} className="space-y-3">
      <div className="flex items-center gap-2 rounded-xl border border-token bg-[rgb(var(--surface))] px-3 py-2 shadow-card">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white">
          <Clock size={16} strokeWidth={2.2} />
        </div>
        <h3 className="text-sm font-bold">Đếm Ngược</h3>
        <div className="ml-auto flex items-center gap-1.5">
          <button onClick={handleFullscreen} className={actionBtn} title="Toàn màn hình">
            <Maximize2 size={14} /> Phóng to
          </button>
          {onExit && (
            <button onClick={onExit} className={actionBtn} title="Đóng" aria-label="Đóng">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-token bg-[rgb(var(--surface))] p-4 shadow-card">
        <div
          className={`flex flex-col items-center justify-center rounded-2xl border-4 px-6 py-8 transition-all duration-300 ${style.ring} ${style.bg} ${style.pulse ? "animate-pulse" : ""}`}
        >
          <span className={`mb-1 text-[11px] font-semibold uppercase tracking-wider ${style.text}`}>
            {style.label}
          </span>
          {editing ? (
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={(e) => e.currentTarget.select()}
              onBlur={commitEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditing(false);
              }}
              inputMode="numeric"
              aria-label="Nhập thời gian, ví dụ 7 hoặc 12:30"
              className={`w-full max-w-md bg-transparent text-center font-mono text-6xl font-bold leading-none outline-none sm:text-7xl ${style.text}`}
            />
          ) : (
            <button
              type="button"
              onClick={beginEdit}
              disabled={started}
              title={started ? undefined : "Bấm để gõ thời gian"}
              className={`font-mono text-7xl font-bold leading-none sm:text-8xl ${style.text} ${started ? "cursor-default" : "cursor-text"}`}
            >
              {timeText}
            </button>
          )}
          {!started && !editing && (
            <span className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted">
              <Pencil size={12} /> Bấm vào số để gõ trực tiếp, ví dụ 7 hoặc 12:30
            </span>
          )}
          {notes.trim() && (
            <p
              className={`mt-4 w-full max-w-xl whitespace-pre-wrap break-words border-t border-token pt-4 text-center leading-snug ${style.text}`}
              style={{ fontSize: `${notePx}px` }}
            >
              {notes}
            </p>
          )}
        </div>

        <div className="mt-4 space-y-2">
          {presetChips}
          {adjustChips}
        </div>

        <div className="mt-4 flex gap-2">
          {primaryAction(true)}
          {started && (
            <button onClick={handleReset} className={`${actionBtn} h-14 rounded-xl px-5 text-base`}>
              <RotateCcw size={16} /> Đặt lại
            </button>
          )}
        </div>

        <div className="mt-3 flex items-center justify-center gap-1.5">
          <Music2 size={14} className="text-muted" />
          <select
            value={selectedMusic}
            onChange={(e) => setSelectedMusic(e.target.value)}
            disabled={started}
            className="input h-9 py-0 text-xs"
            aria-label="Nhạc nền"
          >
            {MUSIC_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Template + Notes stacked in one section */}
      <div className="space-y-3 rounded-2xl border border-token bg-[rgb(var(--surface))] p-3 shadow-card">
        <TemplateSelector
          templates={tpl.templates}
          isLoading={tpl.isLoading}
          selectedTemplateId={selectedTemplateId}
          onSelectTemplate={handleSelectTemplate}
          onDeleteTemplate={(t) => tpl.remove(t.id)}
        />
        <div>
          <label htmlFor="countdown-note" className="mb-1.5 block text-sm font-medium">
            Ghi chú hiện cạnh đồng hồ
            {selectedTemplateId && (
              <span className="ml-2 text-xs font-normal text-brand-700 dark:text-brand-300">
                (từ mẫu, có thể chỉnh sửa)
              </span>
            )}
          </label>
          <textarea
            id="countdown-note"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Thảo luận nhóm về ca 2, ghi ý chính lên bảng"
            rows={4}
            className="input w-full resize-y p-2 text-sm"
          />
          <div className="mt-3">
            <p className="mb-1.5 text-xs text-muted">Cỡ chữ</p>
            {noteSizeSelector}
          </div>
        </div>
        <TemplateSaveBar
          draft={{ durationSeconds: duration, notes, noteSize, musicId: selectedMusic }}
          selectedTemplate={tpl.templates.find((t) => t.id === selectedTemplateId) ?? null}
          onCreate={tpl.create}
          onUpdate={tpl.update}
          onSaved={(t) => setSelectedTemplateId(t.id)}
        />
      </div>
    </div>
  );

  return (
    <>
      {isFullscreen ? fullscreenView : normalView}
      <audio ref={audioRef} crossOrigin="anonymous" />
    </>
  );
}
