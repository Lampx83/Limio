import type { SpeechMetrics } from "./analysis";

/**
 * Trôi chảy khi nói bằng mic: số đo, ngưỡng và lời nhận xét. File này CHỈ chứa phần thuần (không gọi mô hình, không đụng DB).
 * Docs: docs/tieu-chi/limio-language-cham-noi-bang-mic.md (AC2, AC3).
 *
 * Nguồn dữ liệu là bản chữ và MỐC THỜI GIAN TỪNG TỪ do Whisper trả về. Mức Cần cải thiện/Khá/Tốt do LUẬT quyết định từ số đo
 * và bảng ngưỡng ở đây — mô hình ngôn ngữ không được đoán. Ngưỡng `fluency.v1` là ước lượng cho người học (tách theo nhóm CEFR),
 * KHÔNG phải chuẩn của kỳ thi nào; sẽ được hiệu chỉnh bằng bản ghi do giảng viên chấm ở mốc C (đổi ngưỡng thì tăng phiên bản).
 */

export const FLUENCY_VERSION = "fluency.v1";

/** Khe giữa hai từ liền nhau: từ 0,25 giây tính là ngừng ngắn, từ 0,5 giây là vừa, trên 1,5 giây là dài. */
export const PAUSE_SHORT_SEC = 0.25;
export const PAUSE_MID_SEC = 0.5;
export const PAUSE_LONG_SEC = 1.5;

export interface PauseCounts {
  short: number;
  mid: number;
  long: number;
}

/**
 * Số đo cộng dồn được (nên gộp được nhiều lượt nói): tốc độ nói không tính chỗ ngừng và độ dài chuỗi nói liền được SUY RA từ
 * `phonationSec`, `runs` và `units` của `SpeechMetrics`, không lưu sẵn để khỏi lệch khi gộp.
 */
export interface FluencyExtras {
  version: string;
  /** Thời gian nói thực: thời gian từ từ đầu tới từ cuối trừ các khe ngừng từ 0,25 giây. */
  phonationSec: number;
  /** Số chuỗi nói liền (đoạn giữa hai chỗ ngừng từ 0,25 giây). */
  runs: number;
  pauses: PauseCounts;
  /** Chữ đệm ("um", "uh", "er"…) đếm từ bản chữ; null khi ngôn ngữ không đếm được (chữ Hán/kana). */
  fillers: number | null;
  /** Từ hoặc cụm hai từ lặp liền nhau; null cùng điều kiện với `fillers`. */
  repeats: number | null;
}

type WithExtras = Pick<SpeechMetrics, "units"> & { fluency?: FluencyExtras };

export function articulationRatePerMin(m: WithExtras): number {
  const f = m.fluency;
  return f && f.phonationSec > 0 ? (m.units / f.phonationSec) * 60 : 0;
}

export function meanRunLength(m: WithExtras): number {
  const f = m.fluency;
  return f && f.runs > 0 ? m.units / f.runs : 0;
}

// ─── Chữ đệm, từ lặp ─────────────────────────────────────────────────────────

const FILLER = /^(?:u+m+|u+h+|e+r+m*|hm+|mm+)$/;
/** Lặp có chủ ý để nhấn mạnh ("very very good", "no no"): không tính là ngập ngừng. */
const EMPHATIC_REPEATS = new Set(["very", "no", "so", "really", "bye", "yeah", "yes", "ha", "now"]);

