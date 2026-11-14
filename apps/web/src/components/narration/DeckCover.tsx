"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Play } from "lucide-react";
import { deckCoverLabel, resumeSlideNumber } from "@/lib/narration/deckCover";
import { minutesLabel, readResume, safeStorage } from "@/lib/narration/learner";
import { getNarrationState, narrationCommands, patchNarration, subscribeNarration } from "@/lib/narration/store";
import { NarrationAvatar } from "./NarrationAvatar";
import { useT, useUiLang } from "@/lib/i18n/client";
import "./narration.css";

export interface DeckCoverInfo {
  deckId: string;
  lessonId: string;
  version: number;
  durationSec: number;
  /** Mốc của từng đoạn giảng (không kèm chữ), để biết vị trí nghe dở ứng với slide nào. */
  segments: Array<{ anchor: string; startSec: number; endSec: number }>;
  slideCount: number;
  lecturerName: string;
  lecturerAccent: string;
  completed: boolean;
  thresholdPct: number;
}

const stageOnSnapshot = (): boolean => {
  const s = getNarrationState();
  return s.open && s.kind === "lecture" && s.stage;
};
const heardSnapshot = (): number => getNarrationState().heard;

/**
 * Màn hình bìa của bài slide tương tác (docs/tieu-chi/bai-slide-man-hinh-bia.md): lối vào duy nhất của bài. Bìa chính là khung slide
 * thật dưới một lớp phủ, không bấm được; bấm nút thì vào trình chiếu, và NarrationPlayer đưa đúng khung này ra toàn màn hình.
 */
export default function DeckCover({ url, info }: { url: string; info: DeckCoverInfo }) {
  const tr = useT();
  const lang = useUiLang();
  const frameRef = useRef<HTMLIFrameElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const stageOn = useSyncExternalStore(subscribeNarration, stageOnSnapshot, () => false);
  const heard = useSyncExternalStore(subscribeNarration, heardSnapshot, () => 0);
  const [resumeSlide, setResumeSlide] = useState<number | null>(null);

  // Đọc lại mỗi lần về bìa: vị trí nhớ nằm trong trình duyệt nên máy chủ không biết, và vừa đổi nếu học viên mới nghe xong một lượt.
  useEffect(() => {
    if (stageOn) return;
    const sec = readResume(safeStorage(), info.lessonId, "lecture", info.version, info.durationSec);
    setResumeSlide(resumeSlideNumber(info.segments, sec));
  }, [stageOn, info.lessonId, info.version, info.durationSec, info.segments]);

  // Ở bìa: khung không nhận thao tác và không có thanh điều khiển riêng. Khung cùng origin nên đặt thẳng được, như trình chiếu vẫn làm (useDeckBridge).
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    frame.toggleAttribute("inert", !stageOn);
    if (stageOn) return;
    const hideBar = () => {
      try {
        frame.contentDocument?.documentElement.setAttribute("data-an-thanh", "1");
        frame.contentWindow?.dispatchEvent(new Event("resize"));
      } catch {
        /* khung chưa nạp xong: sự kiện load sẽ gọi lại */
      }
    };
    hideBar();
    frame.addEventListener("load", hideBar);
    return () => frame.removeEventListener("load", hideBar);
  }, [stageOn]);

  // Thoát trình chiếu thì trả tiêu điểm về nút, để người dùng bàn phím không bị lạc.
  const wasStage = useRef(false);
  useEffect(() => {
    if (wasStage.current && !stageOn) buttonRef.current?.focus();
    wasStage.current = stageOn;
  }, [stageOn]);

  const label = deckCoverLabel({ resumeSlide, completed: info.completed, heard, thresholdPct: info.thresholdPct }, lang);

  return (
    <div className="deck-cover">
      <iframe ref={frameRef} src={url} title={tr("reader.nar.cover.iframe", { name: info.lecturerName })} className="w-full rounded-xl border border-token shadow-card" allowFullScreen />
      {!stageOn && (
        <div className="deck-cover-scrim print:hidden">
          <NarrationAvatar who="lecturer" name={info.lecturerName} accent={info.lecturerAccent} />
          <p className="text-lg font-semibold">{tr("reader.nar.cover.teaches", { name: info.lecturerName })}</p>
          <p className="text-sm opacity-90">
            {minutesLabel(info.durationSec, lang)} · {tr("reader.nar.cover.slides", { n: info.slideCount })}
          </p>
          <button
            ref={buttonRef}
            type="button"
            className="btn-primary mt-2 min-h-[44px]"
            onClick={() => {
              patchNarration({ stage: true });
              narrationCommands()?.enter("lecture");
            }}
          >
            <Play size={16} />
            {label}
          </button>
        </div>
      )}
    </div>
  );
}
