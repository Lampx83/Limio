import { chunkRichText, demoteLongStrong, plainText, scaleInlineFontSizes, topLevelBlocks } from "./htmlChunks";
import { parseRolePlay, splitReading } from "./rolePlayView";
import { keyTermsFromVocab } from "./keyTerms";
import { mergePinyinColumn } from "./tablePinyin";

/**
 * Dựng các màn "Chiếu lớp" của một bài học HSK từ nội dung bài (docs/tieu-chi/hsk-che-do-chieu-lop.md, mục A).
 * Hàm thuần: không đọc DB, không lưu gì. Màn Luyện tập chỉ mang cấu hình CÔNG KHAI của câu (không đáp án); đáp án lấy qua API khi giáo viên bấm.
 */

export interface TeachingItem {
  id: string;
  type: string;
  payload: unknown;
}

export interface TeachingQuestionInput {
  id: string;
  type: string;
  prompt: string;
  passageId: string | null;
  /** Cấu hình công khai (không đáp án) + `promptAid` nếu có. */
  config: Record<string, unknown>;
}

export interface TeachingPracticeInput {
  title: string;
  questions: TeachingQuestionInput[];
  passages: Array<{ id: string; title: string; contentJson: unknown }>;
}

export type TeachingFrame = TeachingFrameBase & { notes?: string[] };

type TeachingFrameBase =
  | { kind: "cover"; label: string; title: string }
  | { kind: "html"; label: string; title: string; html: string; cont: boolean }
  | {
      kind: "dialogue";
      label: string;
      title: string;
      audioUrl?: string;
      readingLabel?: string;
      /** Từ mới của bài (từ 2 chữ Hán trở lên) để tô nổi bật trong lời thoại. */
      keys: string[];
      speakers: Array<{ name: string; avatarUrl?: string }>;
      turns: Array<{ id: string; speaker: string; text: string; reading?: string; translation?: string; audioUrl?: string; startSec?: number }>;
    }
  | {
      kind: "turn";
      label: string;
      title: string;
      turnNo: number;
      turnTotal: number;
      speaker: string;
      avatarUrl?: string;
      text: string;
      reading?: string;
      translation?: string;
      audioUrl?: string;
      keys: string[];
    }
  | {
      kind: "vocab";
      label: string;
      no: number;
      total: number;
      term: string;
      reading?: string;
      meaning: string;
      example?: string;
      exampleReading?: string;
      exampleMeaning?: string;
      note?: string;
      audioUrl?: string;
      exampleAudioUrl?: string;
      /** Âm thanh gộp cả bảng từ: phát từ `startSec` đến `endSec` (hết tệp nếu không có). */
      track?: { url: string; startSec: number; endSec?: number };
    }
  | {
      kind: "question";
      label: string;
      questionId: string;
      no: number;
      total: number;
      type: string;
      prompt: string;
      promptReading?: string;
      promptTranslation?: string;
      /** Lựa chọn (mcq/multi), mảnh ghép (ordering), cặp (matching), thẻ kéo (drag_drop_fill): chỉ nhãn, không đánh dấu đúng. */
      choices: string[];
      /** Vế trái của câu nối (matching) theo thứ tự hiển thị. */
      leftSide: string[];
      /** Bài đọc, hình, âm thanh, bảng đi kèm câu (nếu có): hiện cạnh câu hỏi để học viên nhìn được cả hai, không tách màn riêng. */
      passage: { title: string; blocks: PassageBlock[] } | null;
      /** Từ mới của bài, để tô nổi bật trong bài đọc đi kèm. */
      keys: string[];
      /** Câu nói hội thoại đóng vai: kịch bản các lượt kèm âm thanh mẫu (nếu có). */
      roleplay: QuestionRolePlay | null;
      /** Câu nói tự do với bạn ảo: tình huống, lời mở đầu, cụm gợi ý. */
      freechat: QuestionFreeChat | null;
    };

/** Một khối của bài đọc đi kèm câu hỏi: chữ (từng đoạn nhỏ có thể in đậm), hình, âm thanh, bảng. */
export type PassageBlock =
  | { kind: "text"; runs: Array<{ text: string; bold?: boolean }>; heading?: boolean }
  | { kind: "image"; url: string; alt?: string }
  | { kind: "audio"; url: string; label?: string }
  | { kind: "table"; rows: Array<Array<{ text: string; head?: boolean }>> };

export interface QuestionRolePlay {
  roles: { A: string; B: string };
  keys: string[];
  turns: Array<{ speaker: "A" | "B"; roleName: string; main: string; reading?: string; audioUrl?: string }>;
}

