"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GameshowSoundEngine, type Mood, type Sfx } from "./sound";

const MUTE_KEY = "gameshow:muted";
/** Nút bật/tắt nhạc mang thuộc tính này để lần bấm vào nó không bị coi là "bấm để mở tiếng". */
export const SOUND_TOGGLE_ATTR = "data-gs-sound-toggle";

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * Điều khiển nhạc gameshow cho màn host. Trình duyệt chặn tự phát tiếng trước
 * khi có thao tác của người dùng, nên `blocked` báo "đang chờ một cú bấm" —
 * lần bấm bất kỳ trên trang sẽ mở tiếng, nhạc đang đặt sẵn tự cất lên.
 */
export function useGameshowSound() {
  const engineRef = useRef<GameshowSoundEngine | null>(null);
  const mutedRef = useRef(false);
  const moodRef = useRef<Mood>("off");
  const [muted, setMutedState] = useState(false);
  const [blocked, setBlocked] = useState(false);

  const get = useCallback(() => {
    if (!engineRef.current && typeof window !== "undefined") {
      const e = new GameshowSoundEngine();
      e.setMuted(mutedRef.current);
      e.setMood(moodRef.current);
      engineRef.current = e;
    }
    return engineRef.current;
  }, []);

  useEffect(() => {
    mutedRef.current = readMuted();
    setMutedState(mutedRef.current);
    const e = get();
    if (!e) return;
    const sync = () => setBlocked(!e.running);
    sync();
    const off = e.onStateChange(sync);
    void e.resume().then(sync);

    const unlock = (ev: Event) => {
      if ((ev.target as Element | null)?.closest?.(`[${SOUND_TOGGLE_ATTR}]`)) return;
      if (!mutedRef.current) void e.resume().then(sync);
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") void e.suspend();
      else if (!mutedRef.current) void e.resume().then(sync);
    };
    document.addEventListener("pointerdown", unlock);
    document.addEventListener("keydown", unlock);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("pointerdown", unlock);
      document.removeEventListener("keydown", unlock);
      document.removeEventListener("visibilitychange", onVisibility);
      off();
      e.dispose();
      engineRef.current = null;
    };
  }, [get]);

  const setMood = useCallback(
    (mood: Mood) => {
      moodRef.current = mood;
      engineRef.current?.setMood(mood);
    },
    [],
  );

  const sfx = useCallback((kind: Sfx) => engineRef.current?.sfx(kind), []);

  const toggle = useCallback(() => {
    const e = get();
    // Đang chờ cú bấm đầu tiên: bấm nút là để MỞ tiếng, không phải tắt.
    if (e && !e.running && !mutedRef.current) {
      void e.resume().then(() => setBlocked(!e.running));
      return;
    }
    const next = !mutedRef.current;
    mutedRef.current = next;
    setMutedState(next);
    try {
      window.localStorage.setItem(MUTE_KEY, next ? "1" : "0");
    } catch {
      /* không lưu được thì thôi, chỉ mất lựa chọn cho lần sau */
    }
    e?.setMuted(next);
    if (!next) void e?.resume().then(() => setBlocked(!e.running));
  }, [get]);

  return { muted, blocked, toggle, setMood, sfx };
}
