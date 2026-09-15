/**
 * Turn off Course.publicAccess for a course, via updateCourse (so the flip is
 * audited — course.public_access.toggled — unlike a raw SQL UPDATE).
 *
 *   tsx scripts/disable-public-access.ts <course-slug>
 */
import { prisma } from "@feedbackme/db";
import { updateCourse } from "@feedbackme/core-lms";

async function main() {
  const slug = process.argv[2];
  if (!slug) {
    console.error("usage: disable-public-access.ts <course-slug>");
    process.exit(1);
  }
  const course = await prisma.course.findUnique({ where: { slug } });
  if (!course) throw new Error(`no course ${slug}`);

  const owner = await prisma.courseInstructor.findFirst({
    where: { courseId: course.id, role: "owner" },
    select: { userId: true },
  });
  if (!owner) throw new Error(`course ${slug} has no owner`);

  await updateCourse(owner.userId, course.id, { publicAccess: false }, prisma);

  const after = await prisma.course.findUniqueOrThrow({
    where: { id: course.id },
    select: { publicAccess: true },
  });
  console.log(`${slug}: publicAccess -> ${after.publicAccess}`);

  const entry = await prisma.auditLog.findFirst({
    where: { action: "course.public_access.toggled" },
    orderBy: { occurredAt: "desc" },
  });
  console.log("audit log:", entry ? JSON.stringify(entry.payload) : "(không thấy)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
