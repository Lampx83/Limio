/** Đổi "School of Technology" → "College of Technology" trong khoá Data Visualization (mô tả + khối markdown). */
import { prisma } from "@feedbackme/db";
import { updateContentItem, updateCourse } from "@feedbackme/core-lms";
const FROM = /School of Technology/g, TO = "College of Technology";
async function main() {
  const course = await prisma.course.findUniqueOrThrow({ where: { slug: "data-visualization-for-business-insights" } });
  const actor = (await prisma.courseInstructor.findFirstOrThrow({ where: { courseId: course.id, role: "owner" } })).userId;
  if (FROM.test(course.description)) { await updateCourse(actor, course.id, { description: course.description.replace(FROM, TO) }, prisma); console.log("✔ description"); }
  const items = await prisma.contentItem.findMany({ where: { lesson: { module: { courseId: course.id } }, type: "markdown" }, select: { id: true, payload: true, lesson: { select: { title: true } } } });
  for (const it of items) {
    const body = String((it.payload as { body?: string }).body ?? "");
    if (!body.includes("School of Technology")) continue;
    await updateContentItem(actor, it.id, { payload: { ...(it.payload as object), body: body.replace(FROM, TO) } }, prisma);
    console.log(`✔ ${it.lesson.title}`);
  }
  const left = await prisma.$queryRaw<Array<{ n: bigint }>>`select count(*) n from "ContentItem" ci join "Lesson" l on l.id=ci."lessonId" join "Module" mo on mo.id=l."moduleId" where mo."courseId"=${course.id} and ci.payload::text ilike '%School of Technology%'`;
  const c2 = await prisma.course.findUniqueOrThrow({ where: { id: course.id }, select: { description: true } });
  console.log("còn lại:", Number(left[0]!.n), c2.description.includes("School of Technology"));
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
