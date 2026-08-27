"use client";

import { useEffect, useRef, useState } from "react";
import { copyText } from "@/lib/clipboard";
import { Cloud, RefreshCw } from "lucide-react";
import { toast } from "@/lib/toast";
import dynamic from "next/dynamic";
import { apiUrl, shareUrl } from "@/lib/apiUrl";
import { formatDateTime } from "@/lib/datetime";

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

interface WordCloudHistoryItem {
  id: string;
  prompt: string;
  createdAt: string;
  _count: { submissions: number };
}

interface WordCloudProps {
  lessonId?: string;
  studentList?: Array<{ name: string; id: string | null }>;
  onExit?: () => void;
}

const WORD_COLORS = [
  "from-accent-400 to-accent-500",
  "from-blue-400 to-blue-500",
  "from-purple-400 to-purple-500",
  "from-pink-400 to-pink-500",
];

export default function WordCloud({ lessonId, studentList, onExit }: WordCloudProps) {
  const [currentCloud, setCurrentCloud] = useState<WordCloud | null>(null);
  const [results, setResults] = useState<WordFrequencyResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [history, setHistory] = useState<WordCloudHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Stateless mode: student list supplied but no lesson → manual entry, no QR
  const [submissions, setSubmissions] = useState<string[]>([]);
  const [submissionInput, setSubmissionInput] = useState("");

  // Form state
  const [prompt, setPrompt] = useState("");

  const isStateless = !!studentList && !lessonId;
  const isStandalone = !lessonId && !studentList;

  const handleCreateCloud = async () => {
    if (!prompt.trim()) { toast.error("Vui lòng nhập câu hỏi"); return; }

    setIsCreating(true);
    try {
      if (isStateless) {
        setCurrentCloud({ id: `local-${Date.now()}`, prompt: prompt.trim() });
        setSubmissions([]);
        setSubmissionInput("");
        setPrompt("");
        toast.success("Word cloud tạo thành công");
        return;
      }

      const res = await fetch(apiUrl("/api/classroom/word-cloud/create"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lessonId, prompt: prompt.trim() }),
      });

      if (!res.ok) { toast.error((await res.json()).error || "Lỗi tạo word cloud"); return; }

      const data = await res.json();
      setCurrentCloud({ id: data.id, prompt: data.prompt });
      setPrompt("");
      fetchResults(data.id);
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setIsCreating(false);
    }
  };

  // Snapshot fetch — gọi 1 lần khi mở cloud để có frequency có sẵn.
  // Live update từ đây trở đi đi qua SSE (useEffect dưới).
  const fetchResults = async (cloudId: string) => {
    try {
      const res = await fetch(apiUrl(`/api/classroom/word-cloud/${cloudId}/results`));
      if (!res.ok) return;
      setResults(await res.json());
    } catch {
      // silent
    }
  };

  // Normalize giống server's countPhrases để client-side accumulation khớp shape.
  const normalizePhrase = (text: string): string =>
    text
      .toLowerCase()
      .normalize("NFC")
      .replace(/\s+/g, " ")
      .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, "")
      .trim();

  // SSE: nhận từng submission mới, cộng dồn vào wordFrequency local.
  // Chỉ mở khi có currentCloud thật (không phải stateless mode — id "local-*").
  const esRef = useRef<EventSource | null>(null);
  useEffect(() => {
    if (!currentCloud || currentCloud.id.startsWith("local-")) return;
    const cloudId = currentCloud.id;
    const es = new EventSource(apiUrl(`/api/classroom/word-cloud/${cloudId}/stream`));
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        const evt = JSON.parse(e.data) as { text?: string };
        if (!evt.text) return;
        const phrase = normalizePhrase(evt.text);
        if (!phrase) return;
        setResults((prev) => {
          const base = prev ?? { cloudId, totalSubmissions: 0, wordFrequency: {} };
          return {
            cloudId,
            totalSubmissions: base.totalSubmissions + 1,
            wordFrequency: {
              ...base.wordFrequency,
              [phrase]: (base.wordFrequency[phrase] || 0) + 1,
            },
          };
        });
      } catch {
        // ignore malformed event
      }
    };
    es.onerror = () => {
      // EventSource tự reconnect; chỉ log nhẹ
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [currentCloud]);

  const handleRefresh = async () => {
    if (!currentCloud) return;
    setIsRefreshing(true);
    try {
      const res = await fetch(apiUrl(`/api/classroom/word-cloud/${currentCloud.id}/results`));
      if (!res.ok) { toast.error("Không thể tải kết quả"); return; }
      setResults(await res.json());
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setIsRefreshing(false);
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(apiUrl("/api/classroom/word-cloud/list"));
      if (res.ok) setHistory(await res.json());
    } catch {
      toast.error("Lỗi tải lịch sử");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleLoadCloud = async (item: WordCloudHistoryItem) => {
    setCurrentCloud({ id: item.id, prompt: item.prompt });
    setResults(null);
    setIsRefreshing(true);
    try {
      const res = await fetch(apiUrl(`/api/classroom/word-cloud/${item.id}/results`));
      if (res.ok) setResults(await res.json());
    } catch {
      toast.error("Lỗi tải kết quả");
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleAddSubmission = () => {
    const text = submissionInput.trim();
    if (text.length > 0) { setSubmissions((prev) => [...prev, text]); setSubmissionInput(""); }
  };

  const getWordSize = (frequency: number, maxFrequency: number) => {
    if (maxFrequency === 0) return 0.875;
    return 0.875 + (frequency / maxFrequency) * (2.5 - 0.875);
  };

  // Xem shareUrl trong lib/apiUrl.ts — production chạy dưới một tiền tố.
  const cloudUrl = currentCloud && !isStateless
    ? shareUrl(`/learn/word-cloud/${currentCloud.id}`)
    : null;

  // Compute word frequency for display
  const getWordFrequency = (): Record<string, number> => {
    if (isStateless) {
      return submissions.reduce((acc, s) => {
        const phrase = s
          .toLowerCase()
          .normalize("NFC")
          .replace(/\s+/g, " ")
          .replace(/^[\s\p{P}]+|[\s\p{P}]+$/gu, "")
          .trim();
        if (phrase.length > 0) acc[phrase] = (acc[phrase] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
    }
    return results?.wordFrequency || {};
  };

  const RefreshBtn = ({ size = 14, className = "btn-secondary btn-sm text-xs" }: { size?: number; className?: string }) => (
    <button onClick={handleRefresh} disabled={isRefreshing} className={`${className} flex items-center gap-1`} title="Làm mới kết quả">
      <RefreshCw size={size} className={isRefreshing ? "animate-spin" : ""} />
      {isRefreshing ? "..." : "Làm mới"}
    </button>
  );

  const WordCloudDisplay = ({ wordFrequency, totalSubmissions }: { wordFrequency: Record<string, number>; totalSubmissions: number }) => {
    const maxFrequency = Math.max(...Object.values(wordFrequency), 1);
    const sortedWords = Object.entries(wordFrequency).sort(([, a], [, b]) => b - a).slice(0, 50);
    return (
      <>
        <div className="bg-[rgb(var(--surface-muted))] rounded-lg p-6 min-h-64 flex items-center justify-center">
          <div className="flex flex-wrap gap-3 justify-center items-center">
            {sortedWords.length > 0 ? sortedWords.map(([word, freq], idx) => (
              <span
                key={word}
                className={`px-3 py-1.5 rounded-full text-white font-semibold bg-gradient-to-r ${WORD_COLORS[idx % WORD_COLORS.length]} transition-transform hover:scale-110`}
                style={{ fontSize: `${getWordSize(freq, maxFrequency)}rem` }}
              >
                {word}
              </span>
            )) : (
              <p className="text-muted text-sm">Chưa có gửi nào...</p>
            )}
          </div>
        </div>
        <div className="mt-4 text-center text-sm text-muted">
          Tổng cộng: <span className="font-semibold">{totalSubmissions}</span> gửi
        </div>
      </>
    );
  };

  // ── Fullscreen active view ──────────────────────────────────────────────────
  if (isFullscreen && currentCloud && (results || isStateless)) {
    const wordFrequency = getWordFrequency();
    const totalSubmissions = isStateless ? submissions.length : (results?.totalSubmissions || 0);

    return (
      <div className="fixed inset-0 bg-[rgb(var(--surface))] flex flex-col p-6 z-50 overflow-y-auto">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <Cloud size={32} className="text-purple-600" strokeWidth={1.5} />
            <h3 className="text-2xl font-bold">Word Cloud Đang Diễn Ra</h3>
          </div>
          <div className="flex gap-2">
            {!isStateless && <RefreshBtn size={14} className="btn-secondary text-sm" />}
            <button onClick={() => setIsFullscreen(false)} className="btn-secondary text-sm">⛶ Thoát</button>
            {onExit && <button onClick={onExit} className="btn-secondary text-sm">✕ Exit</button>}
          </div>
        </div>

        <div className="flex-1">
          {cloudUrl ? (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
              <div className="flex flex-col items-center gap-3">
                <div className="bg-white p-3 rounded-lg border border-token">
                  <QRCode value={cloudUrl} size={200} level="H" includeMargin />
                </div>
                <button
                  onClick={async () => {
                    // Báo theo kết quả THẬT. Bản cũ luôn hiện "Đã copy!" kể cả
                    // khi clipboard không dùng được (http trần) — người dùng
                    // tin là xong rồi đi dán ra thứ khác.
                    const ok = await copyText(cloudUrl);
                    if (ok) toast.success("Đã copy link!");
                    else toast.error("Không sao chép được — bạn chọn link rồi copy tay giúp");
                  }}
                  className="text-xs text-brand-600 hover:text-brand-700 underline"
                >
                  Copy link
                </button>
              </div>
              <div className="md:col-span-2">
                <p className="text-4xl md:text-5xl font-bold text-center mb-8 leading-tight">{currentCloud.prompt}</p>
                <WordCloudDisplay wordFrequency={wordFrequency} totalSubmissions={totalSubmissions} />
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <p className="text-4xl md:text-5xl font-bold text-center mb-8 leading-tight">{currentCloud.prompt}</p>
              <WordCloudDisplay wordFrequency={wordFrequency} totalSubmissions={totalSubmissions} />
              {isStateless && (
                <div className="mt-6 space-y-4">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={submissionInput}
                      onChange={(e) => setSubmissionInput(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleAddSubmission()}
                      placeholder="Gõ một từ hoặc câu..."
                      className="input flex-1"
                    />
                    <button onClick={handleAddSubmission} className="btn-secondary">+</button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {!isStateless && (
          <RefreshBtn size={14} className="btn-secondary w-full mt-6 justify-center" />
        )}
      </div>
    );
  }

  // ── Normal active view ──────────────────────────────────────────────────────
  if (currentCloud && (results || isStateless)) {
    const wordFrequency = getWordFrequency();
    const totalSubmissions = isStateless ? submissions.length : (results?.totalSubmissions || 0);

    return (
      <div className="rounded-2xl border-2 border-purple-200 bg-[rgb(var(--surface))] p-6 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Cloud size={24} className="text-purple-600" strokeWidth={1.5} />
            <h3 className="text-lg font-bold">Word Cloud Đang Diễn Ra</h3>
          </div>
          <div className="flex gap-2">
            {!isStateless && <RefreshBtn />}
            <button onClick={() => setIsFullscreen(true)} className="btn-secondary btn-sm text-xs">⛶ Full</button>
            {onExit && <button onClick={onExit} className="btn-secondary btn-sm text-xs">✕ Exit</button>}
          </div>
        </div>

        {cloudUrl && (
          <div className="mb-6 flex justify-center">
            <div className="bg-white p-3 rounded-lg border border-token">
              <QRCode value={cloudUrl} size={150} level="H" includeMargin />
            </div>
          </div>
        )}

        <p className="text-lg font-semibold text-center mb-4">{currentCloud.prompt}</p>
        <WordCloudDisplay wordFrequency={wordFrequency} totalSubmissions={totalSubmissions} />

        {isStateless && (
          <div className="mt-4 flex gap-2">
            <input
              type="text"
              value={submissionInput}
              onChange={(e) => setSubmissionInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddSubmission()}
              placeholder="Gõ một từ hoặc câu..."
              className="input flex-1"
            />
            <button onClick={handleAddSubmission} className="btn-secondary">+</button>
          </div>
        )}

        {!isStateless && (
          <RefreshBtn size={14} className="btn-secondary w-full mt-6 justify-center" />
        )}
      </div>
    );
  }

  // ── Create form ─────────────────────────────────────────────────────────────
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
            onKeyDown={(e) => e.key === "Enter" && handleCreateCloud()}
            placeholder="Nhập câu hỏi cho học viên..."
            maxLength={200}
            className="input w-full"
          />
          <p className="text-xs text-muted mt-1">{prompt.length}/200</p>
        </div>

        <button onClick={handleCreateCloud} disabled={isCreating} className="btn-primary w-full">
          {isCreating ? "Đang tạo..." : "Bắt đầu Word Cloud"}
        </button>
      </div>

      {/* History */}
      <div className="mt-6 border-t border-token pt-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-muted">Word cloud đã tạo trước đây</p>
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
          <p className="text-xs text-muted text-center py-2">Bấm "Tải lịch sử" để xem các word cloud cũ</p>
        )}
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {history.map((item) => (
            <button
              key={item.id}
              onClick={() => handleLoadCloud(item)}
              className="w-full text-left rounded-lg border border-token p-3 hover:bg-accent-50 dark:hover:bg-accent-900/20 transition-colors"
            >
              <p className="text-sm font-medium truncate">{item.prompt}</p>
              <p className="text-xs text-muted mt-0.5">
                {item._count.submissions} gửi · {formatDateTime(item.createdAt)}
              </p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
