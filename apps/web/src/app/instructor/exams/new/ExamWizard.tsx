"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ModuleNode } from "./components/LessonTree";
import { useWizardState } from "./useWizardState";
import Step1Content from "./steps/Step1Content";
import Step2Config from "./steps/Step2Config";
import Step3Distribution from "./steps/Step3Distribution";
import NewExamForm from "./NewExamForm";

interface Course { id: string; title: string; slug: string }

interface Props {
  courses: Course[];
  initialCourseId: string;
  lessonTree: ModuleNode[];
  showUpgradeBanner: boolean;
  initialExpertMode: boolean;
}

const STEP_LABELS = ["Nội dung", "Cấu hình", "Phát đề"];

export default function ExamWizard({ courses, initialCourseId, lessonTree, showUpgradeBanner, initialExpertMode }: Props) {
  const router = useRouter();
  const [expertMode, setExpertMode] = useState(initialExpertMode);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { state, dispatch } = useWizardState(initialCourseId);

  async function toggleExpertMode(enabled: boolean) {
    setExpertMode(enabled);
    // Fire-and-forget — persist to DB so the preference survives page reload.
    fetch("/api/users/me/expert-mode", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled }),
    }).catch(() => undefined);
  }

  // ── Header ──────────────────────────────────────────────────────────────
  const header = (
    <div className="mb-6">
      {showUpgradeBanner && !expertMode && (
        <div className="mb-4 flex items-center justify-between rounded border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm">
          <span className="text-blue-800">
            Bạn đã tạo nhiều đề. Bật <strong>chế độ Nâng cao</strong> để xem chỉ số chất lượng câu hỏi chi tiết?
          </span>
          <div className="flex gap-3">
            <button onClick={() => toggleExpertMode(true)} className="font-medium text-blue-700 hover:underline">
              Bật ngay
            </button>
            <button onClick={() => {}} className="text-faint hover:underline">Bỏ qua</button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tạo đề thi mới</h1>
          <div className="mt-1 flex items-center gap-2">
            <label className="text-sm text-faint">Khoá học:</label>
            <select
              value={state.courseId}
              onChange={(e) => dispatch({ type: "SET_COURSE", courseId: e.target.value })}
              className="rounded border border-default px-2 py-1 text-sm"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Mode toggle */}
        <div className="flex overflow-hidden rounded border border-default text-sm">
          <button
            onClick={() => toggleExpertMode(false)}
            className={`px-3 py-1.5 ${!expertMode ? "bg-blue-600 text-white" : "hover:bg-surface"}`}
          >
            Cơ bản
          </button>
          <button
            onClick={() => toggleExpertMode(true)}
            className={`px-3 py-1.5 ${expertMode ? "bg-blue-600 text-white" : "hover:bg-surface"}`}
          >
            Nâng cao
          </button>
        </div>
      </div>

      {/* Tên đề + step dots (only in basic mode) */}
      {!expertMode && (
        <>
          <div className="mt-4">
            <input
              type="text"
              placeholder="Tên đề thi *"
              value={state.title}
              onChange={(e) => dispatch({ type: "SET_TITLE", title: e.target.value })}
              className="w-full rounded border border-default px-3 py-2 text-sm"
            />
          </div>
          <div className="mt-4 flex items-center gap-2">
            {STEP_LABELS.map((label, i) => {
              const stepNum = (i + 1) as 1 | 2 | 3;
              const active = state.step === stepNum;
              const done = state.step > stepNum;
              return (
                <div key={stepNum} className="flex items-center gap-2">
                  <button
                    onClick={() => done && dispatch({ type: "SET_STEP", step: stepNum })}
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      active ? "bg-blue-600 text-white"
                      : done ? "cursor-pointer bg-blue-100 text-blue-700 hover:bg-blue-200"
                      : "bg-default text-faint"
                    }`}
                  >
                    {done ? "✓" : stepNum}
                  </button>
                  <span className={`text-xs ${active ? "font-medium" : "text-faint"}`}>{label}</span>
                  {i < 2 && <span className="text-default">─</span>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );

  // ── Nâng cao: delegate to existing full editor ───────────────────────────
  if (expertMode) {
    return (
      <div>
        {header}
        <NewExamForm courses={courses} initialCourseId={state.courseId} />
      </div>
    );
  }

  // ── Submit ───────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (!state.title.trim()) {
      setError("Vui lòng nhập tên đề thi");
      dispatch({ type: "SET_STEP", step: 1 });
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/courses/${state.courseId}/exams`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: state.title,
          durationMin: state.durationMin,
          openAt: new Date(state.openAt).toISOString(),
          closeAt: new Date(state.closeAt).toISOString(),
          showResultsAfterSubmit: state.showResultsAfterSubmit,
          wizardConfig: {
            lessonIds: state.selectedLessonIds,
            questionCount: state.questionCount,
            bloomMix: state.bloomMix,
            difficultyProfile: state.difficultyProfile,
            distributionMode: state.distributionMode,
            sessionCount: state.distributionMode === "multi_session" ? state.sessionCount : undefined,
            autoEquating: state.autoEquating,
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as { error?: string }).error ?? "Tạo đề thất bại");
        return;
      }
      const { examId, fallbackUsed } = await res.json();
      // Clear session storage so next wizard starts fresh
      sessionStorage.removeItem("examWizardState");
      router.push(
        `/instructor/courses/${state.courseId}/exams/${examId}?created=1${fallbackUsed ? "&fallback=1" : ""}`,
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── Steps ────────────────────────────────────────────────────────────────
  const dispatch2 = dispatch as Parameters<typeof Step1Content>[0]["dispatch"];

  return (
    <div>
      {header}
      {error && (
        <div className="mb-4 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      <div className="rounded border border-default bg-white p-6">
        {state.step === 1 && (
          <Step1Content
            state={state}
            dispatch={dispatch2}
            lessonTree={lessonTree}
            onNext={() => dispatch({ type: "SET_STEP", step: 2 })}
          />
        )}
        {state.step === 2 && (
          <Step2Config
            state={state}
            dispatch={dispatch2}
            onBack={() => dispatch({ type: "SET_STEP", step: 1 })}
            onNext={() => dispatch({ type: "SET_STEP", step: 3 })}
          />
        )}
        {state.step === 3 && (
          <Step3Distribution
            state={state}
            dispatch={dispatch2}
            onBack={() => dispatch({ type: "SET_STEP", step: 2 })}
            onSubmit={handleSubmit}
            submitting={submitting}
          />
        )}
      </div>
    </div>
  );
}
