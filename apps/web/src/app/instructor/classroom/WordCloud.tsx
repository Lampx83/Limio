"use client";

import { useState, useEffect } from "react";
import { Cloud } from "lucide-react";
import { toast } from "@/lib/toast";
import dynamic from "next/dynamic";
import { apiUrl } from "@/lib/apiUrl";

const QRCode = dynamic(
  () => import("qrcode.react").then((mod) => mod.QRCodeSVG),
  {
    ssr: false,
    loading: () => <div className="bg-white p-3 rounded-lg border border-token" style={{ width: 200, height: 200 }} />
  }
);

interface WordCloud {
  id: string;
  prompt: string;
}

interface WordFrequencyResult {
  cloudId: string;
  totalSubmissions: number;
  wordFrequency: Record<string, number>;
}

interface WordCloudProps {
  lessonId?: string;
  studentList?: Array<{ name: string; id: string | null }>;
  onExit?: () => void;
}

export default function WordCloud({ lessonId, studentList, onExit }: WordCloudProps) {
  const [currentCloud, setCurrentCloud] = useState<WordCloud | null>(null);
  const [results, setResults] = useState<WordFrequencyResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isPolling, setIsPolling] = useState(false);
  const [submissions, setSubmissions] = useState<string[]>([]);
  const [submissionInput, setSubmissionInput] = useState("");
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Form state
  const [prompt, setPrompt] = useState("");
  const [originalPrompt, setOriginalPrompt] = useState("");

  const isStateless = !!studentList && !lessonId;
  const isStandalone = !lessonId && !studentList;

  const handleCreateCloud = async () => {
    console.log("[WordCloud] handleCreateCloud called, prompt:", prompt);
    if (!prompt.trim()) {
      console.log("[WordCloud] prompt is empty");
      toast.error("Vui lòng nhập câu hỏi");
      return;
    }

    setIsCreating(true);
    try {
      if (isStateless) {
        // Client-side mode: create cloud without API call
        const cloudId = `local-${Date.now()}`;
        setOriginalPrompt(prompt.trim());
        setCurrentCloud({
          id: cloudId,
          prompt: prompt.trim(),
        });
        setSubmissions([]);
        setSubmissionInput("");
        setPrompt("");
        toast.success("Word cloud tạo thành công");
        return;
      }

      const res = await fetch(apiUrl("/api/classroom/word-cloud/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          prompt: prompt.trim(),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Lỗi tạo word cloud");
        return;
      }

      const data = await res.json();

      // Save original prompt for reset functionality
      setOriginalPrompt(prompt.trim());

      setCurrentCloud({
        id: data.id,
        prompt: data.prompt,
      });

      // Clear form
      setPrompt("");

      // Start polling for results
      setIsPolling(true);
      fetchResults(data.id);
    } catch (err) {
      console.error("[WordCloud]", err);
      toast.error("Lỗi mạng");
    } finally {
      setIsCreating(false);
    }
  };

  const fetchResults = async (cloudId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/classroom/word-cloud/${cloudId}/results`);
      if (!res.ok) return;

      const data = await res.json();
      setResults(data);

      // Poll again after 1 second
      setTimeout(() => fetchResults(cloudId), 1000);
    } catch (err) {
      console.error("[WordCloud fetchResults]", err);
    }
  };

  const handleCloseCloud = () => {
    setCurrentCloud(null);
    setResults(null);
    setSubmissions([]);
    setSubmissionInput("");
    setIsPolling(false);
  };

  const handleReset = async () => {
    // If there's an active cloud, create a new session with same prompt
    if (currentCloud && originalPrompt) {
      setIsCreating(true);
      try {
        if (isStateless) {
          // Client-side mode
          const cloudId = `local-${Date.now()}`;
          setCurrentCloud({
            id: cloudId,
            prompt: originalPrompt,
          });
          setResults(null);
          setSubmissions([]);
          setSubmissionInput("");
          toast.success("Word cloud mới được tạo!");
          return;
        }

        const res = await fetch(apiUrl("/api/classroom/word-cloud/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            lessonId,
            prompt: originalPrompt,
          }),
        });

        if (!res.ok) {
          const error = await res.json();
          toast.error(error.error || "Lỗi tạo word cloud mới");
          return;
        }

        const data = await res.json();
        setCurrentCloud({
          id: data.id,
          prompt: data.prompt,
        });

        // Reset submissions and results
        setResults(null);
        setSubmissions([]);
        setSubmissionInput("");

        // Start polling for results
        setIsPolling(true);
        fetchResults(data.id);
        toast.success("Word cloud mới được tạo!");
      } catch (err) {
        console.error("[WordCloud Reset]", err);
        toast.error("Lỗi tạo word cloud mới");
      } finally {
        setIsCreating(false);
      }
    } else {
      // No active cloud, just reset form
      setCurrentCloud(null);
      setResults(null);
      setSubmissions([]);
      setSubmissionInput("");
      setIsPolling(false);
      setPrompt("");
      setOriginalPrompt("");
    }
  };

  const handleAddSubmission = () => {
    const text = submissionInput.trim();
    if (text.length > 0) {
      setSubmissions((prev) => [...prev, text]);
      setSubmissionInput("");
    }
  };

  const getWordSize = (frequency: number, maxFrequency: number) => {
    if (maxFrequency === 0) return 0.875;
    const minSize = 0.875; // rem
    const maxSize = 2.5;   // rem
    return minSize + (frequency / maxFrequency) * (maxSize - minSize);
  };

  const WORD_COLORS = [
    "from-accent-400 to-accent-500",
    "from-blue-400 to-blue-500",
    "from-purple-400 to-purple-500",
    "from-pink-400 to-pink-500",
  ];

  // Calculate cloudUrl for both fullscreen and normal views
  const cloudUrl = currentCloud && !isStateless
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/learn/word-cloud/${currentCloud.id}`
    : null;

  if (isFullscreen && currentCloud && (results || isStateless || isStandalone)) {
    const wordFrequency = (isStateless || isStandalone)
      ? submissions.reduce(
          (acc, submission) => {
            const words = submission
              .toLowerCase()
              .match(/\b\w+\b/g) || [];
            words.forEach((word) => {
              acc[word] = (acc[word] || 0) + 1;
            });
            return acc;
          },
          {} as Record<string, number>
        )
      : results?.wordFrequency || {};

    const totalSubmissions = isStateless ? submissions.length : results?.totalSubmissions || 0;

    const maxFrequency = Math.max(...Object.values(wordFrequency), 1);
    const sortedWords = Object.entries(wordFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 50);

    return (
      <div className="fixed inset-0 bg-[rgb(var(--surface))] flex flex-col p-6 z-50 overflow-y-auto">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Cloud size={32} className="text-purple-600" strokeWidth={1.5} />
            <h3 className="text-2xl font-bold">Word Cloud Đang Diễn Ra</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="btn-secondary text-sm"
              title="Reset"
            >
              ↺ Reset
            </button>
            <button
              onClick={() => setIsFullscreen(false)}
              className="btn-secondary text-sm"
              title="Exit fullscreen"
            >
              ⛶ Thoát
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="btn-secondary text-sm"
                title="Exit tool"
              >
                ✕ Exit
              </button>
            )}
          </div>
        </div>

        <div className="flex-1">
          {cloudUrl && (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              <div className="flex flex-col items-center gap-3">
                <div className="bg-white p-3 rounded-lg border border-token">
                  <QRCode
                    value={cloudUrl}
                    size={200}
                    level="H"
                    includeMargin={true}
                  />
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(cloudUrl);
                    toast.success("Đã copy link!");
                  }}
                  className="text-xs text-brand-600 hover:text-brand-700 underline"
                >
                  Copy link
                </button>
              </div>

              <div className="md:col-span-2">
                <p className="text-lg font-semibold text-center mb-6">
                  {currentCloud.prompt}
                </p>

                <div className="bg-[rgb(var(--surface-muted))] rounded-lg p-6 min-h-64 flex items-center justify-center">
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
                            {word} ({frequency})
                          </span>
                        );
                      })
                    ) : (
                      <p className="text-muted text-sm">Chưa có gửi nào...</p>
                    )}
                  </div>
                </div>

                <div className="mt-6 text-center text-sm text-muted">
                  Tổng cộng: <span className="font-semibold">{totalSubmissions}</span> gửi
                </div>
              </div>
            </div>
          )}

          {isStateless && (
            <div className="mt-6">
              <p className="text-lg font-semibold text-center mb-6">
                {currentCloud.prompt}
              </p>

              <div className="bg-[rgb(var(--surface-muted))] rounded-lg p-6 min-h-64 flex items-center justify-center">
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
                          {word} ({frequency})
                        </span>
                      );
                    })
                  ) : (
                    <p className="text-muted text-sm">Chưa có gửi nào...</p>
                  )}
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Thêm câu trả lời</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={submissionInput}
                      onChange={(e) => setSubmissionInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleAddSubmission()}
                      placeholder="Gõ một từ hoặc câu..."
                      className="input flex-1"
                    />
                    <button
                      onClick={handleAddSubmission}
                      className="btn-secondary"
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="text-center text-sm text-muted">
                  Tổng cộng: <span className="font-semibold">{totalSubmissions}</span> gửi
                </div>
              </div>
            </div>
          )}
        </div>

        <button
          onClick={handleReset}
          className="btn-secondary w-full mt-6"
        >
          ↺ Reset
        </button>
      </div>
    );
  }

  if (currentCloud && (results || isStateless || isStandalone)) {
    const wordFrequency = (isStateless || isStandalone)
      ? submissions.reduce(
          (acc, submission) => {
            const words = submission
              .toLowerCase()
              .match(/\b\w+\b/g) || [];
            words.forEach((word) => {
              acc[word] = (acc[word] || 0) + 1;
            });
            return acc;
          },
          {} as Record<string, number>
        )
      : results?.wordFrequency || {};

    const totalSubmissions = isStateless ? submissions.length : results?.totalSubmissions || 0;
    const maxFrequency = Math.max(...Object.values(wordFrequency), 1);
    const sortedWords = Object.entries(wordFrequency)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 50);

    return (
      <div className="rounded-2xl border-2 border-purple-200 bg-[rgb(var(--surface))] p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cloud size={24} className="text-purple-600" strokeWidth={1.5} />
            <h3 className="text-lg font-bold">Word Cloud Đang Diễn Ra</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleReset}
              className="btn-secondary btn-sm text-xs"
              title="Reset"
            >
              ↺ Reset
            </button>
            <button
              onClick={() => setIsFullscreen(true)}
              className="btn-secondary btn-sm text-xs"
              title="Fullscreen"
              disabled={!currentCloud}
            >
              ⛶ Full
            </button>
            {onExit && (
              <button
                onClick={onExit}
                className="btn-secondary btn-sm text-xs"
                title="Exit"
              >
                ✕ Exit
              </button>
            )}
          </div>
        </div>

        {cloudUrl && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-3 rounded-lg border border-token">
                <QRCode
                  value={cloudUrl}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(cloudUrl);
                  toast.success("Đã copy link!");
                }}
                className="text-xs text-brand-600 hover:text-brand-700 underline"
              >
                Copy link
              </button>
            </div>

            <div className="md:col-span-2">
              <p className="text-lg font-semibold text-center mb-6">
                {currentCloud.prompt}
              </p>

              <div className="bg-[rgb(var(--surface-muted))] rounded-lg p-6 min-h-64 flex items-center justify-center">
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
                          {word} ({frequency})
                        </span>
                      );
                    })
                  ) : (
                    <p className="text-muted text-sm">Chưa có gửi nào...</p>
                  )}
                </div>
              </div>

              <div className="mt-6 text-center text-sm text-muted">
                Tổng cộng: <span className="font-semibold">{totalSubmissions}</span> gửi
              </div>
            </div>
          </div>
        )}

        {isStateless && (
          <div className="mt-6">
            <p className="text-lg font-semibold text-center mb-6">
              {currentCloud.prompt}
            </p>

            <div className="bg-[rgb(var(--surface-muted))] rounded-lg p-6 min-h-64 flex items-center justify-center">
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
                        {word} ({frequency})
                      </span>
                    );
                  })
                ) : (
                  <p className="text-muted text-sm">Chưa có gửi nào...</p>
                )}
              </div>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Thêm câu trả lời</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={submissionInput}
                    onChange={(e) => setSubmissionInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddSubmission()}
                    placeholder="Gõ một từ hoặc câu..."
                    className="input flex-1"
                  />
                  <button
                    onClick={handleAddSubmission}
                    className="btn-secondary"
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="text-center text-sm text-muted">
                Tổng cộng: <span className="font-semibold">{totalSubmissions}</span> gửi
              </div>
            </div>
          </div>
        )}

        <button
          onClick={handleCloseCloud}
          className="btn-secondary w-full mt-6"
        >
          Đóng Word Cloud
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-purple-200 bg-[rgb(var(--surface))] p-6 shadow-card">
      <div className="flex items-center gap-2">
        <Cloud size={24} className="text-purple-600" strokeWidth={1.5} />
        <h3 className="text-lg font-bold">Tạo Word Cloud</h3>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Câu hỏi</label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Nhập câu hỏi cho học viên..."
            maxLength={200}
            className="input w-full"
          />
          <p className="text-xs text-muted mt-1">{prompt.length}/200</p>
        </div>

        <button
          onClick={handleCreateCloud}
          disabled={isCreating}
          className="btn-primary w-full"
        >
          {isCreating ? "Đang tạo..." : "Bắt đầu Word Cloud"}
        </button>
      </div>
    </div>
  );
}
