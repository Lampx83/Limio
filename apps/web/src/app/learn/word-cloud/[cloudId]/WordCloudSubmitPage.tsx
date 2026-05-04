"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";

interface WordCloud {
  id: string;
  prompt: string;
  session: {
    lesson: {
      title: string;
      module: { course: { title: string } };
    };
  };
}

interface WordFrequencyResult {
  cloudId: string;
  totalSubmissions: number;
  wordFrequency: Record<string, number>;
}

const WORD_COLORS = [
  "from-purple-400 to-purple-500",
  "from-blue-400 to-blue-500",
  "from-pink-400 to-pink-500",
  "from-accent-400 to-accent-500",
];

export default function WordCloudSubmitPage({
  wordCloud,
}: {
  wordCloud: WordCloud;
}) {
  const [text, setText] = useState("");
  const [hasSubmitted, setHasSubmitted] = useState(false);
  const [results, setResults] = useState<WordFrequencyResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);

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
      const res = await fetch(
        `/api/classroom/word-cloud/${wordCloud.id}/submit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: text.trim() }),
        }
      );

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Lỗi gửi câu trả lời");
        return;
      }

      setHasSubmitted(true);
      toast.success("Gửi thành công!");

      // Fetch results
      const resultsRes = await fetch(
        `/api/classroom/word-cloud/${wordCloud.id}/results`
      );
      if (resultsRes.ok) {
        const data = await resultsRes.json();
        setResults(data);
      }
    } catch (err) {
      console.error("[WordCloudSubmitPage]", err);
      toast.error("Lỗi mạng");
    } finally {
      setIsLoading(false);
    }
  };

  const getWordSize = (frequency: number, maxFrequency: number) => {
    if (maxFrequency === 0) return 0.875;
    const minSize = 0.875; // rem
    const maxSize = 2.5;   // rem
    return minSize + (frequency / maxFrequency) * (maxSize - minSize);
  };

  if (hasSubmitted && results) {
    const maxFrequency = Math.max(...Object.values(results.wordFrequency), 1);
    const sortedWords = Object.entries(results.wordFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 50);

    return (
      <div className="space-y-6">
        {/* Prompt */}
        <div>
          <h2 className="text-xl font-bold text-center text-purple-900">
            {wordCloud.prompt}
          </h2>
        </div>

        {/* Confirmation */}
        <p className="text-center text-sm text-purple-600 font-semibold">
          ✓ Cảm ơn bạn đã gửi!
        </p>

        {/* Word Cloud Display */}
        <div className="bg-purple-50 rounded-lg p-6 min-h-64 flex items-center justify-center">
          <div className="flex flex-wrap gap-3 justify-center items-center">
            {sortedWords.length > 0 ? (
              sortedWords.map(([word, frequency], idx) => {
                const fontSize = getWordSize(frequency, maxFrequency);
                const colorClass = WORD_COLORS[idx % WORD_COLORS.length];
                return (
                  <span
                    key={word}
                    className={`px-3 py-1.5 rounded-full text-white font-semibold bg-gradient-to-r ${colorClass} transition-transform hover:scale-110`}
                    style={{ fontSize: `${fontSize}rem` }}
                  >
                    {word}
                  </span>
                );
              })
            ) : (
              <p className="text-purple-400 text-sm">Chưa có gửi nào...</p>
            )}
          </div>
        </div>

        {/* Results Summary */}
        <p className="text-xs text-center text-purple-600">
          Tổng cộng: <span className="font-semibold">{results.totalSubmissions}</span> gửi
        </p>

      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Prompt */}
      <div>
        <h2 className="text-xl font-bold text-center text-purple-900">
          {wordCloud.prompt}
        </h2>
      </div>

      {/* Form */}
      <div className="space-y-3">
        {/* Text Input */}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={100}
          placeholder="Nhập câu trả lời..."
          className="input w-full"
        />

        {/* Character Counter */}
        <p className="text-xs text-right text-purple-600">
          {text.length}/100
        </p>

        {/* Submit Button */}
        <button
          onClick={handleSubmit}
          disabled={isLoading || !text.trim()}
          className="btn-primary w-full"
        >
          {isLoading ? "Đang gửi..." : "Gửi"}
        </button>
      </div>

    </div>
  );
}
