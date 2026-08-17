"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";
import { TEAM_COUNT_MAX, TEAM_COUNT_MIN, TEAM_PRESETS } from "@/lib/gameshow/teams";

type QuizOption = {
  id: string;
  title: string;
  courseTitle: string;
  questionCount: number;
};

type QuestionSetOption = {
  id: string;
  title: string;
  questionCount: number;
};

type SourceTab = "quiz" | "question-set";

export default function NewGameshowClient({
  quizzes,
  questionSets,
}: {
  quizzes: QuizOption[];
  questionSets: QuestionSetOption[];
}) {
  const router = useRouter();
  const [tab, setTab] = useState<SourceTab>(questionSets.length > 0 ? "question-set" : "quiz");
  const [selectedQuiz, setSelectedQuiz] = useState<string>(quizzes[0]?.id ?? "");
  const [selectedSet, setSelectedSet] = useState<string>(questionSets[0]?.id ?? "");
  const [teamMode, setTeamMode] = useState(false);
  const [teamCount, setTeamCount] = useState(4);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const selected = tab === "quiz" ? selectedQuiz : selectedSet;

  const onCreate = async () => {
    if (!selected) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(apiUrl("/api/gameshow/sessions/create"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(tab === "quiz" ? { quizId: selectedQuiz } : { questionSetId: selectedSet }),
          ...(teamMode ? { teamCount } : {}),
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      const j = (await r.json()) as { id: string };
      router.push(`/instructor/gameshow/${j.id}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-6">
      <div className="flex gap-2 border-b border-default">
        <button
          onClick={() => setTab("question-set")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "question-set"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-faint hover:text-slate-700"
          }`}
        >
          Bộ câu hỏi tự soạn
        </button>
        <button
          onClick={() => setTab("quiz")}
          className={`px-4 py-2 text-sm font-medium ${
            tab === "quiz"
              ? "border-b-2 border-blue-600 text-blue-600"
              : "text-faint hover:text-slate-700"
          }`}
        >
          Quiz có sẵn
        </button>
      </div>

      <div className="mt-4 space-y-4">
        {tab === "question-set" ? (
          questionSets.length === 0 ? (
            <div className="rounded border border-dashed border-default p-6 text-center text-sm text-faint">
              Chưa có bộ câu hỏi nào.{" "}
              <Link href="/instructor/gameshow/question-sets/new" className="text-blue-600 underline">
                Soạn bộ mới
              </Link>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {questionSets.map((s) => (
                  <label
                    key={s.id}
                    className={`flex cursor-pointer items-center justify-between rounded border p-3 ${
                      selectedSet === s.id ? "border-blue-500 bg-blue-50" : "border-default bg-white"
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-medium">{s.title}</span>
                      <span className="block text-xs text-faint">{s.questionCount} câu hỏi</span>
                    </span>
                    <input
                      type="radio"
                      name="question-set"
                      checked={selectedSet === s.id}
                      onChange={() => setSelectedSet(s.id)}
                    />
                  </label>
                ))}
              </div>
              <Link
                href="/instructor/gameshow/question-sets/new"
                className="block text-xs text-blue-600 hover:underline"
              >
                + Soạn bộ câu hỏi mới
              </Link>
            </>
          )
        ) : quizzes.length === 0 ? (
          <div className="rounded border border-dashed border-default p-6 text-center text-sm text-faint">
            Chưa có quiz nào có câu trắc nghiệm/đúng-sai. Tạo quiz với ít nhất 1 câu loại này trước.
          </div>
        ) : (
          <div className="space-y-2">
            {quizzes.map((q) => (
              <label
                key={q.id}
                className={`flex cursor-pointer items-center justify-between rounded border p-3 ${
                  selectedQuiz === q.id ? "border-blue-500 bg-blue-50" : "border-default bg-white"
                }`}
              >
                <span>
                  <span className="block text-sm font-medium">{q.title}</span>
                  <span className="block text-xs text-faint">
                    {q.courseTitle} · {q.questionCount} câu hỏi
                  </span>
                </span>
                <input
                  type="radio"
                  name="quiz"
                  checked={selectedQuiz === q.id}
                  onChange={() => setSelectedQuiz(q.id)}
                />
              </label>
            ))}
          </div>
        )}

        <div className="rounded border border-default bg-white p-3">
          <label className="flex cursor-pointer items-center justify-between">
            <span>
              <span className="block text-sm font-medium">👥 Chơi theo nhóm</span>
              <span className="block text-xs text-faint">
                Học viên tự chọn đội lúc vào phòng, xếp hạng &amp; podium tính theo đội.
              </span>
            </span>
            <input
              type="checkbox"
              checked={teamMode}
              onChange={(e) => setTeamMode(e.target.checked)}
              className="h-5 w-5"
            />
          </label>

          {teamMode && (
            <div className="mt-3 flex items-center gap-3 border-t border-default pt-3">
              <label htmlFor="team-count" className="text-xs font-medium text-slate-600">
                Số đội
              </label>
              <input
                id="team-count"
                type="range"
                min={TEAM_COUNT_MIN}
                max={TEAM_COUNT_MAX}
                value={teamCount}
                onChange={(e) => setTeamCount(Number(e.target.value))}
                className="flex-1"
              />
              <span className="w-6 text-center text-sm font-semibold">{teamCount}</span>
              <span className="text-lg">{TEAM_PRESETS[teamCount - 1]?.emoji}</span>
            </div>
          )}
        </div>

        {err && (
          <div className="rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-800">
            ⚠ {err}
          </div>
        )}

        <button
          onClick={onCreate}
          disabled={busy || !selected}
          className="w-full rounded bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Đang tạo..." : "🚀 Tạo phiên"}
        </button>
      </div>
    </div>
  );
}
