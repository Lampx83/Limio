"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Dice6 } from "lucide-react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";

const Confetti = dynamic(() => import("react-confetti"), { ssr: false });

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
  const [isLoading, setIsLoading] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [pickHistory, setPickHistory] = useState<Student[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const confettiTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isStateless = !!studentList && !lessonId;

  const playLotterySound = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const now = audioContext.currentTime;

      // Create a series of beeps that sound like lottery
      for (let i = 0; i < 5; i++) {
        const osc = audioContext.createOscillator();
        const gainNode = audioContext.createGain();

        osc.connect(gainNode);
        gainNode.connect(audioContext.destination);

        // Ascending frequency pattern for lottery effect
        const freq = 400 + i * 150;
        osc.frequency.setValueAtTime(freq, now + i * 0.15);

        gainNode.gain.setValueAtTime(0.3, now + i * 0.15);
        gainNode.gain.exponentialRampToValueAtTime(0.01, now + i * 0.15 + 0.1);

        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.1);
      }
    } catch (err) {
      console.log("Audio playback not supported or blocked");
    }
  };

  const handleReset = () => {
    setSelectedStudent(null);
    setPickHistory([]);
    setIsAnimating(false);
    setShowConfetti(false);
    if (confettiTimeoutRef.current) {
      clearTimeout(confettiTimeoutRef.current);
    }
  };

  async function pickStudent() {
    if (isLoading || isAnimating) return;

    setIsLoading(true);
    setIsAnimating(true);

    try {
      let pickedStudent: Student;

      if (isStateless && studentList) {
        // Client-side mode: pick from studentList
        if (studentList.length === 0) {
          toast.error("Danh sách sinh viên trống");
          setIsLoading(false);
          setIsAnimating(false);
          return;
        }

        const randomIndex = Math.floor(Math.random() * studentList.length);
        const picked = studentList[randomIndex]!;

        pickedStudent = {
          displayName: picked.name,
          userId: picked.id || undefined,
          name: picked.name,
        };
      } else {
        // Classroom mode: call API
        if (!lessonId) {
          toast.error("Lesson ID is required");
          setIsLoading(false);
          setIsAnimating(false);
          return;
        }

        const res = await fetch(apiUrl("/api/classroom/random-pick"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lessonId }),
        });

        if (!res.ok) {
          const error = await res.json();
          toast.error(error.error || "Failed to pick student");
          setIsLoading(false);
          setIsAnimating(false);
          return;
        }

        const data = await res.json();
        pickedStudent = {
          userId: data.userId,
          displayName: data.displayName,
        };
      }

      // Play lottery sound during animation
      playLotterySound();

      // Wait 5 seconds for animation, then reveal
      await new Promise((resolve) => setTimeout(resolve, 5000));

      setSelectedStudent(pickedStudent);
      setShowConfetti(true);

      setPickHistory((prev) => [
        pickedStudent,
        ...prev.slice(0, 9),
      ]);

      // Auto-hide confetti after 3 seconds
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
      confettiTimeoutRef.current = setTimeout(() => {
        setShowConfetti(false);
      }, 3000);
    } catch (err) {
      console.error("[RandomPicker]", err);
      toast.error("Network error");
    } finally {
      setIsLoading(false);
      setIsAnimating(false);
    }
  }

  useEffect(() => {
    return () => {
      if (confettiTimeoutRef.current) {
        clearTimeout(confettiTimeoutRef.current);
      }
    };
  }, []);

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-[rgb(var(--surface))] flex flex-col p-6 z-50 overflow-y-auto">
        {showConfetti && <Confetti recycle={false} numberOfPieces={200} />}

        {/* Fullscreen Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Dice6 size={32} className="text-brand-600" strokeWidth={1.5} />
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
          {isAnimating ? (
            <div className="rounded-xl bg-gradient-to-r from-brand-50 to-brand-100/50 p-12 text-center flex flex-col items-center justify-center gap-8">
              <style>{`
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
                .spinner {
                  animation: spin 1s linear infinite;
                }
              `}</style>
              <p className="text-sm text-muted">Đang quay sổ số...</p>
              <div className="spinner text-7xl">🎲</div>
            </div>
          ) : selectedStudent ? (
            <div className="rounded-xl bg-gradient-to-r from-brand-50 to-brand-100/50 p-12 text-center">
              <p className="text-sm text-muted">Được chọn</p>
              <p className="mt-4 text-5xl font-bold text-brand-700">
                {selectedStudent.displayName || selectedStudent.name}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed border-token bg-[rgb(var(--surface-muted))] p-12 text-center">
              <p className="text-muted text-lg">Chưa có ai được chọn</p>
            </div>
          )}

          <button
            onClick={pickStudent}
            disabled={isLoading || isAnimating}
            className="btn-primary btn-lg mt-8 w-full"
          >
            {isLoading || isAnimating ? "Đang chọn..." : "Chọn Sinh Viên"}
          </button>

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
      {showConfetti && <Confetti recycle={false} numberOfPieces={150} />}

      {/* Header with Controls */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Dice6 size={24} className="text-brand-600" strokeWidth={1.5} />
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

      {/* Selected Student Display */}
      <div className="mt-6">
        {isAnimating ? (
          <div className="rounded-xl bg-gradient-to-r from-brand-50 to-brand-100/50 p-8 text-center flex flex-col items-center justify-center gap-6">
            <style>{`
              @keyframes spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
              }
              .spinner {
                animation: spin 1s linear infinite;
              }
            `}</style>
            <p className="text-sm text-muted">Đang quay sổ số...</p>
            <div className="spinner text-6xl">🎲</div>
          </div>
        ) : selectedStudent ? (
          <div className="rounded-xl bg-gradient-to-r from-brand-50 to-brand-100/50 p-8 text-center">
            <p className="text-sm text-muted">Được chọn</p>
            <p className="mt-2 text-4xl font-bold text-brand-700">
              {selectedStudent.displayName || selectedStudent.name}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed border-token bg-[rgb(var(--surface-muted))] p-8 text-center">
            <p className="text-muted">Chưa có ai được chọn</p>
          </div>
        )}
      </div>

      {/* Pick Button */}
      <button
        onClick={pickStudent}
        disabled={isLoading || isAnimating}
        className="btn-primary btn-lg mt-6 w-full"
      >
        {isLoading || isAnimating ? "Đang chọn..." : "Chọn Sinh Viên"}
      </button>

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
