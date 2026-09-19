"use client";

import { getClientId } from "@/lib/clientId";
import { useState } from "react";
import { toast } from "@/lib/toast";

interface WordCloud {
  id: string;
  prompt: string;
  session: {
    lesson: {
      title: string;
      module: { course: { title: string } };
    } | null;
  };
}

interface WordFrequencyResult {
  cloudId: string;
  totalSubmissions: number;
  wordFrequency: Record<string, number>;
}

// Cùng hệ gradient thương hiệu Limio (lime → hồng) thay vì tím rời rạc như
// trước — nhất quán với PresentDeck (giáo viên) và PollVotingPage.
const WORD_GRADIENTS = [
  "from-brand-500 to-pink-500",
  "from-blue-400 to-blue-500",
  "from-purple-400 to-purple-500",
  "from-pink-400 to-pink-500",
];

export default function WordCloudSubmitPage({ wordCloud }: { wordCloud: WordCloud }) {
  const [text, setText] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [results, setResults] = useState<WordFrequencyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [clientId] = useState(getClientId);

  const handleSubmit = async () => {
    if (!text.trim()) {
      toast.error("Vui lòng nhập câu trả lời");
      return;
    }
    if (text.trim().length > 100) {
      toast.error("Câu trả lời không được vượt quá 100 ký tự");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/classroom/word-cloud/${wordCloud.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.trim(), clientId }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Lỗi gửi câu trả lời");
        return;
      }

      setHasSubmitted(true);

      const resultsRes = await fetch(`/api/classroom/word-cloud/${wordCloud.id}/results`);
      if (resultsRes.ok) setResults(await resultsRes.json());
    } catch (err) {
      console.error("[WordCloudSubmitPage]", err);
      toast.error("Lỗi mạng");
    } finally {
      setIsLoading(false);
    }
  };

  const getWordSize = (frequency: number, maxFrequency: number) => {
    if (maxFrequency === 0) return 0.875;
    return 0.875 + (frequency / maxFrequency) * (2.5 - 0.875);
  };

  if (hasSubmitted && results) {
    const maxFrequency = Math.max(...Object.values(results.wordFrequency), 1);
    const sortedWords = Object.entries(results.wordFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 50);

    return (
      <div className="space-y-6">
        <h2 className="text-center text-xl font-bold text-brand-900">{wordCloud.prompt}</h2>

        <div className="flex flex-col items-center gap-2 py-1">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-gradient text-white shadow-brand-glow animate-[note-pop-in_0.4s_ease-out]">
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <path d="M4 12l5 5L20 6" />
            </svg>
          </div>
          <p className="text-sm font-bold text-brand-700">Đã gửi câu trả lời của bạn!</p>
        </div>

        <div className="flex min-h-64 items-center justify-center rounded-2xl bg-[rgb(var(--surface-muted))] p-6">
          <div className="flex flex-wrap items-center justify-center gap-3">
            {sortedWords.length > 0 ? (
              sortedWords.map(([word, frequency], idx) => {
                const fontSize = getWordSize(frequency, maxFrequency);
                const gradient = WORD_GRADIENTS[idx % WORD_GRADIENTS.length];
                const isMine = word.toLowerCase() === text.trim().toLowerCase();
                return (
                  <span
                    key={word}
                    className={`rounded-full bg-gradient-to-r px-3 py-1.5 font-semibold text-white transition-transform hover:scale-110 ${gradient} ${
                      isMine ? "ring-2 ring-offset-2 ring-brand-500" : ""
                    }`}
                    style={{ fontSize: `${fontSize}rem` }}
                  >
                    {word}
                  </span>
                );
              })
            ) : (
              <p className="text-sm text-muted">Chưa có gửi nào...</p>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted">
          Tổng cộng: <span className="font-semibold">{results.totalSubmissions}</span> gửi
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-center text-xl font-bold text-brand-900">{wordCloud.prompt}</h2>

      <div className="space-y-3">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          maxLength={100}
          placeholder="Nhập câu trả lời..."
          autoFocus
          className="input w-full text-center text-lg font-semibold"
        />
        <p className="text-right text-xs text-muted">{text.length}/100</p>
        <button
          onClick={handleSubmit}
          disabled={isLoading || !text.trim()}
          className="btn-primary w-full py-3 text-base active:scale-[0.98]"
        >
          {isLoading ? "Đang gửi..." : "Gửi câu trả lời"}
        </button>
      </div>
    </div>
  );
}
