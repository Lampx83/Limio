import { describe, expect, it } from "vitest";
import {
  FLUENCY_VERSION,
  MIN_RATE_WINDOW_SEC,
  rateWindowMinutes,
  articulationRatePerMin,
  bandGroupOf,
  countDisfluencies,
  fluencyFindings,
  fluencyLevelFrom,
  mergeSpeechMetrics,
  meanRunLength,
  measureFluencyExtras,
  parseSpeechMetrics,
  type FluencyExtras,
} from "../speaking/fluency";
import { fluencyComment, fluencyLevel, measureSpeech, type SpeechMetrics } from "../speaking/analysis";
import { practiceFluencyComment } from "../practiceAnswer/analysis";

// Chuỗi từ giả: `n` từ, mỗi từ dài `len` giây, cách nhau `gap` giây (gap có thể là mảng riêng từng khe).
function words(n: number, opts: { start?: number; len?: number; gap?: number | number[] } = {}) {
  const { start = 0, len = 0.3, gap = 0.1 } = opts;
  const out: Array<{ start: number; end: number }> = [];
  let t = start;
  for (let i = 0; i < n; i++) {
    out.push({ start: t, end: t + len });
    const g = Array.isArray(gap) ? (gap[i] ?? 0.1) : gap;
    t += len + g;
  }
  return out;
}
const sentence = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

describe("measureFluencyExtras — đo từ mốc thời gian từng từ", () => {
  it("không đủ mốc thời gian (dưới 2 từ có mốc) thì không đo, để cách đo cũ lo", () => {
    expect(measureFluencyExtras({ text: sentence(5), words: [], unit: "word", units: 5, speakingSec: 5 })).toBeNull();
    expect(measureFluencyExtras({ text: "hi", words: words(1), unit: "word", units: 1, speakingSec: 1 })).toBeNull();
  });

  it("chia chỗ ngừng ba cỡ: ngắn 0,25–0,5 giây, vừa 0,5–1,5 giây, dài trên 1,5 giây", () => {
    // 6 từ, 5 khe: 0.1 (không tính), 0.3 (ngắn), 0.7 (vừa), 2.0 (dài), 0.5 (vừa: đúng ngưỡng vừa)
    const w = words(6, { gap: [0.1, 0.3, 0.7, 2.0, 0.5] });
    const x = measureFluencyExtras({ text: sentence(6), words: w, unit: "word", units: 6, speakingSec: w[5]!.end - w[0]!.start })!;
    expect(x.pauses).toEqual({ short: 1, mid: 2, long: 1 });
    expect(x.version).toBe(FLUENCY_VERSION);
  });

  it("chuỗi nói liền = đoạn giữa hai chỗ ngừng từ 0,25 giây; thời gian phát âm bỏ các chỗ ngừng đó", () => {
    // 4 từ liền, ngừng 1.0, 4 từ liền → 2 chuỗi, mỗi chuỗi 4 từ
    const w = [...words(4, { gap: 0.1 }), ...words(4, { start: 5, gap: 0.1 })];
    const speaking = w[7]!.end - w[0]!.start;
    const x = measureFluencyExtras({ text: sentence(8), words: w, unit: "word", units: 8, speakingSec: speaking })!;
    expect(x.runs).toBe(2);
    expect(meanRunLength({ units: 8, fluency: x })).toBe(4);
    // khe giữa hai chuỗi dài ~3.7 giây bị trừ khỏi thời gian phát âm
    expect(x.phonationSec).toBeLessThan(speaking - 3);
    expect(articulationRatePerMin({ units: 8, fluency: x })).toBeGreaterThan(60);
  });

  it("tiếng Anh: đếm chữ đệm và từ lặp từ bản chữ; không chữ nào thì bằng 0", () => {
    const text = "so um I I went to the the market and uh bought er bread";
    const x = measureFluencyExtras({ text, words: words(14), unit: "word", units: 14, speakingSec: 6 })!;
    expect(x.fillers).toBe(3);
    expect(x.repeats).toBe(2);
    const clean = measureFluencyExtras({ text: "I went to the market and bought some bread", words: words(9), unit: "word", units: 9, speakingSec: 4 })!;
    expect(clean.fillers).toBe(0);
    expect(clean.repeats).toBe(0);
  });

  it("chữ Hán/kana: không đếm chữ đệm hay từ lặp (không đủ cơ sở), chỉ đo nhịp", () => {
    const x = measureFluencyExtras({ text: "我我叫小林", words: words(5), unit: "char", units: 5, speakingSec: 3 })!;
    expect(x.fillers).toBeNull();
    expect(x.repeats).toBeNull();
  });
});

