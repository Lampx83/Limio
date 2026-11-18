import { describe, expect, it, vi } from "vitest";
import { encodeWav } from "../../src/narration/audio";
import { attachVocabAudio, createNeuVocabSynth, itemsNeedingAudio, speakableTerm, type VocabSynth } from "../vocab-audio";

const fakeSynth = (voices: Record<string, string>, fail: string[] = []): VocabSynth & { calls: string[] } => {
  const calls: string[] = [];
  return {
    calls,
    voiceFor: (lang) => voices[lang] ?? null,
    synthesize: async (text) => {
      calls.push(text);
      if (fail.includes(text)) throw new Error("boom");
      return Buffer.from(text);
    },
  };
};

describe("speakableTerm", () => {
  it("đọc sb/sth thành từ đầy đủ, bỏ ký hiệu trình bày (tiếng Anh)", () => {
    expect(speakableTerm("take sb out", "en")).toBe("take somebody out");
    expect(speakableTerm("get sth done", "en")).toBe("get something done");
    expect(speakableTerm("(be) in a rush", "en")).toBe("be in a rush");
    expect(speakableTerm("look forward to / look forward to doing sth", "en")).toBe(
      "look forward to or look forward to doing something",
    );
    expect(speakableTerm("  early   bird ", "en")).toBe("early bird");
  });

  it("không đổi sb/sth ở ngôn ngữ khác", () => {
    expect(speakableTerm("你好", "zh")).toBe("你好");
    expect(speakableTerm("sb", "zh")).toBe("sb");
  });
});

describe("itemsNeedingAudio", () => {
  it("bỏ mục đã có audio, mục không có term, mục quá dài", () => {
    const items = [
      { term: "early bird" },
      { term: "done", audioUrl: "/api/lesson-media/audio/x-1234567890-ab.mp3" },
      { meaning: "no term" },
      { term: "x".repeat(201) },
    ];
    expect(itemsNeedingAudio(items, "en").map((x) => x.text)).toEqual(["early bird"]);
  });
});

describe("attachVocabAudio", () => {
  const store = (urls: string[]) => async (b: Buffer) => {
    const u = `/api/lesson-media/audio/${urls.length}-${b.toString()}.mp3`;
    urls.push(u);
    return u;
  };

  it("gắn audioUrl cho từng mục, đọc cùng một từ một lần cho cả khoá", async () => {
    const synth = fakeSynth({ en: "en-voice" });
    const urls: string[] = [];
    const cache = new Map<string, string>();
    const a = [{ term: "take over" }, { term: "early bird" }];
    const b = [{ term: "take over" }];
    const ctx = { synth, language: "en", store: store(urls) };
    expect(await attachVocabAudio(a, ctx, cache)).toEqual({ attached: 2, failed: 0 });
    expect(await attachVocabAudio(b, ctx, cache)).toEqual({ attached: 1, failed: 0 });
    expect(synth.calls).toEqual(["take over", "early bird"]);
    expect(urls).toHaveLength(2);
    expect(b[0]!).toMatchObject({ audioUrl: a[0]!.audioUrl });
  });

  it("không có giọng của ngôn ngữ → không đọc, không ném lỗi", async () => {
    const synth = fakeSynth({ vi: "vi-voice" });
    const items = [{ term: "early bird" }];
    expect(await attachVocabAudio(items, { synth, language: "en", store: store([]) }, new Map())).toEqual({ attached: 0, failed: 0 });
    expect(synth.calls).toEqual([]);
    expect(items[0]).not.toHaveProperty("audioUrl");
  });

  it("một từ lỗi không chặn các từ khác; từ lỗi không có audioUrl", async () => {
    const synth = fakeSynth({ en: "v" }, ["bad"]);
    const warn = vi.fn();
    const items = [{ term: "ok" }, { term: "bad" }, { term: "fine" }];
    const r = await attachVocabAudio(items, { synth, language: "en", store: store([]), warn }, new Map());
    expect(r).toEqual({ attached: 2, failed: 1 });
    expect(items[1]).not.toHaveProperty("audioUrl");
    expect(warn).toHaveBeenCalledOnce();
  });

  it("giữ nguyên audioUrl đã có (nhập lại không ghi đè)", async () => {
    const synth = fakeSynth({ en: "v" });
    const items = [{ term: "x", audioUrl: "/keep.mp3" }];
    await attachVocabAudio(items, { synth, language: "en", store: store([]) }, new Map());
    expect(items[0]!.audioUrl).toBe("/keep.mp3");
    expect(synth.calls).toEqual([]);
  });
});

