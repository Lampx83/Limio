"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Play, Square } from "lucide-react";
import { formatClock } from "@/lib/audioRecorder";
import { useAudioRecorder } from "@/components/useAudioRecorder";
import { voiceErrorMessage } from "@/lib/practiceEssayView";
import { answerTextOf, compareSpoken, otherRole, restoreSpoken, type RoleId, type RolePlayConfig } from "@/lib/rolePlayView";
import { VoiceUseError } from "./EssayVoiceAnswer";
import { useT, useUiLang } from "@/lib/i18n/client";

/** Mỗi lượt ghi tối đa 30 giây (docs/tieu-chi/limio-language-luyen-hoi-thoai-dong-vai.md, AC1). */
const TURN_MAX_SECONDS = 30;

type Spoken = Record<RoleId, Record<number, string>>;

/**
 * Hội thoại đóng vai: học viên chọn A hoặc B, nghe vai kia bằng audio mẫu của từng lượt và ghi âm lượt của mình. Mỗi lượt ghi xong được
 * chuyển thành chữ (`transcribe`) rồi so với câu mẫu — chỉ đánh dấu từ nghe được/thiếu, KHÔNG có điểm. Bản ghi âm không được lưu. Câu trả
 * lời (bản chữ các lượt đã nói của vai đang chọn) đưa lên qua `onAnswer`; nút "Nhận xét bằng AI" nằm ở thẻ câu hỏi bên ngoài.
 * Hai vai được tính riêng: đổi vai không xoá phần đã nói ở vai kia.
 */
