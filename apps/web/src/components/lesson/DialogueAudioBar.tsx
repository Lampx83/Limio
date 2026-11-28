"use client";

import { Headphones } from "lucide-react";
import AudioLessonPlayer from "@/components/AudioLessonPlayer";
import type { DialogueTrack } from "@/lib/dialogueTracks";

/**
 * Thanh nghe hội thoại đặt ngay trong khối Bài luyện kỹ năng Nghe: học viên nghe lại bài hội thoại ở đây,
 * không phải cuộn lên phần Hội thoại của bài. Chỉ có audio, không hiện lời thoại (lời thoại là đáp án của bài nghe hiểu).
 */
export default function DialogueAudioBar({ tracks }: { tracks: DialogueTrack[] }) {
  if (tracks.length === 0) return null;
  return (
    <div data-testid="dialogue-audio-bar" className="mb-3 space-y-2 rounded-xl border border-token bg-[rgb(var(--surface))] p-3">
      {tracks.map((t) => (
        <div key={t.id} className="space-y-1">
          <div className="flex items-center gap-1.5 text-sm font-medium text-muted">
            <Headphones size={15} aria-hidden className="shrink-0" />
            <span className="min-w-0 truncate">{t.title || "Hội thoại"}</span>
          </div>
          <AudioLessonPlayer url={t.url} compact />
        </div>
      ))}
    </div>
  );
}