describe("createNeuVocabSynth", () => {
  const secrets = (m: Record<string, string>) => async (k: string) => {
    if (k in m) return m[k]!;
    throw new Error("key_not_found");
  };

  it("chưa cấu hình khoá → null", async () => {
    expect(await createNeuVocabSynth(vi.fn() as unknown as typeof fetch, secrets({}))).toBeNull();
  });

  it("chọn giọng theo ngôn ngữ; synthesize trả MP3 (không phải WAV)", async () => {
    const wav = encodeWav({ sampleRate: 48_000, samples: new Int16Array(48_000).map((_, i) => Math.round(Math.sin(i / 20) * 8000)) });
    const fetchMock = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      if (u.endsWith("/v1/voices")) {
        return new Response(JSON.stringify({ voices: [{ voice: "baotrang", language: "vi" }, { voice: "emma", language: "en" }, "legacy"] }));
      }
      return new Response(new Uint8Array(wav));
    });
    const synth = await createNeuVocabSynth(fetchMock as unknown as typeof fetch, secrets({ "neutts.base_url": "http://gw/tts/", "neutts.api_key": "k" }));
    expect(synth).not.toBeNull();
    expect(synth!.voiceFor("en")).toBe("emma");
    expect(synth!.voiceFor("vi")).toBe("baotrang");
    expect(synth!.voiceFor("zh")).toBeNull();

    const mp3 = await synth!.synthesize("early bird", "emma");
    expect(mp3.subarray(0, 4).toString("ascii")).not.toBe("RIFF");
    expect(mp3.length).toBeGreaterThan(100);
    const speechCall = fetchMock.mock.calls.find(([u]) => String(u).endsWith("/v1/speech"))!;
    expect(String(speechCall[0])).toBe("http://gw/tts/v1/speech");
    expect(JSON.parse(String((speechCall[1] as RequestInit).body))).toEqual({ text: "early bird", voice: "emma", normalize: true });
  });
});

describe("đọc hai lần: nam trước, nữ sau (khoá tiếng Trung)", () => {
  const pcm = (n: number, v: number) => ({ sampleRate: 48000, samples: new Int16Array(n).fill(v) });
  it("pickMaleFemale chọn cặp nam–nữ đầu tiên và bỏ zf_xiaoni", async () => {
    const { pickMaleFemale } = await import("../vocab-audio");
    expect(pickMaleFemale(["zf_xiaoni", "zf_xiaobei", "zm_yunxi", "zm_yunjian"])).toEqual({ male: "zm_yunxi", female: "zf_xiaobei" });
    expect(pickMaleFemale(["zf_xiaoni", "zm_yunxi"])).toBeNull();
    expect(pickMaleFemale(["zf_xiaobei"])).toBeNull();
  });
  it("joinPairMp3 nối nam, lặng, nữ rồi mã hoá MP3 (dài hơn một lần đọc)", async () => {
    const { joinPairMp3 } = await import("../vocab-audio");
    const one = joinPairMp3(pcm(48000, 2000), pcm(1, 0), 0);
    const both = joinPairMp3(pcm(48000, 2000), pcm(48000, 2000), 0.7);
    expect(both.length).toBeGreaterThan(one.length);
    expect(() => joinPairMp3(pcm(10, 1), { sampleRate: 24000, samples: new Int16Array(5) })).toThrow(/Tần số/);
  });
  it("attachVocabAudio đọc nam rồi nữ cho mỗi từ zh, một tệp mỗi từ; ngôn ngữ khác vẫn một giọng", async () => {
    const calls: string[] = [];
    const synth: VocabSynth = {
      voiceFor: () => "zf_xiaobei",
      voicesOf: () => ["zf_xiaobei", "zm_yunxi"],
      synthesize: async (t, v) => (calls.push(`mp3:${v}:${t}`), Buffer.from(t)),
      synthesizePcm: async (t, v) => (calls.push(`pcm:${v}:${t}`), pcm(4800, v.startsWith("zm") ? 1000 : 2000)),
    };
    const stored: Buffer[] = [];
    const ctx = { synth, language: "zh", store: async (b: Buffer) => (stored.push(b), `/a/${stored.length}.mp3`) };
    const items = [{ term: "租" }, { term: "租" }, { term: "钥匙" }];
    const r = await attachVocabAudio(items, ctx, new Map());
    expect(r).toEqual({ attached: 3, failed: 0 });
    expect(calls).toEqual(["pcm:zm_yunxi:租", "pcm:zf_xiaobei:租", "pcm:zm_yunxi:钥匙", "pcm:zf_xiaobei:钥匙"]);
    expect(items.map((i: { audioUrl?: string }) => i.audioUrl)).toEqual(["/a/1.mp3", "/a/1.mp3", "/a/2.mp3"]);
    // ngôn ngữ khác: một giọng, không dùng PCM
    calls.length = 0;
    await attachVocabAudio([{ term: "word" }], { ...ctx, language: "en" }, new Map());
    expect(calls).toEqual(["mp3:zf_xiaobei:word"]);
  });
  it("force đọc lại mục đã có audio", async () => {
    const { itemsNeedingAudio } = await import("../vocab-audio");
    const items = [{ term: "租", audioUrl: "/api/lesson-media/audio/x.mp3" }];
    expect(itemsNeedingAudio(items, "zh").length).toBe(0);
    expect(itemsNeedingAudio(items, "zh", true).length).toBe(1);
  });
});

