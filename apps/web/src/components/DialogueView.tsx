"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Eye, Pause, Square, Volume2 } from "lucide-react";
import AudioLessonPlayer from "./AudioLessonPlayer";
import { getBrowserAudioPlayer } from "@/lib/exclusiveAudio";
import { SOURCE_TEXT_COLOR } from "@/lib/langText";
import { createTurnSequencer } from "@/lib/turnSequencer";
import { useExclusiveAudio } from "./useExclusiveAudio";

/** Màu avatar + tên theo thứ tự người nói. Chuỗi class viết đủ để Tailwind quét được. */
const SPEAKER_TONES = [
  { avatar: "bg-brand-100 text-brand-800", name: "text-brand-800" },
  { avatar: "bg-accent-100 text-accent-800", name: "text-accent-800" },
  { avatar: "bg-sky-100 text-sky-800", name: "text-sky-800" },
  { avatar: "bg-rose-100 text-rose-800", name: "text-rose-800" },
  { avatar: "bg-violet-100 text-violet-800", name: "text-violet-800" },
  { avatar: "bg-teal-100 text-teal-800", name: "text-teal-800" },
] as const;

export interface DialogueViewTurn {
  id: string;
  speaker: string;
  text: string;
  reading?: string;
  translation?: string;
  audioUrl?: string;
}

