import { describe, expect, it, vi } from "vitest";
import { createExclusivePlayer, type AudioLike } from "@/lib/exclusiveAudio";

/**
 * LANG G2 / G2.3.2 — nhiều nút nghe trong một bài nhưng chỉ một âm thanh phát
 * tại một thời điểm. Tách khỏi component để thử bằng audio giả.
 */

function fake() {
  const made: Array<AudioLike & { url: string; play: ReturnType<typeof vi.fn>; pause: ReturnType<typeof vi.fn> }> = [];
  const make = (url: string) => {
    const a = {
      url,
      currentTime: 0,
      onended: null as null | (() => void),
      onerror: null as null | (() => void),
      play: vi.fn(() => Promise.resolve()),
      pause: vi.fn(),
    };
    made.push(a);
    return a;
  };
  return { made, make };
}

describe("createExclusivePlayer", () => {
  it("bấm nghe: tạo audio, phát, và ghi lại đang phát mục nào", () => {
    const { made, make } = fake();
    const p = createExclusivePlayer(make);
    p.toggle("a", "/a.mp3");
    expect(made).toHaveLength(1);
    expect(made[0]!.url).toBe("/a.mp3");
    expect(made[0]!.play).toHaveBeenCalledTimes(1);
    expect(p.playingId()).toBe("a");
  });

  it("bấm nghe mục khác: dừng mục đang phát (không chồng tiếng) rồi phát mục mới", () => {
    const { made, make } = fake();
    const p = createExclusivePlayer(make);
    p.toggle("a", "/a.mp3");
    p.toggle("b", "/b.mp3");
    expect(made[0]!.pause).toHaveBeenCalledTimes(1);
    expect(made[1]!.play).toHaveBeenCalledTimes(1);
    expect(p.playingId()).toBe("b");
  });

  it("bấm lại đúng mục đang phát: dừng", () => {
    const { made, make } = fake();
    const p = createExclusivePlayer(make);
    p.toggle("a", "/a.mp3");
    p.toggle("a", "/a.mp3");
    expect(made[0]!.pause).toHaveBeenCalledTimes(1);
    expect(p.playingId()).toBeNull();
  });

  it("phát hết thì không còn mục nào đang phát; bấm lại phát từ đầu", () => {
    const { made, make } = fake();
    const p = createExclusivePlayer(make);
    p.toggle("a", "/a.mp3");
    made[0]!.onended!();
    expect(p.playingId()).toBeNull();
    p.toggle("a", "/a.mp3");
    expect(p.playingId()).toBe("a");
    expect(made.at(-1)!.currentTime).toBe(0);
  });

  it("lỗi tải/phát (file mất, trình duyệt chặn tự phát): không ném lỗi và trả về trạng thái không phát", async () => {
    const { made, make } = fake();
    const p = createExclusivePlayer(make);
    made.length = 0;
    const failing = (url: string) => {
      const a = make(url);
      a.play = vi.fn(() => Promise.reject(new Error("NotAllowedError")));
      return a;
    };
    const q = createExclusivePlayer(failing);
    expect(() => q.toggle("a", "/a.mp3")).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();
    expect(q.playingId()).toBeNull();
    // onerror của phần tử cũng đưa về không phát
    p.toggle("b", "/b.mp3");
    made.at(-1)!.onerror!();
    expect(p.playingId()).toBeNull();
  });

  it("stop(): dừng mục đang phát; gọi khi chưa phát không lỗi", () => {
    const { made, make } = fake();
    const p = createExclusivePlayer(make);
    expect(() => p.stop()).not.toThrow();
    p.toggle("a", "/a.mp3");
    p.stop();
    expect(made[0]!.pause).toHaveBeenCalled();
    expect(p.playingId()).toBeNull();
  });

  it("subscribe: báo mỗi lần trạng thái đổi và huỷ đăng ký được", () => {
    const { make } = fake();
    const p = createExclusivePlayer(make);
    const seen: Array<string | null> = [];
    const off = p.subscribe(() => seen.push(p.playingId()));
    p.toggle("a", "/a.mp3");
    p.toggle("b", "/b.mp3");
    p.stop();
    expect(seen).toEqual(["a", "b", null]);
    off();
    p.toggle("c", "/c.mp3");
    expect(seen).toHaveLength(3);
  });
});