describe("audio tổng hợp cả bảng từ", () => {
  const pcm = (n: number) => ({ sampleRate: 48000, samples: new Int16Array(n).fill(1500) });
  const mk = () => {
    const calls: string[] = [];
    const synth: VocabSynth = {
      voiceFor: () => "zf_xiaobei",
      voicesOf: () => ["zm_yunxi", "zf_xiaobei"],
      synthesize: async (t) => Buffer.from(t),
      synthesizePcm: async (t, v) => (calls.push(`${v}:${t}`), pcm(4800)),
    };
    const stored: Buffer[] = [];
    return { calls, stored, ctx: { synth, language: "zh", store: async (b: Buffer) => (stored.push(b), `/a/${stored.length}.mp3`), pairPcm: new Map() } };
  };
  it("joinPcm chèn khoảng lặng giữa các đoạn", async () => {
    const { joinPcm } = await import("../vocab-audio");
    const out = joinPcm([pcm(100), pcm(100), pcm(100)], 0.01);
    expect(out.samples.length).toBe(300 + 2 * 480);
    expect(() => joinPcm([], 1)).toThrow();
  });
  it("attachVocabTrack ghép mọi từ theo thứ tự, dùng lại PCM đã đọc ở từng thẻ (không gọi cổng lần nữa)", async () => {
    const { attachVocabTrack } = await import("../vocab-audio");
    const { calls, stored, ctx } = mk();
    const payload: { items: Array<{ term: string; audioUrl?: string }>; audioUrl?: string } = { items: [{ term: "租" }, { term: "钥匙" }] };
    await attachVocabAudio(payload.items, ctx, new Map());
    expect(calls.length).toBe(4);
    expect(await attachVocabTrack(payload, ctx)).toBe(true);
    expect(calls.length).toBe(4); // dùng lại PCM
    expect(payload.audioUrl).toBe(`/a/${stored.length}.mp3`);
    expect(stored.length).toBe(3); // 2 thẻ + 1 tổng hợp
  });
  it("không ghi đè khi đã có (trừ --force); ngôn ngữ khác không làm", async () => {
    const { attachVocabTrack } = await import("../vocab-audio");
    const { ctx } = mk();
    expect(await attachVocabTrack({ items: [{ term: "租" }], audioUrl: "/x.mp3" }, ctx)).toBe(false);
    expect(await attachVocabTrack({ items: [{ term: "租" }], audioUrl: "/x.mp3" }, { ...ctx, force: true })).toBe(true);
    expect(await attachVocabTrack({ items: [{ term: "word" }] }, { ...ctx, language: "en" })).toBe(false);
  });
});
