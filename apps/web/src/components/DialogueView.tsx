"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Languages, Pause, Square, Volume2 } from "lucide-react";
import AudioLessonPlayer, { type AudioControl } from "./AudioLessonPlayer";
import RubyText, { hanTextProps, rubyPlan } from "./RubyText";
import HanFontLoader from "./HanFontLoader";
import { activeTurnIndex, hasMarks, turnClickAction } from "@/lib/dialogueTiming";
import { getBrowserAudioPlayer } from "@/lib/exclusiveAudio";
import { SOURCE_TEXT_COLOR } from "@/lib/langText";
import { createTurnSequencer } from "@/lib/turnSequencer";
import { useExclusiveAudio } from "./useExclusiveAudio";
import { hskT } from "./lesson/hskT";
import { useT } from "@/lib/i18n/client";
import { useReaderPrefs } from "./language/ReaderPrefs";

/**
 * Mọi người nói dùng MỘT màu cho tên và avatar chữ cái (trung tính). Trước đây màu chạy theo thứ tự xuất hiện nên cùng một nhân vật
 * đổi màu giữa hội thoại A và B; giờ người nói được nhận ra bằng avatar khuôn mặt (nếu có) cùng tên.
 */
const SPEAKER_AVATAR_CLASS = "bg-brand-100 text-brand-800";
const SPEAKER_NAME_CLASS = "text-brand-800";

/** Người nói của hội thoại: tên khớp `DialogueViewTurn.speaker`; `avatarUrl` là ảnh khuôn mặt (vuông, hiện tròn). */
export interface DialogueViewSpeaker {
  name: string;
  avatarUrl?: string;
}

export interface DialogueViewTurn {
  id: string;
  speaker: string;
  text: string;
  reading?: string;
  translation?: string;
  audioUrl?: string;
  /** K2 — giây mà lượt này bắt đầu trong audio cả đoạn (`audioUrl` của khối). */
  startSec?: number;
}

/**
 * LANG G2 — hội thoại cho học viên: các lượt xếp thành một cột như khung chat. Mọi
 * lượt cùng một bên (có thể có A, B, C, D… nên không chia trái/phải); mỗi người nói
 * có avatar tròn (ảnh khuôn mặt khi `speakers` có `avatarUrl`, không thì chữ cái đầu) và tên cùng một màu. Nút nghe riêng ở lượt có audio;
 * audio cả bài (nếu có) dùng trình phát đầy đủ ở đầu khối.
 *
 * K1: lượt đang phát được tô sáng và tự cuộn vào tầm nhìn; "Nghe cả đoạn" phát
 * lần lượt audio từng lượt (không cần mốc thời gian vì mỗi lượt là một file).
 * Bấm vào khung lượt: khi rảnh thì nghe riêng lượt đó, khi đang nghe cả đoạn thì
 * nhảy tới lượt đó và chạy tiếp.
 *
 * K2: audio cả đoạn có mốc thời gian (`startSec` từng lượt) → lượt đang đọc tô sáng và tự cuộn theo audio;
 * bấm một lượt có mốc thì audio cả đoạn tua tới đó. Chỉ một nguồn âm thanh chạy một lúc.
 *
 * Ba dạng chữ: lời gốc (luôn hiện) · phiên âm · tiếng Việt. Hai dạng sau tắt/bật
 * độc lập để học viên tự kiểm tra (đoán cách đọc, đoán nghĩa). Tắt chỉ làm mờ.
 *
 * "Bản dịch" bật/tắt để học viên nghe và đoán trước khi xem nghĩa. Tắt chỉ làm
 * mờ (nội dung vẫn trong DOM) — đây là công cụ tự học, không phải đáp án cần giấu.
 */
