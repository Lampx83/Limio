"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Info, LogOut, X } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { usePacedReveal } from "@/hooks/usePacedReveal";
import UserAvatar from "@/components/ui/UserAvatar";
import SafeHtml from "@/components/SafeHtml";
import FullscreenGate from "./FullscreenGate";
import InRoomConfirm from "./InRoomConfirm";
import RoomCountdown from "./RoomCountdown";
import { useVisualViewport } from "@/hooks/useVisualViewport";
import TabBlurWarning from "./TabBlurWarning";
import MultiTabDetector from "./MultiTabDetector";
import OralAiAvatar, { type OralAvatarState } from "./OralAiAvatar";


interface Turn {
  role: "student" | "examiner";
  content: string;
}

interface Props {
  examId: string;
  attemptId: string;
  examTitle: string;
  courseTitle: string;
  startedAt: string;
  durationSec: number;
  serverNow: string;
  initialTurns: Turn[];
  submittedUrl: string;
  /** Trang khoá học — nút "Thoát" quay lại đây. Bài làm vẫn ở nguyên trạng
   * thái đang thi, resume được khi vào lại (không phải nộp bài). */
  exitUrl: string;
  /** Hướng dẫn/thông báo do GV soạn (richtext) — hiện ở panel bên phải. */
  instructionsHtml: string | null;
  /** Tên hiển thị của sinh viên — cho avatar tròn trong khung chat. */
  studentName?: string | null;
  /** Ảnh đại diện sinh viên; không có thì UserAvatar tự fallback initial. */
  studentImageUrl?: string | null;
  /**
   * Giáo viên thử vấn đáp: cùng giao diện phòng thật nhưng KHÔNG có lượt thi — hội thoại đi qua
   * /oral-preview/turn (client gửi kèm lịch sử, server không lưu gì), tắt heartbeat/ghi sự cố/phát hiện nhiều tab,
   * kết thúc thì quay về exitUrl thay vì trang "đã nộp".
   */
  preview?: boolean;
  /**
   * A6.7 — chủ đề đang thử (bản thử không có lượt thi nên không có chủ đề được giao). Chỉ có nghĩa khi
   * preview=true; trang Thử giữ cố định cho cả buổi và mỗi lượt gửi lại.
   */
  previewTopicId?: string | null;
  /** A6.8 — thẻ "Tình huống của bạn" ghim trong phòng thi (chỉ khi chủ đề có mô tả cho sinh viên). */
  topicCard?: { title: string; text: string } | null;
}

const FRIENDLY_ERROR: Record<string, string> = {
  openai_not_configured: "Admin chưa cấu hình OpenAI key — báo giảng viên/admin.",
  rate_limited: "Bạn thao tác quá nhanh, đợi một chút rồi thử lại.",
  global_token_cap: "Hệ thống đã chạm trần AI hôm nay — báo giảng viên, đây không phải lỗi của bạn.",
};