describe("countDisfluencies", () => {
  it("lặp từ nhấn mạnh có chủ ý (very very, no no, so so) không bị tính", () => {
    expect(countDisfluencies("it was very very good and no no I said so so")).toEqual({ fillers: 0, repeats: 0 });
  });
  it("lặp cụm hai từ liền nhau tính một lần", () => {
    expect(countDisfluencies("I went I went to school in the in the morning")).toEqual({ fillers: 0, repeats: 2 });
  });
  it("chữ đệm không phân biệt hoa thường, dấu câu, kéo dài", () => {
    expect(countDisfluencies("Um, well, Uhh... ERM, yes. Hmm.")).toEqual({ fillers: 4, repeats: 0 });
  });
  it('"er" nằm trong từ khác thì không tính', () => {
    expect(countDisfluencies("every person went there, however")).toEqual({ fillers: 0, repeats: 0 });
  });
});

describe("bandGroupOf", () => {
  it("A1–A2 → A, B1–B2 → B, C1–C2 → C; khoảng thì lấy đầu; thiếu hoặc lạ → B", () => {
    expect(bandGroupOf("A2")).toBe("A");
    expect(bandGroupOf("B1-B2")).toBe("B");
    expect(bandGroupOf("c1")).toBe("C");
    expect(bandGroupOf(null)).toBe("B");
    expect(bandGroupOf("HSK3")).toBe("B");
  });
});

// Số đo "tiêu chuẩn" B1: 100 từ/phút, ít ngừng, chuỗi dài.
const fx = (over: Partial<FluencyExtras> = {}): FluencyExtras => ({
  version: FLUENCY_VERSION,
  phonationSec: 50,
  runs: 12,
  pauses: { short: 4, mid: 3, long: 0 },
  fillers: 0,
  repeats: 0,
  ...over,
});
const sm = (over: Partial<SpeechMetrics> = {}): SpeechMetrics => ({
  durationSec: 60,
  speakingSec: 58,
  units: 100,
  unit: "word",
  ratePerMin: 103,
  longPauses: 0,
  pausesPerMin: 0,
  silent: false,
  fluency: fx(),
  ...over,
});

describe("fluencyLevelFrom — luật quyết định mức, có số đo mới", () => {
  it("nói đều, ít ngừng, chuỗi dài (≈8 từ) → good", () => {
    expect(fluencyLevelFrom(sm(), "B")).toBe("good");
  });
  it("chuỗi nói quá ngắn (≈1,5 từ/chuỗi) → needs_work dù tốc độ ổn", () => {
    expect(fluencyLevelFrom(sm({ fluency: fx({ runs: 70 }) }), "B")).toBe("needs_work");
  });
  it("nhiều chỗ ngừng dài → needs_work", () => {
    expect(fluencyLevelFrom(sm({ longPauses: 6, pausesPerMin: 6.2, fluency: fx({ pauses: { short: 2, mid: 2, long: 6 } }) }), "B")).toBe("needs_work");
  });
  it("tốc độ vừa, chuỗi vừa → fair", () => {
    expect(fluencyLevelFrom(sm({ ratePerMin: 70, units: 68, fluency: fx({ runs: 20 }) }), "B")).toBe("fair");
  });
  it("nhiều chữ đệm và từ lặp thì không được 'good'", () => {
    expect(fluencyLevelFrom(sm({ fluency: fx({ fillers: 8, repeats: 5 }) }), "B")).toBe("fair");
  });
  it("cùng một bản ghi: ngưỡng A dễ hơn B, C khó hơn B", () => {
    const m = sm({ ratePerMin: 75, units: 72, fluency: fx({ runs: 18 }) });
    expect(fluencyLevelFrom(m, "A")).toBe("good");
    expect(fluencyLevelFrom(m, "B")).toBe("fair");
    expect(fluencyLevelFrom(m, "C")).toBe("needs_work");
  });
  it("không có số đo mới (bản ghi cũ) thì dùng đúng luật cũ", () => {
    const old: SpeechMetrics = { durationSec: 60, speakingSec: 55, units: 80, unit: "word", ratePerMin: 85, longPauses: 0, pausesPerMin: 0, silent: false };
    expect(fluencyLevelFrom(old, "B")).toBe(fluencyLevel(old));
    expect(fluencyLevelFrom({ ...old, ratePerMin: 30 }, "B")).toBe("needs_work");
  });
});

