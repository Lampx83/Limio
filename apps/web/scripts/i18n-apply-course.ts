/**
 * Write a translated course document (the JSON produced by i18n-export-course.ts, with its
 * strings translated) back into the database, matching every row by id.
 *
 *   tsx scripts/i18n-apply-course.ts <course-slug> <translated.json> [--apply]
 *
 * Without --apply it only reports what would change. Only text is written:
 *   course title/description, module titles, lesson title/description, the body of markdown
 *   items and the title of PDF items, quiz title/description, question prompt/explanation,
 *   option labels, assignment title/description, skill and misconception name/description.
 * Ids, ordering, which option is correct, question types and every attempt/answer a learner
 * has recorded are untouched (answers point at option ids, and ids never change).
 *
 * Skills that the platform generates from a lesson (code `lesson.<lessonId>`) take the new
 * lesson title as their name, as they did when they were created.
 *
 * Restoring: this script is its own undo. Run it with the ORIGINAL export file (the untranslated
 * JSON) and the same course slug.
 *
 * Idempotent: writing the same document twice changes nothing the second time.
 */
import { readFileSync } from "node:fs";
import { prisma, Prisma } from "@feedbackme/db";

const AUTO_SKILL_DESCRIPTION = "Topic auto-generated from the lesson (B1.5). Deleting the lesson deletes this topic.";

interface Doc {
  course: { id: string; slug: string; title: string; description: string };
  modules: Array<{ id: string; title: string }>;
  lessons: Array<{
    id: string;
    title: string;
    description: string | null;
    items: Array<{ id: string; type: string; body?: string; pdfTitle?: string | null }>;
    quizzes: Array<{
      id: string;
      title: string;
      description: string | null;
      questions: Array<{
        id: string;
        prompt: string;
        explanation: string | null;
        options: Array<{ id: string; label: string }>;
      }>;
    }>;
    assignments: Array<{ id: string; title: string; description: string }>;
  }>;
  skills: Array<{ id: string; code: string; name: string; description: string | null }>;
  misconceptions: Array<{ id: string; code: string; name: string; description: string }>;
}

async function main() {
  const [slug, file] = process.argv.slice(2);
  const apply = process.argv.includes("--apply");
  if (!slug || !file || slug.startsWith("--")) {
    console.error("usage: i18n-apply-course.ts <course-slug> <translated.json> [--apply]");
    process.exit(1);
  }
  const doc = JSON.parse(readFileSync(file, "utf8")) as Doc;
  if (doc.course.slug !== slug) throw new Error(`document is for ${doc.course.slug}, not ${slug}`);

  const course = await prisma.course.findUnique({ where: { slug } });
  if (!course || course.id !== doc.course.id) throw new Error("course id mismatch");

  // Every id in the document must exist and belong to this course, before anything is written.
  const [lessonRows, moduleRows] = await Promise.all([
    prisma.lesson.findMany({ where: { module: { courseId: course.id } }, select: { id: true } }),
    prisma.module.findMany({ where: { courseId: course.id }, select: { id: true } }),
  ]);
  const lessonSet = new Set(lessonRows.map((l) => l.id));
  const moduleSet = new Set(moduleRows.map((m) => m.id));
  for (const l of doc.lessons) if (!lessonSet.has(l.id)) throw new Error(`lesson ${l.id} is not in ${slug}`);
  for (const m of doc.modules) if (!moduleSet.has(m.id)) throw new Error(`module ${m.id} is not in ${slug}`);

  const lessonTitle = new Map(doc.lessons.map((l) => [l.id, l.title]));
  const ops: Array<{ what: string; run: () => Prisma.PrismaPromise<unknown> }> = [];
  const add = (what: string, run: () => Prisma.PrismaPromise<unknown>) => ops.push({ what, run });

  add("course", () =>
    prisma.course.update({ where: { id: course.id }, data: { title: doc.course.title, description: doc.course.description } }),
  );
  for (const m of doc.modules) add("module", () => prisma.module.update({ where: { id: m.id }, data: { title: m.title } }));

  const itemRows = await prisma.contentItem.findMany({
    where: { id: { in: doc.lessons.flatMap((l) => l.items.map((i) => i.id)) } },
    select: { id: true, lessonId: true, type: true, payload: true },
  });
  const itemById = new Map(itemRows.map((r) => [r.id, r]));

  for (const l of doc.lessons) {
    add("lesson", () => prisma.lesson.update({ where: { id: l.id }, data: { title: l.title, description: l.description } }));
    for (const it of l.items) {
      const row = itemById.get(it.id);
      if (!row || row.lessonId !== l.id) throw new Error(`content item ${it.id} does not belong to lesson ${l.id}`);
      const payload = { ...(row.payload as Record<string, unknown>) };
      if (it.type === "pdf") payload.title = it.pdfTitle ?? undefined;
      else payload.body = it.body ?? "";
      add(`item:${it.type}`, () =>
        prisma.contentItem.update({ where: { id: it.id }, data: { payload: payload as Prisma.InputJsonValue } }),
      );
    }
    for (const q of l.quizzes) {
      add("quiz", () => prisma.quiz.update({ where: { id: q.id }, data: { title: q.title, description: q.description } }));
      for (const x of q.questions) {
        add("question", () =>
          prisma.quizQuestion.update({ where: { id: x.id }, data: { prompt: x.prompt, explanation: x.explanation } }),
        );
        for (const o of x.options) {
          add("option", () => prisma.questionOption.update({ where: { id: o.id }, data: { label: o.label } }));
        }
      }
    }
    for (const a of l.assignments) {
      add("assignment", () =>
        prisma.assignment.update({ where: { id: a.id }, data: { title: a.title, description: a.description } }),
      );
    }
  }

  for (const s of doc.skills) {
    const lessonId = s.code.startsWith("lesson.") ? s.code.slice("lesson.".length) : null;
    if (lessonId) {
      const t = lessonTitle.get(lessonId);
      if (!t) continue; // skill of a lesson that is not in this document
      add("skill(auto)", () =>
        prisma.skill.update({ where: { id: s.id }, data: { name: t, description: AUTO_SKILL_DESCRIPTION } }),
      );
    } else {
      add("skill", () => prisma.skill.update({ where: { id: s.id }, data: { name: s.name, description: s.description } }));
    }
  }
  for (const m of doc.misconceptions) {
    add("misconception", () =>
      prisma.misconception.update({ where: { id: m.id }, data: { name: m.name, description: m.description } }),
    );
  }

  const counts: Record<string, number> = {};
  for (const o of ops) counts[o.what] = (counts[o.what] ?? 0) + 1;
  console.log(`${slug}: ${ops.length} updates`);
  console.log("  " + Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(", "));

  if (!apply) {
    console.log("\nDry run — nothing written. Rerun with --apply.");
    return;
  }
  for (let i = 0; i < ops.length; i += 100) {
    await prisma.$transaction(ops.slice(i, i + 100).map((o) => o.run()));
  }
  console.log(`\nWrote ${ops.length} updates.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
