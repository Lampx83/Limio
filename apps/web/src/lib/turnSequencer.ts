/**
 * LANG K1 — phát lần lượt audio từng lượt hội thoại ("Nghe cả đoạn").
 *
 * Đứng trên bộ phát dùng chung (exclusiveAudio): lượt đang phát chính là
 * `playingId` nên giao diện tô sáng nó mà không cần mốc thời gian. Tách khỏi
 * component để thử bằng audio giả.
 *
 * Phân biệt "hết lượt tự nhiên" với "người học can thiệp" nhờ `expecting`: bộ
 * phát báo đổi sang một id khác id mình vừa bật nghĩa là người học bấm nút
 * khác → chuỗi nhường. Còn `playingId` về null khi chuỗi đang chạy nghĩa là
 * lượt vừa hết (hoặc file lỗi) → sang lượt kế. Người học dừng bằng chính nút
 * của lượt đó thì component phải gọi `cancel()` trước `toggle` (xem DialogueView).
 */
import type { ExclusivePlayer } from "./exclusiveAudio";

export interface SequenceTurn {
  id: string;
  audioUrl?: string;
}

export interface TurnSequencer {
  /** Bắt đầu từ lượt có audio đầu tiên, hoặc từ `fromId` (lấy lượt kế có audio nếu lượt đó không có). */
  start(fromId?: string): void;
  /** Tắt chuỗi và dừng tiếng. */
  stop(): void;
  /** Tắt chuỗi, để lượt đang phát tự chạy nốt. */
  cancel(): void;
  isActive(): boolean;
  subscribe(fn: () => void): () => void;
}

export function createTurnSequencer(player: ExclusivePlayer, turns: SequenceTurn[]): TurnSequencer {
  let active = false;
  let expecting: string | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((fn) => fn());

  const firstPlayableFrom = (index: number) => {
    for (let i = Math.max(0, index); i < turns.length; i++) if (turns[i]!.audioUrl) return turns[i]!;
    return null;
  };

  function playTurn(t: SequenceTurn) {
    expecting = t.id;
    player.toggle(t.id, t.audioUrl!);
  }

  function finish() {
    if (!active) return;
    active = false;
    expecting = null;
    notify();
  }

  player.subscribe(() => {
    if (!active) return;
    const pid = player.playingId();
    if (pid === null) {
      // Lượt vừa hết (hoặc lỗi) → sang lượt kế có audio.
      const idx = turns.findIndex((t) => t.id === expecting);
      const next = firstPlayableFrom(idx + 1);
      if (next) playTurn(next);
      else finish();
    } else if (pid !== expecting) {
      finish(); // người học tự bấm lượt khác
    }
  });

  return {
    start(fromId) {
      const idx = fromId === undefined ? 0 : turns.findIndex((t) => t.id === fromId);
      const first = firstPlayableFrom(idx < 0 ? 0 : idx);
      if (!first) return;
      const wasActive = active;
      // Nhảy khi đang phát: toggle cùng id sẽ tắt chứ không phát lại, nên dừng
      // trước — với chuỗi tạm tắt, kẻo tiếng "dừng" bị hiểu là hết lượt và tự
      // sang lượt kế.
      active = false;
      if (player.playingId() !== null) player.stop();
      active = true;
      if (!wasActive) notify();
      playTurn(first);
    },
    stop() {
      const was = active;
      active = false;
      expecting = null;
      player.stop();
      if (was) notify();
    },
    cancel() {
      if (!active) return;
      active = false;
      expecting = null;
      notify();
    },
    isActive: () => active,
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}
