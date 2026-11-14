"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Play, RotateCcw, Send, Square, Volume2, VolumeX } from "lucide-react";
import { formatClock } from "@/lib/audioRecorder";
import { useAudioRecorder } from "@/components/useAudioRecorder";
import { voiceErrorMessage } from "@/lib/practiceEssayView";
import { FREECHAT_MAX_CHARS, freeChatErrorMessage, restoreChat, transcriptOf, usedTargets, type ChatMsg, type FreeChatView, type PartnerReply, type PartnerSpeech } from "@/lib/freeChatView";
import { usePacedReveal } from "@/hooks/usePacedReveal";
import { VoiceUseError } from "./EssayVoiceAnswer";
import { usePartnerVoice } from "./usePartnerVoice";

/** Mỗi lần ghi âm tối đa 30 giây (docs/tieu-chi/limio-language-noi-tu-do-voi-ban-ao.md, AC1). */
const VOICE_MAX_SECONDS = 30;

/** Tốc độ chữ bạn ảo hiện ra (ký tự/giây): gần nhịp người gõ, chậm hơn giọng đọc một chút để mắt kịp. */
const TYPING_CHARS_PER_SEC = 38;
/** Đợi giọng đọc lời mở đầu tối đa chừng này rồi cứ hiện chữ (giọng tới sau vẫn phát). */
const OPENING_SPEECH_WAIT_MS = 5000;
const VOICE_OFF_KEY = "freechat-partner-voice-off";

const prefersReducedMotion = () => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Mã lỗi (của máy chủ hoặc "network") mà `send` ném ra. */
export class FreeChatError extends Error {
  constructor(public readonly code: string) {
    super(code);
  }
}

/**
 * "Thử nói tự do": hội thoại với bạn ảo (chatbot đóng vai), gõ hoặc nói. Học viên bấm "Bắt đầu" thì bạn ảo nói trước: chữ hiện dần như đang gõ và
 * được đọc thành tiếng cùng lúc (giọng do máy chủ trả; đọc lỗi thì vẫn có chữ). Có "Nghe lại" từng câu, "Hiện hết" để bỏ qua nhịp gõ, và tắt/bật giọng. Lịch sử do trình duyệt giữ và gửi lại mỗi lượt (`send`); bản chữ
 * cả hai bên đưa lên qua `onAnswer` sau mỗi lượt xong để tải lại không mất. Nói: ghi âm → chuyển chữ (`transcribe`) → điền vào ô để học viên
 * đọc lại, sửa rồi mới gửi (không tự gửi); bản ghi không được lưu. Cụm gợi ý hiện ✓ khi học viên đã dùng. Không điểm; nhận xét ở thẻ câu hỏi bên ngoài.
 */
