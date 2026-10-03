/**
 * LANG G2 — nhiều nút nghe trong một bài nhưng chỉ một âm thanh phát cùng lúc:
 * bấm mục khác thì dừng mục đang phát, bấm lại mục đang phát thì dừng.
 *
 * Tách khỏi component và nhận `make` để thử bằng audio giả. Trình duyệt dùng
 * `getBrowserAudioPlayer()` (một thể hiện chung cho cả trang).
 */

export interface AudioLike {
  play(): Promise<void> | void;
  pause(): void;
  currentTime: number;
  onended: (() => void) | null;
  onerror: (() => void) | null;
}

export interface ExclusivePlayer {
  toggle(id: string, url: string): void;
  stop(): void;
  playingId(): string | null;
  subscribe(fn: () => void): () => void;
}

export function createExclusivePlayer(make: (url: string) => AudioLike): ExclusivePlayer {
  let current: { id: string; audio: AudioLike } | null = null;
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((fn) => fn());

  function clearIf(audio: AudioLike) {
    if (current?.audio === audio) {
      current = null;
      notify();
    }
  }

  return {
    toggle(id, url) {
      const prev = current;
      if (prev) {
        prev.audio.pause();
        current = null;
        if (prev.id === id) {
          notify();
          return;
        }
      }
      const audio = make(url);
      audio.onended = () => clearIf(audio);
      audio.onerror = () => clearIf(audio);
      current = { id, audio };
      notify();
      // Trình duyệt có thể từ chối phát (file mất, chặn tự phát): về trạng thái
      // không phát chứ không để lỗi chưa xử lý nổi lên.
      const r = audio.play();
      if (r && typeof (r as Promise<void>).catch === "function") {
        (r as Promise<void>).catch(() => clearIf(audio));
      }
    },
    stop() {
      if (!current) return;
      current.audio.pause();
      current = null;
      notify();
    },
    playingId: () => current?.id ?? null,
    subscribe(fn) {
      listeners.add(fn);
      return () => {
        listeners.delete(fn);
      };
    },
  };
}

let browserPlayer: ExclusivePlayer | null = null;

/** Chỉ gọi ở trình duyệt (cần `Audio`). */
export function getBrowserAudioPlayer(): ExclusivePlayer {
  browserPlayer ??= createExclusivePlayer((url) => new Audio(url) as unknown as AudioLike);
  return browserPlayer;
}