const tokensOf = (text: string): string[] =>
  text
    .toLowerCase()
    .normalize("NFKC")
    .split(/[^\p{L}\p{N}']+/u)
    .map((t) => t.replace(/^'+|'+$/g, ""))
    .filter((t) => t !== "");

/** Đếm chữ đệm và lặp từ/cụm hai từ trong bản chữ tiếng Anh (hoặc chữ cái khác). Whisper có thể đã bỏ các chỗ này, nên 0 không có nghĩa là "nói không ngập ngừng". */
export function countDisfluencies(text: string): { fillers: number; repeats: number } {
  const all = tokensOf(text);
  const fillers = all.filter((t) => FILLER.test(t)).length;
  const t = all.filter((x) => !FILLER.test(x));
  let repeats = 0;
  for (let i = 0; i < t.length - 1; i++) {
    if (i + 3 < t.length && t[i] === t[i + 2] && t[i + 1] === t[i + 3]) {
      repeats++;
      i += 1; // bỏ qua nửa lặp, không đếm lại từ trong cụm
      continue;
    }
    if (t[i] === t[i + 1] && !EMPHATIC_REPEATS.has(t[i]!)) repeats++;
  }
  return { fillers, repeats };
}

// ─── Đo từ mốc thời gian ─────────────────────────────────────────────────────

interface TimedSpan {
  start: number;
  end: number;
}

const ms = (x: number) => Math.round(x * 1000) / 1000;

/**
 * Tính số đo mới từ các khoảng có tiếng (mốc từng từ, hoặc đoạn nói do VAD cắt). Trả null khi chưa đủ khoảng có mốc hợp lệ (xem `minSpans`): khi đó mọi nơi rơi về cách đo cũ thay vì đoán.
 */
export function measureFluencyExtras(args: {
  text: string;
  words: TimedSpan[];
  unit: "word" | "char";
  units: number;
  speakingSec: number;
  /** Số đoạn tối thiểu có mốc hợp lệ mới đo: 2 với mốc từ (1 từ không nói lên gì về nhịp), 1 với đoạn nói do VAD cắt (một đoạn liền là hợp lệ). */
  minSpans?: number;
}): FluencyExtras | null {
  const timed = args.words.filter((w) => Number.isFinite(w.start) && Number.isFinite(w.end) && w.end >= w.start);
  if (timed.length < (args.minSpans ?? 2)) return null;
  const sorted = [...timed].sort((a, b) => a.start - b.start);
  const pauses: PauseCounts = { short: 0, mid: 0, long: 0 };
  let runs = 1;
  let gapSec = 0;
  for (let i = 1; i < sorted.length; i++) {
    const gap = ms(sorted[i]!.start - sorted[i - 1]!.end);
    if (gap < PAUSE_SHORT_SEC) continue;
    runs++;
    gapSec += gap;
    if (gap > PAUSE_LONG_SEC) pauses.long++;
    else if (gap >= PAUSE_MID_SEC) pauses.mid++;
    else pauses.short++;
  }
  const phonationSec = Math.max(args.speakingSec - gapSec, 0);
  const dis = args.unit === "word" ? countDisfluencies(args.text) : null;
  return {
    version: FLUENCY_VERSION,
    phonationSec,
    runs,
    pauses,
    fillers: dis ? dis.fillers : null,
    repeats: dis ? dis.repeats : null,
  };
}

// ─── Ngưỡng ──────────────────────────────────────────────────────────────────

export type BandGroup = "A" | "B" | "C";

/** Nhóm CEFR của khoá: "A2" → A, "B1-B2" → B (lấy mức đầu), "C1" → C; thiếu hoặc không phải CEFR (vd. "HSK3") → B. */
export function bandGroupOf(levelBand: string | null | undefined): BandGroup {
  const m = /^\s*([ABC])[12]/i.exec(levelBand ?? "");
  return (m ? m[1]!.toUpperCase() : "B") as BandGroup;
}

interface Thresholds {
  /** Tốc độ chung (đơn vị/phút, tính cả chỗ ngừng): dưới `low` là chậm, từ `good` là tốt. */
  rate: { low: number; good: number };
  /** Tốc độ lúc đang nói (không tính chỗ ngừng). */
  articulation: { low: number; good: number };
  /** Số đơn vị trung bình mỗi chuỗi nói liền. */
  run: { low: number; good: number };
  /** Chỗ ngừng dài mỗi phút: từ `bad` là nhiều, đến `ok` là ít. */
  longPausesPerMin: { ok: number; bad: number };
  /** Chữ đệm + từ lặp mỗi phút: từ mức này là nhiều. */
  disfluenciesPerMinBad: number;
}

/** Ước lượng ban đầu (`fluency.v1`), tách theo đơn vị đếm và nhóm CEFR. Đổi số ở đây thì tăng FLUENCY_VERSION. */
export const FLUENCY_THRESHOLDS: Record<"word" | "char", Record<BandGroup, Thresholds>> = {
  word: {
    A: { rate: { low: 40, good: 70 }, articulation: { low: 60, good: 100 }, run: { low: 2, good: 3.5 }, longPausesPerMin: { ok: 2, bad: 5 }, disfluenciesPerMinBad: 10 },
    B: { rate: { low: 50, good: 90 }, articulation: { low: 80, good: 130 }, run: { low: 2.5, good: 5 }, longPausesPerMin: { ok: 1.5, bad: 4 }, disfluenciesPerMinBad: 8 },
    C: { rate: { low: 80, good: 120 }, articulation: { low: 100, good: 150 }, run: { low: 4, good: 7 }, longPausesPerMin: { ok: 1, bad: 3 }, disfluenciesPerMinBad: 6 },
  },
  char: {
    A: { rate: { low: 55, good: 95 }, articulation: { low: 90, good: 140 }, run: { low: 3, good: 7 }, longPausesPerMin: { ok: 2, bad: 5 }, disfluenciesPerMinBad: 10 },
    B: { rate: { low: 70, good: 120 }, articulation: { low: 110, good: 170 }, run: { low: 4, good: 10 }, longPausesPerMin: { ok: 1.5, bad: 4 }, disfluenciesPerMinBad: 8 },
    C: { rate: { low: 90, good: 140 }, articulation: { low: 130, good: 190 }, run: { low: 5, good: 12 }, longPausesPerMin: { ok: 1, bad: 3 }, disfluenciesPerMinBad: 6 },
  },
};

const thresholdsFor = (m: Pick<SpeechMetrics, "unit">, band: BandGroup): Thresholds => FLUENCY_THRESHOLDS[m.unit][band];

/**
 * Cửa sổ tối thiểu (giây) khi đổi số lần ngừng/chữ đệm thành "mỗi phút". Bản ghi ngắn (câu trả lời 8–15 giây là thường) mà chia cho thời gian thật sẽ thổi
 * phồng tỉ lệ: một chỗ ngừng dài trong 7,5 giây thành "8 chỗ/phút" và bị xếp Cần cải thiện. Chia cho tối thiểu 30 giây thì một chỗ ngừng chỉ là 2/phút.
 * Tốc độ nói (từ/phút) KHÔNG dùng cửa sổ này vì nó là tỉ lệ, không bị bản ghi ngắn làm lệch.
 */
export const MIN_RATE_WINDOW_SEC = 30;

/** Số phút dùng làm mẫu số cho các tỉ lệ đếm (ngừng dài, chữ đệm): thời gian nói thật nhưng không dưới cửa sổ tối thiểu. */
export const rateWindowMinutes = (speakingSec: number): number => Math.max(speakingSec, MIN_RATE_WINDOW_SEC) / 60;

const speakingMinutes = (m: Pick<SpeechMetrics, "speakingSec">) => rateWindowMinutes(m.speakingSec);

function disfluenciesPerMin(m: SpeechMetrics): number | null {
  const f = m.fluency;
  if (!f || f.fillers === null || f.repeats === null) return null;
  return (f.fillers + f.repeats) / speakingMinutes(m);
}

// ─── Mức ─────────────────────────────────────────────────────────────────────

export type FluencyLevel = "needs_work" | "fair" | "good";

/**
 * Mức Trôi chảy do luật. Có số đo mới thì xét thêm độ dài chuỗi nói liền và chữ đệm/từ lặp; bản ghi cũ (chưa có số đo mới) giữ đúng luật cũ
 * (tốc độ + chỗ ngừng dài) để dữ liệu đã lưu không đổi nghĩa.
 */
export function fluencyLevelFrom(m: SpeechMetrics, band: BandGroup = "B"): FluencyLevel {
  const t = thresholdsFor(m, band);
  const f = m.fluency;
  if (!f) {
    if (m.ratePerMin < t.rate.low || m.pausesPerMin >= t.longPausesPerMin.bad) return "needs_work";
    if (m.ratePerMin >= t.rate.good && m.pausesPerMin <= t.longPausesPerMin.ok) return "good";
    return "fair";
  }
  const run = meanRunLength(m);
  if (m.ratePerMin < t.rate.low || m.pausesPerMin >= t.longPausesPerMin.bad || run < t.run.low) return "needs_work";
  const dis = disfluenciesPerMin(m);
  if (
    m.ratePerMin >= t.rate.good &&
    m.pausesPerMin <= t.longPausesPerMin.ok &&
    run >= t.run.good &&
    (dis === null || dis < t.disfluenciesPerMinBad)
  ) {
    return "good";
  }
  return "fair";
}

// ─── Nhận xét ────────────────────────────────────────────────────────────────

export type FluencyFacet = "pace" | "pauses" | "runs" | "fillers";
type FacetState = "good" | "ok" | "weak";

export interface FluencyFindings {
  /** Các mặt đã được xét (chữ đệm chỉ có mặt khi đã đếm được và có chữ đệm). */
  facets: FluencyFacet[];
  /** Mặt đang tốt nhất; null nếu chưa mặt nào tốt. */
  strength: { facet: FluencyFacet; state: FacetState } | null;
  /** MỘT điều nên sửa trước; null nếu không có chỗ yếu. */
  weakness: FluencyFacet | null;
}

/** Thứ tự ưu tiên điều cần sửa trước. */
const WEAKNESS_ORDER: FluencyFacet[] = ["pauses", "pace", "runs", "fillers"];
/** Thứ tự ưu tiên khi chọn điều đang tốt để khen. */
const STRENGTH_ORDER: FluencyFacet[] = ["pace", "pauses", "runs"];

export function fluencyFindings(m: SpeechMetrics, band: BandGroup = "B"): FluencyFindings {
  const t = thresholdsFor(m, band);
  const f = m.fluency;
  const state: Partial<Record<FluencyFacet, FacetState>> = {};

  // Tốc độ lúc đang nói: có số đo mới thì dùng nó (tách chậm vì ngừng khỏi chậm vì nói chậm), không thì tốc độ chung.
  const pace = f ? articulationRatePerMin(m) : m.ratePerMin;
  const paceT = f ? t.articulation : t.rate;
  state.pace = pace < paceT.low ? "weak" : pace >= paceT.good ? "good" : "ok";
  state.pauses = m.pausesPerMin >= t.longPausesPerMin.bad ? "weak" : m.pausesPerMin <= t.longPausesPerMin.ok ? "good" : "ok";
  if (f) {
    const run = meanRunLength(m);
    state.runs = run < t.run.low ? "weak" : run >= t.run.good ? "good" : "ok";
    const dis = disfluenciesPerMin(m);
    if (dis !== null && f.fillers! + f.repeats! > 0) state.fillers = dis >= t.disfluenciesPerMinBad ? "weak" : "ok";
  }

  const facets = (Object.keys(state) as FluencyFacet[]).filter((k) => state[k] !== undefined);
  const weakness = WEAKNESS_ORDER.find((k) => state[k] === "weak") ?? null;
  const good = STRENGTH_ORDER.find((k) => state[k] === "good");
  const okOne = STRENGTH_ORDER.find((k) => state[k] === "ok" && k !== weakness);
  const strength = good ? { facet: good, state: "good" as const } : okOne ? { facet: okOne, state: "ok" as const } : null;
  return { facets, strength, weakness };
}

const COMMENT_EN = {
  strength: {
    pace: { good: "your speaking pace is comfortable", ok: "your speaking pace is steady" },
    pauses: { good: "you rarely pause for long", ok: "you only pause for long a few times" },
    runs: { good: "you speak in good-sized chunks", ok: "you speak in fairly short chunks" },
  },
  weakness: {
    pauses: "Long pauses break up your answer: keep going with a simple linking word such as “well” or “so” while you think.",
    pace: "You still speak slowly even between pauses: practise saying whole phrases at once, not word by word.",
    runs: "You speak in very short pieces: try joining your ideas with “and”, “but” or “because”.",
    fillers: "Try to cut down on “um” and repeated words: pause silently instead.",
  },
} as const;

const COMMENT_VI = {
  strength: {
    pace: { good: "tốc độ nói ổn", ok: "tốc độ nói vừa phải" },
    pauses: { good: "ít khi ngừng lâu", ok: "chỉ ngừng lâu vài lần" },
    runs: { good: "nói thành từng cụm dài", ok: "nói thành từng cụm khá ngắn" },
  },
  weakness: {
    pauses: "Có nhiều chỗ ngừng dài giữa các ý: nên nói nối tiếp bằng từ nối đơn giản thay vì dừng lại.",
    pace: "Ngay cả giữa các chỗ ngừng, em vẫn nói chậm: nên luyện nói cả cụm một hơi, không nói từng từ.",
    runs: "Em nói thành những mẩu rất ngắn: nên nối các ý bằng từ nối như “và”, “nhưng”, “vì”.",
    fillers: "Nên giảm tiếng đệm và từ lặp: dừng lặng thay vì chêm tiếng đệm.",
  },
} as const;

/** Nhận xét tiếng Anh (cho học viên) từ số đo mới: một điều đang tốt, một điều nên sửa (nếu có), nói rõ chỉ là nhịp nói. KHÔNG có con số. */
export function fluencyCommentEn(m: SpeechMetrics, band: BandGroup = "B"): string {
  const f = fluencyFindings(m, band);
  const good = f.strength ? COMMENT_EN.strength[f.strength.facet as "pace" | "pauses" | "runs"][f.strength.state === "good" ? "good" : "ok"] : "";
  const head = good ? `Measured from your recording: ${good}.` : "Measured from your recording.";
  const next = f.weakness ? ` ${COMMENT_EN.weakness[f.weakness]}` : "";
  return `${head}${next} This is a machine estimate of your rhythm only; pronunciation is not assessed.`;
}

/** Nhận xét tiếng Việt (cho giảng viên, bài nói G7) từ số đo mới. KHÔNG có con số. */
export function fluencyCommentVi(m: SpeechMetrics, band: BandGroup = "B"): string {
  const f = fluencyFindings(m, band);
  const good = f.strength ? COMMENT_VI.strength[f.strength.facet as "pace" | "pauses" | "runs"][f.strength.state === "good" ? "good" : "ok"] : "";
  const head = good ? `Đo từ bản ghi: ${good}.` : "Đo từ bản ghi.";
  const next = f.weakness ? ` ${COMMENT_VI.weakness[f.weakness]}` : "";
  return `${head}${next} Đây chỉ là nhịp nói do máy đo; phát âm do giảng viên nghe đánh giá.`;
}

// ─── Gộp nhiều lượt nói ──────────────────────────────────────────────────────

/**
 * Gộp số đo của các lượt nói bằng mic trong một hội thoại thành một số đo chung (cộng tổng rồi tính lại tốc độ, không trung bình các tỉ lệ).
 * Null khi không có lượt nào hoặc lẫn đơn vị từ/chữ. Một lượt thiếu số đo mới (bản ghi cũ) thì kết quả bỏ số đo mới: không trộn dữ liệu thiếu.
 */
export function mergeSpeechMetrics(list: SpeechMetrics[]): SpeechMetrics | null {
  if (list.length === 0) return null;
  const unit = list[0]!.unit;
  if (list.some((m) => m.unit !== unit)) return null;
  const sum = (pick: (m: SpeechMetrics) => number) => list.reduce((s, m) => s + pick(m), 0);
  const speakingSec = sum((m) => m.speakingSec);
  const minutes = speakingSec / 60;
  const longPauses = sum((m) => m.longPauses);
  const units = sum((m) => m.units);

  let fluency: FluencyExtras | undefined;
  const extras = list.map((m) => m.fluency);
  if (extras.every((x): x is FluencyExtras => !!x) && new Set(extras.map((x) => x.version)).size === 1) {
    const all = extras as FluencyExtras[];
    const nullable = (pick: (x: FluencyExtras) => number | null): number | null =>
      all.some((x) => pick(x) === null) ? null : all.reduce((s, x) => s + (pick(x) as number), 0);
    fluency = {
      version: all[0]!.version,
      phonationSec: all.reduce((s, x) => s + x.phonationSec, 0),
      runs: all.reduce((s, x) => s + x.runs, 0),
      pauses: {
        short: all.reduce((s, x) => s + x.pauses.short, 0),
        mid: all.reduce((s, x) => s + x.pauses.mid, 0),
        long: all.reduce((s, x) => s + x.pauses.long, 0),
      },
      fillers: nullable((x) => x.fillers),
      repeats: nullable((x) => x.repeats),
    };
  }
  return {
    durationSec: sum((m) => m.durationSec),
    speakingSec,
    units,
    unit,
    ratePerMin: minutes > 0 ? units / minutes : 0,
    longPauses,
    pausesPerMin: longPauses / rateWindowMinutes(speakingSec),
    silent: list.every((m) => m.silent),
    ...(fluency ? { fluency } : {}),
  };
}

// ─── Đọc lại từ dữ liệu đã lưu ───────────────────────────────────────────────

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const num = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);

function parseExtras(v: unknown): FluencyExtras | undefined {
  if (!isObj(v) || typeof v.version !== "string" || !isObj(v.pauses)) return undefined;
  const p = v.pauses;
  const nullableNum = (x: unknown) => x === null || num(x);
  if (!num(v.phonationSec) || !num(v.runs) || !num(p.short) || !num(p.mid) || !num(p.long)) return undefined;
  if (!nullableNum(v.fillers) || !nullableNum(v.repeats)) return undefined;
  return {
    version: v.version,
    phonationSec: v.phonationSec,
    runs: v.runs,
    pauses: { short: p.short, mid: p.mid, long: p.long },
    fillers: v.fillers as number | null,
    repeats: v.repeats as number | null,
  };
}

/** Đọc `SpeechMetrics` từ JSON đã lưu. Phần cũ hỏng thì null (không đoán); phần số đo mới hỏng thì bỏ riêng phần đó. */
export function parseSpeechMetrics(v: unknown): SpeechMetrics | null {
  if (!isObj(v)) return null;
  const nums = ["durationSec", "speakingSec", "units", "ratePerMin", "longPauses", "pausesPerMin"] as const;
  if (!nums.every((k) => num(v[k]))) return null;
  if (v.unit !== "word" && v.unit !== "char") return null;
  const fluency = parseExtras(v.fluency);
  return {
    durationSec: v.durationSec as number,
    speakingSec: v.speakingSec as number,
    units: v.units as number,
    unit: v.unit,
    ratePerMin: v.ratePerMin as number,
    longPauses: v.longPauses as number,
    pausesPerMin: v.pausesPerMin as number,
    silent: v.silent === true,
    ...(fluency ? { fluency } : {}),
  };
}
