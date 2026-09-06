/**
 * Nhập một khoá học từ file JSON học liệu, đi qua đúng đường mà UI giảng viên
 * đi — createCourse → createModule → createLesson → createContentItem →
 * createQuiz → createQuestion.
 *
 * KHÔNG dùng INSERT tay. Đi đường này thì mỗi bài học tự có skill tag (B1.5),
 * câu hỏi kế thừa tag của bài, và payload nội dung được zod kiểm trước khi
 * chạm DB. Ghi tay bỏ qua cả ba, mà hỏng thì hỏng im lặng.
 *
 * Khoá tạo ra ở trạng thái `draft` — publish là việc của người duyệt nội dung.
 *
 *   pnpm import:course -- --file ./hoc-lieu.json --owner gv@example.com --dry-run
 *   pnpm import:course -- --file ./hoc-lieu.json --owner gv@example.com
 *   pnpm import:course -- --file ./bai-23.json --owner gv@example.com --into <courseId>
 *
 * `--into` nối thêm module vào một khoá đã có thay vì tạo khoá mới — giáo trình
 * gửi tới theo từng bài, không thể bắt dựng lại cả khoá mỗi lần. Module mới xếp
 * sau module cuối cùng đang có; phần `course` trong file bị bỏ qua.
 *
 * `--dry-run` kiểm tra TOÀN BỘ manifest (kể cả từng câu hỏi, qua chính
 * CreateQuestionInput mà API dùng) rồi in cây nội dung, không ghi gì. Chạy nó
 * trước khi chạm production: một câu hỏi sai ở bài cuối mà phát hiện lúc đang
 * ghi thì để lại một khoá dở dang.
 *
 * ── Chạy vào PRODUCTION ─────────────────────────────────────────────────────
 *
 * Postgres của prod không publish cổng nào ra host, và `pg_hba.conf` chỉ cho
 * `trust` với loopback bên trong container — mọi kết nối khác phải có mật khẩu.
 * Nên mở đường hầm SSH tới thẳng IP container rồi chạy script từ máy mình:
 *
 *   # 1. Lấy IP container (đổi mỗi lần postgres restart)
 *   ssh -p 8901 codelab@101.96.66.224 \
 *     "docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' feedbackme-postgres-1"
 *
 *   # 2. Mở hầm, để cửa sổ này chạy
 *   ssh -p 8901 -N -L 55432:<IP-container>:5432 codelab@101.96.66.224
 *
 *   # 3. Cửa sổ khác: điền mật khẩu vào packages/db/.env.prod-import
 *   #    (mẫu ở .env.prod-import.example, lấy POSTGRES_PASSWORD từ
 *   #     /etc/feedbackme/.env.prod trên server), rồi:
 *   pnpm import:course:prod -- --file bai-22.json --owner joynguyen7@gmail.com --dry-run
 *   pnpm import:course:prod -- --file bai-22.json --owner joynguyen7@gmail.com
 *
 * Prod đang thiếu migration B9 (FeedbackTemplate chưa có cột level/elaboration).
 * Script đã tránh chỗ đó — xem `upsertFeedbackTemplate` ở dưới.
 */

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { createCourse } from "../src/courses/courses";
import { createModule } from "../src/courses/modules";
import { createLesson } from "../src/courses/lessons";
import { createContentItem } from "../src/courses/contents";
import { createQuiz } from "../src/quizzes/quizzes";
import { CreateQuestionInput, createQuestion } from "../src/quizzes/questions";
import { lessonSkillCode } from "../src/courses/autoTags";

// ── Định dạng file học liệu ───────────────────────────────────────────────────
// Giữ cho người soạn bài đọc và sửa được: `pairs`, `sequence`, `answers` là
// cách viết cho người, script tự bung ra thành `options` + `extra` mà
// CreateQuestionInput đòi.

const VocabItem = z.object({
  hanzi: z.string().min(1),
  pinyin: z.string().default(""),
  meaning: z.string().min(1),
  note: z.string().optional(),
});

const QuestionSpec = z.object({
  /**
   * Khoá định danh ổn định của câu hỏi, ghi vào `extra.manifestKey`.
   *
   * Không có nó thì thứ duy nhất để nhận ra "vẫn là câu hỏi ấy" là chính đề
   * bài — nên sửa một chữ trong đề là script sửa-một-bài coi như câu mới và
   * đẻ ra bản thứ hai. Đặt khoá cho câu nào dự tính còn sửa.
   */
  key: z.string().min(1).max(80).optional(),
  type: z.enum([
    "mcq",
    "true_false",
    "fill_in",
    "short_answer",
    "ordering",
    "matching",
    "essay",
  ]),
  prompt: z.string().min(1),
  explanation: z.string().optional(),
  points: z.number().int().min(1).max(100).optional(),
  /** mcq / true_false — `misconception` là mã lỗi tư duy gắn vào phương án SAI */
  options: z
    .array(
      z.object({
        label: z.string().min(1),
        isCorrect: z.boolean(),
        misconception: z.string().min(1).optional(),
      }),
    )
    .optional(),
  /** fill_in / short_answer — mọi cách viết được chấp nhận */
  answers: z.array(z.string().min(1)).optional(),
  /** ordering — thứ tự đúng, viết đúng thứ tự */
  sequence: z.array(z.string().min(1)).optional(),
  /** matching — từng cặp trái/phải */
  pairs: z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).optional(),
});

const DialogueTurn = z.object({
  speaker: z.string().min(1),
  zh: z.string().min(1),
  pinyin: z.string().optional(),
  vi: z.string().optional(),
});

const DialogueSpec = z.object({
  heading: z.string().optional(),
  /** Dòng dẫn cảnh, in nghiêng phía trên hội thoại. */
  scene: z.string().optional(),
  turns: z.array(DialogueTurn).min(1),
});

/**
 * Bảng hai cột chữ Hán → nghĩa (mẫu câu, cách đọc…). Phải là dữ liệu có cấu
 * trúc chứ không viết vào `body`: bảng markdown chỉ render được ở cỡ chữ nền
 * 14px, chữ Hán bé tí bên cạnh hội thoại 28px.
 */
const PatternsSpec = z.object({
  heading: z.string().optional(),
  note: z.string().optional(),
  rows: z.array(z.object({ zh: z.string().min(1), vi: z.string().min(1) })).min(1),
});

