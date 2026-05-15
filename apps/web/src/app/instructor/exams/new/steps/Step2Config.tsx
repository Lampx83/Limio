"use client";

import type { Dispatch } from "react";
import type { WizardState, DifficultyProfile } from "../useWizardState";
import BloomSlider from "../components/BloomSlider";
import PoolPreviewBar from "../components/PoolPreviewBar";

const QUESTION_COUNTS = [15, 25, 50] as const;

const DIFFICULTY_OPTIONS: { value: DifficultyProfile; label: string; hint: string }[] = [
  { value: "basic",     label: "Kiểm tra kiến thức cơ bản", hint: "Đề dễ hơn" },
  { value: "balanced",  label: "Đánh giá toàn diện",        hint: "Đề cân đối — mặc định" },
  { value: "challenge", label: "Thử thách học sinh giỏi",   hint: "Đề khó hơn" },
  { value: "adaptive_to_class", label: "Tự cân đối theo lớp",
    hint: "Hệ thống xem học lực trung bình của lớp và tự chọn độ khó vừa sức" },
];

interface Props {
  state: WizardState;
  dispatch: Dispatch<{ type: string; [k: string]: unknown }>;
  onBack: () => void;
  onNext: () => void;
}

export default function Step2Config({ state, dispatch, onBack, onNext }: Props) {
  const suggestedTime = state.questionCount * 2; // ~2 min/question

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Bước 2/3 — Cấu hình đề</h2>
        <p className="mt-1 text-sm text-faint">Chọn số câu, mức độ và tỉ lệ tư duy.</p>
      </div>

      {/* Question count */}
      <div>
        <label className="block text-sm font-medium mb-2">Số câu hỏi</label>
        <div className="flex flex-wrap gap-2">
          {QUESTION_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => dispatch({ type: "SET_QUESTION_COUNT", questionCount: n })}
              className={`rounded border px-4 py-1.5 text-sm font-medium transition-colors ${
                state.questionCount === n
                  ? "border-blue-600 bg-blue-50 text-blue-700"
                  : "border-default hover:bg-surface"
              }`}
            >
              {n} câu
            </button>
          ))}
          <div className="flex items-center gap-1">
            <input
              type="number"
              min={5} max={200}
              value={QUESTION_COUNTS.includes(state.questionCount as typeof QUESTION_COUNTS[number]) ? "" : state.questionCount}
              placeholder="Tự nhập"
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                if (v >= 5 && v <= 200) dispatch({ type: "SET_QUESTION_COUNT", questionCount: v });
              }}
              className="w-24 rounded border border-default px-2 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>

      {/* Duration */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Thời gian làm bài</label>
        <input
          type="number" min={10} max={360}
          value={state.durationMin}
          onChange={(e) => dispatch({ type: "SET_DURATION", durationMin: parseInt(e.target.value, 10) || 45 })}
          className="w-20 rounded border border-default px-2 py-1.5 text-sm"
        />
        <span className="text-sm text-faint">phút</span>
        {state.durationMin !== suggestedTime && (
          <button
            type="button"
            onClick={() => dispatch({ type: "SET_DURATION", durationMin: suggestedTime })}
            className="text-xs text-blue-600 hover:underline"
          >
            Dùng gợi ý ({suggestedTime} phút)
          </button>
        )}
      </div>

      {/* Difficulty profile */}
      <div>
        <label className="block text-sm font-medium mb-2">Đề này dành cho</label>
        <div className="space-y-2">
          {DIFFICULTY_OPTIONS.map((opt) => (
            <label key={opt.value} className="flex cursor-pointer items-start gap-3 rounded border border-default p-3 hover:bg-surface">
              <input
                type="radio"
                name="difficultyProfile"
                value={opt.value}
                checked={state.difficultyProfile === opt.value}
                onChange={() => dispatch({ type: "SET_DIFFICULTY_PROFILE", difficultyProfile: opt.value })}
                className="mt-0.5 accent-blue-600"
              />
              <div>
                <span className="text-sm font-medium">{opt.label}</span>
                <span className="ml-2 text-xs text-faint">({opt.hint})</span>
              </div>
            </label>
          ))}
        </div>
      </div>

      {/* Bloom mix */}
      <div>
        <label className="block text-sm font-medium mb-3">Tỉ lệ mức tư duy</label>
        <BloomSlider
          value={state.bloomMix}
          onChange={(next) => dispatch({ type: "SET_BLOOM_MIX", bloomMix: next })}
        />
      </div>

      {/* Pool availability preview */}
      <PoolPreviewBar
        courseId={state.courseId}
        lessonIds={state.selectedLessonIds}
        questionCount={state.questionCount}
        bloomMix={state.bloomMix}
        difficultyProfile={state.difficultyProfile}
      />

      <div className="flex justify-between pt-2">
        <button type="button" onClick={onBack} className="text-sm text-faint hover:text-default">
          ← Quay lại
        </button>
        <button
          type="button"
          onClick={onNext}
          className="rounded bg-blue-600 px-5 py-2 text-sm font-medium text-white"
        >
          Tiếp theo →
        </button>
      </div>
    </div>
  );
}
