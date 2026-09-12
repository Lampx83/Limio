"use client";

import { useState, useRef } from "react";
import confetti from "canvas-confetti";
import { Shuffle } from "lucide-react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";
import LuckyWheel from "./LuckyWheel";
import SlotMachineReel, { type ResolvedReelTarget } from "./SlotMachineReel";

type PickerTemplate = "slot" | "wheel";

function fireConfettiFireworks() {
  const colors = ["#FBBF24", "#F97316", "#EC4899", "#8B5CF6", "#22C55E"];
  const durationMs = 2200;
  const end = Date.now() + durationMs;
  (function burstFromSides() {
    confetti({ particleCount: 5, angle: 60, spread: 65, origin: { x: 0 }, colors, startVelocity: 55 });
    confetti({ particleCount: 5, angle: 120, spread: 65, origin: { x: 1 }, colors, startVelocity: 55 });
    if (Date.now() < end) requestAnimationFrame(burstFromSides);
  })();
  confetti({ particleCount: 140, spread: 100, origin: { y: 0.4 }, colors, startVelocity: 45, ticks: 220 });
}

interface Student {
  userId?: string;
  displayName?: string;
  name?: string;
  id?: string | null;
}

interface RandomPickerProps {
  lessonId?: string;
  studentList?: Array<{ name: string; id: string | null }>;
  onExit?: () => void;
}

