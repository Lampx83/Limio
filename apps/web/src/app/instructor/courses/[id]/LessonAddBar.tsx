"use client";

import { useEffect, useRef, useState } from "react";
import AddContentItemForm from "./AddContentItemForm";
import AddQuizForm from "./AddQuizForm";
import AddAssignmentForm from "./AddAssignmentForm";

type Mode = "content" | "quiz" | "assignment" | null;

interface PillProps {
  mode: Mode;
  current: Mode;
  setMode: (m: Mode) => void;
  value: Exclude<Mode, null>;
  label: string;
  icon: string;
}

function Pill({ mode, current, setMode, value, label, icon }: PillProps) {
  const active = current === value;
  return (
    <button
      type="button"
      onClick={() => setMode(active ? null : value)}
      className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-brand-600 text-white shadow-sm"
          : "bg-[rgb(var(--surface-muted))] text-default hover:bg-brand-soft hover:text-brand-700"
      }`}
    >
      <span aria-hidden>{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export default function LessonAddBar({
  lessonId,
  nextContentOrderIndex,
}: {
  lessonId: string;
  nextContentOrderIndex: number;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOpen(e: Event) {
      const detail = (e as CustomEvent).detail as { mode?: Mode } | undefined;
      if (detail?.mode) {
        setMode(detail.mode);
        ref.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
    window.addEventListener("lesson-add:open", onOpen);
    return () => window.removeEventListener("lesson-add:open", onOpen);
  }, []);

  return (
    <div
      ref={ref}
      className="rounded-xl border border-token bg-[rgb(var(--surface-muted))/0.4] p-3"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-faint">
          Thêm
        </span>
        <Pill
          mode={mode}
          current={mode}
          setMode={setMode}
          value="content"
          label="Nội dung"
          icon="📄"
        />
        <Pill
          mode={mode}
          current={mode}
          setMode={setMode}
          value="quiz"
          label="Quiz"
          icon="❓"
        />
        <Pill
          mode={mode}
          current={mode}
          setMode={setMode}
          value="assignment"
          label="Assignment"
          icon="📝"
        />
      </div>

      {mode && (
        <div className="mt-3">
          {mode === "content" && (
            <AddContentItemForm
              key="content"
              lessonId={lessonId}
              nextOrderIndex={nextContentOrderIndex}
              embedded
              onCancel={() => setMode(null)}
            />
          )}
          {mode === "quiz" && (
            <AddQuizForm
              key="quiz"
              lessonId={lessonId}
              embedded
              onCancel={() => setMode(null)}
            />
          )}
          {mode === "assignment" && (
            <AddAssignmentForm
              key="assignment"
              lessonId={lessonId}
              embedded
              onCancel={() => setMode(null)}
            />
          )}
        </div>
      )}
    </div>
  );
}
