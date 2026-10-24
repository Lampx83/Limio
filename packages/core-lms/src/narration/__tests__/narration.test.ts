import { describe, expect, it, vi } from "vitest";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { registerUser } from "../../auth/register";
import {
  AudioError,
  GENERATION_STALE_MS,
  LectureScript,
  NarrationGenerationError,
  PAUSE_AFTER_LECTURE_SEC,
  PAUSE_AFTER_TURN_SEC,
  PcmTimeline,
  PodcastScript,
  TTS_MAX_CHARS,
  chunkCacheKey,
  claimNarrationForGeneration,
  encodeMp3,
  encodeWav,
  fakeSynthesize,
  failNarration,
  finishNarration,
  generateNarrationAudio,
  getLearnerNarrations,
  getPlayableNarrationFile,
  listCourseNarrations,
  narrationState,
  parseWav,
  saveNarrationScript,
  scriptHash,
  setNarrationProgress,
  splitForSpeech,
  type LectureSegmentTime,
  type PodcastTurnTime,
} from "../index";

const LECTURE: LectureScript = [
  { anchor: "mo-dau", text: "Xin chào các bạn. Hôm nay mình bắt đầu bằng một câu chuyện ngắn." },
  { anchor: "Ảo giác AI là gì", text: "Ảo giác AI là nội dung nghe hợp lý nhưng sai. Nó rất hay gặp. Vì vậy ta cần kiểm chứng." },
  { anchor: "tong-ket", text: "Tóm lại, trôi chảy chưa chắc đúng." },
];

const PODCAST: PodcastScript = {
  title: "Tập 1",
  durationMin: 6,
  hosts: { A: "Khoa", B: "Linh" },
  turns: [
    { speaker: "A", text: "Chào các bạn, mình là Khoa." },
    { speaker: "B", text: "Còn mình là Linh. Hôm nay nói về ảo giác AI." },
    { speaker: "A", text: "Bắt đầu nhé." },
  ],
};

const synth = (text: string, voice: string) => Promise.resolve(fakeSynthesize(text, voice));

describe("splitForSpeech", () => {
  it("không đoạn nào vượt giới hạn và không mất chữ", () => {
    const long = Array.from({ length: 40 }, (_, i) => `Đây là câu số ${i} của một đoạn lời giảng khá dài.`).join(" ");
    const chunks = splitForSpeech(long);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(TTS_MAX_CHARS);
    expect(chunks.join(" ")).toBe(long);
  });

  it("câu dài hơn giới hạn thì cắt ở khoảng trắng", () => {
    const sentence = Array.from({ length: 200 }, () => "từ").join(" ");
    const chunks = splitForSpeech(sentence, 100);
    for (const c of chunks) expect(c.length).toBeLessThanOrEqual(100);
    expect(chunks.join(" ")).toBe(sentence);
  });

  it("văn bản trống không sinh đoạn nào", () => {
    expect(splitForSpeech("   \n ")).toEqual([]);
  });
});

describe("scriptHash và kiểm tra kịch bản", () => {
  it("không phụ thuộc thứ tự khoá, nhưng đổi chữ là đổi băm", () => {
    expect(scriptHash({ a: 1, b: [1, 2] })).toBe(scriptHash({ b: [1, 2], a: 1 }));
    expect(scriptHash(LECTURE)).not.toBe(scriptHash([...LECTURE.slice(0, 2), { anchor: "tong-ket", text: "Khác." }]));
  });

  it("từ chối anchor trùng và podcast thiếu lượt", () => {
    expect(LectureScript.safeParse([LECTURE[0], LECTURE[0]]).success).toBe(false);
    expect(PodcastScript.safeParse({ ...PODCAST, turns: [PODCAST.turns[0]] }).success).toBe(false);
  });
});

