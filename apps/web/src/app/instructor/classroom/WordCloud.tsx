"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw, RotateCcw } from "lucide-react";
import { WordCloudIcon } from "@/components/icons/WordCloudIcon";
import { toast } from "@/lib/toast";
import JoinQrCard from "@/components/ui/JoinQrCard";
import ToolHistory from "./ToolHistory";
import { apiUrl, shareUrl } from "@/lib/apiUrl";
import { formatDateTime } from "@/lib/datetime";
import { WORD_GRADIENTS } from "@/lib/wordCloudColors";

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
  deletedAt?: string | null;
  _count: { submissions: number };
}

interface WordCloudProps {
  lessonId?: string;
  studentList?: Array<{ name: string; id: string | null }>;
  onExit?: () => void;
  // Điền sẵn khi mở từ 1 event trong kịch bản lớp học (Activity Plan).
  initialPrompt?: string;
}

export default function WordCloud({ lessonId, studentList, onExit, initialPrompt }: WordCloudProps) {
  const [currentCloud, setCurrentCloud] = useState<WordCloud | null>(null);
  const [results, setResults] = useState<WordFrequencyResult | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Stateless mode: student list supplied but no lesson → manual entry, no QR
  const [submissions, setSubmissions] = useState<string[]>([]);
  const [submissionInput, setSubmissionInput] = useState("");

  // Form state
  const [prompt, setPrompt] = useState(initialPrompt ?? "");

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
        const evt = JSON.parse(e.data) as { text?: string; reset?: boolean };
        if (evt.reset) {
          setResults({ cloudId, totalSubmissions: 0, wordFrequency: {} });
          return;
        }
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

  // Xoá hết kết quả hiện tại nhưng giữ nguyên cloud (id + prompt + QR) — dùng
  // lại được cho lớp nhỏ tiếp theo mà không cần tạo word cloud mới.
  const handleReset = async () => {
    if (!currentCloud) return;
    if (!confirm("Xoá toàn bộ kết quả hiện tại để bắt đầu phiên mới? Không thể hoàn tác.")) return;

    if (isStateless) {
      setSubmissions([]);
      toast.success("Đã reset word cloud");
      return;
    }

    setIsResetting(true);
    try {
      const res = await fetch(apiUrl(`/api/classroom/word-cloud/${currentCloud.id}/reset`), {
        method: "POST",
      });
      if (!res.ok) { toast.error("Không thể reset"); return; }
      setResults({ cloudId: currentCloud.id, totalSubmissions: 0, wordFrequency: {} });
      toast.success("Đã reset word cloud");
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setIsResetting(false);
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

  const RefreshBtn = ({ size = 14, className = "tool-action" }: { size?: number; className?: string }) => (
    <button onClick={handleRefresh} disabled={isRefreshing} className={`${className} flex items-center gap-1`} title="Làm mới kết quả">
      <RefreshCw size={size} className={isRefreshing ? "animate-spin" : ""} />
      {isRefreshing ? "..." : "Làm mới"}
    </button>
  );

  const ResetBtn = ({ size = 14, className = "tool-action" }: { size?: number; className?: string }) => (
    <button onClick={handleReset} disabled={isResetting} className={`${className} flex items-center gap-1`} title="Xoá kết quả, bắt đầu phiên mới">
      <RotateCcw size={size} className={isResetting ? "animate-spin" : ""} />
      {isResetting ? "..." : "Reset"}
    </button>
  );

  const WordCloudDisplay = ({ wordFrequency, totalSubmissions }: { wordFrequency: Record<string, number>; totalSubmissions: number }) => {
    const maxFrequency = Math.max(...Object.values(wordFrequency), 1);
    const sortedWords = Object.entries(wordFrequency).sort(([, a], [, b]) => b - a).slice(0, 50);
    return (
      <>
        <div className="bg-[rgb(var(--surface-muted))] rounded-xl p-6 min-h-64 flex items-center justify-center">
          <div className="flex flex-wrap gap-3 justify-center items-center">
            {sortedWords.length > 0 ? sortedWords.map(([word, freq], idx) => (
              <span
                key={word}
                className={`px-3 py-1.5 rounded-full font-semibold text-white ${WORD_GRADIENTS[idx % WORD_GRADIENTS.length]} transition-transform hover:scale-110`}
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
        <div className="tool-header border-b border-token pb-4">
          <div className="flex items-center gap-3">
            <span className="tool-icon"><WordCloudIcon size={22} strokeWidth={1.75} /></span>
            <h3 className="tool-title">Word Cloud Đang Diễn Ra</h3>
          </div>
          <div className="flex gap-2">
            {!isStateless && <RefreshBtn size={14} className="tool-action" />}
            <ResetBtn size={14} className="tool-action" />
            <button onClick={() => setIsFullscreen(false)} className="tool-action">⛶ Thoát</button>
          </div>
        </div>

        <div className="flex-1">
          {cloudUrl ? (
            <div className="mt-6">
              {/* QR nhỏ ở góc, bấm để phóng popup — đám mây từ được rộng hết chỗ. */}
              <JoinQrCard
                url={cloudUrl}
                title="Quét để gửi từ khoá"
                className="fixed bottom-6 left-6 z-40"
              />
              <div>
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
          <RefreshBtn size={14} className="tool-action mt-6 w-full justify-center" />
        )}
      </div>
    );
  }

  // ── Normal active view ──────────────────────────────────────────────────────
  if (currentCloud && (results || isStateless)) {
    const wordFrequency = getWordFrequency();
    const totalSubmissions = isStateless ? submissions.length : (results?.totalSubmissions || 0);

    return (
      <div className="tool-panel">
        <div className="tool-header">
          <div className="flex items-center gap-2">
            <span className="tool-icon"><WordCloudIcon size={22} strokeWidth={1.75} /></span>
            <h3 className="tool-title">Word Cloud Đang Diễn Ra</h3>
          </div>
          <div className="flex gap-2">
            {!isStateless && <RefreshBtn />}
            <ResetBtn />
            <button onClick={() => setIsFullscreen(true)} className="tool-action">⛶ Full</button>
            {onExit && <button onClick={onExit} className="tool-action">✕ Exit</button>}
          </div>
        </div>

        {/* Câu hỏi ở giữa, QR nhỏ nép góc phải; bấm QR để phóng popup.
            Cột đệm bên trái giữ câu hỏi nằm giữa thật. */}
        <div className="mb-4 flex items-start gap-3">
          {cloudUrl && <div aria-hidden className="hidden w-[7.5rem] shrink-0 sm:block" />}
          <p className="min-w-0 flex-1 text-lg font-semibold text-center">{currentCloud.prompt}</p>
          {cloudUrl && (
            <JoinQrCard url={cloudUrl} title="Quét để gửi từ khoá" className="shrink-0" />
          )}
        </div>
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
          <RefreshBtn size={14} className="tool-action mt-6 w-full justify-center" />
        )}
      </div>
    );
  }

  // ── Create form ─────────────────────────────────────────────────────────────
  return (
    <div className="tool-panel">
      <div className="flex items-center gap-2">
        <span className="tool-icon"><WordCloudIcon size={22} strokeWidth={1.75} /></span>
        <h3 className="tool-title">Tạo Word Cloud</h3>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="tool-section-label">Câu hỏi</label>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateCloud()}
            placeholder="Nhập câu hỏi cho học viên..."
            maxLength={1000}
            className="input w-full"
          />
          <p className="text-xs text-muted mt-1">{prompt.length}/1000</p>
        </div>

        <button onClick={handleCreateCloud} disabled={isCreating} className="btn-primary w-full">
          {isCreating ? "Đang tạo..." : "Bắt đầu Word Cloud"}
        </button>
      </div>

      {/* History */}
      <ToolHistory<WordCloudHistoryItem>
        kind="word_cloud"
        heading="Word cloud đã tạo trước đây"
        noun="word cloud"
        listUrl="/api/classroom/word-cloud/list"
        toEntry={(item) => ({
          id: item.id,
          title: item.prompt,
          responseCount: item._count.submissions,
          createdAt: item.createdAt,
          deletedAt: item.deletedAt,
        })}
        onOpen={handleLoadCloud}
        containerClassName="space-y-2 max-h-80 overflow-y-auto"
        renderItem={(item) => (
          <>
            <p className="text-sm font-medium truncate">{item.prompt}</p>
            <p className="text-xs text-muted mt-0.5">
              {item._count.submissions} gửi · {formatDateTime(item.createdAt)}
            </p>
          </>
        )}
      />
    </div>
  );
}