describe("fluencyFindings — một điều tốt và một điều nên sửa trước", () => {
  it("nói tốt, không điểm yếu → có điều tốt, không có điều cần sửa", () => {
    const f = fluencyFindings(sm(), "B");
    expect(f.strength).not.toBeNull();
    expect(f.weakness).toBeNull();
  });
  it("ngừng dài nhiều → điều cần sửa là ngừng", () => {
    const f = fluencyFindings(sm({ longPauses: 6, pausesPerMin: 6.2, fluency: fx({ pauses: { short: 2, mid: 2, long: 6 } }) }), "B");
    expect(f.weakness).toBe("pauses");
  });
  it("chỉ nêu MỘT điều cần sửa dù nhiều chỗ yếu", () => {
    const f = fluencyFindings(sm({ ratePerMin: 30, longPauses: 7, pausesPerMin: 7, fluency: fx({ runs: 80, pauses: { short: 0, mid: 0, long: 7 } }) }), "B");
    expect(typeof f.weakness).toBe("string");
  });
  it("chữ đệm: chỉ nhắc khi đã đếm được và nhiều; đếm 0 thì không khen 'ít chữ đệm'", () => {
    const none = fluencyFindings(sm(), "B");
    expect(none.facets).not.toContain("fillers");
    const many = fluencyFindings(sm({ fluency: fx({ fillers: 9, repeats: 3 }) }), "B");
    expect(many.weakness === "fillers" || many.facets.includes("fillers")).toBe(true);
  });
});

describe("nhận xét bằng chữ", () => {
  it("không có con số, nêu một điều cần sửa, ghi rõ chỉ là nhịp nói do máy đo", () => {
    const m = sm({ longPauses: 6, pausesPerMin: 6.2, fluency: fx({ pauses: { short: 2, mid: 2, long: 6 } }) });
    const en = practiceFluencyComment(m, "B");
    const vi = fluencyComment(m, "B");
    expect(en).toMatch(/Measured from your recording/);
    expect(en).toMatch(/pronunciation is not assessed/);
    expect(en).not.toMatch(/\d/);
    expect(vi).toMatch(/^Đo từ bản ghi/);
    expect(vi).toMatch(/phát âm do giảng viên nghe đánh giá/);
    expect(vi).not.toMatch(/\d/);
  });
  it("bản ghi cũ (không số đo mới) giữ nguyên lời cũ", () => {
    const old: SpeechMetrics = { durationSec: 60, speakingSec: 55, units: 80, unit: "word", ratePerMin: 85, longPauses: 0, pausesPerMin: 0, silent: false };
    expect(practiceFluencyComment(old)).toMatch(/your speaking pace is steady/);
    expect(fluencyComment(old)).toMatch(/tốc độ nói vừa phải/);
  });
});

describe("measureSpeech gắn số đo mới", () => {
  it("có mốc thời gian thì kèm `fluency`; không có thì giữ như cũ", () => {
    const w = words(20);
    const m = measureSpeech(sentence(20), w, 12);
    expect(m.fluency?.version).toBe(FLUENCY_VERSION);
    expect(measureSpeech(sentence(20), [], 12).fluency).toBeUndefined();
  });
});

