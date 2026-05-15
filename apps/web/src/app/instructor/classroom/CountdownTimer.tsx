"use client";

import { useState, useEffect, useRef } from "react";
import { Clock, Play, Pause, RotateCcw, Maximize2, Minimize2, X, Music2, Minus, Plus } from "lucide-react";
import type { TimerTemplate } from "@feedbackme/db";
import NotesEditor from "./NotesEditor";
import TemplateSelector from "../teaching-tools/TimerTemplates/TemplateSelector";

const MUSIC_OPTIONS = [
  { id: "none", name: "Không có âm nhạc", src: "" },
  { id: "upbeat", name: "Vui vẻ", src: "/music/upbeat.mp3" },
  { id: "focus", name: "Tập trung", src: "/music/focus.mp3" },
  { id: "ambient", name: "Thư giãn", src: "/music/ambient.mp3" },
];

const TIMER_PRESETS = [
  { label: "5 phút", seconds: 300 },
  { label: "10 phút", seconds: 600 },
  { label: "15 phút", seconds: 900 },
  { label: "20 phút", seconds: 1200 },
];

interface CountdownTimerProps {
  onExit?: () => void;
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

export default function CountdownTimer({ onExit }: CountdownTimerProps = {}) {
  const [hours, setHours] = useState(0);
  const [minutes, setMinutes] = useState(15);
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [notes, setNotes] = useState("");
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

  const handleStart = () => {
    const total = hours * 3600 + minutes * 60 + seconds;
    if (total > 0) {
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
    }
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

  const handleReset = () => {
    setIsRunning(false);
    setHasFinished(false);
    setTotalSeconds(0);
    setHours(0);
    setMinutes(15);
    setSeconds(0);
  };

  const handlePresetClick = (s: number) => {
    if (isRunning || totalSeconds > 0) return;
    setHours(Math.floor(s / 3600));
    setMinutes(Math.floor((s % 3600) / 60));
    setSeconds(s % 60);
  };

  const handleSelectTemplate = (template: TimerTemplate | null) => {
    if (!template) {
      setSelectedTemplateId(null);
      setNotes("");
      return;
    }
    setSelectedTemplateId(template.id);
    setNotes(template.notes ?? "");
    if (template.musicId) setSelectedMusic(template.musicId);
  };

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

  const formatTime = (n: number) => String(n).padStart(2, "0");
  const displayHours =
    totalSeconds > 0 ? Math.floor(totalSeconds / 3600) : hasFinished ? 0 : hours;
  const displayMinutes =
    totalSeconds > 0
      ? Math.floor((totalSeconds % 3600) / 60)
      : hasFinished
      ? 0
      : minutes;
  const displaySeconds =
    totalSeconds > 0 ? totalSeconds % 60 : hasFinished ? 0 : seconds;
  const showHours = displayHours > 0 || hours > 0;
  const editingDisabled = isRunning || totalSeconds > 0;

  const stepperBtn =
    "flex h-10 w-10 items-center justify-center text-muted transition hover:bg-[rgb(var(--surface-muted))] disabled:opacity-30";
  const actionBtn =
    "inline-flex items-center gap-1.5 rounded-lg border border-token bg-[rgb(var(--surface))] px-3 py-2 text-sm font-medium text-fg transition hover:bg-[rgb(var(--surface-muted))] disabled:opacity-50";

  // ── Reusable bits ─────────────────────────────────────────
  const stepper = (
    value: number,
    onChange: (v: number) => void,
    label: string,
    max: number,
  ) => (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center rounded-lg border border-token bg-[rgb(var(--surface))] overflow-hidden">
        <button
          type="button"
          onClick={() => onChange(Math.max(0, value - 1))}
          disabled={editingDisabled || value <= 0}
          className="flex h-9 w-7 items-center justify-center text-muted transition hover:bg-[rgb(var(--surface-muted))] disabled:opacity-30"
          aria-label={`Giảm ${label}`}
        >
          <Minus size={14} />
        </button>
        <input
          type="number"
          min="0"
          max={max}
          value={value}
          onChange={(e) =>
            onChange(Math.max(0, Math.min(max, parseInt(e.target.value) || 0)))
          }
          disabled={editingDisabled}
          className="h-9 w-10 border-x border-token bg-transparent text-center text-sm font-semibold focus:outline-none disabled:opacity-60"
          aria-label={label}
        />
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={editingDisabled || value >= max}
          className="flex h-9 w-7 items-center justify-center text-muted transition hover:bg-[rgb(var(--surface-muted))] disabled:opacity-30"
          aria-label={`Tăng ${label}`}
        >
          <Plus size={14} />
        </button>
      </div>
      <span className="text-[10px] font-medium uppercase tracking-wider text-muted">
        {label}
      </span>
    </div>
  );

  const presetChips = (
    <div className="flex flex-wrap gap-2">
      {TIMER_PRESETS.map((preset) => (
        <button
          key={preset.seconds}
          onClick={() => handlePresetClick(preset.seconds)}
          disabled={editingDisabled}
          className="rounded-full border border-token bg-[rgb(var(--surface))] px-3 py-1.5 text-xs font-medium text-fg transition hover:border-brand-400 hover:text-brand-700 disabled:opacity-50 disabled:hover:border-token disabled:hover:text-fg"
        >
          {preset.label}
        </button>
      ))}
    </div>
  );

  const primaryAction = (() => {
    if (isRunning)
      return (
        <button
          onClick={handlePause}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-accent-300 bg-accent-50 px-5 py-2.5 text-sm font-semibold text-accent-700 transition hover:bg-accent-100 dark:bg-accent-900/30 dark:text-accent-300"
        >
          <Pause size={16} /> Tạm dừng
        </button>
      );
    if (totalSeconds > 0)
      return (
        <button
          onClick={handleResume}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-brand-glow"
        >
          <Play size={16} /> Tiếp tục
        </button>
      );
    return (
      <button
        onClick={handleStart}
        disabled={hours === 0 && minutes === 0 && seconds === 0}
        className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-gradient px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:shadow-brand-glow disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Play size={16} /> Bắt đầu
      </button>
    );
  })();

  // ── Fullscreen view ────────────────────────────────────────
  if (isFullscreen) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 z-50 flex flex-col bg-[rgb(var(--bg))] p-6"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-token pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="mr-1 text-xs font-medium text-muted">Nhanh</span>
            {TIMER_PRESETS.map((preset) => (
              <button
                key={preset.seconds}
                onClick={() => handlePresetClick(preset.seconds)}
                disabled={editingDisabled}
                className="rounded-full border border-token bg-[rgb(var(--surface))] px-3 py-1 text-xs font-medium text-fg transition hover:border-brand-400 disabled:opacity-50"
              >
                {preset.label}
              </button>
            ))}
            <span className="mx-2 h-5 w-px bg-token" />
            <div className="flex items-center gap-2">
              {stepper(displayHours, (v) => setHours(v), "Giờ", 23)}
              <span className="text-base font-bold text-muted">:</span>
              {stepper(displayMinutes, (v) => setMinutes(v), "Phút", 59)}
              <span className="text-base font-bold text-muted">:</span>
              {stepper(displaySeconds, (v) => setSeconds(v), "Giây", 59)}
            </div>
            <span className="mx-2 h-5 w-px bg-token" />
            {primaryAction}
            {totalSeconds > 0 && (
              <button onClick={handleReset} className={actionBtn}>
                <RotateCcw size={14} /> Đặt lại
              </button>
            )}
          </div>
          <div className="flex gap-2">
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
          <div className="flex flex-1 min-h-0 flex-col">
            <label className="mb-2 text-sm font-semibold">Nhiệm vụ / Hướng dẫn cho sinh viên</label>
            <NotesEditor
              value={notes}
              onChange={setNotes}
              placeholder="Nhập hướng dẫn cho sinh viên..."
              className="input h-full w-full resize-none overflow-hidden p-4 leading-relaxed"
              autoFit
            />
          </div>

          <div
            className={`flex items-center justify-center rounded-2xl border-4 transition-all duration-300 ${style.ring} ${style.bg} ${style.pulse ? "animate-pulse" : ""}`}
            style={{ height: "22vh" }}
          >
            <span
              className={`whitespace-nowrap font-mono font-bold leading-none ${style.text}`}
              style={{ fontSize: "16vh" }}
            >
              {showHours ? `${formatTime(displayHours)}:` : ""}{formatTime(displayMinutes)}:{formatTime(displaySeconds)}
            </span>
          </div>
        </div>
        <audio ref={audioRef} crossOrigin="anonymous" />
      </div>
    );
  }

