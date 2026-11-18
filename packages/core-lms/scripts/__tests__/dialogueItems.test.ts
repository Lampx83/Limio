import { describe, expect, it } from "vitest";
import { markdownToHtml, placePractices, dialoguePayload, dialogueSlotsOf } from "../import-course";
import { assignVoices, attachDialogueAudio, dialogueAudioFile, makeNeuSynth, resolveNeu, speakableTurn, voiceGender } from "../dialogue-audio";
import { validateContentPayload } from "../../src/courses/contentSchemas";

/**
 * Tài nguyên hội thoại trong importer: mốc `:::dialogue n` đặt giữa thân bài (cùng cơ chế `:::practice n`), payload hợp lệ với
 * loại `dialogue` của LMS, và audio từng lượt gắn theo giọng của từng người nói.
 */
describe("mốc :::dialogue n", () => {
  it("thành chỗ đặt, không bị lưu vào bài", () => {
    const html = markdownToHtml("chữ trước\n\n:::dialogue 1\n\nchữ sau\n\n:::practice 1\n", { toc: false });
    expect(html).toContain('data-dialogue-slot="1"');
    expect(html).toContain('data-practice-slot="1"');
  });

  it("dialogueSlotsOf đọc số thứ tự theo thứ tự xuất hiện", () => {
    expect(dialogueSlotsOf("a\n:::dialogue 2\nb\n:::dialogue 1\n")).toEqual([2, 1]);
  });

  it("placePractices đặt hội thoại và bài luyện đúng chỗ, phần chưa có mốc xếp cuối (hội thoại trước, bài luyện sau)", () => {
    const html = markdownToHtml("A\n\n:::dialogue 1\n\nB\n\n:::practice 2\n\nC\n", { toc: false });
    const placed = placePractices([{ type: "richtext", orderIndex: 0, payload: { html } }] as never, 2, 2);
    const kinds = placed.map((b) => ("item" in b ? "text" : "practice" in b ? `p${b.practice + 1}` : `d${b.dialogue + 1}`));
    expect(kinds).toEqual(["text", "d1", "text", "p2", "text", "d2", "p1"]);
  });

  it("mốc :::vocab đặt bộ thẻ từ mới ngay tại mốc; không có mốc thì để nguyên chỗ cũ", () => {
    const cards = { type: "vocab_list", orderIndex: 1, payload: { items: [] } };
    const withSlot = markdownToHtml("A\n\n:::dialogue 1\n\n:::vocab\n\nB\n", { toc: false });
    const placed = placePractices([{ type: "richtext", orderIndex: 0, payload: { html: withSlot } }, cards] as never, 0, 1);
    const kind = (b: (typeof placed)[number]) => ("item" in b ? (b.item.type === "vocab_list" ? "vocab" : "text") : "dialogue" in b ? "d" : "p");
    expect(placed.map(kind)).toEqual(["text", "d", "vocab", "text"]);
    const noSlot = markdownToHtml("A\n\n:::dialogue 1\n\nB\n", { toc: false });
    const placed2 = placePractices([{ type: "richtext", orderIndex: 0, payload: { html: noSlot } }, cards] as never, 0, 1);
    expect(placed2.map(kind)).toEqual(["text", "d", "text", "vocab"]);
  });

  it("giữ cách gọi cũ (không có hội thoại)", () => {
    const html = markdownToHtml("A\n\n:::practice 1\n\nB\n", { toc: false });
    const placed = placePractices([{ type: "richtext", orderIndex: 0, payload: { html } }] as never, 1);
    expect(placed.map((b) => ("item" in b ? "text" : "practice" in b ? "p" : "d"))).toEqual(["text", "p", "text"]);
  });
});

describe("payload hội thoại", () => {
  const spec = {
    caption: "在家里。",
    turns: [
      { speaker: "刘明", text: "这是杨同乐吗？", reading: "Zhè shì Yáng Tónglè ma?", translation: "Is that Yang Tongle?" },
      { speaker: "王一雪", text: "不是。" },
    ],
  };

  it("hợp lệ với loại dialogue của LMS, có nhãn phiên âm mặc định", () => {
    const p = dialoguePayload(spec);
    expect(p.readingLabel).toBe("Pinyin");
    expect(() => validateContentPayload("dialogue", p)).not.toThrow();
  });

  it("lượt không có phiên âm/bản dịch thì không ghi khoá rỗng", () => {
    const p = dialoguePayload(spec);
    expect(p.turns[1]).toEqual({ speaker: "王一雪", text: "不是。" });
  });
});

