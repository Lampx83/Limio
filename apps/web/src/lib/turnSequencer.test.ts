import { describe, expect, it } from "vitest";
import { createExclusivePlayer, type AudioLike } from "@/lib/exclusiveAudio";
import { createTurnSequencer } from "@/lib/turnSequencer";

/**
 * LANG K1 — "Nghe cả đoạn": phát lần lượt audio từng lượt hội thoại; lượt đang
 * phát chính là playingId của bộ phát chung nên giao diện tô sáng nó. Không cần
 * mốc thời gian vì mỗi lượt đã là một file riêng.
 */

function setup(turns: { id: string; audioUrl?: string }[]) {
  const made: { url: string; audio: AudioLike & { paused: boolean } }[] = [];
  const player = createExclusivePlayer((url) => {
    const audio = {
      paused: false,
      currentTime: 0,
      onended: null as (() => void) | null,
      onerror: null as (() => void) | null,
      play() {},
      pause() {
        this.paused = true;
      },
    };
    made.push({ url, audio });
    return audio;
  });
  const seq = createTurnSequencer(player, turns);
  const finish = () => made[made.length - 1]!.audio.onended!(); // phát hết tự nhiên
  const fail = () => made[made.length - 1]!.audio.onerror!();
  return { player, seq, made, finish, fail };
}

const T = [
  { id: "a", audioUrl: "/a.mp3" },
  { id: "b" }, // không có audio
  { id: "c", audioUrl: "/c.mp3" },
  { id: "d", audioUrl: "/d.mp3" },
];

describe("createTurnSequencer", () => {
  it("start() phát lượt đầu có audio và bật chế độ chuỗi", () => {
    const { seq, player } = setup(T);
    expect(seq.isActive()).toBe(false);
    seq.start();
    expect(player.playingId()).toBe("a");
    expect(seq.isActive()).toBe(true);
  });

  it("hết một lượt thì sang lượt kế CÓ audio (bỏ qua lượt không có), tới hết thì tự tắt", () => {
    const { seq, player, finish, made } = setup(T);
    seq.start();
    finish();
    expect(player.playingId()).toBe("c"); // bỏ qua b
    finish();
    expect(player.playingId()).toBe("d");
    finish();
    expect(player.playingId()).toBeNull();
    expect(seq.isActive()).toBe(false);
    expect(made.map((m) => m.url)).toEqual(["/a.mp3", "/c.mp3", "/d.mp3"]);
  });

  it("lượt phát lỗi (file mất) thì bỏ qua, không kẹt chuỗi", () => {
    const { seq, player, fail } = setup(T);
    seq.start();
    fail();
    expect(player.playingId()).toBe("c");
  });

  it("start(fromId) bắt đầu từ lượt đó; lượt đó không có audio thì lấy lượt kế có audio", () => {
    const s1 = setup(T);
    s1.seq.start("c");
    expect(s1.player.playingId()).toBe("c");
    const s2 = setup(T);
    s2.seq.start("b");
    expect(s2.player.playingId()).toBe("c");
  });

  it("start(fromId) từ lượt cuối không còn audio phía sau → không làm gì", () => {
    const turns = [{ id: "a", audioUrl: "/a.mp3" }, { id: "z" }];
    const { seq, player } = setup(turns);
    seq.start("z");
    expect(player.playingId()).toBeNull();
    expect(seq.isActive()).toBe(false);
  });

  it("không có lượt nào có audio → start() không làm gì", () => {
    const { seq, player } = setup([{ id: "a" }, { id: "b" }]);
    seq.start();
    expect(player.playingId()).toBeNull();
    expect(seq.isActive()).toBe(false);
  });

  it("đang chạy chuỗi mà start(fromId) lượt khác → nhảy tới đó và chạy tiếp từ đó", () => {
    const { seq, player, finish } = setup(T);
    seq.start();
    seq.start("c");
    expect(player.playingId()).toBe("c");
    expect(seq.isActive()).toBe(true);
    finish();
    expect(player.playingId()).toBe("d");
  });

  it("stop() dừng tiếng và tắt chuỗi; sự kiện kết thúc muộn không phát tiếp", () => {
    const { seq, player, finish, made } = setup(T);
    seq.start();
    seq.stop();
    expect(player.playingId()).toBeNull();
    expect(seq.isActive()).toBe(false);
    finish(); // audio cũ báo ended muộn
    expect(player.playingId()).toBeNull();
    expect(made).toHaveLength(1);
  });

  it("cancel() tắt chuỗi nhưng KHÔNG dừng tiếng đang phát; hết lượt này thì thôi", () => {
    const { seq, player, finish } = setup(T);
    seq.start();
    seq.cancel();
    expect(player.playingId()).toBe("a");
    finish();
    expect(player.playingId()).toBeNull();
  });

  it("người học bấm phát một lượt khác bằng nút riêng → chuỗi nhường, không tự chạy tiếp sau đó", () => {
    const { seq, player, finish } = setup(T);
    seq.start();
    player.toggle("d", "/d.mp3"); // bấm nút nghe của lượt d
    expect(seq.isActive()).toBe(false);
    expect(player.playingId()).toBe("d");
    finish();
    expect(player.playingId()).toBeNull();
  });

  it("báo cho người nghe khi bật/tắt (để nút đổi nhãn Nghe cả đoạn ↔ Dừng)", () => {
    const { seq, finish } = setup([{ id: "a", audioUrl: "/a.mp3" }]);
    const seen: boolean[] = [];
    seq.subscribe(() => seen.push(seq.isActive()));
    seq.start();
    finish();
    expect(seen).toEqual([true, false]);
  });
});
