"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BookOpen, Mic, Play, RotateCcw, Send, Square, Volume2, VolumeX, X } from "lucide-react";
import { formatClock } from "@/lib/audioRecorder";
import { useAudioRecorder } from "@/components/useAudioRecorder";
import { voiceErrorMessage } from "@/lib/practiceEssayView";
import {
  FORMULA_EXAMPLE,
  FORMULA_STEPS,
  FREECHAT_MAX_CHARS,
  STUCK_GROUPS,
  freeChatErrorMessage,
  frameUsed,
  highlightSegments,
  hasBlank,
  insertIntoDraft,
  restoreChat,
  transcriptOf,
  usedTargets,
  type ChatMsg,
  type FreeChatView,
  type PartnerReply,
  type PartnerSpeech,
} from "@/lib/freeChatView";
import { usePacedReveal } from "@/hooks/usePacedReveal";
import { useT, useUiLang } from "@/lib/i18n/client";
import type { MessageKey } from "@/lib/i18n/dict";
import { VoiceUseError } from "./EssayVoiceAnswer";
import { usePartnerVoice } from "./usePartnerVoice";

/** Mỗi lần ghi âm tối đa 30 giây (docs/tieu-chi/limio-language-noi-tu-do-voi-ban-ao.md, AC1). */
const VOICE_MAX_SECONDS = 30;

/** Tốc độ chữ bạn ảo hiện ra (ký tự/giây): gần nhịp người gõ, chậm hơn giọng đọc một chút để mắt kịp. */
const TYPING_CHARS_PER_SEC = 38;
/** Đợi giọng đọc lời mở đầu tối đa chừng này rồi cứ hiện chữ (giọng tới sau vẫn phát). */
const OPENING_SPEECH_WAIT_MS = 5000;
const VOICE_OFF_KEY = "freechat-partner-voice-off";
/** Nhãn bốn nhóm của khay "Khi bị bí", cùng thứ tự với `STUCK_GROUPS`. */
const STUCK_LABEL_KEYS: MessageKey[] = ["practice.say.stuck.time", "practice.say.stuck.unknown", "practice.say.stuck.repeat", "practice.say.stuck.back"];

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
 *
 * Scaffolding cho người nói yếu (docs/tieu-chi/limio-language-ban-ao-scaffolding-moc-1.md): công thức 3 bước; gợi ý soạn sẵn của phiếu (`view.scaffold`:
 * ý tưởng, mẫu câu có chỗ trống `___` kèm nghĩa, từ hữu ích; bấm để chèn vào ô, bôi đen chỗ trống đầu tiên; lời còn `___` không gửi được); màn chuẩn bị
 * trước "Bắt đầu" (nghe thử từng mẫu câu qua `frameSpeech`); khay "Khi bị bí" (tiếng Anh, chỉ khi `language` là tiếng Anh).
 */
