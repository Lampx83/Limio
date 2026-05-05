"use client";

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

export default function PollVotingPage({ poll }: { poll: Poll }) {
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<PollResults | null>(null);

  const handleVote = async () => {
    if (selectedChoice === null) {
      toast.error("Vui lòng chọn một câu trả lời");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/classroom/quick-poll/${poll.id}/vote`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ choice: selectedChoice.toString() }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Lỗi bình chọn");
        return;
      }

      setHasVoted(true);
      toast.success("Bình chọn thành công!");

      // Fetch results
      const resultsRes = await fetch(
        `/api/classroom/quick-poll/${poll.id}/results`
      );
      if (resultsRes.ok) {
        const data = await resultsRes.json();
        setResults(data);
      }
    } catch (err) {
      console.error("[PollVotingPage vote]", err);
      toast.error("Lỗi mạng");
    } finally {
      setIsLoading(false);
    }
  };

  const maxVotes = results
    ? Math.max(...Object.values(results.votesByOption), 1)
    : 1;

  return (
    <div className="space-y-6">
      {/* Question */}
      <div>
        <h2 className="text-xl font-bold text-center text-brand-900">
          {poll.question}
        </h2>
      </div>

      {!hasVoted ? (
        <div className="space-y-3">
          {/* Options */}
          {poll.options.map((option, idx) => (
            <label
              key={idx}
              className="flex items-center gap-3 p-4 rounded-lg border-2 border-token cursor-pointer hover:bg-brand-50 transition-colors"
            >
              <input
                type="radio"
                name="poll-option"
                value={idx}
                checked={selectedChoice === idx}
                onChange={(e) => setSelectedChoice(parseInt(e.target.value))}
                className="w-5 h-5"
              />
              <span className="flex-1 font-medium text-sm">{option}</span>
            </label>
          ))}

          {/* Vote Button */}
          <button
            onClick={handleVote}
            disabled={isLoading || selectedChoice === null}
            className="btn-primary w-full mt-4"
          >
            {isLoading ? "Đang gửi..." : "Bình chọn"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-center text-sm text-muted font-semibold">
            ✓ Cảm ơn bạn đã bình chọn!
          </p>

          {/* Results */}
          {results && (
            <div className="space-y-3 mt-6">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide">
                Kết quả hiện tại
              </p>
              {results.options.map((option, idx) => {
                const voteCount = results.votesByOption[idx] || 0;
                const percentage =
                  results.totalVotes > 0
                    ? Math.round((voteCount / results.totalVotes) * 100)
                    : 0;
                const barWidth =
                  maxVotes > 0 ? (voteCount / maxVotes) * 100 : 0;

                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{option}</span>
                      <span className="text-xs text-muted">
                        {voteCount} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-6 bg-gray-200 rounded-lg overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-brand-400 to-brand-500 transition-all"
                        style={{ width: `${barWidth}%` }}
                      ></div>
                    </div>
                  </div>
                );
              })}

              <p className="text-xs text-center text-muted mt-4">
                Tổng cộng: <span className="font-semibold">{results.totalVotes}</span> phiếu
              </p>
            </div>
          )}
        </div>
      )}

      {/* Anonymous Note */}
      {poll.isAnonymous && (
        <p className="text-xs text-center text-muted">
          🔒 Bình chọn này là ẩn danh
        </p>
      )}
    </div>
  );
}