describe("WAV và MP3", () => {
  it("encodeWav rồi parseWav trả lại đúng mẫu", () => {
    const samples = Int16Array.from([0, 1000, -1000, 32767, -32768]);
    const back = parseWav(encodeWav({ sampleRate: 48_000, samples }));
    expect(back.sampleRate).toBe(48_000);
    expect(Array.from(back.samples)).toEqual(Array.from(samples));
  });

  it("từ chối dữ liệu không phải WAV", () => {
    expect(() => parseWav(Buffer.from("not a wav file at all, definitely not"))).toThrow(AudioError);
  });

  it("PcmTimeline cộng đúng thời gian, kể cả khoảng lặng, và từ chối lệch tần số", () => {
    const t = new PcmTimeline();
    t.addPcm({ sampleRate: 24_000, samples: new Int16Array(24_000) }); // 1 giây
    t.addSilence(0.5);
    expect(t.seconds).toBeCloseTo(1.5, 5);
    expect(() => t.addPcm({ sampleRate: 48_000, samples: new Int16Array(10) })).toThrow(AudioError);
  });

  it("encodeMp3 ra tệp MP3 hợp lệ, nhỏ hơn nhiều so với WAV", () => {
    const wav = fakeSynthesize("Một câu để thử mã hoá âm thanh sang MP3 cho gọn.".repeat(6), "v");
    const mp3 = encodeMp3(parseWav(wav));
    expect(mp3[0]).toBe(0xff);
    expect((mp3[1]! & 0xe0)).toBe(0xe0); // đồng bộ khung MPEG
    expect(mp3.length).toBeLessThan(wav.length / 4);
  });
});

describe("generateNarrationAudio", () => {
  it("lời giảng: mốc thời gian đúng thứ tự, cách nhau đúng khoảng lặng", async () => {
    const r = await generateNarrationAudio("lecture", LECTURE, { lecturer: "v1" }, { synthesize: synth });
    const segs = r.segments as LectureSegmentTime[];
    expect(segs.map((s) => s.anchor)).toEqual(["mo-dau", "Ảo giác AI là gì", "tong-ket"]);
    expect(segs[0]!.startSec).toBe(0);
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i]!.startSec - segs[i - 1]!.endSec).toBeCloseTo(PAUSE_AFTER_LECTURE_SEC, 1);
    }
    // Thời lượng cuối = cuối đoạn cuối + khoảng lặng sau nó (làm tròn 0,01 giây).
    expect(r.durationSec).toBeCloseTo(segs.at(-1)!.endSec + PAUSE_AFTER_LECTURE_SEC, 1);
    expect(r.mp3.length).toBeGreaterThan(1_000);
  });

  it("podcast: hai người dẫn dùng hai giọng khác nhau, mốc theo từng lượt", async () => {
    const spy = vi.fn(synth);
    const r = await generateNarrationAudio("podcast", PODCAST, { A: "giong-a", B: "giong-b" }, { synthesize: spy });
    expect(new Set(spy.mock.calls.map((c) => c[1]))).toEqual(new Set(["giong-a", "giong-b"]));
    const turns = r.segments as PodcastTurnTime[];
    expect(turns.map((t) => t.index)).toEqual([0, 1, 2]);
    expect(turns[1]!.startSec - turns[0]!.endSec).toBeCloseTo(PAUSE_AFTER_TURN_SEC, 1);
  });

  it("tiến độ tăng dần, không vượt 95", async () => {
    const seen: number[] = [];
    await generateNarrationAudio("lecture", LECTURE, { lecturer: "v" }, { synthesize: synth, onProgress: (p) => void seen.push(p) });
    expect(seen.length).toBeGreaterThan(0);
    expect([...seen].sort((a, b) => a - b)).toEqual(seen);
    expect(Math.max(...seen)).toBeLessThanOrEqual(95);
  });

  it("làm lại lần hai chỉ lấy từ bộ nhớ đệm, không gọi bộ đọc", async () => {
    const store = new Map<string, Buffer>();
    const cache = { get: async (k: string) => store.get(k) ?? null, put: async (k: string, b: Buffer) => void store.set(k, b) };
    const first = vi.fn(synth);
    const a = await generateNarrationAudio("lecture", LECTURE, { lecturer: "v" }, { synthesize: first, cache });
    expect(first).toHaveBeenCalledTimes(a.chunks);
    const second = vi.fn(synth);
    const b = await generateNarrationAudio("lecture", LECTURE, { lecturer: "v" }, { synthesize: second, cache });
    expect(second).not.toHaveBeenCalled();
    expect(b.reused).toBe(b.chunks);
    expect(b.durationSec).toBe(a.durationSec);
    // Đổi giọng thì khoá bộ nhớ đệm khác, phải đọc lại.
    expect(chunkCacheKey("v", "x")).not.toBe(chunkCacheKey("w", "x"));
  });

  it("thử lại khi bộ đọc lỗi tạm thời, thành công ở lần sau", async () => {
    let calls = 0;
    const flaky = async (t: string, v: string) => {
      if (++calls <= 2) throw new Error("503");
      return fakeSynthesize(t, v);
    };
    const sleep = vi.fn(async () => {});
    const r = await generateNarrationAudio("lecture", [LECTURE[0]!], { lecturer: "v" }, { synthesize: flaky, sleep });
    expect(r.chunks).toBe(1);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it("lỗi mãi thì báo rõ đoạn nào", async () => {
    const dead = async () => {
      throw new Error("hết hạn khoá");
    };
    const err = await generateNarrationAudio("lecture", LECTURE, { lecturer: "v" }, { synthesize: dead, sleep: async () => {} }).catch((e) => e);
    expect(err).toBeInstanceOf(NarrationGenerationError);
    expect(err.code).toBe("tts_failed");
    expect(err.unitId).toBe("mo-dau");
    expect(err.message).toContain("hết hạn khoá");
  });

  it("dừng giữa chừng khi được yêu cầu", async () => {
    let n = 0;
    const err = await generateNarrationAudio("lecture", LECTURE, { lecturer: "v" }, { synthesize: synth, shouldAbort: () => ++n > 1 }).catch((e) => e);
    expect(err).toBeInstanceOf(NarrationGenerationError);
    expect(err.code).toBe("aborted");
  });

  it("thiếu giọng cho một vai thì không gọi bộ đọc", async () => {
    const err = await generateNarrationAudio("podcast", PODCAST, { A: "a" }, { synthesize: synth }).catch((e) => e);
    expect(err.code).toBe("tts_failed");
  });
});