export default function FreeChat({
  view,
  savedText,
  preview,
  voiceEnabled = true,
  send,
  openingSpeech,
  frameSpeech,
  audioUrl,
  language = null,
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
  /** Giọng đọc mẫu câu thứ `index` của `view.scaffold.frames` (máy chủ đọc từ cấu hình). Không truyền thì mẫu câu không có nút "Nghe". */
  frameSpeech?: (index: number) => Promise<PartnerSpeech | null>;
  /** Đổi đường dẫn audio của đoạn mẫu (`/api/exam-assets/…`) thành URL đầy đủ (basePath). Không truyền thì dùng nguyên đường dẫn. */
  audioUrl?: (path: string) => string;
  /** Ngôn ngữ của khoá: khay "Khi bị bí" (câu tiếng Anh cố định) chỉ hiện khi là tiếng Anh. */
  language?: string | null;
  transcribe: (turn: number, file: File) => Promise<string>;
  onAnswer: (text: string) => void;
  /** Hiện chữ bạn ảo dần (mặc định bật; tự tắt khi hệ điều hành đặt giảm chuyển động). */
  animate?: boolean;
}) {
  const t = useT();
  const lang = useUiLang();
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
  const [notice, setNotice] = useState<string | null>(null);
  // "Ý tưởng" và "Cụm từ hữu ích" mở trước "Bắt đầu" rồi tự thu gọn (học viên mở lại được); "Mẫu câu" luôn mở vì là bảng theo dõi ✓.
  // Phần chuẩn bị là MỘT popup (một section) mở bằng nút "Chuẩn bị"; không còn nhiều khối rải trên trang.
  const [prepOpen, setPrepOpen] = useState(false);
  const uid = useId();
  const openerRef = useRef<HTMLElement | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [showTranscript, setShowTranscript] = useState(true);
  const modelAudio = useRef<HTMLAudioElement>(null);
  /** Giọng mẫu câu đã tải theo chỉ số; null = đã thử mà không có (ẩn nút "Nghe" của mẫu đó). */
  const frameSpeeches = useRef(new Map<number, PartnerSpeech | null>());
  const [frameLoading, setFrameLoading] = useState<number | null>(null);
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
    modelAudio.current?.pause();
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
      setError(voiceErrorMessage(e instanceof VoiceUseError ? e.code : "network", lang));
    } finally {
      setStt(false);
    }
  }

  async function submit() {
    const message = draft.replace(/\s+/g, " ").trim(); // một dòng: bản chữ lưu theo từng dòng "Learner: …"
    if (!message || busy || finished || recording || isTyping) return;
    if (hasBlank(message)) {
      setError(freeChatErrorMessage("blank_left", lang)); // không tốn lượt, không gọi AI
      return;
    }
    modelAudio.current?.pause();
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
      setError(freeChatErrorMessage(e instanceof FreeChatError ? e.code : "network", lang));
    } finally {
      setPending(null);
      setTimeout(() => inputRef.current?.focus(), 0); // trả tiêu điểm cho ô nhập để gõ tiếp
    }
  }

  function restart() {
    if (busy || recording) return;
    if (turns >= 2 && !window.confirm(t("practice.say.confirmRestart"))) return;
    epoch.current++;
    voice.stop();
    speeches.current.clear();
    reveal.reset();
    setTyping(null);
    setPreparing(false);
    setStarted(false); // quay về màn "Bắt đầu": bạn ảo nói lại câu mở đầu khi bấm
    setNotice(null);
    setHistory([]);
    setDraft("");
    setFinished(false);
    setError(null);
    onAnswer("");
  }

  /** Chèn một mẫu câu/từ/câu "Khi bị bí" vào ô nhập tại con trỏ; có chỗ trống thì bôi đen chỗ trống đầu tiên để gõ đè. */
  function insert(piece: string): boolean {
    const el = inputRef.current;
    // Bạn ảo còn đang gõ dần thì vẫn chèn được (ô nhập không bị khoá, chỉ nút Gửi chờ chữ hiện hết).
    if (!el || busy || recording || finished) return false;
    const r = insertIntoDraft(draft, el.selectionStart ?? draft.length, el.selectionEnd ?? draft.length, piece, FREECHAT_MAX_CHARS);
    setDraft(r.text);
    setError(null);
    setNotice(t("practice.say.inserted"));
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(r.selStart, r.selEnd);
    }, 0);
    return true;
  }

  async function playFrame(i: number) {
    if (voice.speakingKey === `f${i}`) return voice.stop();
    if (!frameSpeech) return;
    voice.unlock();
    let speech = frameSpeeches.current.get(i);
    if (speech === undefined) {
      setFrameLoading(i);
      speech = await frameSpeech(i).catch(() => null);
      frameSpeeches.current.set(i, speech);
      setFrameLoading(null);
      setSpeechVersion((v) => v + 1);
    }
    if (speech) voice.play(`f${i}`, speech);
  }

  const learnerTexts = history.filter((m) => m.role === "learner").map((m) => m.text);
  const used = usedTargets(view.targets, learnerTexts);
  const scaffold = view.scaffold ?? null;
  const frames = scaffold?.frames ?? [];
  const phrases = scaffold?.phrases ?? [];
  const vocab = scaffold?.vocab ?? [];
  const model = scaffold?.model ?? null;
  const framesUsed = frames.map((f) => frameUsed(f.en, learnerTexts));
  const canInsert = started && !preparing && !finished;
  const showTray = /^en/i.test(language ?? "");
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

  function openPrep(e: React.MouseEvent<HTMLElement>) {
    openerRef.current = e.currentTarget;
    setPrepOpen(true);
  }
  function closePrep(restoreFocus: boolean) {
    voice.stop();
    setPrepOpen(false);
    if (restoreFocus) setTimeout(() => openerRef.current?.focus?.(), 0);
  }
  /** Bấm một mẫu câu/cụm từ/từ trong popup: chèn vào ô nhập rồi đóng popup để thấy ô (chỗ trống đã bôi đen). */
  function insertFromPrep(piece: string) {
    if (insert(piece)) closePrep(false);
  }
  function onDialogKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation();
      closePrep(true);
      return;
    }
    if (e.key !== "Tab" || !dialogRef.current) return;
    const f = [...dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), audio[controls], [tabindex]:not([tabindex="-1"])')];
    if (!f.length) return;
    const first = f[0]!;
    const last = f[f.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }
  // Popup mở: tiêu điểm vào nút Đóng, khoá cuộn trang nền; đóng thì mở khoá.
  useEffect(() => {
    if (!prepOpen) return;
    closeRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [prepOpen]);

  const formulaEl = (
    <p className="fc-formula" data-testid="fc-formula">
      <strong>{t("practice.say.formula")}</strong>{" "}
      {FORMULA_STEPS.map((step, i) => (
        <span key={step} className="fc-formula-step">
          <span aria-hidden>{["①", "②", "③"][i]}</span>
          <span className="sr-only">{t("practice.say.stepN", { n: i + 1 })}</span> {t(`practice.say.step${i + 1}` as MessageKey)}
        </span>
      ))}
      {showTray && <span className="fc-formula-eg"> {t("practice.say.example")} <em>{FORMULA_EXAMPLE}</em></span>}
    </p>
  );
  const chipList = (items: Array<{ en: string; vi: string }>, ariaKey: MessageKey) => (
    <ul className="fc-words">
      {items.map((w, i) => (
        <li key={i}>
          {canInsert ? (
            <button type="button" className="fc-chip" onClick={() => insertFromPrep(w.en)} aria-label={t(ariaKey, { w: w.en })}>
              <strong>{w.en}</strong>
              {w.vi && <span>{w.vi}</span>}
            </button>
          ) : (
            <span className="fc-chip fc-chip-static">
              <strong>{w.en}</strong>
              {w.vi && <span>{w.vi}</span>}
            </span>
          )}
        </li>
      ))}
    </ul>
  );

  const prepDialog =
    prepOpen && scaffold && typeof document !== "undefined"
      ? createPortal(
          <div className="fc-modal" data-testid="fc-prep-dialog" onMouseDown={(e) => e.target === e.currentTarget && closePrep(true)}>
            <div ref={dialogRef} className="fc-modal-card" role="dialog" aria-modal="true" aria-labelledby={`${uid}-prep`} onKeyDown={onDialogKey}>
              <div className="fc-modal-head">
                <h2 id={`${uid}-prep`}>{t("practice.say.prepTitle")}</h2>
                <button ref={closeRef} type="button" className="fc-tool" onClick={() => closePrep(true)} aria-label={t("practice.say.close")} title={t("practice.say.close")}>
                  <X size={18} aria-hidden />
                </button>
              </div>
              <div className="fc-modal-body" data-testid="fc-prep">
                {formulaEl}
                {model && (
                  <section className="fc-modal-step" data-testid="fc-model">
                    <h3>{t("practice.say.prep1")}</h3>
                    {model.audio && (
                      <audio
                        ref={modelAudio}
                        className="fc-model-audio"
                        controls
                        preload="none"
                        src={audioUrl ? audioUrl(model.audio) : model.audio}
                        aria-label={t("practice.say.modelAudio")}
                        onPlay={() => voice.stop()}
                      />
                    )}
                    <p className="fc-hint">{t("practice.say.modelHint")}</p>
                    {showTranscript && (
                      <p className="fc-transcript" data-testid="fc-transcript">
                        {highlightSegments(model.text).map((seg, i) => (seg.hl ? <mark key={i} className="fc-hl">{seg.text}</mark> : <span key={i}>{seg.text}</span>))}
                      </p>
                    )}
                    <button type="button" className="fc-link" onClick={() => setShowTranscript((v) => !v)} aria-expanded={showTranscript}>
                      {showTranscript ? t("practice.say.hideTranscript") : t("practice.say.showTranscript")}
                    </button>
                  </section>
                )}
                {(scaffold.ideas.length > 0 || frames.length > 0 || phrases.length > 0 || vocab.length > 0) && (
                  <section className="fc-modal-step">
                    <h3>{t("practice.say.prep2")}</h3>
                    {scaffold.ideas.length > 0 && (
                      <div data-testid="fc-ideas">
                        <h4>{t("practice.say.ideas")}</h4>
                        <ul className="fc-ideas">
                          {scaffold.ideas.map((idea, i) => (
                            <li key={i}>{idea}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {frames.length > 0 && (
                      <div data-testid="fc-frames">
                        <h4>{t("practice.say.frames", { n: framesUsed.filter(Boolean).length, m: frames.length })}</h4>
                        <ul className="fc-frames">
                          {frames.map((f, i) => (
                            <li key={i} data-used={framesUsed[i] ? "" : undefined}>
                              {framesUsed[i] && (
                                <span aria-hidden className="fc-mark">
                                  ✓
                                </span>
                              )}
                              {canInsert ? (
                                <button type="button" className="fc-frame" onClick={() => insertFromPrep(f.en)} aria-label={t("practice.say.insertFrame", { t: f.en })}>
                                  <span className="fc-frame-en">{f.en}</span>
                                  {f.vi && <span className="fc-frame-vi">{f.vi}</span>}
                                </button>
                              ) : (
                                <span className="fc-frame fc-frame-static">
                                  <span className="fc-frame-en">{f.en}</span>
                                  {f.vi && <span className="fc-frame-vi">{f.vi}</span>}
                                </span>
                              )}
                              {framesUsed[i] && <span className="sr-only">{t("practice.say.used")}</span>}
                              {frameSpeech && frameSpeeches.current.get(i) !== null && (
                                <button
                                  type="button"
                                  className="fc-replay"
                                  data-playing={voice.speakingKey === `f${i}` ? "" : undefined}
                                  disabled={frameLoading === i}
                                  aria-busy={frameLoading === i}
                                  onClick={() => void playFrame(i)}
                                  aria-label={voice.speakingKey === `f${i}` ? t("practice.say.stopListening") : t("practice.say.listenFrame", { t: f.en })}
                                  title={voice.speakingKey === `f${i}` ? t("practice.say.stop") : t("practice.say.listen")}
                                >
                                  {voice.speakingKey === `f${i}` ? <Square size={13} aria-hidden /> : <Volume2 size={16} aria-hidden />}
                                </button>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {phrases.length > 0 && (
                      <div data-testid="fc-words">
                        <h4>{t("practice.say.words")}</h4>
                        {chipList(phrases, "practice.say.insertWord")}
                      </div>
                    )}
                    {vocab.length > 0 && (
                      <div data-testid="fc-vocab">
                        <h4>{t("practice.say.vocab")}</h4>
                        {chipList(vocab, "practice.say.insertVocab")}
                      </div>
                    )}
                  </section>
                )}
              </div>
              <div className="fc-modal-foot">
                {!started ? (
                  <button
                    type="button"
                    className="fc-btn fc-btn-primary"
                    onClick={() => {
                      closePrep(false);
                      void begin();
                    }}
                  >
                    <Play size={14} aria-hidden /> {t("practice.say.start")}
                  </button>
                ) : (
                  <button type="button" className="fc-btn fc-btn-ghost" onClick={() => closePrep(true)}>
                    {t("practice.say.close")}
                  </button>
                )}
              </div>
            </div>
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="fc" data-testid="freechat">
      <p className="fc-scenario">{view.scenario}</p>

      {!scaffold && formulaEl}

      {!scaffold && view.targets.length > 0 && (
        <details className="fc-targets" open>
          <summary>{t("practice.say.targets", { n: used.filter(Boolean).length, m: view.targets.length })}</summary>
          <ul>
            {view.targets.map((target, i) => (
              <li key={i} data-used={used[i] ? "" : undefined}>
                <span aria-hidden>{used[i] ? "✓" : "·"}</span> {target}
                {used[i] && <span className="sr-only">{t("practice.say.used")}</span>}
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
            <span>{t("practice.say.partner")}</span>
          </div>
          <div className="fc-chat-tools">
            {openingSpeech && (
              <button type="button" className="fc-tool" onClick={toggleVoice} aria-pressed={voiceOn} aria-label={t("practice.say.voice")} title={voiceOn ? t("practice.say.voiceOn") : t("practice.say.voiceOff")}>
                {voiceOn ? <Volume2 size={17} aria-hidden /> : <VolumeX size={17} aria-hidden />}
              </button>
            )}
            {started && (
              <button type="button" className="fc-tool" disabled={busy || recording || (turns === 0 && !draft)} onClick={restart} aria-label={t("practice.say.restart")} title={t("practice.say.restart")}>
                <RotateCcw size={16} aria-hidden />
              </button>
            )}
          </div>
        </div>

        {!started ? (
          <div className="fc-start">
            {avatar(true)}
            <p className="fc-hint">
              {t("practice.say.startHint", { name: view.partnerRole })}{openingSpeech ? t("practice.say.startSound") : ""}.
              {scaffold ? t("practice.say.startPrep") : ""}
            </p>
            <div className="fc-start-actions">
              {scaffold && (
                <button type="button" className="fc-btn fc-btn-ghost" onClick={openPrep} data-testid="fc-prep-open">
                  <BookOpen size={14} aria-hidden /> {t("practice.say.prepButton")}
                </button>
              )}
              <button type="button" className="fc-btn fc-btn-primary" onClick={() => void begin()}>
                <Play size={14} aria-hidden /> {t("practice.say.start")}
              </button>
            </div>
          </div>
        ) : (
          <div ref={log} className="fc-log" role="log" aria-label={t("practice.say.logAria")} aria-live="polite">
            {preparing
              ? dots(t("practice.say.preparing", { name: view.partnerRole }))
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
                        <span className="sr-only">{m.role === "partner" ? t("practice.say.partnerSays", { name: view.partnerRole }) : t("practice.say.youSay")}</span>
                        {/* Đang gõ dần: người dùng đọc màn hình nghe cả câu một lần, không nghe từng chữ nhảy. */}
                        <p aria-hidden={typingNow || undefined}>{typingNow ? reveal.revealed : m.text}</p>
                        {typingNow && <span className="sr-only">{m.text}</span>}
                      </div>
                      {canHear && !typingNow && (
                        <button type="button" className="fc-replay" data-playing={hearing ? "" : undefined} onClick={() => void replay(i)} aria-label={hearing ? t("practice.say.stopListening") : t("practice.say.replay")} title={hearing ? t("practice.say.stop") : t("practice.say.replayShort")}>
                          {hearing ? <Square size={13} aria-hidden /> : <Volume2 size={16} aria-hidden />}
                        </button>
                      )}
                    </div>
                  );
                })}
            {pending !== null && dots(t("practice.say.replying"))}
          </div>
        )}

        {!started || preparing ? null : !finished ? (
          <div className="fc-compose">
            {showTray && (
              <div className="fc-tray" role="group" aria-label={t("practice.say.stuck")} data-testid="fc-tray">
                {STUCK_GROUPS.map((g, gi) => (
                  <div key={g.label} className="fc-tray-group" role="group" aria-label={t(STUCK_LABEL_KEYS[gi]!)}>
                    <span className="fc-tray-label">{t(STUCK_LABEL_KEYS[gi]!)}</span>
                    {g.items.map((phrase) => (
                      <button key={phrase} type="button" className="fc-chip" disabled={busy || recording} onClick={() => void insert(phrase)} aria-label={t("practice.say.insertPhrase", { t: phrase })}>
                        {phrase}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
            <div className="fc-field">
              <textarea
                ref={inputRef}
                className="fc-input"
                rows={1}
                value={draft}
                maxLength={FREECHAT_MAX_CHARS}
                disabled={busy || recording}
                placeholder={t("practice.say.placeholder")}
                aria-label={t("practice.say.yourMessage")}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setNotice(null);
                  setError((x) => (x === freeChatErrorMessage("blank_left", lang) ? null : x));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void submit();
                  }
                }}
              />
              {recording ? (
                <button type="button" className="fc-stop" onClick={rec.stop} aria-label={t("practice.say.stopRec")}>
                  <Square size={12} aria-hidden /> {t("practice.say.stop")}{" "}
                  <span role="timer" aria-live="off" className="fc-timer">
                    {formatClock(rec.seconds)} / {formatClock(VOICE_MAX_SECONDS)}
                  </span>
                </button>
              ) : voiceEnabled ? (
                <button type="button" className="fc-icon" disabled={busy} onClick={() => void startMic()} aria-label={stt ? t("practice.say.transcribing") : t("practice.say.record")} title={t("practice.say.speak")} aria-busy={stt}>
                  <Mic size={18} aria-hidden />
                </button>
              ) : null}
              <button type="button" className="fc-send" disabled={busy || recording || isTyping || !draft.trim()} onClick={() => void submit()} aria-label={t("practice.say.send")} title={t("practice.say.sendTitle")}>
                <Send size={16} aria-hidden />
              </button>
            </div>
            <div className="fc-meta">
              <span className="fc-count" aria-live="off">
                {t("practice.say.turnOf", { n: Math.min(turns + 1, view.maxTurns), m: view.maxTurns })}
                {full ? t("practice.say.full", { n: FREECHAT_MAX_CHARS }) : ""}
              </span>
              {stt && (
                <span className="fc-hint" role="status">
                  {t("practice.say.hearing")}
                </span>
              )}
              {isTyping && (
                <button type="button" className="fc-link" onClick={reveal.skip}>
                  {t("practice.say.showAll")}
                </button>
              )}
              {turns >= 1 && (
                <button type="button" className="fc-link" disabled={busy || recording} onClick={() => setFinished(true)}>
                  {t("practice.say.finish")}
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="fc-ended" role="status">
            {t("practice.say.ended")}
          </p>
        )}
      </div>

      {prepDialog}

      {preview && <p className="fc-hint">{t("practice.say.previewNote")}</p>}

      <p className="sr-only" role="status" aria-live="polite">
        {notice ?? ""}
      </p>

      {(error ?? micError) && (
        <p role="alert" className="banner-danger text-xs" data-testid="fc-error">
          {error ?? micError}
        </p>
      )}
    </div>
  );
}