export default function OralExamRoom({
  examId,
  attemptId,
  examTitle,
  courseTitle,
  startedAt,
  durationSec,
  serverNow,
  initialTurns,
  submittedUrl,
  exitUrl,
  instructionsHtml,
  studentName,
  studentImageUrl,
  preview = false,
  previewTopicId = null,
  topicCard = null,
}: Props) {
  const router = useRouter();
  const [turns, setTurns] = useState<Turn[]>(initialTurns);
  const [questionsAsked, setQuestionsAsked] = useState(
    initialTurns.filter((t) => t.role === "examiner").length,
  );
  const [ended, setEnded] = useState(false);
  // Sinh viên đang chủ động kết thúc (hoặc hết giờ) — tắt cờ chặn toàn màn
  // hình từ đây để cổng toàn màn hình không hiểu nhầm việc rời phòng là gian lận.
  const [isEnding, setIsEnding] = useState(false);
  // Hộp xác nhận nằm trong trang (InRoomConfirm), KHÔNG dùng window.confirm(): hộp thoại gốc làm trình duyệt
  // rớt khỏi toàn màn hình và có thể trả về false ngay, khiến bấm "Kết thúc" phải lặp lại 2–3 lần.
  const [confirmKind, setConfirmKind] = useState<"end" | "leave" | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const [pasteBlocked, setPasteBlocked] = useState(false);
  const reveal = usePacedReveal();
  const kickedOff = useRef(false);
  const [started, setStarted] = useState(!preview);
  const scrollRef = useRef<HTMLDivElement>(null);
  // { acc, doneData } của lượt SSE vừa đóng — chờ paced reveal lộ hết acc rồi
  // mới thật sự chốt vào `turns` (xem effect bên dưới). Tách khỏi state vì
  // đây là dữ liệu trung gian, không cần re-render riêng.
  const finalizeRef = useRef<{
    acc: string;
    doneData: { ended: boolean; questionsAsked: number } | null;
  } | null>(null);
  // Đọc trạng thái mới nhất bên trong interval hết giờ mà không phải liệt
  // kê turns/ended/input/streaming vào dependency array (tick lại mỗi giây).
  const liveRef = useRef({ turns, ended, input, streaming });
  liveRef.current = { turns, ended, input, streaming };

  const clockSkewMs = useMemo(
    () => new Date(serverNow).getTime() - Date.now(),
    [serverNow],
  );
  const deadlineEpoch = useMemo(
    () => new Date(startedAt).getTime() + durationSec * 1000,
    [startedAt, durationSec],
  );
  // Đồng hồ và mọi lần dựng lại mỗi giây nằm trong RoomCountdown — phòng thi (và ô nhập) không dựng lại theo.
  const vp = useVisualViewport();
  // Bàn phím ảo đang mở (khung nhìn thấp): ẩn "sân khấu" avatar và ghim câu hỏi hiện tại sát ô nhập.
  const compact = vp !== null && vp.height < 560;
  const [pinExpanded, setPinExpanded] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const sendTurn = useCallback(
    async (message: string | null, opts?: { forceEnd?: boolean }) => {
      setError(null);
      setStreaming(true);
      reveal.reset();
      finalizeRef.current = null;
      // Bản thử không lưu hội thoại ở server nên phải gửi kèm lịch sử TRƯỚC câu trả lời này.
      const historyBefore = liveRef.current.turns;
      if (message !== null) {
        setTurns((prev) => [...prev, { role: "student", content: message }]);
      }

      let acc = "";
      let doneData: { ended: boolean; questionsAsked: number } | null = null;
      try {
        const res = await fetch(
          apiUrl(
            preview
              ? `/api/exams/${examId}/oral-preview/turn`
              : `/api/exams/${examId}/oral-attempt/${attemptId}/turn`,
          ),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: message ?? undefined,
              forceEnd: opts?.forceEnd || undefined,
              ...(preview ? { history: historyBefore, topicId: previewTopicId ?? undefined } : {}),
            }),
          },
        );
        if (!res.ok || !res.body) {
          const d = await res.json().catch(() => ({}));
          setError(typeof d?.error === "string" ? d.error : "stream_failed");
          setStreaming(false);
          return;
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let leftover = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          leftover += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = leftover.indexOf("\n\n")) >= 0) {
            const raw = leftover.slice(0, idx);
            leftover = leftover.slice(idx + 2);
            let event = "message";
            const dataLines: string[] = [];
            for (const line of raw.split("\n")) {
              if (line.startsWith("event: ")) event = line.slice(7);
              else if (line.startsWith("data: ")) dataLines.push(line.slice(6));
            }
            const data = dataLines.join("\n");
            if (event === "delta") {
              acc += data;
              reveal.push(acc);
            } else if (event === "done") {
              try {
                doneData = JSON.parse(data);
              } catch {
                /* ignore */
              }
            } else if (event === "error") {
              try {
                const parsed = JSON.parse(data);
                setError(parsed.code ?? "unknown");
              } catch {
                setError("unknown");
              }
            }
          }
        }
      } catch (e) {
        setError((e as Error).message || "stream_failed");
      }

      // Không chốt vào `turns` ngay — nếu acc có nội dung, để paced reveal lộ
      // hết rồi effect bên dưới mới chốt (giữ nhịp gõ đều, không phụ thuộc
      // network xong nhanh hay chậm). acc rỗng (lỗi trước khi có delta nào)
      // thì chốt ngay vì không có gì để lộ dần.
      if (acc) {
        finalizeRef.current = { acc, doneData };
      } else {
        setStreaming(false);
        if (doneData) {
          setQuestionsAsked(doneData.questionsAsked);
          if (doneData.ended) setEnded(true);
        }
      }
    },
    [examId, attemptId, reveal, preview],
  );

  // Chốt lượt AI vào lịch sử NGAY KHI paced reveal lộ hết đoạn vừa nhận —
  // tách khỏi thời điểm SSE đóng kết nối (xem sendTurn).
  useEffect(() => {
    const pending = finalizeRef.current;
    if (!pending || reveal.revealed !== pending.acc) return;
    setTurns((prev) => [...prev, { role: "examiner", content: pending.acc }]);
    setStreaming(false);
    if (pending.doneData) {
      setQuestionsAsked(pending.doneData.questionsAsked);
      if (pending.doneData.ended) setEnded(true);
    }
    finalizeRef.current = null;
  }, [reveal.revealed]);

  // Lượt đầu tiên: AI đặt câu hỏi mở màn, KHÔNG có câu trả lời của sinh viên
  // đi kèm — runOralExamTurn yêu cầu message=null khi chưa có turn nào.
  useEffect(() => {
    // Bản thử chờ giáo viên bấm "Vào toàn màn hình & bắt đầu" rồi mới gọi AI (không tốn token khi chỉ mở trang).
    if (!started) return;
    if (kickedOff.current) return;
    if (initialTurns.length === 0) {
      kickedOff.current = true;
      void sendTurn(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  // Lời kết dài (có "Nhìn lại buổi vấn đáp") không tự chuyển trang sau 3 giây — sinh viên cần thời gian đọc,
  // và có nút "Hoàn tất" để tự thoát.
  const closingLength = ended ? (turns[turns.length - 1]?.content.length ?? 0) : 0;
  const longClosing = closingLength > 320;
  useEffect(() => {
    if (ended && !longClosing) {
      const t = setTimeout(() => router.push(preview ? exitUrl : submittedUrl), 3_000);
      return () => clearTimeout(t);
    }
  }, [ended, longClosing, router, submittedUrl, exitUrl, preview]);

  // A6.5 — Heartbeat cho dashboard giám thị realtime (cùng endpoint/nhịp thi
  // viết đang dùng — generic theo attemptId, không cần sửa gì bên đó).
  useEffect(() => {
    if (preview) return; // bản thử không có lượt thi để báo nhịp
    let cancelled = false;
    const ping = () => {
      fetch(apiUrl(`/api/exam-attempts/${attemptId}/heartbeat`), {
        method: "POST",
      }).catch(() => undefined);
    };
    ping();
    const t = setInterval(() => {
      if (!cancelled) ping();
    }, 10_000);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [attemptId, preview]);

  // Hết giờ giữa chừng: gửi nốt câu trả lời đang gõ dở (hoặc một câu báo hết giờ) để buổi thi được đóng
  // đúng qua runOralExamTurn, thay vì treo mãi ở in_progress. Chỉ làm khi đã có ít nhất 1 câu hỏi và chưa
  // đang chờ 1 lượt khác chạy (turns rỗng/đang streaming nghĩa là lượt mở màn còn đang chạy/lỗi — không có
  // gì hợp lệ để gửi kèm).
  const handleExpire = () => {
    const live = liveRef.current;
    if (!live.ended && !live.streaming && live.turns.length > 0) {
      setIsEnding(true);
      const finalMessage = live.input.trim() || "(Đã hết giờ, không kịp trả lời.)";
      setInput("");
      // Bản thử không có đồng hồ phía server — chủ động báo hết giờ bằng forceEnd.
      void sendTurn(finalMessage, preview ? { forceEnd: true } : undefined);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, reveal.revealed]);

  const logIncident = useCallback(
    async (type: string, payload?: Record<string, unknown>) => {
      if (preview) return; // bản thử: không ghi sự cố vì không có lượt thi
      try {
        await fetch(apiUrl(`/api/exam-attempts/${attemptId}/incidents`), {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ type, payload }),
        });
      } catch {
        // Best-effort — mất mạng tự nó đã là 1 dấu hiệu, không cần báo lỗi ở đây.
      }
    },
    [attemptId, preview],
  );

  // A6.6 — chặn dán vào ô trả lời (câu trả lời phải do SV tự gõ tại chỗ),
  // khác ExamPlayer (thi viết) vốn chỉ GHI NHẬN lần dán để GV xem lại chứ
  // không chặn — ở đây chặn hẳn vì vấn đáp là hội thoại tức thời, dán nội
  // dung soạn sẵn (kể cả từ AI khác) mất hết ý nghĩa "tự trả lời trực tiếp".
  function handlePasteBlock(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    e.preventDefault();
    const text = e.clipboardData.getData("text");
    logIncident("paste_blocked", { length: text.length });
    setPasteBlocked(true);
    setTimeout(() => setPasteBlocked(false), 2500);
  }

  const canAnswer =
    !ended &&
    !streaming &&
    turns.length > 0 &&
    turns[turns.length - 1]!.role === "examiner";

  function submit() {
    const text = input.trim();
    if (!text || !canAnswer) return;
    setInput("");
    void sendTurn(text);
  }

  function endEarly() {
    if (!canAnswer) return;
    setConfirmKind("end");
  }

  function confirmEnd() {
    setConfirmKind(null);
    setIsEnding(true);
    setInput("");
    void sendTurn(null, { forceEnd: true });
  }

  function confirmLeave() {
    setConfirmKind(null);
    setIsEnding(true);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    router.push(exitUrl);
  }

  // Rời phòng thi (kết thúc xong, hoặc thoát): thoát toàn màn hình CÓ CHỦ Ý. Trước đây việc này xảy ra ngẫu
  // nhiên nhờ confirm() làm rớt chế độ; giờ không còn hộp thoại gốc nên phải tự làm, nếu không trang kế tiếp
  // (điều hướng SPA cùng một tài liệu) vẫn kẹt trong toàn màn hình.
  useEffect(() => {
    if (ended && document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
  }, [ended]);
  useEffect(() => {
    return () => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => undefined);
    };
  }, []);

  const lastExaminer = [...turns].reverse().find((t) => t.role === "examiner") ?? null;

  const avatarState: OralAvatarState = ended
    ? "idle"
    : streaming
      ? reveal.revealed
        ? "talking"
        : "thinking"
      : "idle";

  return (
    <div
      className="fixed inset-x-0 top-0 z-40 flex h-[100dvh] flex-col bg-[rgb(var(--surface-muted))]"
      style={vp ? { height: vp.height, top: vp.offsetTop } : undefined}
    >
      <FullscreenGate
        examTitle={examTitle}
        onEnter={() => setStarted(true)}
        required={!isEnding && !ended}
        preview={preview}
      />
      {confirmKind && !ended && !isEnding && (
        <InRoomConfirm
          danger={confirmKind === "end"}
          title={confirmKind === "end" ? "Kết thúc buổi vấn đáp?" : preview ? "Thoát bản thử?" : "Rời phòng vấn đáp?"}
          message={
            confirmKind === "end"
              ? "Không thể tiếp tục sau khi kết thúc."
              : preview
                ? "Hội thoại thử sẽ mất."
                : "Bài làm vẫn giữ nguyên, quay lại sau để tiếp tục."
          }
          confirmLabel={confirmKind === "end" ? "Kết thúc ngay" : preview ? "Thoát bản thử" : "Rời phòng"}
          onConfirm={confirmKind === "end" ? confirmEnd : confirmLeave}
          onCancel={() => setConfirmKind(null)}
        />
      )}
      <TabBlurWarning onBlur={() => logIncident("tab_blur")} />
      {!preview && (
        <MultiTabDetector
          attemptId={attemptId}
          onConflict={(peerTabId) => logIncident("multi_tab", { peerTabId })}
        />
      )}

      <header className="relative flex items-center justify-between gap-3 border-b border-token bg-[rgb(var(--surface))] px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setConfirmKind("leave")}
            className="shrink-0 rounded-full p-1.5 text-faint hover:bg-[rgb(var(--surface-muted))] hover:text-ink"
            aria-label="Thoát phòng vấn đáp"
            title="Thoát phòng vấn đáp"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{examTitle}</p>
            <p className="truncate text-caption text-faint">{courseTitle}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {preview && (
            <span className="rounded-full bg-lime-100 px-2.5 py-1 text-xs font-semibold text-lime-800 dark:bg-lime-900/40 dark:text-lime-200">
              Bản thử · không lưu
            </span>
          )}
          <RoomCountdown
            deadlineEpoch={deadlineEpoch}
            clockSkewMs={clockSkewMs}
            totalSec={durationSec}
            onExpire={handleExpire}
          />
        </div>
      </header>

      {topicCard && (
        <details className="border-b border-token bg-[rgb(var(--surface))] px-4 py-2 text-sm sm:px-6">
          <summary className="cursor-pointer select-none font-medium">
            Tình huống của bạn: <span className="text-brand-700">{topicCard.title}</span>
          </summary>
          <p className="mt-2 max-h-40 overflow-y-auto whitespace-pre-line text-faint">{topicCard.text}</p>
        </details>
      )}

      <div className="flex min-h-0 flex-1 flex-col">
        {/* "Sân khấu" — avatar AI giám khảo ở giữa, phông nền có glow tạo cảm
            giác đang đối diện trực tiếp (face-to-face) thay vì chỉ là 1 icon
            phụ trong panel bên cạnh. Hiện ở mọi kích thước màn hình. */}
        <div
          className={`relative shrink-0 flex-col items-center justify-center gap-1.5 overflow-hidden border-b border-token bg-gradient-to-b from-brand-50 to-[rgb(var(--surface))] py-4 dark:from-slate-900 dark:to-[rgb(var(--surface))] ${compact ? "hidden" : "flex"}`}
        >
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-56 w-56 rounded-full bg-brand-300/30 blur-3xl dark:bg-brand-500/10 sm:h-80 sm:w-80" />
          </div>
          <div className="relative z-10">
            <OralAiAvatar state={avatarState} />
          </div>
          {instructionsHtml && (
            <button
              type="button"
              onClick={() => setShowInstructions(true)}
              className="relative z-10 inline-flex items-center gap-1.5 rounded-full border border-token bg-[rgb(var(--surface))]/90 px-3 py-1 text-xs font-medium text-faint hover:text-ink"
            >
              <Info className="h-3.5 w-3.5" />
              Xem hướng dẫn
            </button>
          )}
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
            <div className="mx-auto max-w-2xl space-y-4">
              {turns.length === 0 && !streaming && (
                <p className="text-center text-sm text-faint">Đang chuẩn bị câu hỏi đầu tiên…</p>
              )}
              {turns.map((t, i) => (
                <Bubble
                  key={i}
                  role={t.role}
                  content={t.content}
                  studentName={studentName}
                  studentImageUrl={studentImageUrl}
                />
              ))}
              {streaming && reveal.revealed && (
                <div onClick={() => reveal.skip()} className="cursor-pointer" title="Chạm để hiện hết">
                  <Bubble role="examiner" content={reveal.revealed} typing />
                </div>
              )}
              {streaming && !reveal.revealed && (
                <div className="flex items-center gap-1.5 pl-1 text-xs italic text-faint">
                  <span className="inline-flex gap-0.5">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: "0ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: "150ms" }} />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-brand-500" style={{ animationDelay: "300ms" }} />
                  </span>
                  AI giám khảo đang soạn câu hỏi…
                </div>
              )}
              {ended && (
                <div className="banner-success px-4 py-3 text-sm">
                  Buổi vấn đáp đã kết thúc. Đang chuyển sang trang xác nhận…
                </div>
              )}
              {error && (
                <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-800">
                  {preview && error === "openai_not_configured" ? "Hệ thống chưa cấu hình khoá OpenAI nên AI chưa hỏi được — thêm khoá ở phần tích hợp của quản trị rồi thử lại." : (FRIENDLY_ERROR[error] ?? `Lỗi: ${error}`)}
                </div>
              )}
            </div>
          </div>

          <footer className="border-t border-token bg-[rgb(var(--surface))] p-3 sm:p-4">
            {/* Bàn phím ảo mở thì khung chat gần như biến mất — ghim câu hỏi hiện tại sát ô nhập để khỏi phải
                tắt bàn phím đi đọc lại (phản ánh thật của sinh viên). Chạm để xem đủ. */}
            {compact && canAnswer && lastExaminer && (
              <button
                type="button"
                onClick={() => setPinExpanded((v) => !v)}
                className="mx-auto mb-2 block w-full max-w-2xl rounded-lg border border-token bg-[rgb(var(--surface-muted))] px-3 py-2 text-left text-sm"
              >
                <span className="font-semibold text-brand-700">Câu hỏi: </span>
                <span className={pinExpanded ? "" : "line-clamp-2"}>{lastExaminer.content}</span>
              </button>
            )}
            <div className="mx-auto flex max-w-2xl gap-2">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
                onPaste={handlePasteBlock}
                // Chỉ khoá khi buổi đã KẾT THÚC. Trước đây khoá cả lúc AI đang nói: ô nhập mất tiêu điểm sau mỗi
                // lượt, bàn phím ảo đóng rồi phải chạm mở lại. Giờ gõ sẵn được; chỉ việc GỬI mới chờ AI xong.
                disabled={ended}
                rows={2}
                placeholder={
                  ended
                    ? "Buổi vấn đáp đã kết thúc."
                    : canAnswer
                      ? "Trả lời câu hỏi... (Enter = gửi · Shift+Enter = xuống dòng)"
                      : "AI đang nói — bạn có thể gõ sẵn câu trả lời…"
                }
                className="textarea flex-1 resize-none text-sm"
              />
              <button
                // Giữ tiêu điểm ở ô nhập khi bấm Gửi để bàn phím ảo không đóng lại sau mỗi câu.
                onMouseDown={(e) => e.preventDefault()}
                onClick={submit}
                disabled={!canAnswer || !input.trim()}
                className="btn-sm self-stretch inline-flex items-center justify-center gap-2 rounded-lg bg-brand-600 px-5 font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                Gửi
              </button>
            </div>
            {pasteBlocked && (
              <div className="mx-auto mt-1.5 max-w-2xl text-xs text-red-600">
                Không thể dán nội dung vào ô trả lời — hãy tự gõ câu trả lời của bạn.
              </div>
            )}
            <div className="mx-auto mt-2 flex max-w-2xl justify-end">
              {ended ? (
                <button
                  type="button"
                  onClick={() => router.push(preview ? exitUrl : submittedUrl)}
                  className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Hoàn tất
                </button>
              ) : (
                <button
                  type="button"
                  onClick={endEarly}
                  disabled={!canAnswer}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-[rgb(var(--text-muted))] underline underline-offset-2 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  Kết thúc buổi vấn đáp
                </button>
              )}
            </div>
          </footer>
        </div>
      </div>

      {showInstructions && instructionsHtml && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setShowInstructions(false)}
        >
          <div
            className="max-h-[80vh] w-full max-w-md overflow-y-auto rounded-lg bg-[rgb(var(--surface))] p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold">Hướng dẫn</h2>
              <button
                type="button"
                onClick={() => setShowInstructions(false)}
                className="rounded p-1 text-faint hover:bg-[rgb(var(--surface-muted))] hover:text-ink"
                aria-label="Đóng"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SafeHtml html={instructionsHtml} className="prose prose-sm max-w-none dark:prose-invert" />
          </div>
        </div>
      )}
    </div>
  );
}

function Bubble({
  role,
  content,
  typing,
  studentName,
  studentImageUrl,
}: {
  role: "student" | "examiner";
  content: string;
  typing?: boolean;
  studentName?: string | null;
  studentImageUrl?: string | null;
}) {
  const isStudent = role === "student";
  return (
    <div className={`flex items-end gap-2 ${isStudent ? "justify-end" : "justify-start"}`}>
      {!isStudent && (
        <img
          src="/oral-avatar/idle-poster.png"
          alt="AI giám khảo"
          className="h-8 w-8 shrink-0 rounded-full object-cover shadow-sm"
        />
      )}
      <div
        className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
          isStudent
            ? "bg-sky-100 text-slate-800 dark:bg-sky-900/40 dark:text-sky-100"
            : "border border-token bg-[rgb(var(--surface))] text-[rgb(var(--text))]"
        }`}
      >
        <p className="whitespace-pre-wrap leading-relaxed">{content}</p>
        {typing && <span className="ml-1 animate-pulse text-brand-500">▌</span>}
      </div>
      {isStudent && (
        <UserAvatar name={studentName} imageUrl={studentImageUrl} size="sm" className="shrink-0" />
      )}
    </div>
  );
}
