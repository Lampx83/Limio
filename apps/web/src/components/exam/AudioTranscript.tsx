"use client";

import { createContext, useContext } from "react";
import { examAssetFilenameFromUrl, videoTranscriptKey } from "@/lib/examAssetUrl";
import { paragraphMarker, splitTranscriptParagraphs } from "@/lib/transcriptParagraphs";

/**
 * Transcript của các audio trong MỘT đoạn văn (khoá = tên tệp). Chỉ được cấp ở chế độ cho phép học viên xem (Luyện đề, Bài luyện,
 * xem thử của giảng viên); lượt thi thử đang làm KHÔNG có giá trị này, nên không có nút và không có chữ nào trong trang.
 * docs/tieu-chi/bai-doc-anh-audio-xoa-transcript.md (AC4).
 */
export const AudioTranscriptContext = createContext<Record<string, string> | null>(null);

/** Dòng "Xem transcript" dưới trình phát: đóng sẵn, học viên tự mở/ẩn (không lưu, không ghi sự kiện). Không có transcript thì không vẽ gì. */
export default function AudioTranscript({ src, kind = "audio" }: { src: string; kind?: "audio" | "video" }) {
  const map = useContext(AudioTranscriptContext);
  const name = kind === "video" ? videoTranscriptKey(src) : examAssetFilenameFromUrl(src);
  const text = name && map ? map[name] : undefined;
  if (!text?.trim()) return null;
  const paragraphs = splitTranscriptParagraphs(text);
  return (
    <details className="mt-2 rounded-lg border border-default bg-white px-3 py-2" data-testid="audio-transcript">
      <summary className="cursor-pointer text-sm font-medium">Xem transcript</summary>
      {paragraphs.length >= 2 ? (
        <ol className="mt-2 space-y-2 text-sm leading-relaxed" data-testid="numbered-transcript">
          {paragraphs.map((para, i) => (
            <li key={i} className="flex gap-2">
              <span aria-hidden className="shrink-0 font-semibold text-brand-700">
                {paragraphMarker(i + 1)}
              </span>
              <span className="sr-only">Đoạn {i + 1}. </span>
              <span className="min-w-0 whitespace-pre-line break-words">{para}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2 whitespace-pre-line break-words text-sm leading-relaxed">{text}</p>
      )}
    </details>
  );
}