describe("mergeSpeechMetrics — gộp các lượt nói của một hội thoại", () => {
  const turn = (over: Partial<SpeechMetrics> = {}) => sm({ durationSec: 20, speakingSec: 18, units: 30, ratePerMin: 100, fluency: fx({ phonationSec: 15, runs: 4, pauses: { short: 1, mid: 1, long: 0 } }), ...over });
  it("cộng thời lượng, số từ, chỗ ngừng; tính lại tốc độ từ tổng", () => {
    const merged = mergeSpeechMetrics([turn(), turn({ units: 20, longPauses: 2, fluency: fx({ phonationSec: 10, runs: 3, pauses: { short: 0, mid: 1, long: 2 }, fillers: 2 }) })])!;
    expect(merged.units).toBe(50);
    expect(merged.durationSec).toBe(40);
    expect(merged.speakingSec).toBe(36);
    expect(merged.longPauses).toBe(2);
    expect(merged.ratePerMin).toBeCloseTo(50 / (36 / 60), 5);
    expect(merged.fluency!.runs).toBe(7);
    expect(merged.fluency!.pauses).toEqual({ short: 1, mid: 2, long: 2 });
    expect(merged.fluency!.fillers).toBe(2);
  });
  it("không có lượt nào thì null; khác đơn vị (từ/chữ) thì null", () => {
    expect(mergeSpeechMetrics([])).toBeNull();
    expect(mergeSpeechMetrics([turn(), turn({ unit: "char" })])).toBeNull();
  });
  it("một lượt thiếu số đo mới thì kết quả gộp cũng bỏ số đo mới (không trộn dữ liệu thiếu)", () => {
    const { fluency: _f, ...legacy } = turn();
    const merged = mergeSpeechMetrics([turn(), legacy as SpeechMetrics])!;
    expect(merged.fluency).toBeUndefined();
  });
  it("chữ đệm: một lượt không đếm được (null) thì tổng cũng null", () => {
    const merged = mergeSpeechMetrics([turn(), turn({ fluency: fx({ fillers: null, repeats: null }) })])!;
    expect(merged.fluency!.fillers).toBeNull();
  });
});

describe("parseSpeechMetrics — đọc lại từ dữ liệu đã lưu, không đoán", () => {
  it("giữ nguyên số đo mới khi hợp lệ", () => {
    const m = sm();
    expect(parseSpeechMetrics(JSON.parse(JSON.stringify(m)))).toEqual(m);
  });
  it("số đo mới hỏng thì bỏ riêng phần đó, giữ phần cũ", () => {
    const bad = JSON.parse(JSON.stringify(sm()));
    bad.fluency.runs = "x";
    const parsed = parseSpeechMetrics(bad)!;
    expect(parsed.fluency).toBeUndefined();
    expect(parsed.units).toBe(100);
  });
  it("phần cũ hỏng thì null", () => {
    expect(parseSpeechMetrics({ units: "x" })).toBeNull();
    expect(parseSpeechMetrics(null)).toBeNull();
  });
});

