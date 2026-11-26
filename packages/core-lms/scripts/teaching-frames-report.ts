/**
 * F3 của docs/tieu-chi/hsk-che-do-chieu-lop.md: dựng màn "Chiếu lớp" cho MỌI bài của một khoá và báo số màn mỗi bài.
 * Chỉ ĐỌC. Bài ra chỉ màn bìa, hoặc quá MAX màn, được liệt kê ở cuối.
 *
 *   pnpm --filter @feedbackme/core-lms exec node --env-file=../db/.env --import tsx scripts/teaching-frames-report.ts hsk-4-goc
 */
import { prisma } from "@feedbackme/db";
import { getPracticeBlockSummaries, getPracticeForTeaching } from "../src";
import type { TeachingPracticeInput } from "../../../apps/web/src/lib/teachingFrames";

const MAX = 120;
const slug = process.argv[2] ?? "hsk-4-goc";

async function main() {
  // Nhập động: tệp thuộc gói apps/web (CJS) nên tsx đưa các export vào `default`.
  const mod: any = await import("../../../apps/web/src/lib/teachingFrames");
  const buildTeachingFrames: typeof import("../../../apps/web/src/lib/teachingFrames").buildTeachingFrames = (mod.default ?? mod).buildTeachingFrames ?? mod.buildTeachingFrames;
  const course = await prisma.course.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      instructors: { where: { role: "owner" }, select: { userId: true } },
      modules: {
        orderBy: { orderIndex: "asc" },
        select: {
          title: true,
          lessons: {
            orderBy: { orderIndex: "asc" },
            select: { id: true, title: true, isHidden: true, contentItems: { where: { isHidden: false }, orderBy: { orderIndex: "asc" } } },
          },
        },
      },
    },
  });
  if (!course) throw new Error(`Không có khoá ${slug}`);
  const owner = course.instructors[0]?.userId;
  if (!owner) throw new Error("Khoá không có chủ");

  const rows: Array<{ mod: string; lesson: string; n: number; kinds: Record<string, number> }> = [];
  for (const m of course.modules) {
    for (const l of m.lessons) {
      if (l.isHidden) continue;
      const items = l.contentItems.filter((c) => c.type !== "teacher_note");
      const pi = items.filter((c) => c.type === "exam_practice");
      const sums = pi.length ? await getPracticeBlockSummaries(pi.map((c) => c.id)) : {};
      const practices: Record<string, TeachingPracticeInput> = {};
      for (const it of pi) {
        const s = sums[it.id];
        if (!s?.examId || s.questions === 0) continue;
        const e = await getPracticeForTeaching(owner, s.examId);
        practices[it.id] = {
          title: e.title,
          passages: e.passages.map((p) => ({ id: p.id, title: p.title, contentJson: p.contentJson })),
          questions: e.questions.map((q) => ({ id: q.id, type: q.type, prompt: q.prompt, passageId: q.passageId, config: q.config })),
        };
      }
      const frames = buildTeachingFrames({ lessonTitle: l.title, items: items.map((c) => ({ id: c.id, type: c.type, payload: c.payload })), practices });
      const kinds: Record<string, number> = {};
      for (const f of frames) kinds[f.kind] = (kinds[f.kind] ?? 0) + 1;
      rows.push({ mod: m.title.slice(0, 34), lesson: l.title.slice(0, 36), n: frames.length, kinds });
    }
  }
  for (const r of rows) console.log(`${String(r.n).padStart(4)}  ${r.mod.padEnd(34)} | ${r.lesson.padEnd(36)} ${JSON.stringify(r.kinds)}`);
  const bad = rows.filter((r) => r.n <= 1 || r.n > MAX);
  const total = rows.reduce((a, r) => a + r.n, 0);
  console.log(`\n${rows.length} bài, ${total} màn, trung bình ${(total / Math.max(1, rows.length)).toFixed(1)} màn/bài`);
  console.log(bad.length ? `Cần xem (≤1 hoặc >${MAX} màn):\n${bad.map((r) => `  ${r.n}  ${r.mod} | ${r.lesson}`).join("\n")}` : `Không bài nào ≤1 hoặc >${MAX} màn.`);
}

main().finally(() => prisma.$disconnect());
