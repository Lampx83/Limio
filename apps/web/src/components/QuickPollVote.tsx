"use client";

import { useState, useEffect } from "react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";

interface Poll {
  id: string;
  question: string;
  options: string[];
}

interface PollResults {
  id: string;
  question: string;
  options: string[];
  totalVotes: number;
  votesByOption: Record<string, number>;
}

export default function QuickPollVote({ pollId }: { pollId: string }) {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [results, setResults] = useState<PollResults | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchResults();
    const interval = setInterval(fetchResults, 1000);
    return () => clearInterval(interval);
  }, [pollId]);

  const fetchResults = async () => {
    try {
      const res = await fetch(apiUrl(`/api/classroom/quick-poll/${pollId}/results`));
      if (!res.ok) return;

      const data = await res.json();
      setResults(data);
      if (!poll) {
        setPoll({
          id: data.id,
          question: data.question,
          options: data.options,
        });
      }
    } catch (err) {
      console.error("[QuickPollVote]", err);
    }
  };

  const handleVote = async () => {
    if (selectedChoice === null) {
      toast.error("Vui lòng chọn một câu trả lời");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(apiUrl(`/api/classroom/quick-poll/${pollId}/vote`), {
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
      await fetchResults();
    } catch (err) {
      console.error("[QuickPollVote vote]", err);
      toast.error("Lỗi mạng");
    } finally {
      setIsLoading(false);
    }
  };

  if (!poll || !results) {
    return null;
  }

  const maxVotes = Math.max(...Object.values(results.votesByOption), 1);

  return (
    <div className="fixed bottom-6 right-6 w-80 rounded-2xl border-2 border-accent-200 bg-[rgb(var(--surface))] p-5 shadow-lg">
      <h4 className="text-base font-bold mb-4">📊 Poll</h4>

      <p className="text-sm font-semibold mb-4">{results.question}</p>

      {!hasVoted ? (
        <div className="space-y-3">
          {results.options.map((option, idx) => (
            <label
              key={idx}
              className="flex items-center gap-3 p-3 rounded-lg border border-token cursor-pointer hover:bg-[rgb(var(--surface-muted))] transition-colors"
            >
              <input
                type="radio"
                name="poll-option"
                value={idx}
                checked={selectedChoice === idx}
                onChange={(e) => setSelectedChoice(parseInt(e.target.value))}
                className="w-4 h-4"
              />
              <span className="text-sm">{option}</span>
            </label>
          ))}

          <button
            onClick={handleVote}
            disabled={isLoading || selectedChoice === null}
            className="btn-primary btn-sm w-full"
          >
            {isLoading ? "Đang gửi..." : "Bình chọn"}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {results.options.map((option, idx) => {
            const voteCount = results.votesByOption[idx] || 0;
            const percentage =
              results.totalVotes > 0
                ? Math.round((voteCount / results.totalVotes) * 100)
                : 0;
            const barWidth = maxVotes > 0 ? (voteCount / maxVotes) * 100 : 0;

            return (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium">{option}</span>
                  <span className="text-xs text-faint">{percentage}%</span>
                </div>
                <div className="h-6 bg-[rgb(var(--surface-muted))] rounded overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent-400 to-accent-500 transition-all"
                    style={{ width: `${barWidth}%` }}
                  ></div>
                </div>
              </div>
            );
          })}

          <p className="text-xs text-center text-muted mt-3">
            Tổng: {results.totalVotes} phiếu
          </p>
        </div>
      )}
    </div>
  );
}