export default function DialogueView({
  title,
  caption,
  readingLabel,
  audioUrl,
  turns,
  speakers: speakerInfo,
  initialShowReading = true,
  initialShowTranslation,
  hsk = false,
  hskLang = "vi",
}: {
  /** Ngôn ngữ của khoá cho chuỗi giao diện HSK (thanh phát…), không theo ngôn ngữ trình duyệt. */
  hskLang?: "vi" | "en";
  /** Giao diện bài HSK: thanh phát hiện sẵn thay nút "Nghe cả đoạn", nút loa từng lượt chỉ hiện khi rê chuột. */
  hsk?: boolean;
  title?: string;
  caption?: string;
  readingLabel?: string;
  audioUrl?: string;
  turns: DialogueViewTurn[];
  /** Ảnh đại diện từng người nói (tuỳ chọn); người nói không có ở đây hiện chữ cái đầu. */
  speakers?: DialogueViewSpeaker[];
  initialShowReading?: boolean;
  /** Mặc định: hiện bản dịch. Trong khung bài (khoá ngoại ngữ) việc hiện/ẩn do bảng Aa điều khiển. */
  initialShowTranslation?: boolean;
}) {
  const tx = useT();
  // Trong khung bài (có tuỳ chọn đọc "Aa") pinyin và bản dịch do bảng Aa điều khiển (mặc định bản dịch ẩn) nên không có nút riêng ở đây.
  const prefsOwnDisplay = !!useReaderPrefs();
  const [showReading, setShowReading] = useState(initialShowReading);
  const [showTranslation, setShowTranslation] = useState(initialShowTranslation ?? true);
  // Phải khai báo TRƯỚC useExclusiveAudio: khi rời trang, cleanup chạy theo thứ tự
  // khai báo — tắt chuỗi trước thì tiếng bị dừng không kích hoạt lượt kế.
  const sequencer = useMemo(
    () => (typeof window === "undefined" ? null : createTurnSequencer(getBrowserAudioPlayer(), turns)),
    [turns],
  );
  useEffect(() => () => sequencer?.cancel(), [sequencer]);
  const { playingId, toggle } = useExclusiveAudio();
  const sequenceOn = useSyncExternalStore(
    (fn) => sequencer?.subscribe(fn) ?? (() => undefined),
    () => sequencer?.isActive() ?? false,
    () => false,
  );
  const hasTurnAudio = turns.some((t) => !!t.audioUrl);

  // K2 — audio cả đoạn có mốc: vị trí phát → lượt đang đọc.
  const wholeControl = useRef<AudioControl | null>(null);
  const [wholeTime, setWholeTime] = useState(0);
  const [wholePlaying, setWholePlaying] = useState(false);
  const timed = !!audioUrl && hasMarks(turns);
  const wholeIdx = timed ? activeTurnIndex(turns, wholeTime) : null;
  const wholeLitId = wholeIdx === null ? null : turns[wholeIdx]!.id;
  const onWholePlaying = useCallback(
    (p: boolean) => {
      setWholePlaying(p);
      if (p) {
        // Một nguồn âm thanh một lúc: nghe cả đoạn thì dừng audio riêng và chuỗi của K1.
        sequencer?.cancel();
        getBrowserAudioPlayer().stop();
      }
    },
    [sequencer],
  );
  const onWholeEnded = useCallback(() => setWholeTime(0), []);
  // Ngược lại: audio riêng/chuỗi bắt đầu thì audio cả đoạn nhường.
  useEffect(() => {
    if (playingId || sequenceOn) wholeControl.current?.pause();
  }, [playingId, sequenceOn]);

  // Cuộn lượt đang phát (audio riêng hoặc audio cả đoạn) vào tầm nhìn khi nó lệch ra ngoài
  // ("nearest" nên lượt đã thấy rồi thì trang đứng yên).
  const litId = playingId ?? (wholePlaying || wholeTime > 0 ? wholeLitId : null);
  useEffect(() => {
    if (!litId) return;
    const el = document.getElementById(turnDomId(litId));
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [litId]);
  const litIdx = litId ? turns.findIndex((x) => x.id === litId) : -1;
  const speakers: string[] = [];
  for (const t of turns) if (!speakers.includes(t.speaker)) speakers.push(t.speaker);
  const hasTranslation = turns.some((t) => !!t.translation);
  const hasReading = turns.some((t) => !!t.reading);
  const readingName = readingLabel?.trim() || tx("learn.dialogue.reading");

  return (
    <section className={hsk ? "hsk-dlg" : "space-y-2 rounded-xl border border-token bg-[rgb(var(--surface))] p-3"}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          {title && <p className="text-body font-semibold">{title}</p>}
          {caption && <p className="text-meta">{caption}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {hasTurnAudio && !hsk && (
            <button
              type="button"
              aria-pressed={sequenceOn}
              onClick={() => (sequenceOn ? sequencer?.stop() : sequencer?.start())}
              className={`inline-flex h-9 items-center gap-2 rounded-full pl-3 pr-4 text-sm font-medium text-white shadow-sm transition-colors ${
                sequenceOn ? "bg-brand-800 hover:bg-brand-900" : "bg-brand-600 hover:bg-brand-700"
              }`}
            >
              {sequenceOn ? <Square size={15} aria-hidden /> : <Volume2 size={16} aria-hidden />}
              {sequenceOn ? tx("learn.dialogue.stop") : tx("learn.dialogue.playAll")}
            </button>
          )}
          {!prefsOwnDisplay && (hasReading || hasTranslation) && (
            <div role="group" aria-label={tx("learn.dialogue.display")} className="inline-flex flex-wrap items-center gap-2">
              {hasReading && (
                <SwitchChip on={showReading} onClick={() => setShowReading((v) => !v)}>
                  {readingName}
                </SwitchChip>
              )}
              {hasTranslation && (
                // Cùng kiểu và cùng chữ với nút dịch của bài tập ("Hiện bản dịch" / "Ẩn bản dịch"), biểu tượng Languages.
                <button type="button" className="rp-link inline-flex h-9 items-center gap-1.5 text-sm" aria-expanded={showTranslation} onClick={() => setShowTranslation((v) => !v)}>
                  <Languages size={15} aria-hidden /> {showTranslation ? tx("practice.aid.hideTranslation") : tx("practice.aid.showTranslation")}
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {hsk && hasTurnAudio && !audioUrl && (
        <div className="hsk-player" role="group" aria-label={tx("learn.dialogue.playAll")}>
          <button
            type="button"
            className="hsk-player-btn"
            aria-pressed={sequenceOn}
            aria-label={hskT(hskLang, sequenceOn ? "learn.hsk.player.pause" : "learn.hsk.player.play")}
            onClick={() => (sequenceOn ? sequencer?.stop() : sequencer?.start())}
          >
            {sequenceOn ? <Square size={15} aria-hidden /> : <Volume2 size={16} aria-hidden />}
          </button>
          <div className="hsk-player-track" aria-hidden>
            <i style={{ width: `${sequenceOn && litIdx >= 0 ? ((litIdx + 1) / turns.length) * 100 : 0}%` }} />
          </div>
          <span className="hsk-player-time">{hskT(hskLang, "learn.hsk.player.turns", { n: sequenceOn && litIdx >= 0 ? litIdx + 1 : 0, total: turns.length })}</span>
        </div>
      )}

      {audioUrl && (
        <AudioLessonPlayer
          url={audioUrl}
          compact
          controlRef={wholeControl}
          onTimeChange={timed ? setWholeTime : undefined}
          onPlayingChange={onWholePlaying}
          onEnded={onWholeEnded}
        />
      )}

      <ul className="divide-y divide-[rgb(var(--border))]">
        {turns.map((t) => {
          const speakerIdx = speakers.indexOf(t.speaker);
          const avatarUrl = speakerInfo?.find((x) => x.name === t.speaker)?.avatarUrl;
          const playing = litId === t.id; // tô sáng: audio riêng HOẶC audio cả đoạn đang ở lượt này
          const ownPlaying = playingId === t.id; // nút loa riêng chỉ phản ánh audio riêng của lượt
          const hasMark = timed && t.startSec !== undefined;
          const clickAction = (): ReturnType<typeof turnClickAction> =>
            turnClickAction({
              hasOwnAudio: !!t.audioUrl,
              hasMark,
              hasWholeAudio: !!audioUrl,
              wholePlaying,
              sequenceOn,
            });
          const clickable = clickAction() !== "none";
          const graphemes = Array.from(t.speaker.trim());
          const initial = (graphemes[0] ?? "?").toUpperCase();
          // Tên dài hơn một ký tự hoặc avatar là ảnh thì chữ cái không nói được là ai → in tên nhỏ trước lời.
          const showName = graphemes.length > 1 || !!avatarUrl;
          const plan = rubyPlan(t.text, t.reading);
          return (
            <li
              key={t.id}
              id={turnDomId(t.id)}
              data-speaker={speakerIdx}
              data-playing={playing ? "true" : undefined}
              onClick={
                clickable
                  ? () => {
                      // Đang bôi đen chữ để copy/tra từ thì không coi là bấm phát.
                      if (window.getSelection()?.toString()) return;
                      switch (clickAction()) {
                        case "seek_whole":
                          wholeControl.current?.seek(t.startSec!, true);
                          break;
                        case "sequence_jump":
                          sequencer?.start(t.id);
                          break;
                        case "play_own":
                          toggle(t.id, t.audioUrl!);
                          break;
                      }
                    }
                  : undefined
              }
              // Hàng gọn, không khung: mobile xếp dọc (lời → phiên âm → dịch); từ md
              // bản dịch sang cột phải cùng hàng để mỗi lượt chỉ cao bằng 2 dòng.
              className={`${hsk ? "hsk-turn " : ""}grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 rounded-lg px-2 py-2 transition-colors md:grid-cols-[2.25rem_minmax(0,1.15fr)_minmax(0,1fr)] ${
                playing ? "bg-brand-soft ring-2 ring-brand-300" : ""
              } ${clickable ? "cursor-pointer hover:bg-[rgb(var(--surface-muted))/0.5]" : ""}`}
            >
              <span
                aria-hidden
                title={t.speaker}
                data-avatar={avatarUrl ? "image" : "initial"}
                className={`${hsk ? "hsk-av " : ""}row-span-2 mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold md:row-span-1 ${
                  hsk ? "" : SPEAKER_AVATAR_CLASS
                } ${playing ? "ring-2 ring-brand-400" : ""}`}
              >
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={avatarUrl} alt="" width={36} height={36} loading="lazy" draggable={false} className="h-full w-full object-cover" />
                ) : (
                  initial
                )}
              </span>
              <div className="min-w-0">
                <div className="flex items-start gap-2">
                  {t.audioUrl && (
                    <button
                      type="button"
                      aria-label={tx("learn.dialogue.listenTurn", { speaker: t.speaker })}
                      aria-pressed={ownPlaying}
                      onClick={(e) => {
                        e.stopPropagation(); // không để hàng xử lý thêm một lần
                        sequencer?.cancel(); // nút riêng của lượt: người học tự điều khiển
                        toggle(t.id, t.audioUrl!);
                      }}
                      className={`${hsk ? "hsk-dlg-loa " : ""}inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        ownPlaying
                          ? "border-brand-400 bg-brand-100 text-brand-800"
                          : "border-token bg-[rgb(var(--surface))] hover:bg-brand-soft"
                      }`}
                    >
                      {ownPlaying ? <Pause size={14} aria-hidden /> : <Volume2 size={14} aria-hidden />}
                    </button>
                  )}
                  {!t.audioUrl && hasTurnAudio && <span className="h-7 w-7 shrink-0" aria-hidden />}
                  <div className="min-w-0">
                    <HanFontLoader lang={plan.lang} />
                    {showName && <p className={`${hsk ? "hsk-name " : ""}text-caption font-semibold ${hsk ? "" : SPEAKER_NAME_CLASS}`}>{t.speaker}</p>}
                    {/* Pinyin ghép được từng chữ thì hiện thẳng hàng dưới chữ Hán; không thì để ở dòng riêng bên dưới. */}
                    <p
                      lang={plan.lang}
                      className={`${hsk ? "hsk-han " : ""}text-xl font-medium ${plan.syllables ? "ruby-line" : "leading-snug"} ${hanTextProps(plan.lang).className} ${hsk ? "" : SOURCE_TEXT_COLOR}`}
                    >
                      {plan.syllables ? <RubyText text={t.text} syllables={plan.syllables} masked={!showReading} /> : t.text}
                    </p>
                  </div>
                </div>
                {t.reading && !plan.syllables && (
                  <p
                    data-masked={showReading ? undefined : "true"}
                    className={`text-meta text-muted py-latin ${hasTurnAudio ? "pl-9" : ""} ${showReading ? "" : "select-none blur-sm"}`}
                  >
                    {t.reading}
                  </p>
                )}
              </div>
              {t.translation && (
                <p
                  data-rd-tr=""
                  data-masked={showTranslation ? undefined : "true"}
                  className={`${hsk ? "hsk-dlg-tr " : ""}col-start-2 text-body text-muted md:col-start-3 md:row-start-1 ${
                    showTranslation ? "" : "select-none blur-sm"
                  }`}
                >
                  {t.translation}
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const turnDomId = (id: string) => `dlg-turn-${id}`;

/** Nút bật/tắt một lớp hiển thị (Bản dịch, Pinyin): nhãn + công tắc nhỏ; bật = nền xanh nhạt và công tắc xanh, tắt = viền mảnh và công tắc xám. */
function SwitchChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex h-9 items-center gap-2.5 border px-3 text-sm font-semibold transition-colors ${
        on ? "border-brand-600 bg-brand-100 text-brand-800" : "border-token bg-[rgb(var(--surface))] text-muted hover:bg-brand-soft"
      }`}
    >
      {children}
      <span aria-hidden className={`relative h-5 w-9 shrink-0 transition-colors ${on ? "bg-brand-600" : "bg-black/20 dark:bg-white/25"}`}>
        <span className={`absolute top-0.5 h-4 w-4 bg-white shadow-sm transition-all ${on ? "left-[1.125rem]" : "left-0.5"}`} />
      </span>
    </button>
  );
}