export const LessonSpec = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2_000).optional(),
  vocab: z.array(VocabItem).optional(),
  dialogue: DialogueSpec.optional(),
  patterns: PatternsSpec.optional(),
  body: z.string().optional(),
  /**
   * Mục tiêu bài học, viết bằng động từ hành vi ("phân biệt được", "xếp được")
   * chứ không phải "hiểu về" — mục tiêu nào không quan sát được thì cũng không
   * kiểm tra được, và người học không biết lấy gì làm mốc đã đạt hay chưa.
   */
  objectives: z.array(z.string().min(1).max(500)).max(10).optional(),
  /**
   * Tổng kết cuối bài — vài ý người học nên mang theo. Chèn NGAY TRƯỚC mục
   * luyện tập chứ không phải sau cùng: đọc xong nội dung là tới tổng kết, rồi
   * mới tới bài tập; đặt sau phần nguồn tham khảo thì không ai còn đọc.
   */
  summary: z.array(z.string().min(1).max(500)).max(8).optional(),
  /**
   * Mục lục đầu bài. Bỏ trống = tự quyết: bài có từ 4 tiêu đề `##` trở lên thì
   * có mục lục, ngắn hơn thì không (mục lục 2 dòng chỉ tổ chiếm chỗ).
   */
  toc: z.boolean().optional(),
  quiz: z
    .object({
      title: z.string().min(1).max(200),
      passThresholdPct: z.number().int().min(0).max(100).optional(),
      /**
       * Bắt học viên tự chấm độ tự tin cho TỪNG câu. Mặc định của DB là bật;
       * để đây cho thấy rõ chứ không để nó lặng lẽ bật sau lưng người soạn —
       * bật thì mỗi câu tốn thêm một thao tác, mà tắt thì mất dữ liệu
       * tự tin × đúng/sai (biết mà sai khác hẳn đoán mò mà đúng).
       */
      requireConfidence: z.boolean().optional(),
      /**
       * Giới hạn thời gian làm bài, tính bằng giây. Đồng hồ đếm từ lúc học
       * viên bấm bắt đầu (`attempt.startedAt`), không phải từ lúc mở trang.
       * Bỏ trống = không giới hạn.
       */
      timeLimitSec: z.number().int().min(30).max(86_400).optional(),
      /** Số lượt làm tối đa. Bỏ trống = làm lại bao nhiêu lần cũng được. */
      maxAttempts: z.number().int().min(1).max(100).optional(),
      questions: z.array(QuestionSpec).min(1),
    })
    .optional(),
});

export const Manifest = z.object({
  course: z.object({
    title: z.string().min(1).max(200),
    slug: z
      .string()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/)
      .optional(),
    description: z.string().min(1).max(20_000),
    language: z.string().min(2).max(10).optional(),
    level: z.enum(["beginner", "intermediate", "advanced"]).optional(),
    category: z.string().max(80).optional(),
    personalizationEnabled: z.boolean().optional(),
  }),
  /**
   * Lỗi tư duy điển hình của bài. Gắn vào phương án sai để Feedback Engine
   * nói được HỌC VIÊN SAI Ở ĐÂU, thay vì một câu chung chung.
   */
  misconceptions: z
    .array(
      z.object({
        code: z.string().min(1).max(120),
        name: z.string().min(1).max(200),
        description: z.string().min(1),
      }),
    )
    .optional(),
  /** Lời phản hồi hiển thị khi học viên dính lỗi tương ứng. Không có `misconception` = template chung. */
  feedbackTemplates: z
    .array(
      z.object({
        misconception: z.string().min(1).optional(),
        body: z.string().min(1),
        priority: z.number().int().min(0).max(1000).optional(),
      }),
    )
    .optional(),
  modules: z
    .array(
      z.object({
        title: z.string().min(1).max(200),
        description: z.string().max(2_000).optional(),
        lessons: z.array(LessonSpec).min(1),
      }),
    )
    .min(1),
});

export type QuestionSpec = z.infer<typeof QuestionSpec>;
type VocabItem = z.infer<typeof VocabItem>;
type DialogueSpec = z.infer<typeof DialogueSpec>;
type PatternsSpec = z.infer<typeof PatternsSpec>;

// ── Bung câu hỏi sang dạng API ────────────────────────────────────────────────

/**
 * `ordering` và `matching` để isCorrect=false trên MỌI option — giống hệt
 * AddQuestionForm. Chấm điểm hai loại này đọc orderIndex / extra.pairKey chứ
 * không đọc isCorrect; đặt true sẽ khiến UI giảng viên gắn nhãn "đáp án đúng"
 * lên từng mảnh rời của câu hỏi.
 */
export function expandQuestion(
  q: QuestionSpec,
  orderIndex: number,
  mcIds?: Map<string, string>,
): Record<string, unknown> {
  const base = {
    type: q.type,
    prompt: q.prompt,
    explanation: q.explanation,
    points: q.points,
    orderIndex,
    ...(q.key ? { extra: { manifestKey: q.key } } : {}),
  };

  switch (q.type) {
    case "essay":
      return base;

    case "fill_in":
    case "short_answer":
      return {
        ...base,
        options: (q.answers ?? []).map((label) => ({ label, isCorrect: true })),
      };

    case "ordering":
      return {
        ...base,
        options: (q.sequence ?? []).map((label) => ({ label, isCorrect: false })),
      };

    case "matching":
      return {
        ...base,
        options: (q.pairs ?? []).flatMap((p, i) => [
          { label: p.left, isCorrect: false, extra: { side: "left", pairKey: `p${i + 1}` } },
          { label: p.right, isCorrect: false, extra: { side: "right", pairKey: `p${i + 1}` } },
        ]),
      };

    default:
      return {
        ...base,
        options: (q.options ?? []).map((o) => ({
          label: o.label,
          isCorrect: o.isCorrect,
          ...(o.misconception ? { misconceptionId: mcIds?.get(o.misconception) } : {}),
        })),
      };
  }
}

/**
 * Cỡ chữ cho phần tiếng Trung. `prose-sm` của LessonContent đặt nền 14px —
 * quá nhỏ để nhìn rõ nét chữ Hán, nên chữ Hán được phóng gấp đôi.
 *
 * Đặt bằng thuộc tính `style` nội tuyến chứ không bằng class Tailwind: nội
 * dung này nằm trong DB, Tailwind chỉ sinh CSS từ mã nguồn nên class lạ sẽ
 * không có style nào cả. `style` thì DOMPurify giữ lại (SafeHtml ADD_ATTR).
 */
const ZH_SIZE = "1.75rem"; // gấp đôi nền 0.875rem của prose-sm
const ZH_SIZE_TABLE = "1.6rem";
const SUB_SIZE = "1.05rem";
/**
 * Cỡ chữ cho văn xuôi (`body`) — tách khỏi SUB_SIZE của pinyin/bản dịch.
 *
 * `prose-sm` của LessonContent đặt nền 14px: đủ cho một dòng dịch nằm dưới
 * câu chữ Hán, quá nhỏ để đọc liền vài trăm chữ. Mọi khối cùng cấp — đoạn
 * văn, danh sách, ô bảng, trích dẫn — dùng CHUNG một cỡ để trang không nhấp
 * nhô; chỉ tiêu đề và chú thích hình lệch ra khỏi thang này.
 */
const TEXT = "1.25rem";
const CAPTION = "1rem";
/**
 * Màu nhận diện cho từng mục cấp 2, lặp lại theo thứ tự.
 *
 * Chỉ giữ phần "r,g,b" để chỗ dùng tự chọn độ trong: nền thì nhạt (0.10–0.16),
 * chữ và vạch thì đậm. Cách này đọc được trên CẢ nền sáng lẫn nền tối — điều
 * mà một mã màu cố định không làm được, vì học liệu nằm trong DB còn giao diện
 * thì đổi theo chủ đề sáng/tối của người dùng.
 *
 * Không dùng đỏ: trong giao diện màu đỏ đã mang nghĩa lỗi.
 */