export interface QuestionFreeChat {
  scenario?: string;
  opening?: string;
  openingReading?: string;
  targets: string[];
}

/** Màu nhấn của màn (khớp bảng màu các mục trong bài học HSK); CSS đặt `--ac` theo tên này. */
export type FrameAccent = "blue" | "violet" | "teal" | "pink" | "amber" | "lime" | "green";

function rec(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}
function opt(v: unknown): string | undefined {
  const t = str(v).trim();
  return t ? t : undefined;
}

/** Bài đọc (TipTap `doc`) → các khối chữ, hình, âm thanh, bảng theo thứ tự. Nút lạ bị bỏ (nhưng nội dung con của nó vẫn được duyệt). */
export function passageBlocks(contentJson: unknown): PassageBlock[] {
  const out: PassageBlock[] = [];
  const runsOf = (n: Record<string, unknown>) =>
    arr(n.content)
      .map(rec)
      .filter((p) => str(p.text))
      .map((p) => ({ text: str(p.text), ...(arr(p.marks).some((m) => rec(m).type === "bold") ? { bold: true } : {}) }));
  const walk = (node: unknown) => {
    const n = rec(node);
    if (n.type === "paragraph" || n.type === "heading") {
      const runs = runsOf(n);
      if (runs.some((r) => r.text.trim())) out.push({ kind: "text", runs, ...(n.type === "heading" ? { heading: true } : {}) });
    } else if (n.type === "image") {
      const url = str(rec(n.attrs).src);
      if (url) out.push({ kind: "image", url, alt: opt(rec(n.attrs).alt) });
    } else if (n.type === "audio") {
      const url = str(rec(n.attrs).src);
      if (url) out.push({ kind: "audio", url, label: opt(rec(n.attrs).alt) });
    } else if (n.type === "table") {
      const rows = arr(n.content)
        .map(rec)
        .filter((r) => r.type === "tableRow")
        .map((r) =>
          arr(r.content)
            .map(rec)
            .map((c) => ({ text: plainOfNode(c), ...(c.type === "tableHeader" ? { head: true } : {}) })),
        )
        .filter((r) => r.length);
      if (rows.length) out.push({ kind: "table", rows });
    } else if (Array.isArray(n.content)) {
      n.content.forEach(walk);
    }
  };
  walk(contentJson);
  return out;
}

function plainOfNode(n: unknown): string {
  const r = rec(n);
  if (typeof r.text === "string") return r.text;
  return arr(r.content).map(plainOfNode).join(" ").replace(/\s+/g, " ").trim();
}

function rolePlayOf(config: Record<string, unknown>, keys: string[]): QuestionRolePlay | null {
  const rp = parseRolePlay(config);
  if (!rp) return null;
  return {
    roles: rp.roles,
    keys,
    turns: rp.turns.map((t) => {
      const { main, reading } = splitReading(t.text);
      return { speaker: t.speaker, roleName: rp.roles[t.speaker], main, reading: reading || undefined, audioUrl: t.audio };
    }),
  };
}

function freeChatOf(config: Record<string, unknown>): QuestionFreeChat | null {
  const f = rec(config.freechat);
  const scenario = opt(f.scenario);
  const opening = opt(f.opening);
  if (!scenario && !opening) return null;
  const sp = opening ? splitReading(opening) : null;
  return {
    scenario,
    opening: sp?.main,
    openingReading: sp?.reading || undefined,
    targets: arr(f.targets).map(str).filter(Boolean).slice(0, 10),
  };
}

function questionFrame(q: TeachingQuestionInput, no: number, total: number, label: string, passage: { title: string; blocks: PassageBlock[] } | null, keys: string[]): TeachingFrame {
  const aid = rec(q.config.promptAid);
  const options = arr(q.config.options).map((o) => str(rec(o).label)).filter(Boolean);
  const items = arr(q.config.items).map((o) => str(rec(o).label)).filter(Boolean);
  const lefts = arr(q.config.lefts).map((o) => str(rec(o).label)).filter(Boolean);
  const rights = arr(q.config.rights).map((o) => str(rec(o).label)).filter(Boolean);
  const tokens = arr(q.config.tokens).map((o) => str(rec(o).label)).filter(Boolean);
  const choices = options.length ? options : items.length ? items : tokens.length ? tokens : rights;
  const leftSide = lefts;
  return {
    kind: "question",
    label,
    questionId: q.id,
    no,
    total,
    type: q.type,
    prompt: q.prompt,
    promptReading: opt(aid.reading),
    promptTranslation: opt(aid.translation),
    choices,
    leftSide,
    passage,
    keys,
    roleplay: rolePlayOf(q.config, keys),
    freechat: freeChatOf(q.config),
  };
}