/**
 * LANG G2 — hội thoại cho học viên: các lượt xếp thành một cột như khung chat. Mọi
 * lượt cùng một bên (có thể có A, B, C, D… nên không chia trái/phải); mỗi người nói
 * một màu avatar cố định theo thứ tự xuất hiện, quá 6 người thì quay vòng. Nút nghe riêng ở lượt có audio;
 * audio cả bài (nếu có) dùng trình phát đầy đủ ở đầu khối.
 *
 * K1: lượt đang phát được tô sáng và tự cuộn vào tầm nhìn; "Nghe cả đoạn" phát
 * lần lượt audio từng lượt (không cần mốc thời gian vì mỗi lượt là một file).
 * Bấm vào khung lượt: khi rảnh thì nghe riêng lượt đó, khi đang nghe cả đoạn thì
 * nhảy tới lượt đó và chạy tiếp.
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
  initialShowReading = true,
  initialShowTranslation = true,
}: {
  title?: string;
  caption?: string;
  readingLabel?: string;
  audioUrl?: string;
  turns: DialogueViewTurn[];
  initialShowReading?: boolean;
  initialShowTranslation?: boolean;
}) {
  const [showReading, setShowReading] = useState(initialShowReading);
  const [showTranslation, setShowTranslation] = useState(initialShowTranslation);
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
  // Cuộn lượt đang phát vào giữa tầm nhìn khi nó lệch ra ngoài ("nearest" nên lượt
  // đã thấy rồi thì trang đứng yên).
  useEffect(() => {
    if (!playingId) return;
    const el = document.getElementById(turnDomId(playingId));
    if (!el) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [playingId]);
  const speakers: string[] = [];
  for (const t of turns) if (!speakers.includes(t.speaker)) speakers.push(t.speaker);
  const hasTranslation = turns.some((t) => !!t.translation);
  const hasReading = turns.some((t) => !!t.reading);
  const readingName = readingLabel?.trim() || "Phiên âm";

  return (
    <section className="space-y-2 rounded-xl border border-token bg-[rgb(var(--surface))] p-3">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          {title && <p className="text-body font-semibold">{title}</p>}
          {caption && <p className="text-meta">{caption}</p>}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {hasTurnAudio && (
            <button
              type="button"
              aria-pressed={sequenceOn}
              onClick={() => (sequenceOn ? sequencer?.stop() : sequencer?.start())}
              className={`inline-flex h-9 items-center gap-2 rounded-full pl-3 pr-4 text-sm font-medium text-white shadow-sm transition-colors ${
                sequenceOn ? "bg-brand-800 hover:bg-brand-900" : "bg-brand-600 hover:bg-brand-700"
              }`}
            >
              {sequenceOn ? <Square size={15} aria-hidden /> : <Volume2 size={16} aria-hidden />}
              {sequenceOn ? "Dừng" : "Nghe cả đoạn"}
            </button>
          )}
          {(hasReading || hasTranslation) && (
            // Một cụm liền: biểu tượng mắt (= "hiện") rồi các nút bật/tắt cùng chiều cao với nút phát.
            <div
              role="group"
              aria-label="Hiển thị"
              className="inline-flex h-9 items-center gap-0.5 rounded-full border border-token bg-[rgb(var(--surface))] p-0.5 pl-3"
            >
              <Eye size={15} aria-hidden className="mr-1.5 text-muted" />
              {hasReading && (
                <ToggleChip pressed={showReading} onClick={() => setShowReading((v) => !v)}>
                  {readingName}
                </ToggleChip>
              )}
              {hasTranslation && (
                <ToggleChip pressed={showTranslation} onClick={() => setShowTranslation((v) => !v)}>
                  Bản dịch
                </ToggleChip>
              )}
            </div>
          )}
        </div>
      </div>

      {audioUrl && <AudioLessonPlayer url={audioUrl} compact />}

      <ul className="divide-y divide-[rgb(var(--border))]">
        {turns.map((t) => {
          const speakerIdx = speakers.indexOf(t.speaker);
          const tone = SPEAKER_TONES[speakerIdx % SPEAKER_TONES.length]!;
          const playing = playingId === t.id;
          const graphemes = Array.from(t.speaker.trim());
          const initial = (graphemes[0] ?? "?").toUpperCase();
          // Tên dài hơn một ký tự thì avatar không đủ phân biệt → in tên nhỏ trước lời.
          const showName = graphemes.length > 1;
          return (
            <li
              key={t.id}
              id={turnDomId(t.id)}
              data-speaker={speakerIdx}
              data-playing={playing ? "true" : undefined}
              onClick={
                t.audioUrl
                  ? () => {
                      // Đang bôi đen chữ để copy/tra từ thì không coi là bấm phát.
                      if (window.getSelection()?.toString()) return;
                      if (sequenceOn) sequencer?.start(t.id);
                      else toggle(t.id, t.audioUrl!);
                    }
                  : undefined
              }
              // Hàng gọn, không khung: mobile xếp dọc (lời → phiên âm → dịch); từ md
              // bản dịch sang cột phải cùng hàng để mỗi lượt chỉ cao bằng 2 dòng.
              className={`grid grid-cols-[1.75rem_minmax(0,1fr)] items-start gap-x-3 gap-y-0.5 rounded-lg px-2 py-2 transition-colors md:grid-cols-[1.75rem_minmax(0,1.15fr)_minmax(0,1fr)] ${
                playing ? "bg-brand-soft ring-2 ring-brand-300" : ""
              } ${t.audioUrl ? "cursor-pointer hover:bg-[rgb(var(--surface-muted))/0.5]" : ""}`}
            >
              <span
                aria-hidden
                title={t.speaker}
                className={`row-span-2 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold md:row-span-1 ${
                  tone.avatar
                } ${playing ? "ring-2 ring-brand-400" : ""}`}
              >
                {initial}
              </span>
              <div className="min-w-0">
                <div className="flex items-start gap-2">
                  {t.audioUrl && (
                    <button
                      type="button"
                      aria-label={`Nghe câu của ${t.speaker}`}
                      aria-pressed={playing}
                      onClick={(e) => {
                        e.stopPropagation(); // không để hàng xử lý thêm một lần
                        sequencer?.cancel(); // nút riêng của lượt: người học tự điều khiển
                        toggle(t.id, t.audioUrl!);
                      }}
                      className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition-colors ${
                        playing
                          ? "border-brand-400 bg-brand-100 text-brand-800"
                          : "border-token bg-[rgb(var(--surface))] hover:bg-brand-soft"
                      }`}
                    >
                      {playing ? <Pause size={14} aria-hidden /> : <Volume2 size={14} aria-hidden />}
                    </button>
                  )}
                  {!t.audioUrl && hasTurnAudio && <span className="h-7 w-7 shrink-0" aria-hidden />}
                  <p className={`min-w-0 text-xl font-medium leading-snug ${SOURCE_TEXT_COLOR}`}>
                    {showName && (
                      <span className={`mr-2 align-middle text-caption font-semibold ${tone.name}`}>{t.speaker}</span>
                    )}
                    {t.text}
                  </p>
                </div>
                {t.reading && (
                  <p
                    data-masked={showReading ? undefined : "true"}
                    className={`text-meta text-muted ${hasTurnAudio ? "pl-9" : ""} ${showReading ? "" : "select-none blur-sm"}`}
                  >
                    {t.reading}
                  </p>
                )}
              </div>
              {t.translation && (
                <p
                  data-masked={showTranslation ? undefined : "true"}
                  className={`col-start-2 text-meta text-muted md:col-start-3 md:row-start-1 ${
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

function ToggleChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={`h-8 rounded-full px-3.5 text-sm transition-colors ${
        pressed
          ? "bg-brand-100 font-medium text-brand-800 shadow-sm"
          : "text-muted line-through decoration-[rgb(var(--text-muted))/0.5] hover:bg-brand-soft"
      }`}
    >
      {children}
    </button>
  );
}