const SECTION_HUES = [
  "59,130,246", // lam
  "139,92,246", // tím
  "13,148,136", // ngọc
  "217,150,40", // hổ phách
  "219,90,140", // hồng sen
] as const;

/**
 * Bản đậm hơn của cùng dải màu, dùng cho CHỮ tiêu đề.
 *
 * Màu ở `SECTION_HUES` chỉ an toàn khi làm nền nhạt hoặc vạch kẻ. Đem nguyên
 * chúng ra làm màu chữ thì hỏng tương phản: hổ phách gốc chỉ đạt 2.52:1 trên
 * nền trắng, dưới cả ngưỡng 3:1 của chữ lớn. Năm giá trị dưới đây đã được đo
 * để đạt ≥4:1 trên CẢ nền trắng lẫn nền tối #111827 — khoá học này dạy WCAG
 * thì trang của nó không được vi phạm.
 */
const SECTION_TEXT_HUES = [
  "40,118,245", // lam    — 4.20 trên trắng · 4.22 trên tối
  "138,91,246", // tím    — 4.28 · 4.15
  "12,141,129", // ngọc   — 4.08 · 4.34
  "165,113,29", // hổ phách — 4.22 · 4.21
  "214,67,124", // hồng   — 4.24 · 4.18
] as const;

/** Xám trung tính — đọc được trên cả nền sáng lẫn nền tối. */
const MUTED = "rgba(127,127,127,0.95)";
const RULE = "rgba(127,127,127,0.32)";

/**
 * Neo cho tiêu đề: bỏ dấu tiếng Việt rồi rút về [a-z0-9-].
 *
 * Không dùng thẳng tiêu đề có dấu làm `id`: nó vẫn chạy trên trình duyệt hiện
 * đại nhưng link chép ra ngoài bị mã hoá phần trăm thành một chuỗi không đọc
 * được, và vài công cụ vẫn vấp. Tiền tố "muc-" để không đụng id nào của ứng
 * dụng.
 */
function slugify(raw: string): string {
  const base = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `muc-${base || "phan"}`;
}

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function vocabTable(items: VocabItem[]): string {
  const hasNote = items.some((v) => v.note);
  const th = `padding:.45rem .6rem;text-align:left;font-size:.9rem;font-weight:600;color:${MUTED};border-bottom:1px solid ${RULE}`;
  const td = `padding:.45rem .6rem;border-bottom:1px solid ${RULE};vertical-align:middle`;
  const rows = items
    .map(
      (v) =>
        `<tr>` +
        `<td style="${td};font-size:${ZH_SIZE_TABLE};line-height:1.5;white-space:nowrap">${esc(v.hanzi)}</td>` +
        `<td style="${td};font-size:${SUB_SIZE};font-style:italic;color:${MUTED};white-space:nowrap">${esc(v.pinyin)}</td>` +
        `<td style="${td};font-size:${SUB_SIZE}">${esc(v.meaning)}</td>` +
        (hasNote
          ? `<td style="${td};font-size:.95rem;color:${MUTED}">${esc(v.note ?? "")}</td>`
          : "") +
        `</tr>`,
    )
    .join("");
  return (
    `<h2 style="font-size:1.35rem;margin:0 0 .75rem">Từ vựng</h2>` +
    `<div style="overflow-x:auto">` +
    `<table style="width:100%;border-collapse:collapse;margin:0">` +
    `<thead><tr>` +
    `<th style="${th}">Chữ Hán</th><th style="${th}">Pinyin</th><th style="${th}">Nghĩa</th>` +
    (hasNote ? `<th style="${th}">Ghi chú</th>` : "") +
    `</tr></thead><tbody>${rows}</tbody></table></div>`
  );
}

/**
 * Phóng to mọi cụm chữ Hán nằm lẫn trong câu tiếng Việt.
 *
 * Đây là điều markdown không làm được: cỡ chữ đặt cho cả khối, mà một dòng
 * kiểu "试试 → 试了试" có cả hai hệ chữ. Chữ Hán nét dày hơn chữ Latin nhiều
 * nên ở 14px là không đọc được nét.
 *
 * Dải ký tự gồm cả dấu câu toàn phần （）、。？ để chúng to theo chữ, không bị
 * tụt lại một mình ở cỡ nhỏ.
 */
const CJK_RUN = /[　-〿㐀-䶿一-鿿＀-￯]+/g;

function zoomCjk(html: string): string {
  return html.replace(CJK_RUN, (m) => `<span style="font-size:1.3em">${m}</span>`);
}

/** Định dạng trong dòng: **đậm**, *nghiêng*, `mã`. Escape TRƯỚC, rồi mới gắn thẻ. */
function inline(raw: string): string {
  const html = esc(raw)
    .replace(
      // Dạng "unrolled loop": tuyến tính, không có định lượng lồng nhau. Vẫn
      // nhận URL có một cấp ngoặc (trang File của Wikimedia), nhưng không thể
      // bùng nổ quay lui khi chuỗi không khớp.
      /\[([^\]]+)\]\((https?:\/\/[^()\s]*(?:\([^()\s]*\)[^()\s]*)*)\)/g,
      `<a href="$2" target="_blank" rel="noopener noreferrer" style="text-decoration:underline">$1</a>`,
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*]+)\*/g, "$1<em>$2</em>")
    .replace(
      /`([^`]+)`/g,
      `<code style="background:rgba(127,127,127,.14);padding:.1em .35em;border-radius:.25em">$1</code>`,
    );
  // Chạy sau cùng: thẻ do các bước trên sinh ra không chứa ký tự CJK nên
  // không có nguy cơ chèn span vào giữa tên thẻ.
  return zoomCjk(html);
}

/**
 * Markdown → HTML cho phần `body`, để mọi bài dùng chung một thang cỡ chữ với
 * hội thoại và bảng mẫu câu.
 *
 * Hỗ trợ đúng những gì giáo trình này dùng: tiêu đề `##`/`###`, đoạn văn, gạch
 * đầu dòng `-`, danh sách đánh số, trích dẫn `>`, đường kẻ `---`, bảng GFM, và
 * định dạng trong dòng. Dòng nào không khớp thì coi như đoạn văn — hỏng thì
 * hỏng lộ ra chứ không mất chữ.
 */