describe("tên tệp audio của lượt", () => {
  it("sha1 của người nói|chữ, 16 ký tự đầu (Python build/common.py dùng đúng công thức này)", () => {
    expect(dialogueAudioFile("刘明", "这是杨同乐吗？他怎么跟白家月在一起？")).toBe("audio/dialogue/cec0f45dd19eb80d.mp3");
  });
  it("khác người nói thì khác tệp", () => {
    expect(dialogueAudioFile("A", "你好")).not.toBe(dialogueAudioFile("B", "你好"));
  });
});

describe("audio từng lượt", () => {
  it("mỗi người nói một giọng, xoay vòng khi ít giọng hơn người nói", () => {
    const m = assignVoices(["A", "B", "A", "C"], ["v1", "v2"]);
    expect([m.get("A"), m.get("B"), m.get("C")]).toEqual(["v1", "v2", "v1"]);
  });

  it("bỏ dấu ba chấm trình bày khi đọc", () => {
    expect(speakableTurn("我的……不见了")).toBe("我的 不见了");
  });

  it("gắn audioUrl cho lượt chưa có, bỏ qua lượt đã có, đọc một lần với cùng giọng + cùng chữ, lỗi không chặn", async () => {
    const calls: string[] = [];
    const ctx = {
      synth: {
        voiceFor: () => "v1",
        synthesize: async (text: string, voice: string) => {
          calls.push(`${voice}:${text}`);
          if (text === "坏") throw new Error("lỗi cổng");
          return Buffer.from("mp3");
        },
      },
      voices: ["v1", "v2"],
      store: async () => `/api/lesson-media/audio/f${calls.length}.mp3`,
    };
    const turns = [
      { speaker: "A", text: "你好" },
      { speaker: "B", text: "你好" },
      { speaker: "A", text: "你好" },
      { speaker: "B", text: "坏" },
      { speaker: "A", text: "有了", audioUrl: "/api/lesson-media/audio/old.mp3" },
    ];
    const r = await attachDialogueAudio(turns, ctx, new Map());
    expect(r).toEqual({ attached: 3, failed: 1 });
    expect(calls).toEqual(["v1:你好", "v2:你好", "v2:坏"]); // A đọc một lần (lượt 3 dùng lại bộ nhớ đệm)
    expect(turns[4]!.audioUrl).toBe("/api/lesson-media/audio/old.mp3");
    expect(turns[3]!.audioUrl).toBeUndefined();
  });
});

describe("cổng NEU", () => {
  const secrets: Record<string, string> = { "neutts.base_url": "http://gw:8037/tts/", "neutts.api_key": "k", "neutts.voice_zh": "vz" };
  const secret = async (key: string) => {
    if (!(key in secrets)) throw new Error(`key_not_found ${key}`);
    return secrets[key]!;
  };
  const voices404 = (async () => new Response("nf", { status: 404 })) as unknown as typeof fetch;

  it("cổng không mở /v1/voices (404) thì dùng giọng admin đã chọn, không lỗi", async () => {
    const r = await resolveNeu("zh", voices404, secret);
    expect(r.voices).toEqual(["vz"]);
  });

  it("giọng đã chọn đứng đầu, giọng liệt kê được bổ sung phía sau, không trùng", async () => {
    const f = (async () => Response.json({ voices: [{ voice: "a", language: "zh" }, { voice: "vz", language: "zh" }, { voice: "e", language: "en" }] })) as unknown as typeof fetch;
    expect((await resolveNeu("zh", f, secret)).voices).toEqual(["vz", "a"]);
  });

  it("loại giọng zf_xiaoni khỏi danh sách, kể cả khi admin chọn làm giọng mặc định", async () => {
    const f = (async () => Response.json({ voices: [{ voice: "zf_xiaobei", language: "zh" }, { voice: "zf_xiaoni", language: "zh" }, { voice: "zm_yunxi", language: "zh" }] })) as unknown as typeof fetch;
    expect((await resolveNeu("zh", f, secret)).voices).toEqual(["vz", "zf_xiaobei", "zm_yunxi"]);
    const chosen = async (key: string) => (key === "neutts.voice_zh" ? "zf_xiaoni" : secrets[key]!);
    expect((await resolveNeu("zh", f, chosen)).voices).toEqual(["zf_xiaobei", "zm_yunxi"]);
  });

  it("không có giọng nào thì báo lỗi rõ ràng", async () => {
    const noVoice = async (key: string) => (key === "neutts.voice_zh" ? Promise.reject(new Error("nf")) : secrets[key]!);
    await expect(resolveNeu("zh", voices404, noVoice)).rejects.toThrow(/không có giọng "zh"/);
  });

  it("đọc gọi <base>/v1/speech giữ đường dẫn /tts, gửi x-api-key và voice", async () => {
    let seen: { url: string; headers: Record<string, string>; body: string } | null = null;
    const f = (async (url: string, init: { headers: Record<string, string>; body: string }) => {
      seen = { url, headers: init.headers, body: init.body };
      return new Response("x", { status: 500 });
    }) as unknown as typeof fetch;
    await expect(makeNeuSynth("http://gw:8037/tts/", "k", f).synthesize("你好", "vz")).rejects.toThrow(/500/);
    expect(seen!.url).toBe("http://gw:8037/tts/v1/speech");
    expect(seen!.headers["x-api-key"]).toBe("k");
    expect(JSON.parse(seen!.body)).toEqual({ text: "你好", voice: "vz", normalize: true });
  });
});

