"use client";

import { getClientId } from "@/lib/clientId";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";

interface Poll {
  id: string;
  question: string;
  options: string[];
  isAnonymous: boolean;
  session: {
    lesson: {
      title: string;
      module: { course: { title: string } };
    } | null;
  };
}

interface PollResults {
  id: string;
  question: string;
  options: string[];
  totalVotes: number;
  votesByOption: Record<string, number>;
}

// Cùng bảng chữ cái + màu với ô đáp án phía giáo viên (PresentDeck) — học
// viên nhìn màn chiếu thấy "B" thì bấm "B" trên máy mình, không cần đọc lại
// nguyên câu trả lời.
const LETTERS = ["A", "B", "C", "D", "E", "F"];
const LETTER_COLORS = [
  "bg-red-500",
  "bg-blue-500",
  "bg-amber-500",
  "bg-purple-500",
  "bg-teal-500",
  "bg-pink-500",
];

export default function PollVotingPage({ poll }: { poll: Poll }) {
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<PollResults | null>(null);

  const handleVote = async (choice?: number) => {
    const idx = choice ?? selectedChoice;
    if (idx === null) {
      toast.error("Vui lòng chọn một câu trả lời");
      return;
    }
    setSelectedChoice(idx);

    setIsLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/classroom/quick-poll/${poll.id}/vote`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice: idx.toString(), clientId: getClientId() }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Lỗi bình chọn");
        return;
      }

      setHasVoted(true);

      const resultsRes = await fetch(apiUrl(`/api/classroom/quick-poll/${poll.id}/results`));
      if (resultsRes.ok) {
        setResults(await resultsRes.json());
      }
    } catch (err) {
      console.error("[PollVotingPage vote]", err);
      toast.error("Lỗi mạng");
    } finally {
      setIsLoading(false);
    }
  };

  const maxVotes = results ? Math.max(...Object.values(results.votesByOption), 1) : 1;

  return (
    <div className="space-y-6">
      <h2 className="text-center text-xl font-bold text-brand-900">{poll.question}</h2>

      {!hasVoted ? (
        <div className="space-y-3">
          {poll.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => handleVote(idx)}
              disabled={isLoading}
              className={`flex w-full items-center gap-3 rounded-2xl border-[1.5px] p-4 text-left transition active:scale-[0.98] disabled:opacity-60 ${
                selectedChoice === idx
                  ? "border-brand-500 bg-brand-50 shadow-[0_0_0_3px_rgb(163,230,53,0.35)]"
                  : "border-token hover:border-brand-300 hover:bg-brand-50/50"
              }`}
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-extrabold text-white shadow-sm ${LETTER_COLORS[idx % LETTER_COLORS.length]}`}
              >
                {LETTERS[idx % LETTERS.length]}
              </span>
              <span className="flex-1 text-base font-semibold">{option}</span>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex flex-col items-center gap-2 py-2">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-brand-glow animate-[note-pop-in_0.4s_ease-out]">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M4 12l5 5L20 6" />
              </svg>
            </div>
            <p className="text-sm font-bold text-brand-700">Đã ghi nhận câu trả lời của bạn!</p>
          </div>

          {results && (
            <div className="space-y-3">
              <p className="text-center text-xs font-bold uppercase tracking-wide text-muted">
                Kết quả trực tiếp
              </p>
              {results.options.map((option, idx) => {
                const voteCount = results.votesByOption[idx] || 0;
                const percentage = results.totalVotes > 0 ? Math.round((voteCount / results.totalVotes) * 100) : 0;
                const barWidth = maxVotes > 0 ? (voteCount / maxVotes) * 100 : 0;
                const isMine = selectedChoice === idx;
                return (
                  <div key={idx}>
                    <div className="mb-1 flex items-center gap-2">
                      <span
                        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-extrabold text-white ${LETTER_COLORS[idx % LETTER_COLORS.length]}`}
                      >
                        {LETTERS[idx % LETTERS.length]}
                      </span>
                      <span className={`flex-1 truncate text-sm ${isMine ? "font-bold text-brand-800" : "font-medium"}`}>
                        {option} {isMine && "· bạn"}
                      </span>
                      <span className="text-xs text-muted">
                        {voteCount} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-6 overflow-hidden rounded-lg bg-[rgb(var(--surface-muted))]">
                      <div
                        className="h-full rounded-lg bg-brand-gradient transition-all duration-500"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
              <p className="pt-1 text-center text-xs text-muted">
                Tổng cộng: <span className="font-semibold">{results.totalVotes}</span> phiếu
              </p>
            </div>
          )}
        </div>
      )}

      {poll.isAnonymous && !hasVoted && (
        <p className="text-center text-xs text-muted">🔒 Bình chọn này là ẩn danh</p>
      )}
    </div>
  );
}