export function markdownToHtml(md: string, opts: { toc?: boolean; beforeLastSection?: string } = {}): string {
  const lines = md.split("\n");
  const out: string[] = [];
  // Tiêu đề cấp 2 gom lại để dựng mục lục; đếm trùng để hai mục cùng tên
  // không nhận cùng một neo.
  const headings: Array<{ id: string; text: string; at: number }> = [];
  const used = new Map<string, number>();
  const h2Total = lines.filter((l) => /^## \S/.test(l.trim())).length;
  // Màu của mục đang đọc dở — bảng, trích dẫn trong mục lấy theo màu này.
  let hue: string = SECTION_HUES[0]!;
  let textHue: string = SECTION_TEXT_HUES[0]!;
  // Mục lục đánh số 1. 2. 3. thì tiêu đề trong bài cũng phải mang số ấy —
  // không có số thì người đọc phải dò lại bằng tên, đúng việc mà mục lục sinh
  // ra để khỏi phải làm.
  const wantToc = (opts.toc ?? h2Total >= 4) && h2Total >= 2;
  let h2Index = 0;
  const p = `margin:.7rem 0;font-size:${TEXT};line-height:1.8`;
  const td = `padding:.55rem .6rem;border-bottom:1px solid ${RULE};font-size:${TEXT};line-height:1.7;vertical-align:top`;
  const th = () =>
    `padding:.55rem .6rem;text-align:left;font-size:${CAPTION};font-weight:600;` +
    `background:rgba(${hue},.10);border-bottom:2px solid rgba(${hue},.35)`;
  let i = 0;

  const flushList = (ordered: boolean, items: string[]) => {
    const tag = ordered ? "ol" : "ul";
    out.push(
      `<${tag} style="margin:.7rem 0;padding-left:1.4rem;font-size:${TEXT};line-height:1.8">` +
        items.map((it) => `<li style="margin:.2rem 0">${inline(it)}</li>`).join("") +
        `</${tag}>`,
    );
  };

  while (i < lines.length) {
    const line = lines[i]!;
    const t = line.trim();

    if (t === "") { i++; continue; }

    // Hình minh hoạ trên một dòng riêng: ![mô tả](url "chú thích").
    // Chú thích đi qua inline() nên viết được [tên nguồn](link) trong đó —
    // học liệu dùng lại hình của người khác thì dòng ghi nguồn phải nằm ngay
    // dưới hình, không dồn xuống cuối bài nơi không ai đọc.
    const img =
      /^!\[([^\]]*)\]\(([^()\s]*(?:\([^()\s]*\)[^()\s]*)*)(?:\s+"([^"]*)")?\)$/.exec(t);
    if (img) {
      out.push(
        `<figure style="margin:1.2rem 0">` +
          `<img src="${esc(img[2]!)}" alt="${esc(img[1] ?? "")}" loading="lazy" ` +
          `style="max-width:100%;height:auto;border:1px solid ${RULE};border-radius:.5rem;display:block">` +
          (img[3]
            ? `<figcaption style="font-size:${CAPTION};color:${MUTED};line-height:1.6;margin:.45rem 0 0">${inline(img[3])}</figcaption>`
            : "") +
          `</figure>`,
      );
      i++;
      continue;
    }

    // Khối HTML thô ```html … ``` — dùng cho sơ đồ tự vẽ bằng div + style
    // (thang khoảng cách, ô màu, lưới cột). SafeHtml bật USE_PROFILES.html
    // nên <svg> bị lọc sạch, còn div/table cùng thuộc tính style thì giữ
    // nguyên; vẽ bằng HTML là cách duy nhất có sơ đồ mà không phụ thuộc vào
    // một tệp ảnh đặt ở đâu đó bên ngoài.
    if (t.startsWith("```html")) {
      i++;
      const raw: string[] = [];
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) {
        raw.push(lines[i]!);
        i++;
      }
      i++; // bỏ dòng đóng
      out.push(raw.join("\n"));
      continue;
    }

    if (t === "---") { out.push(`<hr style="border:0;border-top:1px solid ${RULE};margin:1.1rem 0">`); i++; continue; }

    const h = /^(#{2,4})\s+(.*)$/.exec(t);
    if (h) {
      const level = h[1]!.length;
      const size = level === 2 ? "1.7rem" : level === 3 ? "1.42rem" : "1.25rem";
      const text = h[2]!;
      let id = slugify(text);
      const seen = used.get(id) ?? 0;
      used.set(id, seen + 1);
      if (seen > 0) id = `${id}-${seen + 1}`;
      if (level === 2) headings.push({ id, text, at: out.length });
      if (level === 2) {
        hue = SECTION_HUES[h2Index % SECTION_HUES.length]!;
        textHue = SECTION_TEXT_HUES[h2Index % SECTION_TEXT_HUES.length]!;
      }
      const num = level === 2 && wantToc ? ++h2Index : null;
      // scroll-margin-top: chừa chỗ cho thanh tiêu đề dính trên cùng, nếu
      // không thì nhảy tới neo sẽ để tiêu đề nằm khuất dưới thanh đó.
      if (level === 2) {
        const badge = num
          ? `<span style="display:inline-flex;align-items:center;justify-content:center;` +
            `min-width:2rem;height:2rem;border-radius:.5rem;background:rgba(${hue},.16);` +
            `color:rgb(${textHue});font-size:1.1rem;font-weight:700;flex:none">${num}</span>`
          : "";
        out.push(
          `<h2 id="${id}" style="font-size:${size};margin:2.4rem 0 .9rem;scroll-margin-top:5rem;` +
            `display:flex;align-items:center;gap:.65rem;padding-bottom:.45rem;` +
            `border-bottom:2px solid rgba(${hue},.38);color:rgb(${textHue})">` +
            `${badge}<span>${inline(text)}</span></h2>`,
        );
      } else {
        // Cấp 3 nhận cùng màu với mục cha, đánh dấu bằng một vạch dọc ngắn —
        // đủ để mắt biết nó thuộc về mục nào khi lướt, không cần thêm khung.
        // "Nhóm 3–4 người (20 phút)" → tên ở tiêu đề, thời lượng thành thẻ
        // nhỏ bên cạnh: phần luyện tập nhìn ra ngay là mất bao lâu.
        const timed = /^(.*?)\s*\(([^)]*(?:phút|giờ)[^)]*)\)\s*$/.exec(text);
        const name = timed ? timed[1]! : text;
        const chip = timed
          ? `<span style="display:inline-block;margin-left:.55rem;padding:.1rem .55rem;border-radius:999px;` +
            `background:rgba(${hue},.14);color:rgb(${hue});font-size:${CAPTION};font-weight:600;` +
            `vertical-align:middle">${esc(timed[2]!)}</span>`
          : "";
        out.push(
          `<h${level} id="${id}" style="font-size:${size};margin:1.5rem 0 .4rem;scroll-margin-top:5rem;` +
            `border-left:3px solid rgba(${hue},.55);padding-left:.6rem;color:rgb(${textHue})">` +
            `${inline(name)}${chip}</h${level}>`,
        );
      }
      i++;
      continue;
    }

    if (t.startsWith("> ")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("> ")) {
        quote.push(lines[i]!.trim().slice(2));
        i++;
      }
      const tag = /^\[!([a-z-]+)\]\s*(.*)$/.exec(quote[0] ?? "");
      if (tag && CALLOUTS[tag[1]!]) {
        const body = [tag[2] ?? "", ...quote.slice(1)].filter((x) => x.trim() !== "");
        out.push(calloutBox(tag[1]!, inline(body.join(" "))));
        continue;
      }
      out.push(
        `<blockquote style="margin:1rem 0;padding:.6rem .9rem;border-left:4px solid rgba(${hue},.5);` +
          `background:rgba(${hue},.06);border-radius:0 .35rem .35rem 0;font-size:${TEXT};line-height:1.8">` +
          `${inline(quote.join(" "))}</blockquote>`,
      );
      continue;
    }

    if (t.startsWith("| ")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith("|")) {
        const cells = lines[i]!.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      const [head, ...body] = rows;
      out.push(
        `<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;margin:.7rem 0">` +
          `<thead><tr>${(head ?? []).map((c) => `<th style="${th()}">${inline(c)}</th>`).join("")}</tr></thead>` +
          `<tbody>${body.map((r) => `<tr>${r.map((c) => `<td style="${td}">${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody>` +
          `</table></div>`,
      );
      continue;
    }

    if (/^[-*]\s+/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i]!.trim())) {
        items.push(lines[i]!.trim().replace(/^[-*]\s+/, ""));
        i++;
      }
      flushList(false, items);
      continue;
    }

    if (/^\d+\.\s+/.test(t)) {
      const items: string[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i]!.trim())) {
        items.push(lines[i]!.trim().replace(/^\d+\.\s+/, ""));
        i++;
      }
      flushList(true, items);
      continue;
    }

    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() !== "" && !/^(#{2,4}\s|[-*]\s|\d+\.\s|\||>\s|---$|!\[|```)/.test(lines[i]!.trim())) {
      para.push(lines[i]!.trim());
      i++;
    }
    out.push(`<p style="${p}">${inline(para.join(" "))}</p>`);
  }

  // Tổng kết chèn ngay trước mục luyện tập; bài nào không theo quy ước đó thì
  // đặt cuối. Chèn trước khi dựng mục lục để chỉ số `at` còn đúng.
  if (opts.beforeLastSection) {
    const last = [...headings].reverse().find((h) => h.text.startsWith("Luyện tập"));
    if (last) out.splice(last.at, 0, opts.beforeLastSection);
    else out.push(opts.beforeLastSection);
  }

  // Mục lục dựng sau cùng vì phải biết hết tiêu đề mới xếp được, rồi chèn lên
  // đầu. `toc` để trống thì tự quyết theo số mục.
  if (wantToc) {
    const items = headings
      .map((h, idx) => {
        const c = SECTION_HUES[idx % SECTION_HUES.length]!;
        const ct = SECTION_TEXT_HUES[idx % SECTION_TEXT_HUES.length]!;
        return (
          `<li style="margin:.35rem 0;break-inside:avoid;display:flex;align-items:center;gap:.55rem">` +
          `<span style="display:inline-flex;align-items:center;justify-content:center;min-width:1.6rem;` +
          `height:1.6rem;border-radius:.4rem;background:rgba(${c},.16);color:rgb(${ct});` +
          `font-size:.95rem;font-weight:700;flex:none">${idx + 1}</span>` +
          `<a href="#${h.id}" style="text-decoration:none">${inline(h.text)}</a></li>`
        );
      })
      .join("");
    out.unshift(
      `<nav aria-label="Mục lục bài học" style="border:1px solid ${RULE};border-radius:.6rem;` +
        `padding:.9rem 1.1rem;margin:0 0 1.4rem">` +
        `<div style="font-size:${CAPTION};font-weight:600;color:${MUTED};letter-spacing:.04em;` +
        `text-transform:uppercase;margin:0 0 .5rem">Trong bài này</div>` +
        `<ol style="margin:0;padding:0;list-style:none;font-size:${TEXT};line-height:1.6;` +
        `column-width:19rem;column-gap:2rem">${items}</ol>` +
        `</nav>`,
    );
  }

  return out.join("");
}

