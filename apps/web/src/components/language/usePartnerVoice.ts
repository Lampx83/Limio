"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PartnerSpeech } from "@/lib/freeChatView";

/** Tệp WAV rỗng (44 byte) để "mở khoá" phát âm thanh trong cú bấm của học viên: Safari chỉ cho phát khi phần tử audio đã được bấm mở. */
const SILENT_WAV = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=";

/**
 * Phát giọng bạn ảo: một phần tử audio dùng lại, phát nối tiếp các đoạn máy chủ trả. `play(key, speech)` dừng giọng đang phát rồi phát cái mới;
 * `speakingKey` cho biết lời nào đang được đọc (để nút "Nghe lại" đổi thành "Dừng"). Phát lỗi hoặc bị trình duyệt chặn thì im lặng (đã có chữ).
 */
export function usePartnerVoice() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const urlsRef = useRef<string[]>([]);
  const tokenRef = useRef(0);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);

  const element = () => (audioRef.current ??= new Audio());
  const revoke = () => {
    for (const u of urlsRef.current) URL.revokeObjectURL(u);
    urlsRef.current = [];
  };

  const stop = useCallback(() => {
    tokenRef.current++;
    const a = audioRef.current;
    if (a) {
      a.onended = null;
      a.onerror = null;
      try {
        a.pause();
      } catch {
        // jsdom/trình duyệt cũ: không có gì để dừng
      }
    }
    revoke();
    setSpeakingKey(null);
  }, []);

  /** Gọi TRONG cú bấm của học viên (nút Bắt đầu) để các lần phát sau đó, vốn chạy sau khi tải xong từ máy chủ, không bị trình duyệt chặn. */
  const unlock = useCallback(() => {
    try {
      const a = element();
      a.src = SILENT_WAV;
      const r = a.play() as Promise<void> | undefined;
      r?.catch?.(() => undefined);
    } catch {
      // không mở khoá được thì lần phát đầu có thể bị chặn: học viên vẫn có chữ và nút Nghe
    }
  }, []);

  const play = useCallback(
    (key: string, speech: PartnerSpeech) => {
      stop();
      if (speech.audioChunks.length === 0) return;
      const token = tokenRef.current;
      const urls = speech.audioChunks.map((b64) => {
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        return URL.createObjectURL(new Blob([bytes], { type: speech.contentType }));
      });
      urlsRef.current = urls;
      const a = element();
      let i = 0;
      const next = () => {
        if (tokenRef.current !== token) return;
        if (i >= urls.length) {
          revoke();
          setSpeakingKey((k) => (k === key ? null : k));
          return;
        }
        a.src = urls[i]!;
        i++;
        try {
          const r = a.play() as Promise<void> | undefined;
          r?.catch?.(() => {
            if (tokenRef.current === token) setSpeakingKey(null);
          });
        } catch {
          setSpeakingKey(null);
        }
      };
      a.onended = next;
      a.onerror = () => {
        if (tokenRef.current === token) setSpeakingKey(null);
      };
      setSpeakingKey(key);
      next();
    },
    [stop],
  );

  useEffect(
    () => () => {
      tokenRef.current++;
      audioRef.current?.pause?.();
      revoke();
    },
    [],
  );

  return { speakingKey, play, stop, unlock };
}
