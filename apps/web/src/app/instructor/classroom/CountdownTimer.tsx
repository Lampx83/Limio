"use client";

import { useState, useEffect, useRef } from "react";
import { Clock } from "lucide-react";
import { TimerTemplate } from "@feedbackme/db";
import NotesEditor from "./NotesEditor";
import TemplateSelector from "../teaching-tools/TimerTemplates/TemplateSelector";

const MUSIC_OPTIONS = [
  { id: "none", name: "Không có âm nhạc", src: "" },
  { id: "upbeat", name: "🎵 Vui vẻ", src: "/music/upbeat.mp3" },
  { id: "focus", name: "🧠 Tập trung", src: "/music/focus.mp3" },
  { id: "ambient", name: "☁️ Thư giãn", src: "/music/ambient.mp3" },
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

export default function CountdownTimer({ onExit }: CountdownTimerProps = {}) {
  const [minutes, setMinutes] = useState(5);
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [notes, setNotes] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedMusic, setSelectedMusic] = useState("upbeat");
  const [notesHeightPercent, setNotesHeightPercent] = useState(60);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const dividerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!audioRef.current) return;

    if (!isRunning) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    } else if (isRunning && selectedMusic !== "none") {
      const musicFile = MUSIC_OPTIONS.find((m) => m.id === selectedMusic);
      if (musicFile?.src && audioRef.current.src !== musicFile.src) {
        audioRef.current.src = musicFile.src;
        audioRef.current.loop = true;
        audioRef.current.play().catch((err) => {
          console.log("Audio playback failed:", err);
        });
      }
    }
  }, [isRunning, selectedMusic]);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setTotalSeconds((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  useEffect(() => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    setMinutes(mins);
    setSeconds(secs);
  }, [totalSeconds]);

  const handleStart = () => {
    const total = parseInt(minutes.toString()) * 60 + parseInt(seconds.toString());
    if (total > 0) {
      setTotalSeconds(total);
      setIsRunning(true);

      if (selectedMusic !== "none" && audioRef.current) {
        const musicFile = MUSIC_OPTIONS.find((m) => m.id === selectedMusic);
        if (musicFile?.src) {
          audioRef.current.src = musicFile.src;
          audioRef.current.loop = true;

          // Load and play the audio
          audioRef.current.load();
          const playPromise = audioRef.current.play();
          if (playPromise !== undefined) {
            playPromise.catch((err) => {
              console.log("Audio playback failed:", err);
            });
          }
        }
      }
    }
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleResume = () => {
    if (totalSeconds > 0) {
      setIsRunning(true);
      if (selectedMusic !== "none" && audioRef.current && !audioRef.current.paused) {
        // Audio is already playing, nothing to do
        return;
      }
      if (selectedMusic !== "none" && audioRef.current) {
        audioRef.current.play().catch((err) => {
          console.log("Audio playback failed:", err);
        });
      }
    }
  };

  const handleReset = () => {
    setIsRunning(false);
    setTotalSeconds(0);
    setMinutes(5);
    setSeconds(0);
  };

  const handlePresetClick = (seconds: number) => {
    if (isRunning || totalSeconds > 0) return;
    setMinutes(Math.floor(seconds / 60));
    setSeconds(seconds % 60);
  };

  const handleSelectTemplate = (template: TimerTemplate | null) => {
    if (!template) {
      setSelectedTemplateId(null);
      return;
    }

    // Load template data
    setSelectedTemplateId(template.id);
    setMinutes(Math.floor(template.durationSeconds / 60));
    setSeconds(template.durationSeconds % 60);
    if (template.notes) {
      setNotes(template.notes);
    }
    if (template.musicId) {
      setSelectedMusic(template.musicId);
    }
  };

  const getTimerState = () => {
    if (totalSeconds === 0 && !isRunning) return 'ready';
    if (isRunning) return 'running';
    if (totalSeconds > 0) return 'paused';
    return 'finished';
  };

  const timerState = getTimerState();
  const stateClasses: Record<string, string> = {
    ready: 'border-gray-300 bg-gray-50 dark:border-gray-700 dark:bg-gray-900',
    running: 'border-green-400 bg-green-50 dark:border-green-500 dark:bg-green-950 animate-pulse',
    paused: 'border-yellow-400 bg-yellow-50 dark:border-yellow-500 dark:bg-yellow-950',
    finished: 'border-purple-500 bg-purple-100 dark:border-purple-400 dark:bg-purple-950 animate-pulse',
  };

  const stateIcons: Record<string, React.ReactNode> = {
    ready: <Clock size={20} className="text-orange-600" strokeWidth={1.5} />,
    running: <Clock size={20} className="text-green-600" strokeWidth={1.5} />,
    paused: <Clock size={20} className="text-yellow-600" strokeWidth={1.5} />,
    finished: <Clock size={20} className="text-purple-600" strokeWidth={1.5} />,
  };

  const handleFullscreen = async () => {
    if (!containerRef.current) return;

    try {
      if (!isFullscreen) {
        await containerRef.current.requestFullscreen?.();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen?.();
        setIsFullscreen(false);
      }
    } catch (err) {
      console.error("Fullscreen error:", err);
    }
  };

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  }, []);

  const handleDividerMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const container = containerRef.current;
    if (!container) return;

    const startHeight = container.clientHeight;
    const startPercent = notesHeightPercent;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const percentChange = (deltaY / startHeight) * 100;
      const newPercent = Math.max(30, Math.min(80, startPercent + percentChange));
      setNotesHeightPercent(newPercent);
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const formatTime = (num: number) => String(num).padStart(2, "0");
  const displayMinutes = totalSeconds > 0 ? Math.floor(totalSeconds / 60) : minutes;
  const displaySeconds = totalSeconds > 0 ? totalSeconds % 60 : seconds;

  if (isFullscreen) {
    return (
      <div
        ref={containerRef}
        className="fixed inset-0 bg-[rgb(var(--surface))] flex flex-col p-6 z-50"
      >
        {/* Fullscreen Header - Compact */}
        <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex gap-4 items-center flex-wrap">
            {/* Quick Presets */}
            <div className="flex gap-1 items-center">
              <span className="text-xs font-medium text-muted mr-2">Nhanh</span>
              {TIMER_PRESETS.map((preset) => (
                <button
                  key={preset.seconds}
                  onClick={() => handlePresetClick(preset.seconds)}
                  disabled={isRunning || totalSeconds > 0}
                  className="btn-secondary text-xs px-2 py-1 hover:scale-105 transition-transform disabled:opacity-50"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="text-gray-300">│</div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted">🎵</span>
              <select
                value={selectedMusic}
                onChange={(e) => setSelectedMusic(e.target.value)}
                disabled={isRunning || totalSeconds > 0}
                className="input text-sm"
              >
              {MUSIC_OPTIONS.map((music) => (
                <option key={music.id} value={music.id}>
                  {music.name}
                </option>
              ))}
              </select>
            </div>

            {/* Divider */}
            <div className="text-gray-300">│</div>

            {/* Input Fields - in header */}
            <div className="flex gap-2">
              <div className="w-24">
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={totalSeconds === 0 ? minutes : displayMinutes}
                  onChange={(e) => {
                    if (totalSeconds === 0) {
                      setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                    }
                  }}
                  disabled={isRunning || totalSeconds > 0}
                  className="input w-full text-center text-xs"
                  placeholder="Phút"
                />
              </div>
              <div className="w-24">
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={totalSeconds === 0 ? seconds : displaySeconds}
                  onChange={(e) => {
                    if (totalSeconds === 0) {
                      setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                    }
                  }}
                  disabled={isRunning || totalSeconds > 0}
                  className="input w-full text-center text-xs"
                  placeholder="Giây"
                />
              </div>
            </div>
            {!isRunning && totalSeconds === 0 && (
              <button onClick={handleStart} className="btn-primary text-xs px-3 hover:scale-105 active:scale-95 transition-all duration-200">
                Bắt đầu
              </button>
            )}
            {isRunning && (
              <button onClick={handlePause} className="btn-secondary text-xs px-3 hover:scale-105 active:scale-95 transition-all duration-200">
                Tạm dừng
              </button>
            )}
            {!isRunning && totalSeconds > 0 && (
              <button onClick={handleResume} className="btn-primary text-xs px-3 hover:scale-105 active:scale-95 transition-all duration-200">
                Tiếp tục
              </button>
            )}
            {totalSeconds > 0 && (
              <button onClick={handleReset} className="btn-danger text-xs px-3 hover:scale-105 active:scale-95 transition-all duration-200">
                Đặt lại
              </button>
            )}
          </div>
          <button
            onClick={handleFullscreen}
            className="btn-secondary text-sm"
            title="Thoát toàn màn hình"
          >
            ⛶ Thoát
          </button>
          {onExit && (
            <button
              onClick={onExit}
              className="btn-secondary text-sm"
              title="Exit tool"
            >
              ✕ Exit
            </button>
          )}
        </div>

        {/* Fullscreen Layout: Mission (top) + Timer (bottom) with draggable divider */}
        <div className="flex flex-col flex-1 min-h-0">
          {/* Notes/Mission Content - Top (resizable) */}
          <div
            className="flex flex-col min-h-0"
            style={{ height: `${notesHeightPercent}%` }}
          >
            <label className="text-sm font-semibold mb-2">📋 Nhiệm vụ / Hướng dẫn cho sinh viên</label>
            <NotesEditor
              value={notes}
              onChange={setNotes}
              placeholder="Nhập hướng dẫn cho sinh viên..."
              className="input flex-1 resize-none text-base p-4 leading-relaxed overflow-auto"
            />
          </div>

          {/* Draggable Divider */}
          <div
            ref={dividerRef}
            onMouseDown={handleDividerMouseDown}
            className="h-1 bg-purple-300 cursor-row-resize hover:bg-purple-500 transition-colors"
            title="Kéo để thay đổi kích thước"
          />

          {/* Timer Display - Bottom (resizable) */}
          <div
            className={`flex flex-col justify-center items-center min-h-0 border-4 rounded-lg transition-all duration-300 ${stateClasses[timerState]}`}
            style={{ height: `${100 - notesHeightPercent}%` }}
          >
            <div className="flex items-center justify-center gap-3 mb-4">
              <span className="text-4xl">{stateIcons[timerState]}</span>
              <p className="text-2xl text-muted">Thời gian còn lại</p>
            </div>
            <div className="text-8xl font-bold text-purple-700 font-mono leading-none">
              {formatTime(displayMinutes)}:{formatTime(displaySeconds)}
            </div>
          </div>
        </div>
        <audio ref={audioRef} crossOrigin="anonymous" />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="rounded-2xl border-2 border-purple-200 bg-[rgb(var(--surface))] p-6 shadow-card transition-all duration-300"
    >
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Clock size={24} className="text-orange-600" strokeWidth={1.5} />
          <h3 className="text-lg font-bold">Đồng Hồ Đếm Ngược</h3>
        </div>
        <div className="flex gap-4 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-muted">🎵 Nhạc</label>
            <select
              value={selectedMusic}
              onChange={(e) => setSelectedMusic(e.target.value)}
              disabled={isRunning || totalSeconds > 0}
              className="input text-sm w-40"
            >
              {MUSIC_OPTIONS.map((music) => (
                <option key={music.id} value={music.id}>
                  {music.name}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={handleFullscreen}
            className="btn-secondary text-sm"
            title="Toàn màn hình"
          >
            ⛶ Toàn màn hình
          </button>
          {onExit && (
            <button
              onClick={onExit}
              className="btn-secondary text-sm"
              title="Exit"
            >
              ✕ Exit
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Timer Display & Controls */}
        <div className="flex flex-col gap-3">
          {/* Template Selector */}
          <TemplateSelector
            selectedTemplateId={selectedTemplateId}
            onSelectTemplate={handleSelectTemplate}
          />

          {/* Quick Presets */}
          <div>
            <label className="block text-xs font-medium text-muted mb-2">
              Nhanh chóng
            </label>
            <div className="flex gap-2 flex-wrap">
              {TIMER_PRESETS.map((preset) => (
                <button
                  key={preset.seconds}
                  onClick={() => handlePresetClick(preset.seconds)}
                  disabled={isRunning || totalSeconds > 0}
                  className="btn-secondary text-sm px-3 py-2 hover:scale-105 active:scale-95 transition-transform duration-200 disabled:opacity-50 focus:ring-2 focus:ring-purple-400 focus:outline-none"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Input Fields & Start Button - Compact on top */}
          <div className="flex gap-2">
            <div className="w-20">
              <label className="block text-xs font-medium text-muted mb-1">
                Phút
              </label>
              <input
                type="number"
                min="0"
                max="59"
                value={totalSeconds === 0 ? minutes : displayMinutes}
                onChange={(e) => {
                  if (totalSeconds === 0) {
                    setMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                  }
                }}
                disabled={isRunning || totalSeconds > 0}
                className="input w-full text-center text-sm"
              />
            </div>
            <div className="w-20">
              <label className="block text-xs font-medium text-muted mb-1">
                Giây
              </label>
              <input
                type="number"
                min="0"
                max="59"
                value={totalSeconds === 0 ? seconds : displaySeconds}
                onChange={(e) => {
                  if (totalSeconds === 0) {
                    setSeconds(Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
                  }
                }}
                disabled={isRunning || totalSeconds > 0}
                className="input w-full text-center text-sm"
              />
            </div>
            {!isRunning && totalSeconds === 0 && (
              <button onClick={handleStart} className="btn-primary flex-1 self-end hover:scale-105 active:scale-95 transition-all duration-200 focus:ring-2 focus:ring-purple-400 focus:outline-none">
                Bắt đầu
              </button>
            )}
            {isRunning && (
              <button onClick={handlePause} className="btn-secondary flex-1 self-end hover:scale-105 active:scale-95 transition-all duration-200 focus:ring-2 focus:ring-purple-400 focus:outline-none">
                Tạm dừng
              </button>
            )}
            {!isRunning && totalSeconds > 0 && (
              <button onClick={handleResume} className="btn-primary flex-1 self-end hover:scale-105 active:scale-95 transition-all duration-200 focus:ring-2 focus:ring-purple-400 focus:outline-none">
                Tiếp tục
              </button>
            )}
          </div>

          {/* Reset Button if needed */}
          {totalSeconds > 0 && (
            <button onClick={handleReset} className="btn-danger w-full hover:scale-105 active:scale-95 transition-all duration-200 focus:ring-2 focus:ring-purple-400 focus:outline-none">
              Đặt lại
            </button>
          )}

          {/* Timer Display - Large below */}
          <div className={`rounded-xl border-4 p-8 text-center flex-1 flex flex-col justify-center transition-all duration-300 ${stateClasses[timerState]}`}>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="text-2xl">{stateIcons[timerState]}</span>
              <p className="text-sm text-muted">Thời gian còn lại</p>
            </div>
            <div className="text-6xl font-bold text-purple-700 font-mono">
              {formatTime(displayMinutes)}:{formatTime(displaySeconds)}
            </div>
          </div>
        </div>

        {/* Notes Section */}
        <div className="flex flex-col">
          <label className="block text-sm font-semibold mb-2">
            📝 Ghi chú / Hướng dẫn
          </label>
          <NotesEditor
            value={notes}
            onChange={setNotes}
            placeholder="Nhập ghi chú cho sinh viên..."
            className="input w-full overflow-auto p-3 text-sm"
            rows={8}
          />
        </div>
      </div>
      <audio ref={audioRef} crossOrigin="anonymous" />
    </div>
  );
}