/**
 * Khối "Học xong bài này, bạn có thể…" đặt trên cùng, trước mục lục: người học
 * cần biết bài này để làm gì trước khi quyết định đọc tiếp.
 */
function objectivesBox(items: string[]): string {
  const lis = items
    .map((it) => `<li style="margin:.3rem 0">${inline(it)}</li>`)
    .join("");
  return (
    `<section aria-label="Mục tiêu bài học" style="border-left:4px solid rgba(59,130,246,.55);` +
    `background:rgba(59,130,246,.06);border-radius:.35rem;padding:.9rem 1.1rem;margin:0 0 1.3rem">` +
    `<div style="font-size:${CAPTION};font-weight:600;color:${MUTED};letter-spacing:.04em;` +
    `text-transform:uppercase;margin:0 0 .35rem">Mục tiêu bài học</div>` +
    `<p style="margin:0 0 .5rem;font-size:${TEXT};line-height:1.7">Học xong bài này, bạn có thể:</p>` +
    `<ul style="margin:0;padding-left:1.3rem;font-size:${TEXT};line-height:1.7">${lis}</ul>` +
    `</section>`
  );
}

/**
 * Hộp chú giải có nhãn. Viết trong `body` bằng cú pháp:
 *
 *   > [!ghi-nho] **Quy tắc nhớ nhanh**
 *   > UX quyết định chuyện gì xảy ra…
 *
 * Bốn loại đủ cho một bài giảng: điều phải nhớ, ví dụ, bẫy thường gặp, mẹo làm.
 * Màu ở đây mang NGHĨA nên cố định theo loại, không đổi theo màu của mục —
 * người học nhìn màu là biết đang đọc loại thông tin nào.
 */
const CALLOUTS: Record<string, { label: string; hue: string }> = {
  "ghi-nho": { label: "Ghi nhớ", hue: "59,130,246" },
  "vi-du": { label: "Ví dụ", hue: "13,148,136" },
  "canh-bao": { label: "Bẫy thường gặp", hue: "217,150,40" },
  "meo": { label: "Mẹo thực hành", hue: "139,92,246" },
};

function calloutBox(kind: string, inner: string): string {
  const c = CALLOUTS[kind]!;
  return (
    `<aside style="border-left:4px solid rgba(${c.hue},.6);background:rgba(${c.hue},.07);` +
    `border-radius:0 .45rem .45rem 0;padding:.8rem 1rem;margin:1.1rem 0">` +
    `<div style="font-size:${CAPTION};font-weight:700;letter-spacing:.04em;text-transform:uppercase;` +
    `color:rgb(${c.hue});margin:0 0 .3rem">${c.label}</div>` +
    `<div style="font-size:${TEXT};line-height:1.8">${inner}</div></aside>`
  );
}

/**
 * Dải thông tin đầu bài: đọc mất bao lâu, có mấy phần, mấy câu ôn tập.
 * Người học biết trước mình đang bước vào cái gì thì mới cân được thời gian —
 * đây là thứ rẻ nhất mà một trang bài giảng có thể cho họ.
 */
function metaBar(chips: string[]): string {
  const items = chips
    .map(
      (t) =>
        `<span style="display:inline-block;padding:.2rem .6rem;border-radius:999px;` +
        `border:1px solid ${RULE};font-size:${CAPTION};color:${MUTED}">${esc(t)}</span>`,
    )
    .join("");
  return `<div style="display:flex;flex-wrap:wrap;gap:.45rem;margin:0 0 1rem">${items}</div>`;
}

