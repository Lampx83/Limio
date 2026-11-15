import { describe, expect, it, vi } from "vitest";
import {
  EnglishMarkupError,
  LectureScript,
  PAUSE_AFTER_LECTURE_SEC,
  PAUSE_BETWEEN_VOICES_SEC,
  fakeSynthesize,
  generateNarrationAudio,
  hasEnglishMarkup,
  parseEnglishSpans,
  planNarration,
  stripEnglishMarkup,
  type LectureSegmentTime,
} from "../index";

// docs/tieu-chi/slide-giang-song-ngu.md — S1–S5, V1–V2, V6, T1–T4.

const synth = (text: string, voice: string) => Promise.resolve(fakeSynthesize(text, voice));
const fakeSec = (text: string) => Math.max(0.4, text.length * 0.045);

describe("parseEnglishSpans (S1, S2, T1)", () => {
  it("một đoạn tiếng Anh giữa lời giảng: ba đoạn đúng giọng, dấu câu liền sau thẻ không bị đọc lẻ", () => {
    expect(parseEnglishSpans("Ta nói [en: I had my car repaired], nghĩa là xe được sửa giúp mình.")).toEqual([
      { role: "lecturer", text: "Ta nói" },
      { role: "en", text: "I had my car repaired" },
      { role: "lecturer", text: "nghĩa là xe được sửa giúp mình." },
    ]);
  });

  it("nhiều đoạn, đoạn ở đầu và ở cuối, chữ hoa thẻ, khoảng trắng sau dấu hai chấm", () => {
    expect(parseEnglishSpans("[EN:Hello there] rồi tiếp. [en:   Nice to meet you  ]")).toEqual([
      { role: "en", text: "Hello there" },
      { role: "lecturer", text: "rồi tiếp." },
      { role: "en", text: "Nice to meet you" },
    ]);
  });

  it("không có thẻ thì cả chuỗi là giọng giảng viên", () => {
    expect(parseEnglishSpans("Chỉ có tiếng Việt.")).toEqual([{ role: "lecturer", text: "Chỉ có tiếng Việt." }]);
    expect(hasEnglishMarkup("Chỉ có tiếng Việt.")).toBe(false);
  });

  it("thẻ không đóng, rỗng hoặc lồng nhau thì ném lỗi có mã và vị trí", () => {
    const code = (t: string) => {
      try {
        parseEnglishSpans(t);
        return null;
      } catch (e) {
        return e instanceof EnglishMarkupError ? `${e.code}@${e.at}` : "khac";
      }
    };
    expect(code("Ta nói [en: thiếu đóng")).toBe("unclosed@7");
    expect(code("Ta nói [en:   ] rồi")).toBe("empty@7");
    expect(code("Ta nói [en: a [b] c]")).toBe("nested@7");
  });

  it("stripEnglishMarkup bỏ thẻ và giữ chữ tiếng Anh (S5)", () => {
    expect(stripEnglishMarkup("Ta nói [en: I had my car repaired], nghĩa là…")).toBe("Ta nói I had my car repaired, nghĩa là…");
    expect(stripEnglishMarkup("Không có thẻ.")).toBe("Không có thẻ.");
  });
});

describe("LectureScript từ chối thẻ sai cú pháp ngay lúc lưu (S2)", () => {
  it("nhận kịch bản đúng, từ chối thẻ không đóng", () => {
    expect(LectureScript.safeParse([{ anchor: "s0b0", text: "Ta nói [en: Hello]." }]).success).toBe(true);
    expect(LectureScript.safeParse([{ anchor: "s0b0", text: "Ta nói [en: Hello." }]).success).toBe(false);
  });
});

