/**
 * Even out where the correct answer sits in multiple-choice questions.
 *
 * Questions written by hand tend to put the right answer first or second. If a
 * quiz is meant to assess, a learner who always picks the first two options
 * scores far above chance, so the position of the correct option has to be
 * spread evenly (it is shown in `orderIndex` order; the UI does not shuffle).
 *
 *   tsx scripts/rebalance-option-order.ts <course-slug> [--apply]
 *
 * Without --apply it only reports the distribution before and after.
 *
 * For each `mcq` question (in a stable order) the correct option is moved to
 * position `i mod n` (i = the question's rank in the course, n = number of
 * options); the wrong options keep their relative order. Only `orderIndex`
 * changes: option ids, labels, correctness and learners' recorded answers (which
 * point at option ids) are untouched.
 *
 * Skipped on purpose:
 *   - types other than `mcq` (`ordering` grades by orderIndex; true/false keeps
 *     the natural Đúng/Sai order),
 *   - questions whose options refer to each other by position or wording
 *     ("tất cả các đáp án trên", "cả A và B" …), where reordering would change
 *     the meaning.
 *
 * Idempotent: running it again reproduces the same order.
 */
import { prisma } from "@feedbackme/db";

const POSITIONAL = /(tất cả (các )?(đáp án|phương án|lựa chọn)|cả [a-d] và [a-d]|không (có )?(đáp án|phương án|cái nào)|(các )?(đáp án|phương án) (trên|còn lại|khác))/i;

function count(positions: number[], n = 4): number[] {
  const out = new Array<number>(n).fill(0);
  for (const p of positions) if (p >= 0 && p < n) out[p]!++;
  return out;
}

async function main() {
  const slug = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!slug || slug.startsWith("--")) {
    console.error("usage: rebalance-option-order.ts <course-slug> [--apply]");
    process.exit(1);
  }
  const course = await prisma.course.findUnique({ where: { slug } });
  if (!course) throw new Error(`no course ${slug}`);

  const questions = await prisma.quizQuestion.findMany({
    where: { type: "mcq", quiz: { courseId: course.id } },
    include: {
      options: { orderBy: [{ orderIndex: "asc" }, { id: "asc" }] },
      quiz: { select: { createdAt: true } },
    },
  });
  questions.sort(
    (a, b) =>
      a.quiz.createdAt.getTime() - b.quiz.createdAt.getTime() ||
      a.quizId.localeCompare(b.quizId) ||
      a.orderIndex - b.orderIndex ||
      a.id.localeCompare(b.id),
  );

  const before: number[] = [];
  const after: number[] = [];
  const plan: Array<{ optionId: string; orderIndex: number }> = [];
  let skippedPositional = 0;
  let skippedShape = 0;
  let rank = 0;

  for (const q of questions) {
    const opts = q.options;
    const correct = opts.filter((o) => o.isCorrect);
    const at = opts.findIndex((o) => o.isCorrect);
    if (correct.length !== 1 || opts.length < 3) {
      skippedShape++;
      continue;
    }
    before.push(at);
    if (opts.some((o) => POSITIONAL.test(o.label))) {
      skippedPositional++;
      after.push(at);
      continue;
    }
    const target = rank % opts.length;
    rank++;
    const others = opts.filter((o) => !o.isCorrect);
    const ordered = [...others.slice(0, target), correct[0]!, ...others.slice(target)];
    after.push(ordered.findIndex((o) => o.isCorrect));
    ordered.forEach((o, i) => {
      if (o.orderIndex !== i) plan.push({ optionId: o.id, orderIndex: i });
    });
  }

  const fmt = (c: number[]) => c.map((x, i) => `${i + 1}: ${x}`).join("   ");
  console.log(`${slug}: ${questions.length} mcq questions (${skippedShape} skipped for shape, ${skippedPositional} skipped as positional)`);
  console.log(`  correct-answer position BEFORE  ${fmt(count(before))}`);
  console.log(`  correct-answer position AFTER   ${fmt(count(after))}`);
  console.log(`  option rows to update: ${plan.length}`);

  if (!apply) {
    console.log("\nDry run — nothing changed. Rerun with --apply.");
    return;
  }
  for (let i = 0; i < plan.length; i += 200) {
    await prisma.$transaction(
      plan.slice(i, i + 200).map((p) =>
        prisma.questionOption.update({ where: { id: p.optionId }, data: { orderIndex: p.orderIndex } }),
      ),
    );
  }
  console.log(`\nUpdated ${plan.length} option rows.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