/** Khối "Tổng kết" — cùng thang với khối mục tiêu, khác màu để phân biệt. */
function summaryBox(items: string[]): string {
  const lis = items.map((it) => `<li style="margin:.3rem 0">${inline(it)}</li>`).join("");
  return (
    `<section aria-label="Tổng kết bài học" style="border-left:4px solid rgba(34,139,110,.55);` +
    `background:rgba(34,139,110,.06);border-radius:.35rem;padding:.9rem 1.1rem;margin:1.6rem 0 1.3rem">` +
    `<div style="font-size:${CAPTION};font-weight:600;color:${MUTED};letter-spacing:.04em;` +
    `text-transform:uppercase;margin:0 0 .35rem">Tổng kết</div>` +
    `<ul style="margin:0;padding-left:1.3rem;font-size:${TEXT};line-height:1.7">${lis}</ul>` +
    `</section>`
  );
}

/** Bảng mẫu câu / cách đọc — cột chữ Hán cùng cỡ với bảng từ vựng. */
export function patternTable(p: PatternsSpec): string {
  const th = `padding:.45rem .6rem;text-align:left;font-size:.9rem;font-weight:600;color:${MUTED};border-bottom:1px solid ${RULE}`;
  const td = `padding:.55rem .6rem;border-bottom:1px solid ${RULE};vertical-align:middle`;
  const rows = p.rows
    .map(
      (r) =>
        `<tr>` +
        `<td style="${td};font-size:${ZH_SIZE_TABLE};line-height:1.55">${esc(r.zh)}</td>` +
        `<td style="${td};font-size:${SUB_SIZE}">${esc(r.vi)}</td>` +
        `</tr>`,
    )
    .join("");
  return (
    (p.heading ? `<h2 style="font-size:1.35rem;margin:0 0 .5rem">${esc(p.heading)}</h2>` : "") +
    (p.note ? `<p style="color:${MUTED};margin:0 0 .75rem">${esc(p.note)}</p>` : "") +
    `<div style="overflow-x:auto">` +
    `<table style="width:100%;border-collapse:collapse;margin:0">` +
    `<thead><tr><th style="${th}">Mẫu</th><th style="${th}">Nghĩa</th></tr></thead>` +
    `<tbody>${rows}</tbody></table></div>`
  );
}

/**
 * Hội thoại: mỗi lượt lời là một khối có vạch dọc bên trái, tên vai nhỏ ở
 * trên, câu tiếng Trung cỡ lớn, rồi pinyin và bản dịch. Đọc theo chiều dọc
 * chứ không phải một dải chữ chạy liền như khi viết bằng markdown.
 */
export function renderDialogue(d: DialogueSpec): string {
  const turns = d.turns
    .map(
      (t) =>
        `<div style="border-left:3px solid ${RULE};padding:.1rem 0 .1rem .9rem;margin:0 0 1.15rem">` +
        `<div style="font-size:.9rem;font-weight:600;color:${MUTED};margin:0 0 .2rem">${esc(t.speaker)}</div>` +
        `<p style="font-size:${ZH_SIZE};line-height:1.65;margin:0">${esc(t.zh)}</p>` +
        (t.pinyin
          ? `<p style="font-size:${SUB_SIZE};font-style:italic;color:${MUTED};margin:.2rem 0 0">${esc(t.pinyin)}</p>`
          : "") +
        (t.vi
          ? `<p style="font-size:${SUB_SIZE};margin:.15rem 0 0">${esc(t.vi)}</p>`
          : "") +
        `</div>`,
    )
    .join("");
  return (
    (d.heading ? `<h2 style="font-size:1.35rem;margin:0 0 .5rem">${esc(d.heading)}</h2>` : "") +
    (d.scene
      ? `<p style="font-style:italic;color:${MUTED};margin:0 0 1rem">${esc(d.scene)}</p>`
      : "") +
    turns
  );
}

/**
 * Ghi FeedbackTemplate bằng SQL thô chứ không qua Prisma.
 *
 * Nhánh này có migration B9 thêm cột `level` / `elaboration` vào
 * FeedbackTemplate, nhưng production CHƯA áp migration đó (prod đang đứng ở
 * 20260827033000). `prisma.feedbackTemplate.create()` đọc lại mọi cột trong
 * schema sau khi ghi, nên trên prod sẽ vỡ với "column level does not exist".
 * Câu SQL dưới đây chỉ đụng các cột có ở CẢ HAI nơi.
 *
 * Xoá hàm này, quay lại dùng Prisma, sau khi B9 lên prod.
 */
async function upsertFeedbackTemplate(
  misconceptionId: string | null,
  body: string,
  priority: number,
): Promise<void> {
  const existing = misconceptionId
    ? await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "FeedbackTemplate"
        WHERE scope = 'per_misconception'::"FeedbackTemplateScope"
          AND "misconceptionId" = ${misconceptionId} LIMIT 1`
    : await prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "FeedbackTemplate"
        WHERE scope = 'generic'::"FeedbackTemplateScope" LIMIT 1`;

  if (existing.length > 0) {
    await prisma.$executeRaw`
      UPDATE "FeedbackTemplate" SET body = ${body}, priority = ${priority}
      WHERE id = ${existing[0]!.id}`;
    return;
  }

  const scope = misconceptionId ? "per_misconception" : "generic";
  await prisma.$executeRaw`
    INSERT INTO "FeedbackTemplate" (id, scope, "misconceptionId", "skillId", body, priority, "createdAt")
    VALUES (gen_random_uuid()::text, ${scope}::"FeedbackTemplateScope", ${misconceptionId}, NULL, ${body}, ${priority}, NOW())`;
}

/**
 * Các khối nội dung của một bài, theo đúng thứ tự mà importer tạo ra.
 * `update-lesson.ts` dựng lại đúng danh sách này rồi so với những gì đang có
 * trong DB — nên hai đường không thể lệch nhau về cách render.
 */
export const MAX_TOC_ITEMS = 5;

