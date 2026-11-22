/** Sắp khối trong mỗi bài Data Visualization: giới thiệu → ghi chú → thẻ ghi nhớ → slide → thực hành → còn lại. */
import { prisma } from "@feedbackme/db";
async function main() {
  const course = await prisma.course.findUniqueOrThrow({ where: { slug: "data-visualization-for-business-insights" } });
  const lessons = await prisma.lesson.findMany({ where: { module: { courseId: course.id }, title: { contains: " · " } }, select: { id: true, title: true } });
  for (const l of lessons) {
    const items = await prisma.contentItem.findMany({ where: { lessonId: l.id }, orderBy: { orderIndex: "asc" }, select: { id: true, type: true, payload: true, orderIndex: true } });
    const body = (c: (typeof items)[number]) => String((c.payload as { body?: string }).body ?? "");
    const rank = (c: (typeof items)[number]) =>
      c.type === "markdown" && body(c).startsWith("## In this lesson") ? 0 :
      c.type === "markdown" && body(c).startsWith("## Study notes") ? 1 :
      c.type === "vocab_list" ? 2 : c.type === "pdf" ? 3 :
      c.type === "markdown" && body(c).startsWith("### Practice") ? 4 : 5;
    const sorted = [...items].sort((a, b) => rank(a) - rank(b) || a.orderIndex - b.orderIndex);
    if (sorted.every((c, i) => c.id === items[i]!.id)) { console.log(`= ${l.title}`); continue; }
    for (const [i, c] of sorted.entries()) await prisma.contentItem.update({ where: { id: c.id }, data: { orderIndex: 1000 + i } });
    for (const [i, c] of sorted.entries()) await prisma.contentItem.update({ where: { id: c.id }, data: { orderIndex: i } });
    console.log(`✔ ${l.title}: ${sorted.map((c) => c.type[0]).join("")}`);
  }
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
