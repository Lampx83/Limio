"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, RotateCcw, Send, Square } from "lucide-react";
import { formatClock } from "@/lib/audioRecorder";
import { useAudioRecorder } from "@/components/useAudioRecorder";
import { voiceErrorMessage } from "@/lib/practiceEssayView";
import { FREECHAT_MAX_CHARS, freeChatErrorMessage, restoreChat, transcriptOf, usedTargets, type ChatMsg, type FreeChatView } from "@/lib/freeChatView";
import { VoiceUseError, markNoticeSeen, noticeSeen } from "./EssayVoiceAnswer";

/** Mỗi lần ghi âm tối đa 30 giây (docs/tieu-chi/limio-language-noi-tu-do-voi-ban-ao.md, AC1). */
const VOICE_MAX_SECONDS = 30;

/** Mã lỗi (của máy chủ hoặc "network") mà `send` ném ra. */
export class FreeChatError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

/**
 * "Thử nói tự do": hội thoại với bạn ảo (chatbot đóng vai), gõ hoặc nói. Lịch sử do trình duyệt giữ và gửi lại mỗi lượt (`send`); bản chữ
 * cả hai bên đưa lên qua `onAnswer` sau mỗi lượt xong để tải lại không mất. Nói: ghi âm → chuyển chữ (`transcribe`) → điền vào ô để học viên
 * đọc lại, sửa rồi mới gửi (không tự gửi); bản ghi không được lưu. Cụm gợi ý hiện ✓ khi học viên đã dùng. Không điểm; nhận xét ở thẻ câu hỏi bên ngoài.
 */
