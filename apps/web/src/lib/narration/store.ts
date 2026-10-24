import { useSyncExternalStore } from "react";
import type { NarrationKind } from "./learner";

/**
 * Trạng thái chung của trình nghe giảng / podcast trong một trang bài học. Nút "Nghe giảng" ở đầu bài, thẻ Podcast,
 * thanh phát ở cuối màn hình nằm ở ba chỗ khác nhau của cây React (trang bài là server component) nên không dùng
 * context được; một kho nhỏ ở mức module là đủ, vì một trang chỉ có một trình phát.
 */

export interface NarrationUi {
  /** Thanh phát đang hiện. */
  open: boolean;
  kind: NarrationKind | null;
  playing: boolean;
  /** Đang chờ dữ liệu (tải lần đầu, tua tới chỗ chưa tải). */
  loading: boolean;
  time: number;
  duration: number;
  speed: number;
  /** Trang tự cuộn theo mục đang giảng. Tắt khi học viên tự cuộn đi. */
  follow: boolean;
  ended: boolean;
  error: boolean;
  /** Thanh phát mở rộng (chỉ có ý nghĩa ở điện thoại; từ 640 px luôn mở rộng). */
  expanded: boolean;
  /** Đề nghị "Nghe tiếp từ …" đang chờ học viên chọn. */
  offerSec: number | null;
}

export const NARRATION_INITIAL: NarrationUi = {
  open: false,
  kind: null,
  playing: false,
  loading: false,
  time: 0,
  duration: 0,
  speed: 1,
  follow: true,
  ended: false,
  error: false,
  expanded: false,
  offerSec: null,
};

/** Các lệnh do trình phát (NarrationPlayer) đăng ký; các nút gọi qua đây. */
export interface NarrationCommands {
  /** Bấm nút trên trang: có vị trí nhớ thì hỏi nghe tiếp hay từ đầu, không thì phát từ đầu. */
  open(kind: NarrationKind): void;
  /** Phát từ một vị trí (bấm vào một lượt của bản chữ podcast). */
  playFrom(kind: NarrationKind, sec: number): void;
  toggle(): void;
  seek(sec: number): void;
  close(): void;
  setSpeed(speed: number): void;
  previous(): void;
  next(): void;
  restart(): void;
  resumeOffer(): void;
  refollow(): void;
  setExpanded(expanded: boolean): void;
  retry(): void;
}

let state: NarrationUi = NARRATION_INITIAL;
let commands: NarrationCommands | null = null;
const subscribers = new Set<() => void>();

export const getNarrationState = (): NarrationUi => state;

export function patchNarration(patch: Partial<NarrationUi>): void {
  const next = { ...state, ...patch };
  if ((Object.keys(patch) as (keyof NarrationUi)[]).every((k) => Object.is(state[k], next[k]))) return;
  state = next;
  subscribers.forEach((fn) => fn());
}

export function resetNarration(): void {
  state = NARRATION_INITIAL;
  subscribers.forEach((fn) => fn());
}

export function subscribeNarration(fn: () => void): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export const setNarrationCommands = (c: NarrationCommands | null): void => {
  commands = c;
};
export const narrationCommands = (): NarrationCommands | null => commands;

export function useNarration(): NarrationUi {
  return useSyncExternalStore(subscribeNarration, getNarrationState, () => NARRATION_INITIAL);
}