export function buildTeachingFrames(input: {
  lessonTitle: string;
  items: TeachingItem[];
  /** Theo `item.id` của khối exam_practice. Khối không có ở đây (chưa có câu nào) bị bỏ. */
  practices: Record<string, TeachingPracticeInput>;
  /**
   * Đưa ghi chú giảng viên (`teacher_note`) vào `frame.notes`: ghi chú gắn với màn đầu tiên của khối liền SAU nó (không có khối sau thì gắn màn cuối).
   * CHỈ bật ở trang dành cho người dạy; học viên không bao giờ nhận các màn này.
   */
  includeNotes?: boolean;
}): TeachingFrame[] {
  const frames: TeachingFrame[] = [{ kind: "cover", label: "", title: input.lessonTitle }];
  // Từ mới của cả bài: tô nổi bật khi gặp trong hội thoại và kịch bản đóng vai.
  const keys = keyTermsFromVocab(
    input.items.filter((i) => i.type === "vocab_list").flatMap((i) => arr(rec(i.payload).items).map((v) => str(rec(v).term))),
  );

  let pendingNotes: string[] = [];
  let startLen = frames.length;
  const flushNotes = () => {
    if (pendingNotes.length && frames.length > startLen) {
      const f = frames[startLen]!;
      f.notes = [...(f.notes ?? []), ...pendingNotes];
      pendingNotes = [];
    }
  };
  for (const item of input.items) {
    // Ghi chú đứng trước khối nào thì gắn vào màn đầu của khối đó (xem `includeNotes`).
    flushNotes();
    startLen = frames.length;
    if (item.type === "teacher_note") {
      if (input.includeNotes) {
        const lines = topLevelBlocks(str(rec(item.payload).html)).map(plainText).filter(Boolean);
        if (lines.length) pendingNotes.push(...lines);
      }
      continue;
    }
    const p = rec(item.payload);
    if (item.type === "richtext" || item.type === "markdown") {
      const html = str(p.html);
      if (!html) continue;
      for (const c of chunkRichText(html)) {
        frames.push({ kind: "html", label: c.label, title: c.title, html: demoteLongStrong(scaleInlineFontSizes(mergePinyinColumn(c.html))), cont: c.cont });
      }
    } else if (item.type === "dialogue") {
      const turns = arr(p.turns)
        .map(rec)
        .filter((t) => str(t.text).trim())
        .map((t, i) => ({
          id: str(t.id) || `t${i}`,
          speaker: str(t.speaker),
          text: str(t.text),
          reading: opt(t.reading),
          translation: opt(t.translation),
          audioUrl: opt(t.audioUrl),
          startSec: typeof t.startSec === "number" ? t.startSec : undefined,
        }));
      if (!turns.length) continue;
      const speakers = arr(p.speakers)
        .map(rec)
        .filter((s) => str(s.name))
        .map((s) => ({ name: str(s.name), avatarUrl: opt(s.avatarUrl) }));
      const title = str(p.title) || "Hội thoại";
      frames.push({ kind: "dialogue", label: "Hội thoại", title, audioUrl: opt(p.audioUrl), readingLabel: opt(p.readingLabel), keys, speakers, turns });
      turns.forEach((t, i) => {
        frames.push({
          kind: "turn",
          label: "Hội thoại",
          title,
          turnNo: i + 1,
          turnTotal: turns.length,
          speaker: t.speaker,
          avatarUrl: speakers.find((s) => s.name === t.speaker)?.avatarUrl,
          text: t.text,
          reading: t.reading,
          translation: t.translation,
          audioUrl: t.audioUrl,
          keys,
        });
      });
    } else if (item.type === "vocab_list") {
      const list = arr(p.items).map(rec).filter((v) => str(v.term).trim());
      const trackUrl = opt(p.audioUrl);
      list.forEach((v, i) => {
        const start = typeof v.trackStartSec === "number" ? v.trackStartSec : undefined;
        const next = list.slice(i + 1).find((x) => typeof x.trackStartSec === "number");
        frames.push({
          kind: "vocab",
          label: "Từ mới",
          no: i + 1,
          total: list.length,
          term: str(v.term),
          reading: opt(v.reading),
          meaning: str(v.meaning),
          example: opt(v.example),
          exampleReading: opt(v.exampleReading),
          exampleMeaning: opt(v.exampleMeaning),
          note: opt(v.note),
          audioUrl: opt(v.audioUrl),
          exampleAudioUrl: opt(v.exampleAudioUrl),
          track: trackUrl && start !== undefined ? { url: trackUrl, startSec: start, endSec: next ? (next.trackStartSec as number) : undefined } : undefined,
        });
      });
    } else if (item.type === "exam_practice") {
      const pr = input.practices[item.id];
      if (!pr || !pr.questions.length) continue;
      const title = str(p.title) || pr.title || "Luyện tập";
      const passages = new Map(
        pr.passages.map((ps) => [ps.id, { title: ps.title, blocks: passageBlocks(ps.contentJson) }] as const),
      );
      pr.questions.forEach((q, i) => {
        const ps = q.passageId ? passages.get(q.passageId) : undefined;
        frames.push(questionFrame(q, i + 1, pr.questions.length, `Luyện tập · ${title}`, ps && ps.blocks.length ? ps : null, keys));
      });
    }
    // Mọi loại khác (video, nhúng, tệp…): không có màn.
  }
  flushNotes();
  // Ghi chú còn lại (đứng sau khối cuối, hoặc khối sau không ra màn nào) gắn vào màn cuối.
  if (pendingNotes.length) {
    const last = frames[frames.length - 1]!;
    last.notes = [...(last.notes ?? []), ...pendingNotes];
  }
  return frames;
}