export default function RolePlay({
  rp,
  savedText,
  transcribe,
  onAnswer,
  audioUrl,
  preview,
}: {
  rp: RolePlayConfig;
  /** Câu trả lời đang lưu (để tải lại trang không mất phần đã nói). */
  savedText: string;
  /** Chuyển chữ một lượt; ném `VoiceUseError(mã)` khi lỗi. */
  transcribe: (turn: number, file: File) => Promise<string>;
  onAnswer: (text: string) => void;
  /** Đường dẫn audio mẫu → URL phát được (có tiền tố đường dẫn gốc của site). */
  audioUrl: (path: string) => string;
  preview: boolean;
}) {
  const t = useT();
  const lang = useUiLang();
  const restored = useRef(restoreSpoken(savedText, rp));
  const [role, setRole] = useState<RoleId>(restored.current?.role ?? "A");
  const [spoken, setSpoken] = useState<Spoken>(() => ({ A: {}, B: {}, ...(restored.current ? { [restored.current.role]: restored.current.spoken } : {}) }) as Spoken);
  const [skipped, setSkipped] = useState<Record<number, boolean>>({});
  const [recTurn, setRecTurn] = useState<number | null>(null);
  const [busyTurn, setBusyTurn] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState<number | "all" | null>(null);

  // Giá trị mới nhất cho các callback chạy muộn (ghi xong, phát xong): tránh đọc state cũ của lần dựng trước.
  const live = useRef({ role, spoken, recTurn });
  live.current = { role, spoken, recTurn };
  const audio = useRef<HTMLAudioElement | null>(null);
  const playToken = useRef(0);

  const rec = useAudioRecorder({ maxSeconds: TURN_MAX_SECONDS, onRecorded: (file) => void handleRecorded(file) });

  useEffect(
    () => () => {
      playToken.current++;
      audio.current?.pause();
    },
    [],
  );

  async function handleRecorded(file: File) {
    const turn = live.current.recTurn;
    const who = live.current.role;
    setRecTurn(null);
    if (turn === null) return;
    setBusyTurn(turn);
    setError(null);
    try {
      const text = await transcribe(turn, file);
      const next: Spoken = { ...live.current.spoken, [who]: { ...live.current.spoken[who], [turn]: text } };
      setSpoken(next);
      setSkipped((p) => ({ ...p, [turn]: false }));
      onAnswer(answerTextOf(who, rp, next[who]));
    } catch (e) {
      setError(voiceErrorMessage(e instanceof VoiceUseError ? e.code : "network", lang));
    } finally {
      setBusyTurn(null);
    }
  }

  function stopAudio() {
    playToken.current++;
    audio.current?.pause();
    audio.current = null;
    setPlaying(null);
  }

  function playOne(src: string): Promise<void> {
    return new Promise((resolve) => {
      const a = new Audio(src);
      audio.current = a;
      a.onended = () => resolve();
      a.onerror = () => resolve();
      void a.play().catch(() => resolve());
    });
  }

  async function playTurn(i: number) {
    const src = rp.turns[i]?.audio;
    if (!src) return;
    stopAudio();
    const token = playToken.current;
    setPlaying(i);
    await playOne(audioUrl(src));
    if (playToken.current === token) setPlaying(null);
  }

  async function playAll() {
    stopAudio();
    const token = playToken.current;
    setPlaying("all");
    for (const t of rp.turns) {
      if (playToken.current !== token) return;
      if (t.audio) await playOne(audioUrl(t.audio));
    }
    if (playToken.current === token) setPlaying(null);
  }

  async function startRecording(i: number) {
    stopAudio();
    setError(null);
    setRecTurn(i);
    await rec.start();
  }

  function changeRole(r: RoleId) {
    if (r === role || recTurn !== null || busyTurn !== null) return;
    stopAudio();
    setRole(r);
    setError(null);
    onAnswer(answerTextOf(r, rp, live.current.spoken[r]));
  }

  const mine = spoken[role];
  const nextTurn = rp.turns.findIndex((t, i) => t.speaker === role && mine[i] === undefined && !skipped[i]);
  const hasAnyAudio = rp.turns.some((t) => t.audio);
  const recording = rec.state === "recording" && recTurn !== null;
  const doneCount = rp.turns.filter((t, i) => t.speaker === role && mine[i] !== undefined).length;
  const total = rp.turns.filter((t) => t.speaker === role).length;
  const err = error ?? (rec.error && recTurn === null ? rec.error : null);

  return (
    <div className="rp" data-testid="roleplay">
      <div className="rp-bar">
        <div role="group" aria-label={t("practice.rp.chooseRole")} className="rp-roles">
          <span className="rp-bar-label">{t("practice.rp.youPlay")}</span>
          {(["A", "B"] as const).map((r) => (
            <button key={r} type="button" aria-pressed={role === r} className="rp-role" onClick={() => changeRole(r)} disabled={recTurn !== null || busyTurn !== null}>
              <span className="rp-badge">{r}</span> {rp.roles[r] !== r ? rp.roles[r] : ""}
            </button>
          ))}
        </div>
        {hasAnyAudio && (
          <button type="button" className="rp-listen" onClick={() => (playing === "all" ? stopAudio() : void playAll())}>
            {playing === "all" ? <Square size={14} aria-hidden /> : <Play size={14} aria-hidden />} {playing === "all" ? t("practice.say.stopListening") : t("practice.rp.hearAll")}
          </button>
        )}
      </div>

      <ol className="rp-turns">
        {rp.turns.map((turn, i) => {
          const isMine = turn.speaker === role;
          const heard = mine[i];
          const cmp = isMine && heard !== undefined ? compareSpoken(turn.text, heard) : null;
          const label = t(isMine ? "practice.rp.turnLabelMine" : "practice.rp.turnLabelPartner", { n: i + 1, r: turn.speaker });
          return (
            <li key={i} className="rp-turn" data-mine={isMine ? "" : undefined} data-current={isMine && i === nextTurn && !recording ? "" : undefined} aria-label={label}>
              <span className="rp-badge" aria-hidden>
                {turn.speaker}
              </span>
              <div className="rp-body">
                <p className="rp-text">
                  {cmp ? (
                    cmp.words.map((w, k) => (
                      <span key={k} className={w.ok ? undefined : "rp-miss"}>
                        {w.text}{" "}
                      </span>
                    ))
                  ) : (
                    turn.text
                  )}
                </p>

                {!isMine && turn.audio && (
                  <button type="button" className="rp-btn" onClick={() => (playing === i ? stopAudio() : void playTurn(i))} aria-label={playing === i ? t("practice.rp.stopTurn", { n: i + 1 }) : t("practice.rp.listenTurn", { n: i + 1 })}>
                    {playing === i ? <Square size={14} aria-hidden /> : <Play size={14} aria-hidden />} {playing === i ? t("practice.say.stop") : t("practice.say.listen")}
                  </button>
                )}

                {isMine && (
                  <div className="rp-actions">
                    {recording && recTurn === i ? (
                      <>
                        <button type="button" className="rp-btn rp-btn-primary" onClick={rec.stop} aria-label={t("practice.rp.stopCheckAria")}>
                          <Square size={14} aria-hidden /> {t("practice.rp.stopCheck")}
                        </button>
                        <span role="timer" aria-live="off" className="rp-timer">
                          <span className="rp-dot" aria-hidden /> {formatClock(rec.seconds)} / {formatClock(TURN_MAX_SECONDS)}
                        </span>
                      </>
                    ) : busyTurn === i ? (
                      <span className="rp-hint" aria-live="polite">
                        {t("practice.rp.hearing")}
                      </span>
                    ) : (
                      <>
                        <button type="button" className="rp-btn rp-btn-primary" disabled={recTurn !== null || busyTurn !== null} onClick={() => void startRecording(i)}>
                          <Mic size={14} aria-hidden /> {heard !== undefined ? t("practice.rp.rerecord") : t("practice.rp.record")}
                        </button>
                        {heard === undefined && !skipped[i] && (
                          <button type="button" className="rp-link" disabled={recTurn !== null || busyTurn !== null} onClick={() => setSkipped((p) => ({ ...p, [i]: true }))}>
                            {t("practice.rp.skip")}
                          </button>
                        )}
                        {skipped[i] && heard === undefined && <span className="rp-hint">{t("practice.rp.skipped")}</span>}
                      </>
                    )}
                  </div>
                )}

                {cmp && (
                  <p className="rp-heard" data-testid="rp-heard">
                    {t("practice.rp.heard", { heard: heard ?? "", ok: cmp.okCount, total: cmp.total })}
                    {cmp.extra.length > 0 && t("practice.rp.extra", { w: cmp.extra.join(", ") })}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>

      <p className="rp-hint" aria-live="polite">
        {total > 0 ? t("practice.rp.summary", { done: doneCount, total, role }) : ""}
        {preview ? t("practice.rp.previewNote") : ""}
        {doneCount > 0 && otherRole(role) ? t("practice.rp.swap") : ""}
      </p>

      {err && (
        <p role="alert" className="banner-danger text-xs" data-testid="rp-error">
          {err}
        </p>
      )}
    </div>
  );
}
