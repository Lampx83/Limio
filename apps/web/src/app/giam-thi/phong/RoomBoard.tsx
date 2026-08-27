"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Circle } from "lucide-react";
import type { ProctorRoomView } from "@feedbackme/core-lms";
import { apiUrl } from "@/lib/apiUrl";

const STATUS: Record<string, { label: string; tone: string }> = {
  in_progress: { label: "Đang làm", tone: "text-blue-700" },
  submitted: { label: "Đã nộp", tone: "text-emerald-700" },
  auto_submitted: { label: "Hết giờ", tone: "text-amber-700" },
  graded: { label: "Đã nộp", tone: "text-emerald-700" },
  flagged: { label: "Bị gắn cờ", tone: "text-red-700" },
};

export default function RoomBoard({ view }: { view: ProctorRoomView }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);

  const toggle = async (candidateId: string, present: boolean) => {
    setBusyId(candidateId);
    try {
      await fetch(apiUrl("/api/public/proctor/attendance"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ candidateId, present }),
      });
      startTransition(() => router.refresh());
    } finally {
      setBusyId(null);
    }
  };

  const arrived = view.candidates.filter((c) => c.arrivedAt).length;
  const started = view.candidates.filter((c) => c.attemptStatus).length;
  const done = view.candidates.filter(
    (c) => c.attemptStatus && c.attemptStatus !== "in_progress",
  ).length;

  return (
    <div>
      <div className="grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-default bg-default">
        <Stat label="có mặt" value={`${arrived}/${view.candidates.length}`} />
        <Stat label="đã vào thi" value={`${started}`} />
        <Stat label="đã nộp" value={`${done}`} />
      </div>

      <ul className="mt-4 divide-y divide-slate-100 rounded-lg border border-default bg-white">
        {view.candidates.map((c) => {
          const st = c.attemptStatus ? STATUS[c.attemptStatus] : null;
          const present = c.arrivedAt !== null;
          return (
            <li key={c.candidateId} className="flex items-center gap-3 px-3 py-2.5">
              {/* Điểm danh là việc lặp lại vài chục lần đầu giờ — để nút to,
                  bấm được bằng ngón cái, không phải một ô tick tí hon. */}
              <button
                type="button"
                onClick={() => toggle(c.candidateId, !present)}
                disabled={busyId === c.candidateId || pending}
                aria-pressed={present}
                aria-label={`Điểm danh ${c.displayName}`}
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition-colors disabled:opacity-50 ${
                  present
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-slate-300 bg-white text-slate-300 hover:border-slate-400"
                }`}
              >
                {present ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium">{c.displayName}</div>
                {c.accessCode && (
                  <div className="font-mono text-caption text-faint">
                    {c.accessCode}
                  </div>
                )}
              </div>

              <div className="shrink-0 text-right">
                {st ? (
                  <>
                    <div className={`text-sm font-medium ${st.tone}`}>
                      {st.label}
                    </div>
                    {c.attemptStatus === "in_progress" && (
                      <div className="text-caption text-faint tabular-nums">
                        {c.answered}/{view.totalQuestions} câu
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-sm text-faint">Chưa vào</div>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {view.candidates.length === 0 && (
        <p className="mt-4 rounded-lg border border-dashed border-default px-4 py-8 text-center text-sm text-faint">
          Phòng này chưa có thí sinh nào. Người vào bằng mã chung sẽ tự hiện ở
          đây khi họ bắt đầu.
        </p>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-3 py-2.5 text-center">
      <div className="text-lg font-semibold tabular-nums">{value}</div>
      <div className="text-caption text-faint">{label}</div>
    </div>
  );
}
