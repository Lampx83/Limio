"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { getBrowserAudioPlayer } from "@/lib/exclusiveAudio";

/**
 * Nút nghe dùng chung một bộ phát cho cả trang: bấm nút khác thì dừng nút đang
 * phát. Phía server (SSR) luôn là "không phát".
 */
export function useExclusiveAudio() {
  const subscribe = useCallback((fn: () => void) => getBrowserAudioPlayer().subscribe(fn), []);
  const playingId = useSyncExternalStore(
    subscribe,
    () => getBrowserAudioPlayer().playingId(),
    () => null,
  );
  // Rời bài thì tắt tiếng đang phát, đừng để âm thanh chạy tiếp ở trang khác.
  useEffect(() => () => getBrowserAudioPlayer().stop(), []);
  const toggle = useCallback((id: string, url: string) => getBrowserAudioPlayer().toggle(id, url), []);
  return { playingId, toggle };
}
