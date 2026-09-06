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
import { createQuestion, updateQuestion } from "../src/quizzes/questions";
import { updateLesson } from "../src/courses/lessons";
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

  if (!file || !ownerEmail || !lessonKey) {
    console.error(
      "Thiếu tham số.\n" +
        "  --file <đường-dẫn.json>   file học liệu\n" +
        "  --owner <email>           tài khoản có quyền sửa khoá\n" +
        "  --lesson <chuỗi>          một phần tiêu đề bài, phải khớp đúng 1 bài\n" +
        "  --course <slug>           slug khoá (mặc định lấy trong manifest)\n" +
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

  const lessons = await prisma.lesson.findMany({
    where: { module: { courseId: course.id }, title: { contains: lessonKey } },
    select: {
      id: true,
      title: true,
      description: true,
      contentItems: { select: { id: true, type: true, payload: true, orderIndex: true }, orderBy: { orderIndex: "asc" } },
      quizzes: {
        select: {
          id: true,
          _count: { select: { attempts: true } },
          questions: {
            select: {
              id: true,
              prompt: true,
              explanation: true,
              points: true,
              orderIndex: true,
              type: true,
              options: { select: { label: true, isCorrect: true, extra: true }, orderBy: { orderIndex: "asc" } },
            },
            orderBy: { orderIndex: "asc" },
          },
        },
      },
    },
  });
  if (lessons.length !== 1) {
    console.error(
      lessons.length === 0
        ? `Khoá "${course.title}" không có bài nào khớp "${lessonKey}"`
        : `"${lessonKey}" khớp ${lessons.length} bài trên hệ thống: ${lessons.map((l) => l.title).join(" | ")}`,
    );
    process.exitCode = 1;
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

  if (spec.description && spec.description !== lesson.description) {
    console.log(`  ~ mô tả bài học`);
    plan.push(async () => {
      await updateLesson(owner.id, lesson.id, { description: spec.description });
    });
  }

  // ── Câu hỏi ─────────────────────────────────────────────────────────────────
  const quiz = lesson.quizzes[0];
  if (spec.quiz && quiz) {
    const attempts = quiz._count.attempts;
    const byPrompt = new Map(quiz.questions.map((q) => [q.prompt.trim(), q]));
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
      const existing = byPrompt.get(q.prompt.trim());
      if (!existing) {
        const orderIndex = nextIndex++;
        console.log(`  + câu hỏi mới (${q.type}): ${q.prompt.slice(0, 60)}…`);
        plan.push(async () => {
          await createQuestion(owner.id, quiz.id, { ...payload, orderIndex });
        });
        continue;
      }
      const same =
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
          explanation: q.explanation ?? null,
          points: q.points,
          options: (payload.options as unknown[]) ?? undefined,
        });
      });
    }
    const specPrompts = new Set(spec.quiz.questions.map((q) => q.prompt.trim()));
    for (const q of quiz.questions) {
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