describe("đoạn nói do VAD cắt (dịch vụ phân tích nội bộ) — đo chính xác hơn mốc từ", () => {
  it("một đoạn nói liền 0–10 giây: có số đo mới, 1 chuỗi, không chỗ ngừng", () => {
    const m = measureSpeech(sentence(25), words(25), 10, [{ start: 0, end: 10 }]);
    expect(m.fluency?.runs).toBe(1);
    expect(m.fluency?.pauses).toEqual({ short: 0, mid: 0, long: 0 });
    expect(m.speakingSec).toBe(10);
  });
  it("khe giữa các đoạn thành chỗ ngừng: 0,3 ngắn, 0,8 vừa, 2,0 dài; thời gian nói bỏ các khe", () => {
    const seg = [
      { start: 1, end: 3 },
      { start: 3.3, end: 5 }, // khe 0,3
      { start: 5.8, end: 8 }, // khe 0,8
      { start: 10, end: 12 }, // khe 2,0
    ];
    const m = measureSpeech(sentence(30), words(30), 14, seg);
    expect(m.fluency?.pauses).toEqual({ short: 1, mid: 1, long: 1 });
    expect(m.fluency?.runs).toBe(4);
    expect(m.longPauses).toBe(1);
    expect(m.speakingSec).toBe(11); // từ giây 1 tới giây 12
    expect(m.fluency!.phonationSec).toBeCloseTo(11 - 3.1, 5);
  });
  it("đoạn VAD thắng mốc từ khi có cả hai (mốc từ của Whisper hay lệch trong im lặng)", () => {
    // mốc từ giả có khe 2 giây giữa từ 5 và 6, nhưng VAD nói là liền một mạch
    const w = words(10, { gap: [0.1, 0.1, 0.1, 0.1, 2.0, 0.1, 0.1, 0.1, 0.1] });
    const viaWords = measureSpeech(sentence(10), w, 8);
    const viaVad = measureSpeech(sentence(10), w, 8, [{ start: 0, end: 8 }]);
    expect(viaWords.fluency?.pauses.long).toBe(1);
    expect(viaVad.fluency?.pauses.long).toBe(0);
  });
  it("mảng đoạn rỗng hoặc hỏng thì dùng mốc từ như cũ", () => {
    const a = measureSpeech(sentence(20), words(20), 12, []);
    const b = measureSpeech(sentence(20), words(20), 12);
    expect(a).toEqual(b);
    const bad = measureSpeech(sentence(20), words(20), 12, [{ start: NaN, end: 1 }] as never);
    expect(bad).toEqual(b);
  });
});

describe("bản ghi ngắn không bị thổi phồng tỉ lệ ngừng (cửa sổ tối thiểu 30 giây)", () => {
  it("cửa sổ: dưới 30 giây tính 30 giây, trên thì tính thời gian thật", () => {
    expect(MIN_RATE_WINDOW_SEC).toBe(30);
    expect(rateWindowMinutes(7.5)).toBe(0.5);
    expect(rateWindowMinutes(90)).toBe(1.5);
  });
  it("clip 8 giây có MỘT chỗ ngừng dài → 2 chỗ/phút (không phải 7,5): không bị xếp Cần cải thiện vì ngừng", () => {
    const seg = [{ start: 0, end: 3 }, { start: 5, end: 8 }]; // khe 2 giây
    const m = measureSpeech(sentence(20), words(20), 8, seg);
    expect(m.longPauses).toBe(1);
    expect(m.pausesPerMin).toBeCloseTo(2, 5);
    expect(fluencyLevel(m, "B")).not.toBe("needs_work");
  });
  it("bản ghi một phút trở lên giữ đúng tỉ lệ thật (4 chỗ ngừng dài trong 60 giây = 4/phút)", () => {
    // 5 đoạn dài 10 giây, khe 2 giây → 4 khe; tổng 58 giây
    const seg = Array.from({ length: 5 }, (_, i) => ({ start: i * 12, end: i * 12 + 10 }));
    const m = measureSpeech(sentence(120), words(120), 60, seg);
    expect(m.longPauses).toBe(4);
    expect(m.speakingSec).toBe(58);
    expect(m.pausesPerMin).toBeCloseTo(4 / (58 / 60), 5);
  });
  it("chữ đệm cũng chia cho cửa sổ tối thiểu: 3 chữ đệm trong clip 10 giây không bị coi là 'nhiều'", () => {
    const text = "um I like um to read uh books and I go to the library every weekend";
    const m = measureSpeech(text, words(16), 10, [{ start: 0, end: 10 }]);
    expect(m.fluency?.fillers).toBe(3);
    expect(fluencyFindings(m, "B").weakness).not.toBe("fillers"); // 3 chữ đệm / 0,5 phút = 6/phút < 8
  });
  it("gộp nhiều lượt dùng cùng cửa sổ", () => {
    const t = (long: number) => measureSpeech(sentence(20), words(20), 8, long ? [{ start: 0, end: 3 }, { start: 5, end: 8 }] : [{ start: 0, end: 8 }]);
    const merged = mergeSpeechMetrics([t(1), t(0)])!; // 16 giây nói, 1 chỗ ngừng dài
    expect(merged.pausesPerMin).toBeCloseTo(1 / 0.5, 5);
  });
});
