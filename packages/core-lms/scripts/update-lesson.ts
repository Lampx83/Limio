/**
 * Cập nhật MỘT bài học đã nằm trên hệ thống từ file học liệu, mà không đụng
 * tới phần còn lại của khoá.
 *
 * `import-course.ts --replace` chỉ dùng được khi khoá còn nháp và chưa có ai
 * ghi danh. Sau khi khoá đã publish, sửa một bài mà phải xoá cả khoá là
 * không chấp nhận được: tiến độ, điểm, XP của học viên treo vào đó. Script
 * này đi đường nhỏ hơn — dựng lại đúng các khối nội dung của bài từ manifest,
 * so với những gì đang có, rồi chỉ ghi phần khác nhau.
 *
 *   pnpm update:lesson -- --file ./hoc-lieu.json --owner gv@example.com --lesson "Bài 1.1" --dry-run
 *   pnpm update:lesson:prod -- --file ./hoc-lieu.json --owner gv@example.com --lesson "Bài 1.1"
 *
 * Nguyên tắc: **thêm và sửa, không xoá.** Khối nội dung hay câu hỏi có trên
 * hệ thống mà không có trong manifest chỉ được báo ra, không tự gỡ — xoá
 * nhầm một câu hỏi đã có lượt làm là mất dữ liệu thật.
 *
 * Câu hỏi của một quiz ĐÃ CÓ lượt làm thì mặc định không được sửa (thêm câu
 * mới vẫn được): đổi đề bài dưới chân người đã nộp làm hỏng chính dữ liệu
 * dùng để đánh giá bài học. Cần sửa thật thì truyền `--force`.
 */

import { readFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { createContentItem, updateContentItem } from "../src/courses/contents";
import { createLesson, updateLesson } from "../src/courses/lessons";
import { createQuiz, updateQuiz } from "../src/quizzes/quizzes";
import { createQuestion, updateQuestion } from "../src/quizzes/questions";

import {
  MAX_TOC_ITEMS,
  Manifest,
  countSections,
  expandQuestion,
  renderLessonBlocks,
  resolveManifest,
} from "./import-course";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

/**
 * Câu mở đầu của đề bài, đã bỏ thẻ HTML.
 *
 * Dùng để nhận ra một câu hỏi vừa được thêm hình minh hoạ hoặc sửa cách trình
 * bày: phần chữ mở đầu gần như luôn giữ nguyên, trong khi cả chuỗi đề bài thì
 * đổi hoàn toàn. Chỉ dùng khi manifest có khai báo `key` — tức là người soạn
 * đã nói rõ "đây là câu tôi sẽ còn sửa".
 */
function openingText(prompt: string): string {
  return prompt
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .toLowerCase();
}

/** So sánh nội dung câu hỏi ở mức người soạn quan tâm, bỏ qua id và thứ tự option. */
function questionShape(q: Record<string, unknown>): string {
  const opts = (q.options as Array<Record<string, unknown>> | undefined) ?? [];
  return JSON.stringify({
    prompt: String(q.prompt ?? "").trim(),
    explanation: (q.explanation as string | undefined)?.trim() ?? "",
    points: q.points ?? 1,
    options: opts.map((o) => ({
      label: String(o.label ?? "").trim(),
      isCorrect: Boolean(o.isCorrect),
      extra: o.extra ?? null,
    })),
  });
}

async function main() {
  const file = arg("file");
  const ownerEmail = arg("owner");
  const lessonKey = arg("lesson");
  const slug = arg("course");
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const allowCreate = process.argv.includes("--create");

  if (!file || !ownerEmail || !lessonKey) {
    console.error(
      "Thiếu tham số.\n" +
        "  --file <đường-dẫn.json>   file học liệu\n" +
        "  --owner <email>           tài khoản có quyền sửa khoá\n" +
        "  --lesson <chuỗi>          một phần tiêu đề bài, phải khớp đúng 1 bài\n" +
        "  --course <slug>           slug khoá (mặc định lấy trong manifest)\n" +
        "  --create                  tạo bài mới nếu khoá chưa có (xếp cuối module tương ứng)\n" +
        "  --force                   cho phép sửa câu hỏi của quiz đã có lượt làm\n" +
        "  --dry-run                 chỉ in ra sẽ đổi gì, không ghi",
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

  const specs = manifest.modules.flatMap((m) => m.lessons).filter((l) => l.title.includes(lessonKey));
  if (specs.length !== 1) {
    console.error(
      specs.length === 0
        ? `Không có bài nào trong manifest khớp "${lessonKey}"`
        : `"${lessonKey}" khớp ${specs.length} bài: ${specs.map((l) => l.title).join(" | ")}`,
    );
    process.exitCode = 1;
    return;
  }
  const spec = specs[0]!;

  const courseSlug = slug ?? manifest.course.slug;
  if (!courseSlug) {
    console.error("Manifest không có slug, phải truyền --course <slug>");
    process.exitCode = 1;
    return;
  }

  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (!owner) {
    console.error(`Không có tài khoản nào với email ${ownerEmail}`);
    process.exitCode = 1;
    return;
  }

  const course = await prisma.course.findUnique({
    where: { slug: courseSlug },
    select: { id: true, title: true, status: true },
  });
  if (!course) {
    console.error(`Không có khoá nào với slug ${courseSlug}`);
    process.exitCode = 1;
    return;
  }

  // Manifest đã nói bài này thuộc module nào, nên tra trong đúng module đó.
  // Tìm khắp khoá thì một giáo trình có nhiều bài trùng tên (mỗi 课 đều có một
  // bài "练习") sẽ luôn báo nhập nhằng, dù thật ra không hề mơ hồ.
  const moduleOfSpec = manifest.modules.find((m) => m.lessons.includes(spec))!;
  const lessons = await prisma.lesson.findMany({
    where: {
      module: { courseId: course.id, title: moduleOfSpec.title },
      title: { contains: lessonKey },
    },
    select: {
      id: true,
      title: true,
      description: true,
      durationSec: true,
      contentItems: { select: { id: true, type: true, payload: true, orderIndex: true }, orderBy: { orderIndex: "asc" } },
      quizzes: {
        select: {
          id: true,
          title: true,
          passThresholdPct: true,
          requireConfidence: true,
          timeLimitSec: true,
          maxAttempts: true,
          _count: { select: { attempts: true } },
          questions: {
            select: {
              id: true,
              prompt: true,
              explanation: true,
              points: true,
              orderIndex: true,
              type: true,
              extra: true,
              options: { select: { label: true, isCorrect: true, extra: true }, orderBy: { orderIndex: "asc" } },
            },
            orderBy: { orderIndex: "asc" },
          },
        },
      },
    },
  });
  if (lessons.length > 1) {
    console.error(
      `"${lessonKey}" khớp ${lessons.length} bài trên hệ thống: ${lessons.map((l) => l.title).join(" | ")}`,
    );
    process.exitCode = 1;
    return;
  }

  // ── Bài chưa có trên hệ thống ───────────────────────────────────────────────
  // Tạo mới phải xin phép bằng cờ --create: gõ nhầm tên bài mà script lặng lẽ
  // tạo thêm một bài trùng nội dung thì còn tệ hơn là báo lỗi.
  if (lessons.length === 0) {
    if (!allowCreate) {
      console.error(
        `Khoá "${course.title}" chưa có bài nào khớp "${lessonKey}".\n` +
          `Thêm --create nếu thật sự muốn tạo bài mới.`,
      );
      process.exitCode = 1;
      return;
    }
    const mod = await prisma.module.findFirst({
      where: { courseId: course.id, title: moduleOfSpec.title },
      select: { id: true, title: true, lessons: { select: { orderIndex: true } } },
    });
    if (!mod) {
      console.error(`Khoá chưa có module "${moduleOfSpec.title}" — script này không tạo module mới.`);
      process.exitCode = 1;
      return;
    }
    const orderIndex = Math.max(-1, ...mod.lessons.map((l) => l.orderIndex)) + 1;
    const blocks = renderLessonBlocks(spec);
    console.log(
      `  + BÀI MỚI trong "${mod.title}" (vị trí ${orderIndex + 1}): ${spec.title}\n` +
        `    ${blocks.length} khối nội dung · ${spec.quiz?.questions.length ?? 0} câu hỏi`,
    );
    if (dryRun) {
      console.log("\n[dry-run] Không ghi gì.");
      return;
    }
    const { lessonId } = await createLesson(owner.id, mod.id, {
      title: spec.title,
      description: spec.description,
      orderIndex,
    });
    for (const [ci, html] of blocks.entries()) {
      await createContentItem(owner.id, lessonId, {
        type: "richtext",
        orderIndex: ci,
        payload: { html },
      });
    }
    if (spec.quiz) {
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
      const { quizId } = await createQuiz(
        owner.id,
        { courseId: course.id, lessonId },
        {
          title: spec.quiz.title,
          passThresholdPct: spec.quiz.passThresholdPct,
          requireConfidence: spec.quiz.requireConfidence,
          timeLimitSec: spec.quiz.timeLimitSec,
          maxAttempts: spec.quiz.maxAttempts,
        },
      );
      for (const [qi, q] of spec.quiz.questions.entries()) {
        await createQuestion(owner.id, quizId, expandQuestion(q, qi, mcIds));
      }
    }
    console.log(`\n✔ Đã tạo bài "${spec.title}" (${lessonId}).`);
    return;
  }

  const lesson = lessons[0]!;

  console.log(`${course.title} (${course.status}) / ${lesson.title}\n`);

  const sections = countSections(spec.body);
  if (sections > MAX_TOC_ITEMS) {
    console.warn(`  ! ${sections} mục cấp 2 — mục lục quá dài, nên gộp còn ${MAX_TOC_ITEMS}\n`);
  }

  // ── Nội dung ────────────────────────────────────────────────────────────────
  const blocks = renderLessonBlocks(spec);
  const rich = lesson.contentItems.filter((c) => c.type === "richtext");
  const plan: Array<() => Promise<void>> = [];

  for (const [i, html] of blocks.entries()) {
    const existing = rich[i];
    if (!existing) {
      const orderIndex = lesson.contentItems.length + (i - rich.length);
      console.log(`  + khối nội dung mới #${i + 1} (${html.length} ký tự)`);
      plan.push(async () => {
        await createContentItem(owner.id, lesson.id, { type: "richtext", orderIndex, payload: { html } });
      });
      continue;
    }
    const before = String((existing.payload as { html?: string })?.html ?? "");
    if (before === html) {
      console.log(`  = khối #${i + 1} không đổi`);
      continue;
    }
    console.log(`  ~ khối #${i + 1}: ${before.length} → ${html.length} ký tự`);
    plan.push(async () => {
      await updateContentItem(owner.id, existing.id, { payload: { html } });
    });
  }
  for (const leftover of rich.slice(blocks.length)) {
    console.log(`  ! khối thừa trên hệ thống (id ${leftover.id}) — không tự xoá, gỡ tay nếu cần`);
  }

  if (spec.title !== lesson.title) {
    console.log(`  ~ tên bài: "${lesson.title}" → "${spec.title}"`);
    plan.push(async () => {
      await updateLesson(owner.id, lesson.id, { title: spec.title });
    });
  }

  // Thời lượng dự kiến: ghi cả vào cột `durationSec` chứ không chỉ vẽ lên đầu
  // bài — trang danh sách và phần xếp lịch học đọc cột này, không đọc HTML.
  const wantDurationSec = spec.durationMin ? spec.durationMin * 60 : null;
  if (wantDurationSec !== null && wantDurationSec !== lesson.durationSec) {
    console.log(`  ~ thời lượng: ${lesson.durationSec ?? "—"} → ${wantDurationSec} giây`);
    plan.push(async () => {
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { durationSec: wantDurationSec },
      });
    });
  }

  if (spec.description && spec.description !== lesson.description) {
    console.log(`  ~ mô tả bài học`);
    plan.push(async () => {
      await prisma.lesson.update({
        where: { id: lesson.id },
        data: { description: spec.description },
      });
    });
  }

  // ── Câu hỏi ─────────────────────────────────────────────────────────────────
  const quiz = lesson.quizzes[0];
  if (spec.quiz && quiz) {
    const attempts = quiz._count.attempts;

    // Cài đặt của quiz (thời gian, số lượt, ngưỡng đạt…) sửa được kể cả khi đã
    // có lượt làm: nó không đụng vào đề bài lẫn đáp án đã chấm. Chỉ ghi những
    // trường manifest thực sự nói tới — bỏ trống nghĩa là "giữ nguyên trên hệ
    // thống", không phải "xoá đi".
    const wanted: Record<string, unknown> = {};
    const settings = [
      ["title", spec.quiz.title],
      ["passThresholdPct", spec.quiz.passThresholdPct],
      ["requireConfidence", spec.quiz.requireConfidence],
      ["timeLimitSec", spec.quiz.timeLimitSec],
      ["maxAttempts", spec.quiz.maxAttempts],
    ] as const;
    for (const [k, v] of settings) {
      if (v === undefined) continue;
      if ((quiz as Record<string, unknown>)[k] === v) continue;
      wanted[k] = v;
      console.log(`  ~ quiz.${k}: ${String((quiz as Record<string, unknown>)[k])} → ${String(v)}`);
    }
    if (Object.keys(wanted).length > 0) {
      plan.push(async () => {
        await updateQuiz(owner.id, quiz.id, wanted);
      });
    }

    const byPrompt = new Map(quiz.questions.map((q) => [q.prompt.trim(), q]));
    const byKey = new Map(
      quiz.questions
        .map((q) => [(q.extra as { manifestKey?: string } | null)?.manifestKey, q] as const)
        .filter((e): e is [string, (typeof quiz.questions)[number]] => typeof e[0] === "string"),
    );
    const adopted = new Set<string>();

    /**
     * Nhận ra "vẫn là câu hỏi ấy" theo ba bậc:
     *   1. khoá `manifestKey` — cách duy nhất còn đúng khi đề bài đổi;
     *   2. đề bài trùng khít — dùng cho câu chưa từng đặt khoá;
     *   3. cùng loại + cùng vị trí, và hàng trên hệ thống chưa có khoá nào —
     *      bước quá độ để gắn khoá cho dữ liệu cũ mà không đẻ ra bản sao.
     * Bậc 3 chỉ nhận mỗi hàng một lần, nên hai câu cùng loại đứng cạnh nhau
     * không thể cùng nhận một hàng.
     */
    const findExisting = (q: (typeof spec.quiz.questions)[number], idx: number) => {
      if (q.key && byKey.has(q.key)) return byKey.get(q.key)!;
      const byText = byPrompt.get(q.prompt.trim());
      if (byText) return byText;
      if (!q.key) return undefined;
      // Cùng loại + cùng câu mở đầu: câu hỏi vừa được thêm hình hoặc sửa cách
      // trình bày, không phải câu mới.
      const opening = openingText(q.prompt);
      const byOpening = quiz.questions.find(
        (row) =>
          row.type === q.type &&
          !(row.extra as { manifestKey?: string } | null)?.manifestKey &&
          !adopted.has(row.id) &&
          openingText(row.prompt) === opening,
      );
      if (byOpening) {
        adopted.add(byOpening.id);
        console.log(`  · gắn khoá "${q.key}" cho câu hỏi sẵn có (khớp câu mở đầu)`);
        return byOpening;
      }
      // KHÔNG nhận theo vị trí. Đã thử và nó bắt nhầm: một câu hỏi mới cùng
      // loại, cùng chỉ số với một câu sẵn có (chưa gắn khoá) sẽ bị coi là bản
      // sửa của câu ấy và ghi đè lên — mất một câu hỏi mà log chỉ nói "đã sửa".
      // Đề bài viết mới hoàn toàn thì cứ để nó thành câu mới, rồi gỡ câu cũ
      // bằng tay: thà thừa một câu còn hơn mất một câu.
      return undefined;
    };
    // Mã lỗi tư duy: tra id theo code, thiếu thì tạo — câu hỏi mới có thể trỏ
    // tới lỗi tư duy chưa từng xuất hiện ở lần nhập trước.
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

    let nextIndex = Math.max(-1, ...quiz.questions.map((q) => q.orderIndex)) + 1;
    for (const [qi, q] of spec.quiz.questions.entries()) {
      const payload = expandQuestion(q, qi, mcIds);
      const existing = findExisting(q, qi);
      if (!existing) {
        const orderIndex = nextIndex++;
        console.log(`  + câu hỏi mới (${q.type}): ${q.prompt.slice(0, 60)}…`);
        plan.push(async () => {
          await createQuestion(owner.id, quiz.id, { ...payload, orderIndex });
        });
        continue;
      }
      const hasKey = Boolean(
        (existing.extra as { manifestKey?: string } | null)?.manifestKey,
      );
      const same =
        (!q.key || hasKey) &&
        questionShape(payload) ===
        questionShape({
          prompt: existing.prompt,
          explanation: existing.explanation ?? undefined,
          points: existing.points,
          options: existing.options,
        });
      if (same) continue;
      if (attempts > 0 && !force) {
        console.log(
          `  ! câu hỏi đã đổi nhưng quiz có ${attempts} lượt làm — bỏ qua: ${q.prompt.slice(0, 50)}…\n` +
            `    (chạy lại với --force nếu thật sự muốn sửa)`,
        );
        continue;
      }
      console.log(`  ~ sửa câu hỏi: ${q.prompt.slice(0, 60)}…`);
      plan.push(async () => {
        await updateQuestion(owner.id, existing.id, {
          prompt: q.prompt,
          explanation: q.explanation ?? null,
          points: q.points,
          options: (payload.options as unknown[]) ?? undefined,
          ...(q.key ? { extra: { manifestKey: q.key } } : {}),
        });
      });
    }
    const specPrompts = new Set(spec.quiz.questions.map((q) => q.prompt.trim()));
    for (const q of quiz.questions) {
      if (adopted.has(q.id)) continue;
      if (!specPrompts.has(q.prompt.trim())) {
        console.log(`  ! câu hỏi có trên hệ thống mà không có trong manifest: ${q.prompt.slice(0, 50)}…`);
      }
    }
  } else if (spec.quiz && !quiz) {
    console.log("  ! manifest có quiz nhưng bài trên hệ thống chưa có — script này không tạo quiz mới");
  }

  if (plan.length === 0) {
    console.log("\nKhông có gì phải đổi.");
    return;
  }
  if (dryRun) {
    console.log(`\n[dry-run] ${plan.length} thay đổi. Không ghi gì.`);
    return;
  }
  for (const step of plan) await step();
  console.log(`\n✔ Đã ghi ${plan.length} thay đổi vào "${lesson.title}".`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