describe("planNarration với tiếng Anh xen kẽ (V1, T2)", () => {
  it("mục không có tiếng Anh giữ đúng dạng cũ: không có chunkRoles", () => {
    const [u] = planNarration("lecture", [{ anchor: "s0b0", text: "Xin chào. Hôm nay học ngữ pháp." }]);
    expect(u!.role).toBe("lecturer");
    expect(u!.chunkRoles).toBeUndefined();
  });

  it("mục có tiếng Anh: vai từng đoạn theo thứ tự, không mất và không thừa chữ", () => {
    const [u] = planNarration("lecture", [{ anchor: "s0b0", text: "Ta nói [en: I had my car repaired], nghĩa là xe được sửa." }]);
    expect(u!.chunks).toEqual(["Ta nói", "I had my car repaired", "nghĩa là xe được sửa."]);
    expect(u!.chunkRoles).toEqual(["lecturer", "en", "lecturer"]);
    expect(u!.pauseAfterSec).toBe(PAUSE_AFTER_LECTURE_SEC);
  });

  it("đoạn tiếng Anh dài hơn giới hạn vẫn được cắt theo câu và giữ vai en", () => {
    const long = Array.from({ length: 12 }, (_, i) => `This is a fairly long English sentence number ${i + 1}.`).join(" ");
    const [u] = planNarration("lecture", [{ anchor: "s0b0", text: `Nghe nhé [en: ${long}]` }]);
    expect(u!.chunks.length).toBeGreaterThan(2);
    expect(u!.chunkRoles!.slice(1).every((r) => r === "en")).toBe(true);
    expect(u!.chunks.slice(1).join(" ")).toBe(long);
  });
});

describe("generateNarrationAudio hai vai (V1, V2, V6, T3)", () => {
  const SCRIPT = [
    { anchor: "s0b0", text: "Ta nói [en: I had my car repaired], nghĩa là xe được sửa." },
    { anchor: "s0b1", text: "Một bước chỉ có tiếng Việt thôi." },
  ];
  const VOICES = { lecturer: "baotrang", en: "af_heart" };

  it("đọc đúng giọng cho đúng đoạn, mốc thời gian đúng, chen 0,2 giây khi đổi giọng", async () => {
    const spy = vi.fn(synth);
    const r = await generateNarrationAudio("lecture", SCRIPT, VOICES, { synthesize: spy });
    expect(spy.mock.calls.map((c) => [c[1], c[0]])).toEqual([
      ["baotrang", "Ta nói"],
      ["af_heart", "I had my car repaired"],
      ["baotrang", "nghĩa là xe được sửa."],
      ["baotrang", "Một bước chỉ có tiếng Việt thôi."],
    ]);
    const segs = r.segments as LectureSegmentTime[];
    const dur0 = fakeSec("Ta nói") + fakeSec("I had my car repaired") + fakeSec("nghĩa là xe được sửa.") + 2 * PAUSE_BETWEEN_VOICES_SEC;
    expect(segs[0]!.endSec - segs[0]!.startSec).toBeCloseTo(dur0, 1);
    expect(segs[1]!.startSec - segs[0]!.endSec).toBeCloseTo(PAUSE_AFTER_LECTURE_SEC, 1);
  });

  it("thiếu giọng tiếng Anh thì báo lỗi trước khi gọi bộ đọc lần nào", async () => {
    const spy = vi.fn(synth);
    const err = await generateNarrationAudio("lecture", SCRIPT, { lecturer: "baotrang" }, { synthesize: spy }).catch((e) => e);
    expect(err.code).toBe("tts_failed");
    expect(err.message).toContain("en");
    expect(spy).not.toHaveBeenCalled();
  });

  it("đổi giọng Anh chỉ đọc lại đúng đoạn tiếng Anh; phần giọng giảng viên lấy từ bộ nhớ đệm", async () => {
    const store = new Map<string, Buffer>();
    const cache = { get: async (k: string) => store.get(k) ?? null, put: async (k: string, w: Buffer) => void store.set(k, w) };
    await generateNarrationAudio("lecture", SCRIPT, VOICES, { synthesize: synth, cache });
    const spy = vi.fn(synth);
    const r = await generateNarrationAudio("lecture", SCRIPT, { ...VOICES, en: "am_adam" }, { synthesize: spy, cache });
    expect(spy.mock.calls.map((c) => [c[1], c[0]])).toEqual([["am_adam", "I had my car repaired"]]);
    expect(r.reused).toBe(3);
  });

  it("lời giảng không có tiếng Anh không cần vai en", async () => {
    const spy = vi.fn(synth);
    await generateNarrationAudio("lecture", [SCRIPT[1]!], { lecturer: "baotrang" }, { synthesize: spy });
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