export default function FreeChat({
  view,
  savedText,
  preview,
  voiceEnabled = true,
  send,
  transcribe,
  onAnswer,
}: {
  view: FreeChatView;
  savedText: string;
  preview: boolean;
  /** Câu cho trả lời bằng giọng nói (`voiceAnswer`, mặc định bật); tắt thì không hiện nút "Nói". */
  voiceEnabled?: boolean;
  send: (history: ChatMsg[], message: string) => Promise<string>;
  transcribe: (turn: number, file: File) => Promise<string>;
  onAnswer: (text: string) => void;
}) {
  const [history, setHistory] = useState<ChatMsg[]>(() => restoreChat(savedText, view) ?? []);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [stt, setStt] = useState(false);
  const [finished, setFinished] = useState(() => (restoreChat(savedText, view)?.length ?? 0) / 2 >= view.maxTurns);
  const [error, setError] = useState<string | null>(null);
  // Mặc định coi là đã thấy để máy chủ và trình duyệt dựng giống nhau; đọc localStorage sau khi mount.
  const [seen, setSeen] = useState(true);
  useEffect(() => setSeen(noticeSeen()), []);

  const turns = history.length / 2;
  const live = useRef({ history });
  live.current = { history };
  const log = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const busy = pending !== null || stt;
  const rec = useAudioRecorder({ maxSeconds: VOICE_MAX_SECONDS, onRecorded: (file) => void handleRecorded(file) });
  const recording = rec.state === "recording";

  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length, pending]);

  async function handleRecorded(file: File) {
    setStt(true);
    setError(null);
    try {
      const text = await transcribe(live.current.history.length / 2, file);
      markNoticeSeen();
      setSeen(true);
      setDraft((d) => `${d ? `${d.trim()} ` : ""}${text.trim()}`.slice(0, FREECHAT_MAX_CHARS));
    } catch (e) {
      setError(voiceErrorMessage(e instanceof VoiceUseError ? e.code : "network"));
    } finally {
      setStt(false);
    }
  }

  async function submit() {
    const message = draft.replace(/\s+/g, " ").trim(); // một dòng: bản chữ lưu theo từng dòng "Learner: …"
    if (!message || busy || finished || recording) return;
    setPending(message);
    setError(null);
    try {
      const reply = await send(history, message);
      const next: ChatMsg[] = [...history, { role: "learner", text: message }, { role: "partner", text: reply }];
      setHistory(next);
      setDraft("");
      onAnswer(transcriptOf(view, next));
      if (next.length / 2 >= view.maxTurns) setFinished(true);
    } catch (e) {
      setError(freeChatErrorMessage(e instanceof FreeChatError ? e.code : "network")); // lời đã nhập vẫn còn trong ô
    } finally {
      setPending(null);
      setTimeout(() => inputRef.current?.focus(), 0); // trả tiêu điểm cho ô nhập để gõ tiếp
    }
  }

  function restart() {
    if (busy || recording) return;
    if (turns >= 2 && !window.confirm("Bắt đầu lại sẽ xoá hội thoại hiện tại. Tiếp tục?")) return;
    setHistory([]);
    setDraft("");
    setFinished(false);
    setError(null);
    onAnswer("");
  }

  const used = usedTargets(
    view.targets,
    history.filter((m) => m.role === "learner").map((m) => m.text),
  );
  const shown: ChatMsg[] = [{ role: "partner", text: view.opening }, ...history, ...(pending !== null ? [{ role: "learner" as const, text: pending }] : [])];
  const full = draft.length >= FREECHAT_MAX_CHARS;
  const micError = rec.error && !recording ? rec.error : null;

  return (
    <div className="fc" data-testid="freechat">
      <p className="fc-scenario">{view.scenario}</p>

      {view.targets.length > 0 && (
        <details className="fc-targets" open>
          <summary>
            Cụm gợi ý ({used.filter(Boolean).length}/{view.targets.length} đã dùng)
          </summary>
          <ul>
            {view.targets.map((t, i) => (
              <li key={i} data-used={used[i] ? "" : undefined}>
                <span aria-hidden>{used[i] ? "✓" : "·"}</span> {t}
                {used[i] && <span className="sr-only"> (đã dùng)</span>}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div ref={log} className="fc-log" role="log" aria-label="Hội thoại với bạn ảo" aria-live="polite">
        {shown.map((m, i) => (
          <div key={i} className="fc-msg" data-role={m.role} data-pending={pending !== null && i === shown.length - 1 ? "" : undefined}>
            <span className="fc-who">{m.role === "partner" ? view.partnerRole : view.learnerRole}</span>
            <span className="sr-only">{m.role === "partner" ? "Bạn ảo nói: " : "Bạn nói: "}</span>
            <p>{m.text}</p>
          </div>
        ))}
        {pending !== null && (
          <p className="fc-typing" role="status">
            Bạn ảo đang trả lời…
          </p>
        )}
      </div>

      {!finished ? (
        <div className="fc-compose">
          <textarea
            ref={inputRef}
            className="fc-input"
            rows={2}
            value={draft}
            maxLength={FREECHAT_MAX_CHARS}
            disabled={busy || recording}
            placeholder="Gõ hoặc bấm micro để nói…"
            aria-label="Lời của bạn"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void submit();
              }
            }}
          />
          <div className="fc-actions">
            {recording ? (
              <button type="button" className="fc-btn fc-btn-primary" onClick={rec.stop} aria-label="Dừng ghi âm">
                <Square size={14} aria-hidden /> Dừng{" "}
                <span role="timer" aria-live="off" className="fc-timer">
                  {formatClock(rec.seconds)} / {formatClock(VOICE_MAX_SECONDS)}
                </span>
              </button>
            ) : voiceEnabled ? (
              <button type="button" className="fc-btn" disabled={busy} onClick={() => void rec.start()} aria-label={stt ? "Đang chuyển lời nói thành chữ" : "Ghi âm lời của bạn"} aria-busy={stt}>
                <Mic size={14} aria-hidden /> {stt ? "Đang nghe…" : "Nói"}
              </button>
            ) : null}
            <button type="button" className="fc-btn fc-btn-primary" disabled={busy || recording || !draft.trim()} onClick={() => void submit()}>
              <Send size={14} aria-hidden /> Gửi
            </button>
            <span className="fc-count" aria-live="off">
              Lượt {Math.min(turns + 1, view.maxTurns)}/{view.maxTurns}
              {full ? " · đã đủ 300 ký tự" : ""}
            </span>
          </div>
        </div>
      ) : (
        <p className="fc-hint" role="status">
          Hội thoại đã kết thúc. Bấm “Nhận xét bằng AI” bên dưới, hoặc bắt đầu lại.
        </p>
      )}

      <div className="fc-foot">
        {!finished && turns >= 1 && (
          <button type="button" className="fc-link" disabled={busy || recording} onClick={() => setFinished(true)}>
            Kết thúc
          </button>
        )}
        <button type="button" className="fc-link" disabled={busy || recording || (turns === 0 && !draft)} onClick={restart}>
          <RotateCcw size={12} aria-hidden /> Bắt đầu lại
        </button>
        <span className="fc-hint">
          {preview ? "Xem thử: bạn ảo trả lời thật (trừ token của thầy/cô) nhưng không lưu gì. " : ""}
          {!seen ? "Bản ghi âm được gửi tới OpenAI để chuyển thành chữ khi bạn bấm Dừng; hệ thống không lưu bản ghi." : ""}
        </span>
      </div>

      {(error ?? micError) && (
        <p role="alert" className="banner-danger text-xs" data-testid="fc-error">
          {error ?? micError}
        </p>
      )}
    </div>
  );
}