describe("giọng theo giới tính", () => {
  const voices = ["zf_xiaobei", "zf_xiaoni", "zm_yunjian", "zm_yunxi"];
  it("nhận giới tính từ tên giọng NEU", () => {
    expect([voiceGender("zf_xiaobei"), voiceGender("zm_yunxi"), voiceGender("baotrang")]).toEqual(["f", "m", null]);
  });
  it("nam dùng giọng nam, nữ dùng giọng nữ, hai người cùng giới khác giọng", () => {
    const m = assignVoices(["刘明", "王一雪", "白家月", "李文"], voices, { 刘明: "m", 王一雪: "f", 白家月: "f", 李文: "m" });
    expect([m.get("刘明"), m.get("王一雪"), m.get("白家月"), m.get("李文")]).toEqual(["zm_yunjian", "zf_xiaobei", "zf_xiaoni", "zm_yunxi"]);
  });
  it("không biết giới tính thì xoay vòng như cũ", () => {
    const m = assignVoices(["A", "B"], voices);
    expect([m.get("A"), m.get("B")]).toEqual(["zf_xiaobei", "zf_xiaoni"]);
  });
  it("--force đọc lại lượt đã có audio", async () => {
    const ctx = { synth: { synthesize: async () => Buffer.from("x") }, voices: ["v"], store: async () => "/api/lesson-media/audio/new.mp3", force: true };
    const turns = [{ speaker: "A", text: "你好", audioUrl: "/api/lesson-media/audio/old.mp3" }];
    await attachDialogueAudio(turns, ctx, new Map());
    expect(turns[0]!.audioUrl).toBe("/api/lesson-media/audio/new.mp3");
  });
});

describe("giọng cố định và ngắt nghỉ (khoá HSK)", () => {
  it("hội thoại đọc tự nhiên cả lượt MỘT lần, không cắt ghép vế", async () => {
    const { attachDialogueAudio } = await import("../dialogue-audio");
    const calls: string[] = [];
    const ctx = {
      synth: { synthesize: async (t: string, v: string) => (calls.push(`${v}:${t}`), Buffer.from(t)) },
      voices: ["zf_xiaoyi", "zm_yunxi"],
      store: async () => "/a/1.mp3",
    };
    await attachDialogueAudio([{ speaker: "林雨", text: "二位好，请进。" }], ctx as never, new Map());
    expect(calls).toEqual(["zf_xiaoyi:二位好，请进。"]);
  });
  it("assignVoices dùng giọng cố định cho nhân vật, dù thứ tự xuất hiện khác nhau giữa hai hội thoại", async () => {
    const { assignVoices } = await import("../dialogue-audio");
    const voices = ["zf_xiaobei", "zf_xiaoyi", "zm_yunjian", "zm_yunxi"];
    const fixed = { 林雨: "zf_xiaobei", 赵叔叔: "zm_yunjian", 方强: "zm_yunxi" };
    const genders = { 林雨: "f", 赵叔叔: "m", 方强: "m" } as const;
    const a = assignVoices(["赵叔叔", "林雨", "方强"], voices, genders, fixed);
    const b = assignVoices(["方强", "赵叔叔", "林雨"], voices, genders, fixed);
    expect([a.get("林雨"), a.get("赵叔叔"), a.get("方强")]).toEqual(["zf_xiaobei", "zm_yunjian", "zm_yunxi"]);
    expect([b.get("林雨"), b.get("赵叔叔"), b.get("方强")]).toEqual(["zf_xiaobei", "zm_yunjian", "zm_yunxi"]);
  });
});