export default function FreeChat({
  view,
  savedText,
  preview,
  voiceEnabled = true,
  send,
  openingSpeech,
  transcribe,
  onAnswer,
  animate = true,
}: {
  view: FreeChatView;
  savedText: string;
  preview: boolean;
  /** Câu cho trả lời bằng giọng nói (`voiceAnswer`, mặc định bật); tắt thì không hiện nút "Nói". */
  voiceEnabled?: boolean;
  /** Trả lời của bạn ảo: chuỗi (chỉ chữ) hoặc `{ text, speech }` có kèm giọng đọc. */
  send: (history: ChatMsg[], message: string) => Promise<string | PartnerReply>;
  /** Lấy giọng đọc lời mở đầu (máy chủ tự đọc từ cấu hình câu). Không truyền thì bạn ảo không có giọng. */
  openingSpeech?: () => Promise<PartnerSpeech | null>;
  transcribe: (turn: number, file: File) => Promise<string>;
  onAnswer: (text: string) => void;
  /** Hiện chữ bạn ảo dần (mặc định bật; tự tắt khi hệ điều hành đặt giảm chuyển động). */
  animate?: boolean;
}) {
  const [history, setHistory] = useState<ChatMsg[]>(() => restoreChat(savedText, view) ?? []);
  // Hội thoại khôi phục từ bản đã lưu thì đã bắt đầu rồi; ngược lại chờ học viên bấm "Bắt đầu" (bạn ảo mới nói câu mở đầu, không tốn gì trước đó).
  const [started, setStarted] = useState(() => (restoreChat(savedText, view)?.length ?? 0) > 0);
  const [preparing, setPreparing] = useState(false);
  const [typing, setTyping] = useState<{ idx: number; text: string } | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const reveal = usePacedReveal(TYPING_CHARS_PER_SEC);
  const voice = usePartnerVoice();
  /** Giọng đã có theo chỉ số tin trong khung chat (0 = lời mở đầu); null = đã thử mà không có. */
  const speeches = useRef(new Map<number, PartnerSpeech | null>());
  const [, setSpeechVersion] = useState(0); // `speeches` là ref: tăng số này để dựng lại khi có giọng mới (hiện nút "Nghe")
  const epoch = useRef(0);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState<string | null>(null);
  const [stt, setStt] = useState(false);
  const [finished, setFinished] = useState(() => (restoreChat(savedText, view)?.length ?? 0) / 2 >= view.maxTurns);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    try {
      setVoiceOn(localStorage.getItem(VOICE_OFF_KEY) !== "1");
    } catch {
      // không đọc được thì để bật
    }
  }, []);
  useEffect(
    () => () => {
      epoch.current++; // huỷ các chờ giọng đang dở khi rời trang
    },
    [],
  );
  // Chữ lộ hết thì bỏ trạng thái "đang gõ" (con trỏ nháy, khoá nút Gửi).
  useEffect(() => {
    if (typing && reveal.revealed === typing.text) setTyping(null);
  }, [reveal.revealed, typing]);

  const turns = history.length / 2;
  const live = useRef({ history });
  live.current = { history };
  const log = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const isTyping = typing !== null;
  const busy = pending !== null || stt || preparing;
  const rec = useAudioRecorder({ maxSeconds: VOICE_MAX_SECONDS, onRecorded: (file) => void handleRecorded(file) });
  const recording = rec.state === "recording";

  useEffect(() => {
    const el = log.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [history.length, pending, started, reveal.revealed]);

  /** Bắt đầu hiện dần chữ của tin thứ `idx` (nếu bật hiệu ứng) và phát giọng nếu có và đang bật. */
  function deliver(idx: number, text: string, speech: PartnerSpeech | null | undefined) {
    if (speech) speeches.current.set(idx, speech);
    setSpeechVersion((v) => v + 1);
    if (animate && !prefersReducedMotion()) {
      reveal.reset();
      reveal.push(text);
      setTyping({ idx, text });
    }
    if (speech && voiceOn) voice.play(`m${idx}`, speech);
  }

  async function begin() {
    if (started || preparing) return;
    voice.unlock(); // trong cú bấm: để giọng tải về sau vẫn phát được
    setStarted(true);
    const mine = ++epoch.current;
    let speech: PartnerSpeech | null = null;
    if (openingSpeech && voiceOn) {
      setPreparing(true);
      // Chữ và giọng bắt đầu cùng lúc: đợi giọng về (tối đa vài giây) rồi mới hiện.
      speech = await Promise.race([
        openingSpeech().catch(() => null),
        new Promise<null>((r) => setTimeout(() => r(null), OPENING_SPEECH_WAIT_MS)),
      ]);
      if (epoch.current !== mine) return;
      setPreparing(false);
    }
    deliver(0, view.opening, speech);
  }

  async function replay(idx: number) {
    if (voice.speakingKey === `m${idx}`) return voice.stop();
    voice.unlock();
    let speech = speeches.current.get(idx);
    // Lời mở đầu chưa có giọng (đang tắt giọng lúc bắt đầu, hoặc lần đọc trước lỗi, hoặc hội thoại khôi phục): lấy theo yêu cầu.
    if (!speech && idx === 0 && openingSpeech) {
      const mine = epoch.current;
      speech = await openingSpeech().catch(() => null);
      if (epoch.current !== mine) return;
      if (speech) {
        speeches.current.set(0, speech);
        setSpeechVersion((v) => v + 1);
      }
    }
    if (speech) voice.play(`m${idx}`, speech);
  }

  function toggleVoice() {
    const next = !voiceOn;
    setVoiceOn(next);
    if (!next) voice.stop();
    try {
      localStorage.setItem(VOICE_OFF_KEY, next ? "0" : "1");
    } catch {
      // không lưu được thì chỉ áp dụng lần này
    }
  }

  async function startMic() {
    voice.stop(); // đừng để micro thu lại giọng bạn ảo
    await rec.start();
  }

  async function handleRecorded(file: File) {
    setStt(true);
    setError(null);
    try {
      const text = await transcribe(live.current.history.length / 2, file);
      setDraft((d) => `${d ? `${d.trim()} ` : ""}${text.trim()}`.slice(0, FREECHAT_MAX_CHARS));
    } catch (e) {
      setError(voiceErrorMessage(e instanceof VoiceUseError ? e.code : "network"));
    } finally {
      setStt(false);
    }
  }

  async function submit() {
    const message = draft.replace(/\s+/g, " ").trim(); // một dòng: bản chữ lưu theo từng dòng "Learner: …"
    if (!message || busy || finished || recording || isTyping) return;
    voice.stop();
    setPending(message);
    setDraft(""); // tin đã chuyển lên khung chat như ứng dụng nhắn tin; lỗi thì trả lại vào ô bên dưới
    setError(null);
    try {
      const out = await send(history, message);
      const reply = typeof out === "string" ? { text: out, speech: null } : out;
      const next: ChatMsg[] = [...history, { role: "learner", text: message }, { role: "partner", text: reply.text }];
      setHistory(next);
      deliver(next.length, reply.text, reply.speech);
      onAnswer(transcriptOf(view, next));
      if (next.length / 2 >= view.maxTurns) setFinished(true);
    } catch (e) {
      setDraft((d) => (d.trim() ? d : message)); // lời đã nhập không mất: trả lại vào ô (trừ khi học viên đã gõ câu mới)
      setError(freeChatErrorMessage(e instanceof FreeChatError ? e.code : "network"));
    } finally {
      setPending(null);
      setTimeout(() => inputRef.current?.focus(), 0); // trả tiêu điểm cho ô nhập để gõ tiếp
    }
  }

  function restart() {
    if (busy || recording) return;
    if (turns >= 2 && !window.confirm("Bắt đầu lại sẽ xoá hội thoại hiện tại. Tiếp tục?")) return;
    epoch.current++;
    voice.stop();
    speeches.current.clear();
    reveal.reset();
    setTyping(null);
    setPreparing(false);
    setStarted(false); // quay về màn "Bắt đầu": bạn ảo nói lại câu mở đầu khi bấm
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

  const initial = (view.partnerRole.trim()[0] ?? "A").toUpperCase();
  const avatar = (big = false) => (
    <span className={big ? "fc-avatar fc-avatar-lg" : "fc-avatar"} aria-hidden>
      {initial}
    </span>
  );
  /** Bong bóng ba chấm "đang gõ" của bạn ảo (chờ lời mở đầu hoặc chờ câu trả lời). */
  const dots = (label: string) => (
    <div className="fc-row" data-role="partner">
      {avatar()}
      <div className="fc-dots" role="status">
        <span className="sr-only">{label}</span>
        <i aria-hidden />
        <i aria-hidden />
        <i aria-hidden />
      </div>
    </div>
  );

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

      <div className="fc-chat">
        <div className="fc-chat-head">
          {avatar()}
          <div className="fc-chat-title">
            <strong>{view.partnerRole}</strong>
            <span>Bạn ảo</span>
          </div>
          <div className="fc-chat-tools">
            {openingSpeech && (
              <button type="button" className="fc-tool" onClick={toggleVoice} aria-pressed={voiceOn} aria-label="Giọng bạn ảo" title={`Giọng bạn ảo: ${voiceOn ? "bật" : "tắt"}`}>
                {voiceOn ? <Volume2 size={17} aria-hidden /> : <VolumeX size={17} aria-hidden />}
              </button>
            )}
            {started && (
              <button type="button" className="fc-tool" disabled={busy || recording || (turns === 0 && !draft)} onClick={restart} aria-label="Bắt đầu lại" title="Bắt đầu lại">
                <RotateCcw size={16} aria-hidden />
              </button>
            )}
          </div>
        </div>

        {!started ? (
          <div className="fc-start">
            {avatar(true)}
            <p className="fc-hint">
              {view.partnerRole} sẽ nói trước{openingSpeech ? " — bật loa để nghe" : ""}.
            </p>
            <button type="button" className="fc-btn fc-btn-primary" onClick={() => void begin()}>
              <Play size={14} aria-hidden /> Bắt đầu
            </button>
          </div>
        ) : (
          <div ref={log} className="fc-log" role="log" aria-label="Hội thoại với bạn ảo" aria-live="polite">
            {preparing
              ? dots(`${view.partnerRole} đang chuẩn bị…`)
              : shown.map((m, i) => {
                  const typingNow = typing?.idx === i;
                  const canHear = m.role === "partner" && (speeches.current.has(i) || (i === 0 && !!openingSpeech));
                  const hearing = voice.speakingKey === `m${i}`;
                  return (
                    <div key={i} className="fc-row" data-role={m.role}>
                      {m.role === "partner" && avatar()}
                      <div
                        className="fc-msg"
                        data-role={m.role}
                        data-typing={typingNow ? "" : undefined}
                        data-pending={pending !== null && i === shown.length - 1 && m.role === "learner" ? "" : undefined}
                        onClick={typingNow ? reveal.skip : undefined}
                      >
                        <span className="sr-only">{m.role === "partner" ? `${view.partnerRole} nói: ` : "Bạn nói: "}</span>
                        {/* Đang gõ dần: người dùng đọc màn hình nghe cả câu một lần, không nghe từng chữ nhảy. */}
                        <p aria-hidden={typingNow || undefined}>{typingNow ? reveal.revealed : m.text}</p>
                        {typingNow && <span className="sr-only">{m.text}</span>}
                      </div>
                      {canHear && !typingNow && (
                        <button type="button" className="fc-replay" data-playing={hearing ? "" : undefined} onClick={() => void replay(i)} aria-label={hearing ? "Dừng nghe" : "Nghe lại câu này"} title={hearing ? "Dừng" : "Nghe lại"}>
                          {hearing ? <Square size={13} aria-hidden /> : <Volume2 size={16} aria-hidden />}
                        </button>
                      )}
                    </div>
                  );
                })}
            {pending !== null && dots("Bạn ảo đang trả lời…")}
          </div>
        )}

        {!started || preparing ? null : !finished ? (
          <div className="fc-compose">
            <div className="fc-field">
              <textarea
                ref={inputRef}
                className="fc-input"
                rows={1}
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
              {recording ? (
                <button type="button" className="fc-stop" onClick={rec.stop} aria-label="Dừng ghi âm">
                  <Square size={12} aria-hidden /> Dừng{" "}
                  <span role="timer" aria-live="off" className="fc-timer">
                    {formatClock(rec.seconds)} / {formatClock(VOICE_MAX_SECONDS)}
                  </span>
                </button>
              ) : voiceEnabled ? (
                <button type="button" className="fc-icon" disabled={busy} onClick={() => void startMic()} aria-label={stt ? "Đang chuyển lời nói thành chữ" : "Ghi âm lời của bạn"} title="Nói" aria-busy={stt}>
                  <Mic size={18} aria-hidden />
                </button>
              ) : null}
              <button type="button" className="fc-send" disabled={busy || recording || isTyping || !draft.trim()} onClick={() => void submit()} aria-label="Gửi" title="Gửi (Enter)">
                <Send size={16} aria-hidden />
              </button>
            </div>
            <div className="fc-meta">
              <span className="fc-count" aria-live="off">
                Lượt {Math.min(turns + 1, view.maxTurns)}/{view.maxTurns}
                {full ? " · đã đủ 300 ký tự" : ""}
              </span>
              {stt && (
                <span className="fc-hint" role="status">
                  Đang nghe…
                </span>
              )}
              {isTyping && (
                <button type="button" className="fc-link" onClick={reveal.skip}>
                  Hiện hết
                </button>
              )}
              {turns >= 1 && (
                <button type="button" className="fc-link" disabled={busy || recording} onClick={() => setFinished(true)}>
                  Kết thúc
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="fc-ended" role="status">
            Hội thoại đã kết thúc. Bấm “Nhận xét bằng AI” bên dưới, hoặc bắt đầu lại.
          </p>
        )}
      </div>

      {preview && <p className="fc-hint">Xem thử: bạn ảo trả lời thật (trừ token của thầy/cô) nhưng không lưu gì.</p>}

      {(error ?? micError) && (
        <p role="alert" className="banner-danger text-xs" data-testid="fc-error">
          {error ?? micError}
        </p>
      )}
    </div>
  );
}