  // ── Normal view ────────────────────────────────────────────
  return (
    <div ref={containerRef} className="space-y-3">
      {/* Compact toolbar: title + presets + steppers + music + actions */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-token bg-[rgb(var(--surface))] px-3 py-2 shadow-card">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gradient text-white">
            <Clock size={16} strokeWidth={2.2} />
          </div>
          <h3 className="text-sm font-bold">Đếm Ngược</h3>
        </div>

        <span className="h-6 w-px bg-token" />

        <div className="flex flex-wrap items-center gap-1.5">
          {TIMER_PRESETS.map((preset) => (
            <button
              key={preset.seconds}
              onClick={() => handlePresetClick(preset.seconds)}
              disabled={editingDisabled}
              className="rounded-full border border-token bg-[rgb(var(--surface))] px-2.5 py-1 text-xs font-medium text-fg transition hover:border-brand-400 hover:text-brand-700 disabled:opacity-50"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <span className="h-6 w-px bg-token" />

        <div className="flex items-center gap-1.5">
          {stepper(displayHours, (v) => setHours(v), "Giờ", 23)}
          <span className="text-base font-bold text-muted">:</span>
          {stepper(displayMinutes, (v) => setMinutes(v), "Phút", 59)}
          <span className="text-base font-bold text-muted">:</span>
          {stepper(displaySeconds, (v) => setSeconds(v), "Giây", 59)}
        </div>

        <div className="flex items-center gap-1.5">
          <Music2 size={14} className="text-muted" />
          <select
            value={selectedMusic}
            onChange={(e) => setSelectedMusic(e.target.value)}
            disabled={editingDisabled}
            className="input h-9 py-0 text-xs"
          >
            {MUSIC_OPTIONS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {primaryAction}
          {totalSeconds > 0 && (
            <button onClick={handleReset} className={actionBtn}>
              <RotateCcw size={14} /> Reset
            </button>
          )}
          <button onClick={handleFullscreen} className={actionBtn} title="Toàn màn hình">
            <Maximize2 size={14} />
          </button>
          {onExit && (
            <button onClick={onExit} className={actionBtn} title="Đóng">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Big timer */}
      <div
        className={`flex flex-col items-center justify-center rounded-2xl border-4 px-6 py-8 transition-all duration-300 ${style.ring} ${style.bg} ${style.pulse ? "animate-pulse" : ""}`}
      >
        <span className={`mb-1 text-[11px] font-semibold uppercase tracking-wider ${style.text}`}>
          {style.label}
        </span>
        <span className={`font-mono text-7xl font-bold leading-none sm:text-8xl ${style.text}`}>
          {showHours ? `${formatTime(displayHours)}:` : ""}{formatTime(displayMinutes)}:{formatTime(displaySeconds)}
        </span>
      </div>

      {/* Template + Notes stacked in one section */}
      <div className="space-y-3 rounded-2xl border border-token bg-[rgb(var(--surface))] p-3 shadow-card">
        <TemplateSelector
          selectedTemplateId={selectedTemplateId}
          onSelectTemplate={handleSelectTemplate}
        />
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-muted">
            Ghi chú / Hướng dẫn
            {selectedTemplateId && (
              <span className="ml-2 font-normal text-brand-700 dark:text-brand-300">
                (từ mẫu — có thể chỉnh sửa)
              </span>
            )}
          </label>
          <NotesEditor
            value={notes}
            onChange={setNotes}
            placeholder="Nhập ghi chú cho sinh viên..."
            className="input w-full overflow-auto p-2 text-sm"
            rows={6}
          />
        </div>
      </div>

      <audio ref={audioRef} crossOrigin="anonymous" />
    </div>
  );
}
