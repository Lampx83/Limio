"use client";

import { useEffect, useRef, useState } from "react";
import { BarChart3, RefreshCw } from "lucide-react";
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

interface Poll {
  id: string;
  question: string;
  options: string[];
  isAnonymous: boolean;
}

interface PollResults {
  id: string;
  question: string;
  options: string[];
  isAnonymous: boolean;
  totalVotes: number;
  votesByOption: Record<string, number>;
}

interface QuickPollProps {
  lessonId?: string;
  studentList?: Array<{ name: string; id: string | null }>;
  onExit?: () => void;
}

interface PollHistoryItem {
  id: string;
  question: string;
  options: string[];
  createdAt: string;
  _count: { votes: number };
}

export default function QuickPoll({ lessonId, studentList, onExit }: QuickPollProps) {
  const [currentPoll, setCurrentPoll] = useState<Poll | null>(null);
  const [results, setResults] = useState<PollResults | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [history, setHistory] = useState<PollHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Form state
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);
  const [votesByOption, setVotesByOption] = useState<Record<string, number>>({});
  const [isFullscreen, setIsFullscreen] = useState(false);

  const isStateless = !!studentList && !lessonId;
  const isStandalone = !lessonId && !studentList;
  const showManualVoting = isStateless; // Only show manual buttons in stateless mode
  const showQRCode = lessonId || isStandalone; // Show QR in classroom or standalone mode

  const handleCreatePoll = async () => {
    if (!question.trim()) {
      toast.error("Vui lòng nhập câu hỏi");
      return;
    }

    const filledOptions = options.filter((o) => o.trim());
    if (filledOptions.length < 2) {
      toast.error("Cần ít nhất 2 lựa chọn");
      return;
    }

    setIsCreating(true);
    try {
      if (isStateless) {
        // Client-side mode: create poll without API call
        const pollId = `local-${Date.now()}`;
        setCurrentPoll({
          id: pollId,
          question: question.trim(),
          options: filledOptions,
          isAnonymous: true,
        });
        setVotesByOption(Object.fromEntries(filledOptions.map((_, idx) => [idx.toString(), 0])));
        setQuestion("");
        setOptions(["", ""]);
        toast.success("Poll tạo thành công");
        return;
      }

      const res = await fetch(apiUrl("/api/classroom/quick-poll/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lessonId,
          question: question.trim(),
          options: filledOptions,
          isAnonymous: true,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error || "Lỗi tạo poll");
        return;
      }

      const data = await res.json();

      setCurrentPoll({
        id: data.id,
        question: data.question,
        options: data.options,
        isAnonymous: data.isAnonymous,
      });

      // Clear form
      setQuestion("");
      setOptions(["", ""]);

      fetchResults(data.id);
    } catch (err) {
      console.error("[QuickPoll]", err);
      toast.error("Lỗi mạng");
    } finally {
      setIsCreating(false);
    }
  };

  // Snapshot fetch — gọi 1 lần khi mở poll. Live update qua SSE useEffect dưới.
  const fetchResults = async (pollId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/classroom/quick-poll/${pollId}/results`));
      if (!res.ok) return;
      setResults(await res.json());
    } catch (err) {
      console.error("[QuickPoll fetchResults]", err);
    }
  };

  // SSE: nhận từng vote mới, cộng dồn votesByOption local.
  const esRef = useRef<EventSource | null>(null);
  useEffect(() => {
    if (!currentPoll) return;
    const pollId = currentPoll.id;
    const es = new EventSource(apiUrl(`/api/classroom/quick-poll/${pollId}/stream`));
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as { choice?: string };
        if (!ev.choice) return;
        setResults((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            totalVotes: prev.totalVotes + 1,
            votesByOption: {
              ...prev.votesByOption,
              [ev.choice!]: (prev.votesByOption[ev.choice!] || 0) + 1,
            },
          };
        });
      } catch {
        /* ignore */
      }
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [currentPoll?.id]);

  const handleRefresh = async () => {
    if (!currentPoll) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(apiUrl(`/api/classroom/quick-poll/${currentPoll.id}/results`));
      if (!res.ok) { toast.error("Không thể tải kết quả"); return; }
      const data = await res.json();
      setResults(data);
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(apiUrl("/api/classroom/quick-poll/list"));
      if (res.ok) setHistory(await res.json());
    } catch {
      toast.error("Lỗi tải lịch sử");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleLoadPoll = async (item: PollHistoryItem) => {
    setCurrentPoll({ id: item.id, question: item.question, options: item.options, isAnonymous: true });
    setResults(null);
    setIsRefreshing(true);
    try {
      const res = await fetch(apiUrl(`/api/classroom/quick-poll/${item.id}/results`));
      if (res.ok) setResults(await res.json());
    } catch {
      toast.error("Lỗi tải kết quả");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleVote = (optionIndex: string) => {
    if (isStateless || isStandalone) {
      setVotesByOption((prev) => ({
        ...prev,
        [optionIndex]: (prev[optionIndex] || 0) + 1,
      }));
    }
  };

  const handleAddOption = () => {
    setOptions([...options, ""]);
  };

  const handleRemoveOption = (idx: number) => {
    setOptions(options.filter((_, i) => i !== idx));
  };

  // Calculate pollUrl for both fullscreen and normal views
  const pollUrl = currentPoll && !isStateless
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/learn/poll/${currentPoll.id}`
    : null;

  if (isFullscreen && currentPoll && (results || isStateless)) {
    const displayResults = isStateless
      ? {
          question: currentPoll.question,
          options: currentPoll.options,
          votesByOption: votesByOption,
          totalVotes: Object.values(votesByOption).reduce((s, v) => s + v, 0),
        }
      : results;

    if (!displayResults) return null;

    const maxVotes = Math.max(...Object.values(displayResults.votesByOption), 1);

    return (
      <div className="fixed inset-0 bg-[rgb(var(--surface))] flex flex-col p-6 z-50 overflow-y-auto">
        {/* Fullscreen Header */}
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <BarChart3 size={32} className="text-blue-600" strokeWidth={1.5} />
            <h3 className="text-2xl font-bold">Poll Đang Diễn Ra</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn-secondary text-sm flex items-center gap-1"
              title="Làm mới kết quả"
            >
              <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
              {isRefreshing ? "Đang tải..." : "Làm mới"}
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

        {/* QR Code Section (only in classroom mode) */}
        {pollUrl && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* QR Code */}
            <div className="flex flex-col items-center gap-3">
              <div className="bg-white p-3 rounded-lg border border-token">
                <QRCode
                  value={pollUrl}
                  size={200}
                  level="H"
                  includeMargin={true}
                />
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(pollUrl);
                  toast.success("Đã copy link!");
                }}
                className="text-xs text-brand-600 hover:text-brand-700 underline"
              >
                Copy link
              </button>
            </div>

            {/* Poll Results */}
            <div className="md:col-span-2">
              <p className="text-lg font-semibold text-center mb-6">
                {displayResults.question}
              </p>

              <div className="space-y-4">
                {displayResults.options.map((option, idx) => {
                  const voteCount = displayResults.votesByOption[idx.toString()] || 0;
                  const percentage =
                    displayResults.totalVotes > 0
                      ? Math.round((voteCount / displayResults.totalVotes) * 100)
                      : 0;
                  const barWidth =
                    maxVotes > 0 ? (voteCount / maxVotes) * 100 : 0;

                  return (
                    <div key={idx}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{option}</span>
                        <span className="text-xs text-faint">
                          {voteCount} ({percentage}%)
                        </span>
                      </div>
                      <div className="h-8 bg-[rgb(var(--surface-muted))] rounded-lg overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-accent-400 to-accent-500 transition-all"
                          style={{ width: `${barWidth}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-6 text-center text-sm text-muted">
                Tổng cộng: <span className="font-semibold">{displayResults.totalVotes}</span> phiếu
              </div>
            </div>
          </div>
        )}

        {/* Stateless mode: show without QR, with vote buttons */}
        {isStateless && (
          <div className="mt-6">
            <p className="text-lg font-semibold text-center mb-6">
              {displayResults.question}
            </p>

            <div className="space-y-4">
              {displayResults.options.map((option, idx) => {
                const voteCount = displayResults.votesByOption[idx.toString()] || 0;
                const percentage =
                  displayResults.totalVotes > 0
                    ? Math.round((voteCount / displayResults.totalVotes) * 100)
                    : 0;
                const barWidth =
                  maxVotes > 0 ? (voteCount / maxVotes) * 100 : 0;

                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium">{option}</span>
                      <span className="text-xs text-faint">
                        {voteCount} ({percentage}%)
                      </span>
                    </div>
                    <div className="h-8 bg-[rgb(var(--surface-muted))] rounded-lg overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-accent-400 to-accent-500 transition-all"
                        style={{ width: `${barWidth}%` }}
                      ></div>
                    </div>
                    <button
                      onClick={() => handleVote(idx.toString())}
                      className="btn-secondary btn-sm mt-2 w-full"
                    >
                      + {option}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 text-center text-sm text-muted">
              Tổng cộng: <span className="font-semibold">{displayResults.totalVotes}</span> phiếu
            </div>
          </div>
        )}
        </div>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="btn-secondary w-full mt-6 flex items-center justify-center gap-2"
        >
          <RefreshCw size={14} className={isRefreshing ? "animate-spin" : ""} />
          {isRefreshing ? "Đang tải..." : "Làm mới"}
        </button>
      </div>
    );
  }

  if (currentPoll && (results || isStateless)) {
    const displayResults = isStateless
      ? {
          question: currentPoll.question,
          options: currentPoll.options,
          votesByOption: votesByOption,
          totalVotes: Object.values(votesByOption).reduce((s, v) => s + v, 0),
        }
      : results;

    if (!displayResults) return null;

    const maxVotes = Math.max(...Object.values(displayResults.votesByOption), 1);

    return (
      <div className="rounded-2xl border-2 border-accent-200 bg-[rgb(var(--surface))] p-6 shadow-card">
        {/* Header with Controls */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BarChart3 size={24} className="text-blue-600" strokeWidth={1.5} />
            <h3 className="text-lg font-bold">Poll Đang Diễn Ra</h3>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn-secondary btn-sm text-xs flex items-center gap-1"
              title="Làm mới kết quả"
            >
              <RefreshCw size={12} className={isRefreshing ? "animate-spin" : ""} />
              {isRefreshing ? "..." : "Làm mới"}
            </button>
            <button
              onClick={() => setIsFullscreen(true)}
              className="btn-secondary btn-sm text-xs"
              title="Fullscreen"
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

        <p className="text-lg font-semibold text-center mb-6">
          {displayResults.question}
        </p>

        {/* QR Code Section - Show in normal view when available */}
        {pollUrl && (
          <div className="mb-6 flex justify-center">
            <div className="bg-white p-3 rounded-lg border border-token">
              <QRCode
                value={pollUrl}
                size={150}
                level="H"
                includeMargin={true}
              />
            </div>
          </div>
        )}

        <div className="space-y-4">
          {displayResults.options.map((option, idx) => {
            const voteCount = displayResults.votesByOption[idx.toString()] || 0;
            const percentage =
              displayResults.totalVotes > 0
                ? Math.round((voteCount / displayResults.totalVotes) * 100)
                : 0;
            const barWidth =
              maxVotes > 0 ? (voteCount / maxVotes) * 100 : 0;

            return (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{option}</span>
                  <span className="text-xs text-faint">
                    {voteCount} ({percentage}%)
                  </span>
                </div>
                <div className="h-8 bg-[rgb(var(--surface-muted))] rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-accent-400 to-accent-500 transition-all"
                    style={{ width: `${barWidth}%` }}
                  ></div>
                </div>
                {isStateless && (
                  <button
                    onClick={() => handleVote(idx.toString())}
                    className="btn-secondary btn-sm mt-2 w-full"
                  >
                    + {option}
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 text-center text-sm text-muted">
          Tổng cộng: <span className="font-semibold">{displayResults.totalVotes}</span> phiếu
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border-2 border-accent-200 bg-[rgb(var(--surface))] p-6 shadow-card">
      <div className="flex items-center gap-2">
        <BarChart3 size={24} className="text-blue-600" strokeWidth={1.5} />
        <h3 className="text-lg font-bold">Tạo Poll</h3>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Câu hỏi</label>
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Nhập câu hỏi cho học viên..."
            className="input w-full"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Lựa chọn</label>
          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => {
                    const newOptions = [...options];
                    newOptions[idx] = e.target.value;
                    setOptions(newOptions);
                  }}
                  placeholder={`Lựa chọn ${idx + 1}`}
                  className="input flex-1"
                />
                {options.length > 2 && (
                  <button
                    onClick={() => handleRemoveOption(idx)}
                    className="btn-icon btn-danger"
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={handleAddOption}
            className="btn-text text-sm mt-2"
          >
            + Thêm lựa chọn
          </button>
        </div>

        <button
          onClick={handleCreatePoll}
          disabled={isCreating}
          className="btn-primary w-full"
        >
          {isCreating ? "Đang tạo..." : "Bắt đầu Poll"}
        </button>
      </div>

      {/* Poll history */}
      <div className="mt-6 border-t border-token pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted">Poll đã tạo trước đây</p>
          <button
            onClick={loadHistory}
            disabled={isLoadingHistory}
            className="btn-secondary btn-sm text-xs flex items-center gap-1"
          >
            <RefreshCw size={11} className={isLoadingHistory ? "animate-spin" : ""} />
            {isLoadingHistory ? "Đang tải..." : "Tải lịch sử"}
          </button>
        </div>
        {history.length === 0 && !isLoadingHistory && (
          <p className="text-xs text-muted text-center py-2">Bấm "Tải lịch sử" để xem các poll cũ</p>
        )}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {history.map((item) => (
            <button
              key={item.id}
              onClick={() => handleLoadPoll(item)}
              className="w-full text-left rounded-lg border border-token p-3 hover:bg-accent-50 dark:hover:bg-accent-900/20 transition-colors"
            >
              <p className="text-sm font-medium truncate">{item.question}</p>
              <p className="text-xs text-muted mt-0.5">
                {item._count.votes} phiếu · {new Date(item.createdAt).toLocaleString("vi-VN")}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