/** Tên ngắn của màn để hiện trên thanh mục lục. */
export function frameHeading(f: TeachingFrame): string {
  switch (f.kind) {
    case "cover":
      return f.title;
    case "html":
      return f.title ? plainText(f.title) : plainText(f.label);
    case "dialogue":
      return f.title;
    case "turn":
      return `${f.title} · ${f.turnNo}/${f.turnTotal}`;
    case "vocab":
      return `${f.term} · ${f.no}/${f.total}`;
    case "question":
      return `Câu ${f.no}/${f.total}`;
  }
}

/**
 * Tên mục ngắn của một tiêu đề bài viết: "2对话 A · Hội thoại: xem nhà" → "Hội thoại A"; "4生词 · Từ mới" → "Từ mới";
 * tiêu đề không có dấu "·" giữ nguyên ("Mục tiêu bài học").
 */
export function sectionName(label: string): string {
  const text = plainText(label);
  const m = /^[\d\s]*[\p{Script=Han}\s]*([A-Z])?\s*·\s*([^:]+?)\s*(?::.*)?$/u.exec(text);
  if (!m) return text;
  return m[1] ? `${m[2]} ${m[1]}` : m[2]!;
}

/**
 * Mục lục: những màn liên tiếp cùng mục gộp thành một dòng trỏ tới màn đầu tiên. Hội thoại và từ mới đi theo tiêu đề bài viết đứng
 * ngay trước chúng (cùng mục), mỗi Bài luyện là một mục riêng.
 */
export function frameSections(frames: TeachingFrame[]): Array<{ label: string; index: number }> {
  const out: Array<{ label: string; index: number }> = [];
  let current = "";
  frames.forEach((f, i) => {
    let label: string;
    if (f.kind === "cover") label = "Mở bài";
    else if (f.kind === "html") label = f.label ? sectionName(f.label) : current;
    else if (f.kind === "dialogue" || f.kind === "turn") label = current && /^Hội thoại/.test(current) ? current : "Hội thoại";
    else if (f.kind === "vocab") label = current === "Từ mới" ? current : "Từ mới";
    else label = f.label;
    if (!label) return;
    current = label;
    if (!out.length || out[out.length - 1]!.label !== label) out.push({ label, index: i });
  });
  return out;
}

/**
 * Màu nhấn của màn, theo mục của bài (cùng bảng màu các mục trong bài học HSK): hội thoại tím, từ mới xanh ngọc, ngữ pháp hồng, văn hoá hổ phách,
 * tổng kết xanh lá, luyện tập lime (màu của khối luyện), còn lại xanh dương.
 */
export function frameAccent(f: TeachingFrame): FrameAccent {
  switch (f.kind) {
    case "cover":
      return "lime";
    case "dialogue":
    case "turn":
      return "violet";
    case "vocab":
      return "teal";
    case "question":
      return "lime";
    case "html": {
      const l = sectionName(f.label);
      if (/Ngữ pháp/i.test(l)) return "pink";
      if (/Văn hoá/i.test(l)) return "amber";
      if (/Tổng kết|Tóm tắt/i.test(l)) return "green";
      if (/Từ mới/i.test(l)) return "teal";
      if (/Hội thoại/i.test(l)) return "violet";
      return "blue";
    }
  }
}
