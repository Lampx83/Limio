"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { pickRendition, videoSeekTarget } from "@/lib/narration/lecturerVideoPlan";
import { NarrationAvatar } from "./NarrationAvatar";

/**
 * Giảng viên nói thật ở góc dưới phải của trình chiếu (docs/tieu-chi/trinh-chieu-giang-vien.md, AC7). Video tắt tiếng, dài đúng bằng tệp giọng;
 * nó KHÔNG tự chạy mà bám theo thẻ audio của trình phát: phát/dừng theo audio, tốc độ theo audio, tua khi lệch quá ngưỡng.
 * Lỗi tải hay phát thì về ảnh tĩnh, không báo gì cho học viên. Ảnh tĩnh cũng là ảnh bìa lúc video đang tải.
 */
export default function LecturerVideo({
  lessonId,
  audio,
  photo,
  name,
  accent,
  speaking,
}: {
  lessonId: string;
  audio: RefObject<HTMLAudioElement | null>;
  photo?: string;
  name?: string;
  accent?: string;
  speaking: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  // Chọn bản theo màn hình lúc mở trình chiếu (điện thoại / tiết kiệm dữ liệu → bản nhỏ). Không đổi giữa chừng để khỏi tải lại.
  useEffect(() => {
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    const r = pickRendition(window.innerWidth, conn?.saveData === true);
    setSrc(`/api/lessons/${encodeURIComponent(lessonId)}/narration/video?r=${r}`);
  }, [lessonId]);

  useEffect(() => {
    const v = ref.current;
    const a = audio.current;
    if (!v || !a || !src || failed) return;

    const sync = () => {
      if (v.playbackRate !== a.playbackRate) v.playbackRate = a.playbackRate;
      if (v.readyState > 0 && !v.seeking) {
        const to = videoSeekTarget(a.currentTime, v.currentTime);
        if (to !== null) v.currentTime = Math.min(to, Number.isFinite(v.duration) ? v.duration : to);
      }
      const shouldPlay = !a.paused && !a.ended;
      if (shouldPlay && v.paused) v.play().catch(() => {});
      else if (!shouldPlay && !v.paused) v.pause();
    };
    const events = ["play", "playing", "pause", "waiting", "seeked", "ratechange", "timeupdate", "ended"] as const;
    events.forEach((e) => a.addEventListener(e, sync));
    v.addEventListener("loadedmetadata", sync);
    v.addEventListener("canplay", sync);
    sync();
    return () => {
      events.forEach((e) => a.removeEventListener(e, sync));
      v.removeEventListener("loadedmetadata", sync);
      v.removeEventListener("canplay", sync);
    };
  }, [audio, src, failed]);

  if (failed || !src) {
    return <NarrationAvatar who="lecturer" name={name} accent={accent} size="sm" speaking={speaking} />;
  }
  return (
    <video
      ref={ref}
      src={src}
      poster={photo}
      muted
      playsInline
      preload="auto"
      disablePictureInPicture
      disableRemotePlayback
      controlsList="nodownload noplaybackrate nofullscreen"
      aria-label={name ? `${name} đang giảng` : "Giảng viên ảo đang giảng"}
      className="slide-avatar-video"
      onError={() => setFailed(true)}
      draggable={false}
    />
  );
}