export default function RandomPicker({ lessonId, studentList, onExit }: RandomPickerProps) {
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [pickHistory, setPickHistory] = useState<Student[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [template, setTemplate] = useState<PickerTemplate>("slot");
  const [winnerPopup, setWinnerPopup] = useState<Student | null>(null);
  const [excludePicked, setExcludePicked] = useState(true);
  const [pickedIdx, setPickedIdx] = useState<Set<number>>(new Set());
  const audioCtxRef = useRef<AudioContext | null>(null);
  const pendingClassroomStudentRef = useRef<Student | null>(null);

  function playFanfare() {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      const now = ctx.currentTime;
      // Fanfare chúc mừng: C E G C arpeggio + chord cuối
      const notes: Array<[number, number, number]> = [
        // [freq, startOffset, duration]
        [523.25, 0.0, 0.18],   // C5
        [659.25, 0.15, 0.18],  // E5
        [783.99, 0.3, 0.18],   // G5
        [1046.5, 0.45, 0.5],   // C6 (held)
        // hợp âm cuối
        [523.25, 0.95, 0.7],
        [659.25, 0.95, 0.7],
        [783.99, 0.95, 0.7],
        [1046.5, 0.95, 0.7],
      ];
      for (const [freq, offset, dur] of notes) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + offset);
        gain.gain.setValueAtTime(0, now + offset);
        gain.gain.linearRampToValueAtTime(0.12, now + offset + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + offset + dur);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now + offset);
        osc.stop(now + offset + dur + 0.05);
      }
    } catch {
      // ignore
    }
  }

  function celebrateWinner(student: Student) {
    setWinnerPopup(student);
    fireConfettiFireworks();
    playFanfare();
  }

  const isStateless = !!studentList && !lessonId;
  const wheelAvailable = isStateless && (studentList?.length ?? 0) > 0;

  // Map các index "đang còn" trên wheel về index gốc trong studentList,
  // để khi LuckyWheel báo về index trong list rút gọn ta vẫn tìm đúng SV.
  const activeIndices: number[] =
    isStateless && excludePicked
      ? (studentList ?? []).map((_, i) => i).filter((i) => !pickedIdx.has(i))
      : (studentList ?? []).map((_, i) => i);
  const wheelNames = activeIndices.map((i) => studentList![i]!.name);
  const allPicked = excludePicked && wheelAvailable && activeIndices.length === 0;

  function handleSpinStart() {
    setIsAnimating(true);
    setSelectedStudent(null);
  }

  function handleSpinEnd(winner: string, index: number) {
    const originalIdx = activeIndices[index];
    const picked = originalIdx !== undefined ? studentList?.[originalIdx] : undefined;
    const student: Student = {
      displayName: winner,
      name: winner,
      userId: picked?.id || undefined,
    };
    setSelectedStudent(student);
    setIsAnimating(false);
    setPickHistory((prev) => [student, ...prev.slice(0, 9)]);
    if (excludePicked && originalIdx !== undefined) {
      setPickedIdx((prev) => new Set(prev).add(originalIdx));
    }
    celebrateWinner(student);
  }

  async function resolveClassroomTarget(): Promise<ResolvedReelTarget | null> {
    if (!lessonId) {
      toast.error("Lesson ID is required");
      return null;
    }
    try {
      const res = await fetch(apiUrl("/api/classroom/random-pick"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId }),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        toast.error(error.error || "Failed to pick student");
        return null;
      }
      const data = await res.json();
      pendingClassroomStudentRef.current = {
        userId: data.userId,
        displayName: data.displayName,
        name: data.displayName,
      };
      const roster: string[] =
        Array.isArray(data.roster) && data.roster.length > 0 ? data.roster : [data.displayName];
      const winnerIndex =
        typeof data.winnerIndex === "number" ? data.winnerIndex : Math.max(roster.indexOf(data.displayName), 0);
      return { names: roster, index: winnerIndex, winner: data.displayName };
    } catch (err) {
      console.error("[RandomPicker]", err);
      toast.error("Network error");
      return null;
    }
  }

  function handleClassroomSpinEnd(winner: string) {
    const student = pendingClassroomStudentRef.current ?? { displayName: winner, name: winner };
    setSelectedStudent(student);
    setIsAnimating(false);
    setPickHistory((prev) => [student, ...prev.slice(0, 9)]);
    celebrateWinner(student);
  }

  function resetPicked() {
    setPickedIdx(new Set());
    setSelectedStudent(null);
  }

  const handleReset = () => {
    setSelectedStudent(null);
    setPickHistory([]);
    setIsAnimating(false);
    setPickedIdx(new Set());
    setWinnerPopup(null);
  };

  const winnerPopupNode = winnerPopup ? (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-white/70 backdrop-blur-sm animate-in fade-in duration-300"
      onClick={() => setWinnerPopup(null)}
    >
      <style>{`
        @keyframes winnerPop {
          0%   { transform: scale(0.4) rotate(-8deg); opacity: 0; }
          60%  { transform: scale(1.1) rotate(2deg); opacity: 1; }
          100% { transform: scale(1) rotate(0deg); opacity: 1; }
        }
        @keyframes winnerGlow {
          0%, 100% { text-shadow: 0 0 16px rgba(217,119,6,0.35), 0 0 32px rgba(217,119,6,0.2); }
          50%      { text-shadow: 0 0 24px rgba(217,119,6,0.55), 0 0 48px rgba(217,119,6,0.3); }
        }
        .winner-pop { animation: winnerPop 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); }
        .winner-glow { animation: winnerGlow 1.8s ease-in-out infinite; }
      `}</style>
      <div
        className="winner-pop relative rounded-3xl bg-gradient-to-br from-yellow-300 via-orange-400 to-pink-500 p-2 shadow-2xl max-w-[90vw]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="rounded-[20px] bg-white px-12 py-10 text-center">
          <p className="text-2xl md:text-3xl font-bold text-amber-600 uppercase tracking-[0.3em] mb-4">
            🎉 Chúc mừng 🎉
          </p>
          <p className="winner-glow text-6xl md:text-8xl font-black text-gray-900 break-words leading-tight px-4">
            {winnerPopup.displayName || winnerPopup.name}
          </p>
          <button
            onClick={() => setWinnerPopup(null)}
            className="mt-8 inline-flex items-center gap-2 rounded-full bg-amber-400 hover:bg-amber-300 px-6 py-3 text-base font-bold text-gray-900 shadow-lg transition-transform hover:scale-105 active:scale-95"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  ) : null;

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-[rgb(var(--surface))] flex flex-col p-6 z-50 overflow-y-auto">
        {winnerPopupNode}

        {/* Fullscreen Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Shuffle size={32} className="text-brand-600" strokeWidth={1.5} />
            <h3 className="text-2xl font-bold">Chọn Sinh Viên Ngẫu Nhiên</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="btn-secondary text-sm"
              title="Reset"
            >
              ↺ Reset
            </button>
            <button
              onClick={() => setIsFullscreen(false)}
              className="btn-secondary text-sm"
              title="Exit fullscreen"
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
        </div>

        {/* Fullscreen Content */}
        <div className="flex-1">
          {wheelAvailable && (
            <div className="mb-4 flex flex-wrap items-center gap-4">
              <div className="inline-flex rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-1">
                <button
                  onClick={() => setTemplate("slot")}
                  disabled={isAnimating}
                  className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${template === "slot" ? "bg-brand-600 text-white" : "text-muted hover:text-foreground"}`}
                >
                  🎰 Máy quay
                </button>
                <button
                  onClick={() => setTemplate("wheel")}
                  disabled={isAnimating}
                  className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${template === "wheel" ? "bg-brand-600 text-white" : "text-muted hover:text-foreground"}`}
                >
                  🎡 Vòng quay may mắn
                </button>
              </div>
              <label className="inline-flex items-center gap-2 text-sm font-medium cursor-pointer">
                <input
                  type="checkbox"
                  checked={excludePicked}
                  onChange={(e) => setExcludePicked(e.target.checked)}
                  disabled={isAnimating}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                Loại người đã trúng
              </label>
              {excludePicked && pickedIdx.size > 0 && (
                <span className="text-sm text-muted">
                  Còn <strong className="text-brand-700">{activeIndices.length}</strong> / {studentList!.length}
                  <button
                    onClick={resetPicked}
                    disabled={isAnimating}
                    className="ml-3 text-sm font-semibold text-brand-600 hover:text-brand-700 underline"
                  >
                    Quay lại tất cả
                  </button>
                </span>
              )}
            </div>
          )}

          {template === "wheel" && wheelAvailable ? (
            <div className="rounded-xl bg-gradient-to-br from-brand-50/40 to-brand-100/20 p-8">
              {allPicked ? (
                <div className="text-center py-16">
                  <p className="text-7xl mb-6">🎉</p>
                  <p className="text-2xl font-semibold mb-4">Đã quay hết {studentList!.length} sinh viên</p>
                  <button onClick={resetPicked} className="btn-primary btn-lg mt-6">
                    Quay lại tất cả
                  </button>
                </div>
              ) : (
                <LuckyWheel
                  names={wheelNames}
                  isSpinning={isAnimating}
                  onSpinStart={handleSpinStart}
                  onSpinEnd={handleSpinEnd}
                  size={560}
                />
              )}
            </div>
          ) : allPicked ? (
            <div className="rounded-xl bg-gradient-to-br from-brand-50/40 to-brand-100/20 p-8 text-center py-16">
              <p className="text-7xl mb-6">🎉</p>
              <p className="text-2xl font-semibold mb-4">Đã quay hết {studentList!.length} sinh viên</p>
              <button onClick={resetPicked} className="btn-primary btn-lg mt-6">
                Quay lại tất cả
              </button>
            </div>
          ) : (
            <SlotMachineReel
              names={isStateless ? wheelNames : undefined}
              resolveTarget={isStateless ? undefined : resolveClassroomTarget}
              onSpinStart={handleSpinStart}
              onSpinEnd={isStateless ? handleSpinEnd : handleClassroomSpinEnd}
              height={460}
              idleLabel={isStateless ? "Nhấn Quay để chọn sinh viên" : "Nhấn Quay để bắt đầu"}
            />
          )}

          {pickHistory.length > 0 && (
            <div className="mt-8">
              <p className="text-sm font-semibold uppercase tracking-wide text-muted mb-4">
                Lịch sử chọn
              </p>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pickHistory.map((student, idx) => (
                  <div
                    key={`${student.userId}-${idx}`}
                    className="flex items-center gap-3 rounded-lg border border-token bg-[rgb(var(--surface-muted))] px-4 py-3 text-sm"
                  >
                    <span className="font-semibold text-brand-600 min-w-8">#{idx + 1}</span>
                    <span className="font-medium">{student.displayName}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-brand-200 bg-[rgb(var(--surface))] p-6 shadow-card relative">
      {winnerPopupNode}

      {/* Header with Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Shuffle size={24} className="text-brand-600" strokeWidth={1.5} />
          <h3 className="text-lg font-bold">Chọn Sinh Viên Ngẫu Nhiên</h3>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleReset}
            className="btn-secondary btn-sm text-xs"
            title="Reset"
            disabled={!selectedStudent && pickHistory.length === 0 && !isAnimating}
          >
            ↺ Reset
          </button>
          <button
            onClick={() => setIsFullscreen(true)}
            className="btn-secondary btn-sm text-xs"
            title="Fullscreen"
          >
            ⛶ Full
          </button>
          {onExit && (
            <button
              onClick={onExit}
              className="btn-secondary btn-sm text-xs"
              title="Exit"
            >
              ✕ Exit
            </button>
          )}
        </div>
      </div>

      {/* Template selector + exclude toggle */}
      {wheelAvailable && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-lg border border-token bg-[rgb(var(--surface-muted))] p-1">
            <button
              onClick={() => setTemplate("slot")}
              disabled={isAnimating}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${template === "slot" ? "bg-brand-600 text-white" : "text-muted hover:text-foreground"}`}
            >
              🎰 Máy quay
            </button>
            <button
              onClick={() => setTemplate("wheel")}
              disabled={isAnimating}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${template === "wheel" ? "bg-brand-600 text-white" : "text-muted hover:text-foreground"}`}
            >
              🎡 Vòng quay
            </button>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-medium text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={excludePicked}
              onChange={(e) => setExcludePicked(e.target.checked)}
              disabled={isAnimating}
              className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
            />
            Loại người đã trúng
          </label>
          {excludePicked && pickedIdx.size > 0 && (
            <span className="text-xs text-muted">
              Còn <strong className="text-brand-700">{activeIndices.length}</strong> / {studentList!.length}
              <button
                onClick={resetPicked}
                disabled={isAnimating}
                className="ml-2 text-xs font-semibold text-brand-600 hover:text-brand-700 underline"
              >
                Quay lại tất cả
              </button>
            </span>
          )}
        </div>
      )}

      {/* Wheel template */}
      {template === "wheel" && wheelAvailable ? (
        <div className="mt-2 rounded-xl bg-gradient-to-br from-brand-50/40 to-brand-100/20 p-6">
          {allPicked ? (
            <div className="text-center py-12">
              <p className="text-5xl mb-4">🎉</p>
              <p className="text-lg font-semibold mb-2">Đã quay hết {studentList!.length} sinh viên</p>
              <button onClick={resetPicked} className="btn-primary mt-4">
                Quay lại tất cả
              </button>
            </div>
          ) : (
            <LuckyWheel
              names={wheelNames}
              isSpinning={isAnimating}
              onSpinStart={handleSpinStart}
              onSpinEnd={handleSpinEnd}
              size={420}
            />
          )}
        </div>
      ) : allPicked ? (
        <div className="mt-2 rounded-xl bg-gradient-to-br from-brand-50/40 to-brand-100/20 p-6 text-center py-12">
          <p className="text-5xl mb-4">🎉</p>
          <p className="text-lg font-semibold mb-2">Đã quay hết {studentList!.length} sinh viên</p>
          <button onClick={resetPicked} className="btn-primary mt-4">
            Quay lại tất cả
          </button>
        </div>
      ) : (
        <div className="mt-6">
          <SlotMachineReel
            names={isStateless ? wheelNames : undefined}
            resolveTarget={isStateless ? undefined : resolveClassroomTarget}
            onSpinStart={handleSpinStart}
            onSpinEnd={isStateless ? handleSpinEnd : handleClassroomSpinEnd}
            height={320}
            idleLabel={isStateless ? "Nhấn Quay để chọn sinh viên" : "Nhấn Quay để bắt đầu"}
          />
        </div>
      )}

      {/* History */}
      {pickHistory.length > 0 && (
        <div className="mt-8">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            Lịch sử chọn
          </p>
          <div className="mt-3 space-y-2">
            {pickHistory.map((student, idx) => (
              <div
                key={`${student.userId}-${idx}`}
                className="flex items-center gap-3 rounded-lg border border-token bg-[rgb(var(--surface-muted))] px-3 py-2 text-sm"
              >
                <span className="text-xs font-semibold text-faint">#{idx + 1}</span>
                <span className="text-sm font-medium">{student.displayName}</span>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