describe("LessonNarration trong cơ sở dữ liệu", () => {
  async function makeLesson(slug: string) {
    const r = await registerUser({ email: `nar-${slug}@e.com`, password: "password1234", displayName: slug }, "http://localhost:3000");
    const { courseId } = await createCourse(r.userId, { title: `Khoá ${slug}`, description: "mô tả", slug });
    const { moduleId } = await createModule(r.userId, courseId, { title: "Module 1", orderIndex: 0 });
    const { lessonId } = await createLesson(r.userId, moduleId, { title: "Bài 1", orderIndex: 0 });
    return { lessonId, courseId };
  }

  async function makeReady(lessonId: string, kind: "lecture" | "podcast", script: LectureScript | PodcastScript) {
    const { id } = await saveNarrationScript(lessonId, kind, script);
    await claimNarrationForGeneration(id);
    const gen = await generateNarrationAudio(kind, script, { lecturer: "v", A: "a", B: "b" }, { synthesize: synth });
    await finishNarration(id, {
      audioKey: `private/narration/${id}.mp3`,
      contentType: "audio/mpeg",
      sizeBytes: gen.mp3.length,
      durationSec: gen.durationSec,
      segments: gen.segments,
      voices: { lecturer: "v" },
      generatedHash: scriptHash(script),
    });
    return id;
  }

  it("lưu kịch bản: tạo mới, lưu lại cùng nội dung thì không đổi, đổi chữ thì báo đã đổi", async () => {
    const { lessonId } = await makeLesson("n1");
    const a = await saveNarrationScript(lessonId, "lecture", LECTURE);
    expect(a).toMatchObject({ created: true, changed: true });
    const b = await saveNarrationScript(lessonId, "lecture", LECTURE);
    expect(b).toMatchObject({ id: a.id, created: false, changed: false });
    const c = await saveNarrationScript(lessonId, "lecture", [...LECTURE.slice(0, 2), { anchor: "tong-ket", text: "Khác hẳn." }]);
    expect(c).toMatchObject({ id: a.id, changed: true });
    expect(await prisma.lessonNarration.count({ where: { lessonId } })).toBe(1);
  });

  it("từ chối kịch bản sai dạng", async () => {
    const { lessonId } = await makeLesson("n2");
    await expect(saveNarrationScript(lessonId, "lecture", [{ anchor: "", text: "x" }])).rejects.toThrow();
    await expect(saveNarrationScript(lessonId, "podcast", LECTURE)).rejects.toThrow();
  });

  it("hai lần bấm đồng thời chỉ một lần được nhận; việc chết thì nhận lại được", async () => {
    const { lessonId } = await makeLesson("n3");
    const { id } = await saveNarrationScript(lessonId, "lecture", LECTURE);
    const [x, y] = await Promise.all([claimNarrationForGeneration(id), claimNarrationForGeneration(id)]);
    expect([x, y].filter(Boolean)).toHaveLength(1);
    expect(await claimNarrationForGeneration(id)).toBeNull();
    // Không còn tín hiệu trong GENERATION_STALE_MS → coi là đã chết.
    await prisma.$executeRaw`UPDATE "LessonNarration" SET "updatedAt" = ${new Date(Date.now() - GENERATION_STALE_MS - 1000)} WHERE id = ${id}`;
    expect(await claimNarrationForGeneration(id)).not.toBeNull();
  });

  it("vòng đời trạng thái: script → generating → ready → stale khi đổi kịch bản", async () => {
    const { lessonId } = await makeLesson("n4");
    const { id } = await saveNarrationScript(lessonId, "lecture", LECTURE);
    const row = () => prisma.lessonNarration.findUniqueOrThrow({ where: { id } });
    expect(narrationState(await row())).toBe("script");

    await claimNarrationForGeneration(id);
    await setNarrationProgress(id, 40);
    expect(narrationState(await row())).toBe("generating");
    expect((await row()).progress).toBe(40);

    await failNarration(id, "bộ đọc lỗi");
    expect(narrationState(await row())).toBe("failed");
    expect((await row()).error).toBe("bộ đọc lỗi");

    const readyId = await makeReady(lessonId, "lecture", LECTURE);
    expect(readyId).toBe(id);
    expect(narrationState(await row())).toBe("ready");

    await saveNarrationScript(lessonId, "lecture", [...LECTURE.slice(0, 2), { anchor: "tong-ket", text: "Đã đổi." }]);
    expect(narrationState(await row())).toBe("stale");
  });

  it("tạo lại lỗi thì vẫn giữ tệp cũ cho học viên nếu kịch bản không đổi", async () => {
    const { lessonId } = await makeLesson("n5");
    const id = await makeReady(lessonId, "lecture", LECTURE);
    await claimNarrationForGeneration(id);
    await failNarration(id, "lỗi mạng");
    expect(narrationState(await prisma.lessonNarration.findUniqueOrThrow({ where: { id } }))).toBe("ready");
    expect((await getLearnerNarrations(lessonId)).lecture).not.toBeNull();
  });

  it("học viên chỉ thấy bản khớp kịch bản, và không thấy khoá tệp", async () => {
    const { lessonId } = await makeLesson("n6");
    expect(await getLearnerNarrations(lessonId)).toEqual({ lecture: null, podcast: null });

    await makeReady(lessonId, "lecture", LECTURE);
    await makeReady(lessonId, "podcast", PODCAST);
    const seen = await getLearnerNarrations(lessonId);
    expect(seen.lecture?.segments.map((s) => s.anchor)).toEqual(["mo-dau", "Ảo giác AI là gì", "tong-ket"]);
    expect(seen.podcast?.turns.map((t) => [t.speakerName, t.text.slice(0, 5)])).toEqual([
      ["Khoa", "Chào "],
      ["Linh", "Còn m"],
      ["Khoa", "Bắt đ"],
    ]);
    expect(JSON.stringify(seen)).not.toContain("private/narration");
    expect(await getPlayableNarrationFile(lessonId, "lecture")).toMatchObject({ contentType: "audio/mpeg" });

    // Kịch bản podcast đổi → ẩn podcast, lời giảng vẫn hiện.
    await saveNarrationScript(lessonId, "podcast", { ...PODCAST, title: "Tập 1 (sửa)" });
    const after = await getLearnerNarrations(lessonId);
    expect(after.podcast).toBeNull();
    expect(after.lecture).not.toBeNull();
    expect(await getPlayableNarrationFile(lessonId, "podcast")).toBeNull();
  });

  it("liệt kê theo khoá, đúng thứ tự module/bài và kèm trạng thái", async () => {
    const { lessonId, courseId } = await makeLesson("n7");
    await saveNarrationScript(lessonId, "podcast", PODCAST);
    await makeReady(lessonId, "lecture", LECTURE);
    const rows = await listCourseNarrations(courseId);
    expect(rows.map((r) => [r.kind, r.state])).toEqual([
      ["lecture", "ready"],
      ["podcast", "script"],
    ]);
    expect(rows[0]!.durationSec).toBeGreaterThan(0);
  });
});