/** Số tiêu đề cấp 2 trong thân bài — cũng chính là số dòng của mục lục. */
export function countSections(body: string | undefined): number {
  return (body ?? "").split("\n").filter((l) => /^## \S/.test(l.trim())).length;
}

/**
 * Thứ tự các khối của một bài học.
 *
 * Mục tiêu LUÔN đứng đầu, tổng kết LUÔN đứng cuối — kể cả khi bài có bảng từ
 * vựng, hội thoại hay bảng mẫu câu chen giữa. Người học phải biết mình sắp
 * học gì trước khi đọc bất cứ thứ gì khác, và câu chốt lại phải là thứ cuối
 * cùng họ nhìn thấy. Trước đây hai khối này bị gói chung vào khối thân bài
 * nên rơi xuống giữa trang ở những bài mở đầu bằng bảng từ vựng.
 */
export function renderLessonBlocks(l: z.infer<typeof LessonSpec>): string[] {
  const blocks: string[] = [];

  // ~200 từ/phút cho văn xuôi tiếng Việt; làm tròn lên phút gần nhất.
  const words = (l.body ?? "").split(/\s+/).filter(Boolean).length;
  const chips: string[] = [];
  if (words > 0) chips.push(`~${Math.max(1, Math.round(words / 200))} phút đọc`);
  const sectionCount = countSections(l.body);
  if (sectionCount > 0) chips.push(`${sectionCount} phần`);
  if (l.quiz?.questions.length) chips.push(`${l.quiz.questions.length} câu ôn tập`);

  const head =
    (chips.length > 1 ? metaBar(chips) : "") +
    (l.objectives?.length ? objectivesBox(l.objectives) : "");
  if (head) blocks.push(head);

  if (l.vocab?.length) blocks.push(vocabTable(l.vocab));
  if (l.dialogue) blocks.push(renderDialogue(l.dialogue));
  if (l.patterns) blocks.push(patternTable(l.patterns));
  if (l.body) blocks.push(markdownToHtml(l.body, { toc: l.toc }));

  if (l.summary?.length) blocks.push(summaryBox(l.summary));
  return blocks;
}

// ── Chạy ──────────────────────────────────────────────────────────────────────

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * `pnpm import:course` chạy với thư mục hiện hành là packages/core-lms chứ
 * không phải gốc repo, nên đường dẫn kiểu `docs/hoc-lieu/bai-22.json` gõ từ
 * gốc repo sẽ không tìm thấy. Thử lần lượt: đúng như gõ → so với gốc repo.
 */
export function resolveManifest(p: string): string {
  if (existsSync(p)) return p;
  const fromRepoRoot = resolve(import.meta.dirname, "../../..", p);
  if (existsSync(fromRepoRoot)) return fromRepoRoot;
  return p; // để readFileSync ném lỗi với đường dẫn người dùng đã gõ
}

async function main() {
  const file = arg("file");
  const ownerEmail = arg("owner");
  const dryRun = process.argv.includes("--dry-run");
  const replace = process.argv.includes("--replace");
  const into = arg("into");
  let replaceCourseId: string | null = null;
  let carriedInstructors: Array<{ userId: string; role: string }> = [];

  if (!file || !ownerEmail) {
    console.error(
      "Thiếu tham số.\n" +
        "  --file <đường-dẫn.json>   file học liệu\n" +
        "  --owner <email>           tài khoản giảng viên sở hữu khoá\n" +
        "  --into <courseId>         nối module vào khoá đã có (thay vì tạo mới)\n" +
        "  --replace                 xoá khoá cùng slug rồi nhập lại (chỉ khi draft + 0 học viên)\n" +
        "  --dry-run                 chỉ kiểm tra, không ghi",
    );
    process.exitCode = 1;
    return;
  }

  const parsed = Manifest.safeParse(JSON.parse(readFileSync(resolveManifest(file), "utf8")));
  if (!parsed.success) {
    console.error("File học liệu sai định dạng:");
    console.error(JSON.stringify(parsed.error.flatten(), null, 2));
    process.exitCode = 1;
    return;
  }
  const manifest = parsed.data;

  // Kiểm mọi câu hỏi TRƯỚC khi ghi dòng nào. Một câu sai ở bài cuối mà chỉ vỡ
  // lúc đang ghi thì để lại khoá dở dang trên production.
  const problems: string[] = [];
  const declaredMc = new Set((manifest.misconceptions ?? []).map((m) => m.code));
  for (const t of manifest.feedbackTemplates ?? []) {
    if (t.misconception && !declaredMc.has(t.misconception)) {
      problems.push(
        `feedbackTemplates: mã lỗi "${t.misconception}" chưa khai báo ở mục misconceptions`,
      );
    }
  }
  const warnings: string[] = [];
  let questionCount = 0;
  for (const [mi, m] of manifest.modules.entries()) {
    for (const [li, l] of m.lessons.entries()) {
      if (!l.body && !l.vocab?.length && !l.dialogue && !l.patterns && !l.quiz) {
        problems.push(`module ${mi + 1} / bài ${li + 1} "${l.title}": rỗng — không có nội dung lẫn quiz`);
      }
      const sections = countSections(l.body);
      if (sections > MAX_TOC_ITEMS) {
        warnings.push(
          `module ${mi + 1} / bài ${li + 1} "${l.title}": ${sections} mục cấp 2 — mục lục quá dài, gộp lại còn ${MAX_TOC_ITEMS}`,
        );
      }
      for (const [qi, q] of (l.quiz?.questions ?? []).entries()) {
        questionCount += 1;
        for (const o of q.options ?? []) {
          if (!o.misconception) continue;
          if (!declaredMc.has(o.misconception)) {
            problems.push(
              `module ${mi + 1} / bài ${li + 1} / câu ${qi + 1}: mã lỗi "${o.misconception}" chưa khai báo`,
            );
          }
          // Lỗi tư duy mô tả vì sao học viên chọn SAI. Gắn vào đáp án đúng thì
          // Feedback Engine không bao giờ đọc tới, mà cũng sai về mặt ý nghĩa.
          if (o.isCorrect) {
            problems.push(
              `module ${mi + 1} / bài ${li + 1} / câu ${qi + 1}: gắn lỗi tư duy vào phương án ĐÚNG ("${o.label}")`,
            );
          }
        }
        const check = CreateQuestionInput.safeParse(expandQuestion(q, qi));
        if (!check.success) {
          const msg = check.error.issues.map((i) => i.message).join("; ");
          problems.push(`module ${mi + 1} / bài ${li + 1} / câu ${qi + 1} (${q.type}): ${msg}`);
        }
      }
    }
  }

  const owner = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true, displayName: true },
  });
  if (!owner) problems.push(`Không có tài khoản nào với email ${ownerEmail}`);

  let target: { id: string; slug: string; title: string; nextModuleIndex: number } | null = null;
  if (into) {
    const existing = await prisma.course.findUnique({
      where: { id: into },
      select: { id: true, slug: true, title: true },
    });
    if (!existing) {
      problems.push(`Không có khoá nào với id ${into}`);
    } else {
      const max = await prisma.module.aggregate({
        where: { courseId: existing.id },
        _max: { orderIndex: true },
      });
      target = { ...existing, nextModuleIndex: (max._max.orderIndex ?? -1) + 1 };
    }
  } else if (manifest.course.slug) {
    const taken = await prisma.course.findUnique({
      where: { slug: manifest.course.slug },
      select: {
        id: true,
        title: true,
        status: true,
        _count: { select: { enrollments: true } },
      },
    });
    if (taken && replace) {
      // Chỉ cho xoá khoá còn nháp và chưa có ai ghi danh. Khoá đang chạy thật
      // thì mọi thứ treo vào nó — tiến độ, điểm, XP — không xoá bằng một cờ
      // dòng lệnh được.
      if (taken.status !== "draft") {
        problems.push(`--replace: khoá "${taken.title}" đang ở trạng thái ${taken.status}, không phải draft`);
      }
      if (taken._count.enrollments > 0) {
        problems.push(`--replace: khoá "${taken.title}" đã có ${taken._count.enrollments} học viên ghi danh`);
      }
      if (problems.length === 0) replaceCourseId = taken.id;
    } else if (taken) {
      problems.push(
        `slug "${manifest.course.slug}" đã thuộc về khoá "${taken.title}" (${taken.id}) — dùng --into ${taken.id} để nối thêm, hoặc --replace để nhập đè`,
      );
    }
  }

  const lessonCount = manifest.modules.reduce((s, m) => s + m.lessons.length, 0);
  console.log(
    `${target ? `${target.title} (nối thêm vào khoá đã có)` : manifest.course.title}\n` +
      `  ${manifest.modules.length} module · ${lessonCount} bài học · ${questionCount} câu hỏi\n` +
      `  ${(manifest.misconceptions ?? []).length} lỗi tư duy · ${(manifest.feedbackTemplates ?? []).length} mẫu phản hồi\n` +
      `  chủ sở hữu: ${ownerEmail}${owner ? ` (${owner.displayName})` : ""}\n`,
  );
  for (const m of manifest.modules) {
    console.log(`  ▸ ${m.title}`);
    for (const l of m.lessons) {
      const bits = [
        l.vocab?.length ? `${l.vocab.length} từ` : null,
        l.dialogue ? `hội thoại ${l.dialogue.turns.length} lượt` : null,
        l.patterns ? `bảng mẫu ${l.patterns.rows.length} dòng` : null,
        l.body ? "nội dung" : null,
        l.quiz ? `quiz ${l.quiz.questions.length} câu` : null,
      ].filter(Boolean);
      console.log(`      · ${l.title} — ${bits.join(", ") || "trống"}`);
    }
  }

  if (warnings.length > 0) {
    console.warn(`\n${warnings.length} cảnh báo (không chặn nhập):`);
    for (const w of warnings) console.warn(`  ! ${w}`);
  }

  if (problems.length > 0) {
    console.error(`\n${problems.length} vấn đề phải sửa trước khi nhập:`);
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exitCode = 1;
    return;
  }

  if (dryRun) {
    console.log("\n[dry-run] Manifest hợp lệ. Không ghi gì.");
    return;
  }

  // ── Ghi ─────────────────────────────────────────────────────────────────────
  const actor = owner!.id;

  if (replaceCourseId) {
    // Giữ lại danh sách giảng viên: xoá khoá là xoá luôn CourseInstructor, mà
    // đồng giảng viên thường do người khác thêm qua UI — nhập lại học liệu
    // không có lý gì tước quyền của họ.
    carriedInstructors = await prisma.courseInstructor.findMany({
      where: { courseId: replaceCourseId, userId: { not: actor } },
      select: { userId: true, role: true },
    });

    // Xoá chủ đề tự sinh trước: Course xoá theo kiểu cascade sẽ cuốn Lesson đi
    // mà không đi qua deleteLesson, để lại Skill `lesson.*` mồ côi trong DB.
    const lessons = await prisma.lesson.findMany({
      where: { module: { courseId: replaceCourseId } },
      select: { id: true },
    });
    const codes = lessons.map((l) => lessonSkillCode(l.id));
    const removed = await prisma.skill.deleteMany({ where: { code: { in: codes } } });
    await prisma.course.delete({ where: { id: replaceCourseId } });
    console.log(
      `\n✔ Đã xoá khoá cũ (${lessons.length} bài, ${removed.count} chủ đề tự sinh` +
        (carriedInstructors.length > 0
          ? `, giữ lại ${carriedInstructors.length} giảng viên để gắn lại)`
          : ")"),
    );
  }

  // Lỗi tư duy + mẫu phản hồi dùng chung cho cả giáo trình chứ không thuộc
  // riêng khoá nào — upsert theo `code` để chạy lại không đẻ bản sao.
  const mcIds = new Map<string, string>();
  for (const m of manifest.misconceptions ?? []) {
    const row = await prisma.misconception.upsert({
      where: { code: m.code },
      update: { name: m.name, description: m.description },
      create: { code: m.code, name: m.name, description: m.description },
      select: { id: true },
    });
    mcIds.set(m.code, row.id);
  }
  if (mcIds.size > 0) console.log(`\n✔ ${mcIds.size} lỗi tư duy`);

  for (const t of manifest.feedbackTemplates ?? []) {
    await upsertFeedbackTemplate(
      t.misconception ? mcIds.get(t.misconception)! : null,
      t.body,
      t.priority ?? 100,
    );
  }
  if ((manifest.feedbackTemplates ?? []).length > 0) {
    console.log(`✔ ${(manifest.feedbackTemplates ?? []).length} mẫu phản hồi`);
  }

  const course = target
    ? { courseId: target.id, slug: target.slug }
    : await createCourse(actor, manifest.course);
  const moduleOffset = target?.nextModuleIndex ?? 0;

  if (carriedInstructors.length > 0) {
    await prisma.courseInstructor.createMany({
      data: carriedInstructors.map((ci) => ({
        courseId: course.courseId,
        userId: ci.userId,
        role: ci.role,
      })),
      skipDuplicates: true,
    });
    console.log(`✔ Gắn lại ${carriedInstructors.length} giảng viên của khoá cũ`);
  }
  console.log(
    target
      ? `\n✔ Nối vào khoá: ${course.slug} — ${course.courseId} (module bắt đầu từ ${moduleOffset})`
      : `\n✔ Khoá (draft): ${course.slug} — ${course.courseId}`,
  );

  for (const [mi, m] of manifest.modules.entries()) {
    const { moduleId } = await createModule(actor, course.courseId, {
      title: m.title,
      description: m.description,
      orderIndex: moduleOffset + mi,
    });

    for (const [li, l] of m.lessons.entries()) {
      const { lessonId } = await createLesson(actor, moduleId, {
        title: l.title,
        description: l.description,
        orderIndex: li,
      });

      // Soạn bằng markdown nhưng lưu thành richtext: markdown render ở cỡ chữ
      // nền 14px cho cả khối, không tách được chữ Hán ra để phóng to.
      for (const [ci, html] of renderLessonBlocks(l).entries()) {
        await createContentItem(actor, lessonId, {
          type: "richtext",
          orderIndex: ci,
          payload: { html },
        });
      }

      if (l.quiz) {
        const { quizId } = await createQuiz(
          actor,
          { courseId: course.courseId, lessonId },
          {
            title: l.quiz.title,
            passThresholdPct: l.quiz.passThresholdPct,
            requireConfidence: l.quiz.requireConfidence,
            timeLimitSec: l.quiz.timeLimitSec,
            maxAttempts: l.quiz.maxAttempts,
          },
        );
        for (const [qi, q] of l.quiz.questions.entries()) {
          await createQuestion(actor, quizId, expandQuestion(q, qi, mcIds));
        }
      }

      console.log(`  ✔ ${m.title} / ${l.title}`);
    }
  }

  console.log(
    `\nXong. Khoá đang ở trạng thái NHÁP — xem lại rồi tự bấm Publish:\n` +
      `  /instructor/courses/${course.courseId}?tab=content`,
  );
}

// Chỉ chạy khi được gọi thẳng từ dòng lệnh: file này còn được
// `update-lesson.ts` import để dùng lại bộ render.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
    .catch((err) => {
      console.error(err);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
